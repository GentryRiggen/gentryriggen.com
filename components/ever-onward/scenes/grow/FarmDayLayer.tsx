import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { FieldCrop } from "@/lib/ever-onward/universes/grow/market";

/**
 * Harvest day in the farm picture. As the day comes close a cart rolls in
 * from the left towards the barn and the town's people gather at the gate.
 * Then:
 *  - a crop the towns wanted: the crowd jumps, rings and coins burst out of
 *    the cart, confetti falls and "SOLD!" shouts;
 *  - a crop they did not want today: the crowd droops under a grey rain
 *    cloud and the produce in the cart sags;
 *  - beans: the fields darken and green sparkles rise from the rich soil;
 *  - an empty field: the cart leaves with nothing and a tumbleweed rolls by.
 */

/** Where the parked cart's left edge is, and the ground line it rolls on. */
const CART_END = 26;
const BASE_Y = 148;
/** The middle of the parked cart: the bursts come from here. */
const CX = CART_END + 20;
const TEXT_X = 200;
const TEXT_Y = 46;

const CROP_COLOR: Record<FieldCrop, string> = {
  tomato: "#e03131",
  corn: "#f5d33d",
  pumpkin: "#f08a24",
  beans: "#4c9a2a",
};

const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.1s]",
  "[animation-delay:0.2s]",
  "[animation-delay:0.3s]",
  "[animation-delay:0.4s]",
  "[animation-delay:0.5s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.7s]",
  "[animation-delay:0.8s]",
  "[animation-delay:0.9s]",
  "[animation-delay:1s]",
  "[animation-delay:1.1s]",
  "[animation-delay:1.2s]",
  "[animation-delay:1.3s]",
] as const;

const CONFETTI = [
  "#ff6b6b",
  "#ffd43b",
  "#69db7c",
  "#4dabf7",
  "#da77f2",
  "#ffa94d",
] as const;

const SHIRTS = [
  "#3b82f6",
  "#e03131",
  "#f59f00",
  "#9c36b5",
  "#2f9e44",
  "#0ca678",
] as const;

/** The cart, loaded with `crop` produce (`load`: 0 empty, 1 sagging, 2 heaped). */
function Cart({ crop, load }: { crop: FieldCrop; load: 0 | 1 | 2 }) {
  const color = CROP_COLOR[crop];
  return (
    <g data-testid="eo-cart">
      {/* the little donkey that pulls it */}
      <rect x="40" y="-14" width="16" height="9" fill="#8d6e63" />
      <rect x="52" y="-19" width="8" height="8" fill="#8d6e63" />
      <rect x="54" y="-24" width="2" height="6" fill="#6d4c41" />
      <rect x="58" y="-24" width="2" height="6" fill="#6d4c41" />
      <rect x="59" y="-16" width="3" height="3" fill="#d7ccc8" />
      <rect x="41" y="-6" width="3" height="7" fill="#6d4c41" />
      <rect x="52" y="-6" width="3" height="7" fill="#6d4c41" />
      <rect x="28" y="-9" width="14" height="2" fill="#6b4423" />
      {/* the cart */}
      <rect x="0" y="-18" width="30" height="13" fill="#9c6b30" />
      <rect x="0" y="-18" width="30" height="3" fill="#b78545" />
      <rect x="0" y="-11" width="30" height="1.5" fill="#6b4423" />
      {load > 0 && (
        <g>
          {[0, 1, 2, 3, 4].map((p) => (
            <rect
              key={p}
              x={2 + p * 5.5}
              y={-24 - (load === 2 ? (p % 2) * 4 : -3) + (load === 2 ? 0 : 4)}
              width="6"
              height="7"
              fill={color}
              fillOpacity={load === 2 ? 1 : 0.65}
            />
          ))}
        </g>
      )}
      {[7, 23].map((x) => (
        <g key={x}>
          <circle cx={x} cy="-2" r="5" fill="#3b2a1a" />
          <circle cx={x} cy="-2" r="1.8" fill="#c9a56a" />
        </g>
      ))}
    </g>
  );
}

function Person({
  i,
  x,
  mood,
}: {
  i: number;
  x: number;
  mood: "idle" | "cheer" | "droop";
}) {
  const shirt = SHIRTS[i % SHIRTS.length];
  const cls =
    mood === "cheer"
      ? `gf-jump ${STAGGER[i * 2]}`
      : mood === "droop"
        ? "gf-slump"
        : i % 2
          ? "gg-hop"
          : "gg-hop-b";
  return (
    <g transform={`translate(${x} 0) scale(1.4) translate(${-x} 0)`}>
      <g className={cls}>
        <rect x={x} y="-13" width="6" height="6" fill="#e8c27a" />
        <rect x={x - 0.5} y="-15" width="7" height="3" fill={shirt} />
        <rect x={x - 1} y="-7" width="8" height="8" fill={shirt} />
        <rect x={x} y="1" width="2.5" height="4" fill="#3b3b4a" />
        <rect x={x + 3.5} y="1" width="2.5" height="4" fill="#3b3b4a" />
        {mood === "cheer" && (
          <g fill="#e8c27a">
            <rect x={x - 3} y="-14" width="2.5" height="8" />
            <rect x={x + 6.5} y="-14" width="2.5" height="8" />
          </g>
        )}
        {mood === "droop" && (
          <rect x={x + 1.5} y="-9" width="3" height="1.2" fill="#3b3b4a" />
        )}
      </g>
    </g>
  );
}

/** Gold coins, rings and confetti: the crop was wanted. */
function Cheer() {
  return (
    <g aria-hidden="true" data-testid="eo-day-cheer">
      <rect
        className="gp-flash"
        x="-10"
        y="60"
        width="420"
        height="240"
        fill="#ffe66d"
      />
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          className={`gp-ring ${STAGGER[k * 3]}`}
          cx={CX}
          cy={BASE_Y - 16}
          r={14 + k * 8}
          fill="none"
          stroke={k % 2 ? "#fff3bf" : "#ffd43b"}
          strokeWidth="3"
        />
      ))}
      {Array.from({ length: 14 }, (_, k) => (
        <g key={k} className={`gf-coin gf-coin-${k}`}>
          <circle cx={CX} cy={BASE_Y - 26} r="7" fill="#b8860b" />
          <circle cx={CX} cy={BASE_Y - 26} r="5.6" fill="#ffd43b" />
          <rect
            x={CX - 2}
            y={BASE_Y - 30}
            width="2.4"
            height="7"
            fill="#fff3bf"
          />
        </g>
      ))}
      {Array.from({ length: 26 }, (_, k) => (
        <rect
          key={k}
          className={`gf-confetti ${STAGGER[k]}`}
          x={20 + k * 14}
          y={58 + (k % 3) * 10}
          width="6"
          height="9"
          fill={CONFETTI[k % CONFETTI.length]}
        />
      ))}
      <text
        x={TEXT_X}
        y={TEXT_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="17"
        fill="#fff3bf"
        stroke="#7c4a03"
        strokeWidth="4"
        paintOrder="stroke"
      >
        SOLD! CHEERS!
      </text>
    </g>
  );
}

/** A big grey cloud, heavy rain and a slump: the towns wanted something else. */
function Droop() {
  return (
    <g aria-hidden="true" data-testid="eo-day-droop">
      <rect
        className="gp-flash"
        x="-10"
        y="60"
        width="420"
        height="240"
        fill="#495057"
      />
      <g className="gp-poof [animation-duration:1.6s]">
        <circle cx="200" cy="104" r="30" fill="#5c6370" />
        <circle cx="150" cy="112" r="22" fill="#6b7280" />
        <circle cx="250" cy="112" r="24" fill="#6b7280" />
        <circle cx="300" cy="118" r="18" fill="#7b8494" />
        <circle cx="105" cy="120" r="16" fill="#7b8494" />
      </g>
      <g fill="#74c0fc">
        {Array.from({ length: 22 }, (_, k) => (
          <rect
            key={k}
            className={`gf-rain ${STAGGER[k % STAGGER.length]}`}
            x={96 + k * 10}
            y={124 + (k % 4) * 6}
            width="2"
            height="8"
          />
        ))}
      </g>
      <g className="gf-rain">
        <rect x={CX - 6} y={BASE_Y - 36} width="2" height="6" fill="#74c0fc" />
        <rect x={CX + 10} y={BASE_Y - 34} width="2" height="6" fill="#74c0fc" />
      </g>
      <text
        x={TEXT_X}
        y={TEXT_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="14"
        fill="#ced4da"
        stroke="#212529"
        strokeWidth="4"
        paintOrder="stroke"
      >
        NOT WANTED TODAY...
      </text>
    </g>
  );
}

/** Rich dark soil and rising green sparkles: beans rested the field. */
function Beans() {
  return (
    <g aria-hidden="true" data-testid="eo-day-beans">
      <rect
        className="gf-richen"
        x="20"
        y="146"
        width="355"
        height="92"
        fill="#2a1a0c"
      />
      {Array.from({ length: 12 }, (_, k) => (
        <rect
          key={k}
          className={`gf-sparkle-up ${STAGGER[k]}`}
          x={30 + k * 29}
          y={190 - (k % 3) * 18}
          width="3"
          height="3"
          fill={k % 2 ? "#b2f2bb" : "#69db7c"}
        />
      ))}
      <text
        x={TEXT_X}
        y={TEXT_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="15"
        fill="#d8f5a2"
        stroke="#1b4d1b"
        strokeWidth="4"
        paintOrder="stroke"
      >
        BEANS! RICH SOIL!
      </text>
    </g>
  );
}

/** The cart leaves with nothing and a tumbleweed rolls past. */
function Empty() {
  return (
    <g aria-hidden="true" data-testid="eo-day-empty">
      <g className="gf-tumble">
        <circle cx="0" cy="136" r="6" fill="#b08a58" />
        <circle cx="0" cy="136" r="3.5" fill="none" stroke="#7a5530" />
        <rect x="-6" y="135" width="12" height="1.5" fill="#7a5530" />
      </g>
      <text
        x={TEXT_X}
        y={TEXT_Y}
        textAnchor="middle"
        className="gp-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="19"
        fill="#e9d6a4"
        stroke="#5c4a1a"
        strokeWidth="4"
        paintOrder="stroke"
      >
        EMPTY CART!
      </text>
    </g>
  );
}

export default function FarmDayLayer({ info }: { info: GrowSceneInfo }) {
  const mood = info.dayMood;
  const showing = mood !== "";
  // Between days the cart waits off to the left; it rolls in as the day nears.
  const cart = showing ? 4 : info.cart;
  const people = showing ? 6 : cart >= 4 ? 6 : cart === 3 ? 3 : 0;
  const personMood =
    mood === "cheer" ? "cheer" : mood === "droop" ? "droop" : "idle";
  const load: 0 | 1 | 2 =
    mood === "cheer" || mood === "beans" ? 2 : mood === "droop" ? 1 : 0;
  return (
    <g data-testid="eo-farm-day" data-cart={cart} data-mood={mood}>
      <g transform={`translate(0 ${BASE_Y})`}>
        <g className={`gf-cart gf-cart-${cart}`}>
          <g transform="scale(1.4)">
            <Cart crop={info.crop} load={load} />
          </g>
        </g>
      </g>
      <g transform={`translate(0 ${BASE_Y})`}>
        {Array.from({ length: people }, (_, i) => (
          <Person key={i} i={i} x={124 + i * 12} mood={personMood} />
        ))}
      </g>
      {mood === "cheer" && <Cheer key={`cheer-${info.dayN}`} />}
      {mood === "droop" && <Droop key={`droop-${info.dayN}`} />}
      {mood === "beans" && <Beans key={`beans-${info.dayN}`} />}
      {mood === "empty" && <Empty key={`empty-${info.dayN}`} />}
    </g>
  );
}
