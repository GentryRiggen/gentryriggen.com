import {
  Color,
  DoubleSide,
  LineBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  type Material,
} from "three";
import { COLORS } from "./buildShip";
import type { ShipTextures } from "./textures";
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
  light: LightUniforms;
  dispose(): void;
}

function linear(hex: number): Color {
  return new Color().setHex(hex);
}

/**
 * Hull paint by height, so the lines are crisp at any mesh density: red
 * antifouling below the load waterline, a white boot-top, black topsides,
 * the gilt line under the sheer. Inside faces (seen through the break) are
 * dark rust.
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
  /**
   * A hospital ship's band and crosses (`HullBand`), with the sheer's
   * height amidships (the band follows the sheer from there).
   */
  band?: HullBand & { sheer0: number };
}

/** Room for the band's crosses in the shader. */
const MAX_CROSSES = 4;

/** The Titanic's. */
export const TITANIC_HULL_PAINT: HullPaint = {
  loadWaterline: 10.54,
  bootTop: 0.2,
  sheerLine: 0xc9a03a,
};

function hullMaterial(
  tex: ShipTextures,
  rivets: boolean,
  paint: HullPaint
): MeshStandardMaterial {
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
  // No sheer line: paint it the topsides' colour.
  const topsides = paint.topsides ?? 0x121315;
  const uniforms = {
    uLoadWL: { value: paint.loadWaterline },
    uBootTop: { value: paint.bootTop },
    uRed: { value: linear(paint.bottom ?? 0x6a2419) },
    // No boot-top: its line is the topsides' colour, not a white hairline.
    uBoot: { value: linear(paint.bootTop > 0 ? 0xd8d4c8 : topsides) },
    uBlack: { value: linear(topsides) },
    uGold: { value: linear(paint.sheerLine ?? topsides) },
  };
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
float hullGlossy = 0.0;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float z = vShip.y;
  float aa = fwidth(z) * 0.75 + 1e-4;
  vec3 paint = uBlack;
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
    `shipwreck-hull-${rivets ? 1 : 0}${band ? "-band" : ""}`;
  // For `setHullPaint`: the shader reads these objects every frame.
  m.userData.hullUniforms = { ...uniforms, ...bandUniforms };
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
  const hull = hullMaterial(
    tex,
    options.rivets,
    options.hull ?? TITANIC_HULL_PAINT
  );
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
  return {
    hull,
    paint,
    deck,
    bronze,
    decal,
    pane,
    lines,
    light,
    dispose() {
      for (const m of all) m.dispose();
    },
  };
}

/**
 * Repaints a hull material made here, in place: its colours, paint line
 * and band change with no new shader (the same rules as `hullMaterial`).
 * A band can be taken off any hull but put on only one built with a band
 * (a ship with a hospital livery builds with it: `britannicLivery.ts`).
 */
export function setHullPaint(m: MeshStandardMaterial, paint: HullPaint): void {
  type Uniform<T> = { value: T };
  const u = m.userData.hullUniforms as
    | (Record<
        "uRed" | "uBoot" | "uBlack" | "uGold" | "uGreen" | "uCrossRed",
        Uniform<Color>
      > &
        Record<"uLoadWL" | "uBootTop", Uniform<number>> &
        Record<"uBand" | "uCross" | "uCrossX", Uniform<number[]>>)
    | undefined;
  if (!u) return;
  const topsides = paint.topsides ?? 0x121315;
  u.uLoadWL.value = paint.loadWaterline;
  u.uBootTop.value = paint.bootTop;
  u.uRed.value.setHex(paint.bottom ?? 0x6a2419);
  u.uBoot.value.setHex(paint.bootTop > 0 ? 0xd8d4c8 : topsides);
  u.uBlack.value.setHex(topsides);
  u.uGold.value.setHex(paint.sheerLine ?? topsides);
  if (!u.uBand) return;
  const band = paint.band;
  if (!band) {
    // No band: none of it is ever nearer than a negative half height, and
    // no crosses.
    u.uBand.value = [0, 0, 0, -1];
    u.uCross.value = [0, 0, 0, 0];
    return;
  }
  u.uGreen.value.setHex(band.color);
  u.uCrossRed.value.setHex(band.crossColor);
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
