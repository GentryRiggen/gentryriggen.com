# Shipwreck: ride a lifeboat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A big boat button puts the player in a lifeboat (from walking next to it, or from the top bar), the boat lowers at once and rows away, and the player rides it in first person.

**Architecture:** The boats stay visual: the scripted `boat-lowered` events drive them in `Effects.tsx` (night) and `afternoonEffects.ts` (day). The ride is a third walk phase, `"boat"`, in the playback store holding `{ index, at }`. Effects moves that boat's lowering time to `at`, and each frame writes the first-person view from the boat's world position into `runtime.walker` (Effects runs at −1.5, before CameraRig at −1). WalkRunner turns the look drag into `runtime.ride.yaw/pitch`.

**Tech Stack:** Next 16, React 19, react-three-fiber, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-shipwreck-lifeboat-ride-design.md`

## Global Constraints

- Kid UI: picture buttons only, words only in `aria-label`. Big round 80 px buttons in walk mode (`BIG_OFF` in `WalkHud.tsx`).
- Fun over realism: the ridden boat lowers at `boardedAt`; every other boat keeps its scripted time. The sim is never written.
- Ships with no `boat-lowered` events (the Edmund Fitzgerald, the Poseidon) show no boat button.
- No per-frame allocations in `useFrame` code (reuse scratch objects).
- Release: bump to 1.12.0 with a changelog entry a kid can follow.

## Review Focus

1. Seeking back to before boarding: the ride ends (orbit). Seeking forward keeps it. Pinned in Task 1's store tests.
2. A new ship, Restart, or a What if during a ride: the ride ends (`walkOff` already runs in `start` and `setShip`). Pinned in Task 1.
3. Boarding a boat whose launch spot was already cached (seen afloat after a seek forward, then seek back and board): the boat must start from its new launch spot. Task 2 clears the caches for that index.
4. The end card during a ride: the look stops moving (`walkInputOff`); the view keeps riding.
5. Leaving the boat on a ship without a walk map (the Concordia): back to the orbit camera, never stuck. Pinned in Task 1.

---

### Task 1: Boat-ride rules and the store

**Files:**

- Create: `lib/shipwreck/boatRide.ts`, `lib/shipwreck/__tests__/boatRide.test.ts`
- Modify: `lib/shipwreck/playback.ts` (WalkState, actions, seek), its tests in `lib/shipwreck/__tests__/`

**Interfaces (produces):**

- `boardableBoats(events: readonly ShipEvent[], t: number): number[]`: the indices of `boat-lowered` events with `e.t > t`, sorted by `e.t`.
- `nextBoardable(events, t): number | null`: the first of those.
- `nearestBoardable(x: number, y: number, boats: readonly { index: number; x: number; y: number }[], maxM = BOARD_REACH_M): number | null`: the closest boat within `maxM` (ship frame, horizontal).
- `BOARD_REACH_M = 4`.
- `WalkState.phase: "off" | "deck" | "water" | "boat"`; `WalkState.boat: { index: number; at: number } | null`.
- `boardBoat(index: number): void`: needs a track. Sets `camera: "walk"`, `walk: { phase: "boat", lookUnder: false, seq: seq+1, boat: { index, at: t } }`, and `snapId+1`. Works without a walk map.
- `leaveBoat(): void`: on a ship with a walk map, back on deck (as `startWalk`). Otherwise `leaveWalk()`.
- `seek(t)`: during a ride, `t < boat.at` ends it (`walkOff`, orbit camera). Otherwise the ride is unchanged.

- [ ] Tests: `boardableBoats` order and filter, `nextBoardable` null when none, `nearestBoardable` reach. Store: board → phase boat/camera walk/at = t; seek before ends the ride; seek after keeps it; `setShip` ends it; `leaveBoat` → deck on the Titanic, orbit on the Concordia.
- [ ] Implement; `npx jest lib/shipwreck` green; commit.

### Task 2: The scene rides the boat

**Files:**

- Modify: `components/shipwreck/model/shipModel.ts` (`BoatControls.worldPosition(i: number, out: Vector3): boolean`: the instance's position, whether aboard or afloat, in world space; false when hidden)
- Modify: `components/shipwreck/scene/runtime.ts` (`ride: { yaw: number; pitch: number; aimed: boolean }`, `boardable: number` (−1 none); `WalkInfo.phase` gains `"boat"`)
- Modify: `components/shipwreck/scene/Effects.tsx`: after `lowered` is built, during a ride set `lowered.set(ride.index, ride.at)`. When the ride (index, at) changes, delete that index from `launch.current.at/routes/afloatRealT` and call `afternoon.forgetBoat(index)`. After the boats are posed, during a ride: `visible.boats.worldPosition` → `runtime.walker = { pos: [x, y + RIDE_EYE_M, z], yaw: ride.yaw, pitch: ride.pitch }`, and `runtime.walkInfo` gets phase "boat" with earth x/y. On the first ride frame (`!ride.aimed`), aim the yaw at her middle (`frame.bodies[0]`: `atan2(b.y - ey, b.x - ex)`, earth ey = −three z). While on deck (`walk.phase === "deck"` and `runtime.walkInfo`), a few times a second set `runtime.boardable = nearestBoardable(walkInfo.x, walkInfo.y, candidates)` from the boardable boats' `info(i).x` and `info(i).edgeY` signed by side (port +). Otherwise −1.
- Modify: `components/shipwreck/scene/afternoonEffects.ts`: `forgetBoat(i: number): void` drops `launchAt`/`frozen` for i.
- Modify: `components/shipwreck/scene/WalkRunner.tsx`: phase "boat" handled before the map check. The look drag goes to `runtime.ride` (yaw −= lookDx·WALK_TURN_PER_PX, pitch clamped to ±WALK_PITCH_LIMIT), and the input is zeroed. `ride.aimed = false` whenever the ride's `seq` changes. Leaving the ride resets `runtime.ride`.
- Modify: test hooks (`getWalk` reports phase "boat"; add `boardBoat(index?: number)`, default the next boardable).
- `RIDE_EYE_M = 1.3`.

- [ ] Unit: `forgetBoat` (or the Effects override, as a pure helper `rideLowered(lowered, ride)` in `boatRide.ts` with a test).
- [ ] `npm run type-check`, `npx jest components/shipwreck lib/shipwreck`; commit.

### Task 3: The buttons

**Files:**

- Modify: `components/shipwreck/ui/WalkHud.tsx`: `Feel` gains `boardable`. On deck with `boardable >= 0`: a big boat button (`aria-label="Get in the lifeboat"`, `data-testid="shipwreck-board-boat"`, icon `lifeboat`) over the right side (`OVER_MARKS`) → `boardBoat`. In phase "boat": no joystick, the Fly button stays, and a big `Back on deck` button (`data-testid="shipwreck-leave-boat"`, icon `on-deck`) → `leaveBoat`.
- Create: `components/shipwreck/ui/BoatButton.tsx`: the top-bar round button beside `TimeButton`, hidden while walking or riding. `aria-label="Ride a lifeboat"`, `data-testid="shipwreck-ride-boat"`. It shows only while `nextBoardable(track.events, t) !== null`, selected with `useStore` so it re-renders only when that changes. Click: leave place/X-ray (as `beginWalk`), then `boardBoat(next)`.
- Tests: `components/shipwreck/ui/__tests__/` cover the button hidden with no boardable boat, a click boarding the next boat, and the WalkHud boat phase showing Back on deck and no stick.

- [ ] Write the tests, implement, run them; commit.

### Task 4: e2e and release

- `e2e/shipwreck-walk.spec.ts`: a new test, "ride a Titanic lifeboat". Real night, compute ahead, seek to 0:45 AM real, then click `shipwreck-ride-boat`. `getWalk().phase === "boat"`. Then seek to `t + 400`: the camera (`getRenderInfo().camera`) is 0–4 m above the sea and over 20 m from her middle. Then `Back on deck` → walking on deck.
- `lib/shipwreck/version.ts` → 1.12.0; a changelog entry at the top.
- Run `npm run lint`, `npm run type-check`, `npm test`, `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium`, then `npm run build`. Check a real-GPU browser by eye (dev server, medium tier) and take screenshots.
