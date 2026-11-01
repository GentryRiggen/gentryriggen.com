import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { PotStage } from "@/lib/ever-onward/universes/grow/windowbox";
import { POT, SEED_CAN, SEED_DEW, SEED_LANTERN, SEED_MUSIC } from "./anchors";
import { SEED_CHIME, SEED_TRELLIS, SILL_Y } from "./anchors";

const STARS: readonly (readonly [number, number, number])[] = [
  [112, 38, 0],
  [138, 62, 1],
  [160, 34, 2],
  [186, 70, 0],
  [214, 40, 1],
  [236, 78, 2],
  [262, 36, 0],
  [284, 82, 1],
  [124, 96, 2],
  [248, 104, 0],
];
const TWINKLE = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c"] as const;

/** The quiet world outside: soft green hills, rooftops grown over with moss. */
function Outside({ night }: { night: boolean }) {
  const far = night ? "#1c4a3c" : "#4a8a58";
  const mid = night ? "#14392f" : "#3a7549";
  const near = night ? "#0e2a24" : "#2c5f3b";
  const moss = night ? "#2e6b52" : "#6fae6e";
  return (
    <g>
      <rect x="100" y="24" width="200" height="162" fill="url(#gs-sky)" />
      {night &&
        STARS.map(([x, y, k]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="2"
            height="2"
            fill="#fff4cf"
            className={k === 0 ? "" : TWINKLE[k]}
          />
        ))}
      {night ? (
        <g>
          <circle cx="262" cy="62" r="11" fill="#fff4cf" fillOpacity="0.14" />
          <circle cx="262" cy="62" r="7" fill="#fff4cf" />
          <circle cx="259" cy="60" r="2" fill="#e6dcb0" />
        </g>
      ) : (
        <circle cx="150" cy="130" r="12" fill="#ffd9a0" fillOpacity="0.8" />
      )}
      <rect x="100" y="132" width="40" height="8" fill={far} />
      <rect x="140" y="124" width="60" height="16" fill={far} />
      <rect x="200" y="130" width="50" height="10" fill={far} />
      <rect x="250" y="120" width="50" height="20" fill={far} />
      <rect x="100" y="140" width="200" height="46" fill={mid} />
      <rect x="120" y="136" width="48" height="6" fill={mid} />
      <rect x="226" y="134" width="44" height="8" fill={mid} />
      <rect x="100" y="158" width="200" height="28" fill={near} />
      <rect x="110" y="152" width="40" height="8" fill={near} />
      <rect x="250" y="150" width="36" height="10" fill={near} />
      <rect x="132" y="128" width="14" height="10" fill={mid} />
      <rect x="130" y="126" width="18" height="4" fill={moss} />
      <rect x="256" y="124" width="12" height="10" fill={mid} />
      <rect x="254" y="122" width="16" height="4" fill={moss} />
      <rect x="196" y="138" width="10" height="8" fill={near} />
      <rect x="194" y="136" width="14" height="4" fill={moss} />
    </g>
  );
}

/** A watering robot, in the corner, looking at the pot. */
export function Robot() {
  return (
    <g aria-hidden="true">
      <rect x="52" y="166" width="22" height="16" fill="#8a9bc0" />
      <rect x="54" y="168" width="18" height="12" fill="#b6c6e6" />
      <rect x="51" y="150" width="24" height="17" fill="#26335f" />
      <rect x="53" y="152" width="20" height="13" fill="#b6c6e6" />
      <rect x="55" y="155" width="16" height="8" fill="#060a18" />
      <rect x="58" y="157" width="3" height="3" fill="#67e8f9" />
      <rect x="65" y="157" width="3" height="3" fill="#67e8f9" />
      <rect x="62" y="146" width="2" height="5" fill="#26335f" />
      <rect x="61" y="144" width="4" height="3" fill="#fb7185" />
      <rect x="74" y="168" width="8" height="4" fill="#8a9bc0" />
      <rect x="56" y="182" width="6" height="22" fill="#26335f" />
      <rect x="64" y="182" width="6" height="22" fill="#26335f" />
    </g>
  );
}

/** The plant: a thread of green, then a bud, then the flower. */
export function Plant({ stage, growth }: { stage: PotStage; growth: number }) {
  const h = stage === "soil" ? 0 : Math.round(8 + growth * 0.5);
  const top = POT.y - h;
  return (
    <g>
      {stage === "bloom" && (
        <circle cx={POT.x} cy={top} r="34" fill="url(#gs-bloom)" />
      )}
      {stage === "soil" && (
        <rect x={POT.x - 2} y={POT.y - 3} width="4" height="3" fill="#5a3a22" />
      )}
      {stage !== "soil" && (
        <rect x={POT.x - 1} y={top} width="3" height={h} fill="#3f9d3a" />
      )}
      {stage !== "soil" && (
        <g fill="#58bf4f">
          <rect x={POT.x - 12} y={POT.y - h * 0.4} width="11" height="5" />
          <rect x={POT.x + 2} y={POT.y - h * 0.62} width="12" height="5" />
          {h > 30 && (
            <rect x={POT.x - 11} y={POT.y - h * 0.82} width="10" height="4" />
          )}
        </g>
      )}
      {stage === "bud" && (
        <g>
          <rect
            x={POT.x - 4}
            y={top - 8}
            width="9"
            height="10"
            fill="#e879a8"
          />
          <rect
            x={POT.x - 3}
            y={top - 10}
            width="7"
            height="3"
            fill="#f9a8c9"
          />
        </g>
      )}
      {stage === "bloom" && (
        <g>
          <rect
            x={POT.x - 12}
            y={top - 12}
            width="25"
            height="22"
            fill="#fb7185"
          />
          <rect
            x={POT.x - 16}
            y={top - 7}
            width="33"
            height="12"
            fill="#fda4af"
          />
          <rect
            x={POT.x - 8}
            y={top - 17}
            width="17"
            height="8"
            fill="#fda4af"
          />
          <rect x={POT.x - 4} y={top - 7} width="9" height="9" fill="#fde047" />
        </g>
      )}
    </g>
  );
}

/** The grown-up and the little one they hold up to the sill. */
export function Visitors() {
  return (
    <g data-testid="lm-visitors" aria-hidden="true">
      <g className="gs-arrive">
        <rect x="244" y="94" width="16" height="16" fill="#e8b48a" />
        <rect x="243" y="90" width="18" height="8" fill="#4a2f22" />
        <rect x="238" y="110" width="28" height="60" fill="#4a6fa5" />
        <rect x="238" y="110" width="28" height="6" fill="#6c8fc7" />
        <rect x="240" y="170" width="10" height="40" fill="#2f3b5c" />
        <rect x="254" y="170" width="10" height="40" fill="#2f3b5c" />
        <rect x="214" y="124" width="26" height="8" fill="#4a6fa5" />
      </g>
      <g className="gs-arrive [animation-delay:1.6s]">
        <rect x="222" y="104" width="12" height="12" fill="#f0c6a0" />
        <rect x="221" y="101" width="14" height="6" fill="#7a4a2a" />
        <rect x="221" y="116" width="14" height="18" fill="#f2a65a" />
        <rect x="222" y="134" width="5" height="8" fill="#3d4a73" />
        <rect x="229" y="134" width="5" height="8" fill="#3d4a73" />
        <rect x="212" y="112" width="10" height="4" fill="#f0c6a0" />
      </g>
    </g>
  );
}

/** What sits on the sill, window and wall. */
function Things({ info }: { info: GrowSceneInfo }) {
  return (
    <g>
      {info.sunnySill && (
        <rect
          x="150"
          y={SILL_Y - 4}
          width="100"
          height="4"
          fill="#ffd86b"
          fillOpacity="0.35"
        />
      )}
      {info.trellis && (
        <g fill="#c9a56a">
          <rect
            x={SEED_TRELLIS.x - 14}
            y={SEED_TRELLIS.y}
            width="2"
            height="48"
          />
          <rect
            x={SEED_TRELLIS.x + 14}
            y={SEED_TRELLIS.y}
            width="2"
            height="48"
          />
          <rect
            x={SEED_TRELLIS.x - 14}
            y={SEED_TRELLIS.y + 12}
            width="30"
            height="2"
          />
          <rect
            x={SEED_TRELLIS.x - 14}
            y={SEED_TRELLIS.y + 30}
            width="30"
            height="2"
          />
          <rect
            x={SEED_TRELLIS.x - 16}
            y={SEED_TRELLIS.y + 22}
            width="4"
            height="4"
            fill="#58bf4f"
          />
        </g>
      )}
      {info.can && (
        <g>
          <rect
            x={SEED_CAN.x}
            y={SEED_CAN.y}
            width="14"
            height="9"
            fill="#6fa3c7"
          />
          <rect
            x={SEED_CAN.x + 14}
            y={SEED_CAN.y + 1}
            width="7"
            height="3"
            fill="#6fa3c7"
          />
          <rect
            x={SEED_CAN.x - 3}
            y={SEED_CAN.y + 1}
            width="3"
            height="7"
            fill="#4f7fa3"
          />
        </g>
      )}
      {info.dew && (
        <g>
          <rect
            x={SEED_DEW.x}
            y={SEED_DEW.y}
            width="16"
            height="5"
            fill="#bfe6ff"
            fillOpacity="0.85"
          />
          <rect
            x={SEED_DEW.x + 3}
            y={SEED_DEW.y - 4}
            width="3"
            height="3"
            fill="#e0f3ff"
          />
          <rect
            x={SEED_DEW.x + 10}
            y={SEED_DEW.y - 3}
            width="3"
            height="3"
            fill="#e0f3ff"
          />
        </g>
      )}
      {info.musicBox && (
        <g>
          <rect
            x={SEED_MUSIC.x}
            y={SEED_MUSIC.y}
            width="22"
            height="8"
            fill="#9a6a3c"
          />
          <rect
            x={SEED_MUSIC.x}
            y={SEED_MUSIC.y - 3}
            width="22"
            height="3"
            fill="#b5834a"
          />
          <rect
            x={SEED_MUSIC.x + 22}
            y={SEED_MUSIC.y + 1}
            width="4"
            height="2"
            fill="#d9c27a"
          />
        </g>
      )}
      {info.chime && (
        <g fill="#cfd8e6">
          <rect x={SEED_CHIME.x} y="24" width="1" height="20" fill="#9aa6bb" />
          <rect x={SEED_CHIME.x - 8} y="44" width="2" height="16" />
          <rect x={SEED_CHIME.x - 3} y="44" width="2" height="22" />
          <rect x={SEED_CHIME.x + 2} y="44" width="2" height="18" />
          <rect x={SEED_CHIME.x + 7} y="44" width="2" height="12" />
          <rect
            x={SEED_CHIME.x - 10}
            y="42"
            width="22"
            height="3"
            fill="#9a6a3c"
          />
        </g>
      )}
      <g>
        <rect
          x={SEED_LANTERN.x - 7}
          y={SEED_LANTERN.y - 6}
          width="14"
          height="2"
          fill="#3b3b4a"
        />
        <rect
          x={SEED_LANTERN.x - 8}
          y={SEED_LANTERN.y - 4}
          width="16"
          height="14"
          fill="#3b3b4a"
        />
        <rect
          x={SEED_LANTERN.x - 5}
          y={SEED_LANTERN.y - 2}
          width="10"
          height="9"
          fill={info.windowLit ? "#ffd87a" : "#55506a"}
        />
        <rect
          x={SEED_LANTERN.x - 3}
          y={SEED_LANTERN.y - 10}
          width="6"
          height="5"
          fill="none"
          stroke="#3b3b4a"
          strokeWidth="1.5"
        />
      </g>
    </g>
  );
}

/**
 * The Last Seed: one quiet window at night, one small pot on the sill, and a
 * light left on. Everything outside is green and still. When someone comes
 * back, they stand at the window with a little one.
 */
export default function SeedLayer({ info }: { info: GrowSceneInfo }) {
  const night = info.isNight;
  const lit = info.windowLit;
  return (
    <g>
      <defs>
        <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#070b1f" : "#3b3170"} />
          <stop offset="1" stopColor={night ? "#1b2a52" : "#e9a07a"} />
        </linearGradient>
        <radialGradient id="gs-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd87a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd87a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gs-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fda4af" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fda4af" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="2700"
        fill={night ? "#17122a" : "#2b1f33"}
      />
      <rect
        x="-1200"
        y="212"
        width="2800"
        height="1400"
        fill={night ? "#120e22" : "#221828"}
      />
      <Outside night={night} />
      <rect x="92" y="16" width="216" height="8" fill="#6b4423" />
      <rect x="92" y="16" width="8" height="176" fill="#6b4423" />
      <rect x="300" y="16" width="8" height="176" fill="#6b4423" />
      <rect x="92" y="16" width="216" height="3" fill="#8a5a34" />
      <rect
        x="82"
        y="14"
        width="30"
        height="108"
        fill={night ? "#6b3342" : "#8a3b4a"}
      />
      <rect
        x="288"
        y="14"
        width="30"
        height="108"
        fill={night ? "#6b3342" : "#8a3b4a"}
      />
      <rect x="82" y="14" width="30" height="4" fill="#9a6a3c" />
      <rect x="288" y="14" width="30" height="4" fill="#9a6a3c" />
      <rect x="74" y={SILL_Y} width="252" height="12" fill="#a06a3c" />
      <rect x="74" y={SILL_Y + 12} width="252" height="6" fill="#6b4423" />
      <Things info={info} />
      <g>
        <rect
          x={POT.x - 16}
          y={POT.y + 4}
          width="32"
          height={SILL_Y - POT.y - 4}
          fill="#c1623a"
        />
        <rect
          x={POT.x - 20}
          y={POT.y - 2}
          width="40"
          height="8"
          fill="#d9774a"
        />
        <rect
          x={POT.x - 17}
          y={POT.y - 3}
          width="34"
          height="3"
          fill="#3b2412"
        />
      </g>
      <Plant stage={info.potStage} growth={info.growth} />
      <Robot />
      {lit && (
        <circle
          cx={SEED_LANTERN.x}
          cy={SEED_LANTERN.y}
          r="86"
          fill="url(#gs-lamp)"
          className="gs-glow pointer-events-none"
        />
      )}
      {info.visitorHere && <Visitors />}
    </g>
  );
}
