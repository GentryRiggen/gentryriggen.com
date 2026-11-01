# Ever Onward lab notebook

The fun loop for Ever Onward universes (method: the `fun-loop` skill in
`~/.claude-personal/skills/fun-loop/SKILL.md`). One file, appended every round.
Gentry's playtest notes go in quoted and outrank the score.

## Purpose

A balance that passed every test still played like "clicking orange boxes".
This notebook, the headless simulator and the Engagement Scorecard exist so each
tuning round is measured, reviewed and remembered. The scorecard measures
symptoms we already know (floods, dead time, no felt effect, one plate). Passing
is necessary, not sufficient. If the score and the playtest notes disagree,
believe the notes and change the bands.

Reference: `docs/superpowers/specs/2026-11-01-ever-onward-engagement-research.md`
(principles, anti-patterns, the M1-M14 definitions, bands, gates, weights).

## How to run

```bash
npm run score:ever-onward           # readable table (about 3 s)
npx tsx scripts/ever-onward-score.ts --json   # the full structured report
npx jest lib/ever-onward/universes/light/__tests__/scorecard.test.ts
```

Code map:

- `lib/ever-onward/engine/sim.ts`: `simulate(def, { trace: {} })` records the
  trace (5 s time series, per-purchase effect, novelty events).
- `lib/ever-onward/engine/trace.ts`: the trace types and the "meaningful" rule.
- `lib/ever-onward/engine/score.ts`: `scoreTrace` and `scoreUniverse`, M1-M14.
- `lib/ever-onward/engine/bots.ts`, `universes/light/bots.ts`: tapper,
  realistic, idle, naive-oil and cheapskate-oil bots.
- `universes/light/hooks.ts`: Keep the Light On's `plates`, `consumables` and
  `sceneDiff`; `UpgradeDef.kind` is set in `upgrades.ts`.
- `universes/light/__tests__/scorecard.test.ts`: the regression floor and the
  calibration fixture (a flooded build must score well below the real one).

The total is capped at 59 while any gate fails, so track the **uncapped** score
and the failing gate list too: the cap hides progress.

## Round format

Each round appends:

1. Date and round number.
2. Hypothesis and the change made (one focused change; bold and structural is
   fine).
3. Score before and after, with per-metric deltas.
4. The reviewer's retro: what dragged (dead stretches, meaningless choices, no
   tension, no novelty), what blocked the loop itself (missing trace fields, a
   slow sim, a lying metric), one or two bold ideas.
5. Decision (keep or revert) and what to try next.
6. Check in with Gentry: score trend plus a screenshot or clip; ask them to
   play when the score jumps or a mechanic changes.

After a round, raise `SCORE_FLOOR` / `UNCAPPED_FLOOR` in `scorecard.test.ts`.

## Playtest notes (ground truth)

### 2026-11-01, Gentry, Universe 1 "Keep the Light On" (boon-era build)

> It just devolves into clicking orange boxes because there's upgrades and I
> can't keep up with how much money I'm making with the upgrades and I can't
> even see anything happening with the upgrades… I could click whatever I want
> and I was just clicking a million things waiting for the level to end and I
> honestly can't see the point… slow that all way down.

Read as: too many cheap upgrades (M2, M4, M5), no visible effect (M4), nothing
to look after (M7, M9), no point (M8).

## Round -1: the pacing fix (before the scorecard existed, 2026-11-01)

Branch `feat/ever-onward-pacing` (release 1.2.0), a reaction to the note above:

- Removed the timer-popped "boon" upgrades (a new 2% button every 140 s).
- `maxVisible: 3`: at most three unbought upgrades on offer; buying one reveals
  the next. Reveals are gated on milestones, never on a clock.
- Fewer, bigger upgrades: one-off chains (`wick`, `fees`, `tank`, `train`,
  `shutters`, ...) and a few repeatables with level counters.
- Every card shows a before-to-after line (`effectPreview`).
- Oil is a decision: a manual "Buy oil" action at a drifting price, with a
  dimmed lamp (never a hard stop) when dry.
- The HUD shows a net rate (income minus oil burn).

Not scored then. The old boon-era build is not reproduced here (too heavy to
resurrect from git). Calibration instead uses a deliberately flooded fixture in
`scorecard.test.ts` (no `maxVisible`, costs divided by 10, six cheap
repeatables per phase). Result: it scores **45.7** against the real build's
**66.4** (uncapped) and fails the M2, M4 and M5 gates, as the research doc
predicts for the first balance. Remaining caveat: the doc's target "bad below
50, good above 75" is only half met; the real build is far from 75 (see below).

## Round 0: baseline scorecard (2026-11-01)

Build: `feat/ever-onward-funloop` at the scorecard commit, no tuning.

**Total 59.0 / 100** (capped; **66.4 uncapped**). 14 gates fail. Runtime about
3 s for seven full simulated runs. Finish: tapper 1.98 h, realistic 2.44 h, idle
3.26 h, run 2 1.29 h, run 3 1.01 h.

**Worst metric: M7 Plates (-7.1 pts). Worst phase: sky (48%).**

| Metric                | Sub  | Pts    | Gate | Coast                                         | Night         | Sky                              | Last               |
| --------------------- | ---- | ------ | ---- | --------------------------------------------- | ------------- | -------------------------------- | ------------------ |
| M1 Reveal cadence     | 0.89 | 8.9/10 | FAIL | 0.99 (max gap 410 s)                          | 1.00 (260 s)  | 0.76 (230 s, p10 4 s)            | 1.00               |
| M2 Decision density   | 0.50 | 6.0/12 | ok   | 0.50 (0 options 91%)                          | 0.50 (93%)    | 0.50 (95%)                       | 0.50 (94%)         |
| M3 Goal queue         | 0.27 | 0.8/3  | FAIL | 0.74                                          | 0.48          | 0.00 (goal 71% of time)          | 0.00               |
| M4 Felt effect        | 0.47 | 5.7/12 | FAIL | 0.89 (filler 17%)                             | 1.00          | 0.00 (filler 33%, med effect 7%) | 0.50 (med 5%)      |
| M5 Purchase rate      | 1.00 | 6.0/6  | ok   | 1.00 (0.8/min)                                | 1.00          | 1.00                             | 1.00               |
| M6 Wait ratio         | 0.88 | 8.8/10 | FAIL | 1.00                                          | 1.00          | 0.77 (p95 245 s)                 | 0.86               |
| M7 Plates             | 0.29 | 2.9/10 | FAIL | 0.43 (mean 1.2-1.5, peak 3)                   | 0.20 (peak 1) | 0.20 (peak 1)                    | 0.50 (peak 2)      |
| M8 Novelty            | 1.00 | 7.0/7  | ok   | 1.00                                          | 1.00          | 1.00                             | 1.00               |
| M9 Tension            | 0.22 | 1.3/6  | ok   | 0.90 (low 8%, skill gap 0.5%)                 | 0.00          | 0.00                             | 0.00               |
| M10 Income smoothness | 0.63 | 2.5/4  | FAIL | 0.83                                          | 0.95          | 0.49 (plateau 33%)               | 0.28 (plateau 80%) |
| M11 Active vs idle    | 0.80 | 5.6/7  | ok   | run-level: manual 97% / 38% / 72%, idle 1.64x |               |                                  |                    |
| M12 Dead time         | 0.51 | 2.0/4  | FAIL | 0.45 (250 s)                                  | 0.41 (210 s)  | 0.58 (172 s)                     | 0.82               |
| M13 Prestige          | 1.00 | 5.0/5  | ok   | run-level: 0.65, 0.79, early reveals 131%     |               |                                  |                    |
| M14 Length            | 0.96 | 3.8/4  | ok   | run-level: 1.98 h                             |               |                                  |                    |

Phase scores (per-phase metrics only): coast 79%, night 71%, sky 48%, last 63%.

### First read

What the numbers say is weakest, in order of points lost:

1. **Plates (M7, -7.1).** Night and sky have exactly one live system (the
   tap/crank/aim) for the whole phase: peak 1 plate, a hard gate failure. The
   coast peaks at 3 (tap, oil market, storm) but averages 1.2-1.5. Gentry's
   favourite thing (be in many places at once) is simply absent after the coast.
2. **Felt effect (M4, -6.3) and sky generally.** Sky is the worst phase: a third
   of its purchases are filler (median effect 7%), the goal queue is empty 29% of
   the time, p95 wait 245 s, income plateaus a third of the time. The sky
   upgrade chains (`copy`, `engines`, `appetite`) multiply a process (probes)
   the player cannot see paying off in income.
3. **Decision density (M2, -6.0).** Meaningful affordable options are 0 for
   91-95% of samples. Part of that is real (waits are the whole game, nothing is
   ever hoarded into a choice) and part is the instrument (see below).
4. **Tension (M9, -4.7).** Only the coast has a watched number. Even there the
   oil choice is nearly worthless: a cheapskate finishes the coast only 0.5%
   faster than a naive buyer (target 5-25%), and the tank sits in the low zone
   8% of the time (target 10-35%). The oil decision is not a decision yet.
5. **Dead time and reveal cadence (M1/M12/M3 gates).** Longest stretch with
   nothing new: coast 250 s (M1 sees a 410 s gap), night 210 s, sky 172 s.
   These are the same "nothing for about 3 minutes" the spec called an
   anti-goal; they are in the coast and night mid-phase.

What looks fine: purchase rate (0.8/min, no clicking storm), novelty per phase,
prestige speedup (0.65, 0.79), total length (1.98 h, slightly under the 2-3 h
band), idle still finishes (1.64x slower than a tapper).

### Instrument caveats (do not tune toward these blindly)

- **M2 and the eager bot.** The tapper shops every 10 s and buys everything
  affordable, so an option is rarely "affordable" for long. Shop interval 10 vs
  30 s moves the 0-options share from 91% to 78% only. M2 counts _meaningful_
  options only, so a flood of filler also escapes it (M4/M5 catch that). The
  flooded calibration fixture fails M2 only because half its boons are tagged
  mechanics. Consider a dawdling bot (shops every 45 s) for M2/M3.
- **Idle bot is not the doc's.** Literally "tap 2 minutes, then never" is stuck
  forever at 3 purchases (the first keeper costs more than two minutes of taps),
  which itself says the first minutes need hands. The idle bot here taps for
  the first 10 minutes, 5 minutes of each next phase and all of the last phase
  (the ending needs a tap and the flame fades), then only watches.
- **M9 gives phases with no watched number a 0 sub-score.** That is deliberate
  (no tension is the finding) but it makes the metric move only when a
  consumable is added to a phase, not when oil is tuned.
- **M10 in the last phase** measures a fading energy supply, not growth; its
  "plateau 80%" is mostly a bad fit for a phase about letting go. Probably
  exclude or re-band it for that phase.
- **M4's gate** uses the median effect of _meaningful_ purchases (the doc left
  "median effect" ambiguous); a scene-only or mechanic purchase with 0% income
  effect still counts as meaningful.
- **Sub-score fail edges** are one band width beyond a two-sided band, 2x an
  "at most" limit, 0.5x an "at least" limit, or the gate, whichever is closer.
  The doc's "twice the band width outside" was ambiguous.
- **Plates are honestly declared** (`hooks.ts`): tap, oil market (action
  visible and cheap or tank under 40%), storm, grid crank, aim, tend, let-go.
  No "shop" plate: buying is not a plate.
- **The 59 cap hides progress.** 14 gates fail, so the total reads 59.0 until
  most are fixed. Watch `uncapped` and the failing-gate list.

### Round 1 should try

1. **A second watched number in night and sky** (clears the M7 and M9
   zeros, the two biggest holes): night gets a grid-stress / brownout dial the
   player fixes by hand (demand surges when a city lights; a brownout dims, never
   stops, income), sky gets something to steer (probe swarm spending energy
   against a "too hungry" limit, or a target star to aim at). Keep it a free
   action, never a hard stop.
2. **Make oil matter**: widen the price swing and the burn so the cheapskate
   beats the naive buyer by 5-25% and the tank is low 10-35% of the time.
3. **Fix sky's wait and effect**: show probe progress as income, shorten the
   p95 wait (245 s), and fold the three filler-ish chains into fewer, bigger
   steps.
4. **Tooling first if the reviewer needs it**: a dawdler bot for M2/M3, and a
   per-phase plate timeline in the trace output.
