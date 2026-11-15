# Planet Smasher 1.2 — monsters, disasters and trophies

Date: 2026-11-14 · Status: approved in chat by Gentry ("get going on 1.2 — deploy it")

## Why

1.1 shipped the alien tech the boys (6 and 8, iPad mini 6) asked for. 1.2 finishes
the list agreed in chat:

- four new big tools;
- slow-motion endings;
- debris that stays in orbit;
- a trophy shelf, so there's something to chase once every tool is unlocked.

## What ships

| Tool                | Look                                                                                                                     | Ending                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 🦖 Giant monster    | rises out of the sea near the tap, roars, stomps across the land (4 stomps), fires eye lasers twice, sinks back          | family shatter                 |
| 🌊 Tsunami          | a huge ring wave spreads from the tap across the ocean and washes over coasts, leaving brown flood marks and dark cities | family shatter                 |
| ☀️ Sun dive         | the Sun swings into view; the planet is pulled in, glows white-hot, streams plasma and evaporates                        | finisher → **Vaporized** (new) |
| 🪐 Planet collision | another planet (Mars, or Earth when you're on Mars or Frostia) flies in and smashes into it; both burst                  | finisher → **Collided** (new)  |

- **Endings:** two new ones, Vaporized ☀️ and Collided 🪐, for 7 in total.
- **Slow motion:** when any ending starts, time slows to 25% for 0.8 s while the
  camera pushes in, then ramps back to full speed over 0.4 s. Reduced motion
  skips the camera push.
- **Orbiting debris:** after a Shatter, Frozen or Collided ending, the next planet
  starts with a ring of up to 60 tumbling rocks orbiting it. The next New planet
  replaces the ring.
- **Trophies:** a 🏆 button opens the shelf, a grid of 20 trophies.
  - Each trophy has an emoji and a short name. Locked ones are dark silhouettes,
    with a progress bar where there's a count.
  - Earning one plays a "TROPHY!" celebration and pays **+150 ⭐**.
  - Trophies save with progress. Old saves load with none and count from zero.
- **Star path:** append Giant monster 14500, Tsunami 16000, Sun dive 18000,
  Planet collision 20000.

## Non-goals

Gameplay analytics, spending stars, new planets, and leaderboards.

## Constraints

Same as 1.0 and 1.1:

- iPad mini 6 budgets: shared particle pools, ≤12 effects, no `useFrame`
  allocations, dispose on unmount, instancing.
- No gore: the monster smashes buildings and lights, never people.
- Icon-first.
- Saves from 1.0 and 1.1 must load.

## Approach

Extend the existing systems:

- tool catalog + effect components;
- ending kinds in `EndingStage`;
- a `timeScale` on the shared `fxClock`, so slow motion applies to every effect
  and ending at once;
- stats and trophies in progress, with a pure trophy evaluator.
