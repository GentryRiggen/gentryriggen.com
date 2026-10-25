import type { MeshStandardMaterial } from "three";
import { RUST_IN_S } from "@/lib/ship-builder/sim/descent";
import type { SimEvent } from "@/lib/ship-builder/sim/types";

/** 0 = clean, 1 = fully rusted. Shared by every patched material. */
export const RUST: { value: number } = { value: 0 };
export const RUST_MAX_MIX = 0.8;

const RUST_BRIGHT = "vec3(0.545, 0.227, 0.102)"; // #8b3a1a
const RUST_DARK = "vec3(0.353, 0.165, 0.078)"; // #5a2a14

const patched = new WeakSet<MeshStandardMaterial>();

/** Patches a material once (idempotent) to mix toward rust by RUST.value. */
export function withRust<T extends MeshStandardMaterial>(material: T): T {
  if (patched.has(material)) return material;
  patched.add(material);
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    // `RUST` itself is the uniform: three reads `.value` from it each frame.
    shader.uniforms.uRust = RUST;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRustPos;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 rustWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            rustWorld = instanceMatrix * rustWorld;
          #endif
          vRustPos = (modelMatrix * rustWorld).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uRust;
        varying vec3 vRustPos;
        float rustHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float rustNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(rustHash(i), rustHash(i + vec3(1,0,0)), f.x),
                mix(rustHash(i + vec3(0,1,0)), rustHash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(rustHash(i + vec3(0,0,1)), rustHash(i + vec3(1,0,1)), f.x),
                mix(rustHash(i + vec3(0,1,1)), rustHash(i + vec3(1,1,1)), f.x), f.y),
            f.z);
        }`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (uRust > 0.0) {
          float rustBlotch = smoothstep(0.3, 0.7,
            rustNoise(vRustPos * 2.5) * 0.65 + rustNoise(vRustPos * 9.0) * 0.35);
          float rustTone = rustNoise(vRustPos * 5.0 + 7.0);
          vec3 rustColor = mix(${RUST_DARK}, ${RUST_BRIGHT}, rustTone);
          diffuseColor.rgb = mix(diffuseColor.rgb, rustColor,
            uRust * ${RUST_MAX_MIX.toFixed(2)} * rustBlotch);
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 1.0, uRust);`
      );
  };
  material.customProgramCacheKey = () => "rust";
  material.needsUpdate = true;
  return material;
}

/** A `ref` callback for JSX materials. */
export function rustRef(material: MeshStandardMaterial | null): void {
  if (material) withRust(material);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** What rust needs from playback (a `TrialPlayback` or a `SimState`). */
export interface RustSnapshot {
  time: number;
  events: readonly SimEvent[];
}

/** Rust amount for the playback moment: 0 before the first touched-bottom, then a smoothstep to 1 over RUST_IN_S of sim time. */
export function rustAmount(snapshot: RustSnapshot | null): number {
  if (!snapshot) return 0;
  const landed = snapshot.events.find((e) => e.kind === "touched-bottom");
  if (!landed) return 0;
  const t = (snapshot.time - landed.at) / RUST_IN_S;
  return smoothstep(Math.min(1, Math.max(0, t)));
}
