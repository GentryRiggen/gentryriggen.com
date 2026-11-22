# Shipwreck 1.2 — Walk the decks

A first-person walk mode for `/shipwreck`: stand on the open decks of the
Titanic or the Lusitania while she sinks, feel the deck tilt under you,
slide when it gets too steep, and end up in the water watching her go.
Builds on the 1.0 and 1.1 specs, which still hold for everything this
document does not change.

## Why

Gentry's sons (6 and 8, iPad mini 6) want "to be walking around on the
boats while they're sinking". The long-term goal from 1.0 was "go inside
certain places, see things as it sinks"; this is the first step: open decks
now, rooms later.

## Changed in 1.3.2 (Gentry, 2026-11-22)

"Walking is way too slow, and we should probably just remove the whole
sliding off of it … just walking is the whole idea of it's fun, not
necessarily realistic." On the Lusitania you slid off early and floated
away from her. So: walking 4 m/s (was 1.4), paddling 2 m/s (was 0.5), no
slope push or slide, every railing and the break hold, and you go in only
at waist-deep water. The slide arrows and the deck scrape are gone. Where
this spec says otherwise below, this wins.

## Decided with Gentry (2026-11-21)

- **First person.** You see through the walker's eyes; no body, hands or
  character is drawn. This keeps the 1.0 rule: no people shown.
- **Open decks only in 1.2.** Rooms (the bridge, the engine room, the Grand
  Staircase) come in a later release.
- **When the water reaches you or you slide off, you end up in the water.**
  You bob at the surface, can paddle slowly, and watch her go down from sea
  level.
- **Controls for kids who don't read well yet** (Gentry, 2026-11-21: "these
  are 6 and 8 year olds who don't read great. They need obvious and good
  layout"). Every walk control is a big picture button, understood without
  reading; words only as `aria-label` and tiny captions. See Controls.
- **You can watch her go to the bottom from the water.** A Look under button
  dips your eyes just below the surface to follow her down (see Look
  under).
- **Next release, be ready:** the kids will ask to "go down with the ship".
  Build 1.2 so that is a small follow-up (see Later).

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
5. **The other cameras and ships do not regress.** Every 1.0–1.1 test and
   golden track passes unchanged; walk mode reads the sim, never writes it.

## Goals

- A big **Walk** button on the right rail (see Controls), on the Titanic
  and the Lusitania.
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

## Controls (a 6-year-old, no reading)

- **Walk button on the right rail**, always visible while she is on the
  surface, not hidden in the camera picker: a big round button (at least
  64 px, the rail's largest) with a walking-figure pictogram. One tap puts
  you on the boat deck. It glows/pulses once the first time the game shows.
  It is also listed in the camera picker for completeness.
- **While walking**, the screen shows only:
  - a **drawn joystick** bottom-left (a visible ring with a thumb knob and
    four arrow chevrons, always there, not invisible-until-touched), and
  - a **look hint** on the right: a faint hand-with-arrows pictogram that
    fades after the first drag,
  - one big **Fly button** (the free camera's icon) top-right to leave walk
    mode,
  - play/pause and speed stay as they are; other rail buttons hide to cut
    clutter.
- **In the water**: the joystick stays (paddle), plus two big picture
  buttons: **Back on deck** (ship with an up arrow, only while her boat
  deck is above water) and **Look under** (eye with a down arrow / wave
  line).
- **Feedback over words:** sliding shows downhill arrows at the screen edge
  and a creak/scrape sound; going in plays a splash and a ripple wipe. No
  text pop-ups.
- Touch targets ≥ 64 px, high contrast on the night scene, thumbs never
  cover the joystick and look areas at the same time. iPad portrait and
  landscape both work.

## Look under (from the water)

From the surface at night you could not really see her sink; she would
vanish within metres. To let the kids watch her go to the bottom:

- **Look under** puts your eyes ~1 m under the surface, still floating with
  you, using the underwater camera's look (fog, colour). Tap again (or
  paddle) to come back up.
- While looking under, visibility is stretched (a kid-mode clearer water,
  the underwater camera's fog distance raised) and her lit hull keeps
  faint lights as she falls, so she stays visible as a dim shape going
  down and away. The view tilts down to keep her in frame automatically
  as she sinks, until she is out of sight in the dark; then a gentle
  "she's on the bottom" is shown by a picture card with the wreck (the
  existing end-card art), not text.
- This is the honest bit stretched for kids: a call Gentry may revisit.
  It also is the first half of "go down with the ship".

## Non-goals (1.2)

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
- Touch: a drawn joystick bottom-left (see Controls); the rest of the
  screen drags to look. Desktop: WASD/arrows to walk,
  drag or mouse to look. Eye height 1.6 m.
- In the water: camera at the sea surface (waves from `Sea`), slow bob,
  joystick paddles at ~0.5 m/s, never under the surface.
- Analytics: if walk mode gets an event, it follows the gameEvents rules
  (closed enums only; schema, rules and dashboard together). Builder's call
  whether to add `camera: "walk"` to an existing enum.
- Release: Shipwreck 1.2.0 (minor), changelog entry, help text and parent
  line updated. Ships before the Edmund Fitzgerald, which becomes 1.3.0
  (Gentry, 2026-11-22).

## Calls we made (Gentry may revisit)

- **No walking on the Edmund Fitzgerald.** Her spec says no dwelling on
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
  view goes under with you into the dark, like the underwater camera. 1.2
  should make this a switch: the "in the water" check is one function the
  next release can change.
- Rooms: the bridge, the engine room, the Grand Staircase, the Lusitania's
  dining saloon, built from the existing places list.

## Left to the builder

- Exact polygons, blockers and stairs from the general arrangement plans
  (cite them in the ship data).
- Exact pictogram drawings (in `ui/Icon.tsx`'s style); they must read with
  no words. A screenshot check-in with Gentry before merge.
- Collision details (slide along walls, step-up limit at stairs).
- The perf scene's exact framing.
