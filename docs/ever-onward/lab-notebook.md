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
