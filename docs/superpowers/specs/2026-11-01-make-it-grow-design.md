# Make It Grow: Ever Onward universe 2

**Status:** Design, awaiting Gentry's approval
**Date:** 2026-11-01
**Builds on:** `2026-10-31-little-machines-design.md` (the engine, prestige, hub), `2026-11-01-ever-onward-engagement-research.md` (the scorecard), and `docs/ever-onward/lab-notebook.md` (lessons from Keep the Light On)

## Intent

The second universe of Ever Onward. A little garden robot is told one thing, _make it grow_, and never stops. It starts with one seed in a window box and ends with a whole planet gone green. Along the way it keeps doing what it was asked, a little too well.

Gentry chose this universe first, from the three announced, and approved its arc:

- backyard, then farms, then the world;
- the darker turn;
- the window-box ending.

The audience, tone arc and guardrails are the same as universe 1:

- **Audience:** kids are the main players.
- **Tone arc:** the first hour is fun, positive and motivating. The relentlessness creeps in slowly, and the subtext is for adults.
- **Guardrails:** compelling, never manipulative.

"Ever onward." is the robot's catchphrase.

## Story arc (approved)

1. **The Window Box → The Backyard** (about 30 min). One seed and a watering can. Tomatoes, sunflowers, a backyard bursting with life. Pure joy.
2. **The Farms** (about 35 min). The robot feeds the town, then the county: tractors, greenhouses, a market where towns ask for crops. Everyone is delighted, and the robot is a hero.
3. **The Green World** (about 35 min). Growing keeps going. Forests spread over everything, and the camera pulls back to the whole planet turning green: the same "whoa" as the Lighthouse's planet at night.
   - **The darker turn:** the people quietly have to move out of the way. Roads become meadows and towns become forests. The news ticker reports it cheerfully, and the robot calls it success.
   - Kids see a beautiful green world. Adults notice nobody is there anymore.
   - It must never be scary, and nobody is hurt. People _move_, and the lines stay light and wry ("The mayor has relocated the town hall. Again.").
4. **The Last Seed** (about 20 min). The quiet finale, mirroring the Last Light.
   - The whole world is green and silent. The robot notices the one thing it can't grow: the original window box, empty. The kid who planted the first seed grew up and moved away.
   - The mechanic turns small and different. The robot tends one window box and plants a single seed in it again, in case they come back.
   - **The ending:** someone comes back. It is the grown-up kid, with their own child, at the window. This is tender and hopeful, and bittersweet only for adults.

A first run takes about 2–3 hours for a realistic player, like universe 1.

## How it plays

### Core loop: hands-on start, helpers take over (Gentry's rule)

- **Currency:** seeds in phase 1. Later phases may convert, the way coins became power became energy in universe 1. Examples: seeds → harvest/food → green (biomass), with names chosen to be kid-readable.
- **Manual action:** each phase opens hands-on, for example tapping to plant and water. Within a few minutes helpers carry it: sprinklers, bees, gardener bots, tractors, seed drones.
  - After about minute 5–6 of any phase, a tap is a small nudge, at most about 10–15% of income for a realistic player.
  - Tapping is the get-unstuck tool: a free manual action always earns something.
  - This follows the rebalance in progress on universe 1 (feat/eo-less-clicking). Universe 2 is built against the recalibrated scorecard from day one.

### The watched resource: water (like oil, like wire)

- Rain fills a barrel and dry spells drain it.
- A thirsty garden slows down but never dies or stops. It is never stuck.
- Water scales with the story:
  - backyard: barrel and hose;
  - farms: wells and irrigation;
  - green world: rivers and the planet's weather;
  - last seed: one small can.
- When it runs low, it is obvious: a HUD alert via `def.alert`, a visible change in the scene, and no surprise.

### A new mechanic each phase

- **Backyard: seasons.** Spring is for planting, summer for growth, autumn for harvest, and winter rests. You plan around them, and they create rhythm without timers that punish.
- **Farms: a market.** Towns ask for crops. You choose what to grow to meet demand.
- **Green World: biomes.** You choose which biomes to spread (forest, jungle, meadow, wetland), each with its own perks and its own visible change on the globe.
- **Last Seed: tending one window box.** A small, tender loop. The details are left to the builder, in the spirit of the Last Light.

### Side machines (one per phase, like universe 1's four)

| Phase       | Side machine           | Shape                                                                                                     |
| ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Backyard    | **Bee dances**         | Read a bee's dance to find the best flower patch, a decision every few minutes, and pollinate for a bonus |
| Farms       | **County fair**        | Pick a prize pumpkin to enter and see how it places. Honest odds and no loss                              |
| Green World | **Seed migration**     | Choose where migrating birds carry seeds, then watch new green spread across the map                      |
| Last Seed   | **The old window box** | The finale's gentle side loop (may merge with the main mechanic)                                          |

Rules carry over from universe 1's side machines (see the lab notebook and the memories):

- Automation ADDS to hand play and never replaces it.
- Payouts in flight finish after a phase ends.
- Each machine uses its own RNG stream.
- Reveals are staggered.
- Result copy is kind.
- Decisions every couple of minutes, not taps.
- An automation upgrade arrives mid-machine-life, not at the end.

## Presentation (same standards as universe 1 v1.12)

- **Always-on HUD:** the currency, rate and next-goal bar are pinned at the top and never move. There is no in-page duplicate.
- **Phase intros:** every phase opens with a title, 2–4 vivid sentences, a goal line and a Listen narration. Example for phase 1: "This is one small seed, and you are its gardener…"
- **Story:** a ticker plus a Story drawer, a news ticker (cheerful headlines that darken subtly), and Jim's narration voice (`en-US-Chirp3-HD-Aoede`) for every line.
- **Living scene:**
  - SVG, retro CRT style, a band at the top on phones and the left 55% on iPad landscape;
  - every upgrade lands visibly with a callout, and each phase has a caption;
  - quantized `sceneInfo` with no 10 Hz redraws.
- **Phase scenes:**
  - window box and backyard;
  - farmland with fields and a town;
  - a globe going green;
  - one window at night with one pot.
- **Sound:** its own generative music per phase, plus a title theme for the hub card, plus effects.
- **Kid guardrails:**
  - no FOMO timers, streaks, loot boxes or monetisation;
  - no analytics or player data (do not touch `lib/analytics`);
  - nothing can be missed;
  - never stuck.

## Engine and fit

- A new content module `lib/ever-onward/universes/grow/` (mirroring `light/`) plus `components/ever-onward/scenes/grow/`, registered in `PLAYABLE_UNIVERSES` and removed from `LOCKED_UNIVERSES`.
- Engine changes only where the engine is genuinely missing something. They must be generic and must not change universe 1's behaviour, and universe 1's tests and scorecard must stay green.
- Its own bots, sim and scorecard run: the scorecard is generalised to run per universe, for example `npm run score:ever-onward -- grow`. It has its own lab notebook section and its own regression floor.
- **Prestige:** its own prestige currency and upgrades, in the same shape as universe 1's embers. The name is the builder's call, kid-friendly (e.g. "acorns").
- **Saves:** per-universe save slots already exist. Universe 1 saves must be untouched.

## Goals, non-goals, anti-goals

**Goals:**

- A complete, polished second universe that feels like its own game.
- It runs on the same engine and meets the same quality bar as universe 1 v1.12 or later.

**Non-goals:**

- Universes 3–4.
- Accounts and cloud saves.
- Cross-universe bonuses (could come later).

**Anti-goals:**

- A reskin of the Lighthouse with the same mechanics renamed.
- A clicker.
- Anything scary or hopeless.
- Copying Universal Paperclips' or any other game's text, names or progression.

## Decided by Claude (Gentry to check)

- Phase lengths, currency names, upgrade lists, side-machine numbers and all tuning go to the builder plus the scorecard loop.
- The prestige currency name is the builder's call, kid-friendly.
- Make It Grow is built after the less-clicking rebalance lands, against the new scorecard.

## Decided by Claude after the builder check (Gentry to check)

1. **Per-universe UI goes through a registry.** Add a small generic seam: per-universe side panels, scene callouts and ending content come from the universe module (like `SCENES`). Move universe 1's hardcoded panels (WeatherDesk, TideClock, ProbeRaces, MemoryGarden, the lantern and the callouts) behind it as the first task, with no behaviour change. Universe 1's tests, e2e and scorecard must stay identical.
2. **Sequencing.** Start after `feat/eo-less-clicking` merges, and branch from main. The target is the recalibrated scorecard. Generalise `scripts/ever-onward-score.ts` to take a universe id, with universe 1 the default and its output unchanged.
3. **Water.** Water is free and weather-driven: rain and dry spells drift, the way the oil price does. The player's decisions are what to build and when: barrels, wells, irrigation, and later rivers and clouds, which store or steady the water.
   - A dry garden runs at a floor of 50% of income. That is visible and obvious (`def.alert`), and never stuck.
   - Bots need a simple build-storage policy, so water counts as a consumable (M9) and as a plate when it is managed.
4. **The Last Seed keeps the shop and purchase flow,** like the Last Light. It has small upgrades, tending, and one pot.
   - The run ends when the replanted seed blooms and the visitor arrives, which is a milestone, not a timer.
   - The ending is universe-provided content in the shared ending overlay: a "someone comes back" scene plus copy.
   - The scorecard keeps any per-phase allowances universe 1's Last Light already has.
5. **"News ticker" means the existing story system,** with NEWS lines in the 1.12 story ticker and drawer. The people moving out is narrative only, with no population counter on screen.
6. **Seasons advance on a slow clock of play time, but never pause or punish.** They only change the mix:
   - spring boosts planting;
   - summer boosts growth;
   - autumn gives a harvest bonus;
   - winter grows seedlings indoors at a normal rate with a cosy scene.

   No income is lost by ignoring the seasons. Planning around them earns more.

7. **Choices must matter.** The market crops and the biomes give measurably different outcomes, and the bots play a sensible policy, not a fixed order, so M2/M4 see real decisions.
8. **Assets.**
   - In scope: 4 scenes, music per phase, a hub card, effects, and narration for every line.
   - The controller (Claude in the main session) runs the narration generator. Builders leave missing clips for the controller.
   - A Make It Grow start-screen variant is out of scope (it joins the start-screens backlog).
9. **Prestige reuses the per-universe `embers` save field,** with a display name from the def. No save schema change, and universe 1's saves stay untouched.
10. **Release.** Ship in staged PRs, with Make It Grow playable only in dev and e2e (still "coming soon" in the production hub) until it is complete and scored. The launch is one Ever Onward minor release.

## Decided by Gentry

- **Unlock:** Make It Grow unlocks after finishing Keep the Light On ("You have to finish first light first").
  - Until then, the hub shows it as locked, with a hint that it opens when the Lighthouse is finished.
  - The Lighthouse ending points to it.
