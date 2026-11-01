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
npm run score:ever-onward           # readable table (about 3 s), Light
npm run score:ever-onward -- grow   # another universe by id
npm run score:ever-onward -- grow --json   # the full structured report
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

## Round 1 — reviewer retro (Opus)

Coast: first ~20 min work. Minutes ~20–30 the oil button becomes button-mashing: the tapper clicks it 152 times in 10 min (~15 effective clicks/s, bursts of 3–6), because each barrel is capped at 60% of the bank (tick.ts:122) so a near-broke player gets a smaller barrel every click. Night/Sky tending is sleepy not naggy: balances 4× in a 29-min night, corrects 2× in sky; drift 85→45% takes ~2 min so the plate is a background number; rush/flare are the only "look up!" moments. Q1: no cooldown; enable Balance only below ~75% and show the drop (cities flicker). Q2: bonus windows not acceptable as built. Q3: generous low zone, Goodhart-prone. Q5: next chain step replacing a bought one shouldn't count as a reveal. Q6: fix the barrel first.
Last Light is a 19-minute timer: energy enters at 42k (phases.ts:71 keeps max of carried and start), rises to 86k vs ≤22/s decay; shield/glass/remember bought on sight; let-goes paced only by resolve 1/s; Tend adds 15 to a 42k bank; +200 refund is 0.5% (TUNING.last.letGoRefund unused; hard-coded upgrades.ts:739); story says "There is no wrong order" but order is fixed (upgrades.ts:737). Sky has most dead time (gap 170s, p95 wait 185s); automation bought late (nav-2 min 26/34, grid-2 min 23/29).
Loop blockers: M9 skill gap compares cumulative exit times (score.ts:511-513) — diluted by coast; per-phase gaps are night 28%, sky 13%; careful/naive pair also differs on bonus claims, so it measures the bonus not tending (tending alone ~5% of night, claiming rush ~18%). M7 counts "dial < 85%" as a plate (hooks.ts:40,45) even when ignoring is right — count attention events (distinct non-tap actions/min per plate). No chore-rate metric — add "non-tap clicks per active minute" with a gate. M10 last reports "fading by design" while energy rises — read the flame, fail on growth. Idle bot tends at 60% (bots.ts:84) — idle must never press buttons.
Round 2 priorities: (1) Rebuild The Last Light as "The first ship comes home": energy starts at 600 (set, not max), flame is the watched number, taps matter; 2–3 let-goes on offer at once in any order, each with a different gift (porch: slower fade; festival: burst; moon: taps worth more) so order is a real choice; log the first ship's moment in the coast (minute, storm/calm); at 3 lights left the sea and a small boat with one lantern appear in the dark, heading drifts gently, you tap the old beam to steer; final action is the game's first action — flash, the boat turns, counter reads "Ships guided: 1"; echo the coast-hello line ("Click. The lamp is lit."). (2) Bonus windows that wait for you + one-click oil: rush/flare persist until claimed (no new one until then), worth ~25s income not 40; drop the 3× rush strain (tick.ts:257); a barrel fills the tank (or as much as you can afford) in one click — remove the coin cap. (3) Instruments first: per-phase M9 with separate claim/tend bot pairs; attention-event plates; chore-rate gate; idle bot that never presses buttons; M10 reads the flame.
Kid-safety: rush vanishing after 45s while ignoring costs ~18% and strain triples = punishes not tapping (violates research rule). Shrinking barrel rewards mashing. "There is no wrong order" is false — make it true or reword. No streaks/timers-while-away/monetisation found.

## Round 2: honest instruments, windows that wait, the first ship comes home (2026-11-01)

Branch `feat/ever-onward-funloop`, tuner role. Order followed: (3) instruments,
re-score; (2) windows and one-click oil; (1) rebuild The Last Light.

**Hypothesis.** The round 1 score was partly measuring the wrong things (a
"plate" was a dial under a line, the skill gap was diluted by earlier phases,
the idle bot tended, nothing counted clicks) and partly rewarding mechanics that
were unkind to kids (bonus windows that vanish, a barrel that shrinks as you
click). Fix the ruler first, then fix the design it exposes, then give the last
phase a real choice, a watched number and an ending that is an action.

### A. Instruments (all before touching the game)

- **Attention-event plates (M7).** `UniverseDef.plateActions` maps a plate to
  the actions that tend it. A mapped plate (oil market, grid, rush, course,
  flare, boat) counts only while the player has done one of its actions in the
  last 90 s; an unmapped plate (tap, storm, let-go on offer) counts while it is
  offered. A dial under 85% that you rightly ignore is no longer a plate.
- **Per-phase M9 skill gap, tend and claim separated.** Every pair now starts
  from the same state, the phase's entry (tapper run to the phase boundary), and
  stops when the phase ends, so the gap is that phase's alone (was cumulative
  exit time, diluted by the coast). The tend pair (tends under 15% vs under 55%,
  both claim) is scored; the claim pair (same tending, ignores vs takes bonus
  windows) is reported as "claim gap", not scored.
- **New M15 Chore rate** (weight 4, taken from M2 and M4, 2 each): non-tap clicks
  per active minute per phase, band 0.3-4, gate at most 8 a minute and a busiest
  minute of at most 20.
- **Idle bot presses no button** outside the last phase (where the ending is the
  story). Its tap warm-up went from 5 to 8 minutes per phase (the doc's literal
  idle was already generous) so it does not overshoot 4 h without the
  buy-oil crutch.
- **M10 last reads the flame** (the watched number), not income: slope in share
  of full per minute (band -0.04 to 0.05), gate on slope above 0.08 or the flame
  sitting full more than 20% of the time.
- The skill bots, the oil bots and the engine now know a click is only worth
  making if it buys a real share of the tank (40%, or 25% when the lamp is
  dry); no bot mashes for one more drop.

**Re-score, instruments only (the old game, before any change):** 59.0 capped,
**75.0 uncapped** (round 1: 76.6). New failures that were hidden before: M15
coast **6.3 clicks a minute, busiest minute 57** (the barrel mash the reviewer
saw), M10 last (income plateau 87% when the flame is not read), M11 (idle without
the oil button needs 5.7 h).

### B. Windows that wait, and one-click oil

- **Oil: found the real cause of the shrinking barrel.** The engine takes an
  action's cost and then runs `perform`, which recomputed the barrel from the
  coins that were _left_, so you paid for N and got far less. `perform` now
  receives `paid` and buys exactly that. A barrel fills the tank or is as much
  as the coins pay for; the 60% coin cap is gone.
- **Rush and flare persist until claimed**, no new one starts until then
  (the timer starts when you claim), worth 25 s of income (was 40), and the 3x
  rush strain is gone. The cooldown is rolled in the action, so ignoring costs
  nothing but the bonus.
- Balance the grid and Send a correction unlock below 75% (was 95%).
  Their M9 low zone is 5-50% (was 5-60%).
- Floors softened for kids and the idle gate: lamp dim 0.7 (was 0.5), grid
  floor and fleet pace floor 0.6 (were 0.4 and 0.35); strain and drift run
  about 1.6x faster so the dial is still watched. Coast costs x1.1 (the oil fix
  made it 3 minutes quicker and the coast reveal pacing test caught it).

### C. The Last Light, rebuilt as "The first ship comes home"

- **Energy is gone from the last phase.** The **flame** (0-1000, shown as a
  percent) starts at 600, set not carried. Each light fades it, so the flame
  falls to a low steady glow while you tap it and climbs as lights go out
  (taps add 16, a share fades each second: lights + 3 "of the dark").
- **Tapping matters, gently.** Resolve (the currency lights cost) flows at
  0.75-1x by flame warmth, plus 0.06 a tap. A player who barely taps takes about
  30% longer (tend gap), never stops.
- **Order is a real choice.** Eleven lights, three on offer at once, in any
  order, each with a different gift: a slower fade (porch, bridges, campfires,
  sun collectors), a burst of flame (signs, towers, festival, the last stars),
  or taps worth more (stadium, harbor, moon). Every light let go also makes the
  next 16% easier. "Any order is a good order" is now true (the story said it
  was and the old shop forced one order).
- **The first ship, logged.** The coast notes the second and the weather of the
  very first ship (`firstShipAt`, `firstShipStorm`); the sea shows it under the
  boat ("The first ship: 0:03, a calm night").
- **At three lights left** the sea and a small boat with one lantern appear. It
  drifts (0.6% a second), pace is 30-100% by how true it is, and **Tap the old
  beam** steers it (+45). The boat is never lost.
- **The ending is the game's first action.** With one light left and the boat at
  the edge of the dark, **Flash the lamp, once** appears: a gold flash, the boat
  turns for home, **Ships guided: 1**, then the ending (4.5 s later so the moment
  plays). The ending echoes the coast hello: "Click. The lamp is lit."
- Scene: flame size follows the flame, a low beam reaches for the boat (bright
  when true), a reduced-motion safe flash and turn. Story: `last-choice`,
  `last-quiet`, `last-remember` and `last-end-2` changed; narration regenerated.
- Costs: the let-go costs are x1.2 the old ones and each light eases the next;
  the phase is 20 minutes (was 19).

### Before and after

| Metric                | Round 1 as scored | Instruments only | Round 2 final | Notes                                                             |
| --------------------- | ----------------- | ---------------- | ------------- | ----------------------------------------------------------------- |
| Total (capped)        | 59.0              | 59.0             | 59.0          | still 8 gates                                                     |
| Total (uncapped)      | 76.6              | 75.0             | **81.9**      |                                                                   |
| Failing gates         | 9                 | 12               | 8             | M1 x3, M3 x4, M4 sky                                              |
| M1 Reveal cadence     | 8.5               | 8.5              | 8.5           | coast 320 s, night 250 s, sky 240 s gaps                          |
| M2 Decision density   | 7.1/12            | 5.9/10           | 5.7/10        | weight 12 to 10                                                   |
| M3 Goal queue         | 1.3               | 1.3              | 1.7           | coast and last now at 94% and 88%                                 |
| M4 Felt effect        | 8.5/12            | 7.1/10           | 7.1/10        | sky median effect 7%                                              |
| M5 Purchase rate      | 6.0               | 6.0              | 6.0           |                                                                   |
| M6 Wait ratio         | 8.8               | 8.8              | 9.2           | sky p95 151 s, gate clear                                         |
| M7 Plates (attention) | 4.9               | 5.2              | 5.8           | peaks of 3 in every phase                                         |
| M8 Novelty            | 7.0               | 7.0              | 7.0           |                                                                   |
| M9 Tension            | 4.3               | 4.3              | **5.7**       | per phase now; last is a real number                              |
| M10 Smoothness        | 3.5               | 2.8              | 3.7           | last reads the flame                                              |
| M11 Active vs idle    | 5.6               | 4.4              | 6.3           | idle 3.43 h, ratio 1.76x                                          |
| M12 Dead time         | 2.6               | 2.6              | 2.7           | sky longest 180 s                                                 |
| M13 Prestige          | 5.0               | 5.0              | 5.0           | 0.66 and 0.78                                                     |
| M14 Length            | 3.5               | 3.5              | 3.6           | 1.95 h                                                            |
| **M15 Chore rate**    | n/a               | **2.5/4**        | **4.0/4**     | coast 6.3 to **0.75** clicks a minute, busiest minute **57 to 2** |

Per phase: coast 84% to 86%, night 83% to 84%, sky 72% to 78%, last 68% to 80%.
Phase lengths 35, 29, 34, 20 minutes. Finish: tapper 1.95 h, realistic 2.30 h,
idle 3.43 h, run 2 1.29 h, run 3 1.00 h.

M9 gaps now (per phase, same starting state): coast 4.4% (oil), night **3.5%**
tend, **13.4%** claim, sky **2.7%** tend, **5.8%** claim, last **29.6%** (tapping).
Chore rate: coast 0.75 a minute, night 0.7, sky 0.5, last 0.05.

### What moved and what did not

- **Moved**: the oil mash is gone (cause was the engine, not the bot); the last
  phase is the best-scoring after coast and night instead of the worst by a long
  way; M9 is honest and per phase; idle is a real, button-free player at 1.76x.
- **Did not move**: tending a dial still barely matters. The honest tend gaps
  are 3.5% (night) and 2.7% (sky) against a 5-25% band, and the claim gap (13%
  night) is worth more than tending. Raising the cost of ignoring (lower floors)
  buys a 7% gap but pushes idle to 3.85 h, and the kid-safety rule said no.
  Reveal gaps (M1) and the dawdler goal queue (M3) are untouched from round 1.
- Tuning surprise: making the barrel honest and removing the cap made oil
  trivially cheap in clicks; the coast came out 3 minutes quicker and a pacing
  test had to be answered with x1.1 costs.

### Open questions for the reviewer

1. Is a tend gap of about 3% acceptable if the dial is mostly about the
   feeling (a flickering city, a drifting probe) rather than income? If not,
   what makes tending matter without a tax on ignoring it?
2. The flame is the watched number but it only costs time (30% slower for a
   non-tapper). Is that enough, or should a low flame darken the scene?
3. Is the first ship's log moment too small? It is nearly always "0:03, a calm
   night". An opening that makes the first ship rarer (a storm, a minute in)
   would make the echo mean more.
4. M3 and M1 need a design answer (teaser goals, more story beats in the
   300 s coast gap) rather than numbers: the cap stays at 59 until all 8 gates
   clear.
5. Bold: let the player name the first boat, or pick which lantern it carries.

### Decision

Keep. Scorecard floors raised to 57 and 79 (new score minus 2). Next round:
close the 8 gates (reveal beats in the three long gaps, teaser goals for the
dawdler), then a playtest with Gentry on the new last phase.

## Round 2: reviewer retro (Opus)

**Player feel**

- **Coast:** the first 10 minutes are lovely. 10:31 to 20:41 is the flattest stretch in the game: one scene beat in 10 minutes, and purchases are mostly keepers at 3–9% each ("keeper, keeper").
- **Night:** good. The news ticker carries it, and the 13% claim gap shows the rush matters.
- **Sky:** a strong opening. From 75:41 on, probe, copy, engines and nav each read as about 0%, because they pay off later. From 90:35 to 97:24 the tapper's shop is empty (18.6% of sky samples have nothing visible). This is the real cause of the sky problems.
- **Last:** the arc lands ("Nobody says thank you" on the coast, then "A child at the bow waves"). Problems:
  - The let-goes tick like a metronome, one about every 110 s.
  - The flame sits at 92–97% from minute 10 on.
  - The last 3:20 is "steer while waiting for resolve", so a timer gates the climax.
  - The first-ship log always reads "0:00, calm night" (tick.ts:171).

**Real or measurement artifact**

- **M3 is mostly an artifact.** All 201 of the dawdler's "no goal" samples had an affordable meaningful buy on screen.
  - **Fix:** in score.ts:314-319, gate on goals + affordable ≥ 1, and keep the 2–4 band on goals.
  - **Add a gate:** fail if nothing at all is visible for more than 3% of the time. The tapper's empty sky shop is real.
- **M1 is mostly real.** Story beats already count (sim.ts:264), and coast 10:31–20:41 and sky 70:51–74:51 are genuinely quiet.
  - Count the first purchase of a scene-changing upgrade as a beat.
  - Count a teaser once, on first sight, and only if it is visible for at least 30 s before it unlocks.
  - Keep the 180 s gate.
- **M4 sky is half artifact.** Probe, copy, engines and nav compound, while sim.ts:172 and :382 read income at the instant of purchase.
  - **Fix:** effectRatio = max(instant ratio, 60 s forward ratio against a no-buy clone).
  - **The real half:** collectors at 5% each across 10 levels (upgrades.ts:565).

**Round 3, in priority order**

1. **"Visitors" mini-events and "someday" teasers.**
   - Visitors are gentle one-off arrivals, unlocked by milestones and never by timers. Each waits until tapped, gives a small gift, and goes in a logbook where nothing can be missed:
     - coast: a mail boat (about 12 min) and whale-watchers (about 18 min);
     - night: a town fair;
     - sky: a comet, then a strange signal.
   - Teasers: relay-2 and relay-3 (upgrades.ts:650, :655) shown greyed from the start with a hint ("when 700 stars are left"), plus a star-countdown bar.
   - Expected: M1 gaps under 180 s, the M3 tapper sky gap closed, M12 sky from 0.50 to about 0.85.
2. **Tending pays a bonus instead of a tax.**
   - Keep the 0.6 floors.
   - A "steady glow" of +15% while the grid or heading stays above 90%, shown as cities sparkling or probes in formation.
   - Expected: tend gap from 3.5% / 2.7% to about 8–10%, idle/tapper about 1.9x.
   - Sky felt effect: collectors become 6 bigger steps, with a "mirror field" scene at 3 and 6. Expected median ≥ 10%.
3. **The boat drives the climax.**
   - Once the boat appears, a true heading earns resolve (1.5x when true, never below 1x), so the last two goodbyes come about 40% faster for a player who steers.
   - When the flame is low, the sky dims visibly. This is feedback, not a loss.
   - At the start the kid picks one of 3 lantern colours, with no text input and stored locally only. The final boat carries that lantern, which replaces the meaningless timestamp.

**Kid-safety**

- **Passes:** rush and flare wait until claimed, oil is honest, there are no streaks, away-timers or monetisation, the boat can never be lost, and Balance only shows below 75%.
- **Watch:**
  - The "NEWS: ..." and "sleeping badly" lines are slightly eerie, which is fine for 8 and up.
  - Letting lights go may read as sad, but the ending resolves it warmly.
  - Keep the colour pick out of trackGame (gameplay analytics).
  - Visitors must never become a collection you can miss: no rarity tiers, no "only today".

## Round 3 (2026-11-01): visitors, a steady glow, a lantern of your own

Hypothesis from the round 2 retro: the engagement problems are mostly a lack of
things to look forward to and a tending dial that only taxes. Give the player
arrivals and visible "someday" goals, pay for tending instead of taxing its
neglect, and let the ending's boat be something the player had a hand in. Fix the
ruler first, then the design.

### 0. Instruments

- **M3 gate** now reads "something to want": goals (teasers included) plus the
  meaningful buys already affordable, at least 95% of the time. The 2-4 band
  still counts goals only. All four M3 gate failures went away; as the retro
  said, they were an artifact (every "no goal" sample had a buy on screen).
- **Empty-shop gate** (in M12, read from the tapper): the shop with no upgrade
  and no teaser at all may not exceed 3% of samples. It caught a real hole: 19%
  of the sky samples, and later a 2-minute tail after the last relay.
- **M1 beats.** A teaser counts once, on first sight, and only if it stood on
  show 30 s or more before its upgrade popped in; a visitor counts on arrival.
  Teasers are "soft": they count only when 30 s clear of the beat before them.
  I tried also counting later steps of a scene-changing repeatable (the 6th
  keeper) as soft beats, saw it filled the coast gap by itself, and **reverted**
  it: the existing rule already counts the first purchase of a scene-changing
  upgrade (sim.ts), so the retro's instruction was already met, and counting
  every keeper was padding.
- **M4 forward effect:** effectRatio = max(instant, ratio against a no-buy clone
  after 60 s). Honest result: it moved little. Probe, copy, engines and nav still
  read about 0% because the fleet needs minutes, not one, to compound. The sky
  median effect only went from 7% to 12% after the collectors change below.
- Instruments only, old game: **59.0 capped / 81.9 uncapped**, 5 gates (M1 x3,
  M4 sky, M12 sky).

### 1. Visitors, "someday" cards, star countdown

- **Visitors** (`UniverseDef.visitors`, light/visitors.ts): a mail boat (6
  keepers, about 12 min), whale-watchers (8 keepers), the town fair (4 river
  dams), a comet (4 collectors), a strange signal (stars under 970 with a probe
  out). Milestone-gated, never timed; each waits on a retro card above the story
  until the player taps Say hello, gives a gift worth 15 s of the phase's
  income (whales: a full oil tank, fair: a steady grid, signal: a true course),
  and goes in the **Logbook** at the top of the Menu. No rarity, no expiry. A
  visitor ignored into a later part still pays its gift in that part's currency.
  The visitor's line is a real story message, so it is narrated.
- **Someday cards** (`UniverseDef.teasers`): greyed dashed cards with a hint
  ("When 700 stars are left"), going away when the upgrade pops in. One at the
  end of the sky points at the next part ("Something quiet, after the last
  star"), which closes the two empty minutes after the last relay.
- **Star countdown bar** in the sky: stars left, 20 segments, ticks at 700 and
  350 where relays wake.
- More story beats (8 lines) to close the remaining reveal gaps, all short and
  kid-safe. Bot greetings: tapper after 4 s, dawdler after 60 s, idle never.
- Score after: 83.9 uncapped; gates left: M4 sky only.

### 2. Steady glow, six collector steps, mirror field

- **Steady glow:** while the grid (night) or the fleet's heading (sky) is at
  least 75%, cities pay +15% / the fleet takes stars +15% faster; the cities
  sparkle and the probes fly in formation (brighter, with a ring). Below 75% you
  lose the bonus and nothing more; the old 0.6 floors are untouched. The 75% line
  is the one the "steady" button text already used: tending the moment the
  button shows keeps the glow. (The retro said 90%; that needs a click about
  every 20 s, a chore, so I used 75.)
- **Collectors:** 6 levels worth 10/6 each (same total as the old 10), cost
  growth 1.6. The scene grows a **mirror field** on the ground, 6 mirrors at 3
  collectors and 12 at 6.
- Price check: the glow and bigger steps made night and sky quicker, so costs
  are scaled per phase (`TUNING.costScale`), keeping the run near two hours.
- **Sky income plateau:** after the collectors change, 29% of sky windows were
  flat (gate 20%). Fix: the mirrors are cheaper and ordered so the bot buys
  them between the probe items (bots prefer what pays now), and the opening
  aim and collector keep their price. Plateau 14%.
- Bots: the tapper and the careful tender now tend at 74% to keep the glow
  (they used to wait for 45% and 55%); the tender pair gap is therefore
  against a naive tender at 15%.

### 3. The boat, the dimming night, a lantern of your own

- **Steering earns resolve:** while the boat is out and sailing, letting go is
  1.5x as fast at a true heading (80%), fading to 1x at 40% and never below.
  The Tap the old beam card shows "letting go 1.5x faster" when true.
- **A low flame dims the night:** below 45% the far lights and the water fade
  (down to 30%). Feedback, not a loss.
- **Lantern pick:** the opening screen of a run has a three-way pick (Gold, Sea,
  Rose; labelled, so colour is never the only cue). Stored in the save on this
  device only (`resources.lantern`, no text, never in `trackGame`). The final
  boat carries that lantern's glow. The first-ship timestamp is gone.
- `last-quiet` changed (boat carries "the colour you chose"); 14 clips
  regenerated, 0 removed.

### Before and after

| Metric              | Round 2 final | Instruments only | Round 3 final | Notes                                                       |
| ------------------- | ------------- | ---------------- | ------------- | ----------------------------------------------------------- |
| Total (capped)      | 59.0          | 59.0             | **85.2**      | no gate fails, so the cap is gone                           |
| Total (uncapped)    | 81.9          | 81.9             | **85.2**      |                                                             |
| Failing gates       | 8             | 5                | **0**         | M1 x3, M4 sky, M12 sky before the content                   |
| M1 Reveal cadence   | 8.5           | 8.5              | 9.3           | max gap 320/250/240 s to 170/146/166 s                      |
| M2 Decision density | 5.7           | 5.7              | 5.7           | untouched: 68-79% of time with nothing affordable           |
| M3 Goal queue       | 1.7           | 1.7              | 2.1           | gate now "something to want"; band 2-4 goals at 70%         |
| M4 Felt effect      | 7.1           | 7.2              | 8.4           | sky median effect 7% to 12%                                 |
| M5 Purchase rate    | 6.0           | 6.0              | 6.0           |                                                             |
| M6 Wait ratio       | 9.2           | 9.2              | 9.0           |                                                             |
| M7 Plates           | 5.8           | 5.8              | 6.2           | still peak 3, never 4                                       |
| M8 Novelty          | 7.0           | 7.0              | 7.0           |                                                             |
| M9 Tension          | 5.7           | 5.7              | 5.3           | night tend gap 3.5% to **10.4%**, sky 2.7% to 5.6%          |
| M10 Smoothness      | 3.7           | 3.7              | 3.4           | the diligent tapper keeps the dial high, so "low" time is 0 |
| M11 Active vs idle  | 6.3           | 6.3              | 6.3           | idle/tapper 1.76x to **1.91x**                              |
| M12 Dead time       | 2.7           | 2.5              | 3.7           | longest 180 s to 110-160 s; empty shop 0%                   |
| M13 Prestige        | 5.0           | 5.0              | 5.0           | 0.66 and 0.78                                               |
| M14 Length          | 3.6           | 3.6              | 3.8           | 1.95 h to 1.98 h                                            |
| M15 Chore rate      | 4.0           | 4.0              | 4.0           | night rises to 1.1 clicks a minute, busiest minute 3        |

Finish: tapper 1.98 h, realistic 2.44 h, idle 3.79 h (gate is 4 h), run 2 1.31 h,
run 3 1.02 h. Phases 36, 30, 31, 22 minutes. Scorecard floors raised to 83
(capped) and 83 (uncapped).

### What moved and what did not

- **Moved:** every gate. The reveal cadence is real content now (visitors,
  someday cards and eight story lines) rather than a different way of counting.
  Tending pays: the night tend gap is 10% inside the 5-25% band, idle/tapper is
  1.91x. The shop is never empty.
- **Did not move:** M2 and M7, the two biggest losses (4.3 and 3.8 points). The
  player almost never has a real choice on screen (68-79% of the time nothing
  meaningful is affordable) and the plates peak at 3. Round 3 did not touch
  them. Also the probe chain still reads as about 0%: the sky's income plateau
  was fixed by ordering the mirrors, which is a bot-behaviour fix, not a change
  to what the player feels in minutes 10 to 20.
- **Honest risks:** (1) the tapper bot tends at 74% now, so M9 "low time" for
  night and sky is 0%; a human may tend less. (2) The 30 s soft-beat rule and the
  teaser counting are my reading of the retro and are generous: 7 teasers
  were seen, 2 of them are beats of their own. (3) Cost scales (night x1.16, sky x1.35) were set to
  keep the length, not from a playtest.

### Open questions for the reviewer

1. M2 and M7 are the big levers. Is the answer fewer, bigger purchases with
   real either-or choices (and a fourth plate), or are they simply the wrong
   metrics for a game this gentle?
2. Does the 75% glow line read as "worth looking after" to a child, or is the
   bonus too quiet to notice? The scene shows it, but nothing says "glow" outside
   the action card.
3. Visitors are 5 arrivals in 2 hours. More, or are they better rare?
4. The sky's middle (probes copying) is still a quiet stretch of the score.
   Should a probe milestone, a visitor or a scene beat live there?
5. Bold: let the lantern colour tint the lighthouse beam too, or name the boat.

### Decision

Keep. Next: a playtest with Gentry (the visitor card, the lantern pick, the
ending), then M2 and M7.

## Round 4 (2026-11-01): less clicking, a Paperclips-shaped click curve

Branch `feat/eo-less-clicking`, on top of 1.11.1 (the side machines: Tide
Clock, Weather Desk, Probe Races, Memory Garden).

### Playtest note (ground truth)

Gentry, v1.11 on his iPhone:

> One thing we have to fix: this game is just clicking. In Paperclips in the
> beginning you have to click, like the beginning of each phase you have to
> click, but pretty soon the automations or the helpers get you going, and
> clicking would only be if you kind of got stuck. Way too much clicking.
> There's just way too much.

The score agreed once read honestly. Old M11 reported a manual share of 97%
early, 48% at minutes 10-20 and 23% late, and its bands _rewarded_ that
(20-50% at minutes 10-20). The tapper bot tapped 3 times a second for two
hours, which hid how much every phase leaned on it.

### Hypothesis

The clicking is structural, not a number: tap upgrades (lens 6x, crank 11x,
aim 6x) outpaced the helpers, the first helpers paid back slowly (a first
generator took 5 minutes to pay for itself), and each side machine's helper
came at the end of its life. Make tap upgrades small, make helpers cheap and
early, move side-machine helpers to mid-life, and make the chores longer
decisions. Expect each phase to open hands-on (taps most of the income for
2-4 minutes) and the helpers to carry it from minute 5-6.

### Measurement changes (commit 1)

- **Human-shaped bots** (`engine/bots.ts`). The primary "tapper" is now an
  _eager_ player: 3 taps a second for the first 3 minutes of a phase, easing
  to 1 a second by minute 6. The realistic bot _taps when it helps_: hard for
  the first 2 minutes of a phase and whenever 3 taps a second would be at
  least 40% of income, a nudge every 5 seconds otherwise. Its taps per minute
  late in a phase are the game's doing, not the bot's, so they are scored.
  The idle bot taps the first 4 minutes of every phase (the hands-on opening)
  and never again (it used to tap 10 minutes, then 8, then all of the last).
- **Trace**: `TraceSample.sinceEntry` (seconds into the phase);
  `tapAndAuto(def, run)` in `sim.ts` (one tap's gain against the machines'
  income, side-machine payouts excluded, as before).
- **`engine/clicks.ts`**: `clickCurve(run)` turns a traced run into per-phase
  minute buckets (manual share, taps a minute, other clicks a minute) and the
  early (min 0.5-3) and late (min 6 on) means. The score script prints both
  bots' curves.
- Fixed a silent bot bug: the last phase's naive tender set `tapsPerSecond`,
  which the base's `tapRate` overrides, so "naive" was the eager bot.

### Score recalibration (commit 2)

- **M11 is now the Click curve** (weight 7 to 10; M5 6 to 5 and M8 7 to 5,
  both saturated at 1.0 for four rounds). Per phase: taps >= 60% of income at
  minutes 0.5-3 (fails at 30%; not the ending, which opens on the flame, not
  a tap's income); the eager player <= 12% from minute 6 on, **gate 20%**; the
  tap-when-it-helps player <= 20 taps a minute from minute 6 (fails at 60); a
  tap always earns (never-stuck). The run row keeps idle/eager finish, now
  banded 1.1-1.6x with a gate of idle within 4 h and never quicker than the
  eager player: with helpers carrying each phase, idle and active converge,
  so the old 1.25-2.5x band rewarded a game that needed hands.
- **M15 Chore rate** band 0.3-4 to 0.3-2.5 non-tap clicks per active minute
  (gate 8 to 5), busiest minute 10 to 6 (gate 20 to 12): one decision every
  half minute at most.
- As expected the total dropped: the 1.11 build scores **59.0 capped, 79.5
  uncapped** on the new card, with eight failing gates (M11 coast, night,
  sky and run; M1 coast and sky; M10 night and sky). The scorecard floor
  went to 59 / 78 for that commit.

### Tuning (commit 3)

- **Tap upgrades stop outpacing helpers.** The lens (5 to 3 levels) now helps
  the keepers' flashes as much as yours (`lensAutoBonus` 0.1 to 1). The crank
  is 2 levels of +0.5 (was 5 of +2); the aim 3 levels of +0.25 (was 5 of +1).
- **Helpers cheap and early.** Keeper 480 to 88 base (about 295 coins in the
  shop); first generator 3 to 8 MW and 559 to 105 base, the grid shows at
  16 MW; steam plants 1,430 to 360 base, after 3 generators (was 5), up to 7;
  dam 9,000 to 4,500, wind farm 85,000 to 45,000; collectors 432 to 122 base,
  growth 1.6 to 1.45, 10 steps (was 6); first probe 1,430 to 571 after 4
  collectors; copy-1 1,460 to 460.
- **Side-machine helpers at mid-life.** Tide mill after two hauls (was three
  lighthouses), 30,000 to 8,000. Weather vane after two fronts, no longer
  behind storm crews and two wind farms, 15,000 to 4,000. Racing fins after
  one run (no relay needed); mission control 6,000 to 3,000. Rain barrel
  after three picks, ranked with the lights and listed ahead of them (three
  lights are always on offer, so it never got a slot before). Smart grid at
  four steam plants (was a dam), 40,000 to 9,000. Hand-tending still pays
  more than any helper alone (the existing tests hold).
- **Chores as occasional decisions.** Probe trips about twice as long and
  twice the haul (short 75 s, long 180 s, comet 110 s; the comet's card moves
  in 4 s steps); watered plants stay wet 100 s (was 40), the can rests 40 s;
  grid strain 0.35+0.7 to 0.2+0.4 %/s; fleet drift 0.28+0.24 to 0.16+0.14.
- **The flame is a top-up, not a mash.** A tap brings 15% of what is
  missing (was a flat 16 of 1,000) and the flame fades at 0.003 a light (was
  0.01), so a tap every few seconds keeps it warm and an eager tapper can't
  hold it full. The "taps" gifts add resolve per tap, not warmth.
- **Length and dead air.** Each phase's prices went up (`costScale` coast
  1.14 to 3.35, night 1.18 to 2, sky 1.35 to 1.9) with the opening purchases'
  base costs cut to match, so the openings keep their prices. The first
  lighthouse is cheaper with steeper growth (3,700 at x2.15, was 7,380 at
  x1.9). The oil tank and storm shutters show at a second lighthouse and the
  fish market after the crew drills, so the cheap, big steps are not hidden
  behind them (three shop slots). The race plate counts from the first probe
  home (trips are now over a minute).
- The lens card shows coins a second once there are keepers.

### Before and after

New card (the measure for this round):

| Metric              | 1.11 build                        | Round 4            | Note                                          |
| ------------------- | --------------------------------- | ------------------ | --------------------------------------------- |
| M1 Reveal cadence   | 7.5 FAIL                          | 7.4                | longest gap 300 s to 170 s                    |
| M2 Decision density | 5.9                               | 6.5                |                                               |
| M3 Goal queue       | 1.7                               | 2.2                |                                               |
| M4 Felt effect      | 9.3                               | 9.0                |                                               |
| M5 Purchase rate    | 4.9 / 5                           | 5.0 / 5            |                                               |
| M6 Wait ratio       | 9.0                               | 9.0                |                                               |
| M7 Plates           | 7.9                               | 8.1                |                                               |
| M8 Novelty          | 5.0 / 5                           | 5.0 / 5            |                                               |
| M9 Tension          | 5.2                               | 5.3                | last-phase tend gap 8.3% (honest now)         |
| M10 Smoothness      | 2.3 FAIL                          | 3.6                | night and sky plateaus 28% / 26% to 11% / 17% |
| M11 Click curve     | 4.2 FAIL                          | 10.0               | see the curves                                |
| M12 Dead time       | 3.7                               | 3.9                |                                               |
| M13 Prestige        | 4.8                               | 5.0                | run2/run1 0.65, run3/run2 0.77                |
| M14 Length          | 4.0                               | 3.9                | eager 2.42 h to 1.99 h                        |
| M15 Chores          | 4.0                               | 4.0                | 1.1-1.6 non-tap clicks a minute               |
| **Total**           | **59.0** (79.5 uncapped, 8 gates) | **87.8** (no gate) |                                               |

Old card (old M11 bands and the always-tapping bots): the 1.11 build scored
**83.8**; the Round 4 build scores **84.9 uncapped**, capped at 59 by one
200 s night reveal gap that only the 3-taps-a-second bot sees. Its M11 falls
from 6.2 to 5.6 because it penalises a 12% manual share at minutes 10-20.

Manual share of income (percent) by minute of each phase, before and after.
Eager player (3 taps/s, easing to 1/s by minute 6):

```
before coast  100100 96 89 86 70 71 66 60 54 54 54 64 47 47 50 50 61 44 44 44 44 58 29 26 24 22 37 21 20 31 19 10 10  9 13  6 ...
after  coast  100100 78 55 36 25 30 19 14 14 12  8 15  5  5  5  5 12  2  2  2  2  4  2  1  1  1  1  1  1  0  0  0  0  0
before night  100100 99 96 94 89 84 80 79 76 75 54 39 36 33 27 27 22 23 22 19 12  8  5  4  3  2  2  2  2  2  2  2  2  1  1
after  night  100 71 71 57 46 28 14 11  8  6  5  4  4  3  3  3  3  3  1  1  1  1  0  0  1  0  1  0  0  0  0  0
before sky    100100 97 84 76 65 60 64 56 55 48 44 39 39 35 34 34 33 27 27 27 26 26 26 23 23 20 17 16 14 11 10 10  8  7  5  4  3  3
after  sky     94 68 49 41 32 19 15 15 15 13 12 12 10  8  6  6  6  6  5  5  5  4  4  3  3  3  3  2  2  2  1  1  1
before last    18 18 17 14 11  7  5  6  6  6  5  5  6  6  5  5  5  5  4  4  3  3  3  4
after  last    16 16 14 13  9  6  5  5  5  5  5  5  5  5  5  4  4  4  4  3  3  4
```

Taps when it helps:

```
before coast  100100 96 90 83 82 88 80 73 74 73 71 77 54 50 48 43 57 26  2  2  2 23  1 ...
after  coast  100100 78 57 41  4 29  9  3  3  3  2 23  1  1  1  1 20  0  0  0  0  1 ...
before night  100100 99 98 96 95 92 86 73 65 61 58 55 47 53 45 45  4  1  1 ...
after  night  100 71 71 60 59 47  3  3  2  1  1  1  1  1 ...
before sky    100100 97 86 87 80 77 75 68 65 61 61 55 52 52 52 50 47 14  4 ...
after  sky     94 68 49 44 27  4  3  3  3  3  3  3  3  2 ...
before last    18 18  1  1  1 ...
after  last    16 16  1  1  1 ...
```

Late in a phase (minute 6 on):

| Phase | Manual share, eager | Manual share, when it helps | Taps a minute, when it helps |
| ----- | ------------------- | --------------------------- | ---------------------------- |
| coast | 30% to 6%           | 27% to 4%                   | 82 to 21                     |
| night | 25% to 3%           | 25% to 1%                   | 79 to 12                     |
| sky   | 27% to 6%           | 29% to 1%                   | 91 to 12                     |
| last  | 5% to 4%            | 1% to 1%                    | 12 to 12                     |

The player who taps when it helps used to hammer for about 17 minutes of
each of the first three phases; now for 4-6 minutes, then only in a storm.

Phase lengths (eager / when it helps): coast 48 / 38 to 34 / 35 min, night
36 / 34 to 32 / 37, sky 38 / 32 to 33 / 35, last 23 / 27 to 21 / 24.
Finish: eager 2.42 to 1.99 h, when it helps 2.19 to 2.18 h, idle 6.90 to
3.12 h (gate 4 h), run 2 1.29 h, run 3 1.00 h.

Side-machine helpers (eager bot, minute of the phase): tide mill 42 of 48
to 22 of 34 (clock open from 16); weather vane never bought to 18.5 of 32
(desk open from about 8); mission control 33 of 38 to 24 of 33 (races open
from 16); rain barrel 21 of 23 to 9 of 21.

Narration: no story text or phase intro changed, so no clip ids changed.

### What still feels clicky

1. **Oil.** 36-39 barrel clicks in a 34-minute coast (about one a minute).
   It is a real decision (price) but the most frequent button left; the oil
   contract (merchant) still comes late. Next: a bigger tank earlier, or the
   contract at the second lighthouse.
2. **Storms** make taps worth 3x for 25 s, so the tap-when-it-helps player
   still hammers in storms (the coast's 23% / 20% spikes, 21 taps a minute
   late, just over the band). That is the "burst of active value" the
   research asked for; keep it unless Gentry says otherwise.
3. **Garden picks** (17-18 in a 21-minute ending) and the grid (14 balances
   for the eager bot in the night) are the next chores to stretch.
4. The eager bot's 60 taps a minute late are an assumption; the curve says
   those taps are worth 3-6%, which is the point, but a real child may still
   tap from habit. Watch for it in the playtest.

### Decision

Keep. Floor raised to 86.8 (87.8 minus 1). Next: a playtest with Gentry on
the phone, watching for whether each phase's opening still feels like play
and whether the helpers' arrival is visible enough to notice the hand-off.

### Review fixes (after PR #468)

- **Unreachable beats.** The lens cap dropped from 5 to 3, but `coast-lens`
  wanted lens 5 and the lighthouse teaser wanted lens 4. They now need lens 3
  and 2 (the story text is unchanged, so no clip changes). `roundFour.test.ts`
  scans every `owned(run, "x") >= n` in the universe for an upgrade that
  exists and an `n` within its cap.
- **Old saves above today's caps** (lens 5 to 3, crank 5 to 2, aim 5 to 3).
  On load, `reconcileRun` clamps owned levels to `maxLevel`. In the
  upgrade's own phase it refunds what the extra levels cost, at today's
  prices in that phase's currency; outside it, the levels are only clamped.
  A second load gives nothing more, and nothing goes NaN.
- **M11 honesty.**
  - The never-stuck floor is real again: 3 taps a second must earn at least
    0.5% of income at the phase's lowest point (gate 0.25%). It is read at a
    fixed pace, so a lazy bot can't fail it and an eager one can't pass it
    by tapping harder.
  - A phase under a minute is read whole, never as a vacuous pass. A missing
    early share scores 0.
  - The early-hands-on check is now also a gate (taps >= 30% at minutes
    0.5-3, the ending excepted).
  - The idle/eager gate is back at 1.05x (the build is at 1.57x).
- **Regression fixtures.** A build fully automatic from minute 1 and a build
  where a tap earns nothing both fail the M11 gate (total capped at 59).
- **Score.** 86.8, with no failing gate. The coast and night bottom out at
  0.43% and 0.33% at 3 taps a second, inside the gate but under the band;
  that is left honest rather than tuned away. Floor 85.8.
- **Tests added.**
  - The four side-machine helpers appear under their new gating and still
    pay less than tending by hand. The rain barrel test uses real picks.
  - A tap on a full flame still earns resolve, so the tap button shows its
    "+" floater.

## Make It Grow, round 1 (2026-11-01): long enough, no failing gate

Universe 2 ("grow"), branch `feat/make-it-grow`, on top of Tasks 1-15 and 17
(817f2847). The first tuning pass over the whole universe. Light's scorecard
is byte-identical before and after (minus the `Runtime:` line).

### Round 0: baseline

`npm run score:ever-onward -- grow`: **59.0** (capped from **76.0**), one
failing gate: M2 farm, 4+ options 17% > 15%. M14 1.61 h (band 2-3 h).

Phase lengths in minutes (yard / farm / world / seed):

| Bot            | Yard | Farm | World | Seed | Finish |
| -------------- | ---- | ---- | ----- | ---- | ------ |
| eager          | 31   | 24   | 31    | 12   | 1.61 h |
| when it helps  | 31   | 25   | 33    | 13   | 1.69 h |
| idle           | 53   | 32   | 40    | 19   | 2.39 h |
| target (helps) | 30   | 35   | 35    | 20   | 2-3 h  |

What the trace showed, phase by phase:

- **Farm.** Too quick (24 min) and crowded: the dawdler, shopping once a
  minute, kept 4+ things affordable 17% of the time. Wells and irrigation
  sat in the shop because its tank never actually ran dry (thirst grew only
  0.03 a helper, so it hovered just above empty: low 73% of the time).
- **World.** The shop emptied at minute 25 (the tenth sky seeder), then the
  player waited 5 minutes at the income ceiling for the 120M vault. The
  planet was fully green by then, so nothing grew.
- **Seed.** 12 minutes, and the pot was the only plate.
- **Prestige.** Run 2 / run 1 0.72 (band 0.50-0.70).

### Changes and hypotheses

One lever per phase, each scored on its own before the next.

1. **Farm helpers earn about 0.64x** (scarecrow 5 to 3.2, tractor 30 to 19,
   glasshouse 190 to 120, drone 900 to 580 harvest a second). Hypothesis:
   the farm stretches toward 35 min with the same shape, the dawdler holds
   fewer things at once (M2), and taps carry the opening longer (early
   taps were 55%). Result: farm 24 to 37 min (eager), M2 4+ 17% to 14%, M11
   farm early taps 55% to 68%. Keep.
2. **A thirstier farm with stronger wells** (thirst per helper 0.03 to 0.045,
   well seep 0.12 to 0.18). Hypothesis: the tank matters, so the dawdler
   builds its wells instead of leaving them in the shop. Result: M2 farm 4+
   14% to 9%, low 28% (in band, was 73% at baseline). The tend gap stayed
   negative (below). Keep.
3. **World: more sky seeders, a cheaper vault, slower helpers** (sky seeder
   10 to 13 levels; vault 120M to 46M, so it comes in the same rhythm as
   the seeders instead of after a 5-minute wait; windbreak 40 to 30, rover
   300 to 225, seeder 2,400 to 1,800 green a second). Tried first: 13
   seeders with the vault at 150M. That made the tail worse (320 s of
   nothing, M12 gate) and was reverted. Result: world 31 to 38 min, M12
   world longest gap 170 s to 120 s, no wait at the ceiling. Keep.
4. **A hands-on world opening.** The first windbreak costs 3,000 green (was
   1,500). Early taps were 43% (51% after change 3). Result: 62%, and M11
   is 10/10. Keep.
5. **A slower pot with a deeper shop** (growth per care 0.00028 to 0.00009,
   dew collector 9 to 13 levels). Tried first: the slower pot alone. The
   shop emptied (13% of the time, M12 gate). With the extra dew levels the
   shop stays stocked. Result: seed 12 to 18 min (eager), 20 (helps). Keep.
6. **Deep roots +30% a level** (was +25%; the acorn's description says 30%).
   More acorns for finishing (12 or 14) changed nothing, because the
   cheapest-first spend bought the same set. Result: run 2 / run 1 0.72 to
   0.70, run 3 / run 2 0.76. Keep.
7. **Story timing (no text changed).** The longer phases stretched the gaps
   between beats, so I retimed some lines:
   - Farm lines `farm-time-4/9/5/10/6/7/12/8` now fire at 13, 15.5, 18,
     20.5, 23, 26, 29 and 31 min (they were at 12.5-24).
   - `farm-time-11` mentions a blinking drone, so it now waits for the
     second drone instead of 20 min.
   - Yard: `yard-mid` moves from 960 s to 930 s and `yard-late-3` from
     1740 s to 1680 s. Both yard gaps were 179 s, at the 180 s gate, and
     are now 149 s and 120 s.
   - Seed growth beats: sprout 0.03 to 0.015 (and `sproutAt` to match,
     so the scene's sprout appears with the line), sun 0.14 to 0.08, leaf
     0.22 to 0.18, curtain 0.4 to 0.33, waiting 0.85 to 0.8. The beats come
     every 1.5-2.5 minutes instead of bunching at the end.

   The story reach tests still pass.

8. **Tried and reverted: a careful bot that only buys storage when the tank
   is below half.** It is arguably more honest, but it ran the yard dry
   (empty 7%, a 26% M10 plateau gate) and the farm tend gap stayed
   negative. `bots.ts` is unchanged.

### Before and after

| Metric              | Round 0                 | Round 1  | Note                                        |
| ------------------- | ----------------------- | -------- | ------------------------------------------- |
| M1 Reveal cadence   | 5.8                     | 6.3      | max gaps 179/90/113/150 to 149/160/120/150  |
| M2 Decision density | 7.0 FAIL (farm)         | 8.8      | farm 4+ 17% to 9%                           |
| M3 Goal queue       | 1.0                     | 1.3      | seed still 16% (few cards)                  |
| M4 Felt effect      | 7.5                     | 7.3      |                                             |
| M5 Purchase rate    | 4.8                     | 5.0      |                                             |
| M6 Wait ratio       | 10.0                    | 10.0     |                                             |
| M7 Plates           | 6.0                     | 5.9      | worst metric now                            |
| M8 Novelty          | 4.8                     | 4.7      |                                             |
| M9 Tension          | 4.0                     | 4.1      | farm low 73% to 28%; tend gap -5.5 to -6.7% |
| M10 Smoothness      | 3.2                     | 3.4      |                                             |
| M11 Click curve     | 9.1                     | 10.0     | farm 55% to 68%, world 43% to 62% early     |
| M12 Dead time       | 3.2                     | 4.0      | every phase's longest gap now <= 120 s      |
| M13 Prestige        | 4.8                     | 5.0      | run2/run1 0.72 to 0.70                      |
| M14 Length          | 0.9                     | 4.0      | 1.61 h to 2.05 h (eager)                    |
| M15 Chores          | 4.0                     | 4.0      |                                             |
| **Total**           | **59.0** (76.0, 1 gate) | **83.9** | no failing gate                             |

Phase lengths after (minutes):

| Bot           | Yard | Farm | World | Seed | Finish |
| ------------- | ---- | ---- | ----- | ---- | ------ |
| eager         | 31   | 37   | 38    | 18   | 2.05 h |
| when it helps | 31   | 39   | 38    | 20   | 2.13 h |
| idle          | 53   | 50   | 50    | 31   | 3.07 h |

Idle / eager 1.50x (gate: within 4 h and never quicker than eager). Run 2
1.42 h, run 3 1.08 h.

Manual share of income (percent) by minute of each phase. Eager player:

```
before yard   98 73 45 35 21 16 12  8  4  3  3  2  3  2  1  1  1 ...
after  yard   98 73 45 35 21 16 12  8  4  3  3  2  3  2  1  1  1 ...
before farm   80 55 49 33 14  6  4  3  3  2  2  1  1  1  1  1  0 ...
after  farm   86 69 62 54 27 15  8 10  6  5  5  5  5  3  3  2  2  2  2  1 ...
before world  71 43 36 30 23 16  9  5  4  4  3  3  3  2  2  2  2  2  1 ...
after  world  87 63 53 44 36 25 20 20 18 17 17 15  9  6  6  4  4  4  4  3 ...
before seed   76 58 45 23 10  6  3  1  1  1  1  1
after  seed   76 58 45 23 10  6  3  1  1  1  1  1  0  0  0  0  0  0
```

Taps when it helps:

```
before yard   99 78 61 39  3  3  3  2  1 ...
after  yard   99 78 61 39  3  3  3  2  1 ...
before farm   80 58 49 26  2  1  1  1 ...
after  farm   86 69 62 57 21  3  2  2  1 ...
before world  71 43  4  3  3 13  3  3  2  1 ...
after  world  87 63 53 49 46 43 20  4  4  4  3 ...
before seed   76 58 41  3  1  1  1  0 ...
after  seed   76 58 41  3  1  1  1  0 ...
```

Every phase opens hands-on, and the helpers carry it from minute 5-6 for the
player who taps when it helps. One exception: the eager player's world stays
at 15-20% manual until minute 11. The mean from minute 6 is 5%, well inside
the 12% band.

### Retro (self-review, no reviewer this round)

- **What dragged:**
  - M7 Plates (5.9/10) is now the worst metric. The yard and farm open with
    too many plates (3+ in the first quarter: tap, water, the harvest or
    the market) and end with too few. The seed has only the tap and the
    pot. Fixing it means a mechanic (a late plate per phase), not a
    number.
  - M1 counts 34-41 beats per phase, against a band of 8-25. The time lines
    that hold the max gap under 180 s also crowd the median down to 30-40 s.
- **What blocked the loop:**
  - The farm tend gap (careful vs naive water) is -7% and noisy. The naive
    bot buys storage exactly when it runs dry, which on the farm is just in
    time. Being dry costs half the income for a few seconds, so buying
    early never pays. Either dry spells have to last (storage that fills
    slowly), or the metric needs a fixed fair seed so the ribbons' luck
    doesn't swamp a few percent.
  - The phase-length check reads the realistic bot directly in
    `grow/__tests__/scorecard.test.ts`. The scorecard's phase table is
    the eager bot.
- **Bold ideas for round 2:**
  - A late plate in every phase, for example an autumn market rush on the
    farm or a storm front on the world map, so the fourth quarter carries
    four plates.
  - A second thing for the seed to want (the window: open or closed) as its
    own plate.

### Decision

Keep. Floor set in `grow/__tests__/scorecard.test.ts` at **82.9** (83.9
minus 1), uncapped 82.9. The test also checks: no failing gate, the
realistic bot finishes in 2-3 h, the idle bot within 4 h and never before
the eager bot, and each realistic phase within 30% of 30/35/35/20 min.
Next: a playtest with Gentry (does the longer farm drag in the middle; does
the world's tail feel like an ending rather than a wait), then round 2 on
plates.

## Round 5 (2026-11-01): things to manage

Branch `feat/eo-things-to-manage`, on top of Make It Grow 1.14.0 (fa6eaa5b).
Prototyped on Keep the Light On's night ("No More Night").

### Playtest note (ground truth)

Gentry, on his iPhone, in the power grid phase of the first world:

> There's still a lot of dead periods in the game. I'm on the power grid
> phase of the first world and I'm just waiting... Tapping crank doesn't do
> enough to matter. The mini game is just a single click option and collect.
> I need more things to manage.

He approved four ideas and the order: honest dead-time measurement first,
then projects, a knob for the grid, and a deeper Weather Desk.

### Hypotheses

1. The card scored the night well because M1 and M12 count story lines as
   events. A metric that counts only decisions will show the night as the
   wait it is.
2. A slow second resource (know-how) with a few projects on offer, each with
   a catch, fills the waits between plants with real choices.
3. One live knob whose best setting moves during the night gives the player
   a reason to look back at the grid without adding clicks.
4. A storm whose path firms up over three steps, with crews that need time
   to get ready, turns "one pick, then collect" into an early-or-late choice
   every storm.

### 1. Measurement: M16 Decision gaps (commit 72f8f407)

- `engine/decisions.ts` reads the player who taps when it helps. A decision
  is a meaningful buy, a project started, or an action the universe tags in
  `UniverseDef.decisionActions`: oil, nets, routes, crews, watering, the
  streetlights in Light; bees, crops, biomes, pumpkins, flock and pot in
  Grow. Claims (rush, flare), fixes (balance, correct, steer) and collects
  (haul, pick, harvest) never count, and neither do story lines.
- The first 2 minutes of a phase are not scored. Band: longest gap <= 90 s,
  p90 <= 60 s, <= 15% of the phase in gaps over 60 s, 0.67-2 decisions a
  minute. Gate: longest <= 150 s and <= 40% of the phase in gaps over 60 s.
- Weight 8, from M1 (10 to 6; it counts story lines), M5 (5 to 3) and M8
  (5 to 3), which had been saturated for rounds.
- The score script prints, per phase, the seconds since the last decision
  at each minute and every gap over a minute with where it falls.

Today's build on the new card: Light **59.0 capped (83.5 uncapped)**. M16
fails in the night, the sky and the ending; the coast passes.

| Phase (when it helps) | Longest gap      | p90   | Time in gaps > 60 s | Decisions/min |
| --------------------- | ---------------- | ----- | ------------------- | ------------- |
| coast                 | 130 s (min 32.7) | 50 s  | 20%                 | 2.25          |
| night                 | 140 s (min 28.0) | 90 s  | **60% (fail)**      | 1.02          |
| sky                   | 130 s (min 11.5) | 100 s | **69% (fail)**      | 1.07          |
| last                  | 159 s (min 2.1)  | 100 s | **81% (fail)**      | 1.06          |

The night had 15 gaps over a minute: 80 s at min 7.5, 70 s at 9.5, 70 s at
11.7, 90 s at 13.0, 80 s at 14.5, 110 s at 17.2, 67 s at 19.0, 90 s at 20.8,
80 s at 23.3, 80 s at 25.5, 140 s at 28.0, 77 s at 30.7, 99 s at 32.2, 61 s
at 33.8, 80 s at 34.8. The night bar also sat at 98-99% for its first 20
minutes, so nothing on screen moved either.

Make It Grow on the new card: **83.9 to 82.6**, no failing gate. The yard
(33% in gaps over a minute, longest 100 s) and the world's tail (longest
143 s at min 35.3, 31%) are its next targets. Grow was not tuned this round,
and its card is byte-identical after the Light changes.

### 2. Projects, a generic engine feature (77eb25f8, f9d2d423)

- `ProjectDef` on `UniverseDef` (`projects`, `maxProjects`, default 3):
  costs in any resources, `revealWhen` (milestones only), `onDone`,
  `effectPreview`, `tradeOff`, `botValue`. Done and seen are flags, so old
  saves read as nothing done. The engine has `shownProjects`,
  `startProject` and the rest; the sim's bots take `projects: "best"`
  (forward income gain plus the hint), and every start is a decision.
- The night earns **know-how**: 0.04 a second per power plant (night school
  1.5x), +3 for balancing an uneasy grid, +2 for riding a rush, +4 for a
  storm met by a crew, +3 for an outage fixed.
- Ten night projects, revealed in this order: night school, smart meters
  (+20% pay, towns want 5% more), line patrols, better barometers, rush-hour
  pricing (+50% rush, a quarter less often), town lamplighters (towns want
  6% less, glow +8% not +15%), the power co-op (steam +25%, strain +15%,
  shown once every steam plant is built, the wait for the first dam), spare
  parts depot, fish ladders (dams +40%), wind maps (farms +25%).
- A retro Projects panel (violet), registered in Light's UI registry. Each
  card shows its effect before to after, "The catch:" and its cost (with
  what you have so far); unaffordable cards are `aria-disabled`; a
  `role="status"` line says "<name>: done!" once, on the start.
- A turn of the crank also brings 0.3% of a second's city power, so the tap
  floor (M11) holds as projects lift income. Taps stay a nudge.

### 3. The streetlights, a knob (c59ae962)

Tried first and dropped: a split that saves city power in a battery for the
evening rush. Held at any of its four steps the night changed by under a
minute, and saving never cost anything, so it was not a decision.

What shipped: four steps, soft glow / gentle / bright / dazzling.

| Step      | Pay  | Towns want | Grid strain | Know-how |
| --------- | ---- | ---------- | ----------- | -------- |
| Soft glow | 90%  | 88%        | 70%         | 2.5x     |
| Gentle    | 95%  | 94%        | 85%         | 1.6x     |
| Bright    | 100% | 100%       | 100%        | 1x       |
| Dazzling  | 106% | 106%       | 130%        | 0.25x    |

It opens with the grid; old saves read as Bright. The best step moves: soft
while a big project waits only on know-how, dazzling while building. A
radio group (`useRoving`), each step showing its power, know-how and towns
lit right now; the status line speaks only when a step is picked. The bots
set it by situation (with hysteresis so it does not flip while power dips).

Night length with the step held all night versus the bot's policy (minutes):

| Bot           | Policy | Soft | Gentle | Bright | Dazzling |
| ------------- | ------ | ---- | ------ | ------ | -------- |
| when it helps | 34.7   | 35.7 | 35.2   | 34.9   | 35.0     |
| eager         | 32.5   | 34.5 | 34.4   | 33.2   | 33.0     |
| dawdler       | 53.0   | 56.0 | 55.0   | 53.0   | 53.0     |

Changing it beats every held step (the dawdler ties), and the worst held
step is 3-6% slower, never a trap. The margin is thin; see "still thin".

### 4. A deeper Weather Desk (4bc8f088, aed1d9f7)

- A storm forms (35-60 s), then the forecast comes in three 20 s steps.
  Where it lands is drawn once, honestly, against the first forecast; each
  step shows the path firming up (0%, 45%, 80% sure; barometers 30/70/95%).
  A storm cloud slides along a track above the towns.
- Repair crews (1, 2 with storm crews) go anywhere, any time; a crew takes
  40 s to get ready. A ready crew earns 45 s of income and 4 know-how; one
  that just arrived earns half. With every crew out, the one at the least
  likely town moves. Crews come home after every storm, so each storm is a
  new choice.
- A town hit with no crew goes dark for 2 minutes (10% less pay while
  dark). A crew fixes it in 12 s and learns from it (+3 know-how); left
  alone it comes back on its own. Nothing is taken, nothing expires, the
  vane still pays 60% on top of hand play, payouts in flight finish, and the
  desk keeps its own random stream. Old saves mid-forecast play on.
- Bots send crews by chance times readiness at landfall and fix dark towns
  between storms.

### Tuning (aed1d9f7)

Storms every 1.5-2 minutes, the desk opens at two steam plants, the night's
costScale 2 to 2.9 with the opening buys (crank, gen1, gen2) cut to match.

### Before and after

Decision gaps in the night (taps when it helps), seconds since the last
decision at each minute (first 2 minutes not scored):

```
before night  60  0 10 30 10 10 10 30 10 30 20 20  0 60 30 10 33 50  0 60 10 70 40 40 20 30 10  0 60120 17  0 50 11 10 70 50  0
after  night  60  0  5 10  0 60  0 30 20  2 42 10 10  9 40  9 27 30 10 56 20 10 33 10  0  0  0 28 29 43  1  1
```

| Night (when it helps)    | Before          | After                                   |
| ------------------------ | --------------- | --------------------------------------- |
| Longest gap              | 140 s at min 28 | 92 s at min 19.1                        |
| p90 gap                  | 90 s            | 58 s                                    |
| Time in gaps over 60 s   | 60% (15 gaps)   | 24% (6 gaps)                            |
| Decisions a minute       | 1.02            | 2.34 (30 buys, 10 projects, 35 choices) |
| M16 night gate           | fail            | pass                                    |
| Non-tap clicks/min (M15) | 1.1             | 1.6 (band 0.3-2.5)                      |
| Late taps/min (helps)    | 12              | 20 (band <= 20)                         |
| Night length, realistic  | 37 min          | 32 min                                  |

The remaining night gaps over a minute: 70 s at min 5.0 (before the desk
opens), 63 s at 14.3, 80 s at 17.5, 92 s at 19.1 (the wait for the first
dam), 70 s at 23.8, 63 s at 29.3.

| Card                            | 1.14.0 old card      | 1.14.0 new card      | Round 5              |
| ------------------------------- | -------------------- | -------------------- | -------------------- |
| Light total                     | 86.8                 | 59.0 (83.5 uncapped) | 59.0 (83.1 uncapped) |
| Light failing gates             | none                 | M16 night, sky, last | M16 sky, last        |
| Grow total                      | 83.9                 | 82.6                 | 82.6 (unchanged)     |
| Light finish (eager/helps/idle) | 1.99 / 2.18 / 3.12 h | same                 | 1.96 / 2.09 / 3.37 h |

Per metric (Light, new card, before to after): M1 4.3 to 3.8, M3 1.9 to
2.0, M4 9.0 to 8.8, M7 8.1 to 7.9, M11 9.3 to 9.1, M14 3.9 to 3.7, M16 3.7
to 4.4; the rest unchanged. The small losses are the eager night getting
shorter (30 min) and its beats bunching; the uncapped total is flat because
the sky and the ending carry most of M16's loss.

Narration: two new story lines need clips, `light/night-lamps` (the
streetlights open) and `light/night-ideas` (know-how and projects). No
existing narrated text changed. Project and step texts are on screen only.

### What still feels thin

1. **The knob's edge is small.** Changing the streetlights beats holding
   any step by 1-6%. It is a real choice but a quiet one; a player may
   leave it on dazzling and lose little.
2. **The first dam.** The longest night gap (92 s, min 19) is still the
   wait for the first dam after the last steam plant.
3. **The sky and the ending are now the deadest phases on the card** (84%
   and 75% of the time in gaps over a minute). They need the same treatment:
   projects with their own slow resource, a knob, a deeper probe race.
4. **Grow's yard and world tail** (33% and 31%) are its next targets.
5. The night's progress bar still sits near 100% for the first 20 minutes.

### Decision

Keep. Light's floor is now the uncapped score minus 1 (82.1) with the
sky and ending M16 gates listed as known; Grow's floor 81.6. Next: Gentry
plays the night on his phone (does the desk feel like managing now; does
the streetlights panel read), then Round 6 takes projects and a knob to the
sky.
