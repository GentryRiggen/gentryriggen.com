# Shipwreck: ride a lifeboat — design

Date: 2026-11-24. Status: awaiting Gentry's approval.

## Why

Both of Gentry's sons want to get into a lifeboat, ride it down the side as
the ship sinks, and watch her go from safely out on the water. Ship Builder
has a version of this (2.39.0, "Board"), but Shipwreck should stay simple:
one picture button, no new control scheme.

## Goals

- From walking: stand next to a lifeboat still in its davits, tap a big boat
  button, and you're sitting in it.
- From the outside (orbit) view: the same button puts you in the next boat
  due to leave, so no walking is needed.
- The boat you're in is lowered **straight away** (Gentry agreed: fun over
  realism, same rule as walking). It swings out, goes down the falls,
  splashes in, and rows or motors away on the course that boat already takes.
- In the boat you can drag to look around. The first view faces the ship.
- One "Back on deck" button to get out. It works like walk mode's.

## Non-goals

- Jumping while walking (a separate ask).
- Rowing or steering the boat yourself, other people in the boat, new boat
  models, new sounds.
- Changing the sim: boats stay visual. Sinking times and events don't change.
- New analytics events (adding one means editing the schema, the rules and
  the dashboard; left for later).

## Anti-goals

- No reading needed: picture buttons only, like the rest of the kid UI.
- No HUD clutter: the button only shows when a boat can be boarded.
- No hitch or frame drop when boarding on an iPad mini 6.

## Approaches

1. **Picked: boat button from walking and from the top bar, boat lowers
   now.** It reuses the scripted boats (`boat-lowered` events plus
   `Effects.tsx`), walk mode's state and look controls, and the big round
   buttons.
2. Tap a boat in the 3D outside view. Dropped: the boats are tiny touch
   targets on an iPad and hard to find.
3. Board, then wait for the boat's real lowering time. Dropped: on some
   boats the wait is 20+ minutes of story time, and kids would think it's
   broken.

## How it works

- **State:** `walk.phase` gets a third value, `"boat"`, alongside `deck` and
  `water`, plus `boat: { model index, boat index, boardedAt (sim t) }`.
  `camera` stays `"walk"`.
- **Lowering now:** `Effects.tsx` takes the lowering time of the boarded boat
  from `boardedAt` instead of its scripted event. Every other boat keeps its
  real time. The launch cache for that boat is cleared when boarding, so its
  start point on the water is worked out again.
- **Which boats can be boarded:** any boat that is still stowed at the
  current `t` (its scripted lowering time is later than now) on a ship that
  has `boat-lowered` events. While walking, the button shows when the walker
  is within about 4 m of that boat's davit position (from the boat's recipe
  `info()`). From the outside view, it boards the next stowed boat by
  scripted time. If no boats are left, or the ship is the Edmund Fitzgerald
  (no boat events), no button shows.
- **Camera:** a seat about 1.2 m above the boat's centre, carried by the
  boat's matrix every frame (davits, falls, then afloat). The look drag
  reuses `WalkLookLayer`. There's no joystick while in the boat.
- **Seek and time:** play speed is unchanged. Seeking to before `boardedAt`
  takes you out of the boat and back to the orbit view. Seeking later keeps
  you riding. A new ship or Restart ends the ride.
- **The Concordia:** her boats motor in to Giglio Porto on their route, and
  so does yours.
- **Release:** a minor version bump to the next free Shipwreck version, with
  a changelog line a kid could follow.

## Left to the builder

- Icon art for the boat button (an existing `Icon.tsx` style).
- The exact seat height and the starting look direction per boat side.
- Whether the walk HUD's "Back on deck" button is reused or copied for the
  boat.
- Tests: a playback-store test (board, seek back, seek forward), an Effects
  or boat-timing unit test for the lowering override, and one Chromium e2e
  (walk to a boat, board, the boat reaches the water).
