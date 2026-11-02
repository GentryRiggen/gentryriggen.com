import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { TownForkArt } from "./ForkArt";
import { BALLOON_COLORS, Face, INK, PixelText, type Mood } from "./parts";

interface LayerProps {
  info: SmileSceneInfo;
}

const LAMPS = [34, 126, 218, 310] as const;
const BURSTS: readonly (readonly [number, number, string])[] = [
  [80, 58, "#ffd23f"],
  [190, 40, "#ff5d73"],
  [300, 60, "#4cc9f0"],
  [140, 28, "#7bed9f"],
];

function Buildings({ info }: LayerProps) {
  return (
    <g>
      <rect x="10" y="108" width="70" height="60" fill="#ffb3a7" />
      <rect x="6" y="100" width="78" height="10" fill="#d9776b" />
      <rect x="100" y="70" width="100" height="98" fill="#ffe29a" />
      <rect x="94" y="62" width="112" height="10" fill="#e0b24a" />
      <rect x="140" y="38" width="20" height="26" fill="#e0b24a" />
      <circle cx="150" cy="52" r="7" fill="#fff" />
      <rect x="149" y="47" width="2" height="6" fill={INK} />
      <rect x="137" y="128" width="26" height="40" fill="#8a5a2b" />
      {[112, 176].map((x) => (
        <rect key={x} x={x} y="86" width="14" height="16" fill="#fff6d6" />
      ))}
      <rect x="216" y="104" width="76" height="64" fill="#b8e0ff" />
      <rect x="212" y="96" width="84" height="10" fill="#6fa9d9" />
      <rect x="300" y="112" width="90" height="56" fill="#d4c2ff" />
      {info.ended && (
        <g className="ms-glow">
          <rect x="136" y="110" width="28" height="8" fill="#ffd23f" />
          <rect x="136" y="110" width="8" height="22" fill="#ffd23f" />
          <rect x="148" y="122" width="8" height="4" fill="#ffd23f" />
          <circle cx="132" cy="114" r="8" fill="#ffd23f" />
          <circle cx="132" cy="114" r="3" fill="#ffe29a" />
        </g>
      )}
      {(info.projects & 4) !== 0 && (
        <g>
          {[28, 118, 232].map((x) => (
            <g key={x} className="ms-confetti">
              <rect x={x} y="84" width="4" height="4" fill="#ff5d73" />
              <rect x={x + 6} y="90" width="4" height="4" fill="#4cc9f0" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function LampsAndBunting({ tier }: { tier: number }) {
  return (
    <g>
      {LAMPS.map((x) => (
        <g key={x}>
          <rect x={x} y="124" width="4" height="66" fill="#5b6b82" />
          <rect x={x - 3} y="120" width="10" height="6" fill="#ffd23f" />
        </g>
      ))}
      {tier > 0 &&
        LAMPS.slice(0, 3).map((x, span) => (
          <g key={x} className="ms-flutter">
            <rect x={x + 4} y="130" width="88" height="1" fill="#fff" />
            {Array.from({ length: tier * 2 }, (_, i) => (
              <rect
                key={i}
                x={x + 8 + i * (80 / (tier * 2))}
                y="131"
                width="7"
                height="9"
                fill={BALLOON_COLORS[(i + span) % BALLOON_COLORS.length]}
              />
            ))}
          </g>
        ))}
    </g>
  );
}

function Clowns({ count }: { count: number }) {
  const n = Math.min(6, count);
  return (
    <g className="ms-march">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${24 + i * 24} 196)`}>
          <rect x="2" y="-12" width="12" height="6" fill={BALLOON_COLORS[i]} />
          <rect x="0" y="-6" width="16" height="3" fill={BALLOON_COLORS[i]} />
          <Face x={0} y={-3} size={16} mood="grin" />
          <rect x="6" y="6" width="4" height="4" fill="#ff5d73" />
          <rect
            x="1"
            y="13"
            width="14"
            height="14"
            fill={BALLOON_COLORS[(i + 3) % 8]}
          />
          <rect x="-2" y="27" width="8" height="4" fill="#2b2140" />
          <rect x="10" y="27" width="8" height="4" fill="#2b2140" />
        </g>
      ))}
    </g>
  );
}

function Band({ count }: { count: number }) {
  const n = Math.min(6, count);
  return (
    <g className="ms-march-b">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${34 + i * 28} 232)`}>
          <rect x="0" y="-8" width="14" height="5" fill="#2b2140" />
          <rect x="2" y="-3" width="10" height="9" fill={SKIN_TONES[i % 3]} />
          <rect x="0" y="6" width="14" height="10" fill="#c1440e" />
          <rect x="12" y="2" width="9" height="5" fill="#ffd23f" />
          <rect x="19" y="-2" width="6" height="13" fill="#ffd23f" />
        </g>
      ))}
    </g>
  );
}

const SKIN_TONES = ["#ffd9a8", "#d9a066", "#8d5524"] as const;

function Factory({ count }: { count: number }) {
  const chimneys = Math.min(3, Math.ceil(count / 3));
  const windows = Math.min(8, count);
  return (
    <g>
      <rect x="12" y="150" width="76" height="30" fill="#8e9bb0" />
      <rect x="12" y="144" width="76" height="8" fill="#5b6b82" />
      {Array.from({ length: windows }, (_, i) => (
        <rect
          key={i}
          x={16 + (i % 4) * 18}
          y={i < 4 ? 156 : 166}
          width="12"
          height="7"
          fill="#ffe29a"
        />
      ))}
      {Array.from({ length: chimneys }, (_, i) => (
        <g key={i}>
          <rect
            x={18 + i * 24}
            y={116 - i * 4}
            width="10"
            height={30 + i * 4}
            fill="#5b6b82"
          />
          <g className={i % 2 ? "ms-puff-b" : "ms-puff"}>
            <rect
              x={16 + i * 24}
              y={106 - i * 4}
              width="14"
              height="10"
              fill="#fff"
              fillOpacity="0.85"
            />
            <rect
              x={20 + i * 24}
              y={109 - i * 4}
              width="2"
              height="2"
              fill={INK}
            />
            <rect
              x={25 + i * 24}
              y={109 - i * 4}
              width="2"
              height="2"
              fill={INK}
            />
          </g>
        </g>
      ))}
    </g>
  );
}

function Fireworks({ count }: { count: number }) {
  const n = Math.min(4, count);
  const shown = BURSTS.slice(0, n);
  const spokes = [
    [0, -14],
    [10, -10],
    [14, 0],
    [10, 10],
    [0, 14],
    [-10, 10],
    [-14, 0],
    [-10, -10],
  ] as const;
  return (
    <g>
      {[0, 1].map((k) => (
        <g key={k} className={k ? "ms-burst-b" : "ms-burst"}>
          {shown
            .filter((_, i) => i % 2 === k)
            .map(([x, y, color]) => (
              <g key={x} fill={color}>
                {spokes.map(([dx, dy]) => (
                  <rect
                    key={`${dx}${dy}`}
                    x={x + dx}
                    y={y + dy}
                    width="4"
                    height="4"
                  />
                ))}
              </g>
            ))}
        </g>
      ))}
    </g>
  );
}

function Benches({ count }: { count: number }) {
  return (
    <g>
      {Array.from({ length: Math.min(3, count) }, (_, i) => (
        <g key={i}>
          <rect x={130 + i * 70} y="262" width="40" height="5" fill="#8a5a2b" />
          <rect x={130 + i * 70} y="256" width="40" height="4" fill="#a9703a" />
          <rect x={134 + i * 70} y="267" width="4" height="8" fill="#5b3a1a" />
          <rect x={162 + i * 70} y="267" width="4" height="8" fill="#5b3a1a" />
        </g>
      ))}
    </g>
  );
}

function Crowd({ info }: LayerProps) {
  const n = Math.min(14, 6 + info.a + info.b + info.c);
  const mood: Mood = info.tired ? "flat" : info.parade ? "grin" : "smile";
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <Face
            x={10 + i * 27}
            y={274 - (i % 3) * 3}
            size={14}
            mood={mood}
            fill={SKIN_TONES[i % 3]}
            isSweaty={info.heat >= 3 || info.tired}
          />
        </g>
      ))}
    </g>
  );
}

function ParadeFloat() {
  return (
    <g className="ms-drift">
      <rect x="150" y="214" width="96" height="16" fill="#ff9f43" />
      <rect x="160" y="196" width="40" height="18" fill="#ff5d73" />
      <rect x="206" y="204" width="30" height="10" fill="#ffd23f" />
      <rect x="156" y="230" width="12" height="12" fill="#2b2140" />
      <rect x="224" y="230" width="12" height="12" fill="#2b2140" />
      <PixelText x={198} y={226} fill="#fff">
        HOORAY
      </PixelText>
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={156 + i * 20}
            y={186}
            width="4"
            height="4"
            fill={BALLOON_COLORS[i]}
            className={i % 2 ? "ms-confetti" : "ms-confetti-b"}
          />
        ))}
      </g>
    </g>
  );
}

/** The statue the town builds. It has a very large smile. */
function Statue() {
  return (
    <g>
      <rect x="352" y="214" width="34" height="8" fill="#a8a29e" />
      <rect x="360" y="190" width="18" height="24" fill="#c7d6e8" />
      <rect x="358" y="170" width="22" height="20" fill="#c7d6e8" />
      <rect x="361" y="176" width="4" height="4" fill={INK} />
      <rect x="371" y="176" width="4" height="4" fill={INK} />
      <rect
        x="360"
        y="183"
        width="18"
        height="4"
        fill={INK}
        className="ms-grin"
      />
    </g>
  );
}

/** The Town: a street with clowns, a band, a factory and fireworks. */
export default function TownLayer({ info }: LayerProps) {
  const bigTop = (info.projects & 1) !== 0;
  const shade = (info.projects & 2) !== 0;
  return (
    <g>
      <defs>
        <linearGradient id="ms-sky-town" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="1" stopColor="#ffe9c7" />
        </linearGradient>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2700" fill="#cbb892" />
      <rect x="0" y="0" width="400" height="170" fill="url(#ms-sky-town)" />
      <Buildings info={info} />
      <rect x="0" y="168" width="400" height="14" fill="#8bd17c" />
      <rect x="0" y="182" width="400" height="118" fill="#d8c7a2" />
      <rect x="0" y="238" width="400" height="2" fill="#bfae88" />
      {info.d > 0 && <Fireworks count={info.d} />}
      <LampsAndBunting tier={info.scaling} />
      {info.c > 0 && <Factory count={info.c} />}
      {info.fork > 0 && <TownForkArt side={info.fork === 1 ? 0 : 1} />}
      {bigTop && (
        <g>
          <rect x="248" y="150" width="40" height="30" fill="#c77dff" />
          <rect x="244" y="144" width="48" height="8" fill="#fff" />
          <rect x="262" y="164" width="12" height="16" fill="#2b2140" />
        </g>
      )}
      {shade && (
        <g>
          <rect x="296" y="196" width="6" height="30" fill="#5b3a1a" />
          <rect x="284" y="180" width="30" height="22" fill="#3f9d3a" />
        </g>
      )}
      {info.a > 0 && <Clowns count={info.a} />}
      {info.b > 0 && <Band count={info.b} />}
      {info.parade && <ParadeFloat />}
      {info.extraA > 0 && <Benches count={info.extraA} />}
      {info.c >= 3 && <Statue />}
      <Crowd info={info} />
    </g>
  );
}
