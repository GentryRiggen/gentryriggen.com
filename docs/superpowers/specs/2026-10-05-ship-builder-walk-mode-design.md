# Ship Builder: Walk mode (deck stroll)

Date: 2026-10-05. Target release: 2.10.0.

## Goal

Let the player walk their ship in first person: stroll the open decks and
climb stairs. No cabin interiors, no jumping, no ladders.

## Decisions

- First person only.
- Not available during a sea trial in v1, but the design must not rule it out.
- Drive to Walk handoff is not in v1, but the design must not rule it out.
- Touch-first (virtual joystick plus drag to look), keyboard and mouse as a
  bonus.

## Behaviour

- A "Walk" button sits beside Drive and Sea trial. It enters Walk mode;
  "Stop walking" returns to the builder with the ship unchanged.
- Walkable: the main deck, plus any deck block or cabin roof reachable by
  stairs.
- Blocked: cabins and other solid blocks, pools, deck chairs and other decor,
  funnels, masts, turrets, cranes and other attach parts (a small blocking
  circle each), and the hull edge (treated as railings).
- Stairs are the only way between levels, up and down. Roof edges stay railed.
- Building is frozen while walking (like Drive). A trial cannot start while
  walking; Drive and Walk are mutually exclusive. The sea stays calm and the
  ship bobs gently under the player.

## 1. Walk model (`lib/ship-builder/walk/`)

Pure TypeScript, no React or three.js, fixed step, deterministic.

- `walkGridOf(ship)`: derived from `occupancyOf`. Per column it records the
  floor level, solidity, stair links (via `facingCell` and
  `climbsToFacedBlock`) and blocking circles for attach parts (positions from
  `resolveAttachPoint`).
- `stepWalker(state, input, grid)`: moves in the ship's own frame with
  sliding along walls; changes level only through stairs. State is position,
  yaw and floor level.
- `spawnOf(ship)`: a clear main-deck spot, preferring one near the bridge or
  the middle of the ship; returns null when no deck is clear (Walk is then
  disabled with a hint).
- The walker lives in the ship's frame, so a later version can carry it with a
  tilting or sinking ship.

## 2. Scene, controls, HUD

- First-person camera at a tuned eye height (a cell is a few metres, so this
  is tuned against screenshots), inside the ship's bob group, small near
  plane.
- Touch: virtual joystick bottom-left to move, drag elsewhere to look. 44px
  minimum targets, `touch-action: none`.
- Desktop: WASD, mouse drag to look, Escape to stop.
- Store: a `walk` slice (`idle | walking`) beside `drive`, with the same
  freeze and chrome-hiding.
- Reduced motion: no head bob.

## 3. Testing and release

- Unit tests for the model, joystick, HUD and keys.
- Real-render checks on iPad and phone sizes before sign-off.
- One `@smoke` e2e: load a ship, tap Walk, move, climb stairs, stop.
- Version 2.10.0 with a plain-words changelog entry.

## Later (not v1)

- Walk during a sea trial (carry the walker with the ship's pose).
- Walk from the bridge while driving.
- Cabin interiors, interactions (pool, slide, climbing wall).

## Risks

- Eye height and scale need a visual pass.
- First-person exposes geometry seen only from afar today; check
  tablet frame rate.
- Each of about 40 part types needs a rule (floor, wall, climbable, passable
  decor).
