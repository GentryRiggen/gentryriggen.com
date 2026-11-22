# Shipwreck 1.3 — Walk the decks

A first-person walk mode for `/shipwreck`: stand on the open decks of the
Titanic or the Lusitania while she sinks, feel the deck tilt under you,
slide when it gets too steep, and end up in the water watching her go.
Builds on the 1.0, 1.1 and 1.2 specs, which still hold for everything this
document does not change.

## Why

Gentry's sons (6 and 8, iPad mini 6) want "to be walking around on the
boats while they're sinking". The long-term goal from 1.0 was "go inside
certain places, see things as it sinks"; this is the first step: open decks
now, rooms later.

## Decided with Gentry (2026-11-21)

- **First person.** You see through the walker's eyes; no body, hands or
  character is drawn. This keeps the 1.0 rule: no people shown.
- **Open decks only in 1.3.** Rooms (the bridge, the engine room, the Grand
  Staircase) come in a later release.
- **When the water reaches you or you slide off, you end up in the water.**
  You bob at the surface, can paddle slowly, and watch her go down from sea
  level.
- **Next release, be ready:** the kids will ask to "go down with the ship".
  Build 1.3 so that is a small follow-up (see Later).

## North-star goals (every builder re-reads these)

1. **It feels like standing on her.** Your feet are on her deck and you move
   with her: she settles, lists, tilts bow-down, breaks, and you go with the
   piece you are standing on. Steepness comes from the sim's pose, never a
   script. Past a slope you start to slide downhill; steeper, you cannot
   walk uphill at all.
2. **A 6-year-old can drive it on an iPad.** One thumb walks, the other
   looks. No instructions needed beyond a one-line hint.
3. **Still 60 fps on an iPad mini 6.** Walk mode adds no draw calls beyond a
   joystick overlay; collision is cheap maths on hand-marked areas, no
   physics engine, no raycasts against the model per frame. The 1.0 perf
   budget applies and `e2e/perf.spec.ts` gains a walk-mode scene.
4. **Kind to a young player.** No people, no death counts, no screams, no
   drowning. In the water you are just floating and watching. A parent line
   says what walk mode shows.
5. **The other cameras and ships do not regress.** Every 1.0–1.2 test and
   golden track passes unchanged; walk mode reads the sim, never writes it.

## Goals

- A **Walk** choice in the camera picker, on the Titanic and the Lusitania.
- Hand-marked **walkable areas** per ship (ship data, not model geometry):
  the boat deck, the forward well deck and forecastle, the aft well deck
  and poop deck (Titanic); the boat deck, forecastle and stern decks
  (Lusitania). Each area is a polygon in the ship frame on a named deck;
  height at any point is `deckZAt(deck, x)` (deck height plus sheer).
- **Blockers** inside areas: funnel bases, deckhouses, skylights, cranes,
  ventilators, davits, as boxes or circles. Railings bound the areas.
- **Stairs/ladders** linking areas at a few historical spots (e.g. well-deck
  ladders): walking into one moves you to the other deck smoothly.
- **Tilt and slide.** Each frame the deck's slope under you comes from the
  current pose of your piece (pitch, roll). Below ~10° you walk normally;
  10°–20° you are pushed downhill and walk slower uphill; above ~20° you
  slide and cannot climb. Numbers are tuning, documented in code.
- **Your head stays level.** Like a real person on a tilted deck, the view
  stays level with the horizon (no camera roll or pitch from her list or
  trim); you see the deck slope away under you and the railings lean. This
  matters on the Lusitania, whose sim list reaches 18–67°.
- **Railings.** Below the slide threshold a railing is a wall. Once you are
  sliding (above ~20°), the downhill railing no longer holds: you tumble
  over it into the sea. Open ends (the break, a submerged deck edge) never
  hold.
- **Water on the deck.** Water on deck below your waist slows you (wading,
  half speed at knee depth) and pushes you gently downhill. When it reaches
  your waist (~1 m over your feet) you go in, before the camera is near
  the waterline (no drowning look).
- **Off the deck → in the water.** You go in at waist-deep water, when you
  tumble over a railing, or when you slide off the broken end. A
  short splash, then a sea-level float view: you bob on the waves, can
  paddle slowly (same joystick), and look anywhere. You cannot climb back
  on (matches reality; a Back-on-deck button respawns you on the boat deck
  if she is still afloat, for kids who want another go).
- **Time.** Walking runs in real time at any playback speed; the ship moves
  at the chosen speed. Seeking the timeline while walking puts you back on
  the boat deck at that time (or in the water if that deck is already
  under).
- **The break.** You ride whichever piece you stand on. If you are over the
  break when it happens, you slide toward the open end.
- **Night look stays honest.** The decks are as lit as the scene already
  lights them; no extra lights for the walker beyond a faint ambient lift
  so a child can see where they are walking.

## Non-goals (1.3)

- Rooms or anything below the open decks.
- Showing other people, lifeboats being boarded, or the walker's body.
- Walking on the Edmund Fitzgerald (see Calls).
- Climbing, jumping, swimming underwater, or swimming to a lifeboat.

## Anti-goals (fail even if it technically works)

- Falling through a deck, getting stuck in a funnel, or jittering on a
  slope.
- Motion sickness: no head bob, no camera roll beyond the ship's own list,
  smooth turning.
- Anything that reads as dying: no fade to black, no "you drowned".

## Approaches

1. **Hand-marked walkable areas in ship data (picked).** Polygons, blockers
   and stairs per ship; feet follow the known deck heights; slope from the
   pose. Cheap, robust, can't fall through. About an hour of marking per
   ship. Gentry left the how to us; this is our pick.
2. **Feel for the model's floor each frame (raycasts).** Works for any ship
   automatically, but the models have gaps and railings and weren't built to
   be stood on: falling-through bugs and an iPad frame-rate cost.
3. **A physics engine (e.g. Rapier).** Most realistic sliding, but a big new
   download and per-frame cost on the iPad. Overkill.

## How (the parts decided)

- New `CameraId` `"walk"`, driven by a walk controller alongside the free
  camera in `CameraRig`. It keeps a walker position in the **ship frame of
  its piece** (whole, bow or stern) and turns it into world space through
  that piece's pose each frame, the same way the free camera rides a part.
- Ship data: optional `walk` on `ShipSpec` (areas, blockers, stairs,
  spawn point on the boat deck). Ships without it hide the Walk choice.
- Pure, unit-tested walk maths in `lib/shipwreck/walk/` (step, collide,
  slope, slide, on-deck/in-water checks), no three.js imports, so it can be
  tested headless against real sim tracks.
- Touch: left half of the screen is a floating joystick (appears where the
  thumb lands); right half drags to look. Desktop: WASD/arrows to walk,
  drag or mouse to look. Eye height 1.6 m.
- In the water: camera at the sea surface (waves from `Sea`), slow bob,
  joystick paddles at ~0.5 m/s, never under the surface.
- Analytics: if walk mode gets an event, it follows the gameEvents rules
  (closed enums only; schema, rules and dashboard together). Builder's call
  whether to add `camera: "walk"` to an existing enum.
- Release: Shipwreck 1.3.0 (minor), changelog entry, help text and parent
  line updated. Ships after 1.2.0 (the Edmund Fitzgerald) merges; this
  branch rebases on it then.

## Calls we made (Gentry may revisit)

- **No walking on the Edmund Fitzgerald.** Her 1.2 spec says no dwelling on
  the last moments (a 1975 loss with living families); standing on her deck
  as she dives would. Walk is offered on the Titanic and the Lusitania.
- **Slope thresholds ~10° / ~20°.** The Titanic only gets that steep in her
  last minutes, so most of the night is normal walking; that is honest.
- **Back on deck button** after going in, so a kid can try again.
- **No body or hands drawn,** even a shadow.
- **Level head** (no camera tilt with the ship), **railings give way only
  once sliding**, **in the water at waist depth.** Settled by us after the
  builder check.

## Later (be ready)

- **Go down with the ship** (next ask): stay on deck as she goes under; the
  view goes under with you into the dark, like the underwater camera. 1.3
  should make this a switch: the "in the water" check is one function the
  next release can change.
- Rooms: the bridge, the engine room, the Grand Staircase, the Lusitania's
  dining saloon, built from the existing places list.

## Left to the builder

- Exact polygons, blockers and stairs from the general arrangement plans
  (cite them in the ship data).
- Joystick look and the one-line hint text.
- Collision details (slide along walls, step-up limit at stairs).
- The perf scene's exact framing.
