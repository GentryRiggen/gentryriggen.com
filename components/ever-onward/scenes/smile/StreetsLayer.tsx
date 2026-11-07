import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { pixelClass } from "../../game/retro/retroStyles";
import { BALLOON_COLORS, Face, INK, type Mood } from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

/** Each street has a hundred-wide strip of the picture. */
const ZONE = 100;
const SKIN_TONES = ["#ffd9a8", "#d9a066", "#8d5524"] as const;
const SCRAP = [
  "#ff5d73",
  "#ffd23f",
  "#4cc9f0",
  "#7bed9f",
  "#c77dff",
  "#ff9f43",
] as const;

/** Static delay classes (Tailwind only sees whole class names). */
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

const PRICE_WORDS = ["FREE", "CHEAP", "FAIR", "DEAR", "PRICEY"] as const;

/** Big shouted words: outlined so they read over anything. */
export function Shout({
  x,
  y,
  size = 14,
  fill,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  fill: string;
  children: string;
}) {
  return (
    <text
      x={Math.min(342, Math.max(58, x))}
      y={y}
      fill={fill}
      stroke={INK}
      strokeWidth={4}
      paintOrder="stroke"
      strokeLinejoin="round"
      fontSize={Math.max(10, size)}
      textAnchor="middle"
      className={pixelClass}
    >
      {children}
    </text>
  );
}

const parse = (digits: string, i: number): number =>
  Number(digits.split("")[i] ?? 0);
const crewOf = (crew: string, i: number): number =>
  Number(crew.split("-")[i] ?? 0);

/** What the day is doing: its kind and the street it is on (-1 for none). */
function dayOf(day: string): {
  kind: "" | "hot" | "rain" | "party";
  at: number;
} {
  if (day === "hot") return { kind: "hot", at: -1 };
  if (day.startsWith("rain")) return { kind: "rain", at: Number(day.slice(4)) };
  if (day.startsWith("party"))
    return { kind: "party", at: Number(day.slice(5)) };
  return { kind: "", at: -1 };
}

function Cloud({
  x,
  y,
  fill,
  shade,
}: {
  x: number;
  y: number;
  fill: string;
  shade: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="8" y="0" width="40" height="12" fill={fill} />
      <rect x="0" y="8" width="64" height="14" fill={fill} />
      <rect x="14" y="20" width="44" height="8" fill={shade} />
    </g>
  );
}

/** A street's mood, on a flag over its roofs. */
function MoodFlag({ cx, level }: { cx: number; level: number }) {
  const moods: Mood[] = ["frown", "flat", "smile", "grin"];
  const fills = ["#ff5d73", "#b8c0cc", "#ffe29a", "#ffd23f"];
  return (
    <g aria-hidden="true">
      <rect x={cx - 1} y="14" width="3" height="26" fill="#5b6b82" />
      <rect x={cx - 17} y="2" width="34" height="22" fill={INK} />
      <rect x={cx - 15} y="4" width="30" height="18" fill={fills[level]} />
      <Face x={cx - 8} y={6} size={16} mood={moods[level]} />
    </g>
  );
}

/** A grumpy street: a storm cloud, a bolt and "HMPH!". */
function Storm({ cx }: { cx: number }) {
  return (
    <g aria-hidden="true" data-testid="eo-street-storm">
      <g className="ms-mt-storm">
        <Cloud x={cx - 34} y={26} fill="#4b5563" shade="#374151" />
        <Cloud x={cx - 10} y={34} fill="#6b7280" shade="#4b5563" />
      </g>
      <g className="ms-mt-bolt" fill="#ffd23f">
        <rect x={cx - 4} y="56" width="8" height="8" />
        <rect x={cx - 8} y="64" width="8" height="8" />
        <rect x={cx - 2} y="72" width="8" height="8" />
        <rect x={cx - 6} y="80" width="6" height="10" />
      </g>
      <g className="ms-mt-hmph">
        <Shout x={cx} y={112} size={18} fill="#ff5d73">
          HMPH!
        </Shout>
      </g>
    </g>
  );
}

/** Three neighbours with their arms crossed. */
function Grumps({ cx }: { cx: number }) {
  return (
    <g aria-hidden="true">
      {[-26, 0, 26].map((dx, i) => (
        <g
          key={dx}
          transform={`translate(${cx + dx - 11} ${250 + (i % 2) * 6})`}
        >
          <rect x="3" y="20" width="16" height="16" fill="#7a5c8f" />
          <rect
            x="-1"
            y="25"
            width="24"
            height="5"
            fill="#a98bc0"
            transform="rotate(-18 11 27)"
          />
          <rect
            x="-1"
            y="27"
            width="24"
            height="5"
            fill="#c9b0dc"
            transform="rotate(18 11 29)"
          />
          <Face x={0} y={2} size={22} mood="frown" fill={SKIN_TONES[i % 3]} />
          <rect x="4" y="6" width="5" height="2" fill="#ff5d73" />
          <rect x="13" y="6" width="5" height="2" fill="#ff5d73" />
        </g>
      ))}
    </g>
  );
}

/** One float: a flatbed, a cab and a balloon on a pole. */
function Float({ x, y, tone }: { x: number; y: number; tone: number }) {
  const color = BALLOON_COLORS[tone % BALLOON_COLORS.length];
  return (
    <g transform={`translate(${x} ${y}) scale(1.3)`}>
      <rect x="10" y="-12" width="3" height="14" fill={INK} />
      <rect x="4" y="-24" width="15" height="13" fill={color} />
      <rect
        x="7"
        y="-21"
        width="4"
        height="3"
        fill="#ffffff"
        fillOpacity="0.7"
      />
      <rect x="0" y="2" width="30" height="12" fill={INK} />
      <rect x="2" y="4" width="26" height="8" fill="#ff9f43" />
      <rect x="18" y="-4" width="12" height="8" fill="#ff5d73" />
      <rect x="3" y="14" width="8" height="8" fill={INK} />
      <rect x="20" y="14" width="8" height="8" fill={INK} />
    </g>
  );
}

/** The floats on a street, and a float that has just arrived with confetti. */
function Route({ info, i }: { info: SmileSceneInfo; i: number }) {
  const count = crewOf(info.crew, i);
  const shown = Math.min(3, count);
  const x0 = i * ZONE;
  const level = parse(info.moods, i);
  const isArrival = info.arrived === i;
  return (
    <g aria-hidden="true" data-street={i} data-floats={count}>
      {Array.from({ length: shown }, (_, k) => (
        <g
          key={k}
          className={k % 2 ? "ms-mt-roll [animation-delay:0.5s]" : "ms-mt-roll"}
        >
          <Float x={x0 + 4 + k * 32} y={222 + (k % 2) * 4} tone={i * 2 + k} />
        </g>
      ))}
      {count > shown && (
        <Shout x={x0 + 50} y={254} size={11} fill="#ffffff">
          {`+${count - shown}`}
        </Shout>
      )}
      {count === 0 && level > 0 && (
        <Shout x={x0 + 50} y={232} size={10} fill="#ffffff">
          NO FLOAT
        </Shout>
      )}
      {level >= 2 && count > 0 && (
        <g>
          {[0, 1, 2].map((k) => (
            <rect
              key={k}
              x={x0 + 20 + k * 28}
              y="188"
              width="5"
              height="5"
              fill={SCRAP[(i + k) % SCRAP.length]}
              className={`ms-confetti ${STAGGER[k * 2]}`}
            />
          ))}
        </g>
      )}
      {isArrival && (
        <g data-testid="eo-street-confetti">
          {Array.from({ length: 12 }, (_, k) => (
            <rect
              key={k}
              x={x0 + 6 + k * 8}
              y={160 + (k % 3) * 10}
              width="6"
              height="6"
              fill={SCRAP[k % SCRAP.length]}
              className={`ms-mt-burst ${STAGGER[k % 10]}`}
            />
          ))}
          <g className="ms-mt-shout">
            <Shout x={x0 + 50} y={196} size={18} fill="#ffd23f">
              HOORAY!
            </Shout>
          </g>
        </g>
      )}
    </g>
  );
}

/** A float on the road to its street. */
function OnTheRoad({ to }: { to: number }) {
  return (
    <g aria-hidden="true" data-testid="eo-float-road">
      <g className="ms-mt-onroad">
        <Float x={to * ZONE + 36} y={206} tone={to + 3} />
      </g>
      {[0, 1, 2].map((k) => (
        <rect
          key={k}
          x={to * ZONE + 8 + k * 10}
          y="232"
          width="5"
          height="3"
          fill="#ffffff"
          fillOpacity="0.8"
          className={`ms-t-pulse ${STAGGER[k]}`}
        />
      ))}
    </g>
  );
}

/** Weather and parties: what the day is doing, big. */
function Day({ day }: { day: string }) {
  const { kind, at } = dayOf(day);
  if (kind === "hot")
    return (
      <g aria-hidden="true" data-testid="eo-day-hot">
        <g className="ms-mt-sun">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const a = (k * Math.PI) / 4;
            return (
              <rect
                key={k}
                x={46 + Math.cos(a) * 24 - 3}
                y={44 + Math.sin(a) * 24 - 3}
                width="7"
                height="7"
                fill="#ffb703"
              />
            );
          })}
        </g>
        <circle
          cx="46"
          cy="44"
          r="15"
          fill="#ffd23f"
          stroke={INK}
          strokeWidth="3"
        />
        <rect x="39" y="40" width="4" height="4" fill={INK} />
        <rect x="49" y="40" width="4" height="4" fill={INK} />
        <rect x="40" y="49" width="12" height="3" fill={INK} />
        <g className="ms-mt-shout">
          <Shout x={64} y={80} size={16} fill="#ff9f43">
            HOT DAY!
          </Shout>
        </g>
      </g>
    );
  if (kind === "rain") {
    const x0 = at * ZONE;
    return (
      <g aria-hidden="true" data-testid="eo-day-rain" data-at={at}>
        <g className="ms-mt-storm">
          <Cloud x={x0 + 18} y={8} fill="#8fa6c4" shade="#6d86a8" />
        </g>
        {Array.from({ length: 12 }, (_, k) => (
          <rect
            key={k}
            x={x0 + 8 + k * 7.5}
            y={44 + (k % 3) * 16}
            width="2"
            height="9"
            fill="#4cc9f0"
            className={`ms-mt-drops ${STAGGER[k % 10]}`}
          />
        ))}
        {[22, 62].map((dx, k) => (
          <g key={dx}>
            <rect
              x={x0 + dx}
              y="270"
              width="22"
              height="5"
              fill={SCRAP[k * 2]}
            />
            <rect
              x={x0 + dx + 3}
              y="266"
              width="16"
              height="4"
              fill={SCRAP[k * 2]}
            />
            <rect x={x0 + dx + 10} y="275" width="2" height="9" fill={INK} />
          </g>
        ))}
        <g className="ms-mt-shout">
          <Shout x={x0 + 50} y={150} size={18} fill="#4cc9f0">
            RAINY!
          </Shout>
        </g>
      </g>
    );
  }
  if (kind === "party") {
    const x0 = at * ZONE;
    return (
      <g aria-hidden="true" data-testid="eo-day-party" data-at={at}>
        <rect
          x={x0}
          y="168"
          width={ZONE}
          height="132"
          fill="#c77dff"
          className="ms-mt-disco"
        />
        <rect
          x={x0}
          y="168"
          width={ZONE}
          height="132"
          fill="#ffd23f"
          className="ms-mt-disco [animation-delay:0.3s]"
        />
        <rect x={x0 + 44} y="38" width="2" height="22" fill={INK} />
        <circle
          cx={x0 + 45}
          cy="66"
          r="9"
          fill="#e5e7eb"
          stroke={INK}
          strokeWidth="2"
        />
        <rect x={x0 + 41} y="62" width="4" height="4" fill="#4cc9f0" />
        <rect x={x0 + 46} y="67" width="4" height="4" fill="#ff5d73" />
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k} className={`ms-confetti-b ${STAGGER[k * 2]}`}>
            <rect
              x={x0 + 8 + k * 20}
              y="112"
              width="8"
              height="10"
              fill={BALLOON_COLORS[k % BALLOON_COLORS.length]}
            />
          </g>
        ))}
        <g className="ms-mt-shout">
          <Shout x={x0 + 50} y={150} size={18} fill="#ffd23f">
            PARTY!
          </Shout>
        </g>
      </g>
    );
  }
  return null;
}

/** The lemonade stand: an awning, a jug and a sign with the price. */
function Stand({ info }: LayerProps) {
  const word = PRICE_WORDS[Math.max(0, info.price)];
  return (
    <g aria-hidden="true" data-testid="eo-stand" data-price={info.price}>
      <rect x="150" y="246" width="100" height="40" fill="#8a5a2b" />
      <rect x="150" y="246" width="100" height="6" fill="#a9703a" />
      {Array.from({ length: 10 }, (_, k) => (
        <rect
          key={k}
          x={146 + k * 10}
          y="220"
          width="10"
          height="14"
          fill={k % 2 ? "#ffffff" : "#ff5d73"}
        />
      ))}
      <rect x="146" y="234" width="108" height="4" fill={INK} />
      <rect x="150" y="238" width="4" height="10" fill="#5b3a1a" />
      <rect x="246" y="238" width="4" height="10" fill="#5b3a1a" />
      <rect
        x="164"
        y="232"
        width="16"
        height="22"
        fill="#ffe66d"
        stroke={INK}
        strokeWidth="2"
      />
      <rect
        x="168"
        y="236"
        width="8"
        height="5"
        fill="#ffffff"
        fillOpacity="0.7"
      />
      <rect
        x="220"
        y="238"
        width="10"
        height="14"
        fill="#ffe66d"
        stroke={INK}
        strokeWidth="2"
      />
      <rect x="187" y="206" width="2" height="14" fill={INK} />
      <rect x="211" y="206" width="2" height="14" fill={INK} />
      <rect x="168" y="194" width="64" height="18" fill={INK} />
      <rect
        x="171"
        y="197"
        width="58"
        height="12"
        fill={
          info.painting ? "#d6c9a0" : info.price === 0 ? "#7bed9f" : "#ffe29a"
        }
      />
      <text
        x="200"
        y="207"
        fill={INK}
        fontSize="10"
        textAnchor="middle"
        className={pixelClass}
      >
        {info.painting ? "..." : word}
      </text>
      {info.painting && (
        <g className="ms-t-pulse">
          <rect x="226" y="200" width="14" height="4" fill="#ff5d73" />
          <rect x="238" y="198" width="3" height="10" fill="#8a5a2b" />
          <rect x="228" y="212" width="3" height="8" fill="#ff5d73" />
        </g>
      )}
    </g>
  );
}

/** The crowd around the stand. A low price fills the street. */
function Crowd({ info }: LayerProps) {
  const n = Math.max(1, Math.min(10, info.crowd));
  const rush = info.price <= 1 && !info.painting && n >= 6;
  const mood: Mood = info.painting
    ? "flat"
    : info.price >= 3
      ? "smile"
      : rush
        ? "grin"
        : "smile";
  return (
    <g aria-hidden="true" data-testid="eo-stand-crowd" data-crowd={n}>
      {Array.from({ length: n }, (_, k) => {
        const left = k % 2 === 0;
        const slot = Math.floor(k / 2);
        const x = left ? 134 - slot * 24 : 256 + slot * 24;
        const cls = rush ? (left ? "ms-mt-rush-l" : "ms-mt-rush-r") : "";
        return (
          <g key={k} className={`${cls} ${rush ? STAGGER[k % 10] : ""}`}>
            <Face
              x={x}
              y={268 - (k % 3) * 4}
              size={16}
              mood={mood}
              fill={SKIN_TONES[k % 3]}
            />
            <rect
              x={x + 2}
              y={284 - (k % 3) * 4}
              width="12"
              height="10"
              fill={SCRAP[k % SCRAP.length]}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Free or cheap: the whole town surges to the stand. */
function Rush({ info }: LayerProps) {
  if (info.price > 1 || info.painting || info.crowd < 6) return null;
  return (
    <g aria-hidden="true" data-testid="eo-stand-rush">
      <g className="ms-mt-shout">
        <Shout x={200} y={182} size={20} fill="#7bed9f">
          RUSH!
        </Shout>
      </g>
      {[0, 1, 2].map((k) => (
        <rect
          key={k}
          x={176 + k * 24}
          y="262"
          width="8"
          height="8"
          fill="#ff5d73"
          className={`ms-t-heart ${STAGGER[k * 3]}`}
        />
      ))}
    </g>
  );
}

/** Pricey: coins rain down from the sign. */
function Coins({ info }: LayerProps) {
  if (info.price < 3 || info.painting) return null;
  const n = info.price === 3 ? 6 : 10;
  return (
    <g aria-hidden="true" data-testid="eo-coin-shower">
      {Array.from({ length: n }, (_, k) => (
        <g key={k} className={`ms-mt-coin ${STAGGER[k % 10]}`}>
          <rect x={160 + k * 8} y="214" width="8" height="8" fill="#ffd23f" />
          <rect x={162 + k * 8} y="216" width="4" height="4" fill="#ffb703" />
        </g>
      ))}
      <g className="ms-mt-shout">
        <Shout x={200} y={182} size={18} fill="#ffd23f">
          CHA-CHING!
        </Shout>
      </g>
    </g>
  );
}

/** The Town's two dials, drawn: the stand, the floats on four streets, the day. */
export default function StreetsLayer({ info }: LayerProps) {
  if (info.price < 0) return null;
  return (
    <g data-testid="eo-town-dials" data-day={info.day} data-crew={info.crew}>
      <Day day={info.day} />
      {[0, 1, 2, 3].map((i) => {
        const level = parse(info.moods, i);
        return (
          <g key={i}>
            <MoodFlag cx={i * ZONE + 50} level={level} />
            {level === 0 && <Storm cx={i * ZONE + 50} />}
            <Route info={info} i={i} />
            {level === 0 && <Grumps cx={i * ZONE + 50} />}
          </g>
        );
      })}
      {info.moving >= 0 && <OnTheRoad to={info.moving} />}
      <Stand info={info} />
      <Crowd info={info} />
      <Rush info={info} />
      <Coins info={info} />
      {info.grumped >= 0 && (
        <g aria-hidden="true" data-testid="eo-street-grumped">
          <g className="ms-mt-shout">
            <Shout x={info.grumped * ZONE + 50} y={90} size={18} fill="#ff5d73">
              GRUMPY!
            </Shout>
          </g>
        </g>
      )}
    </g>
  );
}
