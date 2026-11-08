import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px, { Bird, Person } from "./Px";
import {
  DayDecor,
  DaySign,
  Foremen,
  Lights,
  LightsOnMoment,
  NightSky,
  Shadow,
} from "./TownMoments";

const GROUND = 262;
const TX = 200;
const FLOOR_H = 7;
const CRANE_CLASS = ["bh-arm", "bh-arm-b", "bh-arm-c"] as const;

interface Look {
  body: string;
  edge: string;
  trim: string;
}

const LOOKS: Record<number, Look> = {
  0: { body: "#c0654a", edge: "#8e4631", trim: "#e9c9a0" },
  1: { body: "#8ea3b8", edge: "#5f748a", trim: "#d7e6f2" },
  2: { body: "#b57a45", edge: "#6e4423", trim: "#7fb069" },
};

function Mason({ x, y, hat }: { x: number; y: number; hat: boolean }) {
  return (
    <g>
      <Person x={x} y={y} body="#e8803a" />
      {hat && <Px x={x} y={y - 1} w={5} h={2} c="#ffd23f" />}
    </g>
  );
}

const MASON_SPOTS = [
  [140, 252],
  [152, 224],
  [140, 196],
  [152, 168],
  [140, 140],
  [152, 112],
] as const;

function Crane({
  x,
  top,
  idx,
  heavy,
  slab,
}: {
  x: number;
  top: number;
  idx: number;
  heavy: boolean;
  slab: boolean;
}) {
  return (
    <g>
      <Px x={x} y={top} w={4} h={GROUND - top} c="#e8554e" />
      {Array.from({ length: Math.floor((GROUND - top) / 12) }, (_, k) => (
        <Px key={k} x={x - 1} y={top + k * 12} w={6} h={1} c="#8e2f2a" />
      ))}
      <g className={CRANE_CLASS[idx % 3]}>
        <Px x={x - 54} y={top - 4} w={74} h={4} c="#e8554e" />
        <Px x={x - 4} y={top - 12} w={12} h={8} c="#8e2f2a" />
        {heavy && <Px x={x + 14} y={top - 2} w={8} h={8} c="#555566" />}
        <Px x={x - 48} y={top} w={1} h={24} c="#444455" />
        {slab ? (
          <Px x={x - 56} y={top + 24} w={16} h={5} c="#9aa1ad" />
        ) : (
          <Px x={x - 52} y={top + 24} w={8} h={7} c="#e8a317" />
        )}
      </g>
    </g>
  );
}

function Truck({ x }: { x: number }) {
  return (
    <g>
      <Px x={x} y={GROUND - 12} w={12} h={10} c="#e8a317" />
      <Px x={x + 2} y={GROUND - 10} w={5} h={4} c="#9bd4ff" />
      <Px x={x + 12} y={GROUND - 14} w={20} h={12} c="#9aa1ad" />
      <Px x={x + 14} y={GROUND - 12} w={16} h={2} c="#cfd6df" />
      <Px x={x + 2} y={GROUND - 3} w={5} h={5} c="#2b2b38" />
      <Px x={x + 24} y={GROUND - 3} w={5} h={5} c="#2b2b38" />
    </g>
  );
}

/** The town: a tower with a crowd, cranes and scaffolding, and a window that waves. */
export default function TownLayer({ info }: { info: HigherSceneInfo }) {
  const own = info.own;
  const look = LOOKS[info.fork] ?? LOOKS[0];
  const floors = 4 + info.height * 2;
  const top = GROUND - floors * FLOOR_H;
  const half = info.fork === 2 ? 28 : 26;
  const left = TX - half;
  const hats = (info.projects & 1) !== 0;
  const masons = Math.min(6, own.mason ?? 0);
  const scaffold = Math.min(4, own.scaffolding ?? 0);
  const braces = Math.min(3, own["cross-braces"] ?? 0);
  const cranes = Math.min(3, Math.ceil((own.crane ?? 0) / 2));
  const trucks = Math.min(3, Math.ceil((own["concrete-truck"] ?? 0) / 2));
  const crowd = Math.max(2, 10 - info.height);
  const towerH = floors * FLOOR_H;
  // The cross-braces share the tower's height out between them.
  const braceStep = (towerH - 20) / Math.max(1, braces * 2);
  const braceH = Math.min(24, braceStep - 2);
  // Scaffolding climbs up the side, a little way past the top at most.
  const scaffoldTop = Math.max(top - 8, GROUND - scaffold * 56);
  const lonely = info.height >= 6;
  return (
    <g>
      <Px x={-1200} y={-1200} w={2800} h={1462} c="#9fd6ff" />
      <Px x={-1200} y={150} w={2800} h={120} c="#bfe6ff" o={0.5} />
      {info.day !== 2 && <circle cx="340" cy="46" r="18" fill="#ffe66d" />}
      {/* far hills and houses */}
      <Px x={-1200} y={216} w={2800} h={50} c="#7ec27a" />
      {[18, 60, 108, 290, 336, 372].map((x, i) => (
        <g key={x}>
          <Px
            x={x}
            y={206 + (i % 2) * 4}
            w={22}
            h={22}
            c={["#e9c9a0", "#d8a48f", "#f1e2b8"][i % 3]}
          />
          <Px x={x - 2} y={202 + (i % 2) * 4} w={26} h={5} c="#9a4a3a" />
          <Px x={x + 8} y={214 + (i % 2) * 4} w={5} h={8} c="#6e4423" />
        </g>
      ))}
      {/* clouds slide past the floors */}
      <g className="bh-drift">
        <Px x={20} y={34} w={46} h={10} c="#ffffff" o={0.85} />
        <Px x={34} y={28} w={26} h={8} c="#ffffff" o={0.85} />
      </g>
      <g className="bh-drift-b">
        <Px x={230} y={58} w={38} h={8} c="#ffffff" o={0.75} />
        <Px x={242} y={53} w={18} h={6} c="#ffffff" o={0.75} />
      </g>
      {/* a kite, early on */}
      {info.height < 6 && (
        <g className="bh-sway">
          <polygon points="316,80 324,92 316,104 308,92" fill="#e8554e" />
          <Px x={315} y={104} w={1} h={26} c="#ffffff" o={0.7} />
        </g>
      )}
      {/* ground and what is under it */}
      <Px x={-1200} y={GROUND} w={2800} h={60} c="#79c46a" />
      <Px x={-1200} y={GROUND + 6} w={2800} h={60} c="#6b4a2c" />
      {info.footing > 0 && (
        <Px
          x={TX - half - 6 - info.footing * 8}
          y={GROUND + 4}
          w={half * 2 + 12 + info.footing * 16}
          h={6 + info.footing * 8}
          c="#9aa1ad"
        />
      )}
      {(info.projects & 2) !== 0 && (
        <g>
          <Px x={TX + 52} y={GROUND - 12} w={14} h={12} c="#e8a317" />
          <g className="bh-spin-slow">
            <Px x={TX + 54} y={GROUND - 9} w={10} h={6} c="#cfd6df" />
          </g>
        </g>
      )}
      {info.day === 2 && <NightSky />}
      {/* the shadow dims the town; lamps and the park shine through it */}
      <Shadow shade={info.shade} />
      <DayDecor day={info.day} />
      <Lights info={info} />
      {/* the tower, leaning with the build pace */}
      <g transform={`rotate(${info.lean * 0.6} ${TX} ${GROUND})`}>
        <g className={info.lean >= 3 ? "bh-wobble" : undefined}>
          <Px
            x={left}
            y={top}
            w={half * 2}
            h={floors * FLOOR_H}
            c={look.body}
          />
          <Px x={left} y={top} w={4} h={floors * FLOOR_H} c={look.edge} />
          <Px
            x={left + half * 2 - 4}
            y={top}
            w={4}
            h={floors * FLOOR_H}
            c={look.edge}
          />
          {info.fork === 1 && (
            <g className="bh-glint">
              <Px
                x={left + 10}
                y={top}
                w={4}
                h={floors * FLOOR_H}
                c="#ffffff"
                o={0.35}
              />
            </g>
          )}
          {Array.from({ length: floors }, (_, f) => (
            <g key={f}>
              <Px
                x={left}
                y={top + f * FLOOR_H}
                w={half * 2}
                h={1}
                c={look.edge}
              />
              {[0, 1, 2].map((c) => {
                const y = GROUND - (f + 1) * FLOOR_H + 2;
                const x = left + 8 + c * 14;
                const hello = f === 3 && c === 1;
                const eye = f === 12 && c === 0 && info.height >= 9;
                return (
                  <g key={c}>
                    <Px
                      x={x}
                      y={y}
                      w={7}
                      h={4}
                      c={eye ? "#1c2432" : "#ffe9a0"}
                    />
                    {hello && !lonely && (
                      <g className="bh-wave">
                        <Px x={x + 2} y={y} w={3} h={3} c="#f3c9a0" />
                      </g>
                    )}
                    {eye && (
                      <g className="bh-blink">
                        <Px x={x + 1} y={y + 1} w={2} h={2} c="#ffffff" />
                        <Px x={x + 4} y={y + 1} w={2} h={2} c="#ffffff" />
                      </g>
                    )}
                  </g>
                );
              })}
              {info.fork === 2 && f % 4 === 2 && (
                <g>
                  <Px
                    x={left - 5}
                    y={GROUND - (f + 1) * FLOOR_H + 5}
                    w={7}
                    h={2}
                    c="#6e4423"
                  />
                  <Px
                    x={left - 4}
                    y={GROUND - (f + 1) * FLOOR_H + 2}
                    w={4}
                    h={3}
                    c={look.trim}
                  />
                </g>
              )}
            </g>
          ))}
          <Px x={TX - 1} y={top - 14} w={2} h={14} c="#555566" />
          <Px x={TX + 1} y={top - 14} w={8} h={5} c="#e8554e" />
          {info.overtime && (
            <g className="bh-blink">
              <Px x={TX - 4} y={top - 18} w={8} h={4} c="#ffb000" />
            </g>
          )}
          {/* cross-braces: iron Xs inside the walls */}
          {Array.from({ length: braces * 2 }, (_, k) => {
            const yb = GROUND - 10 - k * braceStep;
            const x0 = left + 2;
            const x1 = left + half * 2 - 2;
            return (
              <g key={k}>
                <polygon
                  points={`${x0},${yb} ${x1},${yb - braceH} ${x1},${yb - braceH + 2} ${x0},${yb + 2}`}
                  fill="#4a4a5a"
                />
                <polygon
                  points={`${x1},${yb} ${x0},${yb - braceH} ${x0},${yb - braceH + 2} ${x1},${yb + 2}`}
                  fill="#4a4a5a"
                />
              </g>
            );
          })}
          {/* safety nets, a quarter, half and three quarters of the way up */}
          {(own["safety-nets"] ?? 0) > 0 &&
            [0.25, 0.5, 0.75].map((share) => {
              const y = GROUND - towerH * share;
              return (
                <g key={share}>
                  <Px x={left - 8} y={y} w={half * 2 + 16} h={3} c="#ff9a3c" />
                  <Px
                    x={left - 8}
                    y={y + 3}
                    w={half * 2 + 16}
                    h={1}
                    c="#ff9a3c"
                    o={0.5}
                  />
                </g>
              );
            })}
          {/* the big neon sign */}
          {(own["neon-sign"] ?? 0) > 0 && (
            <g className="bh-pulse">
              <Px
                x={left + 6}
                y={top + 12}
                w={half * 2 - 12}
                h={10}
                c="#2b1b4a"
              />
              {[0, 1, 2, 3, 4].map((k) => (
                <Px
                  key={k}
                  x={left + 9 + k * 8}
                  y={top + 15}
                  w={5}
                  h={4}
                  c={["#ff4d9d", "#4dd2ff", "#ffe14d", "#ff4d9d", "#4dd2ff"][k]}
                />
              ))}
            </g>
          )}
        </g>
      </g>
      {/* scaffolding climbs the side like ivy */}
      {scaffold > 0 && (
        <g>
          {Array.from(
            { length: Math.ceil((GROUND - scaffoldTop) / 28) + 1 },
            (_, k) => (
              <g key={k}>
                <Px
                  x={left - 24}
                  y={GROUND - k * 28}
                  w={22}
                  h={2}
                  c="#c8a165"
                />
                <polygon
                  points={`${left - 24},${GROUND - k * 28} ${left - 2},${GROUND - k * 28 - 28} ${left - 2},${GROUND - k * 28 - 27} ${left - 23},${GROUND - k * 28 + 1}`}
                  fill="#a4813f"
                />
              </g>
            )
          )}
          <Px
            x={left - 24}
            y={scaffoldTop}
            w={2}
            h={GROUND - scaffoldTop}
            c="#a4813f"
          />
          <Px
            x={left - 3}
            y={scaffoldTop}
            w={2}
            h={GROUND - scaffoldTop}
            c="#a4813f"
          />
          {/* a traffic cone at the foot for every level of scaffolding */}
          {Array.from({ length: scaffold }, (_, i) => (
            <Px
              key={`cone${i}`}
              x={left - 24 + i * 6}
              y={GROUND - 5}
              w={4}
              h={5}
              c="#ff7a1a"
            />
          ))}
        </g>
      )}
      {/* masons: one shared bobbing group */}
      <g className="bh-bob">
        {MASON_SPOTS.slice(0, masons).map(([x, y], i) => (
          <Mason
            key={i}
            x={x + (scaffold > 0 ? 0 : 6)}
            y={Math.max(y, 0)}
            hat={hats}
          />
        ))}
      </g>
      {/* tower cranes */}
      {Array.from({ length: cranes }, (_, i) => (
        <Crane
          key={i}
          x={262 + i * 38}
          top={Math.max(24, top - 6 - i * 14)}
          idx={i}
          heavy={(own.crane ?? 0) >= 4}
          slab={(info.projects & 4) !== 0}
        />
      ))}
      {/* concrete trucks drive along the street in one group */}
      {trucks > 0 && (
        <g className="bh-drive">
          {Array.from({ length: trucks }, (_, i) => (
            <Truck key={i} x={-60 - i * 80} />
          ))}
        </g>
      )}
      {/* pigeons on the scaffold */}
      {scaffold > 0 && (
        <g className="bh-fly">
          <Bird x={10} y={96} />
          <Bird x={28} y={106} />
        </g>
      )}
      {/* the crowd cheers, and is a little smaller each time you look */}
      <g className="bh-hop">
        {Array.from({ length: crowd }, (_, i) => (
          <Person
            key={i}
            x={i % 2 === 0 ? 40 + i * 10 : 270 + i * 8}
            y={GROUND - 12 + (i % 3)}
            body={["#4aa3df", "#e8554e", "#6cc070", "#f2b134"][i % 4]}
          />
        ))}
      </g>
      <Foremen info={info} />
      <DaySign day={info.day} />
      {info.lit && <LightsOnMoment info={info} />}
      {info.loadHere && (
        <g className="bh-pulse">
          <Px x={TX + 64} y={GROUND - 14} w={18} h={14} c="#c8a165" />
          <Px x={TX + 71} y={GROUND - 14} w={4} h={14} c="#e8554e" />
        </g>
      )}
    </g>
  );
}
