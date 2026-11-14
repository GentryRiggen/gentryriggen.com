# Planet Smasher 1.1 — alien tech and nuke upgrades

Date: 2026-11-14 · Status: approved in chat by Gentry

## Why

The boys (6 and 8) play 1.0 on their iPads. They reach for the **nuke** most and
want **"tons more alien tech"**. 1.0 also runs out of unlocks after about 8 wrecked
planets. 1.1 adds six tools, a new ending and a combo counter, and stretches the
star path. 1.2 (separate) adds the monster, tsunami, sun dive, planet collision,
slow-motion endings, orbiting debris and trophies.

## What ships in 1.1

| Tool             | Look                                                                                                                                  | Family / ending    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| ☢️☢️ Twin nuke   | two nukes land side by side, double mushroom                                                                                          | molten             |
| 🚀 Nuke rain     | six warheads rain across a region, staggered                                                                                          | molten             |
| 👾 UFO swarm     | 12 saucers fly in, hover over the biggest cities near the tap and beam them up one by one (green tractor beams, city lights wink out) | molten             |
| 🧲 Gravity beam  | an alien beam tears 8 glowing rock chunks out of the crust; they float up and drift away into space                                   | shatter            |
| 🤖 Nanobot swarm | a silver spot that keeps spreading over the planet by itself for 10 s, eating cities                                                  | **consumed** (new) |
| 🛸 Mothership    | a huge ship descends over the point, charges for 2 s, then fires a giant beam that ends the planet                                    | finisher → shatter |

- **New ending, Consumed** (🤖): the surface turns to shiny silver metal with glowing
  blue seams. The planet ends as a metal ball (it stays, like Molten).
- **COMBO ×N**: hits that land within 1.2 s of the previous hit build a combo. From
  ×3 a big "COMBO ×N!" pops near the top and each hit pays N bonus stars (capped at
  ×10). The combo resets after 1.2 s without a hit, and on a new planet.
- **Star path** (lifetime stars, auto-unlock as in 1.0): Twin nuke 6000, UFO swarm
  7000, Gravity beam 8200, Nuke rain 9500, Nanobot swarm 11000, Mothership 13000.
- In the tray, the nuke upgrades sit right after the Nuke. The alien tools sit
  after the Alien laser, in unlock order.
- Every new tool gets its own sound. There's also a combo "ding" that rises in pitch
  with N.
- Release 1.1.0 with kid-friendly notes.

## Non-goals

1.2 items, gameplay analytics, spending stars, and new planets.

## Constraints

Same as 1.0 (see `2026-11-14-planet-smasher-design.md`):

- iPad mini 6, with the shared particle pool (≤ 600) and ≤ 12 live effects.
- No per-frame allocations, and dispose on unmount.
- Icon-first, and no gore: UFOs beam up _city lights_, never people.

## Approach

Extend the 1.0 systems. Each tool is a catalog entry plus an effect component, and
the new ending plugs into `EndingStage`. There's no alternative worth weighing.
