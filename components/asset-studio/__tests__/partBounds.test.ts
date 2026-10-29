import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { paletteNames, partBounds, partSlots } from "../partBounds";

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

describe("partSlots", () => {
  it("groups meshes by shared paint and names palette colours", () => {
    const red = new MeshStandardMaterial({ color: "#ff0000", roughness: 0.55 });
    const steel = new MeshStandardMaterial({
      color: "#112233",
      roughness: 0.4,
      metalness: 0.6,
    });
    const root = new Group();
    root.add(
      new Mesh(new BoxGeometry(), red),
      new Mesh(new BoxGeometry(), red)
    );
    root.add(new Mesh(new BoxGeometry(), steel));
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const slots = partSlots(root, paletteNames({ hull: { stern: "#ff0000" } }));
    expect(slots.map((s) => [s.name, s.finish, s.meshes, s.triangles])).toEqual(
      [
        ["hull-stern", "paint", 2, 24],
        ["paint-112233", "metal", 1, 12],
        ["unlit", "paint", 1, 12],
      ]
    );
  });
});
