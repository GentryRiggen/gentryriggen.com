import { render } from "@testing-library/react";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import GlbRegistryPart, { GlbSourceContext } from "../GlbRegistryPart";
import type { GlbPartContext, GlbPartEntry } from "../glbRegistry";

const mockGltf: { load: () => { scene: Group } } = {
  load: () => {
    throw new Error("no model set");
  },
};
const requested: string[] = [];

jest.mock("@react-three/drei", () => ({
  useGLTF: (url: string) => {
    requested.push(url);
    return mockGltf.load();
  },
}));

jest.mock("../Surface", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <span
      data-testid="surface"
      data-color={props.color}
      data-tint={props.tint ?? "none"}
      data-emphasis={props.emphasis ?? "none"}
    />
  ),
}));

const R3F_TAG_WARNING =
  /is unrecognized in this browser|incorrect casing|React does not recognize|non-boolean attribute|for a non-boolean/;
beforeEach(() => {
  requested.length = 0;
  const real = console.error.bind(console);
  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (R3F_TAG_WARNING.test(args.map(String).join(" "))) return;
    real(...args);
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

let sceneCount = 0;
function sceneWith(...names: string[]): Group {
  const scene = new Group();
  scene.name = `scene-${sceneCount++}`;
  for (const name of names) {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

const CONTEXT: GlbPartContext = { tint: null, emphasis: null, rotation: 0 };

const subParts = jest.fn((ctx: GlbPartContext) => (
  <span
    data-testid="sub"
    data-tint={ctx.tint ?? "none"}
    data-emphasis={ctx.emphasis ?? "none"}
  />
));
const ENTRY: GlbPartEntry = {
  model: "fake",
  variant: "fake",
  rakeRadians: 0.2,
  slots: () => ({ body: { color: "#123456" } }),
  subParts,
};

function draw(
  type: string,
  source: React.ComponentProps<typeof GlbSourceContext.Provider>["value"],
  context: GlbPartContext = CONTEXT
) {
  return render(
    <GlbSourceContext.Provider value={source}>
      <GlbRegistryPart type={type} context={context}>
        <group name="procedural" />
      </GlbRegistryPart>
    </GlbSourceContext.Provider>
  );
}

describe("GlbRegistryPart", () => {
  it("draws its children for a part with no entry", () => {
    const { container } = draw("cannon-deck", {});
    expect(container.querySelector('group[name="procedural"]')).not.toBeNull();
    expect(requested).toEqual([]);
  });

  it("draws its children when the source is procedural", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    const { container } = draw("funnel", { procedural: true });
    expect(container.querySelector('group[name="procedural"]')).not.toBeNull();
    expect(requested).toEqual([]);
  });

  it("draws a registered part from its glb, raked, with sub-parts", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    const { container } = draw("fake", { entries: { fake: ENTRY } });
    expect(requested).toEqual(["/ship-builder/models/fake/fake.glb"]);
    const raked = container.querySelector("group[rotation]");
    expect(raked?.getAttribute("rotation")).toBe("0,0,0.2");
    expect(raked?.querySelector("mesh")).not.toBeNull();
    expect(raked?.querySelector('[data-testid="sub"]')).not.toBeNull();
    expect(container.querySelector('group[name="procedural"]')).toBeNull();
  });

  it("turns a facing part with its rotation, and turns the fallback back", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    const facing: GlbPartEntry = { ...ENTRY, rakeRadians: 0, facing: true };
    const context: GlbPartContext = { ...CONTEXT, rotation: 90 };
    const turned = Math.PI - Math.PI / 2;
    const { container } = draw("fake", { entries: { fake: facing } }, context);
    const outer = container.querySelector("group[rotation]");
    expect(Number(outer?.getAttribute("rotation")?.split(",")[1])).toBeCloseTo(
      turned
    );
    mockGltf.load = () => {
      throw new Error("load failed");
    };
    const failed = draw("fake", { entries: { fake: facing } }, context);
    const back = failed.container.querySelector(
      'group[name="procedural"]'
    )?.parentElement;
    expect(Number(back?.getAttribute("rotation")?.split(",")[1])).toBeCloseTo(
      -turned
    );
  });

  it("reaches the real funnel entry through the registry", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    draw("funnel-large", {});
    expect(requested).toEqual(["/ship-builder/models/funnel/funnel-large.glb"]);
  });

  it("uses the source's url for work-in-progress models", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    draw("fake", {
      entries: { fake: ENTRY },
      urlFor: (e) => `/asset-studio/${e.model}/${e.variant}.glb`,
    });
    expect(requested).toEqual(["/asset-studio/fake/fake.glb"]);
  });

  it("falls back to its children when the model fails", () => {
    mockGltf.load = () => {
      throw new Error("load failed");
    };
    const { container } = draw("fake", { entries: { fake: ENTRY } });
    expect(container.querySelector('group[name="procedural"]')).not.toBeNull();
  });

  it("hands sub-parts the part's tint and emphasis (a ghost reaches them)", () => {
    mockGltf.load = () => ({ scene: sceneWith("body") });
    subParts.mockClear();
    const context: GlbPartContext = {
      tint: "ghost-ok",
      emphasis: "hover",
      rotation: 90,
      side: "port",
      size: { x: 2, z: 1 },
    };
    const { container } = draw("fake", { entries: { fake: ENTRY } }, context);
    expect(subParts).toHaveBeenCalledWith(context);
    const sub = container.querySelector('[data-testid="sub"]');
    expect(sub?.getAttribute("data-tint")).toBe("ghost-ok");
    expect(sub?.getAttribute("data-emphasis")).toBe("hover");
    // The model's own slots get the same tint.
    const surface = container.querySelector('[data-testid="surface"]');
    expect(surface?.getAttribute("data-tint")).toBe("ghost-ok");
  });
});
