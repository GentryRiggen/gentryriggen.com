import spec from "@/assets/parts/funnel.json";
import { cameraForView, type StudioView } from "../studioCamera";

// Expected values come from assets/blender/lib/render.py camera_for_view,
// run on the `funnel` variant's expectedBounds.
const { min, max } = spec.variants[0].expectedBounds;
const view = (name: string): StudioView =>
  spec.views.find((v) => v.name === name) as StudioView;

describe("cameraForView", () => {
  it("frames the side view like render.py", () => {
    const cam = cameraForView(view("side"), min, max);
    expect(cam.ortho).toBe(true);
    expect(cam.position[0]).toBeCloseTo(-0.0311, 6);
    expect(cam.position[1]).toBeCloseTo(1.607, 6);
    expect(cam.position[2]).toBeCloseTo(6.88458011501, 6);
    expect(cam.target[1]).toBeCloseTo(1.607, 6);
    expect(cam.orthoHalfHeight).toBeCloseTo(1.7677, 6);
  });

  it("frames the front view from +X", () => {
    const cam = cameraForView(view("front"), min, max);
    expect(cam.position[0]).toBeCloseTo(6.85348011501, 6);
    expect(cam.position[2]).toBeCloseTo(0, 6);
    expect(cam.target[0]).toBeCloseTo(-0.0311, 6);
  });

  it("frames the three-quarter perspective view", () => {
    const cam = cameraForView(view("three-quarter"), min, max);
    expect(cam.ortho).toBe(false);
    expect(cam.fovDeg).toBe(30);
    expect(cam.position[0]).toBeCloseTo(3.91157554577, 6);
    expect(cam.position[1]).toBeCloseTo(4.10887499186, 6);
    expect(cam.position[2]).toBeCloseTo(5.63072422192, 6);
  });
});
