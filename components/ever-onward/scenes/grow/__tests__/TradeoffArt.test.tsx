import { render } from "@testing-library/react";
import { performAction } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  growUniverse as def,
  sceneInfo,
} from "@/lib/ever-onward/universes/grow";
import { growSceneDiff } from "@/lib/ever-onward/universes/grow/hooks";
import {
  forkActionId,
  type ForkId,
} from "@/lib/ever-onward/universes/grow/forks";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import {
  FarmForkArt,
  FarmProjectArt,
  SeedForkArt,
  WorldForkArt,
  YardForkArt,
} from "../TradeoffArt";

const PHASE: Record<ForkId, number> = { yard: 0, farm: 1, world: 2, seed: 3 };
const NEEDS: Record<ForkId, [string, number]> = {
  yard: ["sprinkler", 3],
  farm: ["tractor", 2],
  world: ["windbreak", 2],
  seed: ["trellis", 2],
};
const CURRENCY: Record<ForkId, string> = {
  yard: "seeds",
  farm: "harvest",
  world: "green",
  seed: "care",
};

function chosen(id: ForkId, side: 0 | 1): RunState {
  const base = runAtPhaseStart(PHASE[id]);
  const run: RunState = {
    ...base,
    owned: { ...base.owned, [NEEDS[id][0]]: NEEDS[id][1] },
    resources: { ...base.resources, [CURRENCY[id]]: 1e9 },
  };
  return performAction(def, run, forkActionId(id, side));
}

const svg = (node: React.ReactNode) =>
  render(<svg role="img">{node}</svg>).container;

describe("the picture of each fork", () => {
  it.each([
    ["yard", YardForkArt, ["bees", "spray"]],
    ["farm", FarmForkArt, ["crew", "hawk"]],
    ["world", WorldForkArt, ["forest", "wetland"]],
    ["seed", SeedForkArt, ["sun", "night-light"]],
  ] as const)(
    "%s: draws nothing before the choice and its own art after",
    (id, Art, names) => {
      const none = runAtPhaseStart(PHASE[id]);
      expect(
        svg(<Art info={sceneInfo(none)} />).querySelector("[data-fork-art]")
      ).toBeNull();
      for (const side of [0, 1] as const) {
        const info = sceneInfo(chosen(id, side));
        const art = svg(<Art info={info} />).querySelector("[data-fork-art]");
        expect(art?.getAttribute("data-fork-art")).toBe(names[side]);
      }
    }
  );

  it("changes the scene for every fork side (so the shop buy lands)", () => {
    for (const id of ["yard", "farm", "world", "seed"] as const) {
      const none = runAtPhaseStart(PHASE[id]);
      const base: RunState = {
        ...none,
        owned: { ...none.owned, [NEEDS[id][0]]: NEEDS[id][1] },
      };
      expect(growSceneDiff(base, chosen(id, 0))).toBe(true);
      expect(growSceneDiff(base, chosen(id, 1))).toBe(true);
      expect(growSceneDiff(chosen(id, 0), chosen(id, 1))).toBe(true);
    }
  });
});

describe("the seed bank and the projects in the picture", () => {
  it("draws sacks once the bank holds seed, more as it fills", () => {
    const farm = runAtPhaseStart(1);
    const sacks = (stock: number) => {
      const run = {
        ...farm,
        owned: { ...farm.owned, scarecrow: 3 },
        resources: { ...farm.resources, sbStep: 1, sbStock: stock },
      };
      return svg(<FarmForkArt info={sceneInfo(run)} />).querySelector(
        "[data-bank]"
      );
    };
    expect(sacks(0)).toBeNull();
    expect(sacks(1e6)).not.toBeNull();
  });

  it("draws a thing for each done farm project, and bunting for a festival", () => {
    const farm = runAtPhaseStart(1);
    const run: RunState = {
      ...farm,
      flags: {
        ...farm.flags,
        "project-drip-lines": true,
        "project-cold-store": true,
        "project-hybrid-seed": true,
      },
      resources: { ...farm.resources, fsLeft: 20 },
    };
    const root = svg(<FarmProjectArt info={sceneInfo(run)} />);
    for (const id of ["drip-lines", "cold-store", "hybrid-seed"])
      expect(root.querySelector(`[data-project="${id}"]`)).not.toBeNull();
    expect(root.querySelector('[data-festival="on"]')).not.toBeNull();
    expect(growSceneDiff(farm, run)).toBe(true);
  });
});
