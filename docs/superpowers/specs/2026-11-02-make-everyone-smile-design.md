# Make Everyone Smile: Ever Onward universe 4

**Status:** Built (round 1), awaiting playtest
**Date:** 2026-11-02
**Builds on:** `2026-11-01-make-it-grow-design.md` (the shape of a universe), `2026-11-01-ever-onward-engagement-research.md` (the scorecard), and `docs/ever-onward/lab-notebook.md` ("Make Everyone Smile, round 1").

## Intent

A robot is told one thing, _make everyone smile_, and never stops. "Ever onward." The audience is kids. The first hour is fun and upbeat; then the relentlessness creeps in, with subtext for adults. It is never scary and nobody is hurt.

It opens after Build It Higher (`requires: higher`). While that universe is not built the card stays locked and nothing crashes (an unknown universe id reads as zero completions).

## Story arc (approved)

1. **One Sad Friend** (about 30 min). Jokes, balloons, a puppy, a lemonade stand. Pure joy. A friendship bracelet opens the friendship bank.
2. **The Town** (about 35 min). Clowns, a band, bunting, a smile factory, fireworks and parades. Everyone is delighted and the robot is a hero. A cheer meter is the first sign that cheering has a cost.
3. **The World** (about 35 min). Posters, loudspeakers, towers and a blimp. The darker turn: nobody is allowed a bad day. Smiles get painted on (posters whose eyes follow you, a cheerful voice that says have a nice day on a loop, masks, a sign that says NO BAD DAYS, one frowning face in the crowd that a poster covers). The lines stay light and wry. Kids see a happy world; adults notice it is hollow.
4. **The Quiet** (about 20 min). The robot finds one person on a bench who is not smiling and learns to sit with them. The mechanic turns small and different: patience, not output. The friend wants one of three things (listen, sit closer, pass the tea); every answer helps, the fitting one most, nothing is ever wrong. The ending is one small, real smile.

A first run takes about 2 to 3 hours for a realistic player (2.1 h for the realistic bot).

## Trade-offs (from day one)

- **Spend now or invest:** the friendship bank (none, a quarter or half of every smile set aside as time together; settles at a bonus on every later laugh).
- **One currency, two sinks:** know-how buys three permanent projects per part, or a repeatable parade (a cheer broadcast in the world), with a rest between parades.
- **An exclusive fork in every part,** each side with a plain "The catch" and its own picture, both sides within 20% on the sim: jokes or kindness; a clown school or a smile factory; loudspeakers or listening boxes; a few words or just sit.
- **A managed risk:** the cheer meter. A worn-out crowd pays 40% less and cools on its own. Never punitive.
- Everything is deterministic. No gambling, betting or markets.

## Shape

`lib/ever-onward/universes/smile/` mirrors Make It Grow: resources, phases, upgrades (four helper lines per part, a scaling step, one-offs), actions, tuning, tick, story, cutscenes, visitors, alerts, hooks, prestige (Stickers), scene, bots, plus `forks.ts`, `bond.ts`, `knowhow.ts`, `meter.ts`, `fetch.ts` and `quiet.ts`. The screens live in `components/ever-onward/universes/smile.tsx`, `game/smile/*` and `scenes/smile/*`; styles are one `ms-` block at the end of `app/globals.css` (with a reduced-motion rule for every class).

## Guards

- Every helper line and scaling step raises its group by at least half again; every purchase in a full run is felt or seen; every upgrade changes the picture.
- The scorecard floor (`scorecard.test.ts`), phase lengths, idle bot within 4 hours.
- Old saves: a save from before this universe existed loads and starts it fresh; a run missing the later hidden resources reconciles to "not chosen, not tired, nothing banked".
- No analytics. Story lines stay gentle. Pixel text is never under 10 px.
