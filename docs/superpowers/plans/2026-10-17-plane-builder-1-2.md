# Plane Builder 1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Plane Builder flight more to do (boost rings, fuel cans, visible updrafts, milestone flags, landing bonus, set pieces) and end the long unpowered glide, while keeping the hands-off grind at 22–40 flights per level.

**Architecture:** Pure sim/level/economy changes in `lib/plane-builder/` (deterministic, unit-tested), then render-only scene pieces and HUD pop-ups in `components/plane-builder/`. The balance pilot stays passive; a final tuning task retunes constants and catalogs against the balance suite.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind 4, @react-three/fiber + three, zustand, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-plane-builder-1-2-design.md`

## Global Constraints

- The sim stays deterministic: no `Math.random`, no `Date.now` in `lib/plane-builder/`.
- No save-format change: `SAVE_VERSION` stays 1; `Progress`/`LevelProgress` shapes unchanged.
- Never edit `components/ship-builder` or `lib/ship-builder`.
- Tailwind only, light + dark for every element; `"use client"` only where needed; `export default function` components; `interface` props.
- Prettier: double quotes, semicolons, trailing commas (es5), 80 cols.
- Plain kid-friendly copy ("Boost!", "+Fuel", "Halfway!", "Nice landing").
- **Per-task verification is unit tests only** (`npx jest <paths>`, `npx tsc --noEmit`, `npx eslint <paths>`). No `npm run build`, no Playwright, no `npm run validate` inside tasks — the controller runs those once at the end.

## Review Focus

- A plane with no engine (thrust 0) flying through a fuel can: must not collect it or change fuel.
- A replayed, already-finished level: milestone bonuses must not pay again (previousBest is at the finish).
- A flight that crosses a milestone, then is pushed back (shield bounce) and crosses again: one `milestone` event only.
- A ring boost at `MAX_SPEED`: speed stays clamped.
- Set-piece rings/cans placed over hills: heights are relative to the terrain under them, not absolute.

---

## Dependency graph (for parallel dispatch)

- **Wave 1 (parallel):** Task 1 (sim) and Task 2 (economy).
- **Wave 2 (parallel, after Task 1):** Task 3 (levels), Task 4 (scene), Task 5 (feedback).
- **Wave 3 (after all):** Task 6 (tuning, release), then controller final verification.

---

### Task 1: Sim mechanics — boost rings, fuel cans, milestone events

**Files:**

- Modify: `lib/plane-builder/levels/types.ts` (add `fuelCans` to `LevelDef`)
- Modify: `lib/plane-builder/levels/generate.ts` (return `fuelCans: []` for now so types compile)
- Modify: `lib/plane-builder/sim/constants.ts`
- Modify: `lib/plane-builder/sim/flight.ts`
- Modify: `lib/plane-builder/sim/__tests__/fixtures.ts` (`flatLevel` gets `fuelCans: []`)
- Test: `lib/plane-builder/sim/__tests__/flight.test.ts`

**Interfaces:**

- Produces:
  - `LevelDef.fuelCans: Vec3[]`
  - constants `RING_BOOST = 8`, `FUEL_CAN_RADIUS = 3`, `FUEL_CAN_SHARE = 0.25`, `MILESTONES = [0.25, 0.5, 0.75] as const` (in `sim/constants.ts`)
  - `FlightState.canTaken: Uint8Array`, `FlightState.milestonesHit: number` (count of milestones crossed this flight, 0–3)
  - `FlightEvent` gains `{ type: "fuel"; index: number }` and `{ type: "milestone"; share: number }`

- [ ] **Step 1: Write failing tests** in `flight.test.ts` (new `describe("pickups and milestones")`):

```ts
it("speeds up through a ring, capped at MAX_SPEED", () => {
  const ring = { center: { x: 20, y: 3, z: 0 }, radius: 6 };
  const level = flatLevel({ rings: [ring] });
  const s = launch(level, GLIDER, { pitch: 0, yaw: 0, power: 1 });
  s.x = 19.9;
  s.y = 3;
  s.pitch = 0;
  const before = s.speed;
  const events = step(s, level, GLIDER, HANDS_OFF);
  expect(events.some((e) => e.type === "ring")).toBe(true);
  expect(s.speed).toBeGreaterThan(before + RING_BOOST - 1);

  const t = launch(level, GLIDER, { pitch: 0, yaw: 0, power: 1 });
  t.x = 19.9;
  t.y = 3;
  t.pitch = 0;
  t.speed = MAX_SPEED;
  step(t, level, GLIDER, HANDS_OFF);
  expect(t.speed).toBeLessThanOrEqual(MAX_SPEED);
});

it("adds a quarter tank from a fuel can, capped at full", () => {
  const level = flatLevel({ fuelCans: [{ x: 20, y: 3, z: 0 }] });
  const s = launch(level, POWERED, AIM);
  s.x = 19.5;
  s.y = 3;
  s.z = 0;
  s.fuel = 2;
  const events = step(s, level, POWERED, HANDS_OFF);
  expect(events).toContainEqual({ type: "fuel", index: 0 });
  expect(s.fuel).toBeCloseTo(2 - 1 / 60 + POWERED.fuel * FUEL_CAN_SHARE, 2);

  const full = launch(level, POWERED, AIM);
  full.x = 19.5;
  full.y = 3;
  full.z = 0;
  step(full, level, POWERED, HANDS_OFF);
  expect(full.fuel).toBeLessThanOrEqual(POWERED.fuel);
});

it("ignores fuel cans without an engine", () => {
  const level = flatLevel({ fuelCans: [{ x: 20, y: 3, z: 0 }] });
  const s = launch(level, GLIDER, AIM);
  s.x = 19.5;
  s.y = 3;
  s.z = 0;
  const events = step(s, level, GLIDER, HANDS_OFF);
  expect(events.some((e) => e.type === "fuel")).toBe(false);
  expect(s.canTaken[0]).toBe(0);
  expect(s.fuel).toBe(0);
});

it("fires each milestone once per flight", () => {
  const level = flatLevel({ finishDistance: 400 });
  const { events } = runFlight(level, { ...POWERED, fuel: 60 }, AIM, handsOff);
  const shares = events
    .filter((e) => e.type === "milestone")
    .map((e) => (e as { share: number }).share);
  expect(shares).toEqual([0.25, 0.5, 0.75]);
});

it("does not repeat a milestone after being pushed back", () => {
  const level = flatLevel({ finishDistance: 400 });
  const s = launch(level, POWERED, AIM);
  s.x = 99;
  s.maxX = 99;
  s.y = 20;
  s.pitch = 0;
  const first = step(s, level, POWERED, HANDS_OFF);
  expect(first.filter((e) => e.type === "milestone")).toHaveLength(1);
  s.x = 90; // pushed back (shield bounce)
  for (let i = 0; i < 60; i += 1) step(s, level, POWERED, HANDS_OFF);
  expect(s.milestonesHit).toBe(1);
});
```

Import `RING_BOOST, FUEL_CAN_SHARE, MAX_SPEED` from `../constants` and `GLIDER` from fixtures.

- [ ] **Step 2: Run** `npx jest lib/plane-builder/sim` — expect failures (missing exports/fields).

- [ ] **Step 3: Implement.**
  - `types.ts`: add to `LevelDef`, after `rings`: `/** Floating fuel cans; only planes with an engine collect them. */ fuelCans: Vec3[];`
  - `generate.ts` `buildLevel`: return `{ ...def, obstacles, coins, rings, fuelCans: [] }` (Task 3 fills it).
  - `fixtures.ts` `flatLevel`: add `fuelCans: [],`.
  - `constants.ts`: add with doc comments:
    ```ts
    /** Speed a ring adds, m/s. */
    export const RING_BOOST = 8;
    export const FUEL_CAN_RADIUS = 3;
    /** Share of the tank a fuel can refills. */
    export const FUEL_CAN_SHARE = 0.25;
    /** Shares of the finish distance that are milestone flags. */
    export const MILESTONES = [0.25, 0.5, 0.75] as const;
    ```
  - `flight.ts`:
    - `FlightState`: add `canTaken: Uint8Array;` and `milestonesHit: number;`; `launch` sets `canTaken: new Uint8Array(level.fuelCans.length)`, `milestonesHit: 0`.
    - `FlightEvent`: add the two variants.
    - In the ring pickup, after `s.coins += RING_COINS;` add `s.speed = Math.min(MAX_SPEED, s.speed + RING_BOOST);`.
    - After the rings block, add fuel cans:
      ```ts
      if (stats.thrust > 0) {
        level.fuelCans.forEach((c, i) => {
          if (s.canTaken[i]) return;
          const dx = c.x - s.x;
          if (Math.abs(dx) > FUEL_CAN_RADIUS) return;
          const dy = c.y - s.y;
          const dz = c.z - s.z;
          if (dx * dx + dy * dy + dz * dz < FUEL_CAN_RADIUS * FUEL_CAN_RADIUS) {
            s.canTaken[i] = 1;
            s.fuel = Math.min(stats.fuel, s.fuel + stats.fuel * FUEL_CAN_SHARE);
            events.push({ type: "fuel", index: i });
          }
        });
      }
      ```
    - In `trackProgress`, after updating `maxX` and before the finish check:
      ```ts
      while (
        s.milestonesHit < MILESTONES.length &&
        s.maxX >= level.finishDistance * MILESTONES[s.milestonesHit]
      ) {
        events.push({ type: "milestone", share: MILESTONES[s.milestonesHit] });
        s.milestonesHit += 1;
      }
      ```
  - Update `lib/plane-builder/sim/README.md` Model section with one bullet each: boost rings, fuel cans, milestone events.

- [ ] **Step 4: Run** `npx jest lib/plane-builder && npx tsc --noEmit` — all pass. (Any other `LevelDef` literal that fails type-check gets `fuelCans: []`.)

- [ ] **Step 5: Commit** `feat(plane-builder): boost rings, fuel cans and milestone events in the sim`

---

### Task 2: Economy — milestone and landing bonuses

**Files:**

- Modify: `lib/plane-builder/economy/payout.ts`
- Modify: `lib/plane-builder/state/store.ts` (pass previousBest)
- Modify: `lib/plane-builder/balance/pilot.ts` (pass previous best)
- Modify: `components/plane-builder/ui/LastFlight.tsx` (new lines)
- Test: `lib/plane-builder/economy/__tests__/economy.test.ts`, `components/plane-builder/__tests__/screens.test.tsx`, `lib/plane-builder/state/__tests__/store.test.ts` (only if a payout literal needs the new fields)

**Interfaces:**

- Consumes: nothing new (define a local `MILESTONE_SHARES = [0.25, 0.5, 0.75] as const` in `payout.ts`; Task 6 will switch it to import `MILESTONES` from `sim/constants` — do NOT import from sim constants here, Task 1 runs in parallel).
- Produces:
  - `export const MILESTONE_SHARE = 0.1;` `export const LANDING_BONUS = 0.25;`
  - `Payout` = `{ distancePay; coinPay; landingBonus; milestoneBonus; multiplier; total }` (all numbers)
  - `payout(level: LevelDef, result: FlightResult, multiplier: number, previousBest = 0): Payout`
  - `newMilestones(level: LevelDef, previousBest: number, distance: number): number` — count of milestones newly passed.

- [ ] **Step 1: Failing tests** in `economy.test.ts` (reuse the file's `meadow` and `flight()` helpers):

```ts
describe("bonuses", () => {
  const each = Math.round(
    meadow.finishDistance * meadow.payPerMeter * MILESTONE_SHARE
  );

  it("pays each milestone the first time it is passed", () => {
    const p = payout(meadow, flight({ distance: 1100, coins: 0 }), 1, 0);
    expect(p.milestoneBonus).toBe(each * 2); // 25% and 50%
    const again = payout(meadow, flight({ distance: 1100, coins: 0 }), 1, 1000);
    expect(again.milestoneBonus).toBe(0);
    const next = payout(meadow, flight({ distance: 1600, coins: 0 }), 1, 1100);
    expect(next.milestoneBonus).toBe(each);
  });

  it("pays nothing more on a finished level", () => {
    const p = payout(meadow, flight({ distance: 2000, coins: 0 }), 1, 2000);
    expect(p.milestoneBonus).toBe(0);
  });

  it("pays a landing bonus only for a landing", () => {
    const landed = payout(
      meadow,
      flight({ distance: 400, endReason: "landed" }),
      1
    );
    expect(landed.landingBonus).toBe(
      Math.round(landed.distancePay * LANDING_BONUS)
    );
    const crash = payout(
      meadow,
      flight({ distance: 400, endReason: "crash" }),
      1
    );
    expect(crash.landingBonus).toBe(0);
  });

  it("multiplies the whole total", () => {
    const p = payout(
      meadow,
      flight({ distance: 600, coins: 10, endReason: "landed" }),
      2,
      0
    );
    expect(p.total).toBe(
      Math.round(
        (p.distancePay + p.coinPay + p.landingBonus + p.milestoneBonus) * 2
      )
    );
  });
});
```

If the file's `flight()` helper doesn't accept `endReason`, extend it to. In `screens.test.tsx` "shows how the flight went", give the fixture payout `landingBonus: 15, milestoneBonus: 0` and assert `"Nice landing +15"` is shown and no "Milestone flags" text; add a second fixture with `milestoneBonus: 260` asserting `"Milestone flags +260"`. Update every other `payout:` literal in tests to include `landingBonus: 0, milestoneBonus: 0`.

- [ ] **Step 2: Run** `npx jest lib/plane-builder/economy components/plane-builder` — fails.

- [ ] **Step 3: Implement** `payout.ts`:

```ts
const MILESTONE_SHARES = [0.25, 0.5, 0.75] as const;
/** Each milestone flag pays this share of the whole level's distance pay, once. */
export const MILESTONE_SHARE = 0.1;
/** A landing pays this share of the distance pay on top. */
export const LANDING_BONUS = 0.25;

export function newMilestones(
  level: LevelDef,
  previousBest: number,
  distance: number
): number {
  return MILESTONE_SHARES.filter((share) => {
    const at = level.finishDistance * share;
    return previousBest < at && distance >= at;
  }).length;
}

export function payout(level, result, multiplier, previousBest = 0): Payout {
  const distancePay = Math.round(result.distance * level.payPerMeter);
  const coinPay = result.coins;
  const landingBonus =
    result.endReason === "landed" ? Math.round(distancePay * LANDING_BONUS) : 0;
  const milestoneBonus =
    newMilestones(level, previousBest, result.distance) *
    Math.round(level.finishDistance * level.payPerMeter * MILESTONE_SHARE);
  const total = Math.max(
    level.minPayout,
    Math.round(
      (distancePay + coinPay + landingBonus + milestoneBonus) * multiplier
    )
  );
  return {
    distancePay,
    coinPay,
    landingBonus,
    milestoneBonus,
    multiplier,
    total,
  };
}
```

- `store.ts` `completeFlight`: compute `previousBest` before `payout` and pass it as the 4th arg.
- `pilot.ts` `playLevel`: pass `p.levels[id].best` as the 4th arg.
- `LastFlight.tsx`: under the breakdown line add, when non-zero:

  ```tsx
  {
    payout.landingBonus > 0 ? (
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        Nice landing +{formatCoins(payout.landingBonus)}
      </p>
    ) : null;
  }
  {
    payout.milestoneBonus > 0 ? (
      <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
        Milestone flags +{formatCoins(payout.milestoneBonus)}
      </p>
    ) : null;
  }
  ```

- [ ] **Step 4: Run** `npx jest lib/plane-builder components/plane-builder && npx tsc --noEmit`. The balance suite may now fail its ranges — that's expected and is Task 6's job; note which assertions fail in your report, don't retune.

- [ ] **Step 5: Commit** `feat(plane-builder): milestone and landing bonuses`

---

### Task 3: Levels — ring chains, fuel cans, ramp, set pieces, winds

**Files:**

- Modify: `lib/plane-builder/levels/generate.ts`
- Modify: `lib/plane-builder/levels/meadow.ts`, `canyon.ts`, `mountains.ts`
- Test: `lib/plane-builder/levels/__tests__/levels.test.ts`

**Interfaces:**

- Consumes: `LevelDef.fuelCans` (Task 1).
- Produces (in `generate.ts`):

  ```ts
  export interface SetPieceObstacle {
    kind: ObstacleKind;
    hard: boolean;
    x: number;
    z: number;
    half: Vec3;
    float?: number;
  }
  /** Heights (h) are above the terrain at (x, z). */
  export interface SetPiecePoint {
    x: number;
    z: number;
    h: number;
  }
  export interface SetPiece {
    name: string;
    /** No generated hard obstacles in fromX..toX. */
    fromX: number;
    toX: number;
    obstacles?: SetPieceObstacle[];
    rings?: SetPiecePoint[];
    fuelCans?: SetPiecePoint[];
  }
  ```
  - `FeatureSpec.ramp?: boolean` (default: `true` when `hard`, else `false`)
  - `LevelSpec` gains `fuelEvery: number` and `setPieces: SetPiece[]`
  - `export const RING_CHAIN_GAP = 40;`

- [ ] **Step 1: Failing tests** in `levels.test.ts`:

```ts
it.each(LEVEL_ORDER)(
  "%s ring chains stay in the corridor, 12-40 m up",
  (id) => {
    const level = LEVELS[id];
    for (const r of level.rings) {
      const ground = terrainHeight(level.terrain, r.center.x, r.center.z);
      expect(Math.abs(r.center.z)).toBeLessThanOrEqual(level.corridorHalfWidth);
      expect(r.center.y - ground).toBeGreaterThanOrEqual(11.99);
      expect(r.center.y - ground).toBeLessThanOrEqual(40.01);
    }
  }
);

it.each(LEVEL_ORDER)("%s has rings in chains of 3+", (id) => {
  const xs = LEVELS[id].rings.map((r) => r.center.x).sort((a, b) => a - b);
  const close = xs.filter(
    (x, i) => i > 0 && x - xs[i - 1] <= RING_CHAIN_GAP + 0.01
  );
  expect(close.length).toBeGreaterThanOrEqual(xs.length * 0.6);
});

it.each(LEVEL_ORDER)("%s has fuel cans from 300 m, 15-40 m up", (id) => {
  const level = LEVELS[id];
  expect(level.fuelCans.length).toBeGreaterThan(2);
  for (const c of level.fuelCans) {
    expect(c.x).toBeGreaterThanOrEqual(300);
    const h = c.y - terrainHeight(level.terrain, c.x, c.z);
    expect(h).toBeGreaterThanOrEqual(11.99); // set-piece cans may sit at 12+
    expect(h).toBeLessThanOrEqual(40.01);
  }
});

it.each([MEADOW_SPEC, CANYON_SPEC, MOUNTAINS_SPEC])(
  "$id keeps set-piece windows free of generated hard obstacles",
  (spec) => {
    const plain = buildLevel({ ...spec, setPieces: [] });
    const level = buildLevel(spec);
    const placed = new Set(
      spec.setPieces.flatMap((p) =>
        (p.obstacles ?? []).map((o) => `${o.x},${o.z}`)
      )
    );
    for (const piece of spec.setPieces) {
      const generated = level.obstacles.filter(
        (o) =>
          o.hard &&
          !placed.has(`${o.center.x},${o.center.z}`) &&
          o.center.x + o.half.x >= piece.fromX &&
          o.center.x - o.half.x <= piece.toX
      );
      expect(generated).toEqual([]);
    }
    expect(plain.obstacles.length).toBeGreaterThan(0);
  }
);

it("ramps hard obstacles: sparser in the first quarter than the last", () => {
  const level = LEVELS.canyon;
  const hard = level.obstacles.filter((o) => o.hard && o.kind === "wall");
  const q = level.finishDistance / 4;
  const first = hard.filter((o) => o.center.x < q).length;
  const last = hard.filter(
    (o) => o.center.x >= 3 * q && o.center.x < 4 * q
  ).length;
  expect(first).toBeLessThan(last);
});

it("gives the meadow updrafts and the mountains one before the pass", () => {
  expect(LEVELS.meadow.winds.filter((w) => w.lift > 0)).toHaveLength(3);
  expect(
    LEVELS.mountains.winds.some(
      (w) => w.lift > 0 && w.fromX <= 5300 && w.toX >= 5300
    )
  ).toBe(true);
});
```

Import `CANYON_SPEC`, `MOUNTAINS_SPEC`, `RING_CHAIN_GAP`.

- [ ] **Step 2: Run** `npx jest lib/plane-builder/levels` — fails.

- [ ] **Step 3: Implement** `generate.ts`:
  - `place()`: add a `clear: Array<[number, number]>` param (set-piece windows). Skip a hard placement whose box `[x-half.x, x+half.x]` overlaps any window. Spacing step becomes `feature.every * spacingScale(x) * (0.6 + rng() * 0.8)` where, if `feature.ramp ?? feature.hard`, `spacingScale(x) = 1.5 - 0.75 * clamp((x - start) / (end - start), 0, 1)`, else `1`. Always consume the same rng calls whether or not a placement is skipped (keeps the rest deterministic and similar).
  - Rings: replace the single-ring loop with chains:
    ```ts
    for (let x = 200; x < end; x += spec.ringEvery) {
      const count = 3 + Math.floor(rng() * 3); // 3-5
      let z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.6;
      let h = 15 + rng() * 20;
      for (let i = 0; i < count; i += 1) {
        const rx = x + i * RING_CHAIN_GAP;
        if (rx >= end) break;
        rings.push({
          center: { x: rx, y: terrainHeight(spec.terrain, rx, z) + h, z },
          radius: 6,
        });
        z = clamp(
          z + (rng() * 2 - 1) * 8,
          -spec.corridorHalfWidth * 0.8,
          spec.corridorHalfWidth * 0.8
        );
        h = clamp(h + (rng() * 2 - 1) * 8, 12, 40);
      }
    }
    ```
  - Fuel cans: `for (let x = 300; x < end; x += spec.fuelEvery)` place one at random `z` (±0.6 corridor) and `h = 15 + rng() * 25` above terrain.
  - Set pieces, appended after generation: obstacles get `center.y = maxGround(x±half.x, z) + (float ?? 0) + half.y` (same rule as `place`); ring points become `{ center: { x, y: terrain + h, z }, radius: 6 }`; can points become `{ x, y: terrain + h, z }`.
  - Strip `fuelEvery` and `setPieces` from the returned def like the other spec-only fields.
  - Add a local `clamp` helper.
- Level specs (add `fuelEvery` and `setPieces`; meadow `winds` gets three updrafts):
  - **Meadow:** `fuelEvery: 400`; `winds: [600, 1100, 1600].map((fromX) => ({ fromX, toX: fromX + 80, lift: 2.5, push: 0 }))`; set pieces:
    - `{ name: "Barn gate", fromX: 960, toX: 1100, obstacles: [{ kind: "barn", hard: true, x: 1000, z: 18, half: { x: 8, y: 6, z: 8 } }, { kind: "barn", hard: true, x: 1000, z: -18, half: { x: 8, y: 6, z: 8 } }], rings: [{ x: 960, z: 0, h: 12 }, { x: 1000, z: 0, h: 12 }, { x: 1040, z: 0, h: 12 }] }`
    - `{ name: "Balloon arch", fromX: 1480, toX: 1560, obstacles: [-30, -15, 0, 15, 30].map((z) => ({ kind: "balloon", hard: false, x: 1500, z, half: { x: 2.5, y: 3, z: 2.5 }, float: 18 + (30 - Math.abs(z)) * 0.3 })), rings: [{ x: 1460, z: 0, h: 30 }, { x: 1500, z: 0, h: 34 }, { x: 1540, z: 0, h: 30 }] }`
  - **Canyon:** `fuelEvery: 500`; set pieces:
    - `{ name: "Arch gauntlet", fromX: 1930, toX: 2270, obstacles: [1950, 2050, 2150, 2250].map((x, i) => ({ kind: "arch", hard: true, x, z: i % 2 ? 14 : -14, half: { x: 6, y: 20, z: 8 } })), rings: [1950, 2050, 2150, 2250].map((x, i) => ({ x, z: i % 2 ? -14 : 14, h: 15 })) }`
    - `{ name: "Updraft climb", fromX: 2980, toX: 3140, rings: [3000, 3040, 3080, 3120].map((x, i) => ({ x, z: 0, h: 15 + i * 7 })) }` and add a wind `{ fromX: 2980, toX: 3120, lift: 3, push: 0 }` to `winds`.
  - **Mountains:** `fuelEvery: 600`; add wind `{ fromX: 5200, toX: 5350, lift: 3, push: 0 }`; set pieces:
    - `{ name: "Twin peaks", fromX: 2950, toX: 3050, obstacles: [{ kind: "peak", hard: true, x: 3000, z: 45, half: { x: 25, y: 60, z: 25 } }, { kind: "peak", hard: true, x: 3000, z: -45, half: { x: 25, y: 60, z: 25 } }], rings: [{ x: 2960, z: 0, h: 20 }, { x: 3000, z: 0, h: 20 }, { x: 3040, z: 0, h: 20 }] }` (gap = 90 − 50 = 40 m)
    - `{ name: "Before the pass", fromX: 5200, toX: 5350, fuelCans: [{ x: 5280, z: 0, h: 25 }] }`

- [ ] **Step 4: Run** `npx jest lib/plane-builder/levels lib/plane-builder/sim && npx tsc --noEmit`. The balance suite may shift — report, don't retune (Task 6).

- [ ] **Step 5: Commit** `feat(plane-builder): ring chains, fuel cans, ramped obstacles and set pieces`

---

### Task 4: Scene — winds, fuel cans, milestone flags, distance signs

**Files:**

- Create: `components/plane-builder/scene/Winds.tsx`
- Create: `components/plane-builder/scene/Markers.tsx` (milestone flags + distance signs)
- Create: `components/plane-builder/scene/signTexture.ts` (canvas label texture helper)
- Modify: `components/plane-builder/scene/Pickups.tsx` (fuel cans)
- Modify: `components/plane-builder/scene/WorldScene.tsx` (mount Winds, Markers; pass `hasEngine`)

**Interfaces:**

- Consumes: `LevelDef.fuelCans`, `LevelDef.winds`, `FlightState.canTaken` (Task 1), `MILESTONES` from `@/lib/plane-builder/sim/constants` (Task 1).
- Produces: `Winds({ level })`, `Markers({ level })`, `Pickups({ level, hasEngine })`, `createLabelTexture(text: string, bg: string, fg: string): CanvasTexture`.

- [ ] **Step 1:** `signTexture.ts`: move the canvas-drawing approach from `FinishGate.tsx`'s `createBannerTexture` into a reusable `createLabelTexture(text, bg, fg)` (512×128 canvas, bold 96px sans-serif — shrink font to fit text width), and have `FinishGate` call `createLabelTexture("FINISH", "#dc2626", "#ffffff")`.

- [ ] **Step 2:** `Markers.tsx` (`"use client"`): for each share in `MILESTONES`, at `x = finishDistance × share`, `z = corridorHalfWidth + 4`, a pole (cylinder, 14 m tall) on the terrain with a flag plane (8×4) using `createLabelTexture(share === 0.5 ? "Halfway!" : \`${share * 100}%\`, "#f59e0b", "#111827")`. Every 500 m from 500 to `finishDistance - 1`, skipping x within 50 m of a milestone, a short sign (post 5 m, board 6×1.5) at `z = -(corridorHalfWidth + 4)`labelled`"${x} m"`with`createLabelTexture(label, "#ffffff", "#0f172a")`. Dispose textures/geometries on unmount (`useEffect`cleanup), create them in`useMemo`/`useState` initialisers.

- [ ] **Step 3:** `Winds.tsx` (`"use client"`): one `instancedMesh` of thin translucent boxes (0.3×3×0.3, `meshBasicMaterial` white, `transparent`, `opacity={0.35}`, `depthWrite={false}`) per wind zone kind. Streak count per zone: `Math.ceil((toX - fromX) / 4)` spread across x and the corridor width (deterministic positions from index, e.g. golden-ratio offsets — no `Math.random`). Lift zones: streaks move up `lift × 3` m/s and wrap within 0–60 m above the terrain. Push zones: streaks lie horizontal (rotate 90° about x) and move along z in `sign(push)` at `|push| × 3` m/s, wrapping across the corridor. Animate in `useFrame` with `clock.elapsedTime` (freeze when `heldFlightSeconds() !== undefined`, like `Pickups`). `frustumCulled={false}`.

- [ ] **Step 4:** `Pickups.tsx`: add a `hasEngine: boolean` prop. When true, render `level.fuelCans` as an instanced mesh of red cylinders (radius 1, height 2, `#ef4444`, emissive 0.3) that bob gently and shrink to 0 when `flight?.canTaken[i]`. When false, render nothing for cans.

- [ ] **Step 5:** `WorldScene.tsx`: mount `<Winds level={level} />` and `<Markers level={level} />`; pass `hasEngine={tiers.engine > 0 && level.plane.engine.values[tiers.engine] > 0}` to `Pickups`.

- [ ] **Step 6:** Run `npx tsc --noEmit && npx eslint components/plane-builder && npx jest components/plane-builder` (existing tests must still pass; scene components have no unit tests, matching the existing scene files).

- [ ] **Step 7: Commit** `feat(plane-builder): draw winds, fuel cans, milestone flags and distance signs`

---

### Task 5: Flight feedback — HUD pop-ups and sounds

**Files:**

- Create: `lib/plane-builder/state/flightToasts.ts`
- Create: `components/plane-builder/ui/FlightToasts.tsx`
- Modify: `components/plane-builder/audio/flightCues.ts`, `components/plane-builder/audio/planeSynth.ts`
- Modify: `components/plane-builder/ui/FlightHud.tsx` (mount `FlightToasts`)
- Modify: `lib/plane-builder/state/store.ts` (`startLaunch` and `resetTransient` call `clearFlightToasts()`)
- Test: `lib/plane-builder/state/__tests__/flightToasts.test.ts`, `components/plane-builder/__tests__/screens.test.tsx` (FlightHud block), audio cue test if one exists for `cueForEvent`

**Interfaces:**

- Consumes: `FlightEvent` variants `fuel` and `milestone` (Task 1).
- Produces:

  ```ts
  export interface FlightToast {
    id: number;
    text: string;
  }
  export function toastForEvent(event: FlightEvent): string | null; // ring→"Boost!", fuel→"+Fuel", milestone 0.25→"25%!", 0.5→"Halfway!", 0.75→"75%!", else null
  export const flightToasts: {
    get(): FlightToast | null;
    push(text: string): void;
    subscribe(l: () => void): () => void;
  };
  export function clearFlightToasts(): void;
  ```

  `push` replaces the current toast (newest wins) with an incrementing id. Expiry is handled by the component (1.2 s timer keyed on id), not by the store.

- [ ] **Step 1: Failing tests**:
  - `flightToasts.test.ts`: `toastForEvent` mapping for each case (including `coin` → null); `push` notifies subscribers and increments id; `clearFlightToasts` sets `get()` to null and notifies.
  - `screens.test.tsx` FlightHud: after `act(() => flightToasts.push("Boost!"))`, `screen.getByText("Boost!")` is visible; with `jest.useFakeTimers()`, advancing 1300 ms removes it. The polite live region (`role="status"` or `aria-live="polite"` sr-only) contains the text.
  - `cueForEvent({ type: "fuel", index: 0 })` → `"fuel"`, `cueForEvent({ type: "milestone", share: 0.5 })` → `"flag"`.

- [ ] **Step 2: Run** the tests — fail.

- [ ] **Step 3: Implement.**
  - `flightToasts.ts`: module-level `current`, `nextId`, listener set (same shape as `flightLive.ts`).
  - `flightCues.ts`: add `fuel: "fuel"`, `milestone: "flag"` to `CUE_FOR_EVENT`; in `playFlightEvents`, also `const text = toastForEvent(event); if (text) flightToasts.push(text);`.
  - `planeSynth.ts`: add cues `"fuel"` (two quick rising blips, like a glug) and `"flag"` (a short three-note fanfare, shorter and quieter than `"cheer"`) to `PlaneCue` and its `play` switch, following the existing cue code style.
  - `FlightToasts.tsx` (`"use client"`): `useSyncExternalStore(flightToasts.subscribe, flightToasts.get, () => null)`; local `visibleId` state cleared by a 1.2 s `setTimeout` per toast id; render `aria-hidden` big text (`text-4xl font-black text-white drop-shadow-lg` with a dark-mode-safe outline, plus the existing `pb-finish-banner`-style animation if suitable) at top-centre below the progress bar, plus an `sr-only` `aria-live="polite"` paragraph with the text.
  - `FlightHud.tsx`: render `<FlightToasts />`.
  - `store.ts`: call `clearFlightToasts()` in `startLaunch` and `resetTransient`.

- [ ] **Step 4: Run** `npx jest lib/plane-builder components/plane-builder && npx tsc --noEmit && npx eslint components/plane-builder lib/plane-builder`.

- [ ] **Step 5: Commit** `feat(plane-builder): pop-ups and sounds for boosts, fuel and milestones`

---

### Task 6: Glide tuning, balance and release 1.2.0

**Files:**

- Modify: `lib/plane-builder/sim/constants.ts` (`LIFT_HEADROOM`, `LAND_ANGLE`, maybe `LAND_SPEED`, `RING_BOOST`)
- Modify: `lib/plane-builder/economy/payout.ts` (import `MILESTONES` from `../sim/constants` instead of the local copy)
- Modify: level catalogs in `meadow.ts`, `canyon.ts`, `mountains.ts` (prices/ladders/`MILESTONE_SHARE` if needed)
- Modify: `lib/plane-builder/balance/__tests__/balance.test.ts` (new glide-tail test)
- Modify: `lib/plane-builder/version.ts` → `"1.2.0"`, `lib/plane-builder/changelog.ts`, `lib/plane-builder/sim/README.md`

- [ ] **Step 1: Failing test** (glide tail) in `balance.test.ts`:

```ts
describe("glide tail", () => {
  it.each(LEVEL_ORDER)("%s planes come down within 15 s and land", (id) => {
    for (const t of [0, 2, 4, 6, 8]) {
      const tiers = { ...STARTER_TIERS };
      for (const track of TRACK_IDS) tiers[track] = t;
      const stats = { ...planeStats(LEVELS[id].plane, tiers), fuel: 0 };
      const level = flatLevel({
        finishDistance: 100000,
        plane: LEVELS[id].plane,
      });
      const s = launch(level, stats, { pitch: 0, yaw: 0, power: 1 });
      s.y = CEILING;
      s.pitch = 0;
      s.speed = stallSpeed(stats) * 1.5;
      while (s.phase === "flying") step(s, level, stats, HANDS_OFF);
      expect(s.time).toBeLessThanOrEqual(15);
      expect(s.endReason === "crash").toBe(false);
    }
  });
});
```

(Import `flatLevel` from `../../sim/__tests__/fixtures`, `launch`/`step` from `../../sim/flight`, `CEILING` from `../../sim/constants`, `stallSpeed` from `../../plane/stats`; `HANDS_OFF = { pitch: 0, bank: 0, boost: false }`.)

- [ ] **Step 2: Tune.** Set `LIFT_HEADROOM = 1.1`, `LAND_ANGLE = -0.55`; run `npx jest lib/plane-builder`. Iterate on `LIFT_HEADROOM` (0.9–1.3), `LAND_ANGLE` (−0.45 to −0.7), `LAND_SPEED` (45–55), `MILESTONE_SHARE` (0.05–0.15) and per-level `basePrice` values until the glide-tail test and the whole balance suite pass with **unchanged** thresholds. Prefer the smallest set of changes; don't touch the thresholds. A scratch script can print per-flight logs: `npx jiti <script.ts>` calling `playLevel(id)`.

- [ ] **Step 3: Release.** `version.ts` → `"1.2.0"`; changelog entry at the top, date `2026-10-17`, title `"More to do in every flight"`, highlights in plain kid words: boost rings, fuel cans, visible updrafts, milestone flags with a bonus the first time, landing bonus, new set pieces (name them per level), distance signs, gentler starts, shorter glides with easier landings. Update the sim README (glide/landing numbers).

- [ ] **Step 4: Run** `npx jest lib/plane-builder components/plane-builder && npx tsc --noEmit && npx eslint lib/plane-builder components/plane-builder`.

- [ ] **Step 5: Commit** `feat(plane-builder): shorter glides, easier landings and balance for 1.2.0`

---

### Final verification (controller, once)

- `npm run validate` (lint, format, types, all unit tests, build).
- `npx playwright test e2e/plane-builder.spec.ts --project=chromium --project=webkit --project=ipad`.
- A screenshot pass of a flight (winds, flags, signs, fuel can, pop-up) at phone width.
- One whole-branch review (Sonnet) of `main..HEAD`, fixing Critical/Important findings.
