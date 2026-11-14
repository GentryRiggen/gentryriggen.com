import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { sceneInfo } from "@/lib/ever-onward/universes/higher";
import {
  forkActionId,
  forkCost,
  type ForkId,
} from "@/lib/ever-onward/universes/higher/forks";
import { UPGRADES } from "@/lib/ever-onward/universes/higher/upgrades";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/higher/__tests__/fixtures";
import { performAction } from "@/lib/ever-onward/engine/engine";
import { higherUniverse as def } from "@/lib/ever-onward/universes/higher";
import HigherScene from "../HigherScene";
import PlayroomLayer from "../PlayroomLayer";
import SkyLayer from "../SkyLayer";
import TopLayer from "../TopLayer";
import TownLayer from "../TownLayer";

const ROOT = path.resolve(__dirname, "../../../../..");
const LAYERS = [PlayroomLayer, TownLayer, SkyLayer, TopLayer] as const;
const PHASES = ["playroom", "town", "sky", "top"];
const FORK_IDS: ForkId[] = ["play", "town", "sky", "top"];

const markup = (run: RunState): string => {
  const Layer = LAYERS[run.phase];
  return renderToStaticMarkup(
    <svg>
      <Layer info={sceneInfo(run)} />
    </svg>
  );
};

const withLevel = (run: RunState, id: string, level: number): RunState => ({
  ...run,
  owned: { ...run.owned, [id]: level },
});

describe("Build It Higher scenes", () => {
  it.each(PHASES.map((p, i) => [p, i] as const))(
    "the %s layer draws something",
    (_name, i) => {
      expect(markup(runAtPhaseStart(i)).length).toBeGreaterThan(500);
    }
  );

  it("draws every level of every upgrade (it is never just a number)", () => {
    const missing: string[] = [];
    for (const u of UPGRADES) {
      const phase = PHASES.indexOf(u.phases?.[0] ?? "playroom");
      const base = runAtPhaseStart(phase);
      for (let level = 0; level < (u.maxLevel ?? 1); level += 1) {
        // The end of a part leaves the picture at once for the next part, so
        // its own layer is checked only by the scene info (see economy test).
        const isEnd = ["treehouse", "skyscraper", "space-elevator"].includes(
          u.id
        );
        if (isEnd) continue;
        if (
          markup(withLevel(base, u.id, level)) ===
          markup(withLevel(base, u.id, level + 1))
        )
          missing.push(`${u.id} ${level}->${level + 1}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(FORK_IDS.map((id, i) => [id, i] as const))(
    "the %s fork draws a different picture for each side",
    (id, phase) => {
      const base = runAtPhaseStart(phase);
      // Enough of the first helper line that the fork is open and the
      // picture is tall enough to show the difference.
      const run: RunState = {
        ...base,
        owned: {
          ...base.owned,
          [["bear", "mason", "sky-crew", "stair-lamp"][phase]]: 4,
        },
        resources: {
          ...base.resources,
          [def.phases[phase].manualResource]: forkCost(id) * 3,
        },
      };
      const none = markup(run);
      const a = markup(performAction(def, run, forkActionId(id, 0)));
      const b = markup(performAction(def, run, forkActionId(id, 1)));
      expect(new Set([none, a, b]).size).toBe(3);
    }
  );

  it("draws the tower leaning when the pace makes it lean", () => {
    const run = runAtPhaseStart(0);
    const leaning = {
      ...run,
      resources: { ...run.resources, pcLean: 0.9 },
    };
    expect(markup(leaning)).not.toBe(markup(run));
    expect(markup(leaning)).toContain("bh-wobble");
  });

  describe("the sky's moments", () => {
    const sky = (extra: Record<string, number>): RunState => {
      const run = runAtPhaseStart(2);
      return {
        ...run,
        time: 100,
        owned: { ...run.owned, "sky-crew": 3, "cloud-crane": 2 },
        resources: { ...run.resources, ...extra },
      };
    };
    const words = (run: RunState): string => {
      const { unmount } = render(<HigherScene run={run} />);
      const text = screen.queryByTestId("hs-moment-text")?.textContent ?? "";
      unmount();
      return text;
    };

    it("darkens the sky a step at a time, then sweeps a gust across", () => {
      const calm = markup(sky({}));
      const clouds = markup(sky({ skWx: 1, skWxAt: 108 }));
      const sure = markup(sky({ skWx: 2, skWxAt: 104 }));
      const gust = markup(sky({ skGusts: 1, skGustUntil: 103 }));
      expect(new Set([calm, clouds, sure, gust]).size).toBe(4);
      expect(clouds).toContain('data-wx="1"');
      expect(sure).toContain('data-wx="2"');
      expect(gust).toContain("sk-gust");
      expect(calm).not.toContain("sk-gust");
    });

    it("shouts DROPPED!, SNAP!, TIED DOWN and MADE IT! in full-width banners", () => {
      expect(words(sky({ skDrops: 1, skDropAt: 99 }))).toBe("DROPPED!");
      expect(words(sky({ skSnaps: 1, skSnapAt: 99 }))).toBe("SNAP!");
      expect(words(sky({ skTies: 1, skTiedAt: 99, skTie: 2 }))).toBe(
        "TIED DOWN"
      );
      expect(words(sky({ skNcWins: 1, skNcWinAt: 99 }))).toBe("MADE IT!");
      expect(words(sky({ skWx: 2, skWxAt: 104, skStrong: 1 }))).toBe(
        "STRONG GUST COMING!"
      );
    });

    it("draws the falling beam, the whipping cable, the clamps and a badge", () => {
      expect(markup(sky({ skDrops: 1, skDropAt: 99 }))).toContain("sk-drop");
      expect(markup(sky({ skSnaps: 1, skSnapAt: 99 }))).toContain("sk-snap");
      expect(markup(sky({ skTie: 2 }))).toContain("sk-straps");
      expect(markup(sky({ skNcWins: 2 }))).toContain('data-badges="2"');
      expect(markup(sky({ skNc: 1, skNcUntil: 150 }))).toContain('data-on="1"');
    });
  });

  it("draws the kid on the grass once the block is set down", () => {
    const run = runAtPhaseStart(3);
    const down: RunState = {
      ...run,
      owned: { ...run.owned, "set-down": 1 },
      flags: { ...run.flags, "here-kid-on-the-grass": true },
    };
    expect(markup(down)).not.toBe(markup(withLevel(run, "set-down", 1)));
  });

  it("renders the scene with its caption and a label for a screen reader", () => {
    render(<HigherScene run={runAtPhaseStart(0)} />);
    const svg = screen.getByTestId("lm-scene");
    expect(svg).toHaveAttribute("data-phase", "playroom");
    expect(svg).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/playroom/i)
    );
    expect(screen.getByTestId("lm-scene-caption")).toHaveTextContent(
      /A tower of 3 blocks/
    );
  });

  describe("movement", () => {
    const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("Ever Onward: Build It Higher"));

    it("keeps every bh- class in one block at the end of the stylesheet", () => {
      expect(css.indexOf("Ever Onward: Build It Higher")).toBeGreaterThan(0);
      expect(
        css.slice(0, css.indexOf("Ever Onward: Build It Higher"))
      ).not.toMatch(/\.bh-/);
    });

    it("stills every animated class for people who prefer reduced motion", () => {
      const animated = [
        ...new Set(
          [...block.matchAll(/\.(bh-[a-z-]+)\s*\{[^}]*animation:\s*bh-/g)].map(
            (m) => m[1]
          )
        ),
      ];
      expect(animated.length).toBeGreaterThan(20);
      const reduced = block.slice(
        block.indexOf("@media (prefers-reduced-motion: reduce)")
      );
      for (const name of animated) expect(reduced).toContain(`.${name}`);
    });

    it("only uses bh- classes that are defined", () => {
      const used = new Set<string>();
      const dir = path.join(ROOT, "components/ever-onward/scenes/higher");
      for (const file of fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".tsx"))) {
        const text = fs.readFileSync(path.join(dir, file), "utf8");
        for (const m of text.matchAll(/"(bh-[a-z-]+)"/g)) used.add(m[1]);
      }
      expect(used.size).toBeGreaterThan(15);
      for (const name of used) expect(block).toContain(`.${name}`);
    });
  });

  it("never draws text smaller than 10px", () => {
    const dirs = [
      "components/ever-onward/scenes/higher",
      "components/ever-onward/game/higher",
      "components/ever-onward/universes",
    ];
    for (const dir of dirs) {
      const full = path.join(ROOT, dir);
      for (const file of fs
        .readdirSync(full)
        .filter((f) => /^[A-Z].*\.tsx$|^higher\.tsx$/.test(f))) {
        const text = fs.readFileSync(path.join(full, file), "utf8");
        const small = [...text.matchAll(/text-\[(\d+)px\]/g)].filter(
          (m) => Number(m[1]) < 10
        );
        expect([file, small.map((m) => m[0])]).toEqual([file, []]);
      }
    }
  });
});
