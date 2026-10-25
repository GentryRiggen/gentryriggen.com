# Crowd model

Pure TypeScript (no React, no three.js, no `Math.random`) for the people who
wander the decks in walk mode. The scene draws them elsewhere; this folder
plans where everyone is at every moment.

- `types.ts` has `Person`, `PersonPose`, `Seat`, `CrowdPlan` and the
  constants (`MAX_PEOPLE`, `PERSON_SPEED`, sit and pause times, the outfit
  count). Poses use the walker's frame and yaw convention (`walk/types.ts`).
- `rng.ts` is a seeded PRNG (`mulberry32`), an FNV-1a string hash and a
  `between` helper. The ship's seed hashes its name, part count and length;
  each person's stream is `seed ^ (i * 0x9e3779b9)`.
- `plan.ts`:
  - `crowdSize(stats)` turns passengers and crew berths into figures, one per
    40, at most `MAX_PEOPLE` between them, with at least one crew member when
    she has crew berths.
  - `seatsOf(ship, grid)` finds deck chairs and benches with a floor under
    them and an open neighbour. A seat faces its part's rotation (rotation 0
    faces the stern, the same as `scene/facingYaw.ts`). The seat's own cell is
    decor, so the walk grid never calls it walkable: people step into it from
    a neighbour to sit and step back out to leave.
  - `crowdGraphOf(ship, grid)` is the walking graph: walkable columns whose
    centre is clear of blockers by `ATTACH_BLOCK_RADIUS + WALKER_RADIUS`,
    joined by `grid.stepLevel` (so level changes only happen on stairs), plus
    seat cells that are only ever an end point. Its BFS (`reachFrom`,
    `pathTo`) is cached per grid and ship parts, for later planners to reuse.
  - `planCrowd(ship, grid, stats)` starts everyone on distinct, spread-out
    columns, then builds each schedule as legs: walk (cell centre to cell
    centre at `PERSON_SPEED`, facing the way they go), sit (on the seat,
    facing it), idle (a pause from `PAUSE_S`). The next goal is a free seat
    with chance 0.35, otherwise a column within 8 steps. A claim table keeps
    two people out of one seat, and two idle people off one cell, at once.

`poseAt(i, t)` extends every schedule lazily, always growing the one that
ends first, so the plan is the same however and in whatever order it is
asked; then it binary-searches person `i`'s legs. While walking, a person's
level is the level of the cell they are in, so a stair crossing switches
level at the cell edge.

Tests: `__tests__/plan.test.ts`.
