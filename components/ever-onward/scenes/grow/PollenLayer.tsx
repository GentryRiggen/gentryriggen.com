import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { Season } from "@/lib/ever-onward/universes/grow/seasons";
import { BED_H, BED_W, bedAt } from "./anchors";

/**
 * The backyard's flower beds (pollination), drawn in the second row of beds:
 * clover, sunflowers, lavender and the apple tree. The bees you send circle
 * their bed, a tired bed droops and browns, a wilt goes off in a puff of dead
 * petals, two neighbours crossing burst into a rainbow flower, and in a hungry
 * winter the bees stream away over the fence.
 */

interface BedState {
  planted: boolean;
  bees: number;
  /** 0 to 10. */
  bloom: number;
  wilting: boolean;
}

function parseBeds(flat: string): BedState[] {
  if (!flat) return [];
  return flat.split("|").map((group) => {
    const [planted, bees, bloom, wilting] = group.split(":").map(Number);
    return {
      planted: planted === 1,
      bees,
      bloom,
      wilting: wilting === 1,
    };
  });
}

/** Where flower bed `i` sits: the second row's slots. */
const slot = (i: number) => bedAt(4 + i);
const centerOf = (i: number) => {
  const { x, y } = slot(i);
  return { x: x + BED_W / 2, y };
};

const STEM = "#3f9d3a";
const STEM_TIRED = "#9a8a3a";
const STEM_DEAD = "#7a5a2a";

const stemFor = (bloom: number) =>
  bloom <= 2 ? STEM_DEAD : bloom <= 4 ? STEM_TIRED : STEM;

const ORBITS = ["gp-orbit-a", "gp-orbit-b", "gp-orbit-c"] as const;

/** Static delay classes (Tailwind only sees whole class names). */
const DELAYS = [
  "[animation-delay:0s]",
  "[animation-delay:-0.7s]",
  "[animation-delay:-1.4s]",
  "[animation-delay:-2.1s]",
  "[animation-delay:-2.8s]",
  "[animation-delay:-3.5s]",
] as const;
const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.15s]",
  "[animation-delay:0.3s]",
  "[animation-delay:0.45s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.75s]",
  "[animation-delay:0.9s]",
  "[animation-delay:1.05s]",
  "[animation-delay:1.2s]",
  "[animation-delay:1.35s]",
] as const;

function Bee({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 1} y={y - 1} width="9" height="7" fill="#2b1d0a" />
      <rect x={x} y={y} width="7" height="5" fill="#ffd43b" />
      <rect x={x + 2} y={y} width="1.5" height="5" fill="#2b1d0a" />
      <rect x={x + 4.5} y={y} width="1.5" height="5" fill="#2b1d0a" />
      <rect
        className="gg-flap"
        x={x + 1}
        y={y - 4}
        width="5"
        height="3"
        fill="#e7f5ff"
        fillOpacity="0.95"
      />
    </g>
  );
}

/** Flower beds are drawn a size up, grown from the middle of their soil. */
const BED_SCALE = 1.3;

function Clover({ x, y, bloom }: { x: number; y: number; bloom: number }) {
  const h = 3 + Math.round(bloom * 0.6);
  const stem = stemFor(bloom);
  return (
    <g>
      {[0, 1, 2, 3, 4, 5].map((p) => {
        const px = x + 4 + p * 10;
        return (
          <g key={p}>
            <rect x={px + 2} y={y - h} width="2" height={h} fill={stem} />
            <rect x={px} y={y - h + 1} width="3" height="3" fill={stem} />
            <rect x={px + 3} y={y - h + 1} width="3" height="3" fill={stem} />
            {bloom >= 4 && (
              <rect
                x={px + 1}
                y={y - h - 3}
                width="4"
                height="4"
                fill={p % 2 ? "#ffffff" : "#ffc9de"}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Sunflowers({ x, y, bloom }: { x: number; y: number; bloom: number }) {
  const h = 6 + Math.round(bloom * 1.6);
  const droop = bloom <= 4;
  const stem = stemFor(bloom);
  return (
    <g>
      {[0, 1, 2, 3].map((p) => {
        const px = x + 7 + p * 15;
        const hx = droop ? px + 3 : px - 3;
        const hy = y - h - (droop ? -2 : 6);
        return (
          <g key={p}>
            <rect x={px} y={y - h} width="2" height={h} fill={stem} />
            <rect x={px - 4} y={y - h / 2} width="4" height="2" fill={stem} />
            <rect
              x={hx}
              y={hy}
              width="8"
              height="8"
              fill={bloom <= 2 ? "#8a6a2a" : droop ? "#e0a020" : "#ffd43b"}
            />
            <rect x={hx + 2} y={hy + 2} width="4" height="4" fill="#5a3a12" />
          </g>
        );
      })}
    </g>
  );
}

function Lavender({ x, y, bloom }: { x: number; y: number; bloom: number }) {
  const h = 5 + Math.round(bloom);
  const stem = stemFor(bloom);
  const flower = bloom <= 2 ? "#8a7a8a" : bloom <= 4 ? "#a58ac0" : "#9b59d0";
  return (
    <g>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((p) => {
        const px = x + 4 + p * 7.5;
        return (
          <g key={p}>
            <rect x={px} y={y - h} width="1.5" height={h} fill={stem} />
            <rect
              x={px - 1}
              y={y - h - 5}
              width="3.5"
              height="6"
              fill={flower}
            />
          </g>
        );
      })}
    </g>
  );
}

function AppleTree({
  x,
  y,
  bloom,
  season,
}: {
  x: number;
  y: number;
  bloom: number;
  season: Season;
}) {
  const leaf =
    bloom <= 2 ? "#8a7a3a" : season === "autumn" ? "#c27c1a" : "#2f8a2a";
  return (
    <g>
      <rect x={x + 28} y={y - 16} width="5" height="16" fill="#6b4423" />
      <rect x={x + 14} y={y - 30} width="34" height="16" fill={leaf} />
      <rect x={x + 18} y={y - 36} width="26" height="7" fill={leaf} />
      {season === "autumn" && bloom > 2
        ? [0, 1, 2, 3, 4, 5].map((p) => (
            <rect
              key={p}
              x={x + 17 + ((p * 11) % 28)}
              y={y - 28 + ((p * 7) % 12)}
              width="4"
              height="4"
              fill="#e03131"
            />
          ))
        : season === "spring" && bloom > 4
          ? [0, 1, 2, 3, 4].map((p) => (
              <rect
                key={p}
                x={x + 18 + ((p * 9) % 26)}
                y={y - 34 + ((p * 5) % 14)}
                width="3"
                height="3"
                fill="#ffc9de"
              />
            ))
          : null}
    </g>
  );
}

function FlowerBed({
  i,
  bed,
  season,
}: {
  i: number;
  bed: BedState;
  season: Season;
}) {
  const { x, y } = slot(i);
  const isWinter = season === "winter";
  const bloom = isWinter ? Math.min(bed.bloom, 3) : bed.bloom;
  const Kind = [Clover, Sunflowers, Lavender][i];
  const cx = x + BED_W / 2;
  const by = y + BED_H;
  return (
    <g
      data-testid={`eo-flower-bed-${i}`}
      data-bloom={bed.bloom}
      transform={`translate(${cx} ${by}) scale(${BED_SCALE}) translate(${-cx} ${-by})`}
    >
      <rect x={x} y={y} width={BED_W} height={BED_H} fill="#4a2f18" />
      <rect x={x} y={y} width={BED_W} height="3" fill="#8b5e34" />
      {bed.planted ? (
        <g className={bed.bloom <= 2 && !isWinter ? "gp-shiver" : "gg-sway"}>
          {Kind ? (
            <Kind x={x} y={y} bloom={bloom} />
          ) : (
            <AppleTree x={x} y={y} bloom={bloom} season={season} />
          )}
        </g>
      ) : (
        !bed.wilting && (
          // An empty bed: a seed packet on a stick, waiting to be planted.
          <g>
            <rect x={x + 29} y={y - 12} width="2" height="12" fill="#8b5e34" />
            <rect x={x + 24} y={y - 20} width="12" height="10" fill="#f8f4e8" />
            <rect x={x + 27} y={y - 17} width="6" height="4" fill="#ffd43b" />
          </g>
        )
      )}
      {isWinter && bed.planted && (
        <rect x={x} y={y - 2} width={BED_W} height="3" fill="#ffffff" />
      )}
      {/* A tired bed shows it: a red warning drip above it. */}
      {bed.planted && !isWinter && bed.bloom <= 3 && bed.bees > 0 && (
        <g className="gp-blink" fill="#ff6b6b">
          <rect x={x + BED_W - 8} y={y - 30} width="3" height="7" />
          <rect x={x + BED_W - 8} y={y - 21} width="3" height="3" />
        </g>
      )}
      {!isWinter &&
        Array.from({ length: bed.bees }, (_, b) => (
          <g
            key={b}
            className={`${ORBITS[b % ORBITS.length]} ${DELAYS[b % DELAYS.length]}`}
          >
            <Bee x={x + 6 + ((b * 11) % 46)} y={y - 9 - ((b * 7) % 10)} />
          </g>
        ))}
      {bed.wilting && <Wilt i={i} />}
    </g>
  );
}

/** A bed collapsing: dead stalks, a red flash, a puff of dust, petals. */
function Wilt({ i }: { i: number }) {
  const { x: left, y: top } = slot(i);
  const { x, y } = centerOf(i);
  return (
    <g aria-hidden="true" data-testid={`eo-wilt-${i}`}>
      <rect
        className="gp-flash"
        x={left - 4}
        y={top - 28}
        width={BED_W + 8}
        height={BED_H + 30}
        fill="#ff6b6b"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((p) => (
        <g key={p}>
          <rect
            x={left + 4 + p * 8.5}
            y={top - 6}
            width="2"
            height="6"
            fill={STEM_DEAD}
          />
          <rect
            x={left + 4 + p * 8.5 + (p % 2 ? 2 : -4)}
            y={top - 7}
            width="4"
            height="2"
            fill={STEM_DEAD}
          />
        </g>
      ))}
      <g className="gp-poof">
        <circle cx={x} cy={y - 10} r="18" fill="#9a8a6a" fillOpacity="0.8" />
        <circle
          cx={x - 14}
          cy={y - 4}
          r="11"
          fill="#b8a888"
          fillOpacity="0.8"
        />
        <circle
          cx={x + 15}
          cy={y - 5}
          r="12"
          fill="#b8a888"
          fillOpacity="0.8"
        />
      </g>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((p) => (
        <rect
          key={p}
          className={`gp-fall ${STAGGER[p]}`}
          x={x - 26 + p * 7}
          y={y - 34}
          width="3"
          height="3"
          fill={p % 2 ? "#8a5a2a" : "#c9a56a"}
        />
      ))}
      <text
        x={x}
        y={y - 38}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="10"
        fill="#ff6b6b"
        stroke="#2b1d0a"
        strokeWidth="3"
        paintOrder="stroke"
      >
        WILTED!
      </text>
    </g>
  );
}

const RAINBOW = [
  "#ff6b6b",
  "#ffa94d",
  "#ffd43b",
  "#69db7c",
  "#4dabf7",
  "#9775fa",
] as const;

/** Two beds crossing into a rare flower: a rainbow burst and a big bloom. */
function Cross({ pair }: { pair: number }) {
  const a = centerOf(pair);
  const b = centerOf(pair + 1);
  const x = (a.x + b.x) / 2;
  const y = a.y - 26;
  return (
    <g aria-hidden="true" data-testid="eo-rare-burst">
      {RAINBOW.map((color, k) => (
        <circle
          key={color}
          className={`gp-ring ${STAGGER[k]}`}
          cx={x}
          cy={y}
          r={10 + k * 4}
          fill="none"
          stroke={color}
          strokeWidth="3"
        />
      ))}
      {Array.from({ length: 12 }, (_, k) => {
        return (
          <rect
            key={k}
            className={`gp-spark gp-spark-${k}`}
            x={x - 2}
            y={y - 2}
            width="4"
            height="4"
            fill={RAINBOW[k % RAINBOW.length]}
          />
        );
      })}
      <g className="gp-pop">
        {RAINBOW.map((color, k) => {
          const angle = (k / RAINBOW.length) * Math.PI * 2;
          return (
            <rect
              key={color}
              x={x + Math.cos(angle) * 9 - 5}
              y={y + Math.sin(angle) * 9 - 5}
              width="10"
              height="10"
              fill={color}
            />
          );
        })}
        <rect x={x - 5} y={y - 5} width="10" height="10" fill="#fff9db" />
        <rect x={x - 1} y={y + 12} width="2" height="16" fill={STEM} />
      </g>
      <text
        x={x}
        y={y - 26}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="10"
        fill="#fff3bf"
        stroke="#5f3dc4"
        strokeWidth="2"
        paintOrder="stroke"
      >
        RARE FLOWER!
      </text>
    </g>
  );
}

/** Rare flowers grown so far: little glowing blooms along the path. */
function RareRow({ count }: { count: number }) {
  return (
    <g aria-hidden="true">
      {Array.from({ length: count }, (_, k) => {
        const x = 70 + k * 52;
        const y = 220;
        return (
          <g key={k} className="gp-glow">
            <circle
              cx={x}
              cy={y}
              r="6"
              fill={RAINBOW[k % 6]}
              fillOpacity="0.35"
            />
            <rect
              x={x - 3}
              y={y - 3}
              width="6"
              height="6"
              fill={RAINBOW[k % 6]}
            />
            <rect x={x - 1} y={y - 1} width="2" height="2" fill="#ffffff" />
          </g>
        );
      })}
    </g>
  );
}

/** Honey jars on a little stand at the row's left end. */
function HoneyJars({ count }: { count: number }) {
  return (
    <g aria-hidden="true" data-testid="eo-honey-jars" data-jars={count}>
      <rect x="10" y="212" width="40" height="3" fill="#8b5e34" />
      {Array.from({ length: count }, (_, k) => {
        const x = 12 + (k % 3) * 13;
        const y = k < 3 ? 202 : 190;
        return (
          <g key={k}>
            <rect x={x} y={y} width="10" height="10" fill="#f59f00" />
            <rect x={x + 1} y={y - 3} width="8" height="3" fill="#f8f4e8" />
            <rect x={x + 2} y={y + 3} width="2" height="4" fill="#ffe066" />
          </g>
        );
      })}
    </g>
  );
}

/** Hungry bees streaming away over the fence. */
function Leaving() {
  return (
    <g aria-hidden="true">
      {Array.from({ length: 10 }, (_, k) => (
        <g key={k} className={`gp-leave ${STAGGER[k]}`}>
          <Bee x={40 + k * 9} y={120 + (k % 3) * 6} />
        </g>
      ))}
      <text
        x="120"
        y="100"
        textAnchor="middle"
        className="gp-blink font-[family-name:var(--font-eo-pixel)]"
        fontSize="7"
        fill="#e7f5ff"
        stroke="#1c3d5a"
        strokeWidth="2"
        paintOrder="stroke"
      >
        NO HONEY! BEES LEAVING
      </text>
    </g>
  );
}

export default function PollenLayer({ info }: { info: GrowSceneInfo }) {
  const beds = parseBeds(info.flowerBeds);
  if (beds.length === 0) return null;
  return (
    <g data-testid="eo-pollen">
      <RareRow count={info.rare} />
      <HoneyJars count={info.honeyJars} />
      {beds.map((bed, i) => (
        <FlowerBed key={i} i={i} bed={bed} season={info.season} />
      ))}
      {info.crossPair >= 0 && (
        <Cross key={info.crossPair} pair={info.crossPair} />
      )}
      {info.leaving && <Leaving />}
    </g>
  );
}
