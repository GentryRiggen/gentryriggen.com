"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Vector3,
  Vector4,
  type Material,
  type Object3D,
} from "three";
import { useStore } from "zustand";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import {
  PLACES_BY_SHIP,
  waterHereText,
  type PlaceId,
} from "@/lib/shipwreck/places";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { buildHull, hullHalfBreadth } from "@/lib/shipwreck/sim/geometry";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import {
  boxDepthAt,
  boxSamples,
  compartmentSamples,
  depthOver,
  earthZ,
  partAt,
  partCompartments,
  spanRange,
  waterLevel,
  type VolumeSamples,
} from "@/lib/shipwreck/xray";
import type { SceneRuntime } from "./runtime";
import {
  boxWaterGeometry,
  bulkheadLines,
  cargoGeometry,
  doubleBottomLines,
  openingGeometry,
  placeGeometry,
  waterGeometry,
  XRAY_SLOTS,
} from "./xrayGeometry";

/**
 * The X-ray cutaway: the hull and superstructure turn to a Fresnel ghost,
 * the bulkheads show as faint outlines, each compartment's water is a blue
 * volume cut at the level the sim gives it (level with the sea, not the
 * ship; a side bunker only its wing), the openings glow red, and the
 * ship's places show their blockouts. A laker's holds show her cargo as a
 * dense layer over her double bottom (the tank top's outline), her side
 * tanks by their walls.
 * The place pins (shown in X-ray or at a place) fly the camera there. Everything rides with
 * the part it is in (the halves after the break).
 */

type PartName = "whole" | "bow" | "stern";
const PARTS: PartName[] = ["whole", "bow", "stern"];
/** Room for every cell of a part (`XRAY_SLOTS`: the Britannic has 32). */
const SLOTS = XRAY_SLOTS;

const ghostVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const ghostFragment = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  uniform vec3 uColor;
  void main() {
    vec3 toEye = cameraPosition - vW;
    vec3 v = normalize(toEye);
    float f = pow(1.0 - abs(dot(normalize(vN), v)), 2.2);
    // Fainter close up, where many layers stack in front of the interiors.
    float a = (0.010 + 0.22 * f) * clamp(length(toEye) / 140.0, 0.3, 1.0);
    // Under the sea the ghost tints a little blue-green.
    vec3 c = vW.y < 0.0 ? uColor * vec3(0.7, 1.0, 1.0) : uColor;
    gl_FragColor = vec4(c * a, 1.0);
  }
`;

const waterVertex = /* glsl */ `
  attribute float aComp;
  uniform float uLevel[${SLOTS}];
  varying float vY;
  varying float vLevel;
  varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vY = w.y;
    vLevel = uLevel[int(aComp + 0.5)];
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const waterFragment = /* glsl */ `
  varying float vY;
  varying float vLevel;
  varying vec3 vN;
  uniform float uTime;
  uniform float uFade;
  void main() {
    if (vY > vLevel) discard;
    if (gl_FrontFacing) {
      // The water's body: deeper blue further down.
      float depth = clamp((vLevel - vY) / 12.0, 0.0, 1.0);
      vec3 c = mix(vec3(0.10, 0.55, 1.20), vec3(0.03, 0.22, 0.65), depth);
      gl_FragColor = vec4(c, 0.62 * uFade);
    } else {
      gl_FragColor = vec4(vec3(0.05, 0.30, 0.80) * (0.9 + 0.1 * sin(uTime)), 0.45 * uFade);
    }
  }
`;

// The free surface: one level quad per compartment at the sim's level, cut
// to the compartment (tested in the ship frame), so things standing in the
// water (the boilers, the engines) are wet to the right height.
const surfaceVertex = /* glsl */ `
  attribute float aComp;
  attribute vec2 aCorner;
  uniform float uLevel[${SLOTS}];
  uniform vec3 uCentre[${SLOTS}];
  uniform float uReach[${SLOTS}];
  uniform mat4 uPart;
  varying vec3 vWorld;
  varying float vComp;
  void main() {
    int k = int(aComp + 0.5);
    float level = uLevel[k];
    vec4 c = uPart * vec4(uCentre[k], 1.0);
    vec3 w = vec3(c.x + aCorner.x * uReach[k], level, c.z + aCorner.y * uReach[k]);
    if (abs(level) > 1e5) w = vec3(0.0, -1e7, 0.0);
    vWorld = w;
    vComp = aComp;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const surfaceFragment = /* glsl */ `
  uniform mat4 uPartInv;
  uniform vec4 uBox[${SLOTS}];
  uniform float uTop[${SLOTS}];
  uniform float uTime;
  uniform float uFade;
  varying vec3 vWorld;
  varying float vComp;
  void main() {
    int k = int(vComp + 0.5);
    vec4 bx = uBox[k];
    vec3 l = (uPartInv * vec4(vWorld, 1.0)).xyz; // three axes, ship frame
    // x along, y up, z athwart (from bx.z to bx.w): inside the cell's box?
    if (l.x < bx.x || l.x > bx.y || l.z < bx.z || l.z > bx.w || l.y < 0.0 || l.y > uTop[k])
      discard;
    float r = 0.85 + 0.15 * sin(vWorld.x * 0.7 + uTime * 1.7) * sin(vWorld.z * 0.9 - uTime * 1.3);
    gl_FragColor = vec4(vec3(0.30, 0.80, 1.55) * r * mix(0.35, 1.0, uFade), 0.7 * uFade);
  }
`;

const gashFragment = /* glsl */ `
  varying vec2 vUv;
  varying float vOpenT;
  uniform float uTime;
  uniform float uT;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  void main() {
    // Not open yet (a later torpedo's hole): nothing.
    if (uT < vOpenT) discard;
    // A jagged slit along the plate seam.
    float centre = 0.5 + (noise(vUv.x * 9.0) - 0.5) * 0.55;
    float w = 0.10 + 0.08 * noise(vUv.x * 23.0 + 4.0);
    float d = abs(vUv.y - centre);
    if (d > w) discard;
    float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
    gl_FragColor = vec4(vec3(5.0, 0.35, 0.2) * pulse * (1.0 - d / w * 0.5), 1.0);
  }
`;
const gashVertex = /* glsl */ `
  attribute float aOpenT;
  varying vec2 vUv;
  varying float vOpenT;
  void main() {
    vUv = uv;
    vOpenT = aOpenT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** How much of the water's opacity is kept while a place is selected. */
const PLACE_WATER_FADE = 0.3;

interface PartSet {
  group: Group;
  surface: Mesh<BufferGeometry, ShaderMaterial>;
  water: Mesh<ReturnType<typeof waterGeometry>, ShaderMaterial>;
  pieces: { index: number; fromX: number; toX: number }[];
  samples: VolumeSamples[];
  levels: Float32Array;
  /**
   * Her named superstructure boxes' water (the Poseidon's tiers and
   * ballroom, `SimFrame.boxWater`): the boxes this part holds (by their
   * middle), their mesh, samples and levels. Empty for other ships.
   */
  boxes: number[];
  boxWater: Mesh<BufferGeometry, ShaderMaterial> | null;
  boxSamples: VolumeSamples[];
  boxLevels: Float32Array;
}

interface XRayProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /** The ship on the stage. */
  spec: ShipSpec;
}

export default function XRay({ store, runtime, spec }: XRayProps) {
  const breakX = useStore(store, (s) => s.track?.breakX ?? null);
  const openings = useStore(store, (s) => s.openings);
  const hull = useMemo(() => buildHull(spec), [spec]);
  const placeList = PLACES_BY_SHIP[spec.id];

  const mats = useMemo(() => {
    const ghost = new ShaderMaterial({
      vertexShader: ghostVertex,
      fragmentShader: ghostFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: [0.55, 0.85, 1.25] } },
    });
    const water = new ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uLevel: { value: new Float32Array(SLOTS) },
        uTime: { value: 0 },
        uFade: { value: 1 },
      },
    });
    water.forceSinglePass = true;
    const lines = new LineBasicMaterial({
      color: 0x7fd4ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const gash = new ShaderMaterial({
      vertexShader: gashVertex,
      fragmentShader: gashFragment,
      side: DoubleSide,
      uniforms: { uTime: { value: 0 }, uT: { value: 0 } },
    });
    const solid = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x111111,
    });
    const glow = new MeshBasicMaterial({ vertexColors: true });
    glow.color.setScalar(3);
    // Taconite: dull, rusty grey-brown pellets, packed solid.
    const cargo = new MeshStandardMaterial({
      color: 0x5a3a2c,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x1a0e08,
    });
    return { ghost, water, lines, gash, solid, glow, cargo };
  }, []);
  useEffect(
    () => () => Object.values(mats).forEach((m: Material) => m.dispose()),
    [mats]
  );

  const root = useMemo(() => new Group(), []);

  // Per part: water lofts, bulkhead lines and openings, in a group that
  // copies the part's pose each frame.
  const sets = useMemo(() => {
    const out = new Map<PartName, PartSet>();
    const names: PartName[] = breakX === null ? ["whole"] : PARTS;
    for (const name of names) {
      const pieces = partCompartments(spec, name, breakX);
      const group = new Group();
      group.name = `xray-${name}`;
      group.visible = false;
      const water = new Mesh(
        waterGeometry(hull, spec, pieces),
        mats.water.clone()
      );
      water.material.uniforms.uLevel = { value: new Float32Array(SLOTS) };
      water.renderOrder = 10;
      water.frustumCulled = false;
      const from = name === "bow" && breakX !== null ? breakX : -200;
      const to = name === "stern" && breakX !== null ? breakX : 200;
      const lines = new LineSegments(
        bulkheadLines(hull, spec, from, to),
        mats.lines
      );
      lines.renderOrder = 15;
      const holes = openings.filter((o) => o.x >= from && o.x <= to);
      const gash = new Mesh(openingGeometry(hull, holes), mats.gash);
      gash.renderOrder = 12;
      group.add(water, lines, gash);
      const cargo = cargoGeometry(hull, spec, pieces);
      if (cargo) {
        const m = new Mesh(cargo, mats.cargo);
        m.name = `xray-cargo-${name}`;
        group.add(m);
      }
      const bottom = doubleBottomLines(hull, spec, from, to);
      if (bottom) {
        const l = new LineSegments(bottom, mats.lines);
        l.renderOrder = 15;
        group.add(l);
      }
      const surface = surfaceMesh(hull, spec, pieces, levelsOf(water));
      root.add(surface);
      // Her named boxes' water, each box with the part holding its middle.
      const boxes: number[] = [];
      spec.superstructure.forEach((b, i) => {
        const mid = (b.fromX + b.toX) / 2;
        if (b.id && mid >= from && mid < to && boxes.length < SLOTS)
          boxes.push(i);
      });
      const boxGeo = boxWaterGeometry(spec, boxes);
      let boxWater: Mesh<BufferGeometry, ShaderMaterial> | null = null;
      if (boxGeo) {
        boxWater = new Mesh(boxGeo, mats.water.clone());
        boxWater.material.uniforms.uLevel = {
          value: new Float32Array(SLOTS),
        };
        boxWater.renderOrder = 10;
        boxWater.frustumCulled = false;
        boxWater.name = `xray-box-water-${name}`;
        group.add(boxWater);
      }
      out.set(name, {
        group,
        surface,
        water,
        pieces,
        samples: pieces.map((p) =>
          compartmentSamples(hull, spec.compartments[p.index], p.fromX, p.toX)
        ),
        levels: levelsOf(water),
        boxes,
        boxWater,
        boxSamples: boxes.map((i) => boxSamples(spec, spec.superstructure[i])),
        boxLevels: boxWater ? levelsOf(boxWater) : new Float32Array(SLOTS),
      });
    }
    return out;
  }, [breakX, hull, mats, openings, root, spec]);
  useEffect(
    () => () => {
      for (const s of sets.values()) {
        s.group.traverse((o) => {
          const g = (o as Mesh).geometry;
          if (g) g.dispose();
        });
        s.water.material.dispose();
        s.boxWater?.material.dispose();
        s.surface.geometry.dispose();
        s.surface.material.dispose();
        root.remove(s.surface);
      }
    },
    [root, sets]
  );

  // The places' blockouts, parented to the part they are in.
  const places = useMemo(() => {
    const out = new Map<PlaceId, Group>();
    for (const { id } of PLACES_BY_SHIP[spec.id]) {
      const g = new Group();
      g.name = `place-${spec.id}-${id}`;
      const { solid, glow } = placeGeometry(spec.id, id);
      if (solid) g.add(new Mesh(solid, mats.solid));
      if (glow) g.add(new Mesh(glow, mats.glow));
      out.set(id, g);
    }
    return out;
  }, [mats, spec]);
  useEffect(
    () => () => {
      for (const g of places.values())
        g.traverse((o) => (o as Mesh).geometry?.dispose());
    },
    [places]
  );

  useEffect(() => {
    for (const s of sets.values()) root.add(s.group);
    return () => {
      for (const s of sets.values()) root.remove(s.group);
    };
  }, [root, sets]);

  const ghosted = useRef(new Set<Object3D>());
  const applied = useRef<{ on: boolean; models: (TitanicHandles | null)[] }>({
    on: false,
    models: [],
  });

  const pinPoint = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    const frame = runtime.frame;
    const s = store.getState();
    const on = s.xray;
    mats.gash.uniforms.uTime.value = state.clock.elapsedTime;
    // Holes show once open (the shown time; a pre-roll shows none).
    mats.gash.uniforms.uT.value = s.t;

    // Ghost or restore the ship's materials when X-ray or the models change.
    const models = [runtime.whole, runtime.split];
    const a = applied.current;
    if (a.on !== on || a.models[0] !== models[0] || a.models[1] !== models[1]) {
      for (const o of ghosted.current) restore(o);
      ghosted.current.clear();
      if (on)
        for (const mdl of models)
          if (mdl) ghost(mdl.root, mats.ghost, ghosted.current);
      a.on = on;
      a.models = models;
    }
    if (!frame) return;

    const posed = (name: PartName): BodyPose | null =>
      frame.bodies.find((b) => b.part === name) ?? null;

    for (const [name, set] of sets) {
      const part = runtime.part(name);
      const pose = posed(name);
      set.group.visible = on && part !== null && pose !== null;
      set.surface.visible = set.group.visible;
      if (!set.group.visible || !part || !pose) continue;
      part.updateMatrixWorld();
      const su = set.surface.material.uniforms;
      su.uPart.value.copy(part.matrixWorld);
      su.uPartInv.value.copy(part.matrixWorld).invert();
      su.uTime.value = state.clock.elapsedTime;
      // At a place the water fades so what stands in it (the boilers, the
      // engines) stays readable close up, not a flat blue wash.
      const fade = s.place !== null ? PLACE_WATER_FADE : 1;
      su.uFade.value = fade;
      set.water.material.uniforms.uFade.value = fade;
      if (set.boxWater) {
        const bu = set.boxWater.material.uniforms;
        bu.uFade.value = fade;
        bu.uTime.value = state.clock.elapsedTime;
        set.boxes.forEach((i, k) => {
          const lvl = waterLevel(
            set.boxSamples[k],
            pose,
            frame.boxWater?.[i] ?? 0
          );
          set.boxLevels[k] = Math.max(-1e6, Math.min(1e6, lvl));
        });
      }
      set.group.position.copy(part.position);
      set.group.quaternion.copy(part.quaternion);
      set.water.material.uniforms.uTime.value = state.clock.elapsedTime;
      set.pieces.forEach((p, k) => {
        const lvl = waterLevel(set.samples[k], pose, frame.water[p.index] ?? 0);
        set.levels[k] = Math.max(-1e6, Math.min(1e6, lvl));
      });
    }

    // Places ride with their part; blockouts only in X-ray.
    for (const [id, g] of places) {
      const x = placeList.find((p) => p.id === id)?.at[0] ?? 0;
      const name = partAt(breakX, runtime.broken, x);
      const part = runtime.part(name);
      g.visible = on && part !== null;
      if (part) {
        g.position.copy(part.position);
        g.quaternion.copy(part.quaternion);
      }
    }
    // Pins (DOM, see PlacePins) follow their place on screen, on the free
    // camera within about a kilometre (they would crowd the other shots),
    // in X-ray or while a place is selected.
    const { width, height } = state.size;
    for (const p of placeList) {
      const pin = runtime.pins.get(p.id);
      if (!pin) continue;
      const part = runtime.part(partAt(breakX, runtime.broken, p.at[0]));
      // Only in X-ray or at a place: over the plain ship four labels crowd
      // the view (the HUD's pin button lists the places too).
      let show =
        part !== null && s.camera === "orbit" && (s.xray || s.place !== null);
      if (part) {
        part.updateMatrixWorld();
        pinPoint.set(p.at[0], p.at[2] + 3, -p.at[1]);
        part.localToWorld(pinPoint);
        if (state.camera.position.distanceTo(pinPoint) > 1000) show = false;
        pinPoint.project(state.camera);
        if (
          pinPoint.z > 1 ||
          Math.abs(pinPoint.x) > 1.1 ||
          Math.abs(pinPoint.y) > 1.1
        )
          show = false;
        if (show) {
          const px = ((pinPoint.x + 1) / 2) * width;
          const py = ((1 - pinPoint.y) / 2) * height;
          pin.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
        }
      }
      if (pin.el.classList.contains("hidden") === show) {
        pin.el.classList.toggle("hidden", !show);
        pin.el.classList.toggle("flex", show);
      }
    }

    // The water at the selected place.
    const selectedPlace = s.place
      ? placeList.find((q) => q.id === s.place)
      : undefined;
    if (selectedPlace) {
      const p = selectedPlace;
      const name = partAt(breakX, runtime.broken, p.at[0]);
      const pose = posed(name);
      const boxIndex = p.boxId
        ? spec.superstructure.findIndex((b) => b.id === p.boxId)
        : -1;
      if (pose && boxIndex >= 0) {
        // In one of her named boxes: its own water (`boxWater`), from
        // her floor, or keel up her roof underneath (`boxDepthAt`).
        const set = sets.get(name);
        const k = set ? set.boxes.indexOf(boxIndex) : -1;
        const level =
          set && k >= 0
            ? waterLevel(
                set.boxSamples[k],
                pose,
                frame.boxWater?.[boxIndex] ?? 0
              )
            : -Infinity;
        const depth = Math.min(
          99,
          boxDepthAt(
            pose,
            [p.at[0], p.at[1]],
            p.floorZ,
            spec.superstructure[boxIndex].topZ,
            level
          )
        );
        s.setPlaceWater(depth);
        const label = runtime.pins.get(p.id)?.label;
        if (label) label.textContent = waterHereText(depth);
      } else if (pose) {
        let level = 0; // the sea, for open decks
        if (p.compartmentId) {
          const ci = spec.compartments.findIndex(
            (c) => c.id === p.compartmentId
          );
          const set = sets.get(name);
          const k = set ? set.pieces.findIndex((q) => q.index === ci) : -1;
          const inside = set && k >= 0 ? set.levels[k] : -1e6;
          // Once the deck edge above is under the sea, the sea is in.
          const deckUnder = earthZ(pose, p.at[0], 0, spec.sheerZ(p.at[0])) < 0;
          level = deckUnder ? Math.max(inside, 0) : inside;
        }
        const depth = Math.min(
          99,
          depthOver(
            pose,
            [p.at[0], p.at[1], p.floorZ],
            level >= 1e6 ? Infinity : level
          )
        );
        s.setPlaceWater(depth);
        const label = runtime.pins.get(p.id)?.label;
        if (label) label.textContent = waterHereText(depth);
      }
    }
  }, -0.9);

  return (
    <>
      <primitive object={root} />
      {[...places.values()].map((g) => (
        <primitive key={g.name} object={g} />
      ))}
    </>
  );
}

function levelsOf(m: Mesh<BufferGeometry, ShaderMaterial>): Float32Array {
  return m.material.uniforms.uLevel.value as Float32Array;
}

/** The free-surface quads for a part's compartment pieces (see shader). */
function surfaceMesh(
  hull: ReturnType<typeof buildHull>,
  spec: ShipSpec,
  pieces: { index: number; fromX: number; toX: number }[],
  levels: Float32Array
): Mesh<BufferGeometry, ShaderMaterial> {
  const comp: number[] = [];
  const corner: number[] = [];
  const pos: number[] = [];
  const centre: Vector3[] = [];
  const reach: number[] = [];
  const box: Vector4[] = [];
  const tops: number[] = [];
  pieces.forEach((p, k) => {
    const c = spec.compartments[p.index];
    const midX = (p.fromX + p.toX) / 2;
    const top = Math.min(c.aftBulkheadTopZ, c.fwdBulkheadTopZ);
    const hb = hullHalfBreadth(hull, midX, top * 0.6) * 0.96;
    // The cell's share of the breadth (ship y), as three.z = -y.
    const [lo, hi] = c.span
      ? spanRange(c, hb)
      : [-Math.max(0.5, hb), Math.max(0.5, hb)];
    centre.push(new Vector3(midX, top / 2, -(lo + hi) / 2));
    reach.push(Math.hypot(p.toX - p.fromX, top, hi - lo) / 2 + 1);
    box.push(new Vector4(p.fromX + 0.15, p.toX - 0.15, -hi, -lo));
    tops.push(top);
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      comp.push(k);
      corner.push(a, b);
      pos.push(0, 0, 0);
    }
  });
  while (centre.length < SLOTS) {
    centre.push(new Vector3());
    reach.push(0);
    box.push(new Vector4());
    tops.push(0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aComp", new BufferAttribute(new Float32Array(comp), 1));
  g.setAttribute("aCorner", new BufferAttribute(new Float32Array(corner), 2));
  const mat = new ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uLevel: { value: levels },
      uCentre: { value: centre },
      uReach: { value: reach },
      uBox: { value: box },
      uTop: { value: new Float32Array(tops) },
      uPart: { value: new Matrix4() },
      uPartInv: { value: new Matrix4() },
      uTime: { value: 0 },
      uFade: { value: 1 },
    },
  });
  const m = new Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 11;
  m.visible = false;
  m.name = "xray-water-surface";
  return m;
}

const BASE = "shipwreckBaseMaterial";

function ghost(root: Object3D, mat: Material, out: Set<Object3D>) {
  root.traverse((o) => {
    const mesh = o as Mesh & {
      isInstancedMesh?: boolean;
      isLineSegments?: boolean;
    };
    if ((o as LineSegments).isLineSegments) {
      if (o.visible) {
        o.visible = false;
        o.userData[BASE] = "hidden";
        out.add(o);
      }
      return;
    }
    if (!mesh.isMesh) return;
    if (mesh.isInstancedMesh) {
      // Lit windows stay; boats, vents and benches hide.
      if (/portholes|windows/.test(mesh.name)) return;
      mesh.visible = false;
      mesh.userData[BASE] = "hidden";
      out.add(mesh);
      return;
    }
    mesh.userData[BASE] = mesh.material;
    mesh.material = mat;
    mesh.renderOrder = 20;
    out.add(mesh);
  });
}

function restore(o: Object3D) {
  const base = o.userData[BASE];
  if (base === "hidden") o.visible = true;
  else if (base) {
    (o as Mesh).material = base as Material;
    o.renderOrder = 0;
  }
  delete o.userData[BASE];
}
