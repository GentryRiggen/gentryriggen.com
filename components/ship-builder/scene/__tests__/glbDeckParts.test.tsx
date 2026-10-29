import { act, render, waitFor } from "@testing-library/react";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { GlowContext, createGlowController } from "../GlowContext";
import GlbRegistryPart from "../GlbRegistryPart";
import type { GlbPartContext } from "../glbRegistry";

const mockGltf: { load: () => { scene: Group } } = {
  load: () => {
    throw new Error("no model set");
  },
};

jest.mock("@react-three/drei", () => ({
  useGLTF: () => mockGltf.load(),
}));

jest.mock("../Surface", () => ({
  ...jest.requireActual("../Surface"),
  __esModule: true,
  default: () => <span data-testid="surface" />,
}));

const R3F_TAG_WARNING =
  /Invalid value for prop|is unrecognized in this browser|incorrect casing|React does not recognize|non-boolean attribute|for a non-boolean/;
const MOUNT_WARNING = /state update on a component that hasn't mounted/;

function lampScene(): Group {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.name = "post";
  scene.add(mesh);
  return scene;
}

const CONTEXT: GlbPartContext = { tint: null, emphasis: null, rotation: 0 };

describe("deck fittings with lights (glb body, procedural glow)", () => {
  let errors: string[];
  beforeEach(() => {
    errors = [];
    jest.spyOn(console, "error").mockImplementation((...args) => {
      const text = args.map(String).join(" ");
      if (!R3F_TAG_WARNING.test(text)) errors.push(text);
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("loads the deck lamp while the glow changes, with no React warnings", async () => {
    const controller = createGlowController(0);
    let release: () => void = () => {};
    const loading = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready = false;
    mockGltf.load = () => {
      if (!ready) throw loading;
      return { scene: lampScene() };
    };
    const { container } = render(
      <GlowContext.Provider value={controller}>
        <GlbRegistryPart type="deck-lamp" context={CONTEXT}>
          <group name="procedural" />
        </GlbRegistryPart>
      </GlowContext.Provider>
    );
    // Dusk falls while the model is still loading, then the model arrives.
    act(() => controller.set(0.5));
    ready = true;
    await act(async () => {
      release();
      await loading;
    });
    act(() => controller.set(1));
    await waitFor(() =>
      expect(container.querySelector('group[name="procedural"]')).toBeNull()
    );
    act(() => controller.set(0.2));
    expect(errors.filter((e) => MOUNT_WARNING.test(e))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
