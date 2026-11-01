# Ship Builder Lifeboat Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While walking a sinking ship, the player can board a lifeboat or jump into a raft and be saved. If the water reaches them, they swim, can climb into a boat on the water, or get fished out frozen. Each ending has a popup and a voice line.

**Architecture:** A pure escape model (`lib/ship-builder/walk/escape.ts`) decides what the player can board, how a swimmer moves and when warmth runs out. It reads the evacuation plan, which now exposes each boat's boarding spot. A scene runner steps it each frame and publishes it through `escapeLive.ts` (like `walkLive.ts`), and the camera rig and HUD only read it. Voice uses a shared Web Audio clip player pulled out of Ever Onward, with Ship Builder's own pre-recorded lines.

**Tech Stack:** Next.js 16 static export, React 19, React Three Fiber, zustand store, Tailwind 4, Jest + RTL, Playwright, Google Cloud TTS (build-time script only).

**Spec:** `docs/superpowers/specs/2026-11-01-ship-builder-lifeboat-escape-design.md` (read it first; its "Settled after the builder check" section is binding).

## Global Constraints

- Kids are the players. The tone is playful: no drowning, no "you died", nothing dark.
- Tailwind only, every element in light and dark mode, mobile-first, tap targets ≥ 44px, respect reduced motion.
- `export default function` components, `interface` for props, `@/` imports, `"use client"` only where needed.
- Swim speed `SWIM_SPEED = 0.8` cells/s (half of `WALK_SPEED`). Warmth lasts `WARMTH_S = 60` sim seconds. The cold nudge fires at 25% warmth left. Pickup radius `PICKUP_RADIUS = 1.0` world units. Board radius `BOARD_RADIUS = 1.0` cells.
- Voice: `en-US-Chirp3-HD-Puck`. It plays only when Ship Builder sound is unlocked and the Voice switch (default on) is on. Missing clip → silent. It never pauses other audio on iOS (Web Audio plus `mixWithOtherAudio`).
- No change to passenger evacuation, stars or challenge scores. Ever Onward narration behaviour must not change.
- While the player is swimming, trial playback runs at 1x. Time going backwards (replay, Try again, scrub) resets the escape to `aboard`.
- Riding the ship down to the sea floor is removed: any walker the water reaches goes into the water, broken halves included.
- Prettier: double quotes, semicolons, es5 trailing commas, 80 cols.

## Review Focus

1. **Player standing on the half that breaks away.** Board must only offer boats on the player's half (`launch.half` vs `getWalkHalf()`), and water entry must use that half's body pose. Test this in Task 1 (`boardableBoat` ignores another half's boat) and Task 2 (water check uses half pose).
2. **Fast-forward or scrubbing while seated or swimming.** Seated poses are pure in `t`. If time goes backward past `phase.since`, reset to `aboard`. Test this in Task 1 (`rewindEscape`).
3. **A trial with no evacuation plan** (she survives, or the waves trial): no Board button and no swimming. The old "ride along" walk stays as it is. Test this in Task 2 (runner is inert with `plan === null`).
4. **A raft whose window is already over, or a davit boat already lowering:** no Board/Jump button. Test this in Task 1.
5. **Sound off:** popups still show and no audio is created. Test this in Task 6 (`playVoice` no-ops when locked).

---

### Task 1: Pure escape model and boarding spots

**Files:**

- Modify: `lib/ship-builder/crowd/evacuation.ts` (add `spot` and `half` to `BoatLaunch`, filled from the `Lifeboat`'s `spotRest`/`half`; `spot` is null when the boat has no boarding spot)
- Create: `lib/ship-builder/walk/escape.ts`
- Modify: `lib/ship-builder/walk/index.ts` (re-export), `lib/ship-builder/walk/README.md` and `lib/ship-builder/crowd/README.md` (a short paragraph each)
- Test: `lib/ship-builder/walk/__tests__/escape.test.ts`, plus one case in `lib/ship-builder/crowd/__tests__/evacuation.test.ts`

**Interfaces:**

- Produces (`evacuation.ts`): `BoatLaunch.spot: { x: number; y: number; z: number } | null` (resting world frame) and `BoatLaunch.half: WalkHalf | null`.
- Produces (`escape.ts`):

  ```ts
  export const SWIM_SPEED = 0.8,
    KICK_SPEED = 2,
    KICK_S = 0.5,
    WARMTH_S = 60,
    COLD_WARNING = 0.25,
    PICKUP_RADIUS = 1,
    BOARD_RADIUS = 1,
    SWIM_MARGIN = 12;
  export type EscapeEnding = "deck" | "swim" | "frozen";
  export type EscapeBoatKind = "davit" | "raft" | "none";
  export interface Swimmer {
    x: number;
    z: number;
    yaw: number;
    warmth: number;
    kick: number;
  }
  export type EscapePhase =
    | { kind: "aboard" }
    | {
        kind: "jumping";
        boatId: string;
        since: number;
        from: { x: number; y: number; z: number };
      }
    | { kind: "in-boat"; boatId: string; since: number; fromWater: boolean }
    | { kind: "swimming"; since: number; swimmer: Swimmer; warned: boolean }
    | { kind: "frozen"; since: number; x: number; z: number };
  export function walkerRestPoint(
    walk: Pick<WalkState, "x" | "z" | "level">,
    length: number,
    beam: number
  ): { x: number; y: number; z: number };
  export function boardableBoat(
    launches: readonly BoatLaunch[],
    rest: { x: number; y: number; z: number },
    t: number,
    half: WalkHalf | null
  ): BoatLaunch | null;
  export function boardWindow(launch: BoatLaunch): { from: number; to: number };
  export function isOnWater(launch: BoatLaunch, t: number): boolean;
  export function pickupBoat(
    plan: Pick<EvacuationPlan, "launches" | "boatPoseAt">,
    swimmer: Swimmer,
    t: number
  ): BoatLaunch | null;
  export function startSwimming(
    at: { x: number; z: number },
    yaw: number,
    t: number
  ): EscapePhase; // warmth 1
  export function stepSwimmer(
    s: Swimmer,
    input: WalkInput,
    dt: number,
    hull: HullBox
  ): Swimmer;
  export interface HullBox {
    cx: number;
    halfLength: number;
    halfBeam: number;
    radius: number;
  } // world xz; radius = swim area
  export function endingOf(phase: EscapePhase): EscapeEnding | null; // in-boat → fromWater ? "swim" : "deck"; frozen → "frozen"
  export function rewindEscape(phase: EscapePhase, t: number): EscapePhase; // t < since → aboard
  ```

  Swimmer `x, z` are world (water) xz. `yaw` uses the walk convention (facing `(cos yaw, sin yaw)` in world xz). `kick` is the seconds left of a kick burst.

- [ ] **Step 1: Write failing tests** in `escape.test.ts`, building `BoatLaunch` literals by hand (no full plan needed except where noted):
  - `boardWindow`: davit `{from: -Infinity, to: launch.at}`; raft `{from: launch.ready, to: Math.max(launch.departs, launch.ready + 4)}`.
  - `boardableBoat` returns the davit boat when `rest` is within `BOARD_RADIUS` of `spot` in xz and within `LEVEL_HEIGHT / 2` in y, and `t < at`. It returns null at `t >= at`, for a boat whose `half` differs from the given non-null half, for `spot === null`, and for a raft before `ready`. When two qualify, the nearest wins.
  - `isOnWater`: davit true from `at + LOWER_S`; raft true from `at + RAFT_DROP_S`.
  - `pickupBoat` uses a real `planEvacuation` fixture from `evacuation.test.ts` (or a stub `boatPoseAt` returning a fixed position). A swimmer 0.9 from an on-water boat → that boat; at 1.1 → null; a boat not yet on the water → null.
  - `stepSwimmer`: forward 1 for 1 s at yaw 0 moves +0.8 in world x; warmth drops by `1/60` per second; a `jump` input sets `kick = KICK_S` and adds `KICK_SPEED` forward while `kick > 0`; it can't enter the hull box (expanded by `WALKER_RADIUS`; stays outside, slides along); it stays within `radius` of `(cx, 0)`; warmth clamps at 0.
  - `endingOf` and `rewindEscape` (rewinding before `since` gives `{kind:"aboard"}`, otherwise the phase is unchanged).
  - In `evacuation.test.ts`: on the existing Titanic fixture, every davit launch with riders has a non-null `spot` and a `half` of null for an unbroken trial.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="escape|evacuation"`. Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the evacuation fields and `escape.ts` with the signatures above. `walkerRestPoint`: `x = length/2 - walk.x`, `z = beam/2 - walk.z`, `y = DECK_Y + walk.level * LEVEL_HEIGHT`. Distances in `boardableBoat` are in world units (one cell = one world unit; check `modelToWorld`).
- [ ] **Step 4: Run** the same tests. Expected: PASS. Then `npm run type-check`.
- [ ] **Step 5: Commit** `feat(ship-builder): escape model and lifeboat boarding spots`.

### Task 2: Escape runner, water entry and swimming camera

**Files:**

- Create: `lib/ship-builder/state/escapeLive.ts` (same shape as `walkLive.ts`: `getEscape()`, `publishEscape(phase)`, `subscribeEscape`, `useEscapePhase()` via `useSyncExternalStore`; reset to `{kind:"aboard"}` when a walk starts and ends)
- Create: `components/ship-builder/scene/playbackBody.ts` (move `playbackBody` out of `Crowd.tsx`, export it, and use it from both)
- Create: `components/ship-builder/scene/EscapeRunner.tsx` (mounted beside `WalkRunner` while walking)
- Create: `components/ship-builder/scene/escapeCamera.ts` (pure camera pose for swimming, seated and jumping)
- Modify: `components/ship-builder/scene/WalkRunner.tsx` (stop stepping the walker unless the phase is `aboard`), `WalkEyes.tsx` (don't drive the camera unless `aboard`), the scene file that mounts `WalkRunner` (mount `EscapeRunner` and an `EscapeEyes` that drives the camera otherwise), `components/ship-builder/ui/TrialSpeedSwitch.tsx` / `hooks/useTrialSpeed.ts` (1x and hidden while swimming), `components/ship-builder/scene/testClock.ts` (add `escapeWarmthSeconds?: number` overriding `WARMTH_S`)
- Modify: `lib/ship-builder/state/store.ts`: the code that takes the walker down to the sea floor (the walker now leaves the ship instead; keep the "result waits until they stop walking" rule)
- Test: `components/ship-builder/scene/__tests__/escapeCamera.test.ts`, `lib/ship-builder/state/__tests__/escapeLive.test.ts`, plus updates to any existing test that asserted riding to the sea floor

**Interfaces:**

- Consumes: everything Task 1 produces; `trialEvacuationFor` (`scene/trialTimeline.ts`); `personWorldPoint` and `BodyPose` (`evacuation.ts`); `getWalkState`, `getWalkHalf` (`walkLive.ts`); `walkInput`; `trialPlayback`.
- Produces: `escapeLive.ts` API above. `escapeCamera(phase, ctx): { eye: [number,number,number]; target: [number,number,number] }`, where `ctx = { plan, t, yaw, length }`:
  - swimming: eye at `(x, 0.12 + bob, z)` looking along yaw (bob ±0.04 at 0.5 Hz, 0 with reduced motion).
  - in-boat: eye at the boat pose position + `0.35` up, looking along the boat's outward (+z·outward) by default. Seated look is the walk's own yaw, still driven by the look drag (`walkInput.turn` and the look layer keep updating the walk state's yaw while seated, but not its position).
  - jumping: lerp along an arc from `from` to the boat's seat over `JUMP_S` (the peak is 0.6 above the higher end).
  - frozen: as swimming, still, with no bob.
- Produces: `requestBoard(): void` and `requestClimbIn(): void` exported from `EscapeRunner.tsx`'s module (or a small `lib/ship-builder/state/escapeActions.ts`). They set a flag that the runner consumes next frame. The runner also publishes `boardable: { boatId: string; kind: "davit" | "raft" } | null` and `pickup: { boatId: string } | null` on escapeLive, for the HUD.

Runner rules (each frame, after `WalkRunner`):

- `plan === null` → publish nothing new, stay `aboard` (Review Focus 3).
- `rewindEscape` on `trialPlayback.time`.
- aboard: compute `boardableBoat(plan.launches, walkerRestPoint(walk), t, getWalkHalf())`. A board request on a davit boat → `in-boat` (fromWater false, since t). On a raft → `jumping` (from = the walker's world point), then `in-boat` after `JUMP_S`. Water check: `personWorldPoint(walk as pose, playbackBody(trialPlayback at walk.x / the walker's half), length, beam).y <= 0` → `startSwimming` at that xz, with yaw = walk yaw.
- swimming: `stepSwimmer` with fixed `SIM_STEP_S` steps on frame delta (capped by `MAX_FRAME_DELTA`). The hull box is the ship's resting footprint shifted by the body's `driftX`, and `radius = max(length, beam)/2 + SWIM_MARGIN`. Once she's fully under (`trialPlayback.phase` done/sunk), the hull box is gone. A pickup request → `in-boat` (fromWater true). Warmth 0 → `frozen`. Set `warned` at `COLD_WARNING`.
- Every phase change: publish, and when `endingOf` becomes non-null call `useShipBuilderStore.getState().recordEscape(...)` (Task 4 adds it; until then a no-op guard with optional chaining is fine, or land Task 4's store part here, implementer's choice).

- [ ] **Step 1: Write failing tests** for `escapeCamera` (each phase's eye and target; bob 0 when reduced motion) and `escapeLive` (publish/subscribe, reset to aboard).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="escapeCamera|escapeLive"`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above and the runner wiring.
- [ ] **Step 4: Run** `npm test`, `npm run type-check`, `npm run lint`. Expected: all pass (with sea-floor tests updated to the new rule).
- [ ] **Step 5: Smoke check** `npm run dev`: load a liner template, Walk, Hit with an iceberg, stand still. The camera drops into the water and the stick swims. Note the result in the report.
- [ ] **Step 6: Commit** `feat(ship-builder): swim when the water reaches you, ride boats you board`.

### Task 3: HUD: Board / Jump / Climb in, warmth meter and popups

**Files:**

- Create: `components/ship-builder/ui/EscapeActionButton.tsx` (reads `boardable`/`pickup` from escapeLive; labels **Board** (davit), **Jump** (raft), **Climb in** (pickup); large pill, bottom centre above the joystick row; calls `requestBoard`/`requestClimbIn`; keyboard `E` triggers it too, added in `hooks/useWalkKeys.ts`)
- Create: `components/ship-builder/ui/WarmthMeter.tsx` (shows while swimming: a thermometer icon from the existing icon set, or an inline svg, and a bar from sky-blue to white; `role="meter"`, `aria-valuenow` in percent, label "Warmth")
- Create: `components/ship-builder/ui/EscapePopup.tsx` (one card for the four moments; `role="dialog"` `aria-live`; styled like `SeaTrialResult`'s card)
- Create: `lib/ship-builder/escapeCopy.ts` (popup copy and result-card lines, below)
- Modify: `components/ship-builder/ui/WalkHud.tsx` (mount the three; hide joystick and jump while seated, jumping or frozen; the jump button reads **Kick** while swimming; suppress `OutcomeNote` while a popup shows)
- Test: `components/ship-builder/ui/__tests__/EscapeActionButton.test.tsx`, `WarmthMeter.test.tsx`, `EscapePopup.test.tsx`

**Interfaces:**

- Consumes: Task 2's escapeLive (`useEscapePhase`, `boardable`, `pickup`), `requestBoard`, `requestClimbIn`; the store's `stopWalking` (existing name; check `store.ts`).
- Produces: `ESCAPE_POPUPS: Record<"saved-deck"|"saved-swim"|"splash"|"frozen", { title: string; body: string }>` and `ESCAPE_RESULT_LINES: Record<EscapeEnding, string>` in `escapeCopy.ts`.

Exact copy:

```ts
"saved-deck": { title: "You're safe!", body: "You made it into a lifeboat. Wave goodbye to that soggy ship!" },
"saved-swim": { title: "Saved from the sea!", body: "You swam to a boat and climbed in, dripping wet but safe." },
"splash":     { title: "Splash!", body: "You'll have to survive the waters! Swim to a lifeboat before you get too cold." },
"frozen":     { title: "Brrr! Human ice cube!", body: "A passing fishing boat scooped you up. You survived, just!" },
// result lines
deck: "You escaped in a lifeboat", swim: "You swam to a lifeboat and climbed in", frozen: "A fishing boat fished you out, frozen solid",
```

Popup behaviour: saved-deck appears when the boat is fully out (davit: `t >= at + LOWER_S + ROW_S`; raft: `t >= departs`, or `since + JUMP_S + 1` when departs is already past). Saved-swim and frozen appear at once. Each has **Keep watching** (closes) and **See how she did** (stops walking). Splash has one **Swim!** button and closes itself after 4 s. A popup shows once per phase change.

- [ ] **Step 1: Write failing tests**: the button label for each `boardable`/`pickup` state, hidden when none; clicking calls the request; the meter's `aria-valuenow` follows warmth; each popup's title and body from `ESCAPE_POPUPS`; See how she did calls stop walking; splash auto-closes after 4 s (fake timers).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="Escape|WarmthMeter"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `npm run type-check`, `npm run lint`. Expected: pass.
- [ ] **Step 5: Commit** `feat(ship-builder): board, jump and climb in buttons, warmth meter and escape popups`.

### Task 4: Ending in the store, result card line, analytics event

(This touches `firestore.rules`, so it gets a spec review plus an adversarial review.)

**Files:**

- Modify: `lib/ship-builder/state/store.ts`: `lastEscape: { ending: EscapeEnding; boat: EscapeBoatKind } | null`; action `recordEscape(ending, boat)` (sets it and fires `trackGame("escape_ending", { ending, boat })` once per walk); cleared when a trial starts or a walk starts
- Modify: `components/ship-builder/ui/SeaTrialResult.tsx` (or `ResultDetails.tsx`: wherever the lifeboat line lives) to show `ESCAPE_RESULT_LINES[lastEscape.ending]` when set
- Modify: `lib/analytics/gameEvents.ts` (event `escape_ending`, site `ship-builder`, sample 1, props `ending: enum ["deck","swim","frozen"]`, `boat: enum ["davit","raft","none"]`), `firestore.rules` (mirror it the way `walk_started` is mirrored), `firestore-tests/gameEvents.test.ts` (it feeds every event and enum value, so check it picks the new one up), and the admin Games dashboard if it lists events by hand
- Test: `lib/ship-builder/state/__tests__/` (recordEscape sets, fires once, cleared on a new trial); `SeaTrialResult` test (line shows); `npm run test:rules` if Java 21 is present (else note it; CI runs it)

**Interfaces:**

- Consumes: `EscapeEnding`, `EscapeBoatKind` (Task 1), `ESCAPE_RESULT_LINES` (Task 3).
- Produces: `recordEscape(ending: EscapeEnding, boat: EscapeBoatKind): void`; `lastEscape` on the store state.

- [ ] **Step 1: Write failing tests** (above).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, and wire Task 2's runner call if it was left as a guard.
- [ ] **Step 4: Run** `npm test`, `npm run type-check`, and `npm run test:rules` where possible. Expected: pass.
- [ ] **Step 5: Commit** `feat(ship-builder): show and record how you escaped`.

### Task 5: Shared voice player and Ship Builder voice lines

**Files:**

- Create: `components/game-audio/voicePlayer.ts`: `createVoicePlayer({ getClip: (id) => { file: string } | undefined, eventName: string, maxQueue?: number })` returning `{ play(id, opts?: { interrupt?: boolean }), stop(), useNowPlaying() }`. The body is moved from `components/ever-onward/narration/player.ts`, which becomes a thin wrapper keeping its exports and behaviour exactly (its tests must pass unchanged).
- Create: `lib/ship-builder/voice/lines.ts` (`SHIP_VOICE_LINES: { id: string; text: string }[]`, `voiceMomentIds(moment): string[]`, `pickVoiceLine(moment, n: number): string`, rotating through variants by a counter, no `Math.random`), `lib/ship-builder/voice/manifest.json` (starts as `{}`), `lib/ship-builder/voice/manifest.ts` (`getShipClip(id)`)
- Create: `components/ship-builder/audio/shipVoice.ts`: `playShipVoice(moment: VoiceMoment): void`. A no-op unless sound is unlocked and `shipChannels.voice` is on.
- Modify: `components/ship-builder/audio/channelSettings.ts` and `components/game-audio/channels.ts` (optional third channel `voice`, default on, key `ship-builder:ui:voice`), `components/game-audio/ChannelToggles.tsx` (render a Voice switch when the settings have `voice`; Ever Onward and Plane Builder unchanged)
- Create: `scripts/ship-builder-voice.mjs`, sharing the TTS and manifest logic with `scripts/ever-onward-narration.mjs` through `scripts/lib/tts.mjs` (move, don't copy; the Ever Onward script keeps its behaviour and voice). Output `public/ship-builder/voice/<id>.mp3`, voice `en-US-Chirp3-HD-Puck`, `speakingRate: 1.0`. Add `"voice:ship-builder"` to `package.json`.
- Modify: the Task 2 runner and Task 3 popups to call `playShipVoice` at each moment
- Test: `lib/ship-builder/voice/__tests__/lines.test.ts` (ids unique; every moment has ≥ 2 variants; `pickVoiceLine` rotates; every manifest key is a line id), `components/ship-builder/audio/__tests__/shipVoice.test.ts` (no-op when locked or voice off; plays the picked id otherwise), and Ever Onward's existing narration tests unchanged

**Interfaces:**

- Produces: `type VoiceMoment = "boarded" | "jumped" | "saved-deck" | "splash" | "cold" | "saved-swim" | "frozen"`; `playShipVoice(moment)`.

Exact lines (id `escape/<moment>-<n>`):

```
boarded:    "In you get! Hold on tight, we're lowering away." | "Climb aboard! Next stop, the water."
jumped:     "Geronimo! Right into the raft!" | "Big jump! Nice landing."
saved-deck: "You're safe! You made it into a lifeboat." | "Rescued! Wave goodbye to that soggy old ship." | "Safe and sound. Great thinking, sailor!"
splash:     "Splash! No boat for you. You'll have to survive the waters!" | "Whoops, you're swimming now! Find a lifeboat, quick!" | "Into the drink! Paddle to a boat before you turn into an ice cube."
cold:       "Brr, it's getting chilly! Swim to a boat!" | "Your teeth are chattering! Hurry!"
saved-swim: "Grab my hand! You made it out of the water!" | "Pulled aboard, dripping wet, but safe!"
frozen:     "Brrr! You're a human ice cube. Luckily a passing fishing boat scooped you up." | "Frozen like a fish stick! A fishing boat hauled you out just in time."
```

Moments: `boarded` on boarding a davit boat; `jumped` on a raft jump; `saved-deck` with that popup; `splash` on entering the water; `cold` at the warning; `saved-swim` on climbing in; `frozen` on freezing.

- [ ] **Step 1: Write failing tests** (above).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="voice|Voice|narration"`. Expected: the new ones FAIL and Ever Onward's PASS.
- [ ] **Step 3: Implement.** Don't run the TTS script; the controller generates the clips.
- [ ] **Step 4: Run** `npm test`, `npm run type-check`, `npm run lint`. Expected: pass, Ever Onward tests untouched.
- [ ] **Step 5: Commit** `feat(ship-builder): voice lines for escaping the ship`.
- [ ] **Step 6 (controller):** `npm run voice:ship-builder` (gcloud is signed in), check the MP3s and manifest, then commit `chore(ship-builder): record escape voice lines`.

### Task 6: End-to-end coverage and release

**Files:**

- Create: `e2e/ship-builder-escape.spec.ts`
- Modify: `e2e/ship-builder-walk-sinking.spec.ts` (riding to the sea floor is now going into the water)
- Modify: `lib/ship-builder/version.ts` (next minor), `lib/ship-builder/changelog.ts` (top entry)
- Modify: `components/ship-builder/scene/testClock.ts` if the spec needs a hook to read launch spots (for example, `window.__shipBuilderEscape = { launches }` published by the runner when `TEST_HOOKS_ENABLED`)

Tests (chromium, use `walkSpawn`, `trialSpeed` and `escapeWarmthSeconds`):

- **Board:** a liner template, iceberg trial, walk spawned at a davit boat's spot. Board appears → tap → the saved popup "You're safe!" appears → See how she did shows the result card with "You escaped in a lifeboat".
- **Swim:** the walker spawned away from boats, waiting until the splash popup → Swim! → the Warmth meter is visible → with `escapeWarmthSeconds: 2` the frozen popup appears and the result line says "fished you out".
- **Pickup:** if positioning a swimmer next to a boat is feasible through a hook, Climb in → "Saved from the sea!". Otherwise cover it with a unit test in Task 2's runner and say so.

Changelog entry (exact title; the builder can polish highlights):

```
title: "Escape the sinking ship"
highlights:
  "When your ship is sinking, walk up to a lifeboat and tap Board. Ride it down the side and row away to safety",
  "Life rafts too: tap Jump and leap right in",
  "Miss the boats and you'll end up in the water! Swim with the stick, kick with the jump button, and climb into a lifeboat before you get too cold",
  "Get too cold and a fishing boat scoops you up",
  "A voice cheers you on. Turn it off with the new Voice switch next to Music and Effects",
```

- [ ] **Step 1: Write** the e2e spec and update the sinking-walk spec.
- [ ] **Step 2: Run** `npx playwright test e2e/ship-builder-escape.spec.ts e2e/ship-builder-walk-sinking.spec.ts e2e/ship-builder-walk.spec.ts --project=chromium`. Expected: PASS.
- [ ] **Step 3: Bump the version and add the changelog entry.** Run `npm test -- --testPathPatterns=changelog`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(ship-builder): 2.39.0 escape the sinking ship`.

### Ship (controller)

- [ ] `npm run validate` once at the end, plus the full e2e for ship-builder specs on chromium.
- [ ] Push the branch, open the PR (disclosure footer per the `disclosing-ai-assistance` skill), and merge when CI is green.
