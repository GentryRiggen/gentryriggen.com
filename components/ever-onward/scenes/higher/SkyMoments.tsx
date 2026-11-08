import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px from "./Px";

/**
 * The Sky's big scene pieces: the forecast sky that darkens a step at a time,
 * the gust sweeping across, the strap clamps of a tie-down, a beam tumbling
 * down, a cable whipping loose, the no-crane climb and its badges. Each is
 * drawn from a few flat numbers in the scene info.
 */

export const TX = 200;
const GOLD = "#ffd23f";

const STAGGER = [
  "[animation-delay:0s]",
  "[animation-delay:0.15s]",
  "[animation-delay:0.3s]",
  "[animation-delay:0.45s]",
  "[animation-delay:0.6s]",
  "[animation-delay:0.75s]",
  "[animation-delay:0.9s]",
  "[animation-delay:1.05s]",
] as const;

/** Sky cover: darker with each forecast step, clouds that gather, lightning. */
export function Storm({ info }: { info: HigherSceneInfo }) {
  const dim = info.gust ? 0.55 : [0, 0.3, 0.55][info.wx];
  return (
    <g data-testid="sk-storm" data-wx={info.wx}>
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1500"
        fill="#0a0f2e"
        fillOpacity={dim}
        className="transition-[fill-opacity] duration-[2500ms]"
      />
      {(info.wx >= 1 || info.gust) && (
        <g className="bh-drift">
          {[30, 140, 260].map((x, i) => (
            <g key={x}>
              <Px x={x} y={40 + i * 26} w={96} h={16} c="#3a4258" o={0.95} />
              <Px
                x={x + 16}
                y={30 + i * 26}
                w={56}
                h={12}
                c="#3a4258"
                o={0.95}
              />
            </g>
          ))}
        </g>
      )}
      {(info.wx >= 2 || info.gust) && (
        <g>
          <rect
            x={-1200}
            y={-1200}
            width="2800"
            height="1500"
            fill="#e8f0ff"
            className="bh-flash"
          />
          <polygon
            points="150,60 138,110 150,108 140,160 168,98 154,100 164,60"
            fill="#fff7a0"
            className="bh-flash"
          />
        </g>
      )}
    </g>
  );
}

/** Streaks of wind racing across the whole picture while a gust blows. */
export function GustSweep({ info }: { info: HigherSceneInfo }) {
  if (!info.gust) return null;
  return (
    <g data-testid="sk-gust" key={`gust-${info.gusts}`}>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} className={`bh-wind ${STAGGER[i]}`}>
          <Px x={0} y={40 + i * 30} w={70 + (i % 3) * 26} h={4} c="#ffffff" />
          <Px x={22} y={46 + i * 30} w={40} h={2} c="#cfe6ff" />
        </g>
      ))}
    </g>
  );
}

/** The straps and clamps of a tie-down, popping on and staying while tied. */
export function Straps({
  info,
  top,
  base,
}: {
  info: HigherSceneInfo;
  top: number;
  base: number;
}) {
  if (info.tie === 0) return null;
  const solid = info.tie === 2 || info.tie === 3;
  const ys = [0.2, 0.5, 0.8].map((f) => Math.round(base - (base - top) * f));
  return (
    <g
      data-testid="sk-straps"
      data-tie={info.tie}
      opacity={solid ? 1 : 0.55}
      key={`tie-${info.ties}-${info.tie}`}
    >
      {ys.map((y, i) => (
        <g key={y} className={info.tied ? "bh-lamp-pop" : undefined}>
          <Px x={TX - 26} y={y} w={52} h={5} c={GOLD} />
          <Px x={TX - 26} y={y} w={52} h={1} c="#fff7c2" />
          <Px x={TX - 30} y={y - 3} w={7} h={11} c="#3a3f55" />
          <Px x={TX + 23} y={y - 3} w={7} h={11} c="#3a3f55" />
          <Px x={TX - 28} y={y} w={3} h={3} c={i % 2 ? "#ffffff" : GOLD} />
          <Px x={TX + 25} y={y} w={3} h={3} c={i % 2 ? "#ffffff" : GOLD} />
        </g>
      ))}
      {info.tied && (
        <g key={`tr-${info.ties}`}>
          <circle
            cx={TX}
            cy={ys[1]}
            r="16"
            fill="none"
            stroke={GOLD}
            strokeWidth="5"
            className="bh-ring"
          />
        </g>
      )}
    </g>
  );
}

/** A beam that slipped, tumbling all the way down to the clouds. */
export function DropFx({ info, top }: { info: HigherSceneInfo; top: number }) {
  if (!info.dropped) return null;
  return (
    <g data-testid="sk-drop" key={`drop-${info.drops}`}>
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1500"
        fill="#ff7a2a"
        className="bh-flash"
      />
      <g className="bh-beam-drop">
        <g transform={`translate(${TX + 14} ${top + 4})`}>
          <Px x={0} y={0} w={40} h={9} c="#c8a165" />
          <Px x={0} y={0} w={40} h={2} c="#e6c389" />
          <Px x={4} y={0} w={4} h={9} c="#e8554e" />
          <Px x={32} y={0} w={4} h={9} c="#e8554e" />
        </g>
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className={`bh-poof ${STAGGER[i * 2]}`}>
          <Px
            x={TX + 20 + i * 14}
            y={top + 24 - i * 6}
            w={6}
            h={6}
            c="#ffffff"
          />
        </g>
      ))}
    </g>
  );
}

/** A cable whipping loose with sparks. */
export function SnapFx({ info, top }: { info: HigherSceneInfo; top: number }) {
  if (!info.snapped) return null;
  return (
    <g data-testid="sk-snap" key={`snap-${info.snaps}`}>
      <rect
        x={-1200}
        y={-1200}
        width="2800"
        height="1500"
        fill="#ffe14a"
        className="bh-flash"
      />
      <g className="bh-whip">
        <path
          d={`M ${TX} ${top - 20} C ${TX + 60} ${top + 10}, ${TX - 70} ${top + 40}, ${TX + 30} ${top + 90}`}
          fill="none"
          stroke="#f4f7fb"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={`M ${TX} ${top - 20} C ${TX + 60} ${top + 10}, ${TX - 70} ${top + 40}, ${TX + 30} ${top + 90}`}
          fill="none"
          stroke="#ff5a4d"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} className={`bh-spark bh-spark-${i}`}>
          <Px x={TX - 3} y={top - 3} w={7} h={7} c={i % 2 ? "#ffffff" : GOLD} />
        </g>
      ))}
    </g>
  );
}

/** The hand-hoisting robot while the crane is off, and the win moment. */
export function NoCraneFx({
  info,
  top,
}: {
  info: HigherSceneInfo;
  top: number;
}) {
  return (
    <g data-testid="sk-nocrane" data-on={info.noCrane ? "1" : "0"}>
      {info.noCrane && (
        <g className="bh-bob">
          <g
            transform={`translate(${TX - 30} ${top}) scale(1.7) translate(-${TX - 30} -${top})`}
          >
            <Px x={TX - 34} y={top + 2} w={9} h={11} c="#e8554e" />
            <Px x={TX - 33} y={top - 4} w={7} h={6} c="#cfd6df" />
            <Px x={TX - 36} y={top - 8} w={20} h={5} c="#c8a165" />
            <Px x={TX - 26} y={top - 8} w={3} h={5} c="#e8554e" />
          </g>
        </g>
      )}
      {info.ncWon && (
        <g key={`win-${info.badges}`} data-testid="sk-nocrane-win">
          <rect
            x={-1200}
            y={-1200}
            width="2800"
            height="1500"
            fill={GOLD}
            className="bh-flash-gold"
          />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={TX}
              cy={top}
              r="14"
              fill="none"
              stroke={i % 2 ? "#ff8fb1" : GOLD}
              strokeWidth="5"
              className={`bh-ring ${STAGGER[i * 3]}`}
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} className={`bh-spark bh-spark-${i}`}>
              <Px
                x={TX - 3}
                y={top - 3}
                w={7}
                h={7}
                c={i % 2 ? "#ffffff" : GOLD}
              />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

/** Gold badges earned for good, pinned above the tower. */
export function Badges({ info, top }: { info: HigherSceneInfo; top: number }) {
  if (info.badges === 0) return null;
  return (
    <g data-testid="sk-badges" data-badges={info.badges}>
      {Array.from({ length: info.badges }, (_, i) => (
        <g key={i} transform={`translate(${TX - 30 + i * 20} ${top - 36})`}>
          <circle
            cx="7"
            cy="7"
            r="8"
            fill={GOLD}
            stroke="#a87a00"
            strokeWidth="2"
          />
          <Px x={5} y={3} w={4} h={8} c="#a87a00" />
          <Px x={3} y={5} w={8} h={4} c="#a87a00" />
          <Px x={6} y={5} w={2} h={4} c="#fff7c2" />
        </g>
      ))}
    </g>
  );
}
