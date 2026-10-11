# Plane Builder 1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Plane Builder at `/plane-builder`. You launch a plane from a
slingshot, fly it in 3D down a corridor toward a far finish line, earn coins,
and buy upgrades. There are three levels, with Replay and Restart on each.

**Spec:** `docs/superpowers/specs/2026-10-11-plane-builder-design.md`. Read it
first.

**Architecture:** A standalone sibling of Ship Builder.

- `lib/plane-builder/` is pure TypeScript: the levels, the upgrade catalog, a
  fixed-step flight sim that gives the same result every run, the economy,
  saving, a balance pilot and a zustand store.
- `components/plane-builder/` holds the react-three-fiber scene and the
  Tailwind UI.
- From Ship Builder it imports only `createStoredSetting`, `useWebGLSupport`
  and `usePrefersReducedMotion`. Ship Builder's synthesizer, sky and fallback
  screen are tied to ships, so Plane Builder has its own small versions, which
  the spec allows.

**Tech stack:** Next.js 16 static export, React 19, three 0.186,
@react-three/fiber 9 with drei, zustand, Tailwind 4, Jest with Testing
Library, Playwright.

**Conventions** (CLAUDE.md):

- `export default function` for components, `interface` for props, the `@/`
  alias.
- Tailwind only, with light and dark mode on every DOM element.
- Mobile-first.
- Prettier: double quotes, semicolons, trailing commas (es5), 80 columns.
- Tests live in `__tests__/` next to the code.
- Run a single test file with `npm test -- --testPathPatterns=<name>`.

**Coordinates used everywhere:**

- `x` points forward, toward the finish, and starts at 0 at the slingshot.
- `y` points up.
- `z` points sideways. The corridor is `|z| <= corridorHalfWidth`.
- `heading` 0 means flying along +x, and a positive heading turns toward +z.
- `pitch` is the flight-path angle in radians, with up positive.

**Never touch** anything under `components/ship-builder`, `lib/ship-builder`,
`app/ship-builder` or `public/ship-builder-sw.js`. Changing them would force a
Ship Builder release.

---

## File map

```
app/plane-builder/page.tsx                       route + metadata
app/plane-builder/versions/page.tsx              changelog route
components/plane-builder/PlaneBuilder.tsx        client root: hydrate, persist, screen switch
components/plane-builder/VersionHistory.tsx      changelog page body
components/plane-builder/ui/*.tsx                LevelSelect, Hangar, UpgradeTrack, LaunchOverlay,
                                                 FlightHud, Results, FinishCard, ConfirmRestart,
                                                 SoundToggle, WebGLFallback, Steering
components/plane-builder/scene/*.tsx             Stage (Canvas), Sky, Terrain, Obstacles, Pickups,
                                                 FinishGate, PlaneModel, Slingshot, HangarScene,
                                                 FlightScene, FlightRunner, ChaseCamera
components/plane-builder/audio/planeSynth.ts     Web Audio cues + engine hum
components/plane-builder/audio/soundSetting.ts   stored on/off
lib/plane-builder/version.ts, changelog.ts, testHooks.ts
lib/plane-builder/plane/catalog.ts, stats.ts
lib/plane-builder/levels/types.ts, rng.ts, terrain.ts, generate.ts,
                         meadow.ts, canyon.ts, mountains.ts, index.ts
lib/plane-builder/sim/constants.ts, flight.ts, README.md
lib/plane-builder/economy/payout.ts, progress.ts
lib/plane-builder/persist/schema.ts, local.ts
lib/plane-builder/balance/pilot.ts
lib/plane-builder/state/store.ts, flightInput.ts, flightLive.ts
e2e/plane-builder.spec.ts, e2e/plane-builder-visual.spec.ts
```

Each file stays under about 300 lines. If a scene or UI file grows past that,
split it.

---

### Task 1: Scaffold the route, version, changelog and release rule

**Goal:** `/plane-builder` renders a "Plane Builder" heading, and
`/plane-builder/versions` lists the 1.0.0 entry. The version and changelog test
passes, and CLAUDE.md has the release rule.

**Files:**

- Create:
  - `lib/plane-builder/version.ts`
  - `lib/plane-builder/changelog.ts`
  - `lib/plane-builder/testHooks.ts`
  - `lib/plane-builder/__tests__/changelog.test.ts`
  - `app/plane-builder/page.tsx`
  - `app/plane-builder/versions/page.tsx`
  - `components/plane-builder/PlaneBuilder.tsx`
  - `components/plane-builder/VersionHistory.tsx`
- Modify:
  - `CLAUDE.md`, adding a "Plane Builder releases" section after "Ship Builder
    releases"
  - `playwright.config.ts`: change the iPad project's
    `testMatch: /ship-builder/` to `testMatch: /(ship|plane)-builder/`

**Acceptance criteria:**

- [ ] `npm test -- --testPathPatterns=plane-builder` passes.
- [ ] `npm run build` exports `out/plane-builder/index.html` and
      `out/plane-builder/versions/index.html`.
- [ ] CLAUDE.md documents the release rule for `components/plane-builder`,
      `lib/plane-builder` and `app/plane-builder`.

**Verify:**
`npm test -- --testPathPatterns=plane-builder && npm run type-check`, which
should pass.

**Steps:**

- [ ] **Step 1: Version, changelog and test hooks**

```ts
// lib/plane-builder/version.ts
/** Bumped by hand with each release. */
export const PLANE_BUILDER_VERSION = "1.0.0";
```

```ts
// lib/plane-builder/changelog.ts
/**
 * What changed in each Plane Builder release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of PLANE_BUILDER_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`),
 * in plain words a young pilot or their parent would follow.
 */
export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: "1.0.0",
    date: "2026-10-11",
    title: "Plane Builder takes off",
    highlights: [
      "Launch your plane from a slingshot and see how far it flies",
      "Earn coins every flight and spend them on wings, engines, fuel and more",
      "Three worlds to beat: the Meadow, the Canyon and the Mountains",
    ],
  },
];
```

```ts
// lib/plane-builder/testHooks.ts
/**
 * Whether the page exposes its test hooks (the store on `window`). On in
 * development and in the e2e build (`NEXT_PUBLIC_E2E=1`), off in the build
 * that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";
```

- [ ] **Step 2: Changelog test.** Copy
      `lib/ship-builder/__tests__/changelog.test.ts` to
      `lib/plane-builder/__tests__/changelog.test.ts`. Change the imports to
      `../changelog` and `../version`, replace `SHIP_BUILDER_VERSION` with
      `PLANE_BUILDER_VERSION`, and change the comment path to
      `lib/plane-builder/changelog.ts`. Run it. It should pass.

- [ ] **Step 3: Routes.** Copy `app/ship-builder/page.tsx` to
      `app/plane-builder/page.tsx` and change:
  - the title to `"Plane Builder | Gentry Riggen"`
  - the description to `"Launch a plane from a slingshot, earn coins, upgrade it and fly all the way to the finish line."`
  - the canonical and Open Graph URL to `https://gentryriggen.com/plane-builder`
  - the Open Graph and Twitter titles to `"Plane Builder"`
  - the component to `PlaneBuilderPage`, rendering `<PlaneBuilder />`

  Remove `manifest`, `appleWebApp`, `other` and the `apple` icon, since a PWA
  is out of scope. Keep `icons.icon`. Set `themeColor: "#2b6cb0"`.

  Copy `app/ship-builder/versions/page.tsx` to
  `app/plane-builder/versions/page.tsx` the same way: the title is
  `"What's new | Plane Builder"`, and it renders the Plane Builder
  `VersionHistory`.

- [ ] **Step 4: VersionHistory.** Copy
      `components/ship-builder/VersionHistory.tsx` to
      `components/plane-builder/VersionHistory.tsx`. Change the imports to
      `@/lib/plane-builder/...`, the link to `href="/plane-builder"` with the
      text `← Back to Plane Builder`, and use `PLANE_BUILDER_VERSION`.

- [ ] **Step 5: Placeholder root** (replaced in Task 8):

```tsx
// components/plane-builder/PlaneBuilder.tsx
"use client";

export default function PlaneBuilder() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-sky-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <h1 className="text-2xl font-bold">Plane Builder</h1>
    </div>
  );
}
```

- [ ] **Step 6: CLAUDE.md.** Add this after the "Ship Builder releases"
      section:

```markdown
### Plane Builder releases

Every Plane Builder change that ships to users (anything in `components/plane-builder`, `lib/plane-builder` or `app/plane-builder`) is a release:

1. Bump `PLANE_BUILDER_VERSION` in `lib/plane-builder/version.ts` (semver: patch for fixes, minor for features, major for big new modes).
2. Add a matching entry at the top of `CHANGELOG` in `lib/plane-builder/changelog.ts`, written from the commits since the last release (`git log <last version commit>..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`), in plain words a young pilot or their parent would follow.

The Versions page (`/plane-builder/versions`) renders the changelog. `lib/plane-builder/__tests__/changelog.test.ts` fails if the version and the top entry disagree. 1.0.0 is the first release: until it ships, keep editing the 1.0.0 entry instead of bumping.
```

Also update the iPad `testMatch` in `playwright.config.ts`, then run the verify
command.

- [ ] **Step 7: Commit:** `feat(plane-builder): scaffold route, version and changelog`

---

### Task 2: Upgrade catalog and plane stats

**Goal:** Define the upgrade tracks and tier prices, and the function that
turns the tiers a player owns into flight stats.

**Files:**

- Create:
  - `lib/plane-builder/plane/catalog.ts`
  - `lib/plane-builder/plane/stats.ts`
  - `lib/plane-builder/plane/__tests__/stats.test.ts`

**Acceptance criteria:**

- [ ] Prices grow by 1.5× per tier, and `tierPrice` returns null at the top
      tier.
- [ ] `planeStats` reads each track's value at the owned tier, and shields are
      `ceil(bodyTier / 2)`.
- [ ] `ladder` gives 9 values from the start value to the end value.

**Verify:** `npm test -- --testPathPatterns=plane-builder/plane`

**Steps:**

- [ ] **Step 1: Write the failing tests.**

```ts
// lib/plane-builder/plane/__tests__/stats.test.ts
import {
  MAX_TIER,
  STARTER_TIERS,
  ladder,
  makeCatalog,
  tierPrice,
} from "../catalog";
import { planeStats } from "../stats";

const catalog = makeCatalog({
  launcher: { basePrice: 10, from: 10, to: 50 },
  wings: { basePrice: 10, from: 0.03, to: 0.15 },
  engine: { basePrice: 10, from: 0, to: 12 },
  fuel: { basePrice: 10, from: 3, to: 30 },
  body: { basePrice: 10, from: 0.01, to: 0.003 },
  multiplier: { basePrice: 10, from: 1, to: 3 },
  parts: {
    launcher: ["Twig sling"],
    wings: ["Stubs"],
    engine: ["None"],
    fuel: ["Cup"],
    body: ["Box"],
    multiplier: ["x1"],
  },
});

describe("catalog", () => {
  it("builds a 9-step ladder from start to end", () => {
    const values = ladder(0, 8);
    expect(values).toHaveLength(MAX_TIER + 1);
    expect(values[0]).toBe(0);
    expect(values[8]).toBe(8);
  });

  it("raises prices 1.5x per tier and stops at the top", () => {
    expect(tierPrice(catalog.engine, 0)).toBe(10);
    expect(tierPrice(catalog.engine, 1)).toBe(15);
    expect(tierPrice(catalog.engine, 2)).toBe(23);
    expect(tierPrice(catalog.engine, MAX_TIER)).toBeNull();
  });

  it("pads part names so every tier has one", () => {
    expect(catalog.wings.parts).toHaveLength(MAX_TIER + 1);
    expect(catalog.wings.parts[8]).toBe("Stubs 9");
  });
});

describe("planeStats", () => {
  it("gives starter values at tier 0", () => {
    expect(planeStats(catalog, STARTER_TIERS)).toEqual({
      launchSpeed: 10,
      lift: 0.03,
      thrust: 0,
      fuel: 3,
      drag: 0.01,
      shields: 0,
      multiplier: 1,
    });
  });

  it("reads each track at its tier, with shields from body", () => {
    const stats = planeStats(catalog, {
      ...STARTER_TIERS,
      engine: 8,
      body: 3,
    });
    expect(stats.thrust).toBe(12);
    expect(stats.shields).toBe(2);
  });
});
```

- [ ] **Step 2: Run them** with
      `npm test -- --testPathPatterns=plane-builder/plane`. They should fail
      because the module isn't found.

- [ ] **Step 3: Implement.**

```ts
// lib/plane-builder/plane/catalog.ts
export const TRACK_IDS = [
  "launcher",
  "wings",
  "engine",
  "fuel",
  "body",
  "multiplier",
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/** Tiers run 0 (starter) to MAX_TIER. */
export const MAX_TIER = 8;
export const PRICE_GROWTH = 1.5;

export type Tiers = Record<TrackId, number>;

export const STARTER_TIERS: Tiers = {
  launcher: 0,
  wings: 0,
  engine: 0,
  fuel: 0,
  body: 0,
  multiplier: 0,
};

export const TRACK_LABELS: Record<TrackId, string> = {
  launcher: "Launcher",
  wings: "Wings",
  engine: "Engine",
  fuel: "Fuel",
  body: "Body",
  multiplier: "Coin boost",
};

/** Shown as "<label> <n> → <effect>". */
export const TRACK_EFFECTS: Record<TrackId, string> = {
  launcher: "launch faster",
  wings: "glide further",
  engine: "more push",
  fuel: "fly longer",
  body: "less drag and more bump shields",
  multiplier: "more coins every flight",
};

export interface TrackDef {
  /** Price of tier 1; each later tier costs PRICE_GROWTH times more. */
  basePrice: number;
  /** Stat value at tiers 0..MAX_TIER. */
  values: readonly number[];
  /** Part name at tiers 0..MAX_TIER. */
  parts: readonly string[];
}

export type PlaneCatalog = Record<TrackId, TrackDef>;

/** MAX_TIER + 1 values from `from` to `to`, eased by `curve` (1 = linear). */
export function ladder(from: number, to: number, curve = 1): number[] {
  return Array.from({ length: MAX_TIER + 1 }, (_, i) => {
    const value = from + (to - from) * (i / MAX_TIER) ** curve;
    return Math.round(value * 10000) / 10000;
  });
}

/** Coins to go from `currentTier` to the next, or null at the top. */
export function tierPrice(track: TrackDef, currentTier: number): number | null {
  if (currentTier >= MAX_TIER) return null;
  return Math.round(track.basePrice * PRICE_GROWTH ** currentTier);
}

interface TrackSpec {
  basePrice: number;
  from: number;
  to: number;
  curve?: number;
}

type CatalogSpec = Record<TrackId, TrackSpec> & {
  /** Names for the first tiers; missing ones repeat the last with a number. */
  parts: Record<TrackId, readonly string[]>;
};

function padParts(names: readonly string[]): string[] {
  return Array.from({ length: MAX_TIER + 1 }, (_, i) =>
    i < names.length ? names[i] : `${names[names.length - 1]} ${i + 1}`
  );
}

export function makeCatalog(spec: CatalogSpec): PlaneCatalog {
  const entries = TRACK_IDS.map((id) => {
    const track = spec[id];
    const def: TrackDef = {
      basePrice: track.basePrice,
      values: ladder(track.from, track.to, track.curve),
      parts: padParts(spec.parts[id]),
    };
    return [id, def] as const;
  });
  return Object.fromEntries(entries) as PlaneCatalog;
}
```

```ts
// lib/plane-builder/plane/stats.ts
import type { PlaneCatalog, Tiers } from "./catalog";

export interface PlaneStats {
  /** Launch speed at full pull, m/s. */
  launchSpeed: number;
  /** Lift coefficient: lift accel = lift × speed² (m/s²). Stall speed = √(g / lift). */
  lift: number;
  /** Engine push, m/s². */
  thrust: number;
  /** Seconds of normal burn. */
  fuel: number;
  /** Drag coefficient: drag decel = drag × speed². */
  drag: number;
  /** Hard hits survived. */
  shields: number;
  /** Payout multiplier. */
  multiplier: number;
}

export function planeStats(catalog: PlaneCatalog, tiers: Tiers): PlaneStats {
  return {
    launchSpeed: catalog.launcher.values[tiers.launcher],
    lift: catalog.wings.values[tiers.wings],
    thrust: catalog.engine.values[tiers.engine],
    fuel: catalog.fuel.values[tiers.fuel],
    drag: catalog.body.values[tiers.body],
    shields: Math.ceil(tiers.body / 2),
    multiplier: catalog.multiplier.values[tiers.multiplier],
  };
}
```

- [ ] **Step 4: Run the tests.** They should pass.
- [ ] **Step 5: Commit:** `feat(plane-builder): upgrade catalog and plane stats`

---

### Task 3: Level data: seeded generator, terrain and three levels

**Goal:** Build the three levels from fixed seeds so their contents are the
same on every run. Each level has its terrain, obstacles, coins, rings, wind
and plane catalog.

**Files:**

- Create:
  - `lib/plane-builder/levels/types.ts`
  - `rng.ts`, `terrain.ts`, `generate.ts`
  - `meadow.ts`, `canyon.ts`, `mountains.ts`, `index.ts`
  - `lib/plane-builder/levels/__tests__/levels.test.ts`

**Acceptance criteria:**

- [ ] `buildLevel` called twice with the same spec gives deep-equal output.
- [ ] Terrain is 0 for `x <= flatUntil` and never negative.
- [ ] Nothing hard sits within 80 m of the slingshot.
- [ ] Every obstacle's bottom sits on or above the terrain.
- [ ] `LEVEL_ORDER` is `["meadow", "canyon", "mountains"]`, with finish
      distances of 2000, 4000 and 6000.

**Verify:** `npm test -- --testPathPatterns=plane-builder/levels`

**Steps:**

- [ ] **Step 1: Types**

```ts
// lib/plane-builder/levels/types.ts
import type { PlaneCatalog } from "../plane/catalog";

export type LevelId = "meadow" | "canyon" | "mountains";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type ObstacleKind =
  "tree" | "barn" | "balloon" | "wall" | "arch" | "bird" | "peak";

/** An axis-aligned box. Rendering may draw a nicer shape inside it. */
export interface Obstacle {
  kind: ObstacleKind;
  center: Vec3;
  half: Vec3;
  /** Hard ends the flight (or spends a shield); soft only slows. */
  hard: boolean;
}

export interface Ring {
  center: Vec3;
  radius: number;
}

/** Inside fromX..toX, lift pushes up and push pushes sideways (+z), in m/s. */
export interface WindZone {
  fromX: number;
  toX: number;
  lift: number;
  push: number;
}

export interface TerrainDef {
  seed: number;
  /** Tallest hill, m. 0 = flat. */
  amplitude: number;
  wavelength: number;
  /** Flat ground up to here (slingshot area). */
  flatUntil: number;
}

export interface LevelPalette {
  sky: string;
  horizon: string;
  ground: string;
  hill: string;
  hard: string;
  soft: string;
  plane: string;
  trim: string;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  blurb: string;
  finishDistance: number;
  corridorHalfWidth: number;
  /** Coins per metre of progress. */
  payPerMeter: number;
  /** Every flight pays at least this. */
  minPayout: number;
  terrain: TerrainDef;
  obstacles: Obstacle[];
  coins: Vec3[];
  rings: Ring[];
  winds: WindZone[];
  plane: PlaneCatalog;
  palette: LevelPalette;
}
```

- [ ] **Step 2: Write the failing tests.**

```ts
// lib/plane-builder/levels/__tests__/levels.test.ts
import { buildLevel } from "../generate";
import { LEVELS, LEVEL_ORDER } from "../index";
import { MEADOW_SPEC } from "../meadow";
import { terrainHeight } from "../terrain";

describe("levels", () => {
  it("are in order with growing finish lines", () => {
    expect(LEVEL_ORDER).toEqual(["meadow", "canyon", "mountains"]);
    expect(LEVEL_ORDER.map((id) => LEVELS[id].finishDistance)).toEqual([
      2000, 4000, 6000,
    ]);
  });

  it("build the same every time", () => {
    expect(buildLevel(MEADOW_SPEC)).toEqual(buildLevel(MEADOW_SPEC));
  });

  it.each(LEVEL_ORDER)("%s keeps the launch area clear", (id) => {
    const level = LEVELS[id];
    for (const o of level.obstacles.filter((o) => o.hard)) {
      expect(o.center.x - o.half.x).toBeGreaterThan(80);
    }
  });

  it.each(LEVEL_ORDER)("%s sits obstacles on the ground", (id) => {
    const level = LEVELS[id];
    for (const o of level.obstacles) {
      const ground = terrainHeight(level.terrain, o.center.x, o.center.z);
      expect(o.center.y - o.half.y).toBeGreaterThanOrEqual(ground - 0.01);
    }
  });

  it.each(LEVEL_ORDER)("%s has coins and rings", (id) => {
    expect(LEVELS[id].coins.length).toBeGreaterThan(20);
    expect(LEVELS[id].rings.length).toBeGreaterThan(3);
  });
});

describe("terrainHeight", () => {
  const terrain = {
    seed: 7,
    amplitude: 30,
    wavelength: 120,
    flatUntil: 100,
  };
  it("is flat at the slingshot", () => {
    expect(terrainHeight(terrain, 50, 10)).toBe(0);
  });
  it("is never below zero", () => {
    for (let x = 0; x < 3000; x += 37) {
      expect(terrainHeight(terrain, x, (x % 90) - 45)).toBeGreaterThanOrEqual(
        0
      );
    }
  });
});
```

- [ ] **Step 3: Implement the RNG, terrain and generator.**

```ts
// lib/plane-builder/levels/rng.ts
/** mulberry32: a small seeded PRNG giving floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// lib/plane-builder/levels/terrain.ts
import type { TerrainDef } from "./types";

/** Rises from flat over this many metres after flatUntil. */
const RAMP = 120;

/** Ground height at (x, z), m. Smooth, seeded and never negative. */
export function terrainHeight(t: TerrainDef, x: number, z: number): number {
  if (t.amplitude === 0 || x <= t.flatUntil) return 0;
  const ramp = Math.min(1, (x - t.flatUntil) / RAMP);
  const p1 = (t.seed * 0.618) % (Math.PI * 2);
  const p2 = (t.seed * 1.303) % (Math.PI * 2);
  const wave =
    Math.sin(x / t.wavelength + p1) * 0.6 +
    Math.sin(x / (t.wavelength * 0.37) + z / (t.wavelength * 0.5) + p2) * 0.4;
  return t.amplitude * (wave * 0.5 + 0.5) * ramp;
}
```

```ts
// lib/plane-builder/levels/generate.ts
import { createRng } from "./rng";
import { terrainHeight } from "./terrain";
import type { LevelDef, Obstacle, ObstacleKind, Ring, Vec3 } from "./types";

/** Hard obstacles never start before this x. */
export const LAUNCH_CLEARANCE = 100;
/** Content continues this far past the finish. */
export const RUNOUT = 300;

export interface FeatureSpec {
  kind: ObstacleKind;
  hard: boolean;
  /** Average spacing along x, m. */
  every: number;
  half: Vec3;
  /** "anywhere" across the corridor, or hugging the two "edges". */
  lateral: "anywhere" | "edges";
  /** Extra height of the bottom above the ground (floating things). */
  float?: number;
  /** Only between these x (defaults: clearance → finish + runout). */
  fromX?: number;
  toX?: number;
}

export interface LevelSpec extends Omit<
  LevelDef,
  "obstacles" | "coins" | "rings"
> {
  seed: number;
  features: FeatureSpec[];
  /** A 5-coin trail every this many metres. */
  coinEvery: number;
  ringEvery: number;
}

function place(
  spec: LevelSpec,
  feature: FeatureSpec,
  rng: () => number
): Obstacle[] {
  const out: Obstacle[] = [];
  const start = Math.max(
    feature.fromX ?? 0,
    feature.hard ? LAUNCH_CLEARANCE + feature.half.x : spec.terrain.flatUntil
  );
  const end = feature.toX ?? spec.finishDistance + RUNOUT;
  const width = spec.corridorHalfWidth;
  for (
    let x = start + rng() * feature.every;
    x < end;
    x += feature.every * (0.6 + rng() * 0.8)
  ) {
    const zs =
      feature.lateral === "edges"
        ? [width * (0.85 + rng() * 0.3), -width * (0.85 + rng() * 0.3)]
        : [(rng() * 2 - 1) * width * 0.9];
    for (const z of zs) {
      const ground = Math.max(
        terrainHeight(spec.terrain, x - feature.half.x, z),
        terrainHeight(spec.terrain, x, z),
        terrainHeight(spec.terrain, x + feature.half.x, z)
      );
      out.push({
        kind: feature.kind,
        hard: feature.hard,
        half: feature.half,
        center: { x, y: ground + (feature.float ?? 0) + feature.half.y, z },
      });
    }
  }
  return out;
}

export function buildLevel(spec: LevelSpec): LevelDef {
  const rng = createRng(spec.seed);
  const obstacles = spec.features.flatMap((f) => place(spec, f, rng));
  const end = spec.finishDistance + RUNOUT;
  const coins: Vec3[] = [];
  for (let x = 120; x < end; x += spec.coinEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.7;
    const y = terrainHeight(spec.terrain, x, z) + 6 + rng() * 30;
    for (let i = 0; i < 5; i += 1) coins.push({ x: x + i * 6, y, z });
  }
  const rings: Ring[] = [];
  for (let x = 200; x < end; x += spec.ringEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.6;
    const y = terrainHeight(spec.terrain, x, z) + 15 + rng() * 25;
    rings.push({ center: { x, y, z }, radius: 6 });
  }
  const { seed, features, coinEvery, ringEvery, ...def } = spec;
  void seed;
  void features;
  void coinEvery;
  void ringEvery;
  return { ...def, obstacles, coins, rings };
}
```

- [ ] **Step 4: The three levels.** These are starting numbers that Task 7
      tunes. Meadow is shown in full. Canyon and Mountains follow the same
      shape with the values listed under it.

```ts
// lib/plane-builder/levels/meadow.ts
import { makeCatalog } from "../plane/catalog";
import { buildLevel, type LevelSpec } from "./generate";

export const MEADOW_SPEC: LevelSpec = {
  id: "meadow",
  name: "Backyard Meadow",
  blurb: "Rolling hills, trees and a big red barn.",
  seed: 1101,
  finishDistance: 2000,
  corridorHalfWidth: 60,
  payPerMeter: 0.5,
  minPayout: 20,
  terrain: { seed: 11, amplitude: 18, wavelength: 140, flatUntil: 80 },
  coinEvery: 70,
  ringEvery: 220,
  winds: [],
  features: [
    {
      kind: "tree",
      hard: false,
      every: 35,
      half: { x: 2, y: 5, z: 2 },
      lateral: "anywhere",
    },
    {
      kind: "balloon",
      hard: false,
      every: 160,
      half: { x: 2.5, y: 3, z: 2.5 },
      lateral: "anywhere",
      float: 25,
    },
    {
      kind: "barn",
      hard: true,
      every: 350,
      half: { x: 8, y: 6, z: 10 },
      lateral: "anywhere",
    },
  ],
  plane: makeCatalog({
    launcher: { basePrice: 15, from: 14, to: 40 },
    wings: { basePrice: 20, from: 0.03, to: 0.14 },
    engine: { basePrice: 30, from: 0, to: 9 },
    fuel: { basePrice: 25, from: 2, to: 30 },
    body: { basePrice: 20, from: 0.012, to: 0.004 },
    multiplier: { basePrice: 40, from: 1, to: 2.5 },
    parts: {
      launcher: ["Twig slingshot", "Rubber-band slingshot", "Wooden catapult"],
      wings: ["Paper wings", "Folded wings", "Balsa wings", "Glider wings"],
      engine: ["No engine", "Rubber-band motor", "Tiny propeller"],
      fuel: ["Thimble tank", "Cup tank", "Bottle tank"],
      body: ["Paper body", "Card body", "Balsa body"],
      multiplier: ["Coin pouch", "Coin jar", "Coin bucket"],
    },
  }),
  palette: {
    sky: "#7ec8f2",
    horizon: "#d8f0ff",
    ground: "#6bbf59",
    hill: "#4f9d43",
    hard: "#b5342b",
    soft: "#2f7a32",
    plane: "#f4f1e8",
    trim: "#e0b84a",
  },
};

export const MEADOW = buildLevel(MEADOW_SPEC);
```

`canyon.ts` exports `CANYON_SPEC` and `CANYON` in the same shape:

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| id / name         | `"canyon"` / `"Desert Canyon"`                                |
| blurb             | `"Red rock walls, arches and warm updrafts."`                 |
| seed              | 2202                                                          |
| finishDistance    | 4000                                                          |
| corridorHalfWidth | 45                                                            |
| payPerMeter       | 0.6                                                           |
| minPayout         | 60                                                            |
| terrain           | `{ seed: 22, amplitude: 10, wavelength: 200, flatUntil: 80 }` |
| coinEvery         | 80                                                            |
| ringEvery         | 260                                                           |

- **Winds:** four updrafts, `{ fromX: 800 * k, toX: 800 * k + 120, lift: 6, push: 0 }` for k = 1 to 4.
- **Features:**
  - `wall`: hard, every 30, half `{x: 15, y: 45, z: 6}`, `lateral: "edges"`
  - `arch`: hard, every 450, half `{x: 6, y: 20, z: 8}`, anywhere
  - `bird`: soft, every 90, half `{x: 1.5, y: 1, z: 1.5}`, anywhere, float 30
- **Catalog:** every `basePrice` × 3. Launcher 20→55, wings 0.03→0.16,
  engine 0→14, fuel 3→40, body 0.012→0.0035, multiplier 1→3.
- **Parts:**
  - launcher: Steel slingshot, Spring launcher, Air cannon
  - wings: Short wing, Long wing, Biplane wings, Twin-boom wings
  - engine: No engine, Small propeller, Big propeller, Twin propellers
  - fuel: Jerry can, Wing tanks, Belly tank
  - body: Canvas body, Wood body, Metal body
  - multiplier: Coin bag, Coin chest, Coin safe
- **Palette:** sky `#f2b46b`, horizon `#fde3c0`, ground `#d98b4e`,
  hill `#b8632f`, hard `#9c4a2a`, soft `#5b4636`, plane `#3b82c4`,
  trim `#f5d76e`.

`mountains.ts` exports `MOUNTAINS_SPEC` and `MOUNTAINS`:

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| id / name         | `"mountains"` / `"Snowy Mountains"`                           |
| blurb             | `"Huge peaks, crosswinds and a narrow pass."`                 |
| seed              | 3303                                                          |
| finishDistance    | 6000                                                          |
| corridorHalfWidth | 70                                                            |
| payPerMeter       | 0.7                                                           |
| minPayout         | 150                                                           |
| terrain           | `{ seed: 33, amplitude: 40, wavelength: 260, flatUntil: 80 }` |
| coinEvery         | 90                                                            |
| ringEvery         | 300                                                           |

- **Winds:** crosswinds `{ fromX: 1000 * k, toX: 1000 * k + 200, lift: 0, push: k % 2 ? 5 : -5 }` for k = 1 to 5.
- **Features:**
  - `peak`: hard, every 260, half `{x: 25, y: 60, z: 25}`, anywhere,
    `toX: 5500`
  - `wall`: hard, every 20, half `{x: 12, y: 80, z: 8}`, edges,
    `fromX: 5500, toX: 6300` (the pass)
  - `bird`: soft, every 120, half `{x: 1.5, y: 1, z: 1.5}`, anywhere,
    float 50
- **Catalog:** every `basePrice` × 8. Launcher 25→70, wings 0.03→0.18,
  engine 0→20, fuel 4→50, body 0.012→0.003, multiplier 1→3.5.
- **Parts:**
  - launcher: Steam catapult, Rail launcher, Rocket sled
  - wings: Trainer wings, Straight wings, Swept wings, Delta wings
  - engine: No engine, Small jet, Twin jets, Afterburners
  - fuel: Small tank, Drop tanks, Big drop tanks
  - body: Trainer body, Sleek body, Stealth body
  - multiplier: Coin crate, Coin vault, Golden vault
- **Palette:** sky `#9cc9ee`, horizon `#eef6ff`, ground `#f4f7fb`,
  hill `#cfd9e6`, hard `#6d7889`, soft `#3a4656`, plane `#d9dee6`,
  trim `#e2483d`.

```ts
// lib/plane-builder/levels/index.ts
import { CANYON } from "./canyon";
import { MEADOW } from "./meadow";
import { MOUNTAINS } from "./mountains";
import type { LevelDef, LevelId } from "./types";

export const LEVEL_ORDER: readonly LevelId[] = [
  "meadow",
  "canyon",
  "mountains",
];

export const LEVELS: Record<LevelId, LevelDef> = {
  meadow: MEADOW,
  canyon: CANYON,
  mountains: MOUNTAINS,
};

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVEL_ORDER.indexOf(id);
  return LEVEL_ORDER[i + 1] ?? null;
}
```

- [ ] **Step 5: Run the tests.** They should pass.
- [ ] **Step 6: Commit:** `feat(plane-builder): seeded levels and terrain`

---

### Task 4: Flight sim

**Goal:** A fixed-step flight model that gives the same result every run. It
handles launch, lift and stall, drag, fuel and boost, steering with
auto-level, the corridor wind, wind zones, coins and rings, soft and hard
hits, shields, landing vs crash, the finish, the stall stop and the runout.

**Files:**

- Create:
  - `lib/plane-builder/sim/constants.ts`
  - `lib/plane-builder/sim/flight.ts`
  - `lib/plane-builder/sim/README.md`
  - `lib/plane-builder/sim/__tests__/flight.test.ts`
  - `lib/plane-builder/sim/__tests__/fixtures.ts`

**Acceptance criteria:**

- [ ] The same inputs give identical states. No `Math.random` and no
      `Date.now`.
- [ ] A plane with no engine and weak wings lands well short of the finish,
      and stronger wings glide further.
- [ ] An engine with fuel flies further than the same plane with no fuel.
      Boost burns fuel 3× faster.
- [ ] Hitting a hard obstacle with no shields crashes. With a shield, it spends
      the shield and the flight carries on.
- [ ] A soft obstacle costs speed once, and never ends the flight.
- [ ] A shallow touch-down slides to a stop and lands. A steep one crashes.
- [ ] Flying past `|z| > halfWidth` turns the heading back toward the middle.
- [ ] `finish` fires once when `maxX` crosses `finishDistance`. The flight
      ends at `finishDistance + RUNOUT`.
- [ ] The flight ends as `stalled` when there's no forward progress for 3 s.

**Verify:** `npm test -- --testPathPatterns=plane-builder/sim`

**Steps:**

- [ ] **Step 1: Constants**

```ts
// lib/plane-builder/sim/constants.ts
export const STEP = 1 / 60;
export const G = 9.81;
/** Steepest climb or dive the pilot can command, rad (35°). */
export const MAX_PITCH = 0.61;
/** Hard limits on the flight-path angle, rad. */
export const MIN_PITCH = -1.2;
/** How hard the elevator chases the target angle, 1/s. */
export const PITCH_GAIN = 1.6;
/** Max lift = lift × v² × this (elevator authority). */
export const LIFT_HEADROOM = 1.5;
export const MAX_BANK = 0.8;
export const BANK_RATE = 2;
/** Heading change per second at full bank, rad/s. */
export const TURN_RATE = 0.9;
/** Never point more than this far off straight ahead, rad. */
export const MAX_HEADING = 1.2;
/** Seconds after launch that hands-off flight holds the launch angle. */
export const LAUNCH_HOLD = 1.2;
export const LAUNCH_HEIGHT = 3;
/** Aim limits for the slingshot, rad. */
export const MAX_AIM_PITCH = 0.7;
export const MAX_AIM_YAW = 0.5;
export const MIN_SPEED = 2;
export const MAX_SPEED = 120;
export const BOOST_THRUST = 2;
export const BOOST_BURN = 3;
export const PLANE_RADIUS = 1;
export const COIN_RADIUS = 2.5;
export const RING_COINS = 10;
/** Soft hits multiply speed by this. */
export const SOFT_SLOW = 0.85;
/** Shield hits multiply speed by this. */
export const SHIELD_SLOW = 0.6;
/** Seconds of no hard hits after a shield is spent. */
export const SHIELD_GRACE = 1;
/** Touch-downs shallower than this angle and slower than LAND_SPEED land. */
export const LAND_ANGLE = -0.35;
export const LAND_SPEED = 45;
export const SLIDE_DECEL = 10;
/** Heading correction past the corridor edge, rad/s at one half-width over. */
export const CORRIDOR_TURN = 1.5;
/** Sideways push back past the edge, m/s per metre over. */
export const CORRIDOR_PUSH = 0.5;
export const STALL_WINDOW = 3;
export const STALL_PROGRESS = 1;
export const MAX_FLIGHT_TIME = 600;
```

- [ ] **Step 2: Test fixtures.** A tiny flat level with nothing in it. Tests
      add obstacles to it.

```ts
// lib/plane-builder/sim/__tests__/fixtures.ts
import { makeCatalog } from "../../plane/catalog";
import type { PlaneStats } from "../../plane/stats";
import type { LevelDef } from "../../levels/types";

export function flatLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: "meadow",
    name: "Test",
    blurb: "",
    finishDistance: 2000,
    corridorHalfWidth: 50,
    payPerMeter: 1,
    minPayout: 0,
    terrain: { seed: 1, amplitude: 0, wavelength: 100, flatUntil: 0 },
    obstacles: [],
    coins: [],
    rings: [],
    winds: [],
    plane: makeCatalog({
      launcher: { basePrice: 1, from: 1, to: 1 },
      wings: { basePrice: 1, from: 1, to: 1 },
      engine: { basePrice: 1, from: 1, to: 1 },
      fuel: { basePrice: 1, from: 1, to: 1 },
      body: { basePrice: 1, from: 1, to: 1 },
      multiplier: { basePrice: 1, from: 1, to: 1 },
      parts: {
        launcher: ["a"],
        wings: ["a"],
        engine: ["a"],
        fuel: ["a"],
        body: ["a"],
        multiplier: ["a"],
      },
    }),
    palette: {
      sky: "#000",
      horizon: "#000",
      ground: "#000",
      hill: "#000",
      hard: "#000",
      soft: "#000",
      plane: "#000",
      trim: "#000",
    },
    ...overrides,
  };
}

export const GLIDER: PlaneStats = {
  launchSpeed: 20,
  lift: 0.06,
  thrust: 0,
  fuel: 0,
  drag: 0.008,
  shields: 0,
  multiplier: 1,
};

export const POWERED: PlaneStats = {
  ...GLIDER,
  thrust: 8,
  fuel: 20,
  lift: 0.1,
};
```

- [ ] **Step 3: Write the failing tests.**

```ts
// lib/plane-builder/sim/__tests__/flight.test.ts
import { RUNOUT } from "../../levels/generate";
import { CORRIDOR_TURN } from "../constants";
import {
  launch,
  runFlight,
  step,
  type FlightEvent,
  type StickInput,
} from "../flight";
import { GLIDER, POWERED, flatLevel } from "./fixtures";

const AIM = { pitch: 0.3, yaw: 0, power: 1 };
const HANDS_OFF: StickInput = { pitch: 0, bank: 0, boost: false };
const handsOff = () => HANDS_OFF;

describe("flight sim", () => {
  it("is deterministic", () => {
    const level = flatLevel();
    const a = runFlight(level, POWERED, AIM, handsOff);
    const b = runFlight(level, POWERED, AIM, handsOff);
    expect(a.state).toEqual(b.state);
  });

  it("glides a short way and lands", () => {
    const { state } = runFlight(flatLevel(), GLIDER, AIM, handsOff);
    expect(state.endReason).toBe("landed");
    expect(state.maxX).toBeGreaterThan(30);
    expect(state.maxX).toBeLessThan(1000);
  });

  it("glides further with better wings", () => {
    const weak = runFlight(flatLevel(), GLIDER, AIM, handsOff).state.maxX;
    const strong = runFlight(
      flatLevel(),
      { ...GLIDER, lift: 0.12 },
      AIM,
      handsOff
    ).state.maxX;
    expect(strong).toBeGreaterThan(weak);
  });

  it("flies further with fuel, and boost burns it 3x faster", () => {
    const level = flatLevel();
    const dry = runFlight(level, { ...POWERED, fuel: 0 }, AIM, handsOff);
    const wet = runFlight(level, POWERED, AIM, handsOff);
    expect(wet.state.maxX).toBeGreaterThan(dry.state.maxX);

    const s = launch(level, POWERED, AIM);
    for (let i = 0; i < 60; i += 1)
      step(s, level, POWERED, { ...HANDS_OFF, boost: true });
    expect(s.fuel).toBeCloseTo(POWERED.fuel - 3, 1);
  });

  it("crashes into a hard obstacle without shields", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "barn",
          hard: true,
          center: { x: 40, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { state, events } = runFlight(level, POWERED, AIM, handsOff);
    expect(state.endReason).toBe("crash");
    expect(events.some((e) => e.type === "crash")).toBe(true);
  });

  it("spends a shield on a hard hit and keeps flying", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "barn",
          hard: true,
          center: { x: 40, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { state, events } = runFlight(
      level,
      { ...POWERED, shields: 1 },
      AIM,
      handsOff
    );
    expect(events.filter((e) => e.type === "shield")).toHaveLength(1);
    expect(state.shields).toBe(0);
    expect(state.maxX).toBeGreaterThan(50);
  });

  it("slows once on a soft obstacle", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "tree",
          hard: false,
          center: { x: 30, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { events } = runFlight(level, POWERED, AIM, handsOff);
    expect(events.filter((e) => e.type === "bump")).toHaveLength(1);
    expect(events.some((e) => e.type === "crash")).toBe(false);
  });

  it("crashes on a steep dive into the ground", () => {
    const level = flatLevel();
    const dive: StickInput = { pitch: -1, bank: 0, boost: true };
    const { state } = runFlight(
      level,
      { ...POWERED, thrust: 20 },
      { pitch: 0.6, yaw: 0, power: 1 },
      (s) => (s.time > 2 ? dive : HANDS_OFF)
    );
    expect(state.endReason).toBe("crash");
  });

  it("collects coins and rings", () => {
    const level = flatLevel({
      coins: [{ x: 10, y: 5.5, z: 0 }],
      rings: [{ center: { x: 20, y: 7, z: 0 }, radius: 6 }],
    });
    const { state, events } = runFlight(level, POWERED, AIM, handsOff);
    expect(events.some((e) => e.type === "coin")).toBe(true);
    expect(events.some((e) => e.type === "ring")).toBe(true);
    expect(state.coins).toBe(11);
  });

  it("turns back toward the corridor past the edge", () => {
    const level = flatLevel();
    const s = launch(level, POWERED, AIM);
    s.z = level.corridorHalfWidth * 2;
    s.heading = 0;
    step(s, level, POWERED, HANDS_OFF);
    expect(s.heading).toBeLessThan(0);
    expect(-s.heading).toBeLessThanOrEqual(CORRIDOR_TURN / 60 + 1e-9);
  });

  it("fires finish once and ends at the runout", () => {
    const level = flatLevel({ finishDistance: 200 });
    const { state, events } = runFlight(
      level,
      { ...POWERED, fuel: 120 },
      AIM,
      () => ({ pitch: 0.2, bank: 0, boost: false })
    );
    expect(events.filter((e) => e.type === "finish")).toHaveLength(1);
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe("runout");
    expect(state.maxX).toBeGreaterThanOrEqual(200 + RUNOUT);
  });

  it("ends as stalled with no forward progress", () => {
    const level = flatLevel();
    const s = launch(level, POWERED, AIM);
    const events: FlightEvent[] = [];
    // Pin the plane in place to simulate circling.
    for (let i = 0; i < 60 * 4 && s.phase !== "done"; i += 1) {
      s.x = 10;
      events.push(...step(s, level, POWERED, HANDS_OFF));
    }
    expect(s.endReason).toBe("stalled");
  });
});
```

- [ ] **Step 4: Run them.** They should fail because the module isn't found.

- [ ] **Step 5: Implement.**

```ts
// lib/plane-builder/sim/flight.ts
import { RUNOUT } from "../levels/generate";
import { terrainHeight } from "../levels/terrain";
import type { LevelDef, ObstacleKind } from "../levels/types";
import type { PlaneStats } from "../plane/stats";
import {
  BANK_RATE,
  BOOST_BURN,
  BOOST_THRUST,
  COIN_RADIUS,
  CORRIDOR_PUSH,
  CORRIDOR_TURN,
  G,
  LAND_ANGLE,
  LAND_SPEED,
  LAUNCH_HEIGHT,
  LAUNCH_HOLD,
  LIFT_HEADROOM,
  MAX_AIM_PITCH,
  MAX_AIM_YAW,
  MAX_BANK,
  MAX_FLIGHT_TIME,
  MAX_HEADING,
  MAX_PITCH,
  MAX_SPEED,
  MIN_PITCH,
  MIN_SPEED,
  PITCH_GAIN,
  PLANE_RADIUS,
  RING_COINS,
  SHIELD_GRACE,
  SHIELD_SLOW,
  SLIDE_DECEL,
  SOFT_SLOW,
  STALL_PROGRESS,
  STALL_WINDOW,
  STEP,
  TURN_RATE,
} from "./constants";

export interface LaunchAim {
  /** Up from level, rad, clamped to 0..MAX_AIM_PITCH. */
  pitch: number;
  /** Sideways, rad, clamped to ±MAX_AIM_YAW. */
  yaw: number;
  /** How far the band was pulled, 0..1. */
  power: number;
}

export interface StickInput {
  /** -1 (dive) .. 1 (climb); 0 = level out. */
  pitch: number;
  /** -1 (left, -z) .. 1 (right, +z). */
  bank: number;
  boost: boolean;
}

export type EndReason = "landed" | "crash" | "stalled" | "runout" | "timeout";

export type FlightEvent =
  | { type: "coin"; index: number }
  | { type: "ring"; index: number }
  | { type: "bump"; kind: ObstacleKind }
  | { type: "shield" }
  | { type: "crash" }
  | { type: "landed" }
  | { type: "finish" }
  | { type: "stalled" };

/** Mutable flight state. `step` updates it in place (60 steps a second). */
export interface FlightState {
  time: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  pitch: number;
  heading: number;
  bank: number;
  fuel: number;
  shields: number;
  coins: number;
  rings: number;
  maxX: number;
  launchPitch: number;
  phase: "flying" | "sliding" | "done";
  finished: boolean;
  endReason: EndReason | null;
  grace: number;
  progressMark: number;
  progressTimer: number;
  coinTaken: Uint8Array;
  ringTaken: Uint8Array;
  softHit: Uint8Array;
}

export interface FlightResult {
  /** Progress toward the finish, m, capped at the finish. */
  distance: number;
  coins: number;
  rings: number;
  finished: boolean;
  endReason: EndReason;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function launch(
  level: LevelDef,
  stats: PlaneStats,
  aim: LaunchAim
): FlightState {
  const pitch = clamp(aim.pitch, 0, MAX_AIM_PITCH);
  return {
    time: 0,
    x: 0,
    y: LAUNCH_HEIGHT,
    z: 0,
    speed: Math.max(MIN_SPEED, stats.launchSpeed * clamp(aim.power, 0, 1)),
    pitch,
    heading: clamp(aim.yaw, -MAX_AIM_YAW, MAX_AIM_YAW),
    bank: 0,
    fuel: stats.fuel,
    shields: stats.shields,
    coins: 0,
    rings: 0,
    maxX: 0,
    launchPitch: pitch,
    phase: "flying",
    finished: false,
    endReason: null,
    grace: 0,
    progressMark: 0,
    progressTimer: 0,
    coinTaken: new Uint8Array(level.coins.length),
    ringTaken: new Uint8Array(level.rings.length),
    softHit: new Uint8Array(level.obstacles.length),
  };
}

function end(s: FlightState, reason: EndReason, events: FlightEvent[]) {
  s.phase = "done";
  s.endReason = reason;
  if (reason === "crash") events.push({ type: "crash" });
  if (reason === "landed") events.push({ type: "landed" });
  if (reason === "stalled") events.push({ type: "stalled" });
}

/** Spends a shield (bounce on) or crashes. */
function hardHit(s: FlightState, events: FlightEvent[], ground: number) {
  if (s.grace > 0) return;
  if (s.shields > 0) {
    s.shields -= 1;
    s.grace = SHIELD_GRACE;
    s.speed *= SHIELD_SLOW;
    s.pitch = 0.25;
    s.heading *= -0.5;
    s.y = Math.max(s.y, ground + 2);
    events.push({ type: "shield" });
  } else {
    end(s, "crash", events);
  }
}

function move(s: FlightState, dt: number) {
  const flat = s.speed * Math.cos(s.pitch);
  s.x += flat * Math.cos(s.heading) * dt;
  s.z += flat * Math.sin(s.heading) * dt;
  s.y += s.speed * Math.sin(s.pitch) * dt;
}

function trackProgress(s: FlightState, level: LevelDef, events: FlightEvent[]) {
  if (s.x > s.maxX) s.maxX = s.x;
  if (!s.finished && s.maxX >= level.finishDistance) {
    s.finished = true;
    events.push({ type: "finish" });
  }
  if (s.maxX >= level.finishDistance + RUNOUT) {
    end(s, "runout", events);
    return;
  }
  if (s.maxX - s.progressMark >= STALL_PROGRESS) {
    s.progressMark = s.maxX;
    s.progressTimer = 0;
  } else {
    s.progressTimer += STEP;
    if (s.progressTimer > STALL_WINDOW) end(s, "stalled", events);
  }
  if (s.phase !== "done" && s.time > MAX_FLIGHT_TIME) end(s, "timeout", events);
}

/** Advances one STEP. Mutates `s`; returns what happened. */
export function step(
  s: FlightState,
  level: LevelDef,
  stats: PlaneStats,
  input: StickInput
): FlightEvent[] {
  const events: FlightEvent[] = [];
  if (s.phase === "done") return events;
  const dt = STEP;
  s.time += dt;
  s.grace = Math.max(0, s.grace - dt);

  if (s.phase === "sliding") {
    s.speed = Math.max(0, s.speed - SLIDE_DECEL * dt);
    s.pitch = 0;
    move(s, dt);
    s.y = terrainHeight(level.terrain, s.x, s.z);
    trackProgress(s, level, events);
    if (s.phase !== "done" && s.speed < 0.5) end(s, "landed", events);
    return events;
  }

  // Steering: bank eases to the stick, banking turns the heading.
  const bankTarget = clamp(input.bank, -1, 1) * MAX_BANK;
  s.bank += clamp(bankTarget - s.bank, -BANK_RATE * dt, BANK_RATE * dt);
  s.heading += TURN_RATE * Math.sin(s.bank) * dt;

  // Corridor: past the edge, the crosswind turns and pushes you back.
  const over = Math.abs(s.z) - level.corridorHalfWidth;
  if (over > 0) {
    const side = Math.sign(s.z);
    s.heading -=
      side * CORRIDOR_TURN * Math.min(1, over / level.corridorHalfWidth) * dt;
    s.z -= side * over * CORRIDOR_PUSH * dt;
  }
  s.heading = clamp(s.heading, -MAX_HEADING, MAX_HEADING);

  // Pitch: the elevator asks for lift to chase the target angle, but can't
  // make more than the wings give at this speed, so slow planes sink.
  const hold = input.pitch === 0 && s.time < LAUNCH_HOLD;
  const target = hold ? s.launchPitch : clamp(input.pitch, -1, 1) * MAX_PITCH;
  const v = Math.max(s.speed, 1);
  const weight = G * Math.cos(s.pitch);
  const wanted = weight + v * PITCH_GAIN * (target - s.pitch);
  const lift = clamp(wanted, 0, stats.lift * v * v * LIFT_HEADROOM);
  s.pitch = clamp(s.pitch + ((lift - weight) / v) * dt, MIN_PITCH, MAX_PITCH);

  // Speed: drag, gravity along the path, and thrust while there's fuel.
  let accel = -stats.drag * s.speed * s.speed - G * Math.sin(s.pitch);
  if (s.fuel > 0 && stats.thrust > 0) {
    accel += stats.thrust * (input.boost ? BOOST_THRUST : 1);
    s.fuel = Math.max(0, s.fuel - dt * (input.boost ? BOOST_BURN : 1));
  }
  s.speed = clamp(s.speed + accel * dt, MIN_SPEED, MAX_SPEED);

  const prevX = s.x;
  move(s, dt);
  for (const w of level.winds) {
    if (s.x >= w.fromX && s.x < w.toX) {
      s.y += w.lift * dt;
      s.z += w.push * dt;
    }
  }

  // Pickups.
  level.coins.forEach((c, i) => {
    if (s.coinTaken[i]) return;
    const dx = c.x - s.x;
    if (Math.abs(dx) > COIN_RADIUS) return;
    const dy = c.y - s.y;
    const dz = c.z - s.z;
    if (dx * dx + dy * dy + dz * dz < COIN_RADIUS * COIN_RADIUS) {
      s.coinTaken[i] = 1;
      s.coins += 1;
      events.push({ type: "coin", index: i });
    }
  });
  level.rings.forEach((r, i) => {
    if (s.ringTaken[i] || prevX >= r.center.x || s.x < r.center.x) return;
    const dy = s.y - r.center.y;
    const dz = s.z - r.center.z;
    if (dy * dy + dz * dz < r.radius * r.radius) {
      s.ringTaken[i] = 1;
      s.rings += 1;
      s.coins += RING_COINS;
      events.push({ type: "ring", index: i });
    }
  });

  // Obstacles.
  const ground = terrainHeight(level.terrain, s.x, s.z);
  for (let i = 0; i < level.obstacles.length && s.phase !== "done"; i += 1) {
    const o = level.obstacles[i];
    if (Math.abs(s.x - o.center.x) > o.half.x + PLANE_RADIUS) continue;
    if (Math.abs(s.z - o.center.z) > o.half.z + PLANE_RADIUS) continue;
    if (Math.abs(s.y - o.center.y) > o.half.y + PLANE_RADIUS) continue;
    if (o.hard) {
      hardHit(s, events, ground);
    } else if (!s.softHit[i]) {
      s.softHit[i] = 1;
      s.speed = Math.max(MIN_SPEED, s.speed * SOFT_SLOW);
      events.push({ type: "bump", kind: o.kind });
    }
  }
  if (s.phase === "done") return events;

  // Ground.
  if (s.y <= ground) {
    if (s.pitch >= LAND_ANGLE && s.speed <= LAND_SPEED) {
      s.phase = "sliding";
      s.y = ground;
      s.pitch = 0;
      s.bank = 0;
    } else {
      hardHit(s, events, ground);
      if (s.phase === "done") return events;
    }
  }

  trackProgress(s, level, events);
  return events;
}

export function flightResult(s: FlightState, level: LevelDef): FlightResult {
  return {
    distance: Math.max(0, Math.min(s.maxX, level.finishDistance)),
    coins: s.coins,
    rings: s.rings,
    finished: s.finished,
    endReason: s.endReason ?? "timeout",
  };
}

/** Runs a whole flight (for tests and the balance pilot). */
export function runFlight(
  level: LevelDef,
  stats: PlaneStats,
  aim: LaunchAim,
  pilot: (s: FlightState) => StickInput
): { state: FlightState; events: FlightEvent[] } {
  const state = launch(level, stats, aim);
  const events: FlightEvent[] = [];
  while (state.phase !== "done") {
    events.push(...step(state, level, stats, pilot(state)));
  }
  return { state, events };
}
```

- [ ] **Step 6: Run the tests.** Tune constants **only** in `constants.ts`
      until they all pass. The test numbers are behavioural (further, shorter,
      lands, crashes), so tuning shouldn't need test edits. If a fixture
      number genuinely can't produce the behaviour, adjust the fixture (for
      example, raise `POWERED.thrust`) and say so in the commit message.
- [ ] **Step 7: Write the README.** `lib/plane-builder/sim/README.md` covers,
      in about 40 lines:
  - the coordinates
  - the fixed step
  - the lift model (lift is capped at `lift × v² × LIFT_HEADROOM`, so a slow
    plane sinks)
  - the energy trade (climbing costs speed)
  - the corridor wind
  - landing vs crash
  - shields and grace
  - the stall stop and the runout
  - that `step` mutates its state, and that the scene only reads it
- [ ] **Step 8: Commit:** `feat(plane-builder): deterministic flight sim`

---

### Task 5: Economy and progress rules

**Goal:** The pure functions for the payout, buying, recording a flight,
unlocking the next level, and restarting a level.

**Files:**

- Create:
  - `lib/plane-builder/economy/payout.ts`
  - `lib/plane-builder/economy/progress.ts`
  - `lib/plane-builder/economy/__tests__/economy.test.ts`

**Acceptance criteria:**

- [ ] The payout is `max(minPayout, round((distance × payPerMeter + coins) × multiplier))`.
- [ ] `buyUpgrade` fails with `"locked"`, `"maxed"` or `"too-poor"`. On
      success it raises the tier by one and subtracts the price.
- [ ] `recordFlight` adds the payout and updates the best distance (returning
      `isNewBest`). When a flight finishes, it marks the level finished and
      unlocks the next level once (returning `unlocked`).
- [ ] `restartLevel` resets only that level's tiers, coins, best and finished
      flag, and keeps the unlocks.
- [ ] Every function is pure and returns new objects.

**Verify:** `npm test -- --testPathPatterns=plane-builder/economy`

**Steps:**

- [ ] **Step 1: Write the failing tests.**

```ts
// lib/plane-builder/economy/__tests__/economy.test.ts
import { LEVELS } from "../../levels";
import { tierPrice } from "../../plane/catalog";
import type { FlightResult } from "../../sim/flight";
import { payout } from "../payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  restartLevel,
} from "../progress";

const meadow = LEVELS.meadow;
const flight = (over: Partial<FlightResult> = {}): FlightResult => ({
  distance: 100,
  coins: 5,
  rings: 0,
  finished: false,
  endReason: "landed",
  ...over,
});

describe("payout", () => {
  it("pays distance plus coins, times the multiplier", () => {
    const p = payout(meadow, flight({ distance: 1000, coins: 20 }), 2);
    expect(p.total).toBe(Math.round((1000 * meadow.payPerMeter + 20) * 2));
  });
  it("never pays less than the level minimum", () => {
    expect(payout(meadow, flight({ distance: 0, coins: 0 }), 1).total).toBe(
      meadow.minPayout
    );
  });
});

describe("progress", () => {
  it("starts with only the meadow unlocked and nothing owned", () => {
    const p = newProgress();
    expect(p.unlocked).toEqual(["meadow"]);
    expect(p.levels.meadow.coins).toBe(0);
  });

  it("buys a tier when you can afford it", () => {
    const price = tierPrice(meadow.plane.wings, 0)!;
    let p = newProgress();
    p = {
      ...p,
      levels: { ...p.levels, meadow: { ...p.levels.meadow, coins: price + 3 } },
    };
    const r = buyUpgrade(p, "meadow", "wings");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress.levels.meadow.tiers.wings).toBe(1);
    expect(r.progress.levels.meadow.coins).toBe(3);
    expect(p.levels.meadow.tiers.wings).toBe(0);
  });

  it("refuses when too poor, maxed or locked", () => {
    const p = newProgress();
    expect(buyUpgrade(p, "meadow", "wings")).toEqual({
      ok: false,
      reason: "too-poor",
    });
    expect(buyUpgrade(p, "canyon", "wings")).toEqual({
      ok: false,
      reason: "locked",
    });
    const maxed = {
      ...p,
      levels: {
        ...p.levels,
        meadow: {
          ...p.levels.meadow,
          coins: 1e9,
          tiers: { ...p.levels.meadow.tiers, wings: 8 },
        },
      },
    };
    expect(buyUpgrade(maxed, "meadow", "wings")).toEqual({
      ok: false,
      reason: "maxed",
    });
  });

  it("records pay and a new best", () => {
    const r = recordFlight(newProgress(), "meadow", flight(), 50);
    expect(r.progress.levels.meadow.coins).toBe(50);
    expect(r.progress.levels.meadow.best).toBe(100);
    expect(r.isNewBest).toBe(true);
    const again = recordFlight(
      r.progress,
      "meadow",
      flight({ distance: 80 }),
      10
    );
    expect(again.isNewBest).toBe(false);
    expect(again.progress.levels.meadow.best).toBe(100);
  });

  it("unlocks the next level once on finishing", () => {
    const r = recordFlight(
      newProgress(),
      "meadow",
      flight({ distance: 2000, finished: true }),
      1
    );
    expect(r.unlocked).toBe("canyon");
    expect(r.progress.unlocked).toEqual(["meadow", "canyon"]);
    expect(r.progress.levels.meadow.finished).toBe(true);
    const again = recordFlight(
      r.progress,
      "meadow",
      flight({ finished: true }),
      1
    );
    expect(again.unlocked).toBeNull();
  });

  it("restarts one level and keeps unlocks", () => {
    let p = recordFlight(
      newProgress(),
      "meadow",
      flight({ distance: 2000, finished: true }),
      500
    ).progress;
    p = recordFlight(p, "canyon", flight(), 70).progress;
    const r = restartLevel(p, "meadow");
    expect(r.levels.meadow).toEqual(newProgress().levels.meadow);
    expect(r.levels.canyon.coins).toBe(70);
    expect(r.unlocked).toEqual(["meadow", "canyon"]);
  });
});
```

(Run `npx prettier --write` on the test file after pasting.)

- [ ] **Step 2: Run them.** They should fail because the module isn't found.

- [ ] **Step 3: Implement.**

```ts
// lib/plane-builder/economy/payout.ts
import type { LevelDef } from "../levels/types";
import type { FlightResult } from "../sim/flight";

export interface Payout {
  distancePay: number;
  coinPay: number;
  multiplier: number;
  total: number;
}

export function payout(
  level: LevelDef,
  result: FlightResult,
  multiplier: number
): Payout {
  const distancePay = Math.round(result.distance * level.payPerMeter);
  const coinPay = result.coins;
  const total = Math.max(
    level.minPayout,
    Math.round((distancePay + coinPay) * multiplier)
  );
  return { distancePay, coinPay, multiplier, total };
}
```

```ts
// lib/plane-builder/economy/progress.ts
import { LEVELS, LEVEL_ORDER, nextLevelId } from "../levels";
import type { LevelId } from "../levels/types";
import {
  STARTER_TIERS,
  tierPrice,
  type Tiers,
  type TrackId,
} from "../plane/catalog";
import type { FlightResult } from "../sim/flight";

export interface LevelProgress {
  tiers: Tiers;
  coins: number;
  /** Best distance toward the finish, m. */
  best: number;
  finished: boolean;
}

export interface Progress {
  levels: Record<LevelId, LevelProgress>;
  /** In LEVEL_ORDER order; always starts with "meadow". */
  unlocked: LevelId[];
}

export function newLevelProgress(): LevelProgress {
  return { tiers: { ...STARTER_TIERS }, coins: 0, best: 0, finished: false };
}

export function newProgress(): Progress {
  const levels = Object.fromEntries(
    LEVEL_ORDER.map((id) => [id, newLevelProgress()])
  ) as Record<LevelId, LevelProgress>;
  return { levels, unlocked: ["meadow"] };
}

export type BuyResult =
  | { ok: true; progress: Progress; price: number }
  | { ok: false; reason: "locked" | "maxed" | "too-poor" };

function withLevel(p: Progress, id: LevelId, level: LevelProgress): Progress {
  return { ...p, levels: { ...p.levels, [id]: level } };
}

export function buyUpgrade(
  p: Progress,
  id: LevelId,
  track: TrackId
): BuyResult {
  if (!p.unlocked.includes(id)) return { ok: false, reason: "locked" };
  const level = p.levels[id];
  const price = tierPrice(LEVELS[id].plane[track], level.tiers[track]);
  if (price === null) return { ok: false, reason: "maxed" };
  if (level.coins < price) return { ok: false, reason: "too-poor" };
  return {
    ok: true,
    price,
    progress: withLevel(p, id, {
      ...level,
      coins: level.coins - price,
      tiers: { ...level.tiers, [track]: level.tiers[track] + 1 },
    }),
  };
}

export interface RecordedFlight {
  progress: Progress;
  isNewBest: boolean;
  /** The level this flight unlocked, if any. */
  unlocked: LevelId | null;
}

export function recordFlight(
  p: Progress,
  id: LevelId,
  result: FlightResult,
  earned: number
): RecordedFlight {
  const level = p.levels[id];
  const isNewBest = result.distance > level.best;
  let next = withLevel(p, id, {
    ...level,
    coins: level.coins + earned,
    best: Math.max(level.best, result.distance),
    finished: level.finished || result.finished,
  });
  let unlocked: LevelId | null = null;
  const after = nextLevelId(id);
  if (result.finished && after && !next.unlocked.includes(after)) {
    unlocked = after;
    next = {
      ...next,
      unlocked: LEVEL_ORDER.filter(
        (l) => next.unlocked.includes(l) || l === after
      ),
    };
  }
  return { progress: next, isNewBest, unlocked };
}

export function restartLevel(p: Progress, id: LevelId): Progress {
  return withLevel(p, id, newLevelProgress());
}
```

- [ ] **Step 4: Run the tests.** They should pass.
- [ ] **Step 5: Commit:** `feat(plane-builder): payout, upgrades and level progress`

---

### Task 6: Saving

**Goal:** A versioned save that's checked when it loads, with a backup when
it can't be read. One localStorage key.

**Files:**

- Create:
  - `lib/plane-builder/persist/schema.ts`
  - `lib/plane-builder/persist/local.ts`
  - `lib/plane-builder/persist/__tests__/persist.test.ts`

**Acceptance criteria:**

- [ ] `parseSave` accepts a valid `{version: 1, progress}`.
  - It fills in levels that are missing with fresh progress, so new levels
    work with old saves.
  - It rejects anything malformed or from a newer version, returning null:
    non-integer tiers or tiers out of range, negative or non-finite coins, or
    unknown level ids in `unlocked`.
  - `unlocked` is put back in `LEVEL_ORDER` order and always includes
    `meadow`.
- [ ] `loadProgress()`:
  - returns fresh progress when nothing is stored
  - returns the parsed progress when a save is stored
  - when a save can't be parsed, copies the raw text to
    `plane-builder:save:backup:<timestamp>`, returns fresh progress, and
    reports `recovered: true`
- [ ] `saveProgress` returns false instead of throwing when storage throws.

**Verify:** `npm test -- --testPathPatterns=plane-builder/persist`

**Steps:**

- [ ] **Step 1: Write the failing tests.**

```ts
// lib/plane-builder/persist/__tests__/persist.test.ts
import { newProgress } from "../../economy/progress";
import { SAVE_KEY, loadProgress, saveProgress } from "../local";
import { SAVE_VERSION, parseSave } from "../schema";

beforeEach(() => window.localStorage.clear());

describe("parseSave", () => {
  it("round-trips a valid save", () => {
    const progress = newProgress();
    expect(parseSave({ version: SAVE_VERSION, progress })).toEqual(progress);
  });

  it("fills in levels the save doesn't have", () => {
    const progress = newProgress();
    const { mountains, ...rest } = progress.levels;
    void mountains;
    const parsed = parseSave({
      version: 1,
      progress: { ...progress, levels: rest },
    });
    expect(parsed?.levels.mountains).toEqual(newProgress().levels.mountains);
  });

  it.each([
    ["not an object", 42],
    ["newer version", { version: 99, progress: newProgress() }],
    [
      "bad tier",
      (() => {
        const p = newProgress();
        p.levels.meadow.tiers.wings = 9;
        return { version: 1, progress: p };
      })(),
    ],
    [
      "negative coins",
      (() => {
        const p = newProgress();
        p.levels.meadow.coins = -1;
        return { version: 1, progress: p };
      })(),
    ],
    [
      "unknown level",
      {
        version: 1,
        progress: { ...newProgress(), unlocked: ["meadow", "moon"] },
      },
    ],
  ])("rejects %s", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });

  it("orders unlocks and always includes the meadow", () => {
    const p = { ...newProgress(), unlocked: ["canyon"] };
    expect(parseSave({ version: 1, progress: p })?.unlocked).toEqual([
      "meadow",
      "canyon",
    ]);
  });
});

describe("local storage", () => {
  it("starts fresh with nothing stored", () => {
    expect(loadProgress()).toEqual({
      progress: newProgress(),
      recovered: false,
    });
  });

  it("saves and loads", () => {
    const p = newProgress();
    p.levels.meadow.coins = 42;
    expect(saveProgress(p)).toBe(true);
    expect(loadProgress().progress.levels.meadow.coins).toBe(42);
  });

  it("backs up an unreadable save", () => {
    window.localStorage.setItem(SAVE_KEY, "{broken");
    const r = loadProgress();
    expect(r.recovered).toBe(true);
    expect(r.progress).toEqual(newProgress());
    const backups = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(`${SAVE_KEY}:backup:`)
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe("{broken");
  });

  it("reports a failed write instead of throwing", () => {
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    expect(saveProgress(newProgress())).toBe(false);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run them.** They should fail.

- [ ] **Step 3: Implement.**

```ts
// lib/plane-builder/persist/schema.ts
import {
  newLevelProgress,
  type LevelProgress,
  type Progress,
} from "../economy/progress";
import { LEVEL_ORDER } from "../levels";
import type { LevelId } from "../levels/types";
import { MAX_TIER, TRACK_IDS, type Tiers } from "../plane/catalog";

export const SAVE_VERSION = 1;

export interface SaveV1 {
  version: 1;
  progress: Progress;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseTiers(raw: unknown): Tiers | null {
  if (!isRecord(raw)) return null;
  const tiers = {} as Tiers;
  for (const id of TRACK_IDS) {
    const t = raw[id];
    if (!Number.isInteger(t) || (t as number) < 0 || (t as number) > MAX_TIER)
      return null;
    tiers[id] = t as number;
  }
  return tiers;
}

function parseLevel(raw: unknown): LevelProgress | null {
  if (!isRecord(raw)) return null;
  const tiers = parseTiers(raw.tiers);
  if (!tiers || !isCount(raw.coins) || !isCount(raw.best)) return null;
  if (typeof raw.finished !== "boolean") return null;
  return {
    tiers,
    coins: Math.floor(raw.coins),
    best: raw.best,
    finished: raw.finished,
  };
}

function parseProgress(raw: unknown): Progress | null {
  if (!isRecord(raw) || !isRecord(raw.levels) || !Array.isArray(raw.unlocked))
    return null;
  const levels = {} as Record<LevelId, LevelProgress>;
  for (const id of LEVEL_ORDER) {
    if (raw.levels[id] === undefined) {
      levels[id] = newLevelProgress();
      continue;
    }
    const level = parseLevel(raw.levels[id]);
    if (!level) return null;
    levels[id] = level;
  }
  const known = new Set<string>(LEVEL_ORDER);
  if (!raw.unlocked.every((u) => typeof u === "string" && known.has(u)))
    return null;
  const unlocked = LEVEL_ORDER.filter(
    (id) => id === "meadow" || (raw.unlocked as string[]).includes(id)
  );
  return { levels, unlocked };
}

/** Future versions add `migrations[n]` turning version n into n + 1. */
const migrations: Record<
  number,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {};

/** A checked Progress, or null if `raw` isn't a save this build can read. */
export function parseSave(raw: unknown): Progress | null {
  if (!isRecord(raw) || !Number.isInteger(raw.version)) return null;
  let save = raw;
  for (let v = save.version as number; v < SAVE_VERSION; v += 1) {
    const migrate = migrations[v];
    if (!migrate) return null;
    save = migrate(save);
  }
  if (save.version !== SAVE_VERSION) return null;
  return parseProgress(save.progress);
}
```

```ts
// lib/plane-builder/persist/local.ts
import { newProgress, type Progress } from "../economy/progress";
import { SAVE_VERSION, parseSave, type SaveV1 } from "./schema";

export const SAVE_KEY = "plane-builder:save";

export interface LoadResult {
  progress: Progress;
  /** A save was there but unreadable; it was backed up and replaced. */
  recovered: boolean;
}

export function loadProgress(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return { progress: newProgress(), recovered: false };
  }
  if (raw === null) return { progress: newProgress(), recovered: false };
  let parsed: Progress | null = null;
  try {
    parsed = parseSave(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (parsed) return { progress: parsed, recovered: false };
  try {
    window.localStorage.setItem(`${SAVE_KEY}:backup:${Date.now()}`, raw);
  } catch {
    // Backup is best effort; a full disk shouldn't block play.
  }
  return { progress: newProgress(), recovered: true };
}

export function saveProgress(progress: Progress): boolean {
  const save: SaveV1 = { version: SAVE_VERSION, progress };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests, then format** with
      `npx prettier --write lib/plane-builder`. They should pass.
- [ ] **Step 5: Commit:** `feat(plane-builder): versioned local save with backup`

---

### Task 7: Balance pilot, balance tests and tuning

**Goal:** A scripted average pilot that plays each level from scratch, with
tests that enforce the spec's balance targets. Tune the level numbers until
they pass.

**Files:**

- Create:
  - `lib/plane-builder/balance/pilot.ts`
  - `lib/plane-builder/balance/__tests__/balance.test.ts`
  - `scripts/plane-balance.ts`, a tuning printout
- Modify (tuning only): `lib/plane-builder/levels/{meadow,canyon,mountains}.ts`
  and, if unavoidable, `lib/plane-builder/sim/constants.ts`

**The pilot**, which is part of the spec:

- **Launch:** full power, aim pitch 0.35, yaw 0.
- **Flying:** pitch +0.3 while there's fuel, then 0. Boost for the first 30%
  of the fuel. No banking.
- **Buying:** between flights, buy the **cheapest affordable** upgrade, ties
  going to `TRACK_IDS` order. Repeat until nothing is affordable.

This changes one line in the spec: its "most distance per coin" pilot is
replaced by "cheapest affordable". Update the spec's `balance/` bullet in this
task's commit.

**Acceptance criteria:**

- [ ] For each level, `playLevel(id)` finishes in **30–40 flights**.
- [ ] A flight that doesn't pay enough for the cheapest remaining upgrade
      counts as a dry flight. Before the finish and while tracks remain, there
      are at most 2 dry flights in a row.
- [ ] A starter plane on every level (all tiers 0, the pilot's flying) reaches
      less than 10% of the finish.
- [ ] The best distance never drops by more than 10% between flights.
- [ ] The test runs in under 20 s in total. If it doesn't, the pilot caps a
      flight at 240 s of sim time.

**Verify:** `npm test -- --testPathPatterns=plane-builder/balance`, then
`npx tsx scripts/plane-balance.ts` to print the table.

**Steps:**

- [ ] **Step 1: The pilot**

```ts
// lib/plane-builder/balance/pilot.ts
import { payout } from "../economy/payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  type Progress,
} from "../economy/progress";
import { LEVELS } from "../levels";
import type { LevelId } from "../levels/types";
import { TRACK_IDS, tierPrice } from "../plane/catalog";
import { planeStats, type PlaneStats } from "../plane/stats";
import { runFlight, flightResult, type FlightResult } from "../sim/flight";

export const PILOT_AIM = { pitch: 0.35, yaw: 0, power: 1 };

export function pilotFlight(id: LevelId, stats: PlaneStats): FlightResult {
  const level = LEVELS[id];
  const { state } = runFlight(level, stats, PILOT_AIM, (s) => ({
    pitch: s.fuel > 0 ? 0.3 : 0,
    bank: 0,
    boost: s.fuel > stats.fuel * 0.7,
  }));
  return flightResult(state, level);
}

export function cheapestPrice(p: Progress, id: LevelId): number | null {
  const prices = TRACK_IDS.map((t) =>
    tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t])
  ).filter((x): x is number => x !== null);
  return prices.length ? Math.min(...prices) : null;
}

function shop(p: Progress, id: LevelId): Progress {
  for (;;) {
    const cheapest = cheapestPrice(p, id);
    if (cheapest === null || p.levels[id].coins < cheapest) return p;
    const track = TRACK_IDS.find(
      (t) => tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t]) === cheapest
    )!;
    const r = buyUpgrade(p, id, track);
    if (!r.ok) return p;
    p = r.progress;
  }
}

export interface FlightLog {
  distance: number;
  earned: number;
  /** Cheapest upgrade price left before this flight's earnings (null = maxed). */
  cheapest: number | null;
}

export function playLevel(id: LevelId, maxFlights = 80): FlightLog[] {
  let p = newProgress();
  p = { ...p, unlocked: ["meadow", "canyon", "mountains"] };
  const log: FlightLog[] = [];
  for (let i = 0; i < maxFlights; i += 1) {
    const stats = planeStats(LEVELS[id].plane, p.levels[id].tiers);
    const result = pilotFlight(id, stats);
    const earned = payout(LEVELS[id], result, stats.multiplier).total;
    log.push({
      distance: result.distance,
      earned,
      cheapest: cheapestPrice(p, id),
    });
    p = recordFlight(p, id, result, earned).progress;
    if (result.finished) break;
    p = shop(p, id);
  }
  return log;
}
```

- [ ] **Step 2: Write the balance tests** (they will fail until tuned):

```ts
// lib/plane-builder/balance/__tests__/balance.test.ts
import { LEVELS, LEVEL_ORDER } from "../../levels";
import { STARTER_TIERS } from "../../plane/catalog";
import { planeStats } from "../../plane/stats";
import { pilotFlight, playLevel } from "../pilot";

describe.each(LEVEL_ORDER)("%s balance", (id) => {
  const log = playLevel(id);
  const finish = LEVELS[id].finishDistance;

  it("takes 30-40 flights to finish", () => {
    expect(log[log.length - 1].distance).toBe(finish);
    expect(log.length).toBeGreaterThanOrEqual(30);
    expect(log.length).toBeLessThanOrEqual(40);
  });

  it("has at most 2 dry flights in a row", () => {
    let streak = 0;
    for (const f of log.slice(0, -1)) {
      const dry = f.cheapest !== null && f.earned < f.cheapest;
      streak = dry ? streak + 1 : 0;
      expect(streak).toBeLessThanOrEqual(2);
    }
  });

  it("starter plane gets under 10% of the way", () => {
    const stats = planeStats(LEVELS[id].plane, STARTER_TIERS);
    expect(pilotFlight(id, stats).distance).toBeLessThan(finish * 0.1);
  });

  it("best distance never drops by more than 10%", () => {
    let best = 0;
    for (const f of log) {
      expect(f.distance).toBeGreaterThanOrEqual(best * 0.9);
      best = Math.max(best, f.distance);
    }
  });
});
```

Note: the dry check compares a flight's earnings to the cheapest price
**before** the flight, which is a fair stand-in for "this flight bought
something".

- [ ] **Step 3: The tuning script**

```ts
// scripts/plane-balance.ts — run: npx tsx scripts/plane-balance.ts
import { LEVEL_ORDER } from "../lib/plane-builder/levels";
import { playLevel } from "../lib/plane-builder/balance/pilot";

for (const id of LEVEL_ORDER) {
  const log = playLevel(id);
  console.log(`\n${id}: ${log.length} flights`);
  log.forEach((f, i) =>
    console.log(
      `${String(i + 1).padStart(2)}  ${Math.round(f.distance).toString().padStart(5)} m  +${f.earned}  (cheapest ${f.cheapest ?? "-"})`
    )
  );
}
```

If `tsx` isn't installed, run it with `npx --yes tsx`. Don't add it as a
dependency. `@/` paths aren't used in lib, so relative imports work.

- [ ] **Step 4: Tune.** Change only the level spec numbers (`basePrice`,
      `from` and `to`, `payPerMeter`, `minPayout`, obstacle spacing) until the
      tests pass. Rules of thumb:
  - Too few flights: raise the `basePrice` values or lower `payPerMeter`.
  - Dry streaks: raise `minPayout`.
  - The starter goes too far: lower the tier-0 launcher or wings values.

  If the pilot crashes into hard obstacles early and stalls progress, that's a
  real difficulty signal. Prefer spacing the hard features further apart over
  changing the sim. Keep the Task 4 sim tests green.

- [ ] **Step 5: Run every plane-builder test**
      (`npm test -- --testPathPatterns=plane-builder`). They should pass.
- [ ] **Step 6: Commit:** `feat(plane-builder): balance pilot and tuned levels`.
      The commit includes the spec edit.

---

### Task 8: Store, flight input and the root component

**Goal:** A zustand store that drives the screens and progress, saves after
every change, and exposes a test hook. The root component switches screens
(the screens themselves are placeholders until Task 9).

**Files:**

- Create:
  - `lib/plane-builder/state/store.ts`
  - `lib/plane-builder/state/flightInput.ts`
  - `lib/plane-builder/state/flightLive.ts`
  - `lib/plane-builder/state/__tests__/store.test.ts`
- Modify: `components/plane-builder/PlaneBuilder.tsx`

**Acceptance criteria:**

- [ ] The screens are `"levels" | "hangar" | "launch" | "flight" | "results"`.
- [ ] The actions are `hydrate`, `openLevel`, `goToLevels`, `buy`,
      `startLaunch`, `beginFlight(aim)`, `completeFlight(result)`,
      `restart(id)` and `flyAgain`.
- [ ] `completeFlight` computes the payout with the multiplier stat, records
      it, and stores `lastFlight` with `{result, payout, isNewBest, unlocked,
previousBest}`.
- [ ] `openLevel` on a locked level does nothing.
- [ ] `PlaneBuilder` hydrates from `loadProgress` on mount and saves through a
      zustand `subscribe` whenever `progress` changes. When `recovered` is
      true it shows a dismissible notice: "Your old save couldn't be read, so
      we started fresh. A copy was kept."
- [ ] `window.__planeBuilderStore` is set only when `TEST_HOOKS_ENABLED`.

**Verify:** `npm test -- --testPathPatterns=plane-builder/state`

**Steps:**

- [ ] **Step 1: The input and live modules.** These are plain mutable
      singletons, read every frame, kept out of React and zustand.

```ts
// lib/plane-builder/state/flightInput.ts
import type { StickInput } from "../sim/flight";

/** Written by keyboard/touch handlers, read by FlightRunner every step. */
export const flightInput: StickInput = { pitch: 0, bank: 0, boost: false };

export function resetFlightInput(): void {
  flightInput.pitch = 0;
  flightInput.bank = 0;
  flightInput.boost = false;
}
```

```ts
// lib/plane-builder/state/flightLive.ts
import type { FlightState } from "../sim/flight";

/**
 * The running flight's state, for the HUD and the camera. FlightRunner owns
 * it; readers must not write. `notify` fires about 10 times a second.
 */
let current: FlightState | null = null;
const listeners = new Set<() => void>();

export const flightLive = {
  get: () => current,
  set(state: FlightState | null) {
    current = state;
  },
  notify() {
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
```

- [ ] **Step 2: Write the failing store tests.**

```ts
// lib/plane-builder/state/__tests__/store.test.ts
import { newProgress } from "../../economy/progress";
import { LEVELS } from "../../levels";
import { tierPrice } from "../../plane/catalog";
import { usePlaneBuilderStore as store } from "../store";

const reset = () => store.setState(store.getInitialState(), true);
beforeEach(reset);

describe("plane builder store", () => {
  it("starts on level select", () => {
    expect(store.getState().screen).toBe("levels");
  });

  it("opens an unlocked level's hangar but not a locked one", () => {
    store.getState().openLevel("canyon");
    expect(store.getState().screen).toBe("levels");
    store.getState().openLevel("meadow");
    expect(store.getState()).toMatchObject({
      screen: "hangar",
      levelId: "meadow",
    });
  });

  it("buys from the current level's wallet", () => {
    const p = newProgress();
    p.levels.meadow.coins = 1000;
    store.getState().hydrate(p);
    store.getState().openLevel("meadow");
    expect(store.getState().buy("wings").ok).toBe(true);
    expect(store.getState().progress.levels.meadow.coins).toBe(
      1000 - tierPrice(LEVELS.meadow.plane.wings, 0)!
    );
  });

  it("goes launch → flight → results and pays out", () => {
    store.getState().openLevel("meadow");
    store.getState().startLaunch();
    expect(store.getState().screen).toBe("launch");
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    expect(store.getState().screen).toBe("flight");
    const id = store.getState().flightId;
    store.getState().completeFlight({
      distance: 300,
      coins: 4,
      rings: 0,
      finished: false,
      endReason: "landed",
    });
    const s = store.getState();
    expect(s.screen).toBe("results");
    expect(s.lastFlight?.isNewBest).toBe(true);
    expect(s.progress.levels.meadow.coins).toBe(s.lastFlight!.payout.total);
    s.flyAgain();
    expect(store.getState().screen).toBe("launch");
    store.getState().beginFlight({ pitch: 0.3, yaw: 0, power: 1 });
    expect(store.getState().flightId).toBe(id + 1);
  });

  it("restart wipes one level", () => {
    const p = newProgress();
    p.levels.meadow.coins = 99;
    store.getState().hydrate(p);
    store.getState().restart("meadow");
    expect(store.getState().progress.levels.meadow.coins).toBe(0);
  });
});
```

- [ ] **Step 3: Implement the store.**

```ts
// lib/plane-builder/state/store.ts
import { create } from "zustand";
import { payout, type Payout } from "../economy/payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  restartLevel,
  type BuyResult,
  type Progress,
} from "../economy/progress";
import { LEVELS } from "../levels";
import type { LevelId } from "../levels/types";
import type { TrackId } from "../plane/catalog";
import { planeStats } from "../plane/stats";
import type { FlightResult, LaunchAim } from "../sim/flight";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { resetFlightInput } from "./flightInput";

export type Screen = "levels" | "hangar" | "launch" | "flight" | "results";

export interface FlightSummary {
  result: FlightResult;
  payout: Payout;
  isNewBest: boolean;
  previousBest: number;
  unlocked: LevelId | null;
}

interface PlaneBuilderData {
  screen: Screen;
  levelId: LevelId;
  progress: Progress;
  aim: LaunchAim | null;
  /** Bumped per launch so the flight scene remounts fresh. */
  flightId: number;
  lastFlight: FlightSummary | null;
}

export interface PlaneBuilderState extends PlaneBuilderData {
  hydrate: (progress: Progress) => void;
  openLevel: (id: LevelId) => void;
  goToLevels: () => void;
  buy: (track: TrackId) => BuyResult;
  startLaunch: () => void;
  beginFlight: (aim: LaunchAim) => void;
  completeFlight: (result: FlightResult) => void;
  flyAgain: () => void;
  restart: (id: LevelId) => void;
}

const initial: PlaneBuilderData = {
  screen: "levels",
  levelId: "meadow",
  progress: newProgress(),
  aim: null,
  flightId: 0,
  lastFlight: null,
};

export const usePlaneBuilderStore = create<PlaneBuilderState>()((set, get) => ({
  ...initial,
  hydrate: (progress) => set({ progress }),
  openLevel: (id) => {
    if (!get().progress.unlocked.includes(id)) return;
    set({ screen: "hangar", levelId: id, lastFlight: null });
  },
  goToLevels: () => set({ screen: "levels" }),
  buy: (track) => {
    const r = buyUpgrade(get().progress, get().levelId, track);
    if (r.ok) set({ progress: r.progress });
    return r;
  },
  startLaunch: () => {
    resetFlightInput();
    set({ screen: "launch", aim: null });
  },
  beginFlight: (aim) =>
    set((s) => ({ screen: "flight", aim, flightId: s.flightId + 1 })),
  completeFlight: (result) => {
    const { progress, levelId } = get();
    const level = LEVELS[levelId];
    const stats = planeStats(level.plane, progress.levels[levelId].tiers);
    const pay = payout(level, result, stats.multiplier);
    const previousBest = progress.levels[levelId].best;
    const recorded = recordFlight(progress, levelId, result, pay.total);
    resetFlightInput();
    set({
      screen: "results",
      progress: recorded.progress,
      lastFlight: {
        result,
        payout: pay,
        isNewBest: recorded.isNewBest,
        previousBest,
        unlocked: recorded.unlocked,
      },
    });
  },
  flyAgain: () => get().startLaunch(),
  restart: (id) => set((s) => ({ progress: restartLevel(s.progress, id) })),
}));

declare global {
  interface Window {
    __planeBuilderStore?: typeof usePlaneBuilderStore;
  }
}

if (TEST_HOOKS_ENABLED && typeof window !== "undefined") {
  window.__planeBuilderStore = usePlaneBuilderStore;
}
```

- [ ] **Step 4: The root component.** Replace `PlaneBuilder.tsx`:
  - It is `"use client"`.
  - It uses `useWebGLSupport()` from
    `@/components/ship-builder/hooks/useWebGLSupport`:
    - `null` renders an empty full-screen div with the same background, to
      avoid a hydration flash.
    - `false` renders `components/plane-builder/ui/WebGLFallback.tsx`, a copy
      of Ship Builder's with the text "…so the hangar can't draw your plane."
  - A `useEffect` on mount:
    1. `const r = loadProgress(); store.getState().hydrate(r.progress); setRecovered(r.recovered);`
    2. Then
       `return store.subscribe((s, prev) => { if (s.progress !== prev.progress) saveProgress(s.progress); });`
  - Saving starts only after hydration, so the fresh initial progress never
    overwrites a real save.
  - The layout is a full-screen `relative h-[100dvh] w-full overflow-hidden`
    container. Task 10's 3D `Stage` goes in an `absolute inset-0` layer
    behind, and the current screen's UI in a layer above.
  - For now it renders a `<h1>` "Plane Builder" plus the screen name.
- [ ] **Step 5: Run the tests and type-check.**
- [ ] **Step 6: Commit:** `feat(plane-builder): game store, saving and root`

---

### Task 9: Menu screens

**Goal:** The 2D screens: level select, hangar upgrade list, results, finish
card, restart confirm and the sound toggle. Every screen is keyboard
accessible and works in light and dark mode.

**Files:**

- Create:
  - `components/plane-builder/ui/LevelSelect.tsx`
  - `components/plane-builder/ui/Hangar.tsx`
  - `components/plane-builder/ui/UpgradeTrack.tsx`
  - `components/plane-builder/ui/Results.tsx`
  - `components/plane-builder/ui/FinishCard.tsx`
  - `components/plane-builder/ui/ConfirmRestart.tsx`
  - `components/plane-builder/ui/format.ts`, with `formatCoins` and
    `percentOf(distance, finish)`
  - `components/plane-builder/__tests__/screens.test.tsx`
- Modify: `components/plane-builder/PlaneBuilder.tsx` to render the screen for
  `screen`

**Behaviour:**

- **`LevelSelect`**
  - A `<h1>Plane Builder</h1>`, the version label linking to
    `/plane-builder/versions` (`v{PLANE_BUILDER_VERSION}`), and the sound
    toggle (from Task 12; leave a slot).
  - One card per entry in `LEVEL_ORDER`, as an `<article>` with
    `aria-labelledby`. Each card shows the name, the blurb, and
    `Best: {percent}%` as a bar.
  - **Locked card:** a padlock icon (lucide `Lock`), the text
    `Reach the finish in {previous name} to unlock`, and no buttons.
  - **Unlocked card:**
    - a button reading `Play`, or `Replay` when the level is finished, that
      calls `openLevel`
    - a `Restart` button that opens `ConfirmRestart`, shown only when the
      level has any progress (coins > 0, any tier > 0, or best > 0)
- **`ConfirmRestart`:** a modal `role="dialog" aria-modal="true"` titled
  `Restart {name}?` with the body
  `Your upgrades and coins for this level go back to zero. Other levels stay the same.`
  It has `Cancel` (focused first) and `Restart` buttons, and Escape cancels.
- **`Hangar`**
  - The top bar has `← Levels` (`goToLevels`), the level name, and the wallet
    (`🪙 {coins}`, with `aria-label="{coins} coins"`).
  - Below that is a list of `UpgradeTrack` rows for `TRACK_IDS`.
  - A big `Launch!` button calls `startLaunch`.
  - On phones the panel sits at the bottom with up to 50% of the height and
    scrolls. From `md:` up it's a right-hand sidebar about 22rem wide. The 3D
    plane shows behind.
- **`UpgradeTrack`**
  - Shows the label, the current part name
    (`catalog[track].parts[tier]`), 8 tier dots (filled up to the tier, with
    `aria-hidden`), and the effect line `{label} {tier+1} → {effect}`.
  - The buy button reads `Buy 🪙{price}`, or `Maxed` and disabled at the top.
    It is disabled and dimmed when the player can't afford it, and its
    accessible name is `Buy {label} for {price} coins`.
  - Clicking it calls `buy(track)`. On `ok`, play the `"buy"` cue (Task 12)
    and briefly flash the row (`animate-pulse` for 600 ms).
- **`Results`:** a card with:
  - the distance (`{m} m`, `{percent}% of the way`)
  - the coins line (`{distancePay} + {coinPay} coins × {multiplier}`)
  - the total (`+🪙{total}`)
  - `New best!` when `isNewBest`
  - `Almost there!` when the percent is 90 or more and the flight didn't
    finish
  - a crash, landed or stalled line (`You crashed!`, `Nice landing!`,
    `You ran out of speed.`)
  - `Upgrade` (opens the hangar) and `Fly again` (`flyAgain`) buttons
  - If `lastFlight.unlocked` is set, it renders `FinishCard` above, reading
    `Level complete!` and `{next name} unlocked!`, and fires
    `canvas-confetti` once on mount unless `usePrefersReducedMotion()`.
    Finishing a level that is already unlocked shows `Level complete!`
    without the unlock line.
- **Styling:** Tailwind only, with `dark:` variants, large touch targets
  (`min-h-11`), and rounded cards. The colours are sky and slate, with amber
  for coins.

**Tests** (`screens.test.tsx`, using RTL with the real store, reset in
`beforeEach` as in Task 8):

- LevelSelect shows the canyon as locked, with the unlock text and no
  Play button.
- Clicking `Play` on the meadow switches the screen to the hangar.
- `Restart` opens the dialog. `Cancel` keeps the coins and `Restart` wipes
  them.
- In the hangar, a track with too few coins has a disabled buy button. After
  hydrating 1000 coins, clicking `Buy Wings for 20 coins` raises the tier.
  Use the real price via `tierPrice`.
- Results shows `New best!` and the total from `lastFlight`.
- A finish that unlocks something shows `Canyon unlocked!` (the name comes
  from `LEVELS.canyon.name`). Mock `canvas-confetti`.

**Acceptance criteria:** the behaviours above, with all tests passing.

**Verify:** `npm test -- --testPathPatterns=plane-builder && npm run lint`

**Commit:** `feat(plane-builder): level select, hangar and results screens`

---

### Task 10: 3D world and plane models

**Goal:** A shared `Stage` canvas, the level world (sky, terrain, obstacles,
coins, rings, finish gate), the tiered `PlaneModel`, the `Slingshot`, and a
`HangarScene` turntable. This task contains no flight logic.

**Files:**

- Create, all under `components/plane-builder/scene/`:
  - `Stage.tsx`: `<Canvas shadows camera={{fov: 55, position: [-12, 6, 0]}}>`
    inside a
    `div data-testid="plane-canvas" role="img" aria-label="3D view of your plane"`,
    with `touch-none select-none`. Its children are the scene for the current
    screen.
  - `Sky.tsx`: a large `BackSide` sphere with a two-colour vertical gradient
    shader (`palette.sky` overhead, `palette.horizon` at the horizon). It also
    sets `<fog attach="fog" args={[palette.horizon, 150, 900]} />`, plus a
    hemisphere light and a directional sun with shadows.
  - `Terrain.tsx`:
    - one `PlaneGeometry` 400 m wide (z) by `finish + RUNOUT + 400` long (x),
      with segments every 8 m
    - vertex heights from `terrainHeight`
    - vertex colours lerping from `palette.ground` to `palette.hill` by height
      ÷ amplitude
    - corridor edge markers: a row of small poles every 50 m at
      `z = ±corridorHalfWidth`
    - `useMemo` on the level id
  - `Obstacles.tsx`: one `InstancedMesh` per `ObstacleKind`. Each kind is
    drawn as a recognisable shape inside its box:
    - tree: a cone on a cylinder
    - barn: a box with a prism roof, in `palette.hard`
    - balloon: a sphere with a string
    - wall: a box, rock-coloured
    - arch: a box
    - bird: a small flattened tetrahedron
    - peak: a cone with a white cap

    Scale each instance to `half × 2`.

  - `Pickups.tsx`:
    - coins are an `InstancedMesh` of gold cylinders spinning on y
    - rings are torus meshes
    - collected items (from `flightLive.get()?.coinTaken` and `ringTaken`)
      are hidden each frame by setting the instance scale to 0
    - when there is no flight, everything shows
  - `FinishGate.tsx`: two tall chequered posts and a banner at
    `x = finishDistance` spanning the corridor, using `<Text>` from drei
    reading "FINISH".
  - `PlaneModel.tsx`: props `{ levelId, tiers, palette }`. It builds a plane
    from primitives, with the nose along local +x:
    - **body** length 2 + 0.15 × the body tier. Tier 0 on the Meadow is a
      folded paper dart (two thin triangles).
    - **wings**: span 1.2 + 0.5 × the wings tier. The Canyon at tier 4 and
      above adds a second wing (a biplane). The Mountains at tier 5 and above
      sweeps the wings back 30°.
    - **engine**: nothing at tier 0. A propeller disc for Meadow and Canyon
      tiers 1–5, a second propeller at Canyon tier 6 and above, and jet
      nacelles for the Mountains with an emissive afterburner at tier 7 and
      above.
    - **fuel**: tanks under the wings at fuel tier 3 and above.
    - **multiplier**: `palette.trim` stripes at multiplier tier 1 and above,
      metallic gold at tier 8.

    It exposes a `group` ref through `forwardRef` (React 19 can use the `ref`
    prop) so flight code can pose it. Wrap it in `memo`.

  - `Slingshot.tsx`: props `{ tier, pull: {pitch, yaw, power} | null }`.
    - Two posts and a band. The material steps wood → metal → a powered
      catapult with a glow at tiers 0–2, 3–5 and 6–8.
    - The band stretches back by `power × 3 m` toward `-aim`.
    - It sits at the origin, with the plane at `(0, LAUNCH_HEIGHT, 0)`.
  - `HangarScene.tsx`: a floor disc, soft lights and the `PlaneModel` turning
    at 0.3 rad/s (still when `usePrefersReducedMotion`). The camera frames the
    plane from the front-left. When a tier changes, it does a quick 0.3 s
    scale pop.
  - `WorldScene.tsx`: Sky, Terrain, Obstacles, Pickups, FinishGate and
    Slingshot. Used by the launch and flight screens.
- Modify: `PlaneBuilder.tsx` mounts `Stage` with `HangarScene` on the
  `levels` and `hangar` screens (on level select, show the most recently
  opened level's plane), and `WorldScene` on `launch`, `flight` and
  `results`.

**Acceptance criteria:**

- [ ] The hangar shows a plane that visibly changes when any tier is bought.
      Check this in the browser with `npm run dev`, buying through
      `window.__planeBuilderStore`.
- [ ] The world renders all three levels at 60 fps on a laptop. At most one
      draw call per obstacle kind (instancing).
- [ ] No three.js object is created per frame. Materials and geometries are
      memoised.
- [ ] `npm run build` passes, and no React or three warnings appear in the
      console.

**Verify:** `npm run type-check && npm run lint && npm run build`, plus a
manual browser check of each level's world and the hangar on desktop and at
iPad size.

**Notes for the implementer:**

- Read `node_modules/next/dist/docs/` if the canvas needs dynamic import.
  Ship Builder renders `<Canvas>` directly from a `"use client"` component,
  so follow that.
- Tests: add `components/plane-builder/scene/__tests__/planeParts.test.ts`
  only for any pure helper you extract, for example a
  `planeParts(levelId, tiers)` that returns the part list. Extracting the
  part choice into that pure function and testing it is recommended.
  Canvas components aren't unit-tested here; e2e covers them.

**Commit:** `feat(plane-builder): 3D world, plane models and hangar scene`

---

### Task 11: Launching, flying and the flight HUD

**Goal:** Wire the sim to the scene. This covers the slingshot drag and the
keyboard launch, a fixed-step `FlightRunner`, the chase camera, touch and
keyboard steering with boost, and the flight HUD. When a flight ends, the
results screen opens.

**Files:**

- Create:
  - `components/plane-builder/scene/FlightRunner.tsx`
  - `components/plane-builder/scene/ChaseCamera.tsx`
  - `components/plane-builder/ui/LaunchOverlay.tsx`
  - `components/plane-builder/ui/Steering.tsx`
  - `components/plane-builder/ui/FlightHud.tsx`
  - `components/plane-builder/hooks/useFlightKeys.ts`
  - `lib/plane-builder/sim/aim.ts`
  - `lib/plane-builder/sim/__tests__/aim.test.ts`
- Modify: `components/plane-builder/PlaneBuilder.tsx` and
  `components/plane-builder/scene/WorldScene.tsx`

**Behaviour:**

- **`lib/plane-builder/sim/aim.ts`**, which is pure and tested:
  - `aimFromDrag(dx, dy, maxDrag)` maps a pointer drag (dragging down and
    left pulls back) to `LaunchAim`:
    - `power = min(1, hypot(dx, dy) / maxDrag)`
    - `pitch = clamp(dy / maxDrag, 0, 1) × MAX_AIM_PITCH`, where dragging
      down aims up
    - `yaw = clamp(-dx / maxDrag, -1, 1) × MAX_AIM_YAW`
  - `stickFromDrag(dx, dy, radius)` returns `{pitch: clamp(-dy/radius), bank: clamp(dx/radius)}`,
    where dragging up climbs.
  - Tests cover zero drag (power 0), a full pull, the clamping, and the signs.
- **`LaunchOverlay`** (the `launch` screen)
  - A full-screen transparent layer with the hint "Drag back to aim, let go to
    launch!" (on keyboard: "Arrows to aim, hold Space to pull").
  - Pointer down, move and up use `aimFromDrag`, with
    `maxDrag = min(innerWidth, innerHeight) × 0.4`, and update a shared
    `launchAim` mutable that the Slingshot reads every frame.
  - Release with power under 0.1 cancels. Otherwise it calls
    `beginFlight(aim)`.
  - Keyboard:
    - arrows change pitch and yaw by 0.05 rad per press, clamped
    - holding Space raises power by 1 per second
    - releasing Space calls `beginFlight`
    - Escape returns to the hangar
  - There is also a `← Hangar` button.
- **`FlightRunner`** (inside `WorldScene` while `screen === "flight"`, keyed by
  `flightId`)
  - On mount, it builds `stats = planeStats(...)` and
    `state = launch(level, stats, aim)`, then `flightLive.set(state)`.
  - In `useFrame((_, delta) => ...)`:
    1. `acc += Math.min(delta, 0.1)`.
    2. While `acc >= STEP`, step the sim with `flightInput`, collect the
       events, and `acc -= STEP`.
    3. Pass the events to `playCue` (Task 12; leave a no-op `onEvents` prop
       until then).
    4. Copy the pose onto the plane group:
       - `position (x, y, z)`
       - rotation order `"YZX"`: `y = -heading`, `z = pitch`, `x = -bank`
  - It calls `flightLive.notify()` every 6th frame.
  - When `state.phase === "done"`, it waits 1.2 s (so the crash or landing is
    visible), then calls
    `completeFlight(flightResult(state, level))` exactly once (use a ref
    guard).
  - On `document.visibilitychange` to hidden, it stops accumulating time, so
    the flight pauses.
  - On unmount, it calls `flightLive.set(null)`.
  - On a crash, it hides the plane and shows a burst of 12 small boxes in
    plane colours flying outward over 1 s (the "puff of parts").
- **`ChaseCamera`:** eases the camera to a point 14 m behind and 5 m above the
  plane along its heading, looking 10 m ahead. Use the lerp factor
  `1 - exp(-4 × delta)`. On the launch screen it sits behind the slingshot.
  With reduced motion, add no camera shake. Otherwise shake for 0.3 s on
  `bump` and `shield`.
- **`Steering`** (the `flight` screen overlay)
  - Pointer down anywhere (except the boost button) sets the origin, and
    pointer move sets `flightInput.pitch` and `flightInput.bank` from
    `stickFromDrag` with `radius = 80px`. Pointer up resets both to 0.
  - It shows a faint ring and knob at the origin while dragging.
  - A round `Boost` button (bottom right, at least 64px) sets
    `flightInput.boost` while pressed. It is disabled when there's no fuel or
    no engine.
- **`useFlightKeys`:**
  - W/↑ climbs (pitch +1), S/↓ dives (-1), A/← banks left (-1), D/→ banks
    right (+1), and Shift or Space boosts.
  - It tracks the set of keys held, so releasing one key keeps the others
    working.
  - It ignores key repeat and clears on `blur`.
- **`FlightHud`**
  - It subscribes to `flightLive` with `useSyncExternalStore`, reading a
    snapshot object that is rebuilt only on notify.
  - **Top:** a distance bar from 0 to the finish, with the plane icon at
    `maxX`, a marker at the best distance, and the text `{percent}%`.
  - **Top left:** a fuel bar (hidden when the engine tier is 0) and shields as
    small shield icons.
  - **Top right:** the flight coins `🪙 {coins}`.
  - Everything carries `aria-live="off"`, and a visually hidden
    `aria-live="polite"` region announces `Finish line!` once.
  - On `finish` it shows a big "FINISH!" banner for 2 s.

**Acceptance criteria:**

- [ ] On desktop: drag back, release, and the plane flies. Arrow or WASD
      steering and Shift boost work. The flight ends and the results screen
      shows the earnings.
- [ ] On iPad (in Playwright's iPad project or a real device): drag to launch,
      drag to steer, and hold Boost.
- [ ] Switching tabs mid-flight pauses it. Coming back doesn't teleport the
      plane.
- [ ] The `aim` tests pass. `npm run type-check`, `npm run lint` and the build
      pass.

**Verify:**
`npm test -- --testPathPatterns=plane-builder && npm run build`, plus a manual
flight on each unlocked level. Use the test hook
`__planeBuilderStore.getState().hydrate(...)` with progress that unlocks
everything and maxes the tiers, to check that the Mountains finish is
reachable.

**Commit:** `feat(plane-builder): slingshot launch, flight and HUD`

---

### Task 12: Sound

**Goal:** Synthesized sound cues and an engine hum, using Web Audio with no
asset files, behind a sound toggle that is remembered and off by default.

**Files:**

- Create:
  - `components/plane-builder/audio/soundSetting.ts`: key
    `plane-builder:ui:sound`, the same shape as Ship Builder's, imported via
    `createStoredSetting` from
    `@/components/ship-builder/hooks/createStoredSetting`
  - `components/plane-builder/audio/planeSynth.ts`
  - `components/plane-builder/audio/useSoundUnlock.ts`, the same pattern as
    Ship Builder's, using `planeSynth`
  - `components/plane-builder/ui/SoundToggle.tsx`
  - `components/plane-builder/audio/__tests__/planeSynth.test.ts`
- Modify:
  - `FlightRunner` (pass its events to `planeSynth.play`, and call
    `setEngine` each frame)
  - `UpgradeTrack` (the `buy` cue)
  - `LaunchOverlay` (the `launch` cue)
  - `Results` and `FinishCard` (`cheer`)
  - `LevelSelect` and `Hangar` (render `SoundToggle`)

**Behaviour:**

- `planeSynth` has:
  - `enable(): boolean`, which creates and resumes an `AudioContext` from a
    gesture
  - `disable()`, `isEnabled()`
  - `play(cue)`, where the cue is one of
    `"launch" | "coin" | "ring" | "bump" | "shield" | "crash" | "land" | "cheer" | "buy"`
  - `setEngine(level: number)`, 0..1, a held sawtooth plus noise whose pitch
    and gain follow `level`, where boost is level 1 and no fuel is 0
  - `pause()` and `resume()` on visibility changes
- The cues are short oscillator or noise graphs that disconnect themselves when
  done:
  - coin: two quick square blips, 880→1320 Hz
  - ring: an upward arpeggio
  - bump: a low thud
  - shield: a metallic ping
  - crash: a noise burst with a lowpass sweep down
  - land: a soft thump
  - cheer: a major chord swell
  - buy: a cash-register blip
  - launch: a band twang, a sine sweep 300→120 Hz
- Nothing touches `AudioContext` before `enable()`, and every method is a
  no-op when disabled or unsupported.
- `SoundToggle` is a button with
  `aria-pressed={on}` and `aria-label="Sound"`, showing the lucide
  `Volume2`/`VolumeX` icon. Turning it on calls `planeSynth.enable()` inside
  the click. If that fails, the setting stays off.

**Tests:** with no `AudioContext` in jsdom, `isAudioSupported()` is false and
every method is a safe no-op. With a minimal fake `AudioContext` on `window`,
check that `enable()` returns true, `play("coin")` creates oscillators, and
`disable()` suspends. Model the fake on what Ship Builder's synth tests do, if
it has any (`components/ship-builder/audio/__tests__`).

**Acceptance criteria:** the cues play in the browser with sound on, there's
no console error with sound off, and the tests pass.

**Verify:** `npm test -- --testPathPatterns=plane-builder/audio`, plus a
manual listen.

**Commit:** `feat(plane-builder): synthesized sound cues and engine hum`

---

### Task 13: Site links and analytics (the security boundary)

**Goal:** Link the game from the site and track its pageviews as their own
analytics site, `plane-builder`. **This changes `firestore.rules`, so it needs
a spec review and an adversarial review.**

**Files:**

- Modify:
  - `lib/analytics/types.ts`:
    `Site = "home" | "ship-builder" | "plane-builder"`, and `SITES` to match
  - `lib/analytics/site.ts`: `/plane-builder` and `/plane-builder/...` map to
    `"plane-builder"`
  - `firestore.rules`: add `'plane-builder'` to the `d.site in [...]` list and
    a matching `|| (d.site == 'plane-builder' && d.path.matches('^/plane-builder(/.*)?$'))`
    clause, mirroring the ship-builder clause exactly
  - the rules tests (find them with `grep -rl "ship-builder" --include=*.test.ts . | grep -i rules`):
    add cases where a plane-builder pageview with a matching path is allowed,
    one with path `/ship-builder` is denied, and a ship-builder site with path
    `/plane-builder` is denied
  - the unit tests for `siteForPath`: add the plane-builder paths, and check
    that `/plane-builderx` is not tracked
  - `components/admin/Dashboard.tsx`: add `{ id: "plane-builder", label: "Plane Builder" }`
    to the site tabs, extend the `summarize` map and the per-site list (the
    hard-coded `(["home", "ship-builder"] as const)` arrays). Prefer deriving
    them from `SITES` if that's a small change.
  - `app/sitemap.ts`: add `https://gentryriggen.com/plane-builder` with
    priority 0.8
  - `components/designs/design1/Hobbies.tsx`: add a sentence after the ship
    one: `✈️ And a plane game where you upgrade a slingshot plane until it reaches the finish line: /plane-builder (or type 'planes').`,
    using the same link styling
  - `components/designs/design1/commandResponses.tsx`:
    - add a `planesOutput()` like `shipsOutput()` ("A plane-flying game I made
      for my boys ✈️", "Taking off in a moment...")
    - handle `planes` and `plane-builder` commands with
      `navigateTo: "/plane-builder"`
    - add the command to `HELP_TEXT` wherever `ships` is listed
  - the home and terminal unit tests that cover `ships`: add matching `planes`
    cases

**Acceptance criteria:**

- [ ] `npm run test:rules` passes, with the new allow and deny cases. It needs
      Java 21+. If it isn't available locally, say so and rely on CI.
- [ ] A `plane-builder` pageview can only carry a `/plane-builder…` path.
      Ship-builder and home rules are unchanged.
- [ ] The admin dashboard shows a Plane Builder tab.
- [ ] Typing `planes` in the terminal navigates to `/plane-builder`.

**Verify:** `npm test && npm run test:rules && npm run lint`

**Review:** a spec review plus an adversarial quality review focused on the
rules diff, per CLAUDE.md.

**Commit:** `feat(plane-builder): site links and analytics site`

---

### Task 14: E2E tests, visual snapshots and the 1.0.0 release

**Goal:** Browser coverage for the core loop, plus final release notes and a
full check.

**Files:**

- Create:
  - `e2e/plane-builder.spec.ts`
  - `e2e/plane-builder-visual.spec.ts`, with snapshots generated in the
    Docker visual environment (`npm run test:visual:update`). Read
    `scripts/visual-docker.sh` and `e2e/ship-builder-visual.spec.ts` first and
    copy their approach (shared CSS, frozen motion).
- Modify:
  - `lib/plane-builder/changelog.ts` (finalize the 1.0.0 highlights from
    `git log`)
  - the `testHooks` usage, if a freeze-motion hook is needed for the visual
    test

**Tests:**

```ts
// e2e/plane-builder.spec.ts (outline: write it in full)
import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/plane-builder");
  await expect(
    page.getByRole("heading", { name: "Plane Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__planeBuilderStore));
}
```

1. `@smoke` **core loop:**
   - Open the game and click `Play` on the meadow.
   - Seed coins with
     `__planeBuilderStore.getState().hydrate({...progress with meadow.coins 1000})`.
   - Click `Buy Wings for … coins`, then `Launch!`.
   - Drag from the screen centre to 200px down and left with `page.mouse`
     (or, on iPad, touch through `page.touchscreen` or dispatched pointer
     events), then release.
   - Expect the results screen (heading or `New best!`) within 20 s.
   - Click `Upgrade` and reload. The wallet and Wings tier should be kept.
2. **Keyboard launch:** in the launch screen, hold Space for 1 s with
   `keyboard.down` and `keyboard.up`, and expect the results screen.
3. **Finish unlocks the canyon:** through the store, set `screen` to
   `"flight"` and call `completeFlight({distance: 2000, coins: 0, rings: 0, finished: true, endReason: "runout"})`.
   Expect `Canyon unlocked!`. Go back to the levels and check that the canyon
   card now has `Play`.
4. **Replay vs Restart:** with a finished meadow, the button reads `Replay`.
   Restart, then Cancel, keeps the coins. Restart, then Restart, wipes them.
5. `@smoke` **WebGL fallback:** reuse whatever Ship Builder's specs do for
   `E2E_NO_WEBGL` (grep `e2e/ship-builder.spec.ts` for the fallback text), or
   skip this case if WebGL is on.

**Visual:** hangar with the starter meadow plane, hangar with a maxed meadow
plane, and the flight HUD frozen mid-flight (freeze with a test hook that
stops `FlightRunner` accumulating time, guarded by `TEST_HOOKS_ENABLED`).

**Release steps:**

- [ ] Rewrite the 1.0.0 highlights from
      `git log --oneline main..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`,
      in kid-friendly words. Mention Replay and Restart, and the three
      worlds.
- [ ] `npm run validate` passes: lint, format, types, unit tests and build.
- [ ] `npm run test:e2e -- --grep "plane-builder|Plane"` passes on Chromium,
      plus `--project=ipad` for the `@smoke` tests. Skip Firefox locally (see
      memory).
- [ ] `npm run test:visual` passes.

**Commit:**
`chore(plane-builder): release 1.0.0`, with e2e and visual snapshots in a
separate `test(plane-builder): e2e and visual coverage` commit before it.

---

## Dependencies and batching

| Task | Needs                     | Notes                                                                  |
| ---- | ------------------------- | ---------------------------------------------------------------------- |
| 1    | –                         | Spot-check, no reviewer.                                               |
| 2, 3 | 1                         | Batch into one implementer, one commit per task.                       |
| 4    | 3                         | Combined review.                                                       |
| 5, 6 | 4 (5 uses `FlightResult`) | Batch; combined review.                                                |
| 7    | 5                         | Combined review. Tuning may touch the level files from Task 3.         |
| 8    | 6, 7                      | Combined review.                                                       |
| 9    | 8                         | Combined review.                                                       |
| 10   | 8                         | Can run in parallel with 9 in a worktree. Combined review.             |
| 11   | 9, 10                     | Combined review.                                                       |
| 12   | 11                        | Combined review.                                                       |
| 13   | 1                         | Independent of 2–12; can run in parallel. Spec and adversarial review. |
| 14   | all                       | Run e2e, visual and the full build here only (expensive checks once).  |
