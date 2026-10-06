import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { Rotation, Side } from "@/lib/ship-builder/model/types";
import { PIRATE_ICONS } from "../../ui/icons/pirateIcons";
import {
  CREW_DECOR,
  CREW_MESHES,
  PIRATE_COATS,
  pirateCoat,
} from "../pirate/crew";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const SIDES: Side[] = ["port", "starboard"];
const base = { tint: null, emphasis: null } as const;

/** Expands function components (none use hooks) and collects host elements. */
function hostElements(
  node: ReactNode
): ReactElement<{ position?: number[] }>[] {
  if (Array.isArray(node)) return node.flatMap(hostElements);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{
    children?: ReactNode;
    position?: number[];
  }>;
  if (typeof element.type === "function") {
    const render = element.type as (props: unknown) => ReactNode;
    return hostElements(render(element.props));
  }
  return [element, ...hostElements(element.props.children)];
}

const meshes = (node: ReactNode) =>
  hostElements(node).filter((el) => el.type === "mesh");

describe("pirate crew parts", () => {
  it.each(SIDES)("draws the plank on the %s side", (side) => {
    expect(meshes(CREW_MESHES.plank({ ...base, side })).length).toBeGreaterThan(
      2
    );
  });

  it("runs the plank outboard on each side", () => {
    const boardZ = (side: Side) =>
      meshes(CREW_MESHES.plank({ ...base, side }))[0].props.position?.[2] ?? 0;
    expect(boardZ("starboard")).toBeGreaterThan(0);
    expect(boardZ("port")).toBeLessThan(0);
  });

  it.each(ROTATIONS)(
    "draws the pirate and parrot at %i degrees",
    (rotation) => {
      const pirate = CREW_DECOR["pirate-crew"]({ ...base, rotation });
      const parrot = CREW_DECOR.parrot({ ...base, rotation });
      expect(meshes(pirate).length).toBeGreaterThan(3);
      expect(meshes(parrot).length).toBeGreaterThan(3);
    }
  );

  it("picks one of four coat colours from the rotation", () => {
    expect(ROTATIONS.map(pirateCoat)).toEqual([...PIRATE_COATS]);
  });

  it("draws three distinct icons", () => {
    const markup = (["plank", "pirate-crew", "parrot"] as const).map((type) =>
      JSON.stringify(PIRATE_ICONS[type]())
    );
    expect(new Set(markup).size).toBe(3);
  });
});
