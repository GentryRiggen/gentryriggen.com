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
function hullMaterial(
  tex: ShipTextures,
  rivets: boolean
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.05,
    side: DoubleSide,
    map: tex.weathering,
    normalMap: rivets ? tex.plateNormal : null,
    normalScale: new Vector2(0.55, 0.55),
  });
  // The weathering spans the whole hull (uv1); the plates tile (uv).
  tex.weathering.channel = 1;
  tex.plateNormal.channel = 0;
  const uniforms = {
    uLoadWL: { value: 10.54 },
    uBootTop: { value: 0.2 },
    uRed: { value: linear(0x6a2419) },
    uBoot: { value: linear(0xd8d4c8) },
    uBlack: { value: linear(0x121315) },
    uGold: { value: linear(0xc9a03a) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
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
uniform vec3 uGold;
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
  paint = mix(paint, uGold, gold);
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
  m.customProgramCacheKey = () => `shipwreck-hull-${rivets ? 1 : 0}`;
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
  options: { rivets: boolean }
): ShipMaterials {
  const light = createLightUniforms();
  const hull = hullMaterial(tex, options.rivets);
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
    roughness: 0.4,
    metalness: 0.6,
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
