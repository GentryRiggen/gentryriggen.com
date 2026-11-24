"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  InstancedMesh,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  HemisphereLight,
  Vector3,
} from "three";
import type { ShipId } from "@/lib/shipwreck/ships/types";
import type { SceneRuntime } from "./runtime";
import { meshGeometry, useGiglio } from "./Coast";
import { snowAt, stormLightAt } from "./storm";
import {
  UNDER_LIGHT_DAY_GAIN,
  UNDER_LIGHT_NIGHT_WATER,
  underLightOf,
} from "./underLight";
import {
  NIGHT_DEEP_FOG,
  NIGHT_FOG,
  NIGHT_SEA_FOG,
  DAY_LOOKS,
  moonAt,
  dayLookOf,
  isDaylit,
  type DayLook,
  sunDirection,
  sunDirectionInto,
  type SceneSettings,
} from "./settings";
import {
  LOOK_UNDER_LAMP_RANGE_M,
  LOOK_UNDER_NIGHT_WATER,
  lookUnderAmbient,
  lookUnderFog,
  lookUnderLamp,
  walkAmbient,
} from "./walkCamera";

/**
 * Light, fog and the deep. The night (the Titanic): very low starlight
 * (hemisphere), the night fog to the horizon, and under the surface a
 * blue-black fog that thickens with depth, the mud of the sea floor at
 * `seaDepthM` and a submersible's lamp on the camera so the wreck is
 * readable. The afternoon (the Lusitania): the sun (a directional light at
 * the computed angles) and the blue sky (hemisphere), a light haze, and
 * under the surface green water with shafts of sunlight, dimming with
 * depth, over a floor of sand and shingle. The Carpathia's morning is the
 * same daylight in her own colours (`SceneSettings.daylight`): a thicker
 * haze, blue water darkening to a grey-brown floor 150 m down. The storm (the Fitzgerald): a
 * grey overcast sky light fading from 3:30 PM to night, her deck lamps
 * (the ship rig's), snow haze thickening in the squalls, and under the
 * surface cold dark fresh water over a grey clay floor 162 m down.
 */

const SEA_FOG = NIGHT_SEA_FOG;
const DEEP_FOG = NIGHT_DEEP_FOG;
/**
 * The afternoon's haze (exp² density: the coast, 20 km off, half hidden)
 * and its sunlit Celtic Sea water, green near the top, darker down, are
 * `DAY_LOOKS.afternoon`; the morning's (the Aegean) `DAY_LOOKS.morning`;
 * a ship's own `daylight` (the Carpathia's) goes over either.
 */
const DAY_LOOKS_AFTERNOON = DAY_LOOKS.afternoon;
/** Under water: the haze just under the surface and at the floor (1.1's). */
const DAY_UNDER_DENSITY = [0.0085, 0.0125] as const;
/** The sunlight's ripples on the floor (1.1's strength at the top). */
const DAY_CAUSTICS = 0.12;
/** The submersible lamp's reach (m), at night and in the afternoon. */
const LAMP_RANGE_M = 420;
const DAY_LAMP_RANGE_M = 300;

function sandTexture(base = "#a89a7c"): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let a = 1915;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  // Soft ripples of sand, then shingle and shell.
  for (let i = 0; i < 180; i += 1) {
    const l = 52 + rnd() * 20;
    g.fillStyle = `hsla(40, 18%, ${l}%, 0.12)`;
    g.beginPath();
    g.ellipse(
      rnd() * 256,
      rnd() * 256,
      10 + rnd() * 30,
      3 + rnd() * 6,
      0.3,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  for (let i = 0; i < 900; i += 1) {
    const l = 30 + rnd() * 55;
    const r = 0.6 + rnd() * 2.2;
    g.fillStyle = `hsla(${30 + rnd() * 20}, ${8 + rnd() * 12}%, ${l}%, 0.85)`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 3000; i += 1) {
    const l = 40 + rnd() * 45;
    g.fillStyle = `hsla(40, 12%, ${l}%, 0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1200, 1200);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function mudTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#4a4136";
  g.fillRect(0, 0, 256, 256);
  // Deterministic speckle and soft blotches.
  let a = 77;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 260; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 6 + rnd() * 26;
    const l = 50 + rnd() * 30;
    g.fillStyle = `hsla(34, 14%, ${l}%, 0.10)`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 4000; i += 1) {
    const l = 20 + rnd() * 50;
    g.fillStyle = `hsla(30, 10%, ${l}%, 0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface EnvironmentProps {
  runtime: SceneRuntime;
  /** Whose night it is (the Concordia's has Giglio's shelf and the moon). */
  ship: ShipId;
  /** The sea floor's depth under the ship on the stage (m). */
  seaDepthM: number;
  /** The ship's scene (night or afternoon). */
  settings: SceneSettings;
}

export default function Environment({
  runtime,
  ship,
  seaDepthM,
  settings,
}: EnvironmentProps) {
  if (settings.timeOfDay === "storm-dusk")
    return (
      <StormEnvironment
        runtime={runtime}
        ship={ship}
        seaDepthM={seaDepthM}
        settings={settings}
      />
    );
  if (isDaylit(settings))
    return (
      <AfternoonEnvironment
        runtime={runtime}
        ship={ship}
        seaDepthM={seaDepthM}
        settings={settings}
      />
    );
  return (
    <NightEnvironment
      runtime={runtime}
      ship={ship}
      seaDepthM={seaDepthM}
      settings={settings}
    />
  );
}

function NightEnvironment({
  runtime,
  ship,
  seaDepthM: SEA_DEPTH,
  settings,
}: EnvironmentProps) {
  const { scene, camera } = useThree();
  // The Concordia's night: Giglio's sloping floor (giglio.ts, her seabed's
  // `floorAt`) and seagrass in place of the flat mud, her own water, and
  // the moon once it has risen. Every other night is 1.0's.
  const giglio = ship === "concordia";
  const moon = settings.moon ?? null;
  const ownSea = useMemo(
    () => (giglio ? new Color(settings.underwaterFog) : SEA_FOG),
    [giglio, settings]
  );

  const fog = useMemo(() => new FogExp2(NIGHT_FOG.getHex(), 0.00011), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = new Color(0x02040a);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog]);

  const floor = useMemo(() => {
    const map = mudTexture();
    const mat = new MeshStandardMaterial({
      color: 0x8a7f70,
      map,
      roughness: 1,
      metalness: 0,
    });
    const geo = new PlaneGeometry(24000, 24000);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea-floor";
    return { m, geo, mat, map };
  }, []);
  useEffect(() => {
    floor.m.position.y = -SEA_DEPTH;
  }, [floor, SEA_DEPTH]);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  // Giglio's floor: granite, Posidonia meadows, sand and mud by depth
  // (vertex colours), and the meadows' seagrass as crossed cards.
  const isle = useGiglio();
  const shelf = useMemo(() => {
    if (!giglio || !isle) return null;
    const mat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });
    const floorGeo = meshGeometry(isle.floor);
    const m = new Mesh(floorGeo, mat);
    m.name = "sea-floor";
    m.frustumCulled = false;
    const n = isle.grass.cards.length / 5;
    const card = new BufferGeometry();
    // A clump of five narrow blades (Posidonia's ribbons, about 1 cm wide
    // and a metre long [WP]: drawn 0.12 m so they read), leaning out.
    const blade: number[] = [];
    const ix: number[] = [];
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = 0.06;
      const lean = 0.25;
      const o = blade.length / 3;
      // Two quads a blade (bent once), across the lean direction.
      blade.push(
        -sa * w,
        0,
        ca * w,
        sa * w,
        0,
        -ca * w,
        sa * w + ca * lean * 0.4,
        0.55,
        -ca * w + sa * lean * 0.4,
        -sa * w + ca * lean * 0.4,
        0.55,
        ca * w + sa * lean * 0.4,
        ca * lean,
        1.05,
        sa * lean
      );
      ix.push(o, o + 1, o + 2, o, o + 2, o + 3, o + 3, o + 2, o + 4);
    }
    card.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(blade), 3)
    );
    card.setIndex(ix);
    card.computeVertexNormals();
    const cardMat = new MeshStandardMaterial({
      color: 0x3f6a2c,
      roughness: 0.9,
      side: DoubleSide,
    });
    const grass = new InstancedMesh(card, cardMat, n);
    // Worked out with the island, a step at a time (giglio.ts).
    (grass.instanceMatrix.array as Float32Array).set(isle.grass.matrices);
    grass.instanceMatrix.needsUpdate = true;
    grass.frustumCulled = false;
    grass.name = "seagrass";
    return { m, floorGeo, mat, grass, card, cardMat };
  }, [giglio, isle]);
  // The moon (a faint blue-white directional light once it has risen).
  // Made and mounted from her night's first frame, not with the shelf:
  // three.js compiles its shaders for the number of lights, so a light
  // added a second or two in would recompile every lit material mid-run.
  const moonLight = useMemo(() => {
    if (!giglio) return null;
    const l = new DirectionalLight(0xc8d4ff, 0);
    l.name = "moonlight";
    return l;
  }, [giglio]);
  useEffect(
    () => () => {
      if (!shelf) return;
      // The GPU copies go; the CPU arrays stay (giglio.ts keeps them).
      shelf.floorGeo.dispose();
      shelf.mat.dispose();
      shelf.card.dispose();
      shelf.cardMat.dispose();
      shelf.grass.dispose();
    },
    [shelf]
  );
  const moonDir = useMemo(() => new Vector3(), []);
  const moonArr = useMemo(() => [0, 0, 0] as [number, number, number], []);

  // Starlight; a rocket's burst lights everything briefly (white).
  const sky = useMemo(() => {
    const h = new HemisphereLight(0x4a5c86, 0x06080e, 0.9);
    h.name = "starlight";
    return h;
  }, []);

  const lamp = useMemo(() => {
    const l = new SpotLight(0xd8ecff, 0, LAMP_RANGE_M, 0.55, 0.6, 1.1);
    l.name = "submersible-lamp";
    return l;
  }, []);
  const lookUnderWater = useMemo(() => new Color(LOOK_UNDER_NIGHT_WATER), []);
  const lightWater = useMemo(() => new Color(UNDER_LIGHT_NIGHT_WATER), []);

  useFrame((state) => {
    const y = camera.position.y;
    const under = y < 0;
    if (under) {
      // Thicker and darker the deeper it goes.
      const k = Math.min(1, -y / 600);
      fog.color.copy(ownSea).lerp(DEEP_FOG, k);
      // Look under (from the sea while walking): clearer and lighter
      // water, to watch her go.
      if (runtime.walkLookUnder) fog.color.copy(lookUnderWater);
      // The water-light button: clearer, lighter water.
      const L = underLightOf(runtime.underLight);
      fog.color.lerp(lightWater, L.lift);
      fog.density =
        lookUnderFog("night", 0.0065 - 0.002 * k, runtime.walkLookUnder) *
        L.fog;
      (scene.background as Color).copy(fog.color);
    } else {
      fog.color.copy(NIGHT_FOG);
      fog.density = 0.00011;
      (scene.background as Color).set(0x02040a);
    }
    floor.m.visible = !shelf && y < -SEA_DEPTH + 2500;
    if (shelf) {
      // Under the opaque sea from above: only drawn from below it.
      shelf.m.visible = under;
      shelf.grass.visible = under;
    }
    if (moonLight) {
      // The moon at the shown clock (real seconds since her first event),
      // lighting from where it stands once risen; brighter the higher.
      const f = runtime.frame;
      const m = moon
        ? moonAt(moon, moon.utcMs + (f ? f.realT : 0) * 1000)
        : null;
      const up = m
        ? Math.max(0, Math.sin((m.elevationDeg * Math.PI) / 180))
        : 0;
      if (m && up > 0) {
        sunDirectionInto(m, settings.headingDeg ?? 90, moonArr);
        moonDir.set(moonArr[0], moonArr[1], moonArr[2]);
        moonLight.position.copy(camera.position).addScaledVector(moonDir, 2000);
        moonLight.target.position.copy(camera.position);
        moonLight.target.updateMatrixWorld();
      }
      moonLight.intensity = under || !m ? 0 : Math.min(1, up * 3) * m.lit * 0.9;
    }
    // The lamp rides on the camera, a little above, pointing where it looks.
    // (Her shallow shelf: the lamp full on from just under the surface,
    // so the granite and the seagrass 10–30 m down read.)
    const L = underLightOf(under ? runtime.underLight : 0);
    lamp.intensity =
      lookUnderLamp(
        "night",
        under ? Math.min(1, -y / (shelf ? 4 : 40)) * 320 : 0,
        runtime.walkLookUnder
      ) * L.lamp;
    lamp.distance = runtime.walkLookUnder
      ? LOOK_UNDER_LAMP_RANGE_M
      : LAMP_RANGE_M;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
    runtime.underwater = under;
    // Walking: a faint lift so a child can see the deck.
    sky.intensity = walkAmbient(
      under
        ? lookUnderAmbient(shelf ? 0.6 : 0.25, runtime.walkLookUnder) *
            L.ambient
        : 0.9 + runtime.flash * 5,
      runtime.walkInfo?.phase === "deck"
    );
  }, -0.8);

  return (
    <>
      <primitive object={sky} />
      <primitive object={floor.m} />
      {shelf && (
        <>
          <primitive object={shelf.m} />
          <primitive object={shelf.grass} />
        </>
      )}
      {moonLight && (
        <>
          <primitive object={moonLight} />
          <primitive object={moonLight.target} />
        </>
      )}
      <primitive object={lamp} />
      <primitive object={lamp.target} />
    </>
  );
}

function AfternoonEnvironment({
  runtime,
  seaDepthM: SEA_DEPTH,
  settings,
}: EnvironmentProps) {
  const { scene, camera } = useThree();
  // The afternoon's are 1.1's constants; the morning's its own; a ship's
  // own daylight (the Carpathia's) over either (settings.ts).
  const look = dayLookOf(settings);
  const own = settings.daylight;
  const hazeDensity = own?.hazeDensity ?? look.fogDensity;
  const sunColor = own?.sunColor ?? look.sunColor;
  const sunIntensity = own?.sunIntensity ?? look.sunIntensity;
  const skyIntensity = own?.skyIntensity ?? look.skyIntensity;
  const haze = useMemo(() => new Color(settings.fog), [settings]);
  const deepWater = useMemo(
    () => new Color(own?.deepWater ?? look.deepWater),
    [own, look]
  );
  const shallow = useMemo(() => new Color(settings.underwaterFog), [settings]);
  const sunDir = useMemo(
    () =>
      settings.sun
        ? sunDirection(settings.sun, settings.headingDeg ?? 90)
        : ([0, 1, 0] as [number, number, number]),
    [settings]
  );

  const fog = useMemo(
    () => new FogExp2(haze.getHex(), hazeDensity),
    [haze, hazeDensity]
  );
  useEffect(() => {
    fog.color.copy(haze);
    scene.fog = fog;
    scene.background = haze.clone();
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, haze]);

  const floor = useMemo(() => {
    const map = sandTexture(look.floorBase);
    const mat = new MeshStandardMaterial({
      color: look.floorColor,
      map,
      roughness: 1,
      metalness: 0,
    });
    const caustics = { uTime: { value: 0 }, uCaustic: { value: 0 } };
    // Sunlight's ripples dancing on the sand (faint at 93 m).
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, caustics);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vCausticXZ;"
        )
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvCausticXZ = (modelMatrix * vec4(transformed, 1.0)).xz;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vCausticXZ;
uniform float uTime;
uniform float uCaustic;
float causticAt(vec2 p) {
  // Two warped ripple layers at odd angles: a loose, moving net of light.
  vec2 q = p * 0.13;
  q += vec2(sin(q.y * 0.7 + uTime * 0.3), cos(q.x * 0.6 - uTime * 0.25)) * 1.4;
  float a = sin(q.x * 1.3 + q.y * 0.4 + uTime * 0.5);
  float b = sin(q.y * 1.1 - q.x * 0.5 - uTime * 0.4);
  float c1 = pow(1.0 - abs(a * b), 9.0);
  vec2 r = p * 0.21 + vec2(3.1, 1.7);
  float d = sin(r.x * 0.9 - r.y * 1.2 + uTime * 0.6) * sin(r.y * 0.8 + r.x * 0.3 - uTime * 0.35);
  return c1 * (0.4 + 0.6 * pow(1.0 - abs(d), 5.0));
}`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(${look.caustic.map((c) => c.toFixed(3)).join(", ")}) * causticAt(vCausticXZ) * uCaustic;`
        );
    };
    // The caustics' colour is baked in: a program per look.
    mat.customProgramCacheKey = () =>
      look === DAY_LOOKS_AFTERNOON
        ? "shipwreck-sand"
        : look === DAY_LOOKS.morning
          ? "shipwreck-sand-morning"
          : `shipwreck-sand-${look.caustic.join("-")}`;
    const geo = new PlaneGeometry(24000, 24000);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea-floor";
    return { m, geo, mat, map, caustics };
  }, [look]);
  useEffect(() => {
    floor.m.position.y = -SEA_DEPTH;
  }, [floor, SEA_DEPTH]);
  useEffect(() => {
    if (own) floor.mat.color.set(own.floor);
  }, [floor, own]);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  const lights = useMemo(() => {
    const sun = new DirectionalLight(sunColor, sunIntensity);
    sun.name = "sun";
    const sky = new HemisphereLight(
      own?.skyColor ?? look.skyColor,
      own?.skyGround ?? look.skyGround,
      skyIntensity
    );
    sky.name = "skylight";
    const lamp = new SpotLight(0xd8ecff, 0, DAY_LAMP_RANGE_M, 0.6, 0.6, 1.1);
    lamp.name = "submersible-lamp";
    return {
      sun,
      sky,
      lamp,
      warm: new Color(own ? own.sunColor : look.warm),
      under: new Color(own?.sunUnder ?? look.sunUnder),
    };
  }, [look, own, sunColor, sunIntensity, skyIntensity]);
  useEffect(() => {
    lights.sun.position
      .set(sunDir[0], sunDir[1], sunDir[2])
      .multiplyScalar(1000);
  }, [lights, sunDir]);

  const water = useMemo(() => new Color(), []);
  const lightWater = useMemo(() => new Color(), []);
  useFrame((state) => {
    const y = camera.position.y;
    const under = y < 0;
    const k = Math.min(1, Math.max(0, -y / SEA_DEPTH));
    if (under) {
      // Green and bright near the top, dimmer toward the floor.
      water.copy(shallow).lerp(deepWater, k * 0.85);
      // The water-light button: toward her shallow water, made lighter.
      const L = underLightOf(runtime.underLight);
      if (L.lift > 0)
        water.lerp(
          lightWater.copy(shallow).multiplyScalar(UNDER_LIGHT_DAY_GAIN),
          L.lift
        );
      fog.color.copy(water);
      const [top, deep] = own?.underDensity ?? DAY_UNDER_DENSITY;
      fog.density =
        lookUnderFog(
          "afternoon",
          top + (deep - top) * k,
          runtime.walkLookUnder
        ) * L.fog;
      (scene.background as Color).copy(water);
      lights.sun.color.copy(lights.under);
      lights.sun.intensity = sunIntensity * (0.45 - 0.33 * k);
      lights.sky.intensity = walkAmbient(
        (0.95 - 0.55 * k) * L.ambient,
        runtime.walkInfo?.phase === "deck"
      );
    } else {
      fog.color.copy(haze);
      fog.density = hazeDensity;
      (scene.background as Color).copy(haze);
      lights.sun.color.copy(lights.warm);
      lights.sun.intensity = sunIntensity;
      lights.sky.intensity = walkAmbient(
        skyIntensity,
        runtime.walkInfo?.phase === "deck"
      );
    }
    floor.m.visible = under;
    floor.caustics.uTime.value = state.clock.elapsedTime;
    floor.caustics.uCaustic.value = under
      ? (own?.caustics ?? DAY_CAUSTICS) * (1 - 0.5 * k)
      : 0;
    const lamp = lights.lamp;
    lamp.intensity =
      lookUnderLamp(
        "afternoon",
        under ? Math.min(1, -y / 50) * 160 : 0,
        runtime.walkLookUnder
      ) * underLightOf(under ? runtime.underLight : 0).lamp;
    lamp.distance = runtime.walkLookUnder
      ? LOOK_UNDER_LAMP_RANGE_M
      : DAY_LAMP_RANGE_M;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
    runtime.underwater = under;
  }, -0.8);

  return (
    <>
      <primitive object={lights.sun} />
      <primitive object={lights.sky} />
      <primitive object={floor.m} />
      <primitive object={lights.lamp} />
      <primitive object={lights.lamp.target} />
      <LightShafts
        sunDir={sunDir}
        seaDepthM={SEA_DEPTH}
        look={look}
        tint={own?.shafts}
      />
    </>
  );
}

const SHAFTS = 22;
const SHAFT_SPAN = 150;

const shaftVertex = /* glsl */ `
  attribute vec2 aBase;
  attribute vec2 aCorner;
  attribute float aSeed;
  uniform vec3 uCam;
  uniform vec3 uDown;
  uniform float uDepth;
  uniform float uSpan;
  varying float vAcross;
  varying float vDepth;
  varying float vSeed;
  void main() {
    // Each shaft stays within uSpan of the camera (wrapping as it moves).
    vec2 rel = mod(aBase - uCam.xz + uSpan * 0.5, uSpan) - uSpan * 0.5;
    vec3 top = vec3(uCam.x + rel.x, -0.5, uCam.z + rel.y);
    float len = uDepth / max(0.3, -uDown.y);
    vec3 p = top + uDown * len * aCorner.y;
    vec3 toCam = normalize(uCam - p);
    vec3 across = normalize(cross(uDown, toCam));
    float w = 1.5 + 4.0 * aSeed;
    p += across * aCorner.x * w * (1.0 + aCorner.y * 1.5);
    vAcross = aCorner.x;
    vDepth = -p.y;
    vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const shaftFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform vec3 uColor;
  varying float vAcross;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float side = 1.0 - vAcross * vAcross;
    float fade = exp(-vDepth / 38.0) * smoothstep(0.0, 4.0, vDepth);
    float flicker = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed) + vSeed * 40.0);
    float a = side * side * fade * flicker * uStrength;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

/**
 * Shafts of sunlight slanting down through the green water (refracted: the
 * sun 50° up comes in about 29° from the vertical), fading with depth. Only
 * under water. One draw call.
 */
function LightShafts({
  sunDir,
  seaDepthM,
  look,
  tint,
}: {
  sunDir: readonly [number, number, number];
  seaDepthM: number;
  look: DayLook;
  /** Their colour over the look's (linear; the water's). */
  tint?: readonly [number, number, number];
}) {
  const shafts = useMemo(() => {
    const pos = new Float32Array(SHAFTS * 4 * 3);
    const base = new Float32Array(SHAFTS * 4 * 2);
    const corner = new Float32Array(SHAFTS * 4 * 2);
    const seed = new Float32Array(SHAFTS * 4);
    const index: number[] = [];
    let a = 507;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (let i = 0; i < SHAFTS; i += 1) {
      const bx = rnd() * SHAFT_SPAN;
      const bz = rnd() * SHAFT_SPAN;
      const s = rnd();
      const corners = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
      ];
      corners.forEach(([cx, cy], k) => {
        const v = i * 4 + k;
        base[v * 2] = bx;
        base[v * 2 + 1] = bz;
        corner[v * 2] = cx;
        corner[v * 2 + 1] = cy;
        seed[v] = s;
      });
      const o = i * 4;
      index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aBase", new BufferAttribute(base, 2));
    geo.setAttribute("aCorner", new BufferAttribute(corner, 2));
    geo.setAttribute("aSeed", new BufferAttribute(seed, 1));
    geo.setIndex(index);
    const mat = new ShaderMaterial({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uCam: { value: new Vector3() },
        uDown: { value: new Vector3() },
        uDepth: { value: 90 },
        uSpan: { value: SHAFT_SPAN },
        uTime: { value: 0 },
        uStrength: { value: look.shaftStrength },
        uColor: { value: new Vector3(...look.shaft) },
      },
    });
    const mesh = new Mesh(geo, mat);
    mesh.name = "light-shafts";
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    return { mesh, geo, mat };
  }, [look]);
  useEffect(() => {
    // Snell: sin(in water) = sin(from the vertical in air) / 1.33.
    const h = Math.hypot(sunDir[0], sunDir[2]);
    const sinAir = Math.min(1, h);
    const sinW = sinAir / 1.33;
    const cosW = Math.sqrt(1 - sinW * sinW);
    const hx = h > 1e-6 ? -sunDir[0] / h : 0;
    const hz = h > 1e-6 ? -sunDir[2] / h : 0;
    (shafts.mat.uniforms.uDown.value as Vector3).set(
      hx * sinW,
      -cosW,
      hz * sinW
    );
    shafts.mat.uniforms.uDepth.value = seaDepthM;
    const c = tint ?? look.shaft;
    (shafts.mat.uniforms.uColor.value as Vector3).set(c[0], c[1], c[2]);
  }, [shafts, sunDir, seaDepthM, tint, look]);
  useEffect(
    () => () => {
      shafts.geo.dispose();
      shafts.mat.dispose();
    },
    [shafts]
  );
  useFrame((state) => {
    const cam = state.camera.position;
    shafts.mesh.visible = cam.y < 0;
    (shafts.mat.uniforms.uCam.value as Vector3).copy(cam);
    shafts.mat.uniforms.uTime.value = state.clock.elapsedTime;
  }, -0.8);
  return <primitive object={shafts.mesh} />;
}

// ---------------------------------------------------------------------------
// The Fitzgerald's storm.

function clayTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  // Lake Superior's grey glacial clay: smooth, soft blotches and silt.
  g.fillStyle = "#8c8980";
  g.fillRect(0, 0, 256, 256);
  let a = 1975;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 220; i += 1) {
    const l = 38 + rnd() * 18;
    g.fillStyle = `hsla(45, 5%, ${l}%, 0.12)`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 8 + rnd() * 30, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 3500; i += 1) {
    const l = 30 + rnd() * 35;
    g.fillStyle = `hsla(40, 6%, ${l}%, 0.45)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(CLAY_REPEAT, CLAY_REPEAT);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Snow haze over the lake (exp² density): about 6 km visibility when the
 * snow is thin, under 2 km in a squall.
 */
/** The clay floor's size and its texture's tile (it follows the camera). */
const CLAY_FLOOR_M = 24000;
const CLAY_REPEAT = 220;
const CLAY_TILE_M = CLAY_FLOOR_M / CLAY_REPEAT;
const STORM_FOG_CLEAR = 0.00033;
const STORM_FOG_SQUALL = 0.0011;
/** Cold fresh water deep down, and near the surface at night. */
const STORM_DEEP_WATER = new Color(0x02080b);
const STORM_NIGHT_WATER = new Color(0x041210);

/**
 * A starlit storm night (`settings.stars`, the Poseidon's): the 1.0
 * night's clear haze in place of the snow, and starlight a little
 * stronger than the Titanic's (a look, not physics, as her starlight: a
 * moonless open ocean is darker, but a young player must see her lit
 * decks, the wave and her red bottom keel up). Her deep water: the
 * Atlantic's dark blue, black toward her 4,000 m floor.
 */
export const STARLIT = {
  fogDensity: 0.00011,
  sky: 0x8a96b4,
  ground: 0x1a2028,
  intensity: 1.9,
  deepWater: new Color(0x01060e),
} as const;

function StormEnvironment({
  runtime,
  seaDepthM: SEA_DEPTH,
  settings,
}: EnvironmentProps) {
  const { scene, camera } = useThree();
  const haze = useMemo(() => new Color(settings.fog), [settings]);
  const shallow = useMemo(() => new Color(settings.underwaterFog), [settings]);
  const fog = useMemo(
    () => new FogExp2(haze.getHex(), STORM_FOG_CLEAR),
    [haze]
  );
  useEffect(() => {
    scene.fog = fog;
    scene.background = haze.clone();
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, haze]);

  const floor = useMemo(() => {
    const map = clayTexture();
    // Grey glacial clay, light (albedo about a quarter).
    const mat = new MeshStandardMaterial({
      color: 0xdedbd2,
      map,
      roughness: 1,
      metalness: 0,
    });
    const geo = new PlaneGeometry(CLAY_FLOOR_M, CLAY_FLOOR_M);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea-floor";
    return { m, geo, mat, map };
  }, []);
  useEffect(() => {
    floor.m.position.y = -SEA_DEPTH;
  }, [floor, SEA_DEPTH]);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  // The overcast's light (no sun: the cloud hides it), and the lamp.
  const lights = useMemo(() => {
    const sky = new HemisphereLight(0xb2bcc2, 0x283230, 1);
    sky.name = "overcast";
    const lamp = new SpotLight(0xd8ecff, 0, 380, 0.55, 0.6, 1.1);
    lamp.name = "submersible-lamp";
    return {
      sky,
      lamp,
      daySky: new Color(0xb2bcc2),
      nightSky: new Color(0x26303a),
      dayGround: new Color(0x283230),
      nightGround: new Color(0x06090a),
      // Under the water: the dim light of the water itself (as the night's
      // starlight under the Titanic), so the lamp is not all there is.
      waterSky: new Color(0x6f8f8a),
      waterGround: new Color(0x0a1414),
    };
  }, []);

  const water = useMemo(() => new Color(), []);
  const lightWater = useMemo(() => new Color(), []);
  const starlit = settings.stars === true;
  const starSky = useMemo(() => new Color(STARLIT.sky), []);
  const starGround = useMemo(() => new Color(STARLIT.ground), []);
  useFrame((state) => {
    const y = camera.position.y;
    const under = runtime.underwater;
    const t = runtime.frame?.t ?? 0;
    const d = stormLightAt(runtime, t);
    const k = Math.min(1, Math.max(0, -y / SEA_DEPTH));
    lights.sky.color.copy(lights.nightSky).lerp(lights.daySky, d);
    lights.sky.groundColor.copy(lights.nightGround).lerp(lights.dayGround, d);
    if (starlit && !under) {
      // A clear night: starlight, the night's haze (no snow).
      lights.sky.color.copy(starSky);
      lights.sky.groundColor.copy(starGround);
      lights.sky.intensity = STARLIT.intensity;
      fog.color.copy(haze);
      fog.density = STARLIT.fogDensity;
      (scene.background as Color).copy(haze);
    } else if (under) {
      // Grey-green under the storm's surface, black toward the floor.
      // (Lake Superior is clear: the murk is the storm's, near the top.)
      // (A starlit night's deep blue ocean: her own water, black below.)
      water
        .copy(starlit ? shallow : STORM_NIGHT_WATER)
        .lerp(shallow, d)
        .lerp(
          starlit ? STARLIT.deepWater : STORM_DEEP_WATER,
          Math.min(1, k * 1.4)
        );
      // The water-light button: toward her shallow water, made lighter.
      const L = underLightOf(runtime.underLight);
      if (L.lift > 0)
        water.lerp(
          lightWater.copy(shallow).multiplyScalar(UNDER_LIGHT_DAY_GAIN),
          L.lift
        );
      fog.color.copy(water);
      fog.density = (0.0075 - 0.0025 * k) * L.fog;
      (scene.background as Color).copy(water);
      lights.sky.color.copy(lights.waterSky);
      lights.sky.groundColor.copy(lights.waterGround);
      // About twice the 1.0 night's light under water: Lake Superior is
      // clear below the storm's murk, and a child must follow the wreck.
      lights.sky.intensity =
        (1.1 * (1 - 0.3 * k) + 0.5 * d * (1 - k)) * L.ambient;
    } else {
      fog.color.copy(haze).multiplyScalar(0.012 + 0.988 * d);
      const snow = snowAt(t);
      fog.density =
        STORM_FOG_CLEAR + (STORM_FOG_SQUALL - STORM_FOG_CLEAR) * snow;
      (scene.background as Color).copy(fog.color);
      lights.sky.intensity = 0.45 + 1.15 * d;
    }
    floor.m.visible = under && y < -SEA_DEPTH + 2500;
    // She ends 76 km from the origin: the floor follows the camera, moved
    // in whole texture tiles so the clay's pattern stays put.
    floor.m.position.x =
      Math.round(camera.position.x / CLAY_TILE_M) * CLAY_TILE_M;
    floor.m.position.z =
      Math.round(camera.position.z / CLAY_TILE_M) * CLAY_TILE_M;
    const lamp = lights.lamp;
    lamp.intensity = under
      ? Math.min(1, -y / 40) * 760 * underLightOf(runtime.underLight).lamp
      : 0;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
  }, -0.8);

  return (
    <>
      <primitive object={lights.sky} />
      <primitive object={floor.m} />
      <primitive object={lights.lamp} />
      <primitive object={lights.lamp.target} />
    </>
  );
}
