import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { FriendForkArt } from "./ForkArt";
import TogetherLayer from "./TogetherLayer";
import {
  BALLOON_COLORS,
  Balloon,
  Dog,
  Face,
  PixelText,
  Robot,
  Tail,
  type Mood,
} from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

const HOUSES: readonly (readonly [number, number, string, string])[] = [
  [14, 96, "#ffb3a7", "#d9776b"],
  [92, 84, "#ffe29a", "#e0b24a"],
  [300, 90, "#b8e0ff", "#6fa9d9"],
];

/** How cheerful the friend looks: more helpers, more smile. */
function moodOf(info: SmileSceneInfo): Mood {
  if (info.sigh) return "frown";
  if (info.lit) return "grin";
  const helpers = info.a + info.b + info.c + info.d;
  if (helpers === 0) return "frown";
  if (helpers < 5) return "flat";
  if (helpers < 14) return "smile";
  return "grin";
}

const PUPPY_SPOTS: readonly (readonly [number, number])[] = [
  [60, 236],
  [250, 244],
  [30, 250],
  [330, 238],
];

/** Houses on the street, the last with a door that opens when you knock. */
function Street({ info }: LayerProps) {
  return (
    <g>
      {HOUSES.map(([x, y, wall, roof], i) => (
        <g key={x}>
          <rect x={x} y={y} width="70" height={150 - y} fill={wall} />
          <rect x={x - 4} y={y - 12} width="78" height="14" fill={roof} />
          <rect x={x + 10} y={y + 14} width="14" height="14" fill="#fff6d6" />
          <rect x={x + 44} y={y + 14} width="14" height="14" fill="#fff6d6" />
          {i === 2 && (
            <>
              <rect
                x={x + 26}
                y={y + 34}
                width="18"
                height={150 - y - 34}
                fill={info.ended ? "#3b2a1f" : "#8a5a2b"}
              />
              {info.ended && (
                <>
                  <Face x={x + 28} y={y + 38} size={12} mood="smile" />
                  <Face
                    x={x + 46}
                    y={y + 44}
                    size={10}
                    mood="grin"
                    fill="#f3c9a0"
                  />
                </>
              )}
            </>
          )}
        </g>
      ))}
    </g>
  );
}

function Balloons({ count }: { count: number }) {
  const n = Math.min(8, count);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} className={i % 2 ? "ms-bob" : "ms-bob-b"}>
          <Balloon
            x={132 + (i % 4) * 14 + (i > 3 ? 7 : 0)}
            y={98 - (i > 3 ? 12 : 0) + (i % 3) * 3}
            color={BALLOON_COLORS[i % BALLOON_COLORS.length]}
          />
        </g>
      ))}
    </g>
  );
}

function Puppies({ count }: { count: number }) {
  const n = Math.min(4, Math.ceil(count / 2));
  const spots = PUPPY_SPOTS.slice(0, n);
  return (
    <g>
      <g className="ms-hop">
        {spots.map(([x, y], i) => (
          <Dog key={x} x={x} y={y} color={i % 2 ? "#f0d8a8" : "#c98f55"} />
        ))}
      </g>
      <g className="ms-wag">
        {spots.map(([x, y]) => (
          <Tail key={x} x={x - 2} y={y - 2} />
        ))}
      </g>
    </g>
  );
}

function Lemonade({ count }: { count: number }) {
  const cups = Math.min(8, count);
  return (
    <g>
      <rect x="18" y="196" width="78" height="34" fill="#c98f55" />
      <rect x="14" y="184" width="86" height="12" fill="#fff" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={14 + i * 18}
          y="184"
          width="9"
          height="12"
          fill="#ffd23f"
        />
      ))}
      <rect x="22" y="160" width="3" height="26" fill="#8a5a2b" />
      <rect x="86" y="160" width="3" height="26" fill="#8a5a2b" />
      {Array.from({ length: cups }, (_, i) => (
        <g key={i}>
          <rect
            x={24 + (i % 4) * 16}
            y={i < 4 ? 190 : 176}
            width="8"
            height="8"
            fill="#fff59d"
          />
          <rect
            x={24 + (i % 4) * 16}
            y={i < 4 ? 190 : 176}
            width="8"
            height="2"
            fill="#fff"
          />
        </g>
      ))}
      <PixelText x={57} y={220} size={10} fill="#fff6d6">
        FREE
      </PixelText>
    </g>
  );
}

function MagicHat({ count }: { count: number }) {
  const rabbits = Math.min(4, count);
  return (
    <g>
      <rect x="296" y="236" width="26" height="6" fill="#8a5a2b" />
      <rect x="300" y="242" width="4" height="10" fill="#8a5a2b" />
      <rect x="314" y="242" width="4" height="10" fill="#8a5a2b" />
      <rect x="300" y="218" width="18" height="18" fill="#3b2a5e" />
      <rect x="296" y="232" width="26" height="4" fill="#3b2a5e" />
      <rect x="300" y="226" width="18" height="3" fill="#c77dff" />
      {Array.from({ length: rabbits }, (_, i) => (
        <g key={i} className={i % 2 ? "ms-bob" : "ms-bob-b"}>
          <rect
            x={300 + i * 5}
            y={206 - (i % 2) * 4}
            width="3"
            height="12"
            fill="#fff"
          />
          <rect
            x={304 + i * 5}
            y={208 - (i % 2) * 4}
            width="3"
            height="10"
            fill="#f7e8ee"
          />
        </g>
      ))}
      {count > 0 && (
        <g fill="#ffe14d">
          <rect x="294" y="204" width="3" height="3" className="ms-twinkle" />
          <rect x="324" y="210" width="3" height="3" className="ms-twinkle-b" />
          <rect x="310" y="196" width="3" height="3" className="ms-twinkle" />
        </g>
      )}
    </g>
  );
}

function JokeBooks({ level }: { level: number }) {
  const colors = ["#ff5d73", "#4cc9f0", "#ffd23f", "#7bed9f"];
  return (
    <g>
      {Array.from({ length: level }, (_, i) => (
        <g key={i}>
          <rect
            x={236 - (i % 2) * 2}
            y={222 - i * 7}
            width="22"
            height="7"
            fill={colors[i]}
          />
          <rect
            x={238 - (i % 2) * 2}
            y={224 - i * 7}
            width="18"
            height="1"
            fill="#fff"
          />
        </g>
      ))}
    </g>
  );
}

function BondJar({ tier }: { tier: number }) {
  return (
    <g>
      <rect
        x="116"
        y="204"
        width="16"
        height="22"
        fill="#d6f0ff"
        fillOpacity="0.5"
        stroke="#9fd3f5"
      />
      <rect
        x="116"
        y={226 - tier * 6}
        width="16"
        height={tier * 6}
        fill="#ff9eb0"
      />
      {tier > 0 && (
        <g fill="#ff5d73">
          <rect x="121" y="214" width="3" height="3" className="ms-twinkle" />
        </g>
      )}
    </g>
  );
}

/** One Sad Friend: a step, a robot, balloons, a puppy and a lemonade stand. */
export default function FriendLayer({ info }: LayerProps) {
  const mood = moodOf(info);
  return (
    <g>
      <defs>
        <linearGradient id="ms-sky-friend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ed4ff" />
          <stop offset="1" stopColor="#e6f7ff" />
        </linearGradient>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#8bd17c" />
      <rect x="0" y="0" width="400" height="150" fill="url(#ms-sky-friend)" />
      <circle cx="350" cy="36" r="16" fill="#fff3a0" />
      <rect x="0" y="150" width="400" height="150" fill="#8bd17c" />
      <rect x="0" y="200" width="400" height="46" fill="#cbb892" />
      <Street info={info} />
      {/* The step, the friend and the robot. */}
      <rect x="140" y="186" width="120" height="14" fill="#a8a29e" />
      <rect x="150" y="200" width="100" height="14" fill="#8d8780" />
      <g className={info.sigh ? "ms-t-slump" : undefined}>
        <rect x="164" y="160" width="22" height="26" fill="#6c8ef5" />
        <Face x={164} y={mood === "frown" ? 146 : 142} size={22} mood={mood} />
        {info.extraA > 0 && (
          <g fill="#ff5d73">
            <rect x="182" y="176" width="4" height="4" />
            <rect x="182" y="180" width="4" height="3" fill="#ffd23f" />
            <rect x="182" y="183" width="4" height="3" fill="#4cc9f0" />
          </g>
        )}
      </g>
      <Robot x={216} y={164} />
      <Balloons count={info.a} />
      <JokeBooks level={info.scaling} />
      <Lemonade count={info.c} />
      {info.b > 0 && <Puppies count={info.b} />}
      {info.d > 0 && <MagicHat count={info.d} />}
      {info.extraA > 0 && <BondJar tier={info.bond} />}
      {info.fork > 0 && <FriendForkArt side={info.fork === 1 ? 0 : 1} />}
      <TogetherLayer info={info} />
      {info.a > 3 && (
        <g fill="#ff9eb0">
          <rect x="196" y="120" width="3" height="3" className="ms-confetti" />
          <rect
            x="226"
            y="110"
            width="3"
            height="3"
            className="ms-confetti-b"
          />
        </g>
      )}
    </g>
  );
}
