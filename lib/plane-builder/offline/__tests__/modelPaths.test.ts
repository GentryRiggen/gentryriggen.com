import { readdirSync } from "node:fs";
import path from "node:path";
import { PLANE_MODEL_PATHS } from "../modelPaths";

function modelsOnDisk(dir: string): string[] {
  return readdirSync(path.join(process.cwd(), "public", dir), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return modelsOnDisk(child);
    return entry.name.endsWith(".glb") ? [`/${child}`] : [];
  });
}

describe("PLANE_MODEL_PATHS", () => {
  it("lists exactly the models in public/plane-builder/models", () => {
    expect([...PLANE_MODEL_PATHS].sort()).toEqual(
      modelsOnDisk("plane-builder/models").sort()
    );
  });
});
