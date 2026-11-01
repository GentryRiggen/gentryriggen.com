import { useEffect, useState } from "react";
import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import { GLOBE, GLOBE_FLOCK, cloudAt, riverAt } from "./anchors";

const BIOME_FILL = {
  forest: "#3a8f3f",
  jungle: "#0f7a4a",
  meadow: "#b4d95a",
  wetland: "#3fae9b",
} as const;
const BIOME_FLECK = {
  forest: "#58b05a",
  jungle: "#2f9e62",
  meadow: "#d3ec84",
  wetland: "#7ad3c1",
} as const;
type BiomeKey = keyof typeof BIOME_FILL;
const BIOME_KEYS: readonly BiomeKey[] = [
  "forest",
  "jungle",
  "meadow",
  "wetland",
];

const CELL = 11;
const OCEAN = "#2c6cc4";
const LAND = "#c9a56a";
const LAND_DRY = "#d9b25a";

/** A small repeatable pseudo-random number (the same globe every time). */
function rand(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTINENTS: readonly [number, number, number, number][] = [
  [152, 120, 52, 34],
  [238, 108, 36, 26],
  [214, 192, 52, 34],
  [138, 192, 28, 22],
  [262, 160, 18, 24],
];
const inLand = (x: number, y: number): boolean =>
  CONTINENTS.some(
    ([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
  );

interface Cell {
  x: number;
  y: number;
  land: boolean;
  /** 0 = greens first. */
  rank: number;
  /** Which biome this cell turns into, as a 0 to 1 draw. */
  pick: number;
  fleck: boolean;
}

/** Every cell of the globe, with the order the green reaches it. */
const CELLS: readonly Cell[] = (() => {
  const next = rand(7);
  const cells: Omit<Cell, "rank">[] = [];
  const keys: number[] = [];
  const out: Cell[] = [];
  for (let y = GLOBE.y - GLOBE.r; y < GLOBE.y + GLOBE.r; y += CELL) {
    for (let x = GLOBE.x - GLOBE.r; x < GLOBE.x + GLOBE.r; x += CELL) {
      const mx = x + CELL / 2 - GLOBE.x;
      const my = y + CELL / 2 - GLOBE.y;
      if (mx * mx + my * my > (GLOBE.r + 4) ** 2) continue;
      const land = inLand(x + CELL / 2, y + CELL / 2);
      const r = next();
      keys.push(land ? r * 0.55 : 0.4 + r * 0.6);
      cells.push({ x, y, land, pick: next(), fleck: next() < 0.35 });
    }
  }
  const order = keys.map((k, i) => [k, i] as const).sort((a, b) => a[0] - b[0]);
  const rank = new Array<number>(keys.length);
  order.forEach(([, i], place) => {
    rank[i] = place / keys.length;
  });
  cells.forEach((c, i) => out.push({ ...c, rank: rank[i] }));
  return out;
})();

/** Towns and the roads between them (the roads and towns go quiet). */
const TOWNS: readonly (readonly [number, number])[] = [
  [140, 120],
  [168, 134],
  [228, 104],
  [250, 118],
  [210, 186],
  [236, 200],
  [186, 200],
  [136, 190],
];
/** The order the towns turn into woods, spread around the globe. */
const TOWN_FADE: readonly number[] = [3, 6, 1, 4, 0, 7, 2, 5];
const ROADS: readonly (readonly [number, number, number, number])[] = [
  [140, 121, 29, 2],
  [168, 121, 2, 14],
  [168, 134, 60, 2],
  [228, 104, 2, 30],
  [228, 104, 22, 2],
  [250, 104, 2, 14],
  [210, 134, 2, 52],
  [210, 186, 26, 2],
  [186, 186, 24, 2],
  [186, 186, 2, 14],
  [136, 190, 50, 2],
  [136, 150, 2, 40],
  [168, 134, 2, 52],
];

const STARS = Array.from({ length: 36 }, (_, i) => {
  const next = rand(900 + i);
  return { x: next() * 420 - 10, y: next() * 310 - 5, big: next() < 0.2 };
});

/** Which biome a cell turns into, from the shares. */
function biomeFor(pick: number, info: GrowSceneInfo): BiomeKey {
  const total = info.forest + info.jungle + info.meadow + info.wetland;
  if (total <= 0) return info.biome;
  let at = pick * total;
  for (const b of BIOME_KEYS) {
    at -= info[b];
    if (at < 0) return b;
  }
  return info.biome;
}

/**
 * Each green cell's biome, fixed at the moment it greens, so old patches keep
 * their look when the player points the birds somewhere new.
 */
function useCellBiomes(
  info: GrowSceneInfo,
  greened: number
): readonly (BiomeKey | undefined)[] {
  const [fixed, setFixed] = useState<readonly (BiomeKey | undefined)[]>([]);
  const fresh = CELLS.some(
    (c, i) => c.rank * CELLS.length < greened && fixed[i] === undefined
  );
  if (!fresh) return fixed;
  const next = CELLS.map((c, i) =>
    c.rank * CELLS.length < greened
      ? (fixed[i] ?? biomeFor(c.pick, info))
      : undefined
  );
  setFixed(next);
  return next;
}

/** True once the phase card is gone, so the pull-back is seen, not hidden. */
function useCardGone(): boolean {
  const check = () =>
    typeof document === "undefined" ||
    !document.querySelector('[data-testid="lm-phase-overlay"]');
  const [gone, setGone] = useState(check);
  useEffect(() => {
    if (gone) return;
    const watch = new MutationObserver(() => {
      if (check()) {
        setGone(true);
        watch.disconnect();
      }
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [gone]);
  return gone;
}

/**
 * Only the first two clouds and the migrating V drift forever: WebKit on an
 * old iPad repaints the whole SVG for every animated group.
 */
const DRIFTING_CLOUDS = 2;

function Cloud({ x, y, i }: { x: number; y: number; i: number }) {
  const drifts = i < DRIFTING_CLOUDS;
  return (
    <g
      className={`${drifts ? "gw-drift" : ""} ${i % 2 ? "[animation-delay:-5s]" : ""}`}
    >
      <rect x={x} y={y} width="26" height="7" fill="#fff" fillOpacity="0.9" />
      <rect
        x={x + 6}
        y={y - 5}
        width="14"
        height="6"
        fill="#fff"
        fillOpacity="0.9"
      />
    </g>
  );
}

function Flock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <rect
            x={x + k * 9}
            y={y + (k % 2) * 4}
            width="3"
            height="2"
            fill="#fff8d6"
          />
          <rect
            x={x + k * 9 + 3}
            y={y + (k % 2) * 4 + 2}
            width="3"
            height="2"
            fill="#fff8d6"
          />
          <rect
            x={x + k * 9 + 6}
            y={y + (k % 2) * 4}
            width="3"
            height="2"
            fill="#fff8d6"
          />
        </g>
      ))}
    </g>
  );
}

/** A V of migrating birds, once a flock has landed somewhere. */
function MigrantV({ x, y }: { x: number; y: number }) {
  const spots = [0, 1, 2, 3, 4].map((k) => [Math.abs(k - 2) * 7, k * 5 - 8]);
  return (
    <g className="gw-drift [animation-delay:-3s]" data-testid="lm-migrants">
      {spots.map(([dx, dy], k) => (
        <g key={k}>
          <rect x={x - dx} y={y + dy} width="4" height="2" fill="#fff8d6" />
          <rect
            x={x - dx + 4}
            y={y + dy + 2}
            width="3"
            height="2"
            fill="#fff8d6"
          />
          <rect x={x - dx + 7} y={y + dy} width="4" height="2" fill="#fff8d6" />
        </g>
      ))}
    </g>
  );
}

/** A close-up farm that the camera leaves behind. */
function FarmBehind({ away }: { away: boolean }) {
  return (
    <g className={`gw-farm ${away ? "gw-farm-away" : ""}`} aria-hidden="true">
      <rect x="-1200" y="-1200" width="2800" height="1320" fill="#a8dcff" />
      <rect x="-1200" y="118" width="2800" height="1200" fill="#6fb04f" />
      {[0, 1, 2].map((r) => (
        <rect
          key={r}
          x="-1200"
          y={150 + r * 30}
          width="2800"
          height="14"
          fill="#5a3a1c"
        />
      ))}
      <rect x="250" y="84" width="60" height="34" fill="#b03a2e" />
      <path d="M246 84l34 -18l34 18z" fill="#5b2a1c" />
      <circle cx="340" cy="40" r="14" fill="#ffe66d" />
    </g>
  );
}

/**
 * The green world: the camera has left the farms and pulled back to a globe.
 * It starts bare and tan, then turns green biome by biome. The old roads fade
 * to meadow and the little towns turn into woods, quietly, and nothing about
 * that is ever counted or labelled. Kids see a beautiful green planet.
 */
export default function WorldLayer({ info }: { info: GrowSceneInfo }) {
  const gone = useCardGone();
  const greened = Math.round(info.greenFraction * CELLS.length);
  const roads = Math.round(info.roadsLeft * ROADS.length);
  const towns = Math.round(info.townsLeft * TOWNS.length);
  const bare = info.dry ? LAND_DRY : LAND;
  const biomes = useCellBiomes(info, greened);
  const globeClass = `gw-globe ${gone ? "gw-pullback" : "gw-zoomed"}`;
  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#07102a" />
      {STARS.map((s, i) => (
        <rect
          key={i}
          x={s.x}
          y={s.y}
          width={s.big ? 2 : 1}
          height={s.big ? 2 : 1}
          fill="#dfe9ff"
          fillOpacity="0.8"
        />
      ))}
      <defs>
        <clipPath id="gw-clip">
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} />
        </clipPath>
        <radialGradient id="gw-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <g
        className={globeClass}
        data-testid="lm-globe"
        data-green={info.greenFraction}
      >
        <circle
          cx={GLOBE.x}
          cy={GLOBE.y}
          r={GLOBE.r + 5}
          fill={info.ended ? "#a5d6a7" : "#7fb2ff"}
          fillOpacity={info.ended ? 0.5 : 0.18}
        />
        <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill={OCEAN} />
        <g clipPath="url(#gw-clip)">
          {CELLS.map((c, i) => {
            const green = c.rank * CELLS.length < greened;
            if (!green && !c.land) return null;
            const biome = biomes[i] ?? biomeFor(c.pick, info);
            return (
              <g key={i}>
                <rect
                  x={c.x}
                  y={c.y}
                  width={CELL}
                  height={CELL}
                  fill={green ? BIOME_FILL[biome] : bare}
                />
                {green && c.fleck && (
                  <rect
                    x={c.x + 3}
                    y={c.y + 3}
                    width="4"
                    height="3"
                    fill={BIOME_FLECK[biome]}
                  />
                )}
              </g>
            );
          })}
          {ROADS.map(([x, y, w, h], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={i < roads ? "#8a8f98" : "#a8d36a"}
              fillOpacity={i < roads ? 0.9 : 0.8}
            />
          ))}
          {TOWNS.map(([x, y], i) => {
            const standing = TOWN_FADE.indexOf(i) < towns;
            return standing ? (
              <g key={i}>
                <rect x={x - 5} y={y - 3} width="6" height="5" fill="#d9774a" />
                <rect x={x + 2} y={y - 5} width="6" height="7" fill="#c9824a" />
                <rect x={x - 3} y={y - 2} width="2" height="2" fill="#ffe66d" />
                <rect x={x + 4} y={y - 3} width="2" height="2" fill="#ffe66d" />
              </g>
            ) : (
              <g key={i}>
                <rect x={x - 5} y={y - 4} width="6" height="6" fill="#2e7d32" />
                <rect x={x + 2} y={y - 6} width="5" height="8" fill="#256d2b" />
              </g>
            );
          })}
          {Array.from({ length: info.rivers }, (_, i) => {
            const { x, y } = riverAt(i);
            return (
              <g key={i}>
                <rect x={x} y={y} width="26" height="3" fill="#4aa3f0" />
                <rect x={x + 24} y={y} width="3" height="18" fill="#4aa3f0" />
                <rect
                  x={x + 24}
                  y={y + 16}
                  width="22"
                  height="3"
                  fill="#4aa3f0"
                />
              </g>
            );
          })}
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="url(#gw-shade)" />
        </g>
        {Array.from({ length: info.clouds }, (_, i) => (
          <Cloud key={i} i={i} {...cloudAt(i)} />
        ))}
        {info.migrated && <MigrantV x={GLOBE_FLOCK.x} y={GLOBE_FLOCK.y} />}
        {Array.from({ length: info.flocks }, (_, i) => (
          <Flock key={i} x={150 + ((i * 53) % 120)} y={52 + ((i * 37) % 60)} />
        ))}
      </g>
      <FarmBehind away={gone} />
    </g>
  );
}
