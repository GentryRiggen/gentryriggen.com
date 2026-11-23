import {
  Color,
  DoubleSide,
  Vector3,
  LineBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  type Material,
  type Texture,
} from "three";
import { COLORS } from "./buildShip";
import type { DazzleFrame, ShipTextures } from "./textures";
import type { HullBand } from "./titanicRecipe";

/**
 * The model's materials. Few on purpose (every one is at least a draw
 * call): the hull (paint zones drawn in the shader), the painted steel and
 * wood (vertex colours), the planked decks, bronze, the name boards, the
 * lit panes and the lines.
 */

/** Uniforms shared by every lit pane, so the scene drives them all at once. */
export interface LightUniforms {
  /** 0..1, the ship's electric power (the sim's `power`). */
  uPower: { value: number };
  /** 0..1 per deck (spec.decks order: Boat, A, B, C, D, E, F, G, …). */
  uDeckPower: { value: number[] };
  /** Seconds, for flicker. */
  uTime: { value: number };
  /** 0..1: how hard the lights flicker. */
  uFlicker: { value: number };
  /** Brightness of a lit pane (HDR, so it blooms). */
  uIntensity: { value: number };
}

export const DECK_SLOTS = 10;

export function createLightUniforms(): LightUniforms {
  return {
    uPower: { value: 1 },
    uDeckPower: { value: new Array(DECK_SLOTS).fill(1) },
    uTime: { value: 0 },
    uFlicker: { value: 0 },
    uIntensity: { value: 5 },
  };
}

export interface ShipMaterials {
  hull: MeshStandardMaterial;
  paint: MeshStandardMaterial;
  deck: MeshStandardMaterial;
  bronze: MeshStandardMaterial;
  decal: MeshStandardMaterial;
  pane: MeshStandardMaterial;
  lines: LineBasicMaterial;
  /** Dazzle-painted walls, when the hull paint has dazzle. */
  dazzle?: MeshStandardMaterial;
  light: LightUniforms;
  /**
   * Repaints the hull (a livery: its colours, lines and relief, and the
   * dazzle on or off when the materials were made with one). Uniforms
   * only: no shader is recompiled.
   */
  setHullPaint(paint: HullPaint): void;
  dispose(): void;
}

function linear(hex: number): Color {
  return new Color().setHex(hex);
}

/**
 * Hull paint by height, so the lines are crisp at any mesh density: red
 * antifouling below the load waterline, a white boot-top, black topsides,
 * the gilt line under the sheer. Inside faces (seen through the break) are
 * dark rust. With `dazzle`, the topsides are the dazzle texture instead.
 */
export interface HullPaint {
  /** The paint line (top of the red antifouling) above the keel, m. */
  loadWaterline: number;
  /** Height of the white boot-top above it, m. */
  bootTop: number;
  /** The line just under the sheer, or null (sRGB hex). */
  sheerLine: number | null;
  /**
   * Topsides and bottom colours (default the liners' black over red
   * antifouling) and the plating's relief (default 1).
   */
  topsides?: number;
  bottom?: number;
  relief?: number;
  /** The boot-top's colour (default white). */
  boot?: number;
  /**
   * Dazzle over the topsides (the Carpathia's): `texture` from
   * `acquireDazzleTexture`, mapped by `frame` (port half over starboard).
   */
  dazzle?: { texture: Texture; frame: DazzleFrame };
  /**
   * With `dazzle`: whether it shows (default true). A ship with a dazzle
   * livery and a plain one is built with the dazzle and switches it.
   */
  dazzleOn?: boolean;
  /**
   * A hospital ship's band and crosses (`HullBand`), with the sheer's
   * height amidships (the band follows the sheer from there).
   */
  band?: HullBand & { sheer0: number };
}

/**
 * The GLSL that reads the dazzle at a point in the ship (three.js axes:
 * x forward, y up, z to starboard): the port half of the texture for the
 * port side, the starboard half for the other.
 */
const DAZZLE_GLSL = `
uniform sampler2D uDazzle;
uniform vec3 uDazzleFrame;
uniform float uDazzleOn;
vec3 dazzleAt(vec3 p) {
  float u = (p.x - uDazzleFrame.x) / uDazzleFrame.y;
  float v = clamp(p.y / uDazzleFrame.z, 0.01, 0.99) * 0.5;
  // Port (ship y > 0) is three.js z < 0: the texture's upper half.
  v += p.z < 0.0 ? 0.5 : 0.0;
  // The texture holds sRGB bytes (raw): decode them to linear here.
  vec3 c = texture2D(uDazzle, vec2(u, v)).rgb;
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}`;

function dazzleUniforms(
  d: NonNullable<HullPaint["dazzle"]>,
  on: { value: number }
) {
  return {
    uDazzle: { value: d.texture },
    uDazzleFrame: {
      value: new Vector3(d.frame.x0, d.frame.length, d.frame.height),
    },
    uDazzleOn: on,
  };
}

/** Room for the band's crosses in the shader. */
const MAX_CROSSES = 4;

/** The Titanic's. */
export const TITANIC_HULL_PAINT: HullPaint = {
  loadWaterline: 10.54,
  bootTop: 0.2,
  sheerLine: 0xc9a03a,
};

/** The hull shader's paint uniforms' values for `paint`. */
function hullValues(paint: HullPaint) {
  const topsides = paint.topsides ?? 0x121315;
  return {
    uLoadWL: paint.loadWaterline,
    uBootTop: paint.bootTop,
    uRed: linear(paint.bottom ?? 0x6a2419),
    // No boot-top: its line is the topsides' colour, not a white hairline.
    uBoot: linear(paint.bootTop > 0 ? (paint.boot ?? 0xd8d4c8) : topsides),
    uBlack: linear(topsides),
    // No sheer line: paint it the topsides' colour.
    uGold: linear(paint.sheerLine ?? topsides),
  };
}

function hullMaterial(
  tex: ShipTextures,
  rivets: boolean,
  paint: HullPaint,
  dazzleOn: { value: number }
): { m: MeshStandardMaterial; set(paint: HullPaint): void } {
  const m = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.05,
    side: DoubleSide,
    map: tex.weathering,
    normalMap: rivets ? tex.plateNormal : null,
    normalScale: new Vector2(
      0.55 * (paint.relief ?? 1),
      0.55 * (paint.relief ?? 1)
    ),
  });
  // The weathering spans the whole hull (uv1); the plates tile (uv).
  tex.weathering.channel = 1;
  tex.plateNormal.channel = 0;
  const v = hullValues(paint);
  const uniforms = {
    uLoadWL: { value: v.uLoadWL },
    uBootTop: { value: v.uBootTop },
    uRed: { value: v.uRed },
    uBoot: { value: v.uBoot },
    uBlack: { value: v.uBlack },
    uGold: { value: v.uGold },
    ...(paint.dazzle ? dazzleUniforms(paint.dazzle, dazzleOn) : {}),
  };
  const dazzled = paint.dazzle !== undefined;
  const band = paint.band;
  const bandUniforms = band && {
    uGreen: { value: linear(band.color) },
    uCrossRed: { value: linear(band.crossColor) },
    // Middle amidships, sheer amidships, how much of it, half height.
    uBand: {
      value: [band.z, band.sheer0, band.follow, band.height / 2],
    },
    // Half size, half arm, half gap, count.
    uCross: {
      value: [
        band.crossSize / 2,
        band.crossArm / 2,
        band.gap / 2,
        Math.min(MAX_CROSSES, band.crosses.length),
      ],
    },
    uCrossX: {
      value: Array.from(
        { length: MAX_CROSSES },
        (_, i) => band.crosses[i] ?? 1e6
      ),
    },
  };
  // The same rule as `bandPaintAt` (britannicRecipe.ts), antialiased.
  const bandGlsl = band
    ? `
  {
    float zc = uBand.x + uBand.z * (vSheer - uBand.y);
    float dz = abs(z - zc);
    float ax = fwidth(vShip.x) * 0.75 + 1e-4;
    float onCross = 0.0;
    float inGap = 0.0;
    for (int i = 0; i < ${MAX_CROSSES}; i++) {
      if (float(i) >= uCross.w) break;
      float dx = abs(vShip.x - uCrossX[i]);
      float upright = (1.0 - smoothstep(uCross.y - ax, uCross.y + ax, dx)) *
        (1.0 - smoothstep(uCross.x - aa, uCross.x + aa, dz));
      float bar = (1.0 - smoothstep(uCross.y - aa, uCross.y + aa, dz)) *
        (1.0 - smoothstep(uCross.x - ax, uCross.x + ax, dx));
      onCross = max(onCross, max(upright, bar));
      inGap = max(inGap, 1.0 - smoothstep(uCross.z - ax, uCross.z + ax, dx));
    }
    float green = (1.0 - smoothstep(uBand.w - aa, uBand.w + aa, dz)) *
      (1.0 - inGap);
    paint = mix(paint, uGreen, green);
    paint = mix(paint, uCrossRed, onCross);
  }`
    : "";
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, bandUniforms ?? {});
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aSheer;\nvarying vec3 vShip;\nvarying float vSheer;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvShip = position;\nvSheer = aSheer;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uLoadWL;
uniform float uBootTop;
uniform vec3 uRed;
uniform vec3 uBoot;
uniform vec3 uBlack;
uniform vec3 uGold;${
          band
            ? `
uniform vec3 uGreen;
uniform vec3 uCrossRed;
uniform vec4 uBand;
uniform vec4 uCross;
uniform float uCrossX[${MAX_CROSSES}];`
            : ""
        }
varying vec3 vShip;
varying float vSheer;
float hullGlossy = 0.0;${dazzled ? DAZZLE_GLSL : ""}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float z = vShip.y;
  float aa = fwidth(z) * 0.75 + 1e-4;
  vec3 paint = ${dazzled ? "mix(uBlack, dazzleAt(vShip), uDazzleOn)" : "uBlack"};
  hullGlossy = 1.0;
  float red = 1.0 - smoothstep(uLoadWL - aa, uLoadWL + aa, z);
  float boot = smoothstep(uLoadWL - aa, uLoadWL + aa, z) *
    (1.0 - smoothstep(uLoadWL + uBootTop - aa, uLoadWL + uBootTop + aa, z));
  float gold = smoothstep(vSheer - 0.25 - aa, vSheer - 0.25 + aa, z) *
    (1.0 - smoothstep(vSheer - 0.1 - aa, vSheer - 0.1 + aa, z));
  paint = mix(paint, uRed, red);
  paint = mix(paint, uBoot, boot);
  paint = mix(paint, uGold, gold);${bandGlsl}
  hullGlossy = 1.0 - red;
  if (!gl_FrontFacing) { paint = vec3(0.012, 0.009, 0.007); hullGlossy = 0.0; }
  diffuseColor.rgb *= paint;
}`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.85, 0.48, hullGlossy);`
      );
  };
  m.customProgramCacheKey = () =>
    `shipwreck-hull-${rivets ? 1 : 0}${dazzled ? "-dazzle" : ""}${band ? "-band" : ""}`;
  // The shader reads these objects every frame (tests read them too).
  m.userData.hullUniforms = { ...uniforms, ...bandUniforms };
  return {
    m,
    set(next) {
      const n = hullValues(next);
      uniforms.uLoadWL.value = n.uLoadWL;
      uniforms.uBootTop.value = n.uBootTop;
      uniforms.uRed.value.copy(n.uRed);
      uniforms.uBoot.value.copy(n.uBoot);
      uniforms.uBlack.value.copy(n.uBlack);
      uniforms.uGold.value.copy(n.uGold);
      const r = 0.55 * (next.relief ?? 1);
      m.normalScale.set(r, r);
      dazzleOn.value = next.dazzle && next.dazzleOn !== false ? 1 : 0;
      if (bandUniforms) setBand(bandUniforms, next.band);
    },
  };
}

/**
 * Painted steel in dazzle (the houses' walls): the vertex colour (white,
 * or a shade inside a promenade) times the dazzle at the point, so the
 * shapes run on from the hull across the houses unbroken.
 */
function dazzleMaterial(
  d: NonNullable<HullPaint["dazzle"]>,
  on: { value: number }
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.0,
  });
  const uniforms = dazzleUniforms(d, on);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vShip;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvShip = position;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vShip;${DAZZLE_GLSL}`
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), dazzleAt(vShip), uDazzleOn);"
      );
  };
  m.customProgramCacheKey = () => "shipwreck-dazzle";
  return m;
}

/**
 * Glass panes lit from inside: dark glass by day; at night each pane glows
 * a warm 2,500–3,000 K, a little different pane to pane, some left dark,
 * dimming with `uPower` and each deck's `uDeckPower`, flickering together
 * by circuit when `uFlicker` rises.
 */
function paneMaterial(light: LightUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.18,
    metalness: 0.45,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, light);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aDeck;
attribute float aSeed;
attribute float aGlass;
uniform float uPower;
uniform float uDeckPower[${DECK_SLOTS}];
uniform float uTime;
uniform float uFlicker;
varying float vLight;
varying vec3 vWarm;
float paneHash(float n) { return fract(sin(n) * 43758.5453123); }`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
{
  int d = int(aDeck + 0.5);
  float deckPower = uDeckPower[d];
  float on = step(0.12, fract(aSeed * 7.13 + 0.11));
  // Circuits (a deck's run of cabins) flicker together.
  float circuit = aDeck * 17.0 + floor(aSeed * 4.0);
  float tick = floor(uTime * 11.0);
  float dip = step(0.55, paneHash(circuit * 3.1 + tick * 0.73));
  float flick = 1.0 - uFlicker * dip * (0.6 + 0.4 * paneHash(tick + circuit));
  vLight = aGlass * uPower * deckPower * on * flick * (0.7 + 0.6 * fract(aSeed * 13.7));
  vWarm = mix(vec3(1.0, 0.36, 0.09), vec3(1.0, 0.52, 0.2), fract(aSeed * 3.71));
}`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uIntensity;\nvarying float vLight;\nvarying vec3 vWarm;"
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vWarm * vLight * uIntensity;
diffuseColor.rgb = mix(diffuseColor.rgb, vWarm * 0.4, clamp(vLight, 0.0, 1.0));`
      );
  };
  m.customProgramCacheKey = () => "shipwreck-pane";
  return m;
}

export function createShipMaterials(
  tex: ShipTextures,
  options: {
    rivets: boolean;
    hull?: HullPaint;
    /** Painted letters (not gilt): the name boards are not metallic. */
    paintedNames?: boolean;
  }
): ShipMaterials {
  const light = createLightUniforms();
  // The dazzle's switch, shared by the hull and the dazzle walls.
  const dazzleOn = {
    value: options.hull?.dazzle && options.hull.dazzleOn !== false ? 1 : 0,
  };
  const hullPaint = hullMaterial(
    tex,
    options.rivets,
    options.hull ?? TITANIC_HULL_PAINT,
    dazzleOn
  );
  const hull = hullPaint.m;
  const paint = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.0,
  });
  const deck = new MeshStandardMaterial({
    vertexColors: true,
    map: tex.planks,
    roughness: 0.88,
    metalness: 0,
  });
  const bronze = new MeshStandardMaterial({
    color: COLORS.brass,
    metalness: 0.9,
    roughness: 0.32,
    side: DoubleSide,
  });
  const decal = new MeshStandardMaterial({
    map: tex.names,
    transparent: true,
    alphaTest: 0.35,
    roughness: options.paintedNames ? 0.7 : 0.4,
    metalness: options.paintedNames ? 0.05 : 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    depthWrite: false,
  });
  const pane = paneMaterial(light);
  const lines = new LineBasicMaterial({ vertexColors: true });
  const all: Material[] = [hull, paint, deck, bronze, decal, pane, lines];
  const dazzle = options.hull?.dazzle
    ? dazzleMaterial(options.hull.dazzle, dazzleOn)
    : undefined;
  if (dazzle) all.push(dazzle);
  return {
    hull,
    paint,
    deck,
    bronze,
    decal,
    pane,
    lines,
    ...(dazzle ? { dazzle } : {}),
    light,
    setHullPaint: hullPaint.set,
    dispose() {
      for (const m of all) m.dispose();
    },
  };
}

/**
 * A hospital ship's band and crosses onto a hull built with one (`band`
 * missing: taken off, as a liner). The same rules as `hullMaterial`.
 */
function setBand(
  u: {
    uGreen: { value: Color };
    uCrossRed: { value: Color };
    uBand: { value: number[] };
    uCross: { value: number[] };
    uCrossX: { value: number[] };
  },
  band: HullPaint["band"]
): void {
  if (!band) {
    // No band: none of it is ever nearer than a negative half height, and
    // no crosses.
    u.uBand.value = [0, 0, 0, -1];
    u.uCross.value = [0, 0, 0, 0];
    return;
  }
  u.uGreen.value.copy(linear(band.color));
  u.uCrossRed.value.copy(linear(band.crossColor));
  u.uBand.value = [band.z, band.sheer0, band.follow, band.height / 2];
  u.uCross.value = [
    band.crossSize / 2,
    band.crossArm / 2,
    band.gap / 2,
    Math.min(MAX_CROSSES, band.crosses.length),
  ];
  u.uCrossX.value = Array.from(
    { length: MAX_CROSSES },
    (_, i) => band.crosses[i] ?? 1e6
  );
}
