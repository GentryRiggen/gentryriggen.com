# Planet Smasher lab notebook

Method (the short version of the fun-loop skill): a headless simulator plays the
real game rules through the real store, with simulated time and three bot
personalities, and a scorecard turns the trace into 0-100. Each round appends:
date, hypothesis and change, score before and after with per-metric deltas, the
reviewer's retro (what dragged, what blocked the loop, bold ideas), and the
decision (keep or revert) with what to try next. Gentry's playtest notes are
quoted and outrank the score. Kids play this, so never manipulative: no FOMO
timers, streaks or shame text.

Run it: `npx tsx scripts/planet-smasher-sim.ts` (about 45 s; writes
`docs/planet-smasher/sim-latest.json`). Code: `lib/planet-smasher/sim/`.

Bots: nukeLover (taps every 0.5 s, highest nuke 70% of the time, else newest
tool), explorer (0.9 s, cycles unlocked tools newest first), casual (1.5 s,
random tool, random unlocked planet every 3 planets). All aim at a random city
60% of the time. 3 seeds each, 150 simulated minutes. The population grid is a
seeded synthetic one (40 gaussian cities over a 0.02 floor).

Sim assumptions to remember: hold tool (laser) is held 2 s per fire; the bot
waits for a tool's cooldown if it picked a tool still cooling; impacts of a
planet that already ended are dropped; below-band `allToolsMin` (under 60 min)
fades to 0 at 30 min but is not a gate.

## Gentry's directions so far

- "They reach for nukes a lot. They want tons more alien tech."
- "rethink gameplay, progression, design, capabilities".

## Round 0, baseline (2026-11-14, 1.2 unlock path)

Mean **50.0 / 100**. Every run is capped at 59 by a gate, and uncapped it scores
50 too.

| bot       | seed | score | firstUnlockSec | maxGapMin | allToolsMin | nukeFamilyByMin | alienByMin | newThings30 |
| --------- | ---- | ----- | -------------- | --------- | ----------- | --------------- | ---------- | ----------- |
| nukeLover | 1    | 50.0  | 3.8            | 78.4 X    | 7.0         | 3.2             | 4.5        | 34          |
| nukeLover | 2    | 50.0  | 2.8            | 78.4 X    | 7.3         | 3.0             | 4.7        | 34          |
| nukeLover | 3    | 50.0  | 3.3            | 78.1 X    | 7.8         | 3.5             | 5.2        | 34          |
| explorer  | 1    | 50.0  | 6.2            | 64.9 X    | 6.6         | 3.1             | 4.1        | 35          |
| explorer  | 2    | 50.0  | 4.4            | 65.2 X    | 6.9         | 3.3             | 4.3        | 35          |
| explorer  | 3    | 50.0  | 5.3            | 64.9 X    | 6.6         | 3.1             | 4.1        | 35          |
| casual    | 1    | 50.0  | 30.8           | 49.2 X    | 8.0         | 4.3             | 5.7        | 37          |
| casual    | 2    | 50.0  | 20.3           | 54.3 X    | 7.4         | 3.2             | 4.8        | 37          |
| casual    | 3    | 50.0  | 12.8           | 56.0 X    | 7.7         | 3.7             | 5.4        | 37          |

X = gate failed. Per bot means: nukeLover 50.0, explorer 50.0, casual 50.0.

Worst metrics (points lost, averaged): maxGapMin -25.0 (all gates failed),
allToolsMin -25.0 (all tools open in 7 min, target 60-90; fades to 0 at 30).
firstUnlockSec, nukeFamilyByMin, alienByMin and newThings30 are all full.

Findings:

- The whole 20-tool path is open in about 7 minutes (planets end in about 12 s,
  and each planet pays 100 ending bonus plus up to 500 for people, plus the
  300 first-ending bonus and 150 per trophy). After that nothing new appears
  for 50-80 minutes (only late trophies: smash50, nuke100, monster).
- Nukes unlock in 3 minutes and aliens in 5, so the pace problem is the total
  length, not the order. Stretch the path about 10x, and spread alien tech and
  new content across the 90 minutes.
- Points are not the only fast thing: trophies at 150 each add about 2,500.

Decision: baseline recorded, no change. Next: round 1 tunes the unlock path
(cost curve and what unlocks when) with this tool.

## Round 1 (2026-11-14): tougher planets, first re-spaced path

Hypothesis: the baseline is reversed. The problem is that planets die in 12 s
and points pour in too fast, not that the path is too long. Making planets
tougher stretches every phase, and then the `at` values can follow the income.

Changes (damage and points rules are untouched):

- `PLANET_TOUGHNESS` divides the health a non-finisher hit takes. Finishers
  (black hole, sun dive, planet collision) still end the planet at once.
- Calibrated with a scratch run (3 bots, 20 min, 1 seed, seconds per planet):

| toughness | asteroid only (nukeLover / explorer / casual) | 6 tools open | 12 tools open | 17 tools open |
| --------- | --------------------------------------------- | ------------ | ------------- | ------------- |
| 2         | 33 / 55 / 86 s                                | 27 / 26 / 39 | 27 / 24 / 34  | 32 / 23 / 35  |
| 4         | 63 / 109 / 200 s                              | 52 / 48 / 75 | 50 / 41 / 63  | 60 / 40 / 63  |
| 8-10      | 200 s or more with only the asteroid          | too slow     | too slow      | too slow      |

Toughness 4 matches the brief: 40-60 s mid-path for the explorer, 63-109 s with
only the asteroid for the two keen bots (the casual bot, with a 1.5 s tap, is
slower at 200 s).

- The path keeps the brief's order (nukes and aliens early, planets
  interleaved). Item times came from a fixed-point fit: each pass sets every
  `at` to the mean star count at that item's target minute, blended with the old
  value, then re-runs (4 passes). The first three (25, 80, 160) stay hand-set so
  even the casual bot gets a first unlock inside 60 s.
- Result of the full scorecard on the first fitted path (end target 75 min):

| bot       | mean | maxGapMin | allToolsMin | alienByMin |
| --------- | ---- | --------- | ----------- | ---------- |
| nukeLover | 59.0 | 15-18 X   | 72-74       | 66-68      |
| explorer  | 59.0 | 26 X      | 63          | 53         |
| casual    | 44.7 | 7.4-7.8   | 100-104     | 93-96      |

Mean **54.2** (was 50.0). Retro: the gap gate fails for the fast bots only
because they run out of path at 63-74 min and the scorecard counts the empty
tail up to minute 90. The casual bot fails the first-unlock gate (165 s) because
the first `at` was 220. Keep: toughness 4 and the shape. Next: end the path so
the fastest bot finishes about minute 85.

## Round 2 (2026-11-14): stretch the path so the fastest bot ends near minute 85

Hypothesis: aim the mean bot's last item at about minute 99. Then the explorer
(the fastest) lands near 85, the keen nukeLover near 92, and the casual bot
about 120. Hand-set the first three `at` values back to 25 / 80 / 160.

Change: fixed-point fit with the end target at 99 min and the first three held
(three passes). The result is the shipped path:

`25, 80, 160, 3450, 4750, 6500, 8750, 11500, 14500, 17500, 21000, 24500, 28500, 32000, 36000, 40500, 46000, 51000, 56500, 64500, 74500, 85000, 97000, 109000`

| bot       | seed | score | firstUnlockSec | maxGapMin | allToolsMin | nukeFamilyByMin | alienByMin | newThings30 |
| --------- | ---- | ----- | -------------- | --------- | ----------- | --------------- | ---------- | ----------- |
| nukeLover | 1    | 73.8  | 3.3            | 7.6       | 93.9        | 24.2            | 80.5       | 18          |
| nukeLover | 2    | 78.5  | 2.8            | 7.2       | 92.0        | 24.4            | 80.7       | 18          |
| nukeLover | 3    | 80.6  | 3.3            | 7.0       | 91.5        | 24.6            | 78.5       | 18          |
| explorer  | 1    | 82.1  | 5.3            | 7.2       | 85.0        | 18.5            | 64.7       | 20          |
| explorer  | 2    | 83.9  | 4.4            | 6.9       | 84.4        | 18.1            | 64.4       | 20          |
| explorer  | 3    | 82.1  | 5.3            | 7.2       | 84.7        | 18.3            | 64.2       | 20          |
| casual    | 1    | 43.0  | 27.8           | 9.5 X     | 125.0       | 34.8            | 110.5 X    | 15          |
| casual    | 2    | 45.2  | 14.3           | 9.1 X     | 121.5       | 35.3            | 105.8      | 15          |
| casual    | 3    | 45.5  | 12.8           | 9.1 X     | 121.0       | 35.0            | 106.1      | 15          |

Mean **68.3** (was 54.2): nukeLover 77.6, explorer 82.7, casual 44.6. The
explorer lands at 82-84, three of the four nukeLover and explorer metrics sit in
band, and the first unlock is inside 60 s for every bot. Keep.

Retro:

- What dragged: the casual bot. It earns about 1.6x slower than the explorer, so
  the same path takes it about 121-125 min (band 60-90) with gaps near 9 min,
  and the alien tech lands at 106-110 min. The gaps for the other bots are 7-7.6
  min where 5 is the band: the late items are 8-12k stars apart, which is more
  than 5 min of income for the keen bots.
- What blocked the loop: bot speed spread. One path cannot fit a bot that earns
  1.6x slower and one that earns at full speed. Tightening for the casual bot
  would make the keen ones finish before minute 82 and then fail the empty-tail
  gap.
- Bold ideas (economy, not path; not done in this task):
  - **Pay the casual and keen kids alike by time, not by planets.** A small
    "stars for time spent smashing" trickle, or a catch-up bonus on the planet
    after a long dry spell, would shrink the spread between bots.
  - **A planet pays more the more tools you have open** (up to 2x), so the keen
    path stretches instead of the casual one.
  - **Give the tail more to open** (planet skins, a trophy pack at 70-90 min), so
    the scorecard's empty tail is filled by real things.

## Round 3 (2026-11-14): move the Mothership earlier (reverted)

Hypothesis: alienByMin is lagging (80 min for nukeLover, 106+ for casual). Move
the Mothership from slot 21 to just after the nanobots (slot 16), so alien tech
is done by about minute 55-60, and re-fit the path with an even 4.3 min spacing
(three passes, end target about 90).

Result: mean **56.8** (was 68.3). Alien tech arrives earlier (nukeLover 60.7,
explorer 45, casual 81.5), but the Mothership is a huge earner, so the fast bots
finish their path sooner: the explorer ran out at minute 71 (gap 19 min, gate
failed) and the nukeLover gap grew to 8.4-8.8 (gate failed). The mean-bot fit
no longer predicts the fast bots once a big earner moves.

Decision: **revert to the Round 2 path and order.** Ship Round 2 at 68.3. The
target of 85 was not reached; the blocker is the casual bot's speed (see the
bold ideas), not the path. Next if this resumes: pick the path against the
slowest keen bot and fill the empty tail with real unlocks (Task 4 adds three
planets, which helps the tail).
