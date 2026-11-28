import { SEA_WAVES_GLSL } from "../seaWaves";
import { STORM_SEA_GLSL } from "../StormSea";
import { SEA_FRAGMENT } from "../Sea";
import { TORPEDO_FRAGMENT } from "../Torpedo";
import { waterShaders } from "../../interior/water";
import {
  carShaders,
  GLASS_SHADERS,
  roomShaders,
} from "../../interior/materials";
import { withModern } from "../../interior/modernTextures";
import { LAYERS } from "../../interior/pieces";

/**
 * NaN is a black screen on a real GPU and invisible in headless
 * SwiftShader (1.8.2's lesson): every pow(), sqrt(), log() argument in the
 * GLSL the Poseidon path adds or changes is clamped (it starts with
 * max( or clamp(, or is a positive literal), and every division is by a
 * literal or a max( / clamp( guard. The strings scanned: the storm sea's
 * wave function (her rogue wave's sharpening and lip) and the storm sea's
 * own shaders (her lip, rolled-over foam, under-glow and starlit sky).
 * 1.15: the water inside her rooms (`interior/water.ts`) and the rooms'
 * own shaders, every layer (`interior/materials.ts`). 1.17: her
 * see-through glass (`GLASS_SHADERS`).
 */

const SHADERS: Record<string, string> = {
  SEA_WAVES_GLSL,
  "StormSea vertex": STORM_SEA_GLSL.vertex,
  "StormSea fragment": STORM_SEA_GLSL.fragment,
  "interior water surface vertex": waterShaders(26).surfaceVertex,
  "interior water surface fragment": waterShaders(26).surfaceFragment,
  "interior water body vertex": waterShaders(26).bodyVertex,
  "interior water body fragment": waterShaders(26).bodyFragment,
  "interior glass vertex": GLASS_SHADERS.vertex,
  "interior glass fragment": GLASS_SHADERS.fragment,
  // 1.18: her glass cars' own light, on her modern metal.
  ...(() => {
    const metal = roomShaders("metal", 26);
    const car = carShaders(
      { vertex: metal.vertex, fragment: withModern(metal.fragment, "metal") },
      2.4
    );
    return {
      "interior lift car vertex": car.vertex,
      "interior lift car fragment": car.fragment,
    };
  })(),
  ...Object.fromEntries(
    LAYERS.flatMap((layer) => [
      [`interior ${layer} vertex`, roomShaders(layer, 26).vertex],
      [`interior ${layer} fragment`, roomShaders(layer, 26).fragment],
    ])
  ),
};

/** The source with its comments and preprocessor lines removed. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/^\s*#[^\n]*/gm, " ");
}

/** The text of the call's first argument (balanced parentheses). */
function firstArg(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i).trim();
    } else if (ch === "," && depth === 1) return src.slice(open + 1, i).trim();
  }
  return "";
}

const GUARDED = /^(max|clamp)\s*\(/;
const POSITIVE_LITERAL = /^\d+(\.\d*)?(e[+-]?\d+)?$/;

/** Every unguarded pow/sqrt/log argument and division in a shader. */
function unguarded(src: string): string[] {
  const s = code(src);
  const bad: string[] = [];
  const calls = /\b(pow|sqrt|log|log2|inversesqrt)\s*\(/g;
  for (let m = calls.exec(s); m; m = calls.exec(s)) {
    const arg = firstArg(s, m.index + m[0].length - 1);
    if (!GUARDED.test(arg) && !POSITIVE_LITERAL.test(arg))
      bad.push(`${m[1]}(${arg}`);
  }
  const divs = /\/=?\s*/g;
  for (let m = divs.exec(s); m; m = divs.exec(s)) {
    const rest = s.slice(m.index + m[0].length);
    const lit = /^\d+(\.\d*)?(e[+-]?\d+)?\b/.exec(rest);
    if (lit && Number(lit[0]) > 0) continue;
    if (GUARDED.test(rest)) continue;
    bad.push(`/ ${rest.slice(0, 24)}`);
  }
  return bad;
}

/** Every smoothstep whose literal edges are not ascending (undefined). */
function reversedSmoothsteps(src: string): string[] {
  const s = code(src);
  const bad: string[] = [];
  const NUM = String.raw`(-?\d+(?:\.\d*)?(?:e[+-]?\d+)?)`;
  const re = new RegExp(
    String.raw`\bsmoothstep\s*\(\s*` +
      NUM +
      String.raw`\s*,\s*` +
      NUM +
      String.raw`\s*,`,
    "g"
  );
  for (let m = re.exec(s); m; m = re.exec(s))
    if (Number(m[1]) >= Number(m[2])) bad.push(m[0]);
  return bad;
}

describe("the Poseidon path's GLSL guards", () => {
  for (const [name, src] of Object.entries(SHADERS))
    it(`${name}: no unguarded pow, sqrt, log or division`, () => {
      expect(src.length).toBeGreaterThan(100);
      expect(unguarded(src)).toEqual([]);
    });

  for (const [name, src] of Object.entries(SHADERS))
    it(`${name}: every smoothstep's literal edges ascend`, () => {
      expect(reversedSmoothsteps(src)).toEqual([]);
    });

  // Older shaders: only the smoothstep order is guarded.
  for (const [name, src] of Object.entries({
    "Torpedo fragment": TORPEDO_FRAGMENT,
    "Sea fragment": SEA_FRAGMENT,
  }))
    it(`${name}: every smoothstep's literal edges ascend`, () => {
      expect(src.length).toBeGreaterThan(100);
      expect(reversedSmoothsteps(src)).toEqual([]);
    });

  it("catches a reversed smoothstep", () => {
    expect(
      reversedSmoothsteps("float u = smoothstep(0.03, -0.03, y);")
    ).toHaveLength(1);
    expect(
      reversedSmoothsteps("float u = smoothstep(1.0, 1.0, y);")
    ).toHaveLength(1);
    expect(
      reversedSmoothsteps("float u = smoothstep(-0.03, 0.03, y);")
    ).toEqual([]);
    expect(reversedSmoothsteps("float u = smoothstep(a, b, y);")).toEqual([]);
  });

  it("catches what it is meant to catch", () => {
    expect(unguarded("float a = pow(x, 2.0);")).toHaveLength(1);
    expect(unguarded("float a = pow(max(x, 0.0), 2.0);")).toEqual([]);
    expect(unguarded("float a = sqrt(clamp(x, 0.0, 1.0));")).toEqual([]);
    expect(unguarded("float a = log(x);")).toHaveLength(1);
    expect(unguarded("float a = b / c;")).toHaveLength(1);
    expect(unguarded("v /= d;")).toHaveLength(1);
    expect(unguarded("float a = b / 0.0;")).toHaveLength(1);
    expect(unguarded("float a = b / 2.0 + c / max(d, 1e-6);")).toEqual([]);
    expect(unguarded("// a / b in a comment\nfloat a = 1.0;")).toEqual([]);
  });
});
