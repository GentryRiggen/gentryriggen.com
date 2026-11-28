import { NoColorSpace, RepeatWrapping, Vector3, type DataTexture } from "three";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { roomMaterials, roomShaders } from "../materials";
import { LAYERS } from "../pieces";
import { detailTexture } from "../textures";
import { waterMaterials } from "../water";
import {
  applyModern,
  MODERN_ANCHORS,
  MODERN_DETAIL_LINE,
  MODERN_FRAGMENT_HEAD,
  MODERN_GLASS_BRANCH,
  MODERN_PX,
  MURAL_PX,
  modernTextures,
  withModern,
} from "../modernTextures";

/**
 * The modern detail tiles: the right sizes for an iPad (about 2 MB with
 * mipmaps), repeating seamlessly, every channel in use, the mural in
 * colour; and the shader's modern finishes go into her materials only
 * (each anchor found once, no unguarded maths), leaving the Titanic's
 * shaders as they were.
 */

const tex = modernTextures();
afterAll(() => tex.dispose());

type Img = { data: Uint8Array; width: number; height: number };
const img = (t: unknown) => (t as DataTexture).image as unknown as Img;

/** Mean absolute difference between two columns (or rows) of a channel. */
function lineDiff(
  im: Img,
  ch: number,
  a: number,
  b: number,
  rows: boolean
): number {
  const N = im.width;
  let s = 0;
  for (let k = 0; k < N; k += 1) {
    const ia = rows ? (a * N + k) * 4 : (k * N + a) * 4;
    const ib = rows ? (b * N + k) * 4 : (k * N + b) * 4;
    s += Math.abs(im.data[ia + ch] - im.data[ib + ch]);
  }
  return s / N;
}

describe("the modern tiles", () => {
  it("are RGBA tiles of the right size, repeating, mipmapped, linear", () => {
    for (const [t, px] of [
      [tex.a, MODERN_PX],
      [tex.b, MODERN_PX],
      [tex.c, MURAL_PX],
    ] as const) {
      const im = img(t);
      expect(im.width).toBe(px);
      expect(im.height).toBe(px);
      expect(im.data.length).toBe(px * px * 4);
      expect(t.wrapS).toBe(RepeatWrapping);
      expect(t.wrapT).toBe(RepeatWrapping);
      expect(t.generateMipmaps).toBe(true);
      expect(t.colorSpace).toBe(NoColorSpace);
    }
    // Sized for an iPad: all three with their mipmaps about 2 MB.
    const bytes =
      ((MODERN_PX * MODERN_PX * 2 + MURAL_PX * MURAL_PX) * 4 * 4) / 3;
    expect(bytes).toBeLessThan(2.2 * 1024 * 1024);
  });

  it("uses every channel (a spread of values, never flat)", () => {
    for (const t of [tex.a, tex.b, tex.c]) {
      const im = img(t);
      for (let ch = 0; ch < 4; ch += 1) {
        let lo = 255;
        let hi = 0;
        let sum = 0;
        for (let i = ch; i < im.data.length; i += 4) {
          lo = Math.min(lo, im.data[i]);
          hi = Math.max(hi, im.data[i]);
          sum += im.data[i];
        }
        expect(hi - lo).toBeGreaterThan(60);
        const mean = sum / (im.data.length / 4);
        expect(mean).toBeGreaterThan(15);
        expect(mean).toBeLessThan(240);
      }
    }
  });

  it("repeats without a seam: the wrap is no worse than a step inside", () => {
    for (const t of [tex.a, tex.b, tex.c]) {
      const im = img(t);
      const N = im.width;
      for (let ch = 0; ch < 4; ch += 1)
        for (const rows of [false, true]) {
          let inside = 0;
          for (let k = 1; k < N; k += 1)
            inside += lineDiff(im, ch, k - 1, k, rows);
          inside /= N - 1;
          const wrap = lineDiff(im, ch, N - 1, 0, rows);
          expect(wrap).toBeLessThanOrEqual(inside * 3 + 6);
        }
    }
  });

  it("the mural is in colour: blue sky over a blue sea, sand at the foot", () => {
    const im = img(tex.c);
    const N = im.width;
    const at = (u: number, v: number) => {
      const k = (Math.floor(v * N) * N + Math.floor(u * N)) * 4;
      return [im.data[k], im.data[k + 1], im.data[k + 2]];
    };
    const sky = at(0.45, 0.6);
    expect(sky[2]).toBeGreaterThan(sky[0]);
    const sea = at(0.05, 0.25);
    expect(sea[2]).toBeGreaterThan(sea[0]);
    const sand = at(0.35, 0.1);
    expect(sand[0]).toBeGreaterThan(sand[2]);
    // Many colours (fish, rainbow, boat, sun...).
    const seen = new Set<number>();
    for (let i = 0; i < im.data.length; i += 4 * 7)
      seen.add(
        ((im.data[i] >> 5) << 6) |
          ((im.data[i + 1] >> 5) << 3) |
          (im.data[i + 2] >> 5)
      );
    expect(seen.size).toBeGreaterThan(14);
  });
});

describe("the shader's modern finishes", () => {
  it("each anchor is in the room fragment once; the code goes where it should", () => {
    for (const layer of LAYERS) {
      const src = roomShaders(layer, 8).fragment;
      const count = (s: string) => src.split(s).length - 1;
      expect(count(MODERN_ANCHORS.head)).toBe(1);
      if (layer === "shell" || layer === "wood")
        expect(count(MODERN_ANCHORS.detail)).toBe(1);
      if (layer === "glass") expect(count(MODERN_ANCHORS.glass)).toBe(1);
      const out = withModern(src, layer);
      expect(out).toContain("uniform sampler2D uModernA;");
      expect(out.includes(MODERN_DETAIL_LINE)).toBe(
        layer === "shell" || layer === "wood"
      );
      expect(out.includes("vTile > 17.5")).toBe(layer === "glass");
      // The head comes before main (and its varyings before it).
      expect(out.indexOf("modernBase(vec3")).toBeLessThan(
        out.indexOf("void main()")
      );
      expect(out.indexOf("varying float vTile;")).toBeLessThan(
        out.indexOf("modernBase(vec3")
      );
    }
  });

  it("has no unguarded pow, sqrt, log or division (NaN is a black screen)", () => {
    const code = [MODERN_FRAGMENT_HEAD, MODERN_DETAIL_LINE, MODERN_GLASS_BRANCH]
      .join("\n")
      .replace(/\/\/[^\n]*/g, " ");
    expect(code).not.toMatch(/\b(pow|sqrt|log|log2|inversesqrt)\s*\(/);
    expect(code).not.toMatch(/\//);
  });

  it("applyModern gives her materials the tiles and the emergency supply; the Titanic's shaders are unchanged", () => {
    const rooms = TITANIC_INTERIOR.rooms.length;
    const before = LAYERS.map((l) => roomShaders(l, rooms).fragment);
    const water = waterMaterials(rooms);
    const u = water.surface.uniforms;
    const mats = roomMaterials(
      rooms,
      {
        uRoomPower: u.uRoomPower,
        uLevel: u.uLevel,
        uTorchOn: u.uTorchOn,
        uTorchPos: u.uTorchPos,
        uTorchDir: u.uTorchDir,
        uTime: u.uTime,
      },
      detailTexture()
    );
    const plain = roomMaterials(
      rooms,
      {
        uRoomPower: u.uRoomPower,
        uLevel: u.uLevel,
        uTorchOn: u.uTorchOn,
        uTorchPos: { value: new Vector3() },
        uTorchDir: { value: new Vector3() },
        uTime: u.uTime,
      },
      detailTexture()
    );
    const mu = applyModern(mats, tex);
    for (const layer of LAYERS) {
      const m = mats[layer];
      expect(m.uniforms.uModernA).toBe(mu.uModernA);
      expect(m.uniforms.uEmergency).toBe(mu.uEmergency);
      expect(m.uniforms.uModernC.value).toBe(tex.c);
      expect(m.fragmentShader).toContain("uniform float uEmergency;");
      // Another ship's materials are untouched.
      expect(plain[layer].fragmentShader).not.toContain("uModernA");
      expect(plain[layer].uniforms.uModernA).toBeUndefined();
    }
    expect(mu.uEmergency.value).toBe(1);
    expect(LAYERS.map((l) => roomShaders(l, rooms).fragment)).toEqual(before);
    mats.dispose();
    plain.dispose();
  });
});
