import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px, { Bird, Person } from "./Px";

/** The corners of the zigzag stair, top to bottom. */
const LANDINGS = [
  [70, 52],
  [330, 82],
  [70, 122],
  [330, 152],
  [70, 192],
  [330, 222],
] as const;
const GROUND = 250;

/** Where the robot is along the stairs, for a share of the way down. */
function robotAt(share: number): { x: number; y: number } {
  const s = Math.min(0.999, Math.max(0, share)) * (LANDINGS.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const [x0, y0] = LANDINGS[i];
  const [x1, y1] = LANDINGS[i + 1];
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f };
}

function Robot({ x, y, pack }: { x: number; y: number; pack: number }) {
  return (
    <g>
      <Px x={x - 4} y={y - 16} w={9} h={8} c="#9fb4c8" />
      <Px x={x - 2} y={y - 14} w={2} h={2} c="#1c2432" />
      <Px x={x + 1} y={y - 14} w={2} h={2} c="#1c2432" />
      <Px x={x} y={y - 20} w={1} h={4} c="#9fb4c8" />
      <Px x={x - 5} y={y - 8} w={11} h={9} c="#6f8aa3" />
      <Px x={x - 5 - pack} y={y - 8} w={pack} h={7} c="#a4813f" />
      <Px x={x - 3} y={y + 1} w={3} h={4} c="#4a5d70" />
      <Px x={x + 2} y={y + 1} w={3} h={4} c="#4a5d70" />
    </g>
  );
}

/** The top: a long way down, a quiet town and one small block to carry. */
export default function TopLayer({ info }: { info: HigherSceneInfo }) {
  const own = info.own;
  const share = info.descent / 20;
  const lamps = Math.min(6, own["stair-lamp"] ?? 0);
  const birds = Math.min(6, own.songbird ?? 0);
  const notes = Math.min(6, own.hum ?? 0);
  const lighter = Math.min(4, own["light-load"] ?? 0);
  const lift = info.fork === 2;
  const down = (own["set-down"] ?? 0) > 0;
  const robot = robotAt(down ? 1 : share);
  const dawn = share >= 0.8;
  const dusk = share >= 0.4;
  const sky = dawn ? "#f6c68a" : dusk ? "#5a4f8f" : "#141a45";
  const lower = dawn ? "#fbe3b4" : dusk ? "#c47f8c" : "#2a3270";
  const pack = Math.max(2, 7 - lighter * 1.2);
  return (
    <g>
      <Px x={-1200} y={-1200} w={2800} h={1460} c={sky} />
      <Px x={-1200} y={110} w={2800} h={150} c={lower} o={0.8} />
      {!dawn && (
        <g className="bh-twinkle">
          {[24, 90, 150, 214, 270, 330, 372].map((x, i) => (
            <Px key={x} x={x} y={8 + (i % 3) * 16} w={2} h={2} c="#ffffff" />
          ))}
        </g>
      )}
      <g className="bh-drift-b">
        <Px x={150} y={90} w={60} h={9} c="#ffffff" o={0.5} />
        <Px x={168} y={84} w={28} h={7} c="#ffffff" o={0.5} />
      </g>
      {/* the great tower, every window lit and nobody looking out */}
      <Px x={-4} y={0} w={44} h={GROUND} c="#39425e" />
      {Array.from({ length: 12 }, (_, f) => (
        <g key={f}>
          <Px x={4} y={6 + f * 20} w={6} h={5} c="#ffe9a0" />
          <Px
            x={16}
            y={6 + f * 20}
            w={6}
            h={5}
            c="#ffe9a0"
            o={f % 3 === 1 ? 0.3 : 1}
          />
          <Px x={28} y={6 + f * 20} w={6} h={5} c="#ffe9a0" />
        </g>
      ))}
      {/* the town and its lamp, switched on for no one */}
      <Px
        x={-1200}
        y={GROUND}
        w={2800}
        h={60}
        c={dawn ? "#7fcf6a" : "#2f6a3a"}
      />
      {share >= 0.5 && (
        <g>
          {[100, 150, 250].map((x, i) => (
            <g key={x}>
              <Px
                x={x}
                y={GROUND - 14 - (i % 2) * 4}
                w={22}
                h={14 + (i % 2) * 4}
                c="#555d7a"
              />
              <Px x={x + 8} y={GROUND - 9} w={4} h={4} c="#ffe9a0" />
            </g>
          ))}
          <Px x={200} y={GROUND - 22} w={2} h={22} c="#2b2b38" />
          <Px x={196} y={GROUND - 26} w={10} h={4} c="#ffe14d" />
        </g>
      )}
      {/* the stairs, or the old lift */}
      {!lift &&
        LANDINGS.slice(0, -1).map(([x0, y0], i) => {
          const [x1, y1] = LANDINGS[i + 1];
          return (
            <g key={i}>
              {Array.from({ length: 13 }, (_, k) => (
                <Px
                  key={k}
                  x={x0 + ((x1 - x0) * k) / 12 - 6}
                  y={y0 + ((y1 - y0) * k) / 12 + 4}
                  w={12}
                  h={3}
                  c="#8d95a8"
                />
              ))}
              <polygon
                points={`${x0},${y0 - 8} ${x1},${y1 - 8} ${x1},${y1 - 7} ${x0},${y0 - 7}`}
                fill="#5f6b7c"
              />
              {/* the stairs were chosen: a warm handrail with posts */}
              {info.fork === 1 &&
                Array.from({ length: 5 }, (_, k) => (
                  <Px
                    key={`post${k}`}
                    x={x0 + ((x1 - x0) * k) / 4}
                    y={y0 - 15 + ((y1 - y0) * k) / 4}
                    w={2}
                    h={8}
                    c="#e8a317"
                  />
                ))}
            </g>
          );
        })}
      {lift && (
        <g>
          <Px x={176} y={0} w={48} h={GROUND} c="#2b3350" />
          <Px x={196} y={0} w={1} h={Math.max(20, robot.y - 30)} c="#9aa1ad" />
          <g className="bh-creak">
            <Px
              x={180}
              y={Math.max(20, robot.y - 24)}
              w={40}
              h={34}
              c="#6a5a3a"
            />
            <Px
              x={184}
              y={Math.max(20, robot.y - 20)}
              w={32}
              h={26}
              c="#2b3350"
            />
          </g>
        </g>
      )}
      {/* lamps on the landings */}
      {lamps > 0 && (
        <g className="bh-glow">
          {LANDINGS.slice(0, lamps).map(([x, y]) => (
            <g key={`${x}${y}`}>
              <circle
                cx={x}
                cy={y - 14}
                r="8"
                fill="#ffd45e"
                fillOpacity="0.22"
              />
              <Px x={x - 1} y={y - 18} w={3} h={6} c="#ffd45e" />
            </g>
          ))}
        </g>
      )}
      {/* things the robot has set down along the way */}
      {Array.from({ length: lighter }, (_, i) => (
        <Px
          key={i}
          x={LANDINGS[i + 1][0] + (i % 2 ? -26 : 20)}
          y={LANDINGS[i + 1][1] + 1}
          w={6}
          h={3}
          c={["#cfd6df", "#e8a317", "#e8554e", "#6cc070"][i]}
        />
      ))}
      {(own["rest-bench"] ?? 0) > 0 && (
        <g>
          <Px x={300} y={142} w={24} h={3} c="#8b5e34" />
          <Px x={302} y={145} w={2} h={6} c="#6e4423" />
          <Px x={320} y={145} w={2} h={6} c="#6e4423" />
          <Px x={300} y={136} w={24} h={2} c="#8b5e34" />
        </g>
      )}
      {(own["window-seat"] ?? 0) > 0 && (
        <g>
          <Px x={92} y={92} w={30} h={24} c="#2b3350" />
          <Px x={95} y={95} w={24} h={18} c={dawn ? "#f6c68a" : "#7a86c8"} />
          <Px x={92} y={114} w={30} h={5} c="#a77bd8" />
        </g>
      )}
      {/* songbirds sit on the rail in one bobbing group */}
      <g className="bh-bob">
        {Array.from({ length: birds }, (_, i) => (
          <Bird
            key={i}
            x={110 + i * 34}
            y={LANDINGS[0][1] + 10 + i * 4}
            c="#ffd45e"
          />
        ))}
      </g>
      {/* the robot, its block and the tune it hums */}
      <Robot x={robot.x} y={robot.y} pack={pack} />
      {(own["block-lantern"] ?? 0) > 0 && (
        <g className="bh-glow">
          <circle
            cx={robot.x - 7}
            cy={robot.y - 4}
            r="9"
            fill="#ffd45e"
            fillOpacity="0.3"
          />
        </g>
      )}
      <g className="bh-note">
        {Array.from({ length: notes }, (_, i) => (
          <g key={i}>
            <Px
              x={robot.x + 8 + i * 6}
              y={robot.y - 26 - i * 4}
              w={2}
              h={5}
              c="#ffffff"
            />
            <Px
              x={robot.x + 6 + i * 6}
              y={robot.y - 22 - i * 4}
              w={3}
              h={2}
              c="#ffffff"
            />
          </g>
        ))}
      </g>
      {share >= 0.6 && (
        <g className="bh-fly">
          <Bird x={0} y={40} c="#f2f2f2" />
          <Bird x={12} y={46} c="#f2f2f2" />
        </g>
      )}
      {/* the block on the grass, and a kid who wants to play */}
      {down && (
        <g>
          <Px x={196} y={GROUND - 7} w={7} h={7} c="#a4813f" />
          {info.visitorHere && (
            <g>
              <Px x={203} y={GROUND - 14} w={7} h={7} c="#e8554e" />
              <Px x={203} y={GROUND - 7} w={7} h={7} c="#4aa3df" />
              <g className="bh-hop">
                <Person x={216} y={GROUND - 12} body="#6cc070" />
              </g>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
