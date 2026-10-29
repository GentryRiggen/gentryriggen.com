import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FUNNEL_RAKE_RADIANS } from "@/components/ship-builder/scene/effectAnchors";
import funnelModern from "@/assets/parts/funnel-modern.json";
import { INNER_ROTATION } from "../innerRotation";

const SCENE = join(process.cwd(), "components", "ship-builder", "scene");

describe("INNER_ROTATION", () => {
  it("lists every raked funnel at the game's rake", () => {
    for (const type of ["funnel", "funnel-large", "funnel-modern"] as const) {
      expect(INNER_ROTATION[type]).toBe(FUNNEL_RAKE_RADIANS);
    }
  });

  it("covers every scene file that tilts a part by the funnel rake", () => {
    // Update INNER_ROTATION (and this list) when a new file rakes a part.
    const users = readdirSync(SCENE)
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) =>
        readFileSync(join(SCENE, f), "utf8").includes(
          "rotation={[0, 0, FUNNEL_RAKE_RADIANS]}"
        )
      )
      .sort();
    expect(users).toEqual(["FunnelMesh.tsx", "cruiseParts.tsx"].sort());
  });

  it("is what the modern funnel's spec records", () => {
    expect(funnelModern.rakeRadians).toBe(FUNNEL_RAKE_RADIANS);
  });
});
