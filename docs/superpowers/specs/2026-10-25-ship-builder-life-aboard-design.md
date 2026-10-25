# Ship Builder: life aboard, funnel liveries, side davits, and a proper sinking

Date: 2026-10-25
Status: draft for approval

## Why

Ship Builder already lets a kid build a ship, walk its decks, and watch it
sink. This round makes the ship feel lived in and the sinking feel like the
era it borrows from. People wander the decks, funnels wear a company's colors
and letters, lifeboats tuck in along the side like on a modern cruise ship,
and a sinking ship loses its funnels, goes all the way to the bottom and
rusts there.

The audience is the same as always: young builders and their parents. Every
change ships as a Ship Builder release (version bump + changelog entry in
plain words, per CLAUDE.md).

There are five features. They're independent enough to build and ship one at
a time, in the order below (my call: cheapest and most self-contained first).

1. Funnel livery: per-part colors, plus letters or a logo
2. Side-mounted davits
3. Always follow her down, plus rust on the sea floor
4. Funnels break off during a sinking
5. Walkers on deck

## 1. Funnel livery

**What the user decided**

- A funnel has three paintable parts: body, bands and top (cap). Each takes
  any color from the existing `PAINT_COLORS`. This makes White Star (buff,
  black top) and Cunard (red, black bands, black top) possible.
- **Colors are uniform across the ship**: styling one funnel styles every
  funnel on the ship.
- **Letters or a logo are per funnel**. A funnel shows either one or two
  letters, or one logo from a fixed set, never both. Letters have their own
  color.
- The mark appears on both sides of the funnel.
- It works on every funnel type: `funnel`, `funnel-large`, `funnel-modern`.

**My calls (open to change)**

- Logos are simple shapes we draw ourselves: star, anchor, heart, wave,
  crown, compass, sun (about 6–8). No real company logos.
- Letters are A–Z only (and maybe 0–9), uppercase, one or two characters.
- Where it lives: select a funnel, then a "Style" button in the
  `SelectionBar` opens a small panel with body/bands/top colors, then
  letters (with a letter color) or a logo.
- Ship-level funnel colors live on the ship (alongside `hull.paint`, for
  example a `funnelPaint` record). Per-funnel marks live on the
  `PlacedPart`.
- Old saves must not change how they look. A funnel's existing per-part
  `color` stays as a body-color override on that funnel. Ship-wide colors
  apply wherever there's no override. Setting the body color in the Style
  panel sets it ship-wide and clears every funnel's override.
- Letters and logos sit on a flat decal panel on each side, which also
  covers `funnel-modern`'s non-round shape.
- Templates (Titanic, Olympic, Lusitania, Carpathia, cruise) get period
  liveries where it's cheap to add them.

**Constraints**

- Any new saved field needs a schema migration (`persist/schema.ts`, bump
  the version, add a fixture). Share links must keep working.
- Letters and logos must be readable at normal build-view zoom, and they
  must work in both day and night scenes.

## 2. Side-mounted davits

**What the user decided**

- You can place a davit on the **side wall** of a block (a lower deck or
  cabin block), so a lifeboat hangs snug against the ship's side under the
  decks above. That's how lifeboats sit on today's cruise ships.
- The davit should **not poke out far**. Its arm is short and the boat sits
  close to the wall.
- Those lifeboats behave exactly like today's (they count toward lifeboat
  seats) and launch with the rest during a sinking (see feature 5). Note:
  lifeboats do **not** launch today. Launching is new work and belongs to
  feature 5.

**My calls**

- This is a new attach point on outward-facing block side faces (the
  outermost occupied cell on that side, like `davitSide` today, but on the
  wall rather than on top). It's either a new davit type or a mounting
  variant of the existing davit; the builder chooses. Every lifeboat type
  that hangs from a davit today can hang from a side davit.
- The side wall must face open air: no block right beside it on that side.
  Something above it (an overhang) is fine and expected.
- Paired side davits can carry the large lifeboat, the same way paired
  davits do today.

## 3. Always follow her down, and rust

**What the user decided**

- There's no "Follow her down" button any more. Whenever a trial ends with
  her sunk, the camera always follows her to the sea floor.
- When she reaches the bottom, she turns rusty.

**My calls**

- Rust creeps in over a few seconds after touchdown rather than switching on
  all at once, and her paint stays faintly visible underneath. It covers the
  hull, decks, superstructure and funnels.
- "Whenever she sinks" means every trial that ends `sank`. That covers
  iceberg sinkings (the descent model in `sim/descent.ts` exists today) and
  weather capsizes, which need a descent too: she's upside down, so she
  settles on the floor that way or rolls partway back. If adding capsizes
  turns out to be a lot of work, do the iceberg part first and report the
  gap. Don't quietly leave it out.
- The result card shows up once she's on the bottom, the way it does after a
  followed descent today. The scrubber and timeline cover the whole descent.
- Rust is a look only. It doesn't change the saved ship. "Try again" or going
  back to building shows her clean.

## 4. Funnels break off during a sinking

**What the user decided**

- **Every** ship with funnels loses at least one during a sinking, like the
  Titanic.

**My calls**

- The funnel nearest the end that goes under first snaps at its base. It
  topples outboard or forward, hits the water with a splash, and later sinks
  to the sea floor and lands near the wreck.
- A ship with three or more funnels loses a second one later in the sinking.
- A ship with one funnel always loses it. If no funnel is near the end
  going under first, the one closest to that end falls.
- In a weather capsize, the funnels snap as she rolls past her side.
- It's deterministic. The sim has no randomness, so the same ship sinks the
  same way every time, and the scrubber can replay it.
- The fall is driven by sim time, so the trial scrubber shows it correctly
  going both forwards and backwards.
- When she breaks in two, the falling funnel goes with whichever half it was
  on.

## 5. Walkers on deck, and lifeboats that launch

**What the user decided**

- In walk mode, low-detail people walk around the decks.
- They only go where it makes sense to stand. They sit on deck chairs and
  benches when there are some.
- How many there are depends on the cabins on board.
- You can't really interact with them.
- They **stay aboard when she breaks or sinks**. Once their part of the deck
  goes under, they float on the surface instead of disappearing.
- **People board lifeboats during a sinking.** The boats lower down the
  side and pull away from the ship. This applies to deck-edge and side
  davits alike.
- **People show up during sea trials too**, not only in walk mode, so you
  can watch the boats fill and leave from outside the ship.

**My calls**

- Simple blocky figures (body, head, maybe arms), in varied bright clothes
  for passengers. Crew cabins add a few crew in a matching uniform.
- The count scales with cabins (passenger and crew capacity), with a hard
  cap that keeps phones smooth (around 20–30 on screen; the builder tunes
  it against the existing perf budget).
- They walk on the existing `walkGridOf(ship)`: open deck and roofs, using
  stair links between levels. They never cross funnels, masts or walls.
  Sitting means walking to a free deck chair or bench, sitting for a while,
  then wandering on.
- The player walks straight through them. Walkers neither block nor push
  the player.
- They show in walk mode and during sea trials, but not while building.
- **Lifeboats** (my calls): once the trial knows she's going down (the
  flooding or capsize moment), walkers head for the nearest lifeboat with a
  free seat. Each boat takes up to its seat count, but on screen it shows a
  few seated figures, not every passenger. A boat lowers when it's full, or
  after a set time, and some boats lower half empty, like on the Titanic.
  Lowered boats row a short way out and wait on the water while she sinks.
  The camera follows her down, and the boats stay at the surface. Anyone
  left aboard floats once their deck goes under. Boat timing comes from sim
  time so the scrubber can replay it. It's deterministic: the same ship
  gives the same launch every time.
- Floaters and boats stay at the surface. They don't follow the wreck to
  the bottom.
- The walker count, their paths and the launch schedule are pure,
  deterministic models in `lib/ship-builder/`. Rendering stays in the
  scene. That way walk mode and the trial view share one model.
- They're deterministic like the rest of the model: seeded from the ship,
  with no `Math.random` in `lib/`. That keeps e2e and visual tests stable.
- When she breaks, they ride their half (`halfWalkGrid`). When their deck
  goes under, they come off the deck and bob on the surface.

## Non-goals

- Talking to people, giving them jobs, or any passenger simulation beyond
  walking and sitting.
- People below deck or inside cabins.
- Real company logos or free-form drawing on funnels.
- Rust or wear outside the sea floor.

## Anti-goals (would count as failure even if it works)

- Sinkings that turn grim or scary. Floating people bob calmly. There are no
  screams and no bodies.
- Walk mode getting choppy on a phone because of the walkers.
- Old saves or share links that stop loading, or that change how they look
  (other than gaining sensible funnel defaults).
- Side davits that stick out like the old deck-edge arms.

## Cost constraint

The user is token-conscious. The plan names a model for every task: Haiku
or Sonnet for mechanical work, given exact paths and code-level
instructions. Opus only where the design work is truly hard (the funnel
fall and lifeboat launch in the sim, and walker pathing). Each task gets one
combined review with no repeat review rounds. Expensive checks (full
build, e2e) run once per release, not once per task.

## Left to the builder

Exact geometry, colors and timings. Data shapes and migration details. How
walkers path-find on the grid. How the funnel fall is modeled in the sim.
The test split between unit tests, e2e tests and visual baselines (visual
baselines are Linux-rendered from CI; see memory). Each feature is its own
release (minor bumps).
