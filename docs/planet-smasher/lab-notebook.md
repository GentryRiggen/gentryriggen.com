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
