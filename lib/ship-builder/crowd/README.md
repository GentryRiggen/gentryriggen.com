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
  - `crowdGraphOf(ship, grid)` is the walking graph. It blocks only what
    blocks the player (`walk/step.ts`). A walkable column counts when the
    player fits somewhere in it (clear of every blocker by `WALKER_RADIUS`
    plus its radius), and its centre is outside every blocker's circle. A
    step between two centres counts when the line between them misses every
    blocker's circle. So a davit on the deck edge leaves its cell open, and
    a funnel on a one-cell block closes it. Columns are joined by
    `grid.stepLevel` (so level changes only happen on stairs), plus
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

`evacuation.ts` plans a sinking for the iceberg trial (Task 4 draws it):

- `planEvacuation(ship, grid, crowd, timeline)` is null unless the trial is an
  iceberg trial that ends `sank`. Doom is the iceberg strike (the first
  `flooding` event), or the first `sank` state if there is none, so the
  whole flooding stretch is there for boarding. Before doom everyone
  follows the crowd plan exactly.
- Boats are lifeboat parts (catalog `seats > 0`) hanging from a `davit` or
  `davit-side`. A boat's boarding spot is the walkable column nearest it on
  the davit's deck: the davit's cell or the one inboard, on the block's roof
  or the block's own level. A boat with no spot gets no riders but still
  launches.
- At doom, people are matched to boats nearest first (one BFS from each
  spot, `crowdGraphOf(...).reachFrom`), up to `min(BOAT_SHOWN_MAX, seats)`
  per boat, halved when the boat id's hash is odd. If the timeline breaks
  her, routes use the half grid (`halfWalkGrid`) of the half they stand on
  from doom on, so nobody heads for a boat that will be torn away.
- A boat launches at its last rider's arrival, `doom + LAUNCH_WAIT_S`, or
  when water reaches its spot (checked every 0.25 s), whichever is first.
  Late boarders go back to wandering from where they are. Extras follow the
  crowd plan, then wander on their half once she breaks. Anyone not in a
  boat floats from the first check that finds them at world `y <= 0`
  (`poseWorldPoint` on the body that carries them), drifting outward.
- `boatPoseAt` lowers a boat from its launch `origin` to the water over
  `LOWER_S`, rows it `ROW_OUT` outboard over `ROW_S`, then bobs.

Everything is worked out when the plan is made; `fateAt`, `poseAt` and
`boatPoseAt` only read it, so they are pure in `t` and cheap.

On the Titanic, boats lower from 1 to 12 s after the strike, well before
the bow goes under at about 22 s. Her decks are joined only by jumps (she
has no stairs, and the crowd graph has no jump steps), so only the people on
the boat deck at the strike can reach a boat. They all walk to one.

Tests: `__tests__/plan.test.ts`, `__tests__/evacuation.test.ts`.
