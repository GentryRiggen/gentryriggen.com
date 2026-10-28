import { Box3, type Mesh, type Object3D } from "three";

/** True when the scene holds at least one mesh with a non-empty box. */
export function sceneHasPart(scene: Object3D): boolean {
  let found = false;
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (found || !(node as Mesh).isMesh) return;
    const box = new Box3().setFromObject(node);
    if (!box.isEmpty()) found = true;
  });
  return found;
}
