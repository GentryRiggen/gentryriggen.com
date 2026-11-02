import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import Px from "./Px";

const BLOCKS = [
  "#e8554e",
  "#f2b134",
  "#4aa3df",
  "#6cc070",
  "#a77bd8",
  "#ff8fb1",
] as const;
const BASE_Y = 250;
const TOWER_X = 200;

/** The loose big blocks from the bottom of the box, piled by the wall. */
function BigPile({ n }: { n: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <Px
            x={34 + (i % 2) * 18}
            y={BASE_Y - 14 - Math.floor(i / 2) * 14}
            w={16}
            h={14}
            c={BLOCKS[(i + 2) % 6]}
          />
          <Px
            x={34 + (i % 2) * 18}
            y={BASE_Y - 14 - Math.floor(i / 2) * 14}
            w={16}
            h={3}
            c="#ffffff"
            o={0.35}
          />
        </g>
      ))}
    </g>
  );
}

function Bear({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Px x={x - 1} y={y - 12} w={4} h={4} c="#9a6a3f" />
      <Px x={x + 8} y={y - 12} w={4} h={4} c="#9a6a3f" />
      <Px x={x} y={y - 10} w={11} h={8} c="#b98550" />
      <Px x={x + 2} y={y - 7} w={2} h={2} c="#2b2b38" />
      <Px x={x + 7} y={y - 7} w={2} h={2} c="#2b2b38" />
      <Px x={x + 4} y={y - 5} w={3} h={2} c="#6b4423" />
      <Px x={x - 1} y={y - 2} w={13} h={9} c="#b98550" />
      <Px x={x + 3} y={y} w={5} h={5} c="#e6c08f" />
    </g>
  );
}

const BEAR_SPOTS = [
  [92, 276],
  [118, 280],
  [146, 276],
  [252, 278],
  [282, 276],
  [310, 280],
] as const;

function Cat() {
  return (
    <g>
      <Px x={326} y={262} w={14} h={9} c="#2b2b38" />
      <Px x={336} y={256} w={9} h={8} c="#2b2b38" />
      <Px x={336} y={253} w={2} h={3} c="#2b2b38" />
      <Px x={343} y={253} w={2} h={3} c="#2b2b38" />
      <Px x={338} y={259} w={2} h={2} c="#ffe14d" />
      <Px x={343} y={259} w={2} h={2} c="#ffe14d" />
      <g className="bh-tail">
        <Px x={321} y={258} w={5} h={3} c="#2b2b38" />
        <Px x={319} y={254} w={3} h={5} c="#2b2b38" />
      </g>
    </g>
  );
}

function Crane({ x, n, late }: { x: number; n: number; late?: boolean }) {
  const mast = Math.min(120, 56 + n * 10);
  const top = BASE_Y - mast;
  return (
    <g>
      <Px x={x - 6} y={BASE_Y - 4} w={16} h={4} c="#8a6d12" />
      <Px x={x} y={top} w={4} h={mast} c="#f2c230" />
      <g className={late ? "bh-arm-b" : "bh-arm"}>
        <Px x={x - 50} y={top - 4} w={64} h={4} c="#f2c230" />
        <Px x={x + 4} y={top - 10} w={8} h={8} c="#8a6d12" />
        <Px x={x - 44} y={top} w={1} h={26} c="#444455" />
        <Px x={x - 48} y={top + 26} w={9} h={8} c={BLOCKS[n % 6]} />
      </g>
    </g>
  );
}

/** The playroom: a rug, a block tower and everything that helps build it. */
export default function PlayroomLayer({ info }: { info: HigherSceneInfo }) {
  const own = info.own;
  const bigBlocks = own["big-blocks"] ?? 0;
  const blocks = 3 + info.height;
  const bh = 9 + Math.min(4, bigBlocks);
  const bw = 24 + 3 * bigBlocks;
  const tall = info.fork === 1;
  const wide = info.fork === 2;
  const towerLeft = (i: number): number => {
    const w = widthAt(i);
    return TOWER_X - w / 2 + ((i % 3) - 1);
  };
  function widthAt(i: number): number {
    if (tall) return bw * 0.62;
    if (wide) return bw * (1.55 - (0.65 * i) / blocks);
    return bw * (1 - (0.15 * i) / blocks);
  }
  const bears = Math.min(6, own.bear ?? 0);
  const rugCorners = Math.min(3, own["rug-corners"] ?? 0);
  const conveyor = Math.min(7, 1 + (own.ramp ?? 0));
  const lean = info.lean;
  return (
    <g>
      {/* wall, window and floor */}
      <Px x={-1200} y={-1200} w={2800} h={1410} c="#f6e3c4" />
      <Px x={-1200} y={206} w={2800} h={1200} c="#c8935b" />
      <Px x={-1200} y={202} w={2800} h={6} c="#8b5e34" />
      <Px x={30} y={36} w={78} h={78} c="#8b5e34" />
      <Px x={35} y={41} w={68} h={68} c="#9bd4ff" />
      <Px x={68} y={41} w={3} h={68} c="#8b5e34" />
      <Px x={35} y={73} w={68} h={3} c="#8b5e34" />
      <g className="bh-spin-slow">
        <Px x={44} y={48} w={14} h={14} c="#ffe66d" />
      </g>
      <g className="bh-plane">
        <Px x={36} y={90} w={8} h={3} c="#ffffff" />
        <Px x={40} y={88} w={3} h={2} c="#d9e4ee" />
      </g>
      {/* rug */}
      <Px x={60} y={238} w={280} h={52} c="#2f6fb3" />
      <Px x={66} y={243} w={268} h={42} c="#e8c14d" o={0.28} />
      <Px x={60} y={238} w={280} h={4} c="#ffffff" o={0.3} />
      {Array.from({ length: rugCorners }, (_, i) => (
        <Px
          key={i}
          x={[60, 330, 60, 330][i]}
          y={[238, 238, 282, 282][i]}
          w={10}
          h={8}
          c="#ffd23f"
        />
      ))}
      <BigPile n={bigBlocks} />
      {/* foundations: wide base blocks under the tower */}
      {info.footing > 0 && (
        <g>
          <Px
            x={TOWER_X - 26 - info.footing * 8}
            y={BASE_Y}
            w={52 + info.footing * 16}
            h={6}
            c="#9aa1ad"
          />
          <Px
            x={TOWER_X - 26 - info.footing * 8}
            y={BASE_Y}
            w={52 + info.footing * 16}
            h={2}
            c="#ffffff"
            o={0.35}
          />
        </g>
      )}
      {/* the tower, leaning when it needs steadying */}
      <g transform={`rotate(${lean * 0.9} ${TOWER_X} ${BASE_Y})`}>
        <g className={lean >= 3 ? "bh-wobble" : undefined}>
          {Array.from({ length: blocks }, (_, i) => (
            <g key={i}>
              <Px
                x={towerLeft(i)}
                y={BASE_Y - (i + 1) * bh}
                w={widthAt(i)}
                h={bh}
                c={BLOCKS[i % 6]}
              />
              <Px
                x={towerLeft(i)}
                y={BASE_Y - (i + 1) * bh}
                w={widthAt(i)}
                h={2}
                c="#ffffff"
                o={0.35}
              />
            </g>
          ))}
          {/* fairy lights wound round it */}
          {(own["fairy-lights"] ?? 0) > 0 && (
            <g>
              <g className="bh-twinkle">
                {Array.from({ length: Math.ceil(blocks / 2) }, (_, k) => (
                  <Px
                    key={k}
                    x={towerLeft(2 * k) - 2}
                    y={BASE_Y - (2 * k + 1) * bh - 1}
                    w={3}
                    h={3}
                    c="#fff3b0"
                  />
                ))}
              </g>
              <g className="bh-twinkle-b">
                {Array.from({ length: Math.floor(blocks / 2) }, (_, k) => (
                  <Px
                    key={k}
                    x={towerLeft(2 * k + 1) + widthAt(2 * k + 1) - 1}
                    y={BASE_Y - (2 * k + 2) * bh - 1}
                    w={3}
                    h={3}
                    c="#ff8fb1"
                  />
                ))}
              </g>
            </g>
          )}
          <Px
            x={TOWER_X - 1}
            y={BASE_Y - blocks * bh - 14}
            w={2}
            h={14}
            c="#8b5e34"
          />
          <Px
            x={TOWER_X + 1}
            y={BASE_Y - blocks * bh - 14}
            w={9}
            h={6}
            c="#e8554e"
          />
        </g>
      </g>
      {/* a cardboard ramp with blocks rolling up it */}
      {(own.ramp ?? 0) > 0 && (
        <g>
          <polygon points="96,250 190,250 190,203" fill="#c8a165" />
          <polygon points="96,250 190,203 190,208 100,250" fill="#a4813f" />
          <g className="bh-roll">
            {Array.from({ length: conveyor }, (_, i) => (
              <Px
                key={i}
                x={100 + i * 14}
                y={242 - i * 7}
                w={7}
                h={6}
                c={BLOCKS[(i + 1) % 6]}
              />
            ))}
          </g>
        </g>
      )}
      {/* cushion fort */}
      {(own["cushion-fort"] ?? 0) > 0 && (
        <g>
          <Px x={TOWER_X - 52} y={BASE_Y - 8} w={26} h={14} c="#ff8fb1" />
          <Px x={TOWER_X + 26} y={BASE_Y - 8} w={26} h={14} c="#8fd6a8" />
          <Px x={TOWER_X - 40} y={BASE_Y - 14} w={20} h={8} c="#ffd23f" />
          <Px x={TOWER_X + 20} y={BASE_Y - 14} w={20} h={8} c="#a77bd8" />
        </g>
      )}
      {/* toy cranes */}
      {(own["toy-crane"] ?? 0) > 0 && (
        <Crane x={300} n={own["toy-crane"] ?? 0} />
      )}
      {(own["toy-crane"] ?? 0) >= 4 && <Crane x={352} n={3} late />}
      {/* teddy stackers hop in two shared groups */}
      <g className="bh-hop">
        {BEAR_SPOTS.slice(0, bears).map(([x, y], i) =>
          i % 2 === 0 ? <Bear key={i} x={x} y={y} /> : null
        )}
      </g>
      <g className="bh-hop-b">
        {BEAR_SPOTS.slice(0, bears).map(([x, y], i) =>
          i % 2 === 1 ? <Bear key={i} x={x} y={y} /> : null
        )}
      </g>
      {bears >= 4 && <Cat />}
      {info.loadHere && (
        <g className="bh-pulse">
          <Px x={224} y={262} w={20} h={16} c="#c8a165" />
          <Px x={232} y={262} w={4} h={16} c="#e8554e" />
          <Px x={224} y={268} w={20} h={3} c="#e8554e" />
        </g>
      )}
    </g>
  );
}
