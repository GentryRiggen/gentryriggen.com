import { isFunnelType } from "@/lib/ship-builder/model/funnelLivery";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import type { FunnelFall } from "@/lib/ship-builder/sim/types";
import { TOPPLE_S } from "@/lib/ship-builder/sim/funnelFall";
import { findTemplate } from "@/lib/ship-builder/templates";
import {
  fallenIdsAt,
  funnelDependents,
  funnelSplashSeconds,
  hiddenByFalls,
} from "../funnelFallView";

function fall(funnelId: string, at: number): FunnelFall {
  return {
    funnelId,
    at,
    origin: { x: 0, y: 3, z: 0 },
    roll: 0.2,
    pitch: -0.3,
    side: 1,
  };
}

describe("fallenIdsAt", () => {
  const falls = [fall("a", 10), fall("b", 13)];

  it("holds exactly the funnels that have snapped by then", () => {
    expect([...fallenIdsAt(falls, 9.9)]).toEqual([]);
    expect([...fallenIdsAt(falls, 10)]).toEqual(["a"]);
    expect([...fallenIdsAt(falls, 20)].sort()).toEqual(["a", "b"]);
  });

  it("gives a funnel back when the player scrubs to before it snapped", () => {
    expect(fallenIdsAt(falls, 20).has("b")).toBe(true);
    expect(fallenIdsAt(falls, 12).has("b")).toBe(false);
  });

  it("is empty with no falls", () => {
    expect(fallenIdsAt([], 100).size).toBe(0);
  });
});

describe("funnelSplashSeconds", () => {
  it("is negative until the funnel hits the water, then counts up", () => {
    const f = fall("a", 10);
    expect(funnelSplashSeconds(f, 10)).toBeLessThan(0);
    expect(funnelSplashSeconds(f, 10 + TOPPLE_S)).toBeCloseTo(0, 6);
    expect(funnelSplashSeconds(f, 10 + TOPPLE_S + 0.5)).toBeCloseTo(0.5, 6);
  });

  it("makes no splash for one that broke off deep under the water", () => {
    const deep = { ...fall("a", 10), origin: { x: 0, y: -4, z: 0 } };
    expect(funnelSplashSeconds(deep, 12)).toBeNull();
  });
});

describe("funnelDependents", () => {
  const titanic = findTemplate("titanic")!.build();
  const funnels = titanic.parts.filter((part) => isFunnelType(part.type));
  const [first, second] = funnels;
  const lights: PlacedPart = {
    id: "lights",
    type: "string-lights",
    anchor: { kind: "attach", parentId: first.id, pointId: "string" },
    rotation: 0,
  };
  const ship: Ship = { ...titanic, parts: [...titanic.parts, lights] };
  const dependents = funnelDependents(ship);

  it("has an entry for every funnel, holding the funnel itself", () => {
    expect(dependents.size).toBe(funnels.length);
    for (const funnel of funnels) {
      expect(dependents.get(funnel.id)?.has(funnel.id)).toBe(true);
    }
  });

  it("takes lights hung from a funnel with it", () => {
    expect(dependents.get(first.id)?.has("lights")).toBe(true);
  });

  it("takes lights strung to a funnel with it too", () => {
    // The lights on the first funnel run to the nearest pole: the next one.
    expect(dependents.get(second.id)?.has("lights")).toBe(true);
  });

  it("leaves the rest of the ship alone", () => {
    const hidden = hiddenByFalls(dependents, new Set([first.id]));
    expect([...hidden].sort()).toEqual([first.id, "lights"].sort());
    expect(hiddenByFalls(dependents, new Set()).size).toBe(0);
  });
});
