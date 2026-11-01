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

## Round 1: second watched numbers, a dawdler, oil that matters (2026-11-01)

Branch `feat/ever-onward-funloop`, tuner role. Hypothesis: the worst holes were
structural, not numeric. Night and sky had one live system each (peak 1 plate,
tension 0), the oil choice was worth 0.5%, and sky's filler chains hid the
probes' payoff. So: add a watched, hand-fixable number to night and sky, make
oil a real decision, show probe progress as income, and close dead stretches.
Instruments first.

### A. Instruments

- **Dawdler bot** (`dawdler` in `BotSet`, `engine/bots.ts`): taps 1/s, shops
  once a minute, savvy oil, looks after the grid and heading under 35%, never
  claims bonuses. It is traced, and **M2 and M3 now read its trace** (the other
  metrics still read the tapper). Effect: M2 0-options share fell from 91-95% to
  73-77% (M2 6.0 to 7.1 pts) but M3 got _worse_ (the dawdler buys everything
  between trips, so the queue of goals is thinner: night/sky/last fail the "a
  goal 95% of the time" gate). That is a real finding about the design (goals
  run out when you buy as soon as you can), not noise.
- **M10 last phase re-banded**: the last phase fades by design, so growth, CV
  and plateau do not apply. It now scores the slope against a gentle fade
  (-0.12 to +0.02 decades/min) and has no plateau gate. Round 0 failed it 80%
  plateau; it now passes (1.00).
- **M9 generalised**: any consumable can carry its own `lowZone`; each phase
  with a watched number gets a `naive` vs `careful` bot pair (`BotSet.skill`,
  keyed by phase index) and the skill gap is the naive player's phase exit over
  the careful one's. Before this, only oil (phase 0) could score.
- Test fixtures (`__tests__/fixtures.ts`) now fix the grid and heading and take
  bonuses, as a real player would.

Round 0 with only these instruments (before any game change): **59.0 capped /
67.4 uncapped** (66.4 at Round 0; the 1.0 is the M10 re-band net of M3).

### B. Night: grid strain and the evening rush

- A watched number, **Grid steadiness (%)**. It falls as the grid works harder
  (log of supply/demand, so every plant counts) and cities pay between 40% and
  100% of the power they would (`gridFactor`: never zero; the phase still ends
  on supply, so it cannot stall). Free action **Balance the grid** restores it
  (blocked when already steady). Sparkline, a "dimming/uneasy/steady" chip and
  "cities pay N%" come from the existing generic `ActionView`.
- **Evening rush**: every 100-200 s a 45 s window opens (and the grid strains 3x
  as fast). Free action **Ride the evening rush** pays about 40 s of income plus
  taps. Never required, nothing lost if ignored.
- Automation, bought later: **Load balancer** (`grid-1`, strain halves) then
  **Smart grid** (`grid-2`, fixes itself below 55%, retires the button).
- Plates added: `grid` (steadiness under 85%) and `rush`.

### C. Sky: probe heading, solar flares, folded chains

- A second watched number, **Probe heading (%)**. Drift grows with the fleet (log
  of probes); the fleet's pace is 35-100% of full (never zero). Free action
  **Send a course correction**. Chain `nav`: **Star charts** (drift halves),
  **A navigator mind** (fixes itself, retires the button).
- **Solar flare**: every 110-220 s a 40 s window; free action **Catch the solar
  flare** pays about 40 s of income. Starts once there is one collector.
- **Probe progress is income**: each star taken now pays `starBounty` energy
  (15), replacing the slow stock term. Copying and engines steps land a wave of
  probes at once (x1.5 and x1.3) so buying them is felt. New `relay` chain (3
  steps, each star pays 60% more) gives late sky something worth buying while the
  fleet is exponential.
- **Fewer, bigger steps**: `copy`, `engines`, `appetite` went from 3 steps each to
  2 each with larger multipliers (copy 1.9x, engines 0.6x trip, appetite 2.2x);
  the saved-game ids `copy-3`, `engines-3`, `appetite-3` are gone (a mid-run save
  that owned them keeps counting the tier, a small one-off bump).
- Plates added: `course`, `flare`.

### D. Coast oil as a decision

- Burn per ship now grows with the operation (0.1 + 0.1 per extra lighthouse),
  the price swings wider and longer (wobble 1.0, pull 0.006, 0.3-6.0), the
  merchant contract moved to 5+ lighthouses (so the first ~35 min are by hand).
- **The tank scales with burn** (it holds 60 s of full-tilt burn, +60 s per tank
  upgrade). Before this, late coast needed a Buy-oil click every ~12 s; now it is
  about every 90 s. A barrel is capped at 60% of the bank (a poor lighthouse
  still gets a small one).
- Result: careful beats naive by 2.9% in the coast (8% while tuning; the dock
  chain and extra income later diluted it), tank in the low zone 14% of the time
  (band 10-35%).

### E. Dead stretches

- New coast chain `dock` (3 steps, +20% fares each), new night chain `subs`
  (2 steps, +20% supply), and cheaper mid-stretch steps (`fees-3`, `shutters-2`,
  `train-3`, `gen4`) so something is on offer where Round 0 had 250 s of nothing.
- Coast M12 longest 250 to 160 s, night 210 to 150 s. M1 still shows reveal gaps
  (coast 380 s) that need more reveals, not more purchases.

### Before and after

| Metric                | Round 0 | Round 1  | Notes                                                       |
| --------------------- | ------- | -------- | ----------------------------------------------------------- |
| Total (capped)        | 59.0    | 59.0     | still capped by 9 gates                                     |
| Total (uncapped)      | 66.4    | **76.6** | +10.2                                                       |
| Failing gates         | 14      | 9        |                                                             |
| M1 Reveal cadence     | 8.9     | 8.5      | gates: coast 380 s, night 260 s, sky 237 s                  |
| M2 Decision density   | 6.0     | 7.1      | dawdler instrument                                          |
| M3 Goal queue         | 0.8     | 1.3      | night/sky/last gates fail (dawdler buys everything)         |
| M4 Felt effect        | 5.7     | 8.5      | sky 0.50, last 0.50 fail: nav/probe mechanics move 0 income |
| M5 Purchase rate      | 6.0     | 6.0      |                                                             |
| M6 Wait ratio         | 8.8     | 8.8      | sky p95 245 to 185 s (gate 180)                             |
| M7 Plates             | 2.9     | **4.9**  | gates pass; every phase peaks at 3 (last at 2)              |
| M8 Novelty            | 7.0     | 7.0      |                                                             |
| M9 Tension            | 1.3     | **4.3**  | coast .97, night 1.00, sky 1.00, last 0                     |
| M10 Income smoothness | 2.5     | 3.5      | re-banded last phase; sky plateau 33 to 13%                 |
| M11 Active vs idle    | 5.6     | 5.6      | idle/tapper 1.75x (was 1.64x), idle 3.39 h                  |
| M12 Dead time         | 2.0     | 2.6      | coast .68, night 1.00, sky .45, last .82                    |
| M13 Prestige          | 5.0     | 5.0      | run2/run1 0.69, run3/run2 0.76                              |
| M14 Length            | 3.8     | 3.5      | 1.94 h (Round 0 1.98 h): just under the 2.0 h band          |

Per phase (per-phase metrics): coast 79% to 84%, night 71% to 83%, sky 48% to
72%, last 63% to 68%. Phase lengths: coast 35, night 29, sky 34, last 19 min.
Finish: tapper 1.94 h, realistic 2.27 h, idle 3.39 h, run 2 1.34 h, run 3 1.03 h.

Failing gates left (9): M1 coast/night/sky (max reveal gap), M3 night/sky/last
(dawdler's goal queue), M4 sky/last (median effect 6% and 5% against 8%), M6 sky
(p95 wait 185 s).

### What moved and what did not

- **Moved a lot**: plates (M7 gates cleared, night and sky no longer one-system),
  tension (M9 1.3 to 4.3: night and sky now have a watched number with a real skill
  gap, 12.5% each), felt effect, income smoothness in sky, dead time in coast and
  night. Gates: 6 cleared (M7 night and sky, M10 sky and last, M12 coast and night),
  1 new (M3 night, from the dawdler), net 14 to 9. M12 sky stays soft (0.45).
- **Did not move**: the last phase is still the weakest (68%): 2 plates, no
  watched number, a 0.5 felt-effect sub-score (letting go gives +2 energy/s, 5%),
  and an empty goal queue (only one let-go on offer at a time). Reveal cadence
  (M1) still has 250-380 s holes between _reveals_ even where purchases fill
  the time. Length is 1.94 h, a hair under 2 h.
- **Cost of the instruments**: M3 is worse with the dawdler. The goal queue is
  the thing the doc cares about; a human who buys as soon as they can leaves
  nothing to look forward to. Either raise `maxVisible` (tried 4: no gain, M2 got
  worse) or show locked "someday" goals (a greyed-out next-phase teaser).
- Sensitivity found: the idle bot is very sensitive to costs (x1.1 on every
  coast and night cost pushed idle from 3.4 h to 4.1 h, over the 4 h gate), so
  length was added with probe growth (0.006 to 0.0028) and not with costs.

### Open questions for the reviewer

1. Is the grid too chore-like? A tapper fixes it every ~2-3 minutes, the idle bot
   survives on the 40% floor. Should "Balance the grid" have a cooldown instead of
   being free any time (so it is a rhythm, not a spam button)?
2. Is bonus-window (rush, flare) tension acceptable for kids (a vanishing offer,
   though nothing is lost)? If not, make them persist until claimed.
3. M9's `lowZone` of 5-60% for the grid and heading is generous (a number going
   under 60% means cities visibly pay 76%). Is that honest tension or Goodhart?
4. Last phase: what is the watched number? (Candidate: the flame's brightness
   against which light you let go; or a second hand-fixable "draught".)
5. M1 gaps are about reveals. Should story beats count (they do) and should the
   unlock of an upgrade count when it replaces one just bought?
6. The coast skill gap is only 2.9% in the final build (8% in the tuning pass):
   late coast income swamps oil. Make oil burn scale with income, or move the
   contract later still?

### Decision

Keep. Next (Round 2 candidates): a watched number and a second plate for the
last phase; reveal beats for the coast and night mid-stretches; make the goal
queue survive a shopper (teaser goals); a short check-in clip of the night and
sky with Gentry.
