# Ship Builder: Drive mode (Sail)

Date: 2026-10-05. Target release: 2.9.0, shipped in four stages.

## Goal

Let the player drive the ship they built in a free-sail sandbox: steer and set
the throttle, look from three views, choose which obstacles to sail among, and
see what happens if they hit one. A hard hit hands off to the existing sea
trial sinking sequence, so design choices still matter.

Touch-first (tablet and phone), with keyboard as a bonus. No score or goals in
this release; they can be layered on later.

## Approach

A new Sail mode with a ship-in-world model. The sail state holds the ship's
position, heading and speed. The scene keeps the ship at the origin and moves
the world around it, so the ocean, sky, bobbing and `CameraRig` keep working.

Rejected: moving the ship through a fixed world (touches ocean, sky, camera
follow and trial code that assume the ship sits at the origin) and bolting
steering onto the scripted sea trial (wrong structure).

## 1. Sail model (`lib/ship-builder/sail/`)

Pure TypeScript, no React or three.js, fixed step, deterministic, no
`Math.random`. Same style and test approach as `sim/`.

- **State:** position `(x, z)`, heading, speed, rudder and throttle inputs,
  and the obstacle list (id, kind, position, radius; other ships also have a
  heading and speed).
- **Input:** throttle -0.3 (slow reverse) to 1; rudder -1 to 1. Both are
  smoothed, so the rudder eases over instead of snapping.
- **Handling:** `handlingFromShip(stats, kind, beam)` returns top speed,
  acceleration, turn rate and turning inertia. Top speed comes from the speed
  stat. Bigger and heavier means slower to turn and stop. Kind shifts the feel:
  navy nimble, cargo ponderous, liner and cruise between.
- **Motion:** speed eases toward throttle x top speed. Turn rate scales with
  speed (none at a standstill) and rudder. Banking into turns is visual only
  and never feeds the capsize sim.
- **Collisions:** the hull is a capsule or oriented box from length and beam.
  A hit returns an `impact` (obstacle, point along the hull as bow, side or
  stern, closing speed). Buoys are soft: a bump, no damage. Icebergs, rocks
  and other ships are hard hits.
- **Hand-off:** a hard hit gives the existing sea trial a strike spot and
  strength.

## 2. Scene, views and obstacles

**Scene.** The sail position drives an offset on obstacles and on the ocean's
wave and texture phase, so the sea scrolls past. Wake and propeller bubbles
scale with speed. Obstacles are small meshes: icebergs reuse `Iceberg`; rocks,
buoys and other ships are new low-poly pieces in the same style.

**Endless sea.** Obstacles are scattered in a ring around the ship and
recycled behind it, with a deterministic seed per sector, so the sea feels
endless without a large object count. The ocean surface already exceeds the
view.

**Views.** Three, switched from a view button in the drive HUD, separate from
the builder's camera presets.

- Chase: behind and above, swings with heading, pulls back as speed rises.
- Top-down: overhead, follows the ship, with obstacle markers so hazards show
  early.
- Bridge: first person from the wheelhouse, looking over the bow, with the
  wheel and class instruments overlaid. With no bridge part, it falls back to
  a default height near the front of the superstructure.

**Obstacle picker.** Shown before sailing. Toggles for icebergs, rocks, buoys
and other ships, plus a density control (few, some, many). "Set sail" seeds
the field and starts. Choices persist in local storage and are not part of the
saved ship.

**Entering and leaving.** A "Drive" button sits next to the Sea Trial button.
Leaving returns to the builder with the ship unchanged. A hard hit ends the
drive and plays the sinking sequence, then the result card.

## 3. Controls, class wheels, testing

**Controls.**

- Wheel: draggable, bottom-left, sets the rudder, springs back to centre.
- Throttle: vertical lever, bottom-right, with stop, reverse and ahead.
- Keyboard: arrows and WASD, Space to stop.
- Hit targets at least 44px; pointer events and `touch-action: none` on the
  wheel and lever so the page never scrolls while driving.
- `prefers-reduced-motion` turns down camera sway and wake effects.

**Class look.** A `controlsForKind` table drives both the HUD controls and the
bridge view.

- Liner: wooden spoked wheel, brass telegraph lever.
- Cruise: small modern wheel, glass console.
- Navy: compact grey helm, joystick-style lever.
- Cargo: large plain wheel, simple industrial lever.

**Testing.**

- Unit: handling per kind, turn and speed limits, collision geometry, the soft
  buoy bump, the hard-hit hand-off, deterministic obstacle seeding.
- Component: wheel, lever, picker.
- E2E: one `@smoke` Playwright test for the main path (enter Drive, pick
  obstacles, sail, steer, switch views, hit an iceberg, reach the sinking
  result).

## Stages

1. Sail model with tests.
2. Sail scene and chase view, picker, trial hand-off.
3. Top-down view.
4. Bridge view with class wheels.

Each stage is its own commit. `SHIP_BUILDER_VERSION` goes to 2.9.0 for the
feature, with a plain-words changelog entry.

## Risks

- The sea trial assumes a scripted iceberg strike (`icebergMotion.ts`); it
  needs a small refactor to accept an arbitrary hit spot and strength.
- The bridge view needs a camera position per hull layout.
