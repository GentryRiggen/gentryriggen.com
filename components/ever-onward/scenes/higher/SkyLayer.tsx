import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px, { Bird } from "./Px";

const CLOUD_Y = 232;
const TX = 200;

function Cloud({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <Px x={x} y={y} w={w} h={9} c="#ffffff" o={0.92} />
      <Px x={x + w * 0.2} y={y - 6} w={w * 0.5} h={7} c="#ffffff" o={0.92} />
    </g>
  );
}

function CloudCrane({ x, n }: { x: number; n: number }) {
  return (
    <g>
      <Cloud x={x - 18} y={CLOUD_Y - 2} w={42} />
      <Px x={x} y={CLOUD_Y - 54} w={3} h={54} c="#e8554e" />
      <g className={n % 2 ? "bh-arm" : "bh-arm-b"}>
        <Px x={x - 34} y={CLOUD_Y - 58} w={48} h={3} c="#e8554e" />
        <Px x={x - 30} y={CLOUD_Y - 55} w={1} h={16} c="#444455" />
        <Px x={x - 33} y={CLOUD_Y - 39} w={7} h={6} c="#cfd6df" />
      </g>
    </g>
  );
}

/** The sky: a tower rising out of the clouds, with the town in its shadow. */
export default function SkyLayer({ info }: { info: HigherSceneInfo }) {
  const own = info.own;
  const h = 56 + info.height * 14;
  const top = CLOUD_Y - h;
  const elevator = info.fork === 1;
  const terraces = info.fork === 2;
  const crew = Math.min(6, own["sky-crew"] ?? 0);
  const alloy = Math.min(4, own.alloy ?? 0);
  const damper = Math.min(3, own.damper ?? 0);
  const cranes = Math.min(3, Math.ceil((own["cloud-crane"] ?? 0) / 2));
  const ring = Math.min(3, own["ballast-ring"] ?? 0);
  const cables = Math.min(6, own["cable-spinner"] ?? 0);
  const floors = Math.floor(h / 8);
  const shadow = 50 + info.height * 22;
  const widthAt = (y: number): number => 12 + ((y - top) / h) * 8;
  return (
    <g>
      {/* sky in bands, darker the higher you go */}
      <Px x={-1200} y={-1200} w={2800} h={1200} c="#1a2f78" />
      <Px x={-1200} y={0} w={2800} h={70} c="#2f56b0" />
      <Px x={-1200} y={70} w={2800} h={80} c="#5b8fe0" />
      <Px x={-1200} y={150} w={2800} h={100} c="#9cc8f5" />
      {info.height >= 5 && (
        <g className="bh-twinkle">
          {[22, 64, 110, 168, 236, 282, 338, 378].map((x, i) => (
            <Px key={x} x={x} y={8 + (i % 4) * 14} w={2} h={2} c="#ffffff" />
          ))}
        </g>
      )}
      <circle cx="330" cy="104" r="16" fill="#fff3b0" />
      {/* the town, small and in the shade, under the clouds */}
      <Px x={-1200} y={262} w={2800} h={60} c="#2c4a36" />
      {[30, 74, 118, 262, 308, 350].map((x, i) => (
        <g key={x}>
          <Px x={x} y={268 + (i % 2) * 3} w={16} h={14} c="#3a3f55" />
          <Px
            x={x + 6}
            y={272 + (i % 2) * 3}
            w={3}
            h={3}
            c={i === 3 ? "#ffe9a0" : "#1c2230"}
          />
        </g>
      ))}
      <g className="bh-shadow">
        <Px
          x={elevator ? TX - 4 : TX}
          y={256}
          w={terraces ? shadow * 0.6 : shadow}
          h={50}
          c="#000010"
          o={elevator ? 0.5 : terraces ? 0.2 : 0.35}
        />
      </g>
      {/* drifting clouds in front of the town, and one that crosses the floors */}
      <g className="bh-drift">
        <Cloud x={20} y={CLOUD_Y} w={110} />
        <Cloud x={250} y={CLOUD_Y + 4} w={120} />
      </g>
      <g className="bh-drift-b">
        <Cloud x={120} y={CLOUD_Y - 80} w={70} />
      </g>
      {info.fork === 2 && (
        <Px x={0} y={238} w={400} h={26} c="#fff3b0" o={0.18} />
      )}
      {/* the tower, leaning and wobbling when it needs steadying */}
      <g transform={`rotate(${info.lean * 0.5} ${TX} ${CLOUD_Y})`}>
        <g className={info.lean >= 3 ? "bh-wobble" : undefined}>
          <polygon
            points={`${TX - 20},${CLOUD_Y} ${TX + 20},${CLOUD_Y} ${TX + 12},${top} ${TX - 12},${top}`}
            fill={alloy > 0 ? "#b9c8d6" : "#8c97a8"}
          />
          <polygon
            points={`${TX + 6},${CLOUD_Y} ${TX + 20},${CLOUD_Y} ${TX + 12},${top} ${TX + 4},${top}`}
            fill="#5f6b7c"
          />
          {Array.from({ length: alloy }, (_, k) => (
            <g key={k} className={k % 2 ? "bh-glint" : "bh-glint-b"}>
              <Px
                x={TX - widthAt(CLOUD_Y - 30 - k * 36) + 2}
                y={CLOUD_Y - 30 - k * 36}
                w={5}
                h={22}
                c="#ffffff"
                o={0.5}
              />
            </g>
          ))}
          {Array.from({ length: floors }, (_, f) => {
            const y = CLOUD_Y - (f + 1) * 8 + 2;
            const w = widthAt(y);
            const eye = f === 9 && cables >= 3;
            return (
              <g key={f}>
                <Px
                  x={TX - w + 4}
                  y={y}
                  w={4}
                  h={4}
                  c={eye ? "#10151f" : "#ffe9a0"}
                />
                <Px
                  x={TX + w - 9}
                  y={y}
                  w={4}
                  h={4}
                  c="#ffe9a0"
                  o={f % 5 === 3 ? 0.25 : 1}
                />
                {eye && (
                  <g className="bh-blink">
                    <Px x={TX - w + 5} y={y + 1} w={1} h={2} c="#ffffff" />
                    <Px x={TX - w + 7} y={y + 1} w={1} h={2} c="#ffffff" />
                  </g>
                )}
              </g>
            );
          })}
          {/* the damper: a steel ball swinging inside a window */}
          {damper > 0 && (
            <g>
              <Px x={TX - 8} y={CLOUD_Y - 110} w={16} h={22} c="#1c2432" />
              <Px x={TX - 1} y={CLOUD_Y - 110} w={2} h={8} c="#cfd6df" />
              <g className="bh-ball">
                <circle
                  cx={TX}
                  cy={CLOUD_Y - 94 + damper * 1.5}
                  r={2 + damper}
                  fill="#cfd6df"
                />
                <circle
                  cx={TX - 1}
                  cy={CLOUD_Y - 95 + damper * 1.5}
                  r={1}
                  fill="#ffffff"
                />
              </g>
            </g>
          )}
          {/* a ring of ballast weights round the lower floors */}
          {ring > 0 &&
            [-1, 1].map((s) =>
              [0, 1].map((k) => (
                <circle
                  key={`${s}${k}`}
                  cx={TX + s * (22 + k * 8)}
                  cy={CLOUD_Y - 8 - k * 7}
                  r="4"
                  fill="#555566"
                />
              ))
            )}
          {/* terraces (grass ledges) or the elevator cable */}
          {terraces &&
            [0, 1, 2, 3].map((k) => {
              const y = CLOUD_Y - 36 - k * 38;
              if (y < top + 10) return null;
              return (
                <g key={k}>
                  <Px x={TX - 34} y={y} w={22} h={4} c="#6cc070" />
                  <Px x={TX + 14} y={y + 8} w={22} h={4} c="#6cc070" />
                  <Px x={TX - 30} y={y - 3} w={3} h={3} c="#ff8fb1" />
                </g>
              );
            })}
          {terraces && (
            <g className="bh-hop">
              <Bird x={TX - 28} y={CLOUD_Y - 42} c="#ffffff" />
            </g>
          )}
          {/* crew on a platform near the top, waving in one shared group */}
          <Px x={TX - 18} y={top + 12} w={36} h={3} c="#a4813f" />
          <g className="bh-wave">
            {Array.from({ length: crew }, (_, i) => (
              <g key={i}>
                <Px x={TX - 16 + i * 6} y={top + 5} w={3} h={3} c="#f3c9a0" />
                <Px x={TX - 16 + i * 6} y={top + 8} w={3} h={4} c="#ff8a2a" />
              </g>
            ))}
          </g>
          {/* wind tunnel flag and the loading dock */}
          {(info.projects & 1) !== 0 && (
            <g className="bh-sway">
              <Px x={TX + 12} y={top - 10} w={1} h={10} c="#444455" />
              <Px x={TX + 13} y={top - 10} w={9} h={5} c="#ffffff" />
            </g>
          )}
          {(info.projects & 2) !== 0 && (
            <g>
              <Px x={TX + 20} y={CLOUD_Y - 70} w={22} h={3} c="#a4813f" />
              <Px x={TX + 26} y={CLOUD_Y - 80} w={10} h={10} c="#c8a165" />
            </g>
          )}
          {info.overtime && (
            <g className="bh-blink">
              <Px x={TX - 4} y={top + 16} w={8} h={3} c="#ffb000" />
            </g>
          )}
          {/* the beacon */}
          {(own.beacon ?? 0) > 0 && (
            <g className="bh-blink">
              <circle
                cx={TX}
                cy={top - 6}
                r="7"
                fill="#ff4d4d"
                fillOpacity="0.3"
              />
              <circle cx={TX} cy={top - 6} r="3" fill="#ff4d4d" />
            </g>
          )}
        </g>
      </g>
      {/* cables spinning up into the dark: one shimmering group for all of them */}
      {cables > 0 && (
        <g className="bh-hum">
          {Array.from({ length: cables }, (_, i) => (
            <Px
              key={i}
              x={TX - 5 + i * 2 - (info.projects & 4 ? 2 : 0)}
              y={-40}
              w={info.projects & 4 ? 2 : 1}
              h={top + 40}
              c="#e6eef8"
              o={0.8}
            />
          ))}
        </g>
      )}
      {elevator && (
        <g>
          <Px x={TX - 1} y={-40} w={3} h={CLOUD_Y + 40} c="#fff3b0" o={0.6} />
          <g className="bh-climb">
            <Px x={TX - 4} y={150} w={9} h={7} c="#e8a317" />
          </g>
        </g>
      )}
      {cranes > 0 &&
        Array.from({ length: cranes }, (_, i) => (
          <CloudCrane key={i} x={[78, 318, 40][i]} n={i} />
        ))}
      {/* geese have to fly round the tower now */}
      <g className="bh-fly-b">
        <Bird x={0} y={120} c="#f2f2f2" />
        <Bird x={12} y={126} c="#f2f2f2" />
        <Bird x={24} y={120} c="#f2f2f2" />
      </g>
      {info.loadHere && (
        <g className="bh-pulse">
          <Px x={TX + 48} y={CLOUD_Y - 10} w={16} h={12} c="#c8a165" />
          <Px x={TX + 54} y={CLOUD_Y - 10} w={4} h={12} c="#e8554e" />
        </g>
      )}
    </g>
  );
}
