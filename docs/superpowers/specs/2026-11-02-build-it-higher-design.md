# Build It Higher: Ever Onward universe 3

**Status:** Built (PR open, not merged)
**Date:** 2026-11-02
**Builds on:** `2026-11-01-make-it-grow-design.md` (the shape this copies), `2026-11-01-ever-onward-engagement-research.md` (the scorecard) and `docs/ever-onward/lab-notebook.md`

## Intent

The third universe of Ever Onward, id `higher`. A little builder robot is told one thing, _build it higher_, and never stops. "Ever onward." It starts on a playroom rug with a box of blocks and ends by carrying one block all the way back down to a patch of grass.

Gentry approved the arc. The audience, tone and guardrails match universes 1 and 2:

- **Audience:** kids are the main players.
- **Tone arc:** fun and upbeat for the first hour, then the relentlessness creeps in, with subtext for adults. It is never scary, and nobody gets hurt.
- **Guardrails:** compelling, never manipulative. No analytics, no timers that punish, nothing can be missed, never stuck.

It opens when Make It Grow is finished (`requires: { universeId: "grow", hint: "Opens when you finish Make It Grow." }`).

## Story arc (approved)

1. **The Playroom** (about 25 min). A block tower on the rug, then a treehouse. Pure joy.
2. **The Town** (about 35 min). Apartments, cranes, skyscrapers. Everyone cheers and the robot is a hero.
3. **The Sky** (about 35 min). The tower climbs past the clouds and the robot starts a space elevator. The tower's shadow covers the town, people move up into the tower, the ground is forgotten, and the birds have to fly around. The lines stay light and wry: kids see an amazing tower, adults notice the empty streets.
4. **The Top** (about 20 min). The last block. Nobody is up there, and the mechanic turns small and quiet. The ending: the robot carries one block all the way down and builds a tiny tower with a kid on the grass. Tender and hopeful.

A first run takes about 2 to 3 hours for a realistic player (2.06 h on the scorecard).

## The four currencies

Blocks, bricks, beams and quiet, one per phase, each paid by the phase's tap and helpers. Leftovers carry a little way into the next phase. The top phase also tracks `descent` (0 to 100): quiet is spent on steps, and steps bring the ground closer. Buying the last upgrade (`set-down`, visible at 95% of the way) puts the block on the grass, and the kid arrives.

## Trade-offs (Paperclips-style, from day one)

Everything is deterministic: the run's `rng` is never touched, and a test checks it. No gambling, betting or stock-market framing, and a test checks the words.

| Trade-off                           | Shape                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spend now or invest** (Footing)   | Of everything earned you can keep none, a quarter or half back as a footing (wide base blocks, foundations, anchors). It makes every payout richer and the tower lean less, but it is stuff you cannot spend on floors now. It settles away, and is left behind when the part ends. |
| **One currency, two sinks**         | Know-how (town and sky) buys either a lasting project (hard hats, ready-mix, prefab floors; wind tunnel, loading dock, carbon cable) or an overtime shift (everything pays 1.7x for 45 s), as often as you like.                                                                    |
| **An exclusive fork in every part** | Tall and thin or wide and sturdy; a steel frame or timber; a space elevator or cloud terraces; the stairs or the old lift. Each side has "The catch" on its card and a picture of its own, and the sim keeps the two sides within about 20%.                                        |
| **A managed risk** (Sway)           | A taller tower leans. A leaning tower slows its crew, to half at the very worst and never to nothing. One press of Steady puts it right. Braces, a footing, hard hats and a fork's side make the button needed less. Nothing is ever knocked down.                                  |
| **A decision every minute or so**   | Deliveries: about every 80 s a load waits to be placed. Three cards say exactly what each gives (stuff now, a steadying pole, a base stone or a roll of plans), and the best one right now is marked. Nothing is lost by waiting.                                                   |

## Every upgrade lands

Every helper line multiplies its output by 1.6 per level (`stacked`), every scaling upgrade by 1.6 per level, and every one-off by 1.6. The guard tests (`economy.test.ts`) check that each level of each line is at least +50%, and that each level of every upgrade changes the picture. A render test (`HigherScene.test.tsx`) checks that each level of each upgrade changes the drawn SVG, so none is only a number.

## Living scenes

One SVG layer per phase (`components/ever-onward/scenes/higher/`), crossfading with the camera climbing; the layer that is leaving gets `lm-paused`. Memoized on a quantized `sceneInfo`.

- **Playroom:** teddies hop, a cardboard ramp runs blocks up it, a toy crane swings, fairy lights twinkle, a cat's tail wags, a paper plane crosses the window.
- **Town:** cranes swing, masons bob, trucks drive, pigeons fly, a kite sways, the crowd hops and gets smaller as the tower gets taller. A window on the fifth floor has someone who waves, then the same window is lit and empty, and one dark window has an eye that blinks.
- **Sky:** a tower through the clouds, a steel damper swings inside it, geese fly round it, the town's shadow falls across the street and its one lamp stays lit.
- **Top:** the robot walks down a long zigzag stair (or rides the creaking lift) past lit landings, songbirds and a bench, while the great tower beside it has every window lit and nobody looking out.

Where a count grows (teddies, masons, trucks, crew, cables), one animated group moves them all, because old iPad WebKit repaints each animated group. All keyframes are `bh-` classes in one block at the end of `app/globals.css`, each with a `prefers-reduced-motion` rule (a test checks that every animated class is covered).

## Files

- `lib/ever-onward/universes/higher/`: resources, phases, upgrades, actions, tuning, tick and income, sway, footing, knowhow, forks, deliveries, descent, story/ (playroom, town, sky, top, progress, timed), cutscenes, visitors, alerts, hooks, prestige (Gold stars), scene, bots, sprites.
- `components/ever-onward/universes/higher.tsx`, `components/ever-onward/game/higher/*` (panels) and `components/ever-onward/scenes/higher/*` (layers).
- Shared registration, one line each: `staging.ts` (ALL_UNIVERSES), `scored.ts` (SCORED_UNIVERSES), `universes/index.ts` (UNIVERSE_UI). Grow's ending now says Build It Higher is open.

## Narration

Every story line, intro and cutscene frame has a voice clip under `public/ever-onward/voice/higher/`, made with `npm run narration:ever-onward`. A missing clip fails gracefully at runtime (the Listen button stays quiet), and a test fails if a line has no current clip.
