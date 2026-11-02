import { render } from "@testing-library/react";
import { performAction } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { smileUniverse as def } from "@/lib/ever-onward/universes/smile";
import { sceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import {
  forkActionId,
  type ForkId,
} from "@/lib/ever-onward/universes/smile/forks";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/smile/__tests__/fixtures";
import { UPGRADES } from "@/lib/ever-onward/universes/smile/upgrades";
import SmileScene from "../SmileScene";
import { CALLOUT_IDS, calloutFor } from "../callouts";
import { captionFor, sceneLabelFor } from "../captions";
import {
  FriendForkArt,
  QuietForkArt,
  TownForkArt,
  WorldForkArt,
} from "../ForkArt";

const PHASE_OF: Record<string, number> = {
  friend: 0,
  town: 1,
  world: 2,
  quiet: 3,
};

const svg = (node: React.ReactNode) =>
  render(<svg role="img">{node}</svg>).container;

const FORK_ART = {
  friend: FriendForkArt,
  town: TownForkArt,
  world: WorldForkArt,
  quiet: QuietForkArt,
} as const;

const NEEDS: Record<ForkId, [string, number, string]> = {
  friend: ["balloon", 3, "smiles"],
  town: ["band", 2, "cheers"],
  world: ["loudspeaker", 2, "grins"],
  quiet: ["tea", 2, "patience"],
};

function chosen(id: ForkId, side: 0 | 1): RunState {
  const [need, count, currency] = NEEDS[id];
  const base = runAtPhaseStart(PHASE_OF[id]);
  const run: RunState = {
    ...base,
    owned: { ...base.owned, [need]: count },
    resources: { ...base.resources, [currency]: 1e12 },
  };
  return performAction(def, run, forkActionId(id, side));
}

describe("Smile scene", () => {
  it.each(Object.entries(PHASE_OF))("draws the %s layer", (phase, index) => {
    const run = runAtPhaseStart(index);
    const { getByTestId } = render(<SmileScene run={run} />);
    const picture = getByTestId("lm-scene");
    expect(picture).toHaveAttribute("data-phase", phase);
    expect(picture.querySelector(`[data-layer="${phase}"]`)).not.toBeNull();
    expect(picture).toHaveAttribute(
      "aria-label",
      sceneLabelFor(sceneInfo(run))
    );
  });

  it("keeps the part it left behind, paused and hidden", () => {
    const first = runAtPhaseStart(0);
    const second = runAtPhaseStart(1);
    const { getByTestId, rerender } = render(<SmileScene run={first} />);
    rerender(<SmileScene run={second} />);
    const picture = getByTestId("lm-scene");
    const left = picture.querySelector('[data-layer="friend"]')!;
    const now = picture.querySelector('[data-layer="town"]')!;
    expect(left.getAttribute("class")).toContain("lm-paused");
    expect(left.getAttribute("aria-hidden")).toBe("true");
    expect(now.getAttribute("class") ?? "").not.toContain("lm-paused");
  });

  it("describes the picture in a caption", () => {
    for (const i of [0, 1, 2, 3])
      expect(captionFor(sceneInfo(runAtPhaseStart(i))).length).toBeGreaterThan(
        8
      );
  });

  it("has a callout for every shop upgrade, in the right part", () => {
    for (const phase of Object.keys(PHASE_OF) as (keyof typeof PHASE_OF)[]) {
      const ids = UPGRADES.filter((u) => u.phases?.[0] === phase).map(
        (u) => u.id
      );
      expect(
        [...CALLOUT_IDS[phase as keyof typeof CALLOUT_IDS]].sort()
      ).toEqual([...ids].sort());
      const info = sceneInfo(runAtPhaseStart(PHASE_OF[phase]));
      for (const id of ids) {
        const callout = calloutFor({ upgradeId: id, n: 1 }, info);
        expect(callout).not.toBeNull();
        expect(callout!.x).toBeGreaterThanOrEqual(0);
        expect(callout!.x).toBeLessThanOrEqual(400);
      }
    }
  });
});

describe("the picture of each fork", () => {
  it.each(["friend", "town", "world", "quiet"] as const)(
    "%s: the two sides look different and each is drawn",
    (id) => {
      const Art = FORK_ART[id];
      const a = svg(<Art side={0} />);
      const b = svg(<Art side={1} />);
      expect(a.innerHTML.length).toBeGreaterThan(100);
      expect(b.innerHTML.length).toBeGreaterThan(100);
      expect(a.innerHTML).not.toBe(b.innerHTML);
      expect(
        a.querySelector("[data-fork-art]")!.getAttribute("data-fork-art")
      ).not.toBe(
        b.querySelector("[data-fork-art]")!.getAttribute("data-fork-art")
      );
    }
  );

  it.each(["friend", "town", "world", "quiet"] as const)(
    "%s: choosing a side changes the whole scene, and each side differently",
    (id) => {
      const first = sceneInfo(chosen(id, 0));
      const second = sceneInfo(chosen(id, 1));
      expect(first.fork).toBe(1);
      expect(second.fork).toBe(2);
      const view = (run: RunState) =>
        render(<SmileScene run={run} />).container.innerHTML;
      expect(view(chosen(id, 0))).not.toBe(view(chosen(id, 1)));
    }
  );
});
