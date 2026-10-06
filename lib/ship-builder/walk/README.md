# Walk mode model

Pure TypeScript (no React, no three.js, no randomness) for walking a ship in
first person. The scene and controls live elsewhere; this folder is the rules.

- `types.ts` has `WalkState`, `WalkInput`, `WalkGrid` and the constants (speed,
  turn rate, collision radii). The file comment explains the frame: the walker
  lives in the ship's model cells, and `yaw` is a heading in the ship-aligned
  world (yaw 0 looks at the bow).
- `walkGrid.ts` (`walkGridOf(ship)`) works out where she can stand: open main
  deck, the roofs of deck, cabin, bridge and container blocks, the stair links
  between levels, what fills a cell (`obstructionAt`), where an edge drops to
  (`dropLevel`) and the blocking circles for funnels, masts and the like.
- `step.ts` (`stepWalker`) moves the walker one fixed step with sliding
  collision, then applies gravity and jumps. Feet height decides what a move
  may cross (`entering`): a roof one level up once the feet reach it, low decor
  once they are above it, an edge when airborne. Walking alone changes level
  only through stairs.
- `spawn.ts` (`spawnOf`) picks a clear start near the bridge, facing open deck.
  It returns `null` when there is nowhere to stand, which disables the Walk
  button.

Where the rest lives: the `walk` store slice and `state/walkLive.ts`,
`state/walkInput.ts`; the scene in `components/ship-builder/scene/`
(`WalkRunner`, `WalkEyes`, `walkCamera`); the controls in
`components/ship-builder/ui/` (`WalkButton`, `WalkHud`, `WalkJoystick`,
`WalkLookLayer`) and `hooks/useWalkKeys.ts`.

Tests: the model's unit tests are in `__tests__/`, and
`e2e/ship-builder-walk.spec.ts` drives it in a real browser through the
`window.__shipBuilderWalk` and `walkSpawn` test hooks (see
`scene/testClock.ts`).
