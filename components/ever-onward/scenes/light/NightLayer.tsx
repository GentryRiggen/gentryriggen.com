import type { ReactNode } from "react";
import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { PLANET, planetPoint, slotAngle, type NightSlot } from "./anchors";
import { makeStars, seeded } from "./random";

const CITY_COUNT = 60;
const TWINKLES = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c", ""] as const;
const STARS = makeStars(23, 46);
/** The wires run along the planet between these angles (radians). */
const SPAN = 0.6;
const TRUNK_DEPTHS = [8, 26, 44] as const;
const RING_DEPTH = 62;
const SPOKES = [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45] as const;
const SUBSTATIONS = [-0.4, -0.2, 0.2, 0.4] as const;
const PIP_COLOURS: Record<string, string> = {
  gen1: "#ff9d5c",
  gen2: "#ffd35a",
  gen3: "#5ec8ff",
  gen4: "#8cf0a8",
};

/** City lights on the visible cap of the planet, in the order they pop on. */
const CITIES = (() => {
  const rand = seeded(5);
  return Array.from({ length: CITY_COUNT }, (_, i) => {
    const angle = (rand() - 0.5) * 1.1;
    const depth = 8 + rand() * 62;
    return {
      ...planetPoint(angle, depth),
      isHub: i % 4 === 0,
      twinkle: TWINKLES[i % TWINKLES.length],
    };
  });
})();

const fmt = (n: number): string => n.toFixed(1);

/** A wire along the planet's curve at `depth`, from angle `a` to angle `b`. */
function arc(a: number, b: number, depth: number): string {
  const from = planetPoint(a, depth);
  const to = planetPoint(b, depth);
  const r = PLANET.r - depth;
  return `M${fmt(from.x)} ${fmt(from.y)} A${r} ${r} 0 0 1 ${fmt(to.x)} ${fmt(to.y)}`;
}

const TRUNKS = TRUNK_DEPTHS.map((depth) => arc(-SPAN, SPAN, depth));
const RING = (() => {
  const a = planetPoint(-SPAN, TRUNK_DEPTHS[0]);
  const b = planetPoint(-SPAN, RING_DEPTH);
  const c = planetPoint(SPAN, RING_DEPTH);
  const d = planetPoint(SPAN, TRUNK_DEPTHS[0]);
  const r = PLANET.r - RING_DEPTH;
  return `M${fmt(a.x)} ${fmt(a.y)} L${fmt(b.x)} ${fmt(b.y)} A${r} ${r} 0 0 1 ${fmt(c.x)} ${fmt(c.y)} L${fmt(d.x)} ${fmt(d.y)}`;
})();
const SPOKE_PATHS = SPOKES.map((angle) => {
  const from = planetPoint(angle, TRUNK_DEPTHS[0]);
  const to = planetPoint(angle, RING_DEPTH);
  return `M${fmt(from.x)} ${fmt(from.y)} L${fmt(to.x)} ${fmt(to.y)}`;
});
/** Feeder lines from the nearest trunk to each hub town. */
const FEEDERS = CITIES.filter((c) => c.isHub).map((c) => {
  const angle = Math.atan2(c.x - PLANET.cx, PLANET.cy - c.y);
  const from = planetPoint(angle, TRUNK_DEPTHS[0]);
  return `M${fmt(from.x)} ${fmt(from.y)} L${fmt(c.x)} ${fmt(c.y)}`;
});

/** Street lamps along the rim: eight a tier, spread evenly. */
const lampAngles = (tier: number): number[] =>
  Array.from(
    { length: tier * 8 },
    (_, i) => -0.58 + ((i + 0.5) * 1.16) / (tier * 8)
  );

// ----------------------------------------------------------------- wires

const PULSE_SPEEDS = ["lm-pulse", "lm-pulse-b", "lm-pulse-c"] as const;
/** Where in the gap each layer of pulses starts, so they never bunch. */
const PULSE_PHASES = [0, 8, 16] as const;

/** A wire with light pulses running along it; more generators, more and faster. */
function Wire({ d, generators }: { d: string; generators: number }) {
  const speed = PULSE_SPEEDS[generators < 4 ? 0 : generators < 12 ? 1 : 2];
  const layers = generators >= 10 ? 3 : generators >= 4 ? 2 : 1;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="#7fc8ff"
        strokeOpacity="0.4"
        strokeWidth="1.6"
      />
      {PULSE_PHASES.slice(0, layers).map((phase) => (
        <path
          key={phase}
          d={d}
          pathLength="100"
          fill="none"
          stroke="#fff3b0"
          strokeWidth="2.6"
          strokeDasharray={`0 ${phase} 3 ${22 - phase}`}
          className={speed}
        />
      ))}
    </g>
  );
}

// ------------------------------------------------------------- machines

/** How many copies of a machine are drawn for `n` owned, spread over its slot. */
const copiesOf = (n: number): number[] => {
  if (n <= 1) return [0];
  if (n <= 3) return [-12, 12];
  return [-18, 0, 18];
};

function Crank({ level }: { level: number }) {
  return (
    <g transform={`scale(${0.95 + level * 0.1})`}>
      <rect x="-8" y="-5" width="16" height="6" fill="#2a3350" />
      <circle
        cy="-11"
        r="6"
        fill="#1c2742"
        stroke="#7fc8ff"
        strokeWidth="1.2"
      />
      <g transform="translate(0 -11)">
        <g className="lm-spin">
          <line
            x2="9"
            stroke="#ffd98a"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="9" r="2.4" fill="#ffd98a" />
        </g>
      </g>
    </g>
  );
}

function LittleGenerator() {
  return (
    <g>
      <rect
        x="-8"
        y="-11"
        width="16"
        height="11"
        fill="#34476e"
        stroke="#ff9d5c"
        strokeWidth="1"
      />
      <rect x="-5" y="-8" width="5" height="4" fill="#ffd98a" />
      <rect x="3" y="-18" width="3" height="8" fill="#5b6a8c" />
      <circle cx="4.5" cy="-20" r="2.6" fill="#d7e0f5" className="lm-puff" />
    </g>
  );
}

function SteamPlant() {
  return (
    <g>
      <rect
        x="-10"
        y="-13"
        width="20"
        height="13"
        fill="#34476e"
        stroke="#ffd35a"
        strokeWidth="1"
      />
      <rect x="-7" y="-24" width="4" height="11" fill="#5b6a8c" />
      <rect x="2" y="-22" width="4" height="9" fill="#5b6a8c" />
      <circle cx="-5" cy="-26" r="3" fill="#d7e0f5" className="lm-puff" />
      <circle cx="4" cy="-24" r="3" fill="#d7e0f5" className="lm-puff-b" />
      <rect x="-6" y="-9" width="4" height="4" fill="#ffd98a" />
      <rect x="2" y="-9" width="4" height="4" fill="#ffd98a" />
    </g>
  );
}

function RiverDam() {
  return (
    <g>
      <rect x="-16" y="-4" width="32" height="6" fill="#2a86d0" />
      <polygon
        points="-10,-18 10,-18 13,-3 -13,-3"
        fill="#8a7a66"
        stroke="#d9c7a0"
        strokeWidth="1"
      />
      {[-5, 0, 5].map((x) => (
        <path
          key={x}
          d={`M${x} -17 L${x} -3`}
          pathLength="25"
          stroke="#7fe0ff"
          strokeWidth="3"
          strokeDasharray="5 7.5 5 7.5"
          className="lm-pulse-b"
        />
      ))}
    </g>
  );
}

function WindFarm() {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="-20" stroke="#dfe8ff" strokeWidth="1.8" />
      <g transform="translate(0 -20)">
        <g className="lm-spin">
          {[0, 120, 240].map((a) => (
            <line
              key={a}
              y2="-11"
              stroke="#f4f7ff"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${a})`}
            />
          ))}
        </g>
        <circle r="2" fill="#8cf0a8" />
      </g>
      <polygon
        points="5,-4 15,-4 13,-9 7,-9"
        fill="#3c6cc0"
        stroke="#8cf0ff"
        strokeWidth="0.8"
      />
    </g>
  );
}

/** The grid's control post: its light shows how steady the grid is. */
function ControlPost({ info }: { info: LightSceneInfo }) {
  const colour =
    info.gridSteadiness >= 0.7
      ? "#6ef0a0"
      : info.gridSteadiness >= 0.4
        ? "#ffc24a"
        : "#ff5a4a";
  return (
    <g>
      <rect x="-1.5" y="-18" width="3" height="18" fill="#7a89ad" />
      <circle
        cy="-21"
        r="3.4"
        fill={colour}
        className={info.gridSteadiness < 0.7 ? "lm-flicker" : ""}
      />
      <circle cy="-21" r="8" fill={colour} fillOpacity="0.25" />
      {info.gridTier >= 1 && (
        <g className="lm-pop-svg">
          <line
            x1="-10"
            y1="-14"
            x2="10"
            y2="-14"
            stroke="#dfe8ff"
            strokeWidth="1.5"
          />
          <rect x="-12" y="-13" width="5" height="4" fill="#ffd98a" />
          <rect x="7" y="-13" width="5" height="4" fill="#ffd98a" />
        </g>
      )}
      {info.gridTier >= 2 && (
        <g className="lm-pop-svg">
          <circle
            cy="-21"
            r="11"
            fill="none"
            stroke="#8cf0ff"
            strokeDasharray="3 3"
            className="lm-glow"
          />
        </g>
      )}
    </g>
  );
}

interface MachineProps {
  slot: NightSlot;
  count: number;
  colour: string;
  children: ReactNode;
}

/** A machine standing on the horizon: a few copies, and a pip for every one owned. */
function Machine({ slot, count, colour, children }: MachineProps) {
  const base = planetPoint(slotAngle(slot), 0);
  const copies = copiesOf(count);
  const pips = Math.min(8, count);
  const scale = copies.length > 1 ? 1.05 : 1.25;
  return (
    <g
      transform={`translate(${fmt(base.x)} ${fmt(base.y)}) rotate(${(slotAngle(slot) * 180) / Math.PI})`}
    >
      {copies.map((dx) => (
        <g key={dx} transform={`translate(${dx} 2) scale(${scale})`}>
          <g className="lm-pop-svg">{children}</g>
        </g>
      ))}
      {Array.from({ length: pips }, (_, i) => (
        <rect
          key={i}
          x={(i - pips / 2) * 4}
          y="12"
          width="3"
          height="3"
          fill={colour}
        />
      ))}
    </g>
  );
}

// ------------------------------------------------------------- the layer

export default function NightLayer({ info }: { info: LightSceneInfo }) {
  const dawn = 1 - info.night;
  const lit = Math.min(
    CITY_COUNT,
    Math.round(info.citiesProgress * CITY_COUNT)
  );
  const cityCount = info.cities > 0 ? Math.max(1, lit) : 0;
  const brightness = 0.7 + 0.3 * info.powered;
  // A weak grid makes the towns stutter: every third, then every other one.
  const strain =
    info.powered < 0.6 || info.gridSteadiness < 0.4
      ? 2
      : info.powered < 0.85 || info.gridSteadiness < 0.7
        ? 1
        : 0;
  const generators = info.gen1 + info.gen2 + info.gen3 + info.gen4;
  const hasWires = generators > 0 || info.crankLevel > 0;
  const trunks = hasWires ? 1 + Math.min(2, info.linesTier) : 0;

  return (
    <g>
      <defs>
        <radialGradient id="lm-town-glow">
          <stop offset="0" stopColor="#ffd45e" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#ff9f3a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff9f3a" stopOpacity="0" />
        </radialGradient>
        <g id="lm-town">
          <circle r="14" fill="url(#lm-town-glow)" />
          <circle r="3.6" fill="#fff3c8" />
          <circle cx="-5.5" cy="2" r="1.8" fill="#ffd45e" />
          <circle cx="6" cy="1.5" r="1.8" fill="#ffd45e" />
          <circle cx="1.5" cy="-5.5" r="1.6" fill="#ffe9a0" />
          <circle cx="-2" cy="5.5" r="1.4" fill="#ffd45e" />
        </g>
      </defs>
      <rect x="-1200" y="-1200" width="2800" height="2800" fill="#02030a" />
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="1600"
        fill="url(#lm-dawn)"
        opacity={dawn * 0.9}
      />
      <g opacity={1 - dawn * 0.85}>
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y * 0.6}
            r={s.r}
            fill="#dfe8ff"
            className={s.twinkle}
          />
        ))}
      </g>
      <ellipse
        cx="200"
        cy="148"
        rx="280"
        ry="70"
        fill="url(#lm-lamp)"
        opacity={0.15 + dawn * 0.6}
      />
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r + 7}
        fill="none"
        stroke="#6cc4ff"
        strokeOpacity={0.18 + dawn * 0.3}
        strokeWidth="10"
      />
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r}
        fill="url(#lm-planet)"
        stroke="#7fc8ff"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      {/* steady glow: the grid is looked after, so the whole rim shines */}
      {info.glow > 0 && (
        <circle
          cx={PLANET.cx}
          cy={PLANET.cy}
          r={PLANET.r + 2}
          fill="none"
          stroke="#ffd98a"
          strokeOpacity="0.55"
          strokeWidth="3"
          className="lm-pop-svg"
        />
      )}
      {/* evening rush: everybody switches on at once */}
      {info.rush > 0 && (
        <circle
          cx={PLANET.cx}
          cy={PLANET.cy}
          r={PLANET.r + 5}
          fill="none"
          stroke="#fff3b0"
          strokeOpacity="0.8"
          strokeWidth="5"
          className="lm-glow"
        />
      )}
      {/* the grid: feeders, wires and the pulses running along them */}
      {hasWires && (
        <g>
          {FEEDERS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#7fc8ff"
              strokeOpacity="0.28"
              strokeWidth="1"
            />
          ))}
          {TRUNKS.slice(0, trunks).map((d, i) => (
            <Wire key={i} d={d} generators={generators} />
          ))}
          {info.linesTier >= 3 && <Wire d={RING} generators={generators} />}
          {info.linesTier >= 4 &&
            SPOKE_PATHS.map((d, i) => (
              <Wire key={i} d={d} generators={generators} />
            ))}
        </g>
      )}
      {info.subsTier >= 1 &&
        SUBSTATIONS.map((angle) => {
          const p = planetPoint(angle, TRUNK_DEPTHS[0]);
          return (
            <g key={angle} transform={`translate(${fmt(p.x)} ${fmt(p.y)})`}>
              <g className="lm-pop-svg">
                <rect
                  x="-4"
                  y="-4"
                  width="8"
                  height="8"
                  fill="#2a3350"
                  stroke="#ffd98a"
                  strokeWidth="1"
                />
                <rect x="-1.5" y="-1.5" width="3" height="3" fill="#ffd98a" />
              </g>
            </g>
          );
        })}
      {/* street lamps: LED, dimmable, smart */}
      {info.bulbsTier > 0 &&
        lampAngles(info.bulbsTier).map((angle, i) => {
          const p = planetPoint(angle, 0);
          return (
            <g
              key={`${info.bulbsTier}-${i}`}
              transform={`translate(${fmt(p.x)} ${fmt(p.y)})`}
            >
              <line y2="-5" stroke="#7a89ad" strokeWidth="1" />
              <circle
                cy="-6"
                r="2"
                fill={info.bulbsTier === 1 ? "#d7f6ff" : "#ffe3a0"}
                className={info.bulbsTier >= 3 ? TWINKLES[i % 3] : ""}
                opacity={info.bulbsTier === 2 ? 0.75 : 1}
              />
            </g>
          );
        })}
      {/* the towns */}
      <g opacity={brightness}>
        {CITIES.slice(0, cityCount).map((c, i) => {
          const flicker =
            strain > 0 && i % (strain === 2 ? 2 : 3) === 0
              ? i % 2
                ? "lm-brown"
                : "lm-brown-b"
              : info.glow > 0
                ? "lm-twinkle"
                : "";
          return (
            <g key={i} transform={`translate(${fmt(c.x)} ${fmt(c.y)})`}>
              <g className={flicker}>
                <use
                  href="#lm-town"
                  transform={info.glow > 0 ? "scale(1.25)" : undefined}
                />
              </g>
              {info.subsTier >= 2 && c.isHub && (
                <rect
                  x="5"
                  y="3"
                  width="4"
                  height="4"
                  fill="#2a3350"
                  stroke="#ffd98a"
                  strokeWidth="0.8"
                />
              )}
            </g>
          );
        })}
      </g>
      {/* the machines on the horizon */}
      <Machine slot="crank" count={0} colour="#ffd98a">
        <Crank level={info.crankLevel} />
      </Machine>
      {info.gen1 > 0 && (
        <Machine slot="gen1" count={info.gen1} colour={PIP_COLOURS.gen1}>
          <LittleGenerator />
        </Machine>
      )}
      {info.gen2 > 0 && (
        <Machine slot="gen2" count={info.gen2} colour={PIP_COLOURS.gen2}>
          <SteamPlant />
        </Machine>
      )}
      {info.gen3 > 0 && (
        <Machine slot="gen3" count={info.gen3} colour={PIP_COLOURS.gen3}>
          <RiverDam />
        </Machine>
      )}
      {info.gen4 > 0 && (
        <Machine slot="gen4" count={info.gen4} colour={PIP_COLOURS.gen4}>
          <WindFarm />
        </Machine>
      )}
      {(info.cities > 0 || generators > 0) && (
        <Machine slot="grid" count={0} colour="#6ef0a0">
          <ControlPost info={info} />
        </Machine>
      )}
    </g>
  );
}
