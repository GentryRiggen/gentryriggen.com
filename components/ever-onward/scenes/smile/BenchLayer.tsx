import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { INK, Robot, SKIN, type Mood } from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

/** Where the robot's seat is, and the friend's, along the bench (centres). */
const SEAT_X = [62, 112, 162, 212, 262] as const;
const FRIEND_X = 312;
const SEAT_Y = 214;

/** Static classes for sliding along the bench (Tailwind needs whole names). */
const SLIDE = [
  "translate-x-0",
  "translate-x-[50px]",
  "translate-x-[100px]",
  "translate-x-[150px]",
  "translate-x-[200px]",
] as const;
const SLIDE_BASE =
  "transition-[translate] duration-[2500ms] ease-in-out motion-reduce:transition-none";
const FRIEND_SLIDE_BASE =
  "transition-[translate] duration-700 ease-out motion-reduce:transition-none";

/** The mark over their head: drawn small, then scaled so a phone can read it. */
const MARK_Y = SEAT_Y - 146;
const MARK_SCALE = 1.5;
const MARK_DX = 0;

const COAT = "#7d93b0";
const COAT_LIGHT = "#a3b6d0";
const COAT_DARK = "#5b6b82";

const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.25s]",
  "[animation-delay:0.5s]",
  "[animation-delay:0.75s]",
] as const;

/** Pixels the friend's upper body leans, by tell (toward you is left). */
const LEAN = [
  "translate-x-[7px] translate-y-[4px]",
  "translate-x-[2px]",
  "translate-x-0",
  "-translate-x-[8px]",
] as const;
const LEAN_BASE =
  "transition-[translate] duration-700 ease-out motion-reduce:transition-none";

/** Which way the pupils look: away from you, or at you. */
const GAZE = [5, 4, 1, 0] as const;

function Mouth({ mood, x, y }: { mood: Mood; x: number; y: number }) {
  if (mood === "grin")
    return <rect x={x - 8} y={y} width="16" height="6" fill={INK} />;
  if (mood === "smile")
    return (
      <g fill={INK}>
        <rect x={x - 8} y={y - 2} width="3" height="3" />
        <rect x={x - 5} y={y + 1} width="10" height="3" />
        <rect x={x + 5} y={y - 2} width="3" height="3" />
      </g>
    );
  if (mood === "flat")
    return <rect x={x - 6} y={y + 1} width="12" height="3" fill={INK} />;
  return (
    <g fill={INK}>
      <rect x={x - 6} y={y} width="12" height="3" />
      <rect x={x - 8} y={y + 3} width="3" height="3" />
      <rect x={x + 5} y={y + 3} width="3" height="3" />
    </g>
  );
}

/** A small mark over their head that echoes the body language. */
function TellMark({ tell, cx }: { tell: number; cx: number }) {
  return (
    <g
      transform={`translate(${cx + MARK_DX} ${MARK_Y}) scale(${MARK_SCALE}) translate(${-(cx + MARK_DX)} ${-MARK_Y})`}
    >
      <TellGlyph tell={tell} cx={cx + MARK_DX} y={MARK_Y} />
    </g>
  );
}

function TellGlyph({ tell, cx, y }: { tell: number; cx: number; y: number }) {
  if (tell === 3)
    return (
      <g
        aria-hidden="true"
        data-testid="eo-bench-tell-heart"
        className="ms-bob"
        fill="#ff7a90"
      >
        <rect x={cx - 14} y={y} width="8" height="8" />
        <rect x={cx - 2} y={y} width="8" height="8" />
        <rect x={cx - 14} y={y + 6} width="20" height="8" />
        <rect x={cx - 8} y={y + 14} width="8" height="6" />
      </g>
    );
  if (tell === 2)
    return (
      <g aria-hidden="true" fill="#fff6d6">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            className={`ms-t-pulse ${STAGGER[i]}`}
            x={cx - 16 + i * 12}
            y={y + 8}
            width="7"
            height="7"
          />
        ))}
      </g>
    );
  if (tell === 0)
    return (
      <g aria-hidden="true">
        <rect x={cx + 22} y={y + 14} width="6" height="10" fill="#7cc4ff" />
        <path
          d={`M${cx - 18} ${y + 14} l8 -8 l8 8 l8 -8 l8 8`}
          stroke="#aab3c2"
          strokeWidth="4"
          fill="none"
        />
      </g>
    );
  return null;
}

/**
 * The friend on the bench, big enough to read at a glance: arms folded and
 * shoulders up when they are not ready, arms down and leaning in when they are.
 */
function Friend({ tell, mood, cx }: { tell: number; mood: Mood; cx: number }) {
  const gaze = GAZE[tell];
  const tight = tell <= 1;
  const faceMood: Mood =
    tell === 0 && mood !== "frown"
      ? "flat"
      : tell === 3 && mood === "frown"
        ? "flat"
        : mood;
  return (
    <g
      data-testid="eo-bench-friend"
      data-tell={tell}
      className={`${LEAN_BASE} ${LEAN[tell]}`}
    >
      {/* Legs and the coat. */}
      <rect
        x={cx - 20}
        y={SEAT_Y - 22}
        width="14"
        height="22"
        fill={COAT_DARK}
      />
      <rect
        x={cx + 6}
        y={SEAT_Y - 22}
        width="14"
        height="22"
        fill={COAT_DARK}
      />
      <rect x={cx - 24} y={SEAT_Y - 66} width="48" height="48" fill={COAT} />
      {/* Shoulders: up around the ears when tense, low when relaxed. */}
      <rect
        x={cx - 26}
        y={SEAT_Y - (tight ? 72 : 64)}
        width="52"
        height={tight ? 14 : 8}
        fill={COAT_LIGHT}
      />
      {/* Arms: folded across the chest, loosening, then down at the sides. */}
      {tell <= 1 && (
        <g>
          <rect
            x={cx - 26}
            y={SEAT_Y - 50}
            width="52"
            height="12"
            fill={COAT_LIGHT}
          />
          <rect
            x={cx - 26}
            y={SEAT_Y - 38}
            width="52"
            height="3"
            fill={COAT_DARK}
          />
          <rect x={cx - 28} y={SEAT_Y - 50} width="8" height="12" fill={SKIN} />
        </g>
      )}
      {tell === 2 && (
        <g>
          <rect
            x={cx - 26}
            y={SEAT_Y - 50}
            width="26"
            height="12"
            fill={COAT_LIGHT}
          />
          <rect
            x={cx + 14}
            y={SEAT_Y - 58}
            width="12"
            height="40"
            fill={COAT_LIGHT}
          />
          <rect x={cx + 14} y={SEAT_Y - 20} width="12" height="6" fill={SKIN} />
        </g>
      )}
      {tell === 3 && (
        <g>
          <rect
            x={cx - 28}
            y={SEAT_Y - 58}
            width="12"
            height="40"
            fill={COAT_LIGHT}
          />
          <rect
            x={cx + 16}
            y={SEAT_Y - 58}
            width="12"
            height="40"
            fill={COAT_LIGHT}
          />
          <rect x={cx - 28} y={SEAT_Y - 20} width="12" height="6" fill={SKIN} />
          <rect x={cx + 16} y={SEAT_Y - 20} width="12" height="6" fill={SKIN} />
        </g>
      )}
      {/* The head. */}
      <g className={tell === 2 ? "ms-qb-glance" : undefined}>
        <rect x={cx - 20} y={SEAT_Y - 108} width="40" height="38" fill={SKIN} />
        <rect x={cx - 24} y={SEAT_Y - 104} width="48" height="30" fill={SKIN} />
        <rect
          x={cx - 22}
          y={SEAT_Y - 112}
          width="44"
          height="8"
          fill="#6b4a2f"
        />
        {[-12, 4].map((dx) => (
          <g key={dx}>
            <rect
              x={cx + dx}
              y={SEAT_Y - 94}
              width="9"
              height="9"
              fill="#fff"
            />
            <rect
              x={cx + dx + 4 - gaze}
              y={SEAT_Y - 92}
              width="5"
              height="6"
              fill={INK}
            />
          </g>
        ))}
        {tell <= 1 && (
          <g fill={INK}>
            <rect x={cx - 14} y={SEAT_Y - 99} width="12" height="3" />
            <rect x={cx + 3} y={SEAT_Y - 99} width="12" height="3" />
          </g>
        )}
        {tell === 3 && (
          <g fill="#ff9eb0">
            <rect x={cx - 20} y={SEAT_Y - 83} width="6" height="4" />
            <rect x={cx + 14} y={SEAT_Y - 83} width="6" height="4" />
          </g>
        )}
        <Mouth mood={faceMood} x={cx} y={SEAT_Y - 78} />
      </g>
      <TellMark tell={tell} cx={cx} />
    </g>
  );
}

function Bird() {
  return (
    <g
      aria-hidden="true"
      data-testid="eo-bench-bird"
      className="ms-qb-bird"
      transform="translate(332 184)"
    >
      <rect x="0" y="0" width="14" height="10" fill="#e07a5f" />
      <rect x="10" y="-4" width="8" height="8" fill="#e07a5f" />
      <rect x="18" y="-2" width="5" height="3" fill="#ffd23f" />
      <rect x="13" y="-2" width="2" height="2" fill={INK} />
      <rect x="-5" y="3" width="6" height="3" fill="#b85c45" />
      <rect x="3" y="2" width="7" height="4" fill="#f2cc8f" />
    </g>
  );
}

function Snack() {
  return (
    <g aria-hidden="true" data-testid="eo-bench-snack">
      <g className="ms-bob">
        <rect x="278" y="152" width="22" height="22" fill="#2b2140" />
        <rect x="280" y="154" width="18" height="18" fill="#e0a458" />
        <rect x="284" y="158" width="4" height="4" fill="#8a5a2b" />
        <rect x="291" y="164" width="4" height="4" fill="#8a5a2b" />
      </g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          className={`ms-t-pulse ${STAGGER[i]}`}
          x={270 + i * 14}
          y={142 - (i % 2) * 6}
          width="4"
          height="4"
          fill="#ffe29a"
        />
      ))}
    </g>
  );
}

/** Headlights and a rumble at the edge of the road, before the truck. */
function TruckWarning() {
  return (
    <g aria-hidden="true" data-testid="eo-bench-truck-warn">
      <g className="ms-qb-rumble">
        <rect x="-30" y="158" width="46" height="26" fill="#c0392b" />
        <rect x="16" y="150" width="22" height="34" fill="#a93226" />
        <rect x="32" y="156" width="10" height="12" fill="#9bd0ff" />
        <path
          d="M40 172 L130 150 L130 196 Z"
          fill="#fff4a8"
          fillOpacity="0.5"
        />
      </g>
      <g className="ms-t-pulse">
        <text
          x="40"
          y="140"
          fontSize="24"
          className="font-[family-name:var(--font-eo-pixel)]"
          fill="#ffd23f"
          stroke="#2b2140"
          strokeWidth="3"
          paintOrder="stroke"
        >
          !
        </text>
      </g>
    </g>
  );
}

function Truck() {
  return (
    <g aria-hidden="true" data-testid="eo-bench-truck">
      <g className="ms-qb-truck">
        <g className="ms-qb-rumble">
          <rect x="-110" y="146" width="96" height="40" fill="#e8ecf1" />
          <rect x="-110" y="146" width="96" height="6" fill="#c7d0dc" />
          <rect x="-14" y="156" width="40" height="30" fill="#c0392b" />
          <rect x="6" y="160" width="16" height="12" fill="#9bd0ff" />
          <rect x="-100" y="190" width="16" height="16" fill={INK} />
          <rect x="-50" y="190" width="16" height="16" fill={INK} />
          <rect x="4" y="190" width="16" height="16" fill={INK} />
          <rect x="-110" y="184" width="136" height="6" fill="#3d405b" />
        </g>
        <text
          x="-30"
          y="132"
          fontSize="20"
          className="font-[family-name:var(--font-eo-pixel)]"
          fill="#fff4cf"
          stroke="#2b2140"
          strokeWidth="3"
          paintOrder="stroke"
        >
          HONK!
        </text>
      </g>
    </g>
  );
}

/** A banner across the top of the strip, above both of them, so it reads at any size without covering anyone. */
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
    <g>
      <rect
        className="ms-qb-band"
        x="-1200"
        y="62"
        width="2800"
        height="30"
        fill={band}
      />
      <text
        x="200"
        y="87"
        textAnchor="middle"
        className="ms-t-shout font-[family-name:var(--font-eo-pixel)]"
        fontSize="26"
        fill={fill}
        stroke={stroke}
        strokeWidth="4"
        paintOrder="stroke"
      >
        {text}
      </text>
    </g>
  );
}

const RAINBOW = ["#ffd23f", "#ff9eb0", "#7bed9f", "#ffe29a"] as const;

/** A step that landed: warm glow, hearts, a shared smile and CLOSER. */
function Closer({ x }: { x: number }) {
  return (
    <g aria-hidden="true" data-testid="eo-bench-closer-moment">
      <rect
        className="ms-qb-wash"
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#ffd77a"
      />
      <circle
        className="ms-t-sun"
        cx={x}
        cy="170"
        r="70"
        fill="#fff3a0"
        fillOpacity="0.7"
      />
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          className={`ms-t-ring ${STAGGER[k]}`}
          cx={x}
          cy="170"
          r={12 + k * 5}
          fill="none"
          stroke={["#ffd23f", "#ff9eb0", "#7bed9f"][k]}
          strokeWidth="4"
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className={`ms-qb-rise ${STAGGER[i]}`} fill="#ff5d73">
          <rect x={x - 30 + i * 18} y="150" width="7" height="7" />
          <rect x={x - 21 + i * 18} y="150" width="7" height="7" />
          <rect x={x - 30 + i * 18} y="157" width="16" height="7" />
          <rect x={x - 25 + i * 18} y="164" width="6" height="6" />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, k) => (
        <rect
          key={k}
          className={`ms-t-spark ms-t-spark-${k}`}
          x={x - 5}
          y="166"
          width="10"
          height="10"
          fill={RAINBOW[k % RAINBOW.length]}
        />
      ))}
      <Banner text="CLOSER" fill="#fff3a0" stroke="#d9480f" band="#7a3b0c" />
    </g>
  );
}

/** A pull-away: a small cool wash and TOO SOON. Gentle, never harsh. */
function TooSoon({ isStayed }: { isStayed: boolean }) {
  return (
    <g
      aria-hidden="true"
      data-testid="eo-bench-toosoon-moment"
      data-why={isStayed ? "stayed" : "soon"}
    >
      <rect
        className="ms-qb-wash"
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill="#3b6ea8"
      />
      {[0, 1, 2, 3].map((k) => (
        <rect
          key={k}
          className={`ms-t-drop ${STAGGER[k]}`}
          x={120 + k * 36}
          y="120"
          width="4"
          height="10"
          fill="#9bd0ff"
        />
      ))}
      <Banner
        text={isStayed ? "TOO CLOSE" : "TOO SOON"}
        fill="#dbeafe"
        stroke="#1e3a8a"
        band="#1b2d5e"
      />
    </g>
  );
}

/** The road behind the bench: the truck, which drives past before the bench. */
export function BenchRoad({ info }: LayerProps) {
  return (
    <>
      {info.happening === "warn" && <TruckWarning />}
      {info.happening === "truck" && <Truck />}
    </>
  );
}

/**
 * The bench, drawn for a tiny strip: two big figures along a long bench, the
 * friend's body language, what is going on (a bird, a snack, a truck) and the
 * two big moments (CLOSER, TOO SOON).
 */
export default function BenchLayer({
  info,
  mood,
}: LayerProps & { mood: Mood }) {
  const robotSeat = info.scoot >= 0 ? info.scoot : info.seat;
  const robotX = SEAT_X[robotSeat];
  const gap = FRIEND_X - SEAT_X[info.seat];
  const glow = Math.max(0, 4 - gap / 50) / 4;
  return (
    <g
      data-testid="eo-bench-scene"
      data-seat={info.seat}
      data-tell={info.tell}
      data-away={info.away ? "yes" : "no"}
      data-happening={info.happening}
    >
      {/* Warmth between you grows as you sit closer. */}
      {glow > 0 && (
        <ellipse
          cx={(robotX + FRIEND_X) / 2}
          cy="176"
          rx={Math.max(30, (FRIEND_X - robotX) / 2 + 30)}
          ry="52"
          fill="#ffd77a"
          fillOpacity={0.1 + glow * 0.14}
        />
      )}
      <g
        className={`${FRIEND_SLIDE_BASE} ${info.away ? "translate-x-[38px]" : "translate-x-0"}`}
      >
        <g className={info.pullKey > 0 ? "ms-qb-shudder" : undefined}>
          <Friend tell={info.tell} mood={mood} cx={FRIEND_X} />
        </g>
      </g>
      <g
        className={`${SLIDE_BASE} ${SLIDE[robotSeat]}`}
        data-testid="eo-bench-robot"
        data-at={robotSeat}
      >
        <Robot x={SEAT_X[0] - 22} y={SEAT_Y - 28 * 2.2} scale={2.2} />
      </g>
      {info.happening === "bird" && <Bird />}
      {info.happening === "snack" && <Snack />}
      {info.landKey > 0 && (
        <Closer key={info.landKey} x={(robotX + FRIEND_X) / 2} />
      )}
      {info.pullKey > 0 && (
        <TooSoon key={info.pullKey} isStayed={info.pullStayed} />
      )}
    </g>
  );
}
