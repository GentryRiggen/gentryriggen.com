import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Scene,
  type Camera,
  type WebGLRenderer,
} from "three";
import { getChunkSet } from "./chunks";

/** Build the chunk set about this long after the planet appears. */
export const WARMUP_DELAY_MS = 1500;

/**
 * The shatter's inner material in each variant Shatter uses. Keep these in
 * step with the `inner` material in Shatter.tsx, or the programs compiled here
 * will not be the ones the shatter asks for.
 */
export function innerMaterial(frozen: boolean): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: !frozen,
    color: frozen ? "#8fc8ee" : "#ffffff",
    emissive: frozen ? "#4a96c0" : "#ff6a18",
    emissiveIntensity: frozen ? 0.12 : 0.14,
    roughness: 0.8,
    side: DoubleSide,
  });
}

/**
 * Builds the chunk set (a few hundred ms of work on a tablet) and compiles the
 * chunks' shader programs off to the side, in a scratch scene lit like the
 * real one, so the first ending does neither at its climax. Draws nothing in
 * the live scene. Returns a cancel function.
 */
export function scheduleChunkWarmup(
  gl: WebGLRenderer,
  camera: Camera
): () => void {
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled) return;
    const { set } = getChunkSet();
    const scratch = new Scene();
    scratch.add(new AmbientLight(), new DirectionalLight());
    const materials = [innerMaterial(false), innerMaterial(true)];
    for (const m of materials) scratch.add(new Mesh(set.geometries[0], m));
    const done = () => {
      for (const m of materials) m.dispose();
      scratch.clear();
    };
    try {
      Promise.resolve(gl.compileAsync(scratch, camera)).then(done, done);
    } catch {
      done();
    }
  }, WARMUP_DELAY_MS);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
