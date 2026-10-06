# Ship Builder: Walk on the sinking ship

Date: 2026-10-06. Target release: 2.13.0 (stage 1). Stage 2 is a later release.

## Goal

Let the player walk the decks while the ship sinks, and sink her from walk mode
with one tap. The walker rides the ship down; nothing about the walk physics
changes.

## Decisions

- **Ride-along.** The deck stays flat for the walker: no sliding on a slope, no
  walls-as-floors. The ship's roll, pitch and sink carry the walker with her.
- **Anytime.** Walk can start before a trial or while one is running.
- **"Hit with an iceberg"** is one tap in the walk HUD: an iceberg at a fixed default
  spot, `impactX = 0.2 * hull length` (cells from the bow), the existing sim.
  No aiming, no waves option.
- **Ending.** The walker rides her down until she is under; then the existing
  result card shows and the walk ends.
- **Tilt comfort.** Full tilt by default; under `prefers-reduced-motion` the
  eye's roll and pitch are capped at about 25 degrees.
- Out of scope: slope physics, drowning, flooded decks, break-in-two (stage 2).

## Behaviour

1. Walk and trial may be active together. The store guards that forbid it come
   out: `startTrial` no longer refuses while walking, `startWalk` no longer
   refuses during a trial. `aimIceberg` and anything else that edits or
   re-aims the ship stay refused while walking. The Walk button shows during a
   running trial (the Sea trial button stays hidden then, as today).
2. `finishTrial` also calls `stopWalk`, so the result card appears over the
   normal scene. Leaving the result returns to building as today.
3. A new store action `sinkWhileWalking()` starts the iceberg trial from the
   walk state and leaves `walk` untouched. The HUD button calls it, and shows
   only while walking with `trial.status === "idle"`.
4. Walk is hidden once she has broken in two (`trialPlayback.breakup` set), so
   a walk never has to pick a half. Walkers already aboard when she breaks are
   stage 2; until then the walk simply ends at the break (as a result would).
5. Spawn is unchanged (`spawnOf`). A mid-trial walk spawns near the bridge as
   usual, so she may already be tilted when you step out.

## Camera (the tricky part)

`WalkEyes` sits inside `BobGroup`, which already applies the trial pose, so the
eye already moves with the ship. Today it keeps only `WALK_SWAY_SHARE` = 25% of
that motion and a level horizon. At 40 degrees of pitch that would float the
eye off the deck.

- Ramp the sway share from 25% to 100% with `BobGroup`'s trial blend (the
  0 to 1 weight it already computes), so a calm walk is unchanged and a
  sinking walk is bolted to the deck.
- At the same ramp, let `camera.up` follow the ship's roll and pitch instead
  of being fixed at world up, so you see the deck tilt rather than the sea
  swinging. Reduced motion caps that tilt at 25 degrees (eye position still
  follows the deck, so the walker never floats off it).
- The blend value moves out of `BobGroup` into something both can read
  (a field on `trialPlayback` or a small shared module), so the two never
  disagree.

## Files likely touched

- `lib/ship-builder/state/store.ts`: lift the two guards, `sinkWhileWalking`,
  `finishTrial` ends the walk.
- `components/ship-builder/scene/BobGroup.tsx`, `WalkEyes.tsx`: shared blend,
  ramped sway share and tilt.
- `components/ship-builder/ui/WalkHud.tsx`, `WalkButton.tsx`: Sink button, Walk
  shown mid-trial.
- `components/ship-builder/ShipBuilder.tsx`, `CameraRig.tsx`: walk camera wins
  over the trial's follow camera while both are active.
- `lib/ship-builder/version.ts`, `changelog.ts`: 2.13.0 entry.

## Testing

- Unit: store transitions (walk to sink to result ends the walk; guards still
  refuse edits), sway share and tilt cap as pure functions, the default impact
  point.
- E2E (`@smoke`-tagged): walk, press Hit with an iceberg, wait for the result card,
  walk is gone. Uses the existing `window.__shipBuilderWalk` and trial test
  hooks.

## Stage 2 (separate release)

Break in two: the walker rides whichever half they stand on (the break-line
cell counts as the bow half), through `halfMatrix`; the break line blocks
crossing, and the walk-button hiding in point 4 is lifted.

## Changes made while planning

- `startTrial` keeps its walk guard. A separate `sinkWhileWalking()` starts the
  trial, so nothing else can start one mid-walk. `startWalk` is what loses its
  guard (it may start while a trial is `running`; still not while aiming or at
  a result).
- The reduced-motion tilt cap is dropped. Reduced-motion trials are instant, so
  there is never a sinking to ride and nothing to cap.
- `SeaTrialStatus` must not steal focus when the run starts while walking:
  Space is the jump key and would press its focused Stop button.
