import { WorldForkArt, WorldProjectArt } from "./TradeoffArt";
import { useEffect, useState } from "react";
import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import { GLOBE, cloudAt, riverAt } from "./anchors";

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
/** Blight: a creeping grey-brown rot, with a darker stain and dead wood. */
const ROT = "#4b3b2c";
const ROT_STAIN = "#1e1710";
const ROT_WOOD = "#150f09";
/** The alarm ring around a sick globe, and the screen's blighted edge. */
const ROT_GLOW = "#ff6a2e";
/** Cracked earth, and the dust over a thirsty land. */
const CRACK = "#5a3a1c";
const DUST = "#e0b44f";

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
  /** 0 = rots first, when its biome is blighted. */
  rot: number;
  /** Which cells glisten when a wetland is wet (a few, spread about). */
  shine: number;
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
      cells.push({
        x,
        y,
        land,
        pick: next(),
        fleck: next() < 0.35,
        rot: next(),
        shine: Math.floor(next() * 4),
      });
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

const STAR_GROUPS = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c", ""] as const;
const STARS = Array.from({ length: 36 }, (_, i) => {
  const next = rand(900 + i);
  return { x: next() * 420 - 10, y: next() * 310 - 5, big: next() < 0.2 };
});

/**
 * Which biome a cell is, from the shares right now. The shares move as the
 * mix does, so the whole globe re-colours as they shift (a cell is only
 * ever one biome at a time, and the same cell is the same biome for the
 * same shares).
 */
function biomeFor(pick: number, info: GrowSceneInfo): BiomeKey {
  const total = info.forest + info.jungle + info.meadow + info.wetland;
  if (total <= 0) return "forest";
  let at = pick * total;
  for (const b of BIOME_KEYS) {
    at -= info[b];
    if (at < 0) return b;
  }
  return "forest";
}

/** Each biome's rot in tenths ("forest|jungle|meadow|wetland"). */
function rotOf(info: GrowSceneInfo): Record<BiomeKey, number> {
  const parts = info.blight.split("|").map(Number);
  return {
    forest: parts[0] ?? 0,
    jungle: parts[1] ?? 0,
    meadow: parts[2] ?? 0,
    wetland: parts[3] ?? 0,
  };
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
 * Clouds drift in two shared groups (odd and even), not one animation each:
 * WebKit on an old iPad repaints the whole SVG for every animated group.
 */
function Cloud({ x, y }: { x: number; y: number }) {
  return (
    <g>
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

/** Fills for a thirsty land: dull, dusty greens (the wetland never thirsts). */
const DRY_FILL = {
  forest: "#7d8a3c",
  jungle: "#8f8c2d",
  meadow: "#d0c062",
  wetland: BIOME_FILL.wetland,
} as const;

/** Cracks in the earth: short zigzags that start on land (the same every time). */
const CRACKS: readonly string[] = (() => {
  const next = rand(31);
  const out: string[] = [];
  for (let n = 0; n < 70; n += 1) {
    let x = GLOBE.x - GLOBE.r + next() * GLOBE.r * 2;
    let y = GLOBE.y - GLOBE.r + next() * GLOBE.r * 2;
    if (!inLand(x, y)) continue;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let k = 0; k < 4; k += 1) {
      x += (next() - 0.5) * 16;
      y += 3 + next() * 7;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
})();

/** Spore puffs that drift up off a rotting land (only drawn while it rots). */
const SPORES = (() => {
  const next = rand(77);
  const out: { x: number; y: number }[] = [];
  for (let guard = 0; out.length < 10 && guard < 500; guard += 1) {
    const x = GLOBE.x - GLOBE.r + next() * GLOBE.r * 2;
    const y = GLOBE.y - GLOBE.r + next() * GLOBE.r * 2;
    if (inLand(x, y)) out.push({ x, y });
  }
  return out;
})();

/** Sparkles for the healing wave: spread over the globe, rising as they fade. */
const HEAL_SPARKS = Array.from({ length: 16 }, (_, i) => {
  const next = rand(500 + i);
  const angle = next() * Math.PI * 2;
  const radius = 20 + next() * (GLOBE.r - 30);
  return {
    x: GLOBE.x + Math.cos(angle) * radius,
    y: GLOBE.y + Math.sin(angle) * radius,
    color: ["#d8ffb0", "#7cff8a", "#fff7a8", "#ffffff"][i % 4],
  };
});
const DELAYS = [
  "",
  "[animation-delay:0.3s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.9s]",
] as const;

/** Wilting trees on a rotten patch: a dark trunk and a drooping crown. */
function WiltedTree({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      <rect x={x + 5} y={y + 4} width="1.5" height="6" fill={ROT_WOOD} />
      <rect x={x + 2} y={y + 3} width="8" height="2" fill="#6b5b3f" />
      <rect x={x + 1} y={y + 5} width="2" height="4" fill="#6b5b3f" />
      <rect x={x + 9} y={y + 5} width="2" height="3" fill="#6b5b3f" />
    </g>
  );
}

/** Bounds of a rect that covers the whole scene, however the phone crops it. */
const SCREEN = { x: -1200, y: -1200, width: 2800, height: 2700 } as const;

/**
 * A banner across the whole scene (not the globe): a dark band and big
 * outlined letters, sized to the scene's width so a phone reads it too.
 */
function Banner({
  text,
  fill,
  stroke,
  band,
}: {
  text: string;
  fill: string;
  stroke: string;
  band: string;
}) {
  return (
    <g className="gp-shout">
      <rect
        x={SCREEN.x}
        y={GLOBE.y - 34}
        width={SCREEN.width}
        height="68"
        fill={band}
        fillOpacity="0.88"
      />
      <text
        x="200"
        y={GLOBE.y + 17}
        textAnchor="middle"
        className="font-[family-name:var(--font-eo-pixel)]"
        fontSize="50"
        fill={fill}
        stroke={stroke}
        strokeWidth="7"
        paintOrder="stroke"
      >
        {text}
      </text>
    </g>
  );
}

/** The rot has just shown: the whole scene flashes brown-red and a banner slams in. */
function BlightAlarm() {
  return (
    <g aria-hidden="true" data-testid="eo-blight-alarm">
      <rect
        className="gp-flash"
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        fill="#8a2a0e"
      />
      <Banner text="BLIGHT!" fill="#ffd9a0" stroke="#2b0d05" band="#2b0d05" />
    </g>
  );
}

/** The world has healed: green waves roll out, sparkles rise, a big cheer. */
function HealedWave() {
  return (
    <g aria-hidden="true" data-testid="eo-healed">
      <rect
        className="gp-flash"
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        fill="#b8ff9a"
      />
      {DELAYS.slice(0, 3).map((delay, k) => (
        <circle
          key={k}
          className={`gv-wave ${delay}`}
          cx={GLOBE.x}
          cy={GLOBE.y}
          r={GLOBE.r}
          fill="none"
          stroke={k % 2 ? "#fff7a8" : "#7cff8a"}
          strokeWidth="7"
        />
      ))}
      {HEAL_SPARKS.map((p, i) => (
        <rect
          key={i}
          className={`gv-spark ${DELAYS[i % 4]}`}
          x={p.x}
          y={p.y}
          width="4"
          height="4"
          fill={p.color}
        />
      ))}
      <Banner text="HEALED!" fill="#9dff8a" stroke="#0b3b14" band="#0b3b14" />
    </g>
  );
}

/**
 * The green world: the camera has left the farms and pulled back to a globe.
 * It starts bare and tan, then turns green. The shares of each biome move
 * with the player's mix, so the whole globe re-colours as they shift. Water
 * is drawn too: rivers run full or shrink, wetlands glisten when wet, and a
 * dry land cracks and fades. A biome that covers too much rots, a grey-brown
 * creep with wilting trees, until the mix is spread out again and a green
 * wave rolls back. The old roads fade to meadow and the little towns turn
 * into woods, quietly, and nothing about that is ever counted or labelled.
 */
export default function WorldLayer({ info }: { info: GrowSceneInfo }) {
  const gone = useCardGone();
  const greened = Math.round(info.greenFraction * CELLS.length);
  const roads = Math.round(info.roadsLeft * ROADS.length);
  const towns = Math.round(info.townsLeft * TOWNS.length);
  const bare = info.dry ? LAND_DRY : LAND;
  const rot = rotOf(info);
  const isSick = BIOME_KEYS.some((b) => rot[b] >= 1);
  const water = info.worldWater;
  const parched = info.dry || water <= 2;
  const thickness = info.dry ? 1 : 1 + (water / 10) * 2.2;
  const riverColor = info.dry ? "#a8864a" : "#4aa3f0";
  const globeClass = `gw-globe ${gone ? "gw-pullback" : "gw-zoomed"}`;
  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#07102a" />
      {STAR_GROUPS.map((group, g) => (
        <g key={g} className={group || undefined}>
          {STARS.map((s, i) =>
            i % STAR_GROUPS.length === g ? (
              <rect
                key={i}
                x={s.x}
                y={s.y}
                width={s.big ? 2 : 1}
                height={s.big ? 2 : 1}
                fill="#dfe9ff"
                fillOpacity="0.8"
              />
            ) : null
          )}
        </g>
      ))}
      {/* A shooting star, now and then. */}
      <g className="gg-shoot" aria-hidden="true" fill="#fff8d6">
        <rect x="350" y="20" width="3" height="2" />
        <rect x="353" y="18" width="4" height="1" fillOpacity="0.6" />
        <rect x="357" y="16" width="5" height="1" fillOpacity="0.3" />
      </g>
      {/* A dead satellite tumbling past, its red light still blinking. */}
      <g className="gg-sat" aria-hidden="true">
        <rect x="0" y="34" width="6" height="4" fill="#868e96" />
        <rect x="-6" y="35" width="5" height="2" fill="#364fc7" />
        <rect x="7" y="35" width="5" height="2" fill="#364fc7" />
        <rect
          x="2"
          y="32"
          width="2"
          height="2"
          fill="#ff4d4d"
          className="lm-flicker"
        />
      </g>
      <defs>
        <clipPath id="gw-clip">
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} />
        </clipPath>
        <radialGradient id="gw-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0.45" stopColor="#6e1c08" stopOpacity="0" />
          <stop offset="1" stopColor="#6e1c08" stopOpacity="0.85" />
        </radialGradient>
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
        data-water={water}
        data-blight={isSick ? "yes" : "no"}
      >
        <circle
          cx={GLOBE.x}
          cy={GLOBE.y}
          r={GLOBE.r + 5}
          fill={info.ended ? "#a5d6a7" : "#7fb2ff"}
          fillOpacity={info.ended ? 0.5 : 0.18}
        />
        {isSick && (
          <circle
            className="gv-sick"
            data-testid="eo-blight-halo"
            cx={GLOBE.x}
            cy={GLOBE.y}
            r={GLOBE.r + 5}
            fill="none"
            stroke={ROT_GLOW}
            strokeWidth="9"
          />
        )}
        <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill={OCEAN} />
        <g clipPath="url(#gw-clip)">
          {CELLS.map((c, i) => {
            const green = c.rank * CELLS.length < greened;
            if (!green && !c.land) return null;
            const biome = biomeFor(c.pick, info);
            const isRotten = green && c.rot * 10 < rot[biome];
            const fill = !green
              ? bare
              : isRotten
                ? c.fleck
                  ? ROT_STAIN
                  : ROT
                : info.dry
                  ? DRY_FILL[biome]
                  : BIOME_FILL[biome];
            const glistens =
              green &&
              !isRotten &&
              biome === "wetland" &&
              !info.dry &&
              water >= 3;
            return (
              <g key={i}>
                <rect
                  className="gv-cell"
                  x={c.x}
                  y={c.y}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                />
                {green && !isRotten && c.fleck && (
                  <rect
                    x={c.x + 3}
                    y={c.y + 3}
                    width="4"
                    height="3"
                    fill={BIOME_FLECK[biome]}
                  />
                )}
                {isRotten && c.fleck && <WiltedTree x={c.x} y={c.y} />}
                {glistens && (
                  <rect
                    className={`gv-glisten ${DELAYS[c.shine]}`}
                    x={c.x + 2}
                    y={c.y + 4}
                    width="7"
                    height="2"
                    fill="#e8fbff"
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
                <g className={i % 2 ? "lm-brown" : "lm-twinkle-b"}>
                  <rect
                    x={x - 3}
                    y={y - 2}
                    width="2"
                    height="2"
                    fill="#ffe66d"
                  />
                  <rect
                    x={x + 4}
                    y={y - 3}
                    width="2"
                    height="2"
                    fill="#ffe66d"
                  />
                </g>
              </g>
            ) : (
              <g key={i}>
                <rect x={x - 5} y={y - 4} width="6" height="6" fill="#2e7d32" />
                <rect x={x + 2} y={y - 6} width="5" height="8" fill="#256d2b" />
              </g>
            );
          })}
          {isSick &&
            SPORES.map((p, i) => (
              <circle
                key={i}
                aria-hidden="true"
                className={`gv-spore ${DELAYS[i % 4]}`}
                cx={p.x}
                cy={p.y}
                r={4 + (i % 3)}
                fill={ROT_STAIN}
                fillOpacity="0.7"
              />
            ))}
          {parched && (
            <g
              aria-hidden="true"
              data-testid="eo-cracks"
              fill="none"
              stroke={CRACK}
              strokeWidth="1.3"
              strokeOpacity={info.dry ? 0.95 : 0.5}
            >
              {CRACKS.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          )}
          {Array.from({ length: info.rivers }, (_, i) => {
            const { x, y } = riverAt(i);
            const t = thickness;
            return (
              <g key={i} data-testid="eo-river">
                <rect
                  x={x}
                  y={y + (3 - t) / 2}
                  width="26"
                  height={t}
                  fill={riverColor}
                />
                <rect
                  x={x + 24 + (3 - t) / 2}
                  y={y}
                  width={t}
                  height="18"
                  fill={riverColor}
                />
                <rect
                  x={x + 24}
                  y={y + 16 + (3 - t) / 2}
                  width="22"
                  height={t}
                  fill={riverColor}
                />
              </g>
            );
          })}
          {info.rivers > 0 && !info.dry && water >= 2 && (
            <g className="gg-flow">
              {Array.from({ length: info.rivers }, (_, i) => {
                const { x, y } = riverAt(i);
                return (
                  <path
                    key={i}
                    d={`M${x} ${y + 1.5}h25.5v16h22`}
                    fill="none"
                    stroke="#d0ebff"
                    strokeWidth="1"
                    strokeDasharray="3 9"
                  />
                );
              })}
            </g>
          )}
          {info.dry && (
            <rect
              aria-hidden="true"
              x={GLOBE.x - GLOBE.r}
              y={GLOBE.y - GLOBE.r}
              width={GLOBE.r * 2}
              height={GLOBE.r * 2}
              fill={DUST}
              fillOpacity="0.16"
            />
          )}
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="url(#gw-shade)" />
        </g>
        {info.blightNew && <BlightAlarm />}
        {info.healed && <HealedWave />}
        {[0, 1].map((half) => (
          <g
            key={half}
            className={`gw-drift ${half ? "[animation-delay:-5s]" : ""}`}
          >
            {Array.from({ length: info.clouds }, (_, i) =>
              i % 2 === half ? <Cloud key={i} {...cloudAt(i)} /> : null
            )}
          </g>
        ))}
        {info.flocks > 0 && (
          <g className="gg-glide">
            {Array.from({ length: info.flocks }, (_, i) => (
              <Flock
                key={i}
                x={150 + ((i * 53) % 120)}
                y={52 + ((i * 37) % 60)}
              />
            ))}
          </g>
        )}
        {/* The moon goes round, and slips behind the globe. */}
        <g className="gg-moon" aria-hidden="true">
          <rect
            x={GLOBE.x - 5}
            y={GLOBE.y - 5}
            width="10"
            height="10"
            fill="#e9ecef"
          />
          <rect
            x={GLOBE.x - 3}
            y={GLOBE.y - 3}
            width="3"
            height="3"
            fill="#ced4da"
          />
          <rect
            x={GLOBE.x + 1}
            y={GLOBE.y + 1}
            width="2"
            height="2"
            fill="#ced4da"
          />
        </g>
      </g>
      {isSick && (
        <rect
          aria-hidden="true"
          data-testid="eo-blight-vignette"
          className="gv-vignette pointer-events-none"
          x={SCREEN.x}
          y={SCREEN.y}
          width={SCREEN.width}
          height={SCREEN.height}
          fill="url(#gw-vignette)"
        />
      )}
      <FarmBehind away={gone} />
      <WorldForkArt info={info} />
      <WorldProjectArt info={info} />
    </g>
  );
}
