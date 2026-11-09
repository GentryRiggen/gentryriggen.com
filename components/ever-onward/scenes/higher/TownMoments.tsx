import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px from "./Px";

/**
 * The Town's big scene pieces: the foremen in their hats (and the hat toss
 * when one changes), the tower's shadow over the town, the lamps and park,
 * the LIGHTS ON! moment and the day's decorations. Each piece is drawn from
 * a few flat numbers in the scene info, so the picture only redraws when one
 * of them changes.
 */

export const GROUND = 262;
export const TX = 200;
const GOLD = "#ffd23f";

/** Static delay classes (Tailwind only sees whole class names). */
const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.12s]",
  "[animation-delay:0.24s]",
  "[animation-delay:0.36s]",
  "[animation-delay:0.48s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.72s]",
  "[animation-delay:0.84s]",
  "[animation-delay:0.96s]",
  "[animation-delay:1.08s]",
] as const;

/** Hat colours by foreman id (0 is the site's regular foreman). */
const HAT = [
  "#f4f1e6",
  "#e8554e",
  "#4aa3df",
  "#ff8fb1",
  "#ffd23f",
  "#a77bd8",
  "#6cc070",
] as const;
const COAT = [
  "#9aa1ad",
  "#b8352f",
  "#2f78a8",
  "#d96a8f",
  "#c79a12",
  "#7a52b0",
  "#47994d",
] as const;
const FOREMAN_X = [44, 76, 108] as const;
const LAMP_X = [34, 132, 246] as const;
const DAY_NAMES = ["", "MARKET DAY", "NIGHT SHIFT", "WINDY DAY", "FESTIVAL"];

function HardHat({ id }: { id: number }) {
  return (
    <g>
      <Px x={0} y={-21} w={6} h={3} c={HAT[id]} />
      <Px x={-1} y={-18} w={8} h={2} c={HAT[id]} />
      <Px x={1} y={-21} w={2} h={1} c="#ffffff" o={0.6} />
    </g>
  );
}

/** One foreman, standing on the ground in his hard hat, bigger than the crowd. */
function Foreman({
  id,
  x,
  dim,
  drop,
}: {
  id: number;
  x: number;
  dim?: boolean;
  drop?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${GROUND}) scale(2.3)`}
      opacity={dim ? 0.4 : 1}
    >
      <Px x={0} y={-5} w={2} h={5} c="#3b3b4a" />
      <Px x={4} y={-5} w={2} h={5} c="#3b3b4a" />
      <Px x={0} y={-12} w={6} h={7} c={COAT[id]} />
      <Px x={1} y={-17} w={4} h={5} c="#f3c9a0" />
      <Px x={6} y={-11} w={3} h={4} c="#ffffff" />
      <g className={drop ? "bh-hat-drop" : undefined}>
        <HardHat id={id} />
      </g>
    </g>
  );
}

/** The three foremen on the site, and the hat that flies when one changes. */
export function Foremen({ info }: { info: HigherSceneInfo }) {
  return (
    <g
      data-testid="th-foremen"
      data-crew={info.crew}
      data-waiting={info.waiting}
    >
      {FOREMAN_X.map((x, h) => {
        const id = Number(info.crew[h] ?? 0);
        const waiting = (info.waiting & (1 << h)) !== 0;
        const arrived = info.arrived > 0 && info.arriveHat === h;
        return (
          <g key={h}>
            {waiting ? (
              <g className="bh-pulse">
                <Foreman id={0} x={x} dim />
              </g>
            ) : (
              <Foreman
                key={`${h}-${arrived ? info.arrivals : 0}`}
                id={id}
                x={x}
                drop={arrived}
              />
            )}
            {arrived && (
              <g key={`a${info.arrivals}`} data-testid="th-arrive">
                <circle
                  cx={x + 5}
                  cy={GROUND - 36}
                  r="12"
                  fill="none"
                  stroke={HAT[info.arrived] ?? GOLD}
                  strokeWidth="4"
                  className="bh-ring"
                />
                <Px x={x - 4} y={GROUND - 66} w={4} h={4} c={GOLD} />
                <Px x={x + 14} y={GROUND - 60} w={4} h={4} c="#ffffff" />
              </g>
            )}
            {info.tossed > 0 && info.tossHat === h && (
              <g key={`t${info.tosses}`} data-testid="th-toss">
                <g
                  className="bh-hat-toss"
                  transform={`translate(${x + 3} ${GROUND - 34}) scale(2.3)`}
                >
                  <HardHat id={info.tossed - 1} />
                </g>
                <g className="bh-poof">
                  <circle
                    cx={x + 5}
                    cy={GROUND - 12}
                    r="16"
                    fill="#e2d6c4"
                    fillOpacity="0.8"
                  />
                </g>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** How much navy lies over the whole town at each shade (0 bright, 5 pitch dark). */
const SHADE_OPACITY = [0, 0.16, 0.34, 0.54, 0.7, 0.8] as const;

/**
 * The tower's shadow: the whole town (the tower, the crew and the sun too)
 * goes navy, and a long shade lies across the ground. Drawn over the tower,
 * so lamps and the park (drawn after it) are the only things that shine.
 */
export function Shadow({ shade }: { shade: number }) {
  if (shade <= 0) return null;
  const reach = 60 + shade * 34;
  const level = Math.min(SHADE_OPACITY.length - 1, shade);
  return (
    <g data-testid="th-shadow" data-shade={shade} pointerEvents="none">
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1500"
        fill="#0a1236"
        fillOpacity={SHADE_OPACITY[level]}
      />
      <polygon
        points={`${TX - 26},${GROUND - 2} ${TX - 26 - reach},${GROUND - 2} ${TX - 36 - reach},${GROUND + 34} ${TX - 8},${GROUND + 34}`}
        fill="#05031a"
        fillOpacity={Math.min(0.75, 0.25 + shade * 0.1)}
      />
    </g>
  );
}

/** Street lamps along the street and a park in the foreground. */
export function Lights({ info }: { info: HigherSceneInfo }) {
  const { lamps, park, glow, shade } = info;
  const fresh = info.lit;
  // Cold lamps (the switch is off) are dark glass; warm ones throw a bigger
  // pool of light the darker the town is.
  const warm = glow / 4;
  const halo = 17 + shade * 4;
  return (
    <g
      data-testid="th-lights"
      data-lamps={lamps}
      data-park={park ? 1 : 0}
      data-glow={glow}
    >
      {LAMP_X.slice(0, lamps).map((x, i) => (
        <g
          key={x}
          className={
            fresh && i === lamps - 1 && !park ? "bh-lamp-pop" : undefined
          }
        >
          {glow > 0 && (
            <g>
              <circle
                cx={x + 2}
                cy={GROUND - 26}
                r={halo}
                fill={GOLD}
                fillOpacity={0.12 + warm * (0.16 + shade * 0.03)}
              />
              <ellipse
                cx={x + 2}
                cy={GROUND + 2}
                rx={halo + 8}
                ry="7"
                fill={GOLD}
                fillOpacity={warm * (0.18 + shade * 0.03)}
              />
              <g className="bh-pulse">
                <circle
                  cx={x + 2}
                  cy={GROUND - 26}
                  r="9"
                  fill="#fff3b0"
                  fillOpacity={0.5 * warm}
                />
              </g>
            </g>
          )}
          <Px x={x} y={GROUND - 24} w={4} h={24} c="#3b3b4a" />
          <Px
            x={x - 3}
            y={GROUND - 31}
            w={10}
            h={7}
            c={glow > 0 ? "#fff3b0" : "#6b6b7a"}
          />
          <Px x={x - 4} y={GROUND - 33} w={12} h={3} c="#3b3b4a" />
        </g>
      ))}
      {park && (
        <g className={fresh ? "bh-lamp-pop" : undefined}>
          <Px x={296} y={GROUND + 2} w={100} h={30} c="#4caf50" />
          <Px x={296} y={GROUND + 2} w={100} h={3} c="#ffffff" o={0.3} />
          <Px x={322} y={GROUND + 13} w={30} h={10} c="#4aa3df" />
          <Px x={322} y={GROUND + 13} w={30} h={2} c="#ffffff" o={0.5} />
          {[306, 366, 384].map((x, i) => (
            <g key={x}>
              <Px
                x={x + 5}
                y={GROUND - 12 - (i % 2) * 6}
                w={4}
                h={14 + (i % 2) * 6}
                c="#6e4423"
              />
              <Px
                x={x}
                y={GROUND - 28 - (i % 2) * 6}
                w={14}
                h={16}
                c="#2e8b3a"
              />
              <Px
                x={x + 2}
                y={GROUND - 30 - (i % 2) * 6}
                w={10}
                h={4}
                c="#43a84e"
              />
            </g>
          ))}
          <Px x={332} y={GROUND + 25} w={14} h={3} c="#a4813f" />
          <g className="bh-twinkle">
            {[304, 356, 394].map((x) => (
              <g key={x}>
                {glow > 0 && (
                  <circle
                    cx={x + 2}
                    cy={GROUND - 4}
                    r={9 + shade * 2}
                    fill={GOLD}
                    fillOpacity={0.15 + 0.25 * warm}
                  />
                )}
                <Px
                  x={x}
                  y={GROUND - 7}
                  w={4}
                  h={5}
                  c={glow > 0 ? "#fff3b0" : "#6b6b7a"}
                />
              </g>
            ))}
          </g>
        </g>
      )}
    </g>
  );
}

/** LIGHTS ON! gold flash, rings, sparks and falling confetti over the whole town. */
export function LightsOnMoment({ info }: { info: HigherSceneInfo }) {
  const big = info.park;
  const cx = big ? 346 : (LAMP_X[Math.max(0, info.lamps - 1)] ?? TX);
  return (
    <g data-testid="th-lights-on" key={`lit${info.lights}`}>
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1500"
        fill={GOLD}
        className="bh-flash-gold"
      />
      {Array.from({ length: big ? 3 : 2 }, (_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={GROUND - 20}
          r="14"
          fill="none"
          stroke={i % 2 ? "#ffffff" : GOLD}
          strokeWidth="5"
          className={`bh-lights-ring ${STAGGER[i * 3]}`}
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} className={`bh-spark bh-spark-${i}`}>
          <Px
            x={cx - 3}
            y={GROUND - 24}
            w={7}
            h={7}
            c={i % 2 ? "#ffffff" : GOLD}
          />
        </g>
      ))}
      {Array.from({ length: big ? 14 : 8 }, (_, i) => (
        <rect
          key={i}
          className={`bh-confetti ${STAGGER[i % 10]}`}
          x={40 + ((i * 41) % 320)}
          y={-6 - ((i * 13) % 40)}
          width="8"
          height="8"
          fill={["#fff3b0", GOLD, "#ff8fb1", "#8fd6a8"][i % 4]}
        />
      ))}
    </g>
  );
}

/** Stars and a pale moon for the night shift (drawn over the sky). */
export function NightSky() {
  return (
    <g data-testid="th-night">
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1400"
        fill="#0d1b4a"
        fillOpacity="0.55"
      />
      <g className="bh-twinkle">
        {[24, 70, 120, 176, 236, 290, 372].map((x, i) => (
          <Px key={x} x={x} y={14 + ((i * 23) % 70)} w={3} h={3} c="#ffffff" />
        ))}
      </g>
      <circle cx="340" cy="46" r="18" fill="#e8eefc" />
      <circle cx="334" cy="42" r="4" fill="#c7d0e8" />
    </g>
  );
}

/** What the day brings to the picture: stalls, wind, bunting. */
export function DayDecor({ day }: { day: number }) {
  if (day === 1)
    return (
      <g data-testid="th-market">
        {[8, 34].map((x) => (
          <g key={x}>
            <Px x={x} y={GROUND - 16} w={22} h={16} c="#c8a165" />
            {[0, 1, 2, 3, 4].map((k) => (
              <Px
                key={k}
                x={x - 1 + k * 5}
                y={GROUND - 22}
                w={5}
                h={7}
                c={k % 2 ? "#ffffff" : "#e8554e"}
              />
            ))}
            <Px x={x + 3} y={GROUND - 12} w={5} h={5} c="#ff7a1a" />
            <Px x={x + 12} y={GROUND - 12} w={5} h={5} c="#6cc070" />
          </g>
        ))}
        <g className="bh-hop">
          <circle
            cx="22"
            cy={GROUND - 34}
            r="5"
            fill={GOLD}
            stroke="#8a6d12"
            strokeWidth="2"
          />
          <circle
            cx="46"
            cy={GROUND - 38}
            r="5"
            fill={GOLD}
            stroke="#8a6d12"
            strokeWidth="2"
          />
        </g>
      </g>
    );
  if (day === 3)
    return (
      <g data-testid="th-wind">
        {[30, 66, 104, 142, 178].map((y, i) => (
          <g key={y} className={`bh-wind ${STAGGER[(i * 2) % 10]}`}>
            <Px x={0} y={y} w={30 + (i % 2) * 14} h={2} c="#ffffff" o={0.85} />
            <Px x={10} y={y + 5} w={18} h={2} c="#ffffff" o={0.7} />
          </g>
        ))}
      </g>
    );
  if (day === 4)
    return (
      <g data-testid="th-festival">
        <g className="bh-sway">
          <Px x={2} y={96} w={196} h={2} c="#3b3b4a" />
          {Array.from({ length: 14 }, (_, k) => (
            <polygon
              key={k}
              points={`${6 + k * 14},98 ${18 + k * 14},98 ${12 + k * 14},110`}
              fill={
                ["#e8554e", "#ffd23f", "#4aa3df", "#6cc070", "#ff8fb1"][k % 5]
              }
            />
          ))}
        </g>
        <g className="bh-pulse">
          {[120, 252, 372].map((x, i) => (
            <g key={x}>
              <circle
                cx={x}
                cy={150 - i * 12}
                r="9"
                fill={["#ff8fb1", "#ffd23f", "#4aa3df"][i]}
              />
              <Px x={x} y={159 - i * 12} w={1} h={26} c="#ffffff" o={0.7} />
            </g>
          ))}
        </g>
      </g>
    );
  return null;
}

/** The day's sign, high up where a phone can still read it. */
export function DaySign({ day }: { day: number }) {
  if (day === 0) return null;
  return (
    <g data-testid="th-day-sign" data-day={day}>
      <Px x={4} y={4} w={122} h={26} c="#2b1d0a" />
      <Px x={7} y={7} w={116} h={20} c="#f2b134" />
      <Px x={7} y={7} w={116} h={3} c="#ffffff" o={0.4} />
      <text
        x={65}
        y={22}
        textAnchor="middle"
        className="font-[family-name:var(--font-eo-pixel)]"
        fontSize="10"
        fill="#2b1d0a"
      >
        {DAY_NAMES[day]}
      </text>
    </g>
  );
}
