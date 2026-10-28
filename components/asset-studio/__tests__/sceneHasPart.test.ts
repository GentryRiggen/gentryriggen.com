import { BoxGeometry, Group, Mesh, Scene } from "three";
import { sceneHasPart } from "../sceneHasPart";

describe("sceneHasPart", () => {
  it("is false for an empty scene or an empty mesh", () => {
    const scene = new Scene();
    expect(sceneHasPart(scene)).toBe(false);
    scene.add(new Group(), new Mesh());
    expect(sceneHasPart(scene)).toBe(false);
  });

  it("is true once a mesh with geometry is present", () => {
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(1, 1, 1)));
    expect(sceneHasPart(scene)).toBe(true);
  });

  it("ignores meshes outside the part group (a sky dome)", () => {
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(100, 100, 100)));
    const part = new Group();
    scene.add(part);
    expect(sceneHasPart(part)).toBe(false);
    part.add(new Mesh(new BoxGeometry(1, 1, 1)));
    expect(sceneHasPart(part)).toBe(true);
  });
});
