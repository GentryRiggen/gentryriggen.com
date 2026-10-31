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
    `crowdGraphOf(ship, grid, { jumps: true })` is the same nodes (same
    indices) plus hops: side-by-side columns one level apart that no stair
    joins, both ways, when the line between them misses every blocker at
    both levels. Only the Fill every seat rush uses it (cached separately);
    the everyday crowd keeps to the stairs.
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

`lifeboatCount(ship, stats)` (`lifeboatCount.ts`) is the real sum behind
"did we build enough lifeboats?": `seats` adds the catalog seats of every
lifeboat hanging from a `davit` or `davit-side` and of every `raft-canister`
on a block's deck edge (both from `hungLifeboats`, which tags each `davit` or
`raft`), `people` is passengers plus crew berths. Real counts, not figures
(the Titanic: 1098 seats, 2300 aboard).

`evacuation.ts` plans a sinking for the iceberg and storm trials:

- `planEvacuation(ship, grid, crowd, timeline)` is null unless the trial
  floods (`floodOf(input)`, iceberg or storm) and ends `sank`. Doom is the
  first `flooding` event (the iceberg strike, or the storm's first wash
  aboard at 10 s), or the first `sank` state if there is none, so the whole
  flooding stretch is there for boarding. Before doom everyone follows the
  crowd plan exactly. A capsize in the waves trial gets no plan.
- `input.lifeboats` picks how the boats fill: absent or `titanic` is Like
  the Titanic (below, unchanged), `fill` is Fill every seat (its own
  section). Either way every davit boat and raft launches, riders or not. The result
  card's lifeboat line uses the real counts (`lifeboatCount`), not figures.
- Boats are lifeboat parts (catalog `seats > 0`) hanging from a `davit` or
  `davit-side`, and raft canisters on a deck edge. A boat's boarding spot is
  the walkable column nearest it on the davit's (or raft's) deck: the point's
  cell or the one inboard, on the block's roof or the block's own level. A
  boat with no spot gets no riders but still launches.
- Rafts (`launch.kind === "raft"`) are thrown, not lowered: riders wait at
  the spot while the canister falls (`RAFT_DROP_S`, landing `RAFT_THROW`
  outboard) and opens (`RAFT_INFLATE_S`); from `launch.ready` they jump in
  one after another (`JUMP_GAP_S` apart, `JUMP_S` each, fate `jumping` with
  the world point they left), and from `launch.departs` (the last one in) it
  drifts `RAFT_DRIFT` outboard over `RAFT_DRIFT_S`. A raft launches early
  enough for all that before the water reaches its spot. A rider the water
  reaches before their jump floats (Fill every seat: fades into the raft).
  Like the Titanic:

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
  `LOWER_S`, rows it `ROW_OUT` outboard over `ROW_S`, then bobs (both
  modes).

Fill every seat (`lifeboats: "fill"`), so a kid can see whether there were
enough boats:

- Saved figures: all of them when `lifeboatCount` seats >= people, else
  `round(figures * seats / people)`. Nobody is saved with no davit boats.
- Each boat's share of the saved is by its seats (largest remainder), with
  no `BOAT_SHOWN_MAX` cap and no odd-hash halving. People are matched
  nearest first: a walk on the jump graph (same half once she breaks),
  then anyone with no way there, by straight distance.
- A rider with a way walks it (hops included). One with none stands still
  and fades out over `FADE_S` (fate `transfer`, `fade` 0 to 1), and is in
  the seat at doom plus the straight distance at `PERSON_SPEED` (at least
  `FADE_S`). A walker the water would catch fades out just before it and is
  seated as it would have reached them.
- A boat waits for all of its riders (no `LAUNCH_WAIT_S`; an empty boat
  still uses it), but leaves no later than the water reaching its boarding
  spot (and `LOWER_S` before the timeline ends). Anyone not seated by then
  fades out over the last `FADE_S` and is seated as she leaves. So every
  saved figure ends `in-boat`.
- The rest do as in Like the Titanic: follow the crowd plan,
  wander on their half once she breaks, float when the water reaches them.

Everything is worked out when the plan is made; `fateAt`, `poseAt` and
`boatPoseAt` only read it, so they are pure in `t` and cheap.

`floatingSince(poseAt, bodyAt, from, to, frame)` is the water check on its
own, and `floatPositionAt` the drift. The plan uses them, and so does the
scene in a trial with no plan (the waves trial, or a sinking she survives),
checking each frame.

The scene (`components/ship-builder/scene/`) draws it: `Crowd.tsx` poses
everyone in one frame callback as a few instanced meshes (`crowdBodies.ts`),
riding the ship's group or her halves (`CrowdCarrier.tsx`), in their boats, or
afloat; a `transfer` shrinks to nothing where they stand. `boatSeatOffsets`
(`crowdView.ts`) seats up to `BOAT_SHOWN_MAX` in one row and packs more in
two rows, so every Fill every seat rider shows (at most `MAX_PEOPLE`, so the
instanced meshes keep their size). `LaunchedBoats.tsx` draws each boat once
it leaves its davit (a raft: its canister tumbling down, then the orange raft
growing open), `Crowd.tsx` arcs a `jumping` rider from the deck edge to their
raft seat, and `ShipParts` hides the one on the davit.
`scene/trialTimeline.ts` caches the plan beside the trial's timeline, per
descent and lifeboat choice.

On the Titanic, boats lower from 1 to 12 s after the strike, well before
the bow goes under at about 22 s. Her decks are joined only by jumps (she
has no stairs, and the plain crowd graph has no jump steps), so like the
Titanic only the people on the boat deck at the strike can reach a boat.
They all walk to one. Filling every seat, the jump graph joins all her
decks: 11 of 24 figures (1098 of 2300) are saved, every one walking (and
hopping) to a boat, and 13 are left aboard. The storm evacuates the same
way from its first wash aboard.

Tests: `__tests__/plan.test.ts`, `__tests__/evacuation.test.ts`.
