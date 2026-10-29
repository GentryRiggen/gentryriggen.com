import { act, render } from "@testing-library/react";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
} from "three";
import type { PartEmphasis, PartTint } from "../Surface";
import GlbSlotPart from "../GlbSlotPart";
import { glbLoadStatus } from "../glbLoadStatus";
import { slotMeshesOf } from "../glbSlots";

const mockGltf: { load: () => { scene: Group } } = {
  load: () => {
    throw new Error("no model set");
  },
};

jest.mock("@react-three/drei", () => ({
  useGLTF: () => mockGltf.load(),
}));

// Surface's own tests cover the materials; here, check what each slot asks for.
jest.mock("../Surface", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <span
      data-testid="surface"
      data-color={props.color}
      data-finish={props.finish ?? "paint"}
      data-tint={props.tint ?? "none"}
      data-emphasis={props.emphasis ?? "none"}
    />
  ),
}));

/** r3f elements are unknown tags to the DOM renderer; swallow only those. */
const R3F_TAG_WARNING =
  /is unrecognized in this browser|incorrect casing|React does not recognize|non-boolean attribute|for a non-boolean/;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
beforeEach(() => {
  const real = console.error.bind(console);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    const text = args.map(String).join(" ");
    if (R3F_TAG_WARNING.test(text)) return;
    if (/Unknown slot|load failed|The above error/.test(text)) return;
    real(...args);
  });
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

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

const SLOTS = {
  body: { color: "#ff0000", castShadow: true, aoOccluder: true },
  pipe: { color: "#00ff00", finish: "metal" as const },
};

/** Each drawn mesh's Surface props, as the mock wrote them. */
interface DrawnMesh {
  mesh: Element;
  color?: string;
  finish?: string;
  tint?: string;
  emphasis?: string;
}

function drawnMeshes(container: HTMLElement): DrawnMesh[] {
  return Array.from(container.querySelectorAll("mesh")).map((mesh) => {
    const surface = mesh.querySelector(
      '[data-testid="surface"]'
    ) as HTMLElement;
    return { mesh, ...surface.dataset };
  });
}

function draw(tint: PartTint = null, emphasis: PartEmphasis = null) {
  return render(
    <GlbSlotPart
      url="/models/test.glb"
      slots={SLOTS}
      tint={tint}
      emphasis={emphasis}
      fallback={<group name="fallback" />}
    >
      <group name="decals" />
    </GlbSlotPart>
  );
}

describe("slotMeshesOf", () => {
  it("maps every mesh to its slot and shares the loader's geometry", () => {
    const scene = sceneWith("body", "pipe");
    const geometries = scene.children.map(
      (child) => (child as Mesh).geometry as BufferGeometry
    );
    const meshes = slotMeshesOf(scene, ["body", "pipe"], "x.glb");
    expect(meshes.map((m) => m.slot)).toEqual(["body", "pipe"]);
    expect(meshes.map((m) => m.geometry)).toEqual(geometries);
    expect(meshes.every((m) => m.matrix === null)).toBe(true);
  });

  it("finds the meshes once per scene", () => {
    const scene = sceneWith("body");
    expect(slotMeshesOf(scene, ["body"], "x.glb")).toBe(
      slotMeshesOf(scene, ["body"], "x.glb")
    );
  });

  it("falls back to the material name for an unnamed mesh", () => {
    const scene = sceneWith("");
    (
      scene.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>
    ).material.name = "pipe";
    expect(slotMeshesOf(scene, ["pipe"], "x.glb")[0].slot).toBe("pipe");
  });

  it("keeps a node's transform when the file has one", () => {
    const scene = sceneWith("body");
    scene.children[0].position.set(1, 2, 3);
    const [mesh] = slotMeshesOf(scene, ["body"], "x.glb");
    expect(mesh.matrix?.elements.slice(12, 15)).toEqual([1, 2, 3]);
  });

  it("throws on a slot it was not given", () => {
    const scene = sceneWith("body", "funnel_extra");
    expect(() => slotMeshesOf(scene, ["body"], "x.glb")).toThrow(
      'Unknown slot "funnel_extra" in x.glb'
    );
  });
});

describe("GlbSlotPart", () => {
  it("draws each slot with its colour and finish, and the children", () => {
    mockGltf.load = () => ({ scene: sceneWith("body", "pipe") });
    const { container } = draw();
    const drawn = drawnMeshes(container);
    expect(drawn.map(({ color, finish }) => ({ color, finish }))).toEqual([
      { color: "#ff0000", finish: "paint" },
      { color: "#00ff00", finish: "metal" },
    ]);
    // The DOM drops boolean props like castShadow; the AO layer shows.
    expect(drawn[0].mesh.getAttribute("layers-mask")).toBe("3");
    expect(drawn[1].mesh.hasAttribute("layers-mask")).toBe(false);
    expect(container.querySelector('group[name="decals"]')).not.toBeNull();
    expect(container.querySelector('group[name="fallback"]')).toBeNull();
  });

  it.each([
    ["ghost-ok", null],
    ["removal", null],
    [null, "hover"],
    [null, "selected"],
  ] as const)(
    "passes tint %s and emphasis %s to every slot",
    (tint, emphasis) => {
      mockGltf.load = () => ({ scene: sceneWith("body", "pipe") });
      const { container } = draw(tint, emphasis);
      const drawn = drawnMeshes(container);
      expect(drawn).toHaveLength(2);
      for (const surface of drawn) {
        expect(surface.tint).toBe(tint ?? "none");
        expect(surface.emphasis).toBe(emphasis ?? "none");
      }
    }
  );

  it("shows the fallback while the model loads, then the model", async () => {
    let resolve: () => void = () => {};
    const loading = new Promise<void>((r) => {
      resolve = r;
    });
    let ready = false;
    const scene = sceneWith("body");
    mockGltf.load = () => {
      if (!ready) throw loading;
      return { scene };
    };
    const { container } = draw();
    expect(container.querySelector('group[name="fallback"]')).not.toBeNull();
    expect(glbLoadStatus().pending).toBe(1);

    ready = true;
    await act(async () => {
      resolve();
      await loading;
    });
    expect(container.querySelector('group[name="fallback"]')).toBeNull();
    expect(drawnMeshes(container)).toHaveLength(1);
    expect(glbLoadStatus()).toMatchObject({ pending: 0, loaded: 1 });
  });

  it("falls back for good when the load fails", () => {
    mockGltf.load = () => {
      throw new Error("load failed");
    };
    const { container, unmount } = draw();
    expect(container.querySelector('group[name="fallback"]')).not.toBeNull();
    expect(container.querySelector('group[name="decals"]')).toBeNull();
    expect(drawnMeshes(container)).toHaveLength(0);
    expect(glbLoadStatus().failed).toBe(1);
    unmount();
    expect(glbLoadStatus().failed).toBe(0);
  });

  it("falls back on a mesh with an unknown slot", () => {
    mockGltf.load = () => ({ scene: sceneWith("body", "mystery") });
    const { container } = draw();
    expect(container.querySelector('group[name="fallback"]')).not.toBeNull();
    expect(drawnMeshes(container)).toHaveLength(0);
  });
});
