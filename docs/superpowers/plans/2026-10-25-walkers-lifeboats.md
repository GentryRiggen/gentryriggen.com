# Walkers on Deck, and Lifeboats That Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Low-detail people wander the decks and sit on deck chairs and benches, in walk mode and during sea trials. When a ship goes down in an iceberg trial, they head for the lifeboats. The boats lower and row away. Anyone left aboard rides her down and then floats.

**Architecture:**

- **Pure models.** Two pure, deterministic models live in `lib/ship-builder/crowd/`: a crowd planner (who, where, a time-indexed schedule of walk and sit legs on the existing `WalkGrid`) and an evacuation planner (boat launches, boarding and floating, from the crowd plan plus the trial timeline). Because both are functions of time, scrubbing, "Try again" and replays all work for free.
- **Thin scene layers.** The scene reads them: people are drawn in the ship's model frame (inside the ship or half group) while aboard, and in world space once in a boat or in the water. Launched boats are drawn in world space and their attached part is hidden, the same pattern as the falling funnels.

**Tech Stack:** TypeScript (pure lib), three / @react-three/fiber, Jest.

**Spec:** `docs/superpowers/specs/2026-10-25-ship-builder-life-aboard-design.md` (section 5)

## Global Constraints

- People are low detail: a body, a head, and maybe arms. Passengers wear varied bright clothes. Crew wear one matching uniform.
- They only go where it makes sense to stand (`walkGridOf(ship)`: open deck and roofs, stairs between levels), and never through funnels, masts or walls. They sit on free deck chairs and benches for a while, then wander on.
- The count scales with cabins (passenger and crew berths), with a hard cap of **24** on screen.
- You can't really interact with them. The player passes straight through them.
- They show in walk mode **and** during sea trials, but **not** while building.
- They stay aboard when she breaks or sinks. They ride their half (`halfWalkGrid`), and once their spot goes under they float on the surface. Floaters and boats stay at the surface; they don't follow the wreck down. Nothing grim: floaters bob calmly.
- Lifeboats launch during a sinking: deck-edge and side davits alike. People walk to the nearest lifeboat with a free seat. On screen a boat shows a few seated figures, not every passenger. A boat lowers when it's full or after a set time, and some lower half empty. Lowered boats row a short way out and wait on the water.
- It's deterministic: seeded from the ship, with no `Math.random` in `lib/`.
- Walk mode stays smooth on a phone. People are cheap meshes, positions are set imperatively in `useFrame`, and nothing re-renders per frame.
- Two Ship Builder releases: **2.21.0** (walkers, after Task 2) and **2.22.0** (lifeboats and the trial view, after Task 4). Each gets a matching top `CHANGELOG` entry.
- Per-task checks are `npm test`, `npm run type-check` and `npm run lint`. No e2e and no `npm run build`, except Task 4 step 5.

**Calls made for the builder (from the spec's "my calls"):**

- **Weather capsizes are too quick to evacuate.** There's no boarding: people stay aboard and float once their spot goes under. Untouched boats don't launch.
- **When she's "going down".** The doom moment is the first timeline state whose `outcome` is `"sank"`. Iceberg timelines are worked out ahead of time, so the evacuation plan can be too.

## Review Focus

1. A ship with no cabins: no people at all, and walk mode is unchanged. Pinned in Task 1.
2. A ship with lifeboats but no reachable boarding spot (the boat's deck cell isn't walkable): that boat still lowers, empty, on its timer, and nobody is routed to it. Pinned in Task 3.
3. More people than shown seats: the extras don't stand around stuck; they keep wandering, then float. Pinned in Task 3.
4. Scrubbing back past a launch: the boat is back on its davit and its passengers are back on deck. Pinned in Task 3 (pure time functions) and Task 4.
5. Two people never sit in the same seat at once. Pinned in Task 1.

## Execution notes (cost)

- **Task 1 Opus** (crowd planner: pathing and schedules). **Task 2 Sonnet** (walk-mode rendering, release 2.21.0). **Task 3 Opus** (evacuation planner). **Task 4 Sonnet** (trial-view rendering, boats, floaters, release 2.22.0).
- They run in sequence (each consumes the previous one). One combined review (Sonnet) after Task 2, and one after Task 4.

---

### Task 1: Crowd planner (Opus)

**Files:**

- Create: `lib/ship-builder/crowd/types.ts`, `lib/ship-builder/crowd/rng.ts`, `lib/ship-builder/crowd/plan.ts`, `lib/ship-builder/crowd/README.md`
- Create: `lib/ship-builder/crowd/__tests__/plan.test.ts`

**Interfaces (produces):**

```ts
export const MAX_PEOPLE = 24;
export const PERSON_SPEED = 0.9; // cells per second, slower than the player
export const SIT_S: readonly [number, number] = [6, 14]; // min and max sit time
export const PAUSE_S: readonly [number, number] = [0.5, 3]; // idle pause between legs

export type PersonKind = "passenger" | "crew";
export interface Person {
  id: string; // "p0", "p1", …
  kind: PersonKind;
  /** Index into the scene's outfit palette; crew always 0. */
  outfit: number;
  /** Seed for this person's own choices. */
  seed: number;
}
/** Where a person is at an instant, in the ship's model frame (see walk/types.ts). */
export interface PersonPose {
  x: number;
  z: number;
  level: number;
  /** Heading, the same convention as WalkState.yaw. */
  yaw: number;
  activity: "walk" | "idle" | "sit";
}
export interface Seat {
  partId: string;
  x: number;
  z: number;
  level: number;
  yaw: number;
}
export interface CrowdPlan {
  people: readonly Person[];
  seats: readonly Seat[];
  /** Pose of person `i` at `t` seconds. Pure; extends the schedule lazily and caches it. */
  poseAt(i: number, t: number): PersonPose;
}
/** How many people a ship carries on screen. */
export function crowdSize(stats: ShipStats): {
  passengers: number;
  crew: number;
};
/** Seats that people can sit in: deckchair and bench parts on walkable surfaces. */
export function seatsOf(ship: Ship, grid: WalkGrid): Seat[];
export function planCrowd(
  ship: Ship,
  grid: WalkGrid,
  stats: ShipStats
): CrowdPlan;
```

**Rules:**

- `crowdSize`: passengers are `round(stats.passengers.total / 40)` and crew `round(stats.crewBerths / 40)`, each at least 1 when its source is above 0. Scale both down together so the sum is at most `MAX_PEOPLE`, and keep at least 1 crew when crew is above 0. When `passengers.total + crewBerths === 0`, the result is `{0, 0}`.
- The seed is an FNV-1a hash of `ship.name` + `ship.parts.length` + `ship.hull.lengthSegments`. `rng.ts` is a small seeded PRNG (mulberry32). Each person's own stream is seeded from `seed ^ (i * 0x9e3779b9)`.
- Start positions are distinct walkable columns, picked by the RNG from every `(x, z, level)` with `grid.isWalkable`. Spread them out: reject a pick within 1 cell of an earlier one and try up to 20 times.
- The schedule is a list of legs `{ from, to, startT, endT, kind: "walk" | "sit" | "idle", path }`. Pathing is BFS over grid columns using `grid.stepLevel` for each orthogonal neighbour. It's cached per grid and can be reused. Walk legs follow the cell centres of the path at `PERSON_SPEED`. Yaw faces the direction of travel. Avoid blocker circles by excluding columns whose centre is within `ATTACH_BLOCK_RADIUS + WALKER_RADIUS` of a blocker on that level (see `walk/types.ts`).
- The next goal is a free seat with probability 0.35 (when one is free for that leg's whole sit window), otherwise a random walkable column within 8 BFS steps. A seat is claimed for `[arrive, arrive + sit]`. A claim table on the plan keeps two people out of one seat at once (Review Focus 5). A sit leg sets `x`/`z` to the seat and `yaw` to the seat's facing (the bench and deckchair face their part rotation; read `components/ship-builder/scene/deckDecor.tsx` and `facingYaw.ts` for the convention).
- Between legs there's an idle pause from `PAUSE_S`.
- `poseAt` must be cheap: binary-search the legs, and extend the schedule only up to `t`. People never share a cell centre while idle (not required while walking; the player won't notice).

- [ ] **Step 1: Write failing tests** in `plan.test.ts`:
  - `crowdSize` for Titanic stats gives a sum of exactly `MAX_PEOPLE` with crew of 1 or more. A ship with no cabins gives `{0, 0}`. One `cabin-1st` gives `{passengers: 1, crew: 0}`.
  - Every `poseAt(i, t)` for `t` in `0..120` (step 0.5) on the Titanic template is a walkable column at its level (`grid.isWalkable(Math.floor(x), Math.floor(z), level)`), and never within `ATTACH_BLOCK_RADIUS` of a blocker on its level.
  - Two plans from the same ship give the same poses. A renamed ship gives different poses.
  - No two people are in `sit` on the same seat at the same `t` (sample `0..300`).
  - On a template with deck chairs (find one, or build one in the test), someone is sitting at some `t` in `0..120`.
  - Consecutive poses 0.1 s apart are at most `PERSON_SPEED * 0.1 + 1e-6` apart in the same level, or they change level only across a stair link.
  - `poseAt` for 24 people at 600 evenly spaced times finishes in under 200 ms (a loose perf guard).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=crowd`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write `crowd/README.md` in the style of `walk/README.md`.
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(ship-builder): plan a crowd that wanders the decks`

---

### Task 2: Walkers in walk mode, release 2.21.0 (Sonnet)

**Files:**

- Create: `components/ship-builder/scene/PersonMesh.tsx`: one low-detail person (a capsule body about 0.5 tall, a sphere head, two thin arm boxes, standing about 0.75 of a level tall). It takes `outfit` and `activity` props. Sitting lowers the body about 0.25 and leans it back a little. Outfits are a fixed palette of about 8 bright tops, plus a crew uniform (navy with a white cap). It uses `Surface` so it shares materials and takes rust.
- Create: `components/ship-builder/scene/Crowd.tsx`: builds `planCrowd` once per ship (memoized on the ship object), renders one `PersonMesh` group per person, and in `useFrame` places each group with `modelToWorld` plus the floor height (`DECK_Y + level * LEVEL_HEIGHT` plus `grid.surfaceHeight` where it differs). It sets `rotation.y` from `yaw`, with the yaw-to-world mapping from `walk/types.ts`. Time comes from the walk clock (`WalkState.time` through `state/walkLive.ts`).
- Modify: the walk-mode scene, wherever `WalkEyes`/`WalkRunner` mount inside the ship's group, to mount `<Crowd />` only while `walk.status === "walking"` and no trial is running (Task 4 handles trials).
- Modify: `lib/ship-builder/version.ts` (`"2.21.0"`) and the changelog.
- Test: `components/ship-builder/scene/__tests__/crowdView.test.ts`, covering a pure `personWorldTransform(pose, grid, length, beam)` helper that you export from `Crowd.tsx` or `crowdView.ts`.

- [ ] **Step 1: Write failing tests** for `personWorldTransform`: the world x is `length / 2 - x`, the world z is `beam / 2 - z`, the y is the floor height, and the yaw mapping matches `walk/types.ts` (pose yaw 0 faces +X).
- [ ] **Step 2: Implement** `PersonMesh`, `Crowd` and the mount.
- [ ] **Step 3: Do a real-app check** (at most two screenshots, in the scratchpad directory the controller gives you). Walk on the Titanic template: people are on deck, standing upright on the floor (not sunk into it or floating), and someone is sitting on a deck chair. Check that the walk frame rate isn't visibly hurt. Read `RenderInfoProbe`/`window.__shipBuilder*` hooks for draw calls if there are any, and say what you saw.
- [ ] **Step 4: Bump the version and add the changelog.** Date `2026-10-25`, title "People on deck", in plain words:
  - "When you walk your ship, people now stroll around the decks with you"
  - "Some of them sit down on deck chairs and benches for a rest"
  - "The more cabins your ship has, the more people come aboard, and crew wear matching uniforms"
- [ ] **Step 5: Run** `npm test`, `npm run type-check` and `npm run lint`. Commit as `feat(ship-builder): people stroll the decks in walk mode`, then `chore(ship-builder): release 2.21.0 — people on deck`.

**→ Dispatch one combined review (Sonnet) covering Tasks 1 and 2.**

---

### Task 3: Evacuation planner (Opus)

**Files:**

- Create: `lib/ship-builder/crowd/evacuation.ts`, `lib/ship-builder/crowd/__tests__/evacuation.test.ts`
- Modify: `lib/ship-builder/crowd/README.md`

**Interfaces (produces):**

```ts
export const BOAT_SHOWN_MAX = 4; // seated figures drawn per boat
export const LAUNCH_WAIT_S = 18; // a boat lowers this long after doom even if not full
export const LOWER_S = 6; // davit to water
export const ROW_OUT = 3; // world units outboard once on the water
export const ROW_S = 5;

export interface BoatLaunch {
  boatId: string; // the lifeboat part id
  /** Sim seconds the boat starts lowering. */
  at: number;
  /** World transform of the boat at `at` (from the carrying body's pose then). */
  origin: { x: number; y: number; z: number };
  roll: number;
  pitch: number;
  /** Outboard direction in world z: +1 or -1. */
  outward: 1 | -1;
  /** People seated in it (ids), at most BOAT_SHOWN_MAX. */
  riders: readonly string[];
}
export type PersonFate =
  | { kind: "aboard" } // follows CrowdPlan.poseAt
  | { kind: "boarding"; boatId: string; until: number }
  | { kind: "in-boat"; boatId: string; seat: number }
  | { kind: "floating"; since: number; at: { x: number; z: number } }; // world xz
export interface EvacuationPlan {
  launches: readonly BoatLaunch[];
  /** What person `i` is doing at sim time `t`. Pure. */
  fateAt(i: number, t: number): PersonFate;
  /** Model-frame pose for an aboard or boarding person at `t` (boarding walks to the boat). */
  poseAt(i: number, t: number): PersonPose;
  /** World transform of a launched boat at `t` (lowering, rowing out, then waiting and bobbing at y = 0). */
  boatPoseAt(
    launch: BoatLaunch,
    t: number
  ): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
}
export function planEvacuation(
  ship: Ship,
  grid: WalkGrid,
  crowd: CrowdPlan,
  timeline: { input: TrialInput; stateAt(t: number): SimState; end: number }
): EvacuationPlan | null; // null when the trial doesn't sink, or it's a weather trial
```

**Rules:**

- `doomAt` is the first timeline time with `outcome === "sank"`. Before `doomAt`, everything matches the crowd plan exactly.
- **Boats:** every lifeboat part (catalog `seats > 0`, hanging from a `davit` or `davit-side`). Its **boarding spot** is the walkable column on the davit's deck nearest the davit point (the block's cell or the inboard neighbour). If none is walkable, nobody boards it (Review Focus 2).
- At `doomAt`, assign people: each one, in order of BFS distance from the boat, goes to the nearest boat with a shown seat free (`min(BOAT_SHOWN_MAX, seats)`). Routes use the same BFS as the crowd (export it from `plan.ts`), and are computed on the grid for the half they're on if she's already broken.
- **Some boats go half empty:** cap a boat's shown seats to `ceil(shown / 2)` when a hash of its id is odd.
- A boat launches when its last assigned rider arrives, or at `doomAt + LAUNCH_WAIT_S`, whichever is earlier. If its deck spot is under water first, it launches then. Riders who haven't arrived at launch time are unassigned and go back to wandering.
- `origin`, `roll` and `pitch` come from the carrying body's pose at `at` (use `poseWorldPoint` from `sim/funnelFall.ts` on the boat's hang point: `resolveAttachPoint` for the boat's `boat` or `big-boat` point, in world coordinates).
- **Floating:** an aboard or boarding person floats from the first `t` at which their model-frame position, transformed by their carrying body's pose, has world `y <= 0`. They float at that world xz, drift outward 0.2 units per second for 5 s, then stay put and bob. Check this every 0.25 s of sim time from `doomAt` (cheap).
- Extras with no seat keep wandering (crowd plan legs, routed on the half grid once broken) until they float (Review Focus 3).
- Every function is pure in `t`. Cache precomputed results inside the plan.

- [ ] **Step 1: Write failing tests** in `evacuation.test.ts`, using the Titanic template's iceberg timeline (build it the way `scene/trialTimeline.ts` does, with `breakMode: "never"` for the simple cases and `"always"` for one test):
  - `planEvacuation` returns `null` for a timeline that ends `afloat`, and for a weather trial.
  - Before `doomAt`, `poseAt(i, t)` deep-equals `crowd.poseAt(i, t)`.
  - Every launch's `riders.length` is at most the boat's shown cap, and no person rides two boats.
  - Every launch has `at <= doomAt + LAUNCH_WAIT_S + 1e-9`.
  - By the timeline end, every person is `in-boat` or `floating`.
  - `boatPoseAt(launch, launch.at)` equals `origin`. At `launch.at + LOWER_S + ROW_S` its `y` is within 0.1 of 0, and its z is `ROW_OUT * outward` further out than the origin's (±0.1).
  - Scrubbing: `fateAt(i, t)` is a pure function. Calling it at `t = 50` then `t = 10` gives the same answer for `t = 10` as calling `t = 10` first.
  - A lifeboat whose deck spot isn't walkable still launches, with `riders: []`.
  - With `breakMode: "always"`, people on the stern half are only ever routed to stern-half boats.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=evacuation`. Expected: FAIL.
- [ ] **Step 3: Implement** `evacuation.ts` and update the README.
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Commit `feat(ship-builder): plan the evacuation: who boards which lifeboat and when it launches`

---

### Task 4: People and lifeboats in the sea trial, release 2.22.0 (Sonnet)

**Files:**

- Modify: `components/ship-builder/scene/Crowd.tsx`. Mount it during sea trials too (iceberg and weather, not while building). It reads `trialPlayback.time` as its clock.
  - While the trial is running or showing a result, people who are `aboard` or `boarding` render inside the carrying group: the whole ship's group, or the right half's group once broken. Use `halfOfX` from `partHalves.ts`.
  - `in-boat` riders render seated, in world space, at their seat offset in the launched boat.
  - `floating` people render in world space at `y = 0`: lying back, bobbing with `0.04 * sin`, and staying at the surface.
  - In weather trials (no evacuation plan), people are aboard until they float, using the same floating rule. Export the floating check from `evacuation.ts` as `floatingSince(person pose fn, body pose fn, from, to)`, or similar, so it's shared.
- Create: `components/ship-builder/scene/LaunchedBoats.tsx`. It draws each launch with `launch.at <= playback.time` in world space at `boatPoseAt(launch, t)`, with the boat's own mesh (the same `PartMesh` type, size and colour), and hides the attached lifeboat part, as `FallingFunnels` hides funnels (reuse that hiding mechanism). Scrubbing back restores it.
- Modify: wherever the trial builds its timeline (`scene/trialTimeline.ts`). Compute and cache the evacuation plan next to it, keyed by the same input, and clear it with the timeline.
- Modify: `lib/ship-builder/version.ts` (`"2.22.0"`) and the changelog.
- Test: `components/ship-builder/scene/__tests__/` for any pure helpers you add (the seat offsets within a boat, the group choice by half).

- [ ] **Step 1: Write failing tests** for the pure helpers: the seat offsets (up to 4, along the boat's length, inside its hull width), and the carrying-group choice (`halfOfX`) for an aboard person before and after the break.
- [ ] **Step 2: Implement** the trial-mode crowd, `LaunchedBoats` and the plan cache.
- [ ] **Step 3: Do a real-app check** (at most three screenshots, in the scratchpad directory the controller gives you, using the e2e test hooks):
  - Sink the Titanic with an iceberg, and capture one frame with people walking to the boats.
  - Capture one frame with boats lowering or out on the water with riders.
  - Capture one frame after she's gone, with boats and floaters at the surface.
    Confirm no boat is doubled (on its davit and launched at once).
- [ ] **Step 4: Bump the version and add the changelog.** Date `2026-10-25`, title "Abandon ship!", in plain words:
  - "When your ship is sinking, people hurry to the lifeboats and climb in"
  - "The lifeboats lower down the side and row away to safety, just like on the Titanic"
  - "Anyone left aboard rides her down and then floats on the water"
  - "You can watch it all from outside the ship during a sea trial, not just while walking"
- [ ] **Step 5: Run** `npm test`, `npm run type-check` and `npm run lint`. Then, once only, run the walk, walk-sinking, iceberg and breakup e2e specs on Chromium (`PLAYWRIGHT_PORT=3457` if port 3000 is taken), because this changes what they render. Commit as `feat(ship-builder): lifeboats launch and people take to the boats`, then `chore(ship-builder): release 2.22.0 — abandon ship`.

**→ Dispatch one combined review (Sonnet) covering Tasks 3 and 4.**
