# Engagement research and scorecard for Ever Onward universes

Status: design reference. No code here. Written after the first owner
playtest of Universe 1 ("Keep the Light On"), whose verdict was: too many
cheap upgrades, "clicking orange boxes", no tangible effect, no point.

Naming note: on branch `feat/little-machines` the engine lives in
`lib/ever-onward/` (sim at `lib/ever-onward/engine/sim.ts`, universe 1
at `lib/ever-onward/universes/light/`). The Ever Onward name and
`lib/ever-onward/` paths come from the rename in a separate worktree; the
sim shape is the same. Paths below use `lib/ever-onward/`.

How to read the citations. **[S]** means a source I actually read, **[H]**
means a heuristic of mine (a starting band to be tuned against playtests), not
a published number. Where a source did not say a thing, I do not pretend it
did. Sources are listed at the end.

---

## 1. What makes these games compelling: principles

### P1. Every purchase must change something you can feel

Pecorella's model is that costs grow exponentially while production grows
linearly or polynomially, and that multipliers are what pull production back
up against rising cost, so the player keeps "getting farther through the cost
curve before falling behind" [S1]. He also warns that a cheap, low-output
generator "can be ignored if the player won't feel its impact" (his example: a
10/sec item at cost 5 next to a 10,000/sec item at cost 7,500) [S1]. An
upgrade is a promise: the number, the scene or the rules visibly change.

Patterns:

- Each buy should be at least a noticeable step in income (see scorecard M4,
  "felt effect"), or unlock something new, or change a visible thing in the
  scene. If it does none of the three, it should not exist as a separate
  button.
- Fewer, bigger upgrades beat many small ones. Put the many small steps inside
  one repeatable item with a level counter (one button, buy again) rather
  than 22 named buttons.
- Show the effect at the moment of purchase: a count-up of the income delta
  ("+3.2/s"), a scene change, a ticker line.

### P2. Reveal pacing: always one new thing coming, never a flood

Design writing on the genre says the best ones keep unlocking new layers,
currencies and systems so that a new layer opens as the last is mastered, and
that content is revealed gradually, not all at once [S6, S7 (both secondary,
blog-grade)]. Universal Paperclips is the canonical case: a plain clip-making
and pricing loop, then Trust and projects open new abilities, then the game
leaves Earth, then the endgame countdown, each phase with its own mechanic
[S4 (secondary)]. A Dark Room reveals by text and by fire: the world appears
as you act on it [S8, S9 (secondary commentary)].

Patterns:

- A "reveal" is only counted when it is a new kind of thing (new resource, new
  action, new system, new scene layer, new story beat), not another level of
  the same thing.
- The next reveal should be teased before it arrives: a greyed "???" slot, a
  ticker line, a visible cost the player is saving toward.
- Phase changes are the big reveal. Each phase needs at least one mechanic
  that did not exist before (UP: Trust/projects, drones, probes) [S4].

### P3. Decision density: one or two meaningful choices at a time

Pecorella notes that when the newest generator always dominates, older ones
become irrelevant, and that changing multipliers so priorities shift among
generators is "much more interesting" [S1]. A reviewer of the genre notes
that "meaningful upgrade choices" are what keep waiting from feeling passive
[S6 (secondary)]. Our own failure is the opposite: four or more things
affordable at once makes buying a chore with no choice in it (everything gets
bought, in order). Zero things affordable for a long time is boredom; one or
two is a decision.

Patterns:

- Aim for 1-2 meaningful affordable options most of the time, a brief "fan"
  of 3 right after a phase change, and short pauses of 0 (anticipation).
- Make options trade off (spend on income now vs. unlock the next system vs.
  fix the consumable), so that choosing is not just "buy all".
- Gate cheap filler behind a bulk control or fold into one repeatable.

### P4. Resource tension: a number you have to look after

Universal Paperclips' wire is the model: wire price drifts, you can buy cheap
and stock up, and you watch it climb (a strategy guide suggests buying when it
falls toward $10) [S4 (secondary)]. This gives the player a reason to look at
the screen that is not "click the next orange box". Our oil price is the same
idea. It only works if (a) running low causes a visible slowdown and (b) the
player can act to fix it, and (c) running out never hard-stops play (our
anti-stuck rule).

Patterns:

- Tension should be present part of the time (consumable in the low zone
  roughly a fifth to a third of the time), not always and not never.
- Reward skill gently: a player who buys low should beat one who buys
  whenever by a visible but modest margin (single digits to 25 percent).
- Automate the chore later (a keeper who buys oil) so tension is replaced by a
  new tension one level up. That is the "plate-spinning" progression.

### P5. Be in many places at once (plates)

This is the owner's favourite thing, and it is the Kittens Game / Antimatter
Dimensions / NGU feel: several systems each needing occasional attention, each
with its own clock. Honest note: I did not find a primary source on this
"juggling" quality; the sources I read describe layers revealed over time
[S6, S7], and the claim that juggling is the draw is my synthesis plus the
owner's stated taste, to be confirmed by playtest.

Patterns:

- Count "plates": independent systems that currently offer or demand an
  action (tap, market price, storm window, a consumable, a build queue, a
  timer to claim, a trade route). Target 1-2 at phase start, 3-4 at mid-phase,
  4-6 at phase end, then the phase flips and resets the plate count with a
  new mechanic.
- Plates must have different rhythms (seconds, tens of seconds, minutes) so
  attention shatters pleasantly instead of syncing.
- Automation converts a plate into a number. Automate the oldest plate only
  after a newer one has appeared, so the total never drops to one.

### P6. Active and idle must both pay, and attention must be rewarded

Pecorella: constant positive feedback, and "a quick check-in speeds up
progress, which creates a celebratory moment" each time you return [S2]. Idle
games are defined by progress without interaction, with player actions
designed to speed it up [S2]. Deterding reads Cookie Clicker as a game that is
both incremental and idle, using progress mechanics to make a rote act
compelling [S3]. Our game pauses when the tab is hidden, so "idle" means
"watching while not clicking", and the question is whether attention is
rewarded without being required.

Patterns:

- Early game mostly manual (the tap is the game), declining to a minority of
  income later but never zero (the tap stays useful, and anti-stuck needs it).
- A player who stops tapping must still progress (slower), and a player who
  engages with plates should be clearly faster. Band in the scorecard.
- Prefer bursts of active value (storm tap bonus) over constant clicking.

### P7. Prestige: a reset that feels like a launch

Pecorella: prestige resets give a "ladder climbing" feeling and bring growth
back to a range the designer can tune; lifetime-based systems pay more for
longer runs, with doubling currency needing roughly 3-4x the previous run's
earnings in AdVenture Capitalist and 8x in Cookie Clicker; and resets should
vary in pace (fast and slow stretches) [S3 part III]. A prestige replay should
feel clearly faster (our spec: second run about 60 percent of the first),
and the first minutes of the replay should still contain reveals, not be
skipped wholesale.

### P8. Numbers go up, and so does the scene

"Constant positive feedback" is the hook [S2]. Visible feedback is cheap in a
game with a living scene: beams brighten, ships appear, stars go out. Juice
that carries information (the +income pop) beats juice that is decoration.

### P9. Let them go: ending and scope

Frank Lantz designed Paperclips as a small thought experiment, not a hobby: he
wanted it to "get in your head, take you over and then let you go", with an
ending that lets the player stop and reflect [S5]. That fits our case: a
finite universe with a bittersweet ending, then prestige as optional replay.
Do not pad a phase after it has taught its lesson (a review of UP says some
phases run longer than they need to [S4 (secondary)]).

### P10. Ethical guardrails (players are children)

Compelling means the player wants to play; exploitative means the design
makes them feel they must. Radesky's definition of manipulative design is
nudging the user in the developer's interest at the expense of theirs, and the
same testimony notes such designs do not all use classic "addictive"
reinforcement [S10]. The UK ICO publishes children's-code and game-designer
guidance against nudge techniques; I found nothing there specific to streaks
or timers, so the rules below are our own, consistent with that direction
[S10, S11].

Hard rules for every universe:

- No real-time FOMO: no events that expire while the tab is closed, no
  limited-time offers, no "come back in 4 hours". The game pauses when hidden.
- No streaks, daily login rewards or guilt on absence.
- No loot boxes, no gambling-style random rewards, no purchasable currency or
  speedups, no ads. (No payment exists in v1; keep it that way.)
- No countdowns pressuring the player to act now (a storm window is fine
  because it is a game event, short, harmless and visible; missing it only
  costs a small bonus).
- Randomness only ever helps or is neutral; a miss never takes progress away.
- No dark-pattern shame text ("Are you sure you want to quit?").
- Clean exits: autosave, pause on hide, a natural ending. Optional gentle
  "that is a lot of time" line is allowed, never mandatory.
- Never collect data about the player in the engine (matches the site's
  analytics rules: no ids, no free text).

---

## 2. Anti-patterns, including our first balance

| Anti-pattern                   | What we did                                                                                         | Why it failed                                                                                                                                                       | Fix                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Timer "boons" as progression   | `boons.ts`: a new cheap named upgrade every 140 s from 240 s into a phase, +2% each, 22 coast names | Pops in on a clock, not on player action; each is a 2% nothing; arrives while others are also affordable; the sim counted them as "something new" and hid dead time | Remove as a mechanic. If flavour is wanted, make them free one-off flavour lines in the ticker, not buttons |
| Too many affordable upgrades   | 43+ upgrades, many cheap, repeatable, simultaneously affordable                                     | Decision density 4+: no choice, only chores, "orange boxes"                                                                                                         | Fewer, larger buys; one repeatable per idea; cap visible meaningful upgrades near 3-5                       |
| No visible effect              | +2% bonuses, hidden multipliers                                                                     | Violates P1 and P8                                                                                                                                                  | Felt-effect gate (M4); every buy changes income noticeably, or the scene, or unlocks                        |
| Dead-time metric gamed         | `longestGap` counts any purchase or unlock                                                          | A bot buying cheap filler looks like progress. `longestMilestoneGap` helps but still counts any new unlock                                                          | Scorecard measures _meaningful_ events only and effect size                                                 |
| One plate at a time            | tap, then buy                                                                                       | Nothing to be "in many places" about                                                                                                                                | Plate count (M7)                                                                                            |
| Always-solvable tension absent | oil exists but is rarely binding                                                                    | No reason to look away from the upgrade list                                                                                                                        | M9 tension band                                                                                             |
| Timer pressure                 | storms are short windows; fine if bonus only, not penalty                                           | Only becomes dark if missing a storm hurts                                                                                                                          | Keep storm as bonus-only; ships "turning away" must cost at most a little                                   |
| Pad after the lesson           | long phases                                                                                         | Reviews of UP note the same [S4]                                                                                                                                    | Phase length targets, novelty per phase (M8)                                                                |

---

## 3. Patterns by genre exemplar (what to steal)

- **Universal Paperclips:** a tiny core loop with one live dial (price vs.
  demand) and one consumable (wire); Trust as a second-currency gating
  progression; hard phase pivots that change what the screen is about; a
  clean ending [S4, S5].
- **Cookie Clicker:** progress mechanics wrapped around a rote act, plus the
  game keeps running without input, so it is both incremental and idle [S3].
- **AdVenture Capitalist / the Pecorella model:** several generator tiers, with
  multipliers at ownership milestones so older tiers stay relevant; prestige
  as the way to climb the cost curve again [S1, S2, S3].
- **A Dark Room:** the world is revealed by acting; text first, systems appear
  one by one [S8, S9].
- **Kittens Game, Antimatter Dimensions, NGU, Realm Grinder, Trimps,
  Spaceplan, Melvor, Candy Box:** I did not retrieve primary design writing on
  these; the claims I rely on (many concurrent systems, layered prestige,
  frequent novelty) are the genre consensus in [S6, S7] plus the owner's
  experience. Treat as hypotheses to check in playtest, not citations.

---

## 4. Checklist: designing a new universe

Before building:

1. **One sentence goal taken too far**, and a one-line description of what the
   screen _is_ in each phase (if two phases have the same description, merge
   them).
2. **Per phase: one new mechanic**, one new resource or consumable, one new
   scene layer, one new plate.
3. **Plate plan:** table of phase x plates, with each plate's rhythm
   (seconds / tens of seconds / minutes) and what automates it.
4. **Tension plan:** which consumable or market is binding when, and what
   fixes it. Anti-stuck: a free action that always earns something.
5. **Upgrade budget:** at most ~8-14 meaningful purchases per phase, plus at
   most 2-3 repeatables with level counters. No timer-popped upgrades.
6. **Effect statement per upgrade:** the sentence "after buying this, you will
   see ___". If the blank is empty, cut it.
7. **Reveal schedule:** a list of novelty events with target times.
8. **Ending and prestige:** bittersweet, short; what embers buy (3+ distinct
   choices); target replay time.
9. **Ethics pass:** run the P10 list.

After building (verifiable loop): 10. Run the sim bots (section 6), compute the scorecard, fix the worst gate
first, rerun. Do not tune toward score alone. 11. Playtest with a kid and an adult; capture notes using the template in
section 8; reconcile with the score.

---

## 5. What the sim records today, and what is missing

`simulate()` in `lib/ever-onward/engine/sim.ts` returns today:
`finished`, `finishTime`, `endTime`, `finalRun`, `purchases[{t,id,level}]`,
`unlocks[{t,id}]`, `phases[{t,id}]`, `longestGap`, `longestMilestoneGap`.
Strategy: `tapsPerSecond`, `tapRate(run)`, `tapUntil`, `buys`, `choose`.
`RunState` carries `resources`, `owned`, `mods`, `flags`, `revealed`, `story`,
`transitions`, `taps`, `time`, `phase`. Engine helpers usable for
counterfactual probes (all pure): `tick`, `manualAction`, `manualGain`,
`affordableUpgrades`, `visibleUpgrades`, `upgradeCost`, `buy`, `cloneRun`.

Not recorded and needed for the scorecard:

**A. Time series (sample every 5 s of sim time, plus at every event)**

- `t`, `phase` index.
- `resources` snapshot (at least all resources of the current phase). Store as
  a compact array; a 3 h run at 5 s is ~2200 rows, which is fine.
- `autoRate`: income per second of the phase's currency with zero taps:
  `tick(def, cloneRun(run), 1)` minus current, per resource. Counterfactual,
  no engine change.
- `manualRate`: `manualGain(def, run) * tapsPerSecondNow`.
- `visible`: ids of `visibleUpgrades` not maxed.
- `affordable`: ids of `affordableUpgrades`, and for each, `cost` and
  `effect` (below).
- `cheapestVisibleCost`, and `waitEstimate`: seconds until the cheapest
  non-filler unaffordable upgrade is affordable at current total income.
- `consumables`: for universe-declared consumables (see D), level 0..1.

**B. Per-purchase record, extending `purchases[]`**

- `cost`, `currency`, `resourcesBefore` (the currency amount).
- `incomeBefore`, `incomeAfter` (auto + manual, in the phase's main currency
  at the next sample after the buy; or probe by `buy` on a clone and
  `tick(clone, 1)` vs `tick(run, 1)`). Gives `effectRatio`.
- `sceneChanged`: boolean, from `lightSceneInfo(run)` before vs after
  (`universes/light/scene.ts` already exposes a pure `LightSceneInfo`; each
  universe should export the same shape, and the sim takes an optional
  `sceneDiff(before, after): boolean` from the UniverseDef).
- `sinceLastPurchase` and `waitedFor` (seconds since the previous purchase,
  and seconds since this became affordable minus zero).
- `kind` tag (see D).

**C. Per-event record: `novelty[]`**
`{t, kind: "upgrade-kind" | "resource" | "action" | "scene" | "phase" |
"story", id}`. Derive from `unlocks`, `phases` and new resource first
non-zero; plus the new tag in D.

**D. Small additions to universe data (not engine logic)**

- `UpgradeDef.kind?: "mechanic" | "scale" | "filler"` (mechanic = new system
  or action, scale = a bigger step on an existing thing, filler = small
  repeatable). Sim can fall back to: filler when `maxLevel > 10` or
  effectRatio < 0.02.
- `UniverseDef.plates?(run): string[]`: ids of live systems right now
  (e.g. `"tap"`, `"oilMarket"` when oil price is below its mean, `"storm"`
  while storming, `"crank"`, `"aim"`, `"letGo"`). Light's `isStorming`,
  `keeperCount`, oil fields give these for free.
- `UniverseDef.consumables?: { id, level(run): number /*0..1*/ }[]`.
- Sim strategy variants: `"tapper"` (3/s, buys best), `"idle"` (`tapUntil: 0`
  after minute 2), `"cheapskate"` (buys oil only at the lowest price),
  `"naive"` (buys oil when low regardless), `"slow"` (1/s taps).

**E. Run-level aggregates** (computed from the above in a pure
`scoreTrace(trace)` function): see section 6.

---

## 6. The Engagement Scorecard

Run the sim as a **tapper** bot on a fresh run (the primary trace), plus
secondary runs (idle bot, naive-vs-cheapskate oil, prestige run 2 and 3).
All metrics are computed per phase and over the whole run; unless stated,
the gate applies per phase, not just the whole run. "Meaningful" = a
purchase or unlock with `effectRatio >= 0.10` OR `kind == "mechanic"` OR
`sceneChanged`. Everything else is "filler".

Scores: each metric gets a 0-1 sub-score (1 inside the target band, linear
fall to 0 at the "fail" edge), multiplied by its weight; total is the weighted
sum times 100. A **gate** is a pass/fail; failing any gate caps the total at
59 regardless of the sum, so a pretty number cannot hide a dead hour.

All bands are [H] unless a source is noted. They are starting values and must
be recalibrated from playtests (section 8). Reference timing: the run target
is 2-3 hours (spec), phases of roughly 40, 45, 45, 20 minutes.

| #   | Metric                             | Definition                                                                                                                                                                                   | Computed from                                                       | Target band                                                                                                                   | Rationale                                                                                                                                                                                      | Weight | Gate                                                                 |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| M1  | **Reveal cadence**                 | Gaps between consecutive novelty events (`novelty[]`)                                                                                                                                        | `novelty[].t`                                                       | Median gap 60-150 s; p10 >= 8 s; p90 <= 240 s; reveals per phase 8-25                                                         | A new thing every minute or two is the genre's pull; floods (p10 < 8 s) are the "orange box" failure [S6, S7 for gradual reveal; numbers H]                                                    | 10     | Max gap <= 180 s (spec anti-goal)                                    |
| M2  | **Decision density**               | Share of sampled seconds with N meaningful affordable options, N = 0, 1-2, 3, 4+                                                                                                             | `affordable` filtered by meaningful                                 | 1-2: 45-75 percent; 3: <= 15; 4+: <= 8; 0: 15-40                                                                              | Choices, not chores, keep waiting from feeling passive [S1, S6]; 4+ is the first-balance failure                                                                                               | 12     | 4+ share <= 15 percent                                               |
| M3  | **Visible goal queue**             | Count of visible, unaffordable, meaningful upgrades (the "next goals")                                                                                                                       | `visible` minus `affordable`                                        | 2-4 for >= 80 percent of time                                                                                                 | Player always has a target, but not a wall of them [H]                                                                                                                                         | 3      | Queue >= 1 for >= 95 percent of time (never "nothing to save for")   |
| M4  | **Felt effect**                    | Distribution of `effectRatio` per purchase; share of filler                                                                                                                                  | per-purchase `incomeAfter/incomeBefore - 1`, `sceneChanged`, `kind` | Median meaningful effect >= 15 percent of income; filler <= 15 percent of purchases                                           | A cheap, low-output item the player "won't feel" is ignored [S1]; owner feedback "no tangible effect"                                                                                          | 12     | Filler share <= 25 percent; no phase where median effect < 8 percent |
| M5  | **Purchase rate**                  | Purchases per minute (rolling 5 min)                                                                                                                                                         | `purchases[].t`                                                     | Median 0.6-2.5; p95 <= 5                                                                                                      | Clicking rate of the upgrade list, directly "clicking orange boxes" [H]                                                                                                                        | 6      | p95 <= 8 per minute                                                  |
| M6  | **Wait ratio** (time to next goal) | For each meaningful purchase, wait `w_n` = seconds since the previous meaningful purchase; ratio `w_n / w_(n-1)` and absolute `w_n`                                                          | `purchases[]` filtered                                              | Per phase: median `w` 20-90 s (first 10 min of a phase 10-45 s); median ratio 0.8-1.5; p90 ratio <= 3; p95 `w` <= 180 s       | Stairs that stretch but do not cliff: costs grow exponentially against polynomial production, so waits lengthen until prestige/new tier [S1]; a band keeps it between "instant" and "wall" [H] | 10     | p95 `w` <= 180 s while tapper bot is active                          |
| M7  | **Plates** (concurrent systems)    | Mean count of `plates(run)` over each quarter of a phase                                                                                                                                     | `plates()` sampled                                                  | Quarter 1: 1-2; Q2: 2-3; Q3: 3-5; Q4: 4-6; every phase peaks >= 4 (from phase 2 on)                                           | Owner's stated taste (be in many places at once); my synthesis, no primary source [H]                                                                                                          | 10     | Phases 1-3 reach >= 3 plates; phase 1 >= 3                           |
| M8  | **Novelty per phase**              | Count of novelty events by kind per phase                                                                                                                                                    | `novelty[]`, tags                                                   | Per phase: >= 1 new mechanic, >= 1 new resource or consumable, >= 1 scene layer, >= 1 new plate, >= 6 novelty events total    | Each phase should change what the game is about (UP's phase pivots) [S4]                                                                                                                       | 7      | Each phase has >= 1 new mechanic                                     |
| M9  | **Tension**                        | (a) share of time with the main consumable in the low zone (0.05-0.30 of cap); (b) share at 0; (c) skill gap between cheapskate and naive oil bots (total income at phase end)               | `consumables`, two bot runs                                         | (a) 10-35 percent; (b) <= 3 percent; (c) 5-25 percent                                                                         | A watched number gives a reason to look up [S4 wire price]; (b) keeps it from hard-stopping us; (c) rewards skill gently [H]                                                                   | 6      | (b) <= 8 percent (anti-stuck)                                        |
| M10 | **Income curve smoothness**        | In each phase, fit `log10(income)` against time in 60 s windows; metrics: mean slope (decades/min), slope coefficient of variation, plateau share (windows with growth < 5 percent in 2 min) | `autoRate + manualRate` series                                      | Slope 0.04-0.20 decades/min; CV <= 0.7; plateau share <= 10 percent                                                           | Growth should feel steady with purposeful multiplier steps [S1: multipliers restore pace]; transition windows excluded (income may reset at a phase change) [H]                                | 4      | Plateau share <= 20 percent                                          |
| M11 | **Active vs idle**                 | (a) manual share of income at minutes 1-3, 10-20 and late; (b) idle-bot finish time / tapper finish time                                                                                     | `manualRate/(manual+auto)`, two bots                                | (a) >= 70 percent early, 20-50 percent mid, 10-35 percent late, never 0 and never > 60 percent after minute 20; (b) 1.25-2.5x | A check-in speeds things up and gets rewarded [S2]; idle must still progress, and anti-stuck requires the tap to always work [H]                                                               | 7      | (b) idle bot must finish within 4 h and (b) >= 1.15                  |
| M12 | **Dead time**                      | Longest stretch with no meaningful event (novelty or meaningful purchase)                                                                                                                    | `novelty[]`, `purchases[]`                                          | Longest <= 150 s; p95 gap <= 100 s                                                                                            | Spec anti-goal: nothing for ~3 min. Existing `longestMilestoneGap` counts fillers, so use a stricter filter [H]                                                                                | 4      | Longest <= 180 s                                                     |
| M13 | **Prestige speedup**               | `finish(run2)/finish(run1)` and `finish(run3)/finish(run2)`; and the number of novelty events in minutes 0-15 of run 2 as a share of run 1's                                                 | prestige sims using the embers a typical player earns               | run2/run1: 0.50-0.70 (spec 0.60); run3/run2: 0.75-0.95; early reveals >= 60 percent of run 1                                  | Prestige should feel like a clear climb, not a skip [S3 part III]; diminishing returns keep it from trivialising [H]                                                                           | 5      | run2 < run1 and run2/run1 >= 0.40                                    |
| M14 | **Total length**                   | `finishTime` of the tapper bot                                                                                                                                                               | `finishTime`                                                        | 2.0-3.0 h (hard 1.5-4 h)                                                                                                      | Spec target                                                                                                                                                                                    | 4      | 1.5-4 h                                                              |

Weights sum to exactly 100 (M1 10, M2 12, M3 3, M4 12, M5 6, M6 10, M7 10,
M8 7, M9 6, M10 4, M11 7, M12 4, M13 5, M14 4).

**Round 5 addition, M16 Decision gaps** (weights now M1 6, M5 3, M8 3, M16
8; the rest as `score.ts` lists them). M1 and M12 count story lines as
events, so a phase with nothing to decide could still score well. M16 reads
the player who taps when it helps and counts only decisions: a meaningful
purchase, a project started, or an action the universe tags as a real choice
(`UniverseDef.decisionActions`; claims, fixes and collects are not). After a
phase's first 2 minutes: longest gap <= 90 s, p90 <= 60 s, <= 15% of the
time in gaps over 60 s, 0.67-2 decisions a minute. Gate: longest <= 150 s
and <= 40% of the phase in gaps over 60 s. Code: `engine/decisions.ts`.

### How to combine

1. Compute each metric's raw value per phase; the metric's phase value is its
   sub-score; the metric score is the mean of per-phase sub-scores weighted by
   phase minutes, with the worst phase counting double (a great phase 1 does
   not excuse a dead phase 3).
2. Sub-score: 1.0 inside the band; linear down to 0 at twice the band width
   outside (or at the gate threshold, whichever is closer).
3. Total = 100 x weighted mean. If any gate fails, cap at 59 and print the
   failing gates first.
4. Output a table plus the one worst metric and the worst phase, since the
   tuning loop is "fix the worst thing".
5. Calibrate: score a known-good reference (a playthrough the owner enjoyed,
   or a hand-tuned phase) and a known-bad one (the current `boons` build) and
   set bands so the bad build scores below 50 and the good one above 75.
   If it does not separate them, the bands are wrong, not the game.

### Sanity: the current build should fail

Expected failures from the first balance: M2 (4+ affordable share), M4
(filler share and 2 percent boons), M5 (purchase rate), M7 (one or two
plates), M1 (floods of boon unlocks). If the implemented scorecard does not
flag them, fix the scorecard.

### Limits, stated plainly

- A score cannot measure fun. It measures _symptoms we already know_ (floods,
  dead time, no effect, one plate). Passing is necessary, not sufficient.
- The sim is a bot: it does not feel surprise, read the story, enjoy a scene
  change or get bored. Kids click erratically and will skip the optimal
  buys; adults will min-max.
- Bands are heuristics, mostly mine, drawn from a thin public literature (the
  best-documented numbers are Pecorella's prestige multipliers; nothing
  published gives a target "wait ratio"). Re-derive them from your playtests.
- Goodhart: once the score is the target, content will drift toward satisfying
  it (e.g. tagging fillers as mechanics). Keep human playtest notes as ground
  truth; if score and notes disagree, believe the notes and change the bands.
- Measuring "number of plates" depends on how honestly each universe
  declares them. Review the declarations by hand.

---

## 7. Implementing it (for the builder)

Pure, no UI: `lib/ever-onward/engine/score.ts` with
`scoreTrace(trace, def): Scorecard`, a `trace` option on `simulate()` that
fills section 5's fields (`sampleEvery: 5`), and a `scripts` or jest
"scorecard" test per universe that prints the table and asserts the gates.
Strategy variants as listed in 5D. Existing balance tests stay; the old
`longestMilestoneGap` assertion can be replaced by M12. Keep sampling cheap:
counterfactual probes clone the run, so only probe on samples and purchases,
not every 0.5 s step.

## 8. Human playtest notes (ground truth) template

For each session (note kid vs adult, device, minutes played):

- When did you first feel "oh, that was big" (timestamp, what)?
- When were you bored, confused, or clicking without thinking (timestamp)?
- How many things were you keeping an eye on at minute 10, 30, 60?
- What was the last thing you bought and what did it do? (tests M4)
- Did you check the oil/market on your own? Why?
- Did you want to stop at any point? Did anything make you feel you had to
  keep going? (ethics check)
- One thing you would cut, one thing you want more of.
  Record next to the scorecard for that build; use disagreements to retune.

---

## Sources

- [S1] Anthony Pecorella, "The Math of Idle Games, Part I" (Kongregate blog,
  mirrored on Game Developer):
  https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- [S2] Pecorella interview, "The rise of games you mostly don't play" (Game
  Developer, 2015): https://www.gamedeveloper.com/design/the-rise-of-games-you-mostly-don-t-play
- [S3] Pecorella, "The Math of Idle Games, Part III" (prestige cycles and
  balance): https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii ;
  also Part II: https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii ;
  talk "Quest for Progress" (GDC Europe 2016) slides:
  https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507 ;
  GDC Vault: https://www.gdcvault.com/play/1023863
- [S3b] Sebastian Deterding, "Cookie Clicker: Gamification" (How to Play Video
  Games, NYU Press 2019), abstract via
  https://eprints.whiterose.ac.uk/146788/ (I read the abstract; the PDF was not
  readable by my tool).
- [S4] Secondary on Universal Paperclips phases, wire, Trust: Wikipedia
  https://en.wikipedia.org/wiki/Universal_Paperclips ; Dino Game making-of and
  review (blog-grade) https://dinogame.gg/blog/making-of-universal-paperclips/ ;
  fan wiki Trust page https://universalpaperclips.gamepedia.com/Trust ;
  Pixelpoppers review https://pixelpoppers.com/review/universal-paperclips/
  (pacing critique). Numbers (e.g. buy wire near $10) are from strategy guides,
  unverified.
- [S5] Frank Lantz, Hey Good Game interview:
  https://www.hey.gg/blog/frank-lantz ; also Y Combinator interview
  https://blog.ycombinator.com/frank-lantz-director-of-nyus-game-center-and-creator-of-universal-paperclips
  (found, not read in full).
- [S6] Design explainer on incremental design (blog-grade):
  https://bugnet.io/blog/how-to-design-an-idle-or-incremental-game
- [S7] Game Studies overview of the genre (University of Utah):
  https://games.utah.edu/news/numbers-getting-bigger/ ; Tuts+ series:
  https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a
  (found via search; summaries only).
- [S8] A Dark Room: https://en.wikipedia.org/wiki/A_Dark_Room
- [S9] Arthur Davis, "A Dark Room narrative review" (GDC 2021):
  https://media.gdcvault.com/GDC+2021/ArthurDavis_ADarkRoomNarrativeReview.pdf
  (found, not read).
- [S10] Jenny Radesky, Vermont Kids Code testimony on manipulative design:
  https://legislature.vermont.gov/Documents/2024/WorkGroups/Senate%20Economic%20Development/Bills/S.289/Witness%20Documents/S.289~Jenny%20Radesky~Kids%20Code%20Testimony~3-1-2024.pdf
- [S11] UK ICO Age Appropriate Design Code and game-designer tips, summarised
  in https://techcrunch.com/2020/01/22/uk-watchdog-sets-out-age-appropriate-design-code-for-online-services-to-keep-kids-privacy-safe
  and https://www.nelsonslaw.co.uk/ico-guidance-to-game-developers/

Research gaps to be honest about: no primary design writing retrieved for
Kittens Game, Antimatter Dimensions, Trimps, NGU, Realm Grinder, Spaceplan,
Melvor or Candy Box; no published "wait ratio" or decision-density targets
exist that I could find; the Paperclips wire-price claims are from guides, not
Lantz.
