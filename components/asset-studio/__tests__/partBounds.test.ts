import { BoxGeometry, Group, Mesh } from "three";
import { partBounds } from "../partBounds";

describe("partBounds", () => {
  it("is null without geometry", () => {
    expect(partBounds(new Group())).toBeNull();
  });

  it("reads vertices in the root's frame, offsets included", () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(2, 2, 2));
    mesh.position.set(1, 1, 0);
    root.add(mesh);
    expect(partBounds(root)).toEqual({ min: [0, 0, -1], max: [2, 2, 1] });
  });

  it("turns a raked part upright and skips hidden meshes", () => {
    const root = new Group();
    const tilt = new Group();
    tilt.rotation.z = 0.3;
    const mesh = new Mesh(new BoxGeometry(1, 4, 1));
    mesh.position.y = 2;
    const hidden = new Mesh(new BoxGeometry(50, 50, 50));
    hidden.visible = false;
    tilt.add(mesh, hidden);
    root.add(tilt);
    expect(partBounds(root, 0.3)).toEqual({
      min: [-0.5, 0, -0.5],
      max: [0.5, 4, 0.5],
    });
  });
});
