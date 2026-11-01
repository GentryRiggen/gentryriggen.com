import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { Season } from "@/lib/ever-onward/universes/grow/seasons";
import {
  BARROW,
  BED_H,
  BED_W,
  FRAME,
  GREENHOUSE,
  KEEPER,
  SILL_BOX,
  SPROUT,
  STAND,
  SUN,
  TEA,
  TREES,
  barrelAt,
  basketAt,
  bedAt,
  gardenerAt,
  hiveAt,
} from "./anchors";

interface Look {
  sky: string;
  ground: string;
  leaf: string;
  bloom: string;
}

const LOOKS: Record<Season, Look> = {
  spring: {
    sky: "#a8dcff",
    ground: "#79c46a",
    leaf: "#3f9d3a",
    bloom: "#ffb3d1",
  },
  summer: {
    sky: "#6fc3ff",
    ground: "#5aae48",
    leaf: "#2f8a2a",
    bloom: "#ffe14d",
  },
  autumn: {
    sky: "#f3c9a0",
    ground: "#c5a64e",
    leaf: "#b8741f",
    bloom: "#e8590c",
  },
  winter: {
    sky: "#cfd9e6",
    ground: "#cddde8",
    leaf: "#8aa59a",
    bloom: "#ffffff",
  },
};

const SOIL_WET = "#4a2f18";
const SOIL_DRY = "#c9a56a";

function Bed({
  i,
  info,
  look,
}: {
  i: number;
  info: GrowSceneInfo;
  look: Look;
}) {
  const { x, y } = bedAt(i);
  const grown = 3 + Math.round(info.bloom * 11);
  const isWinter = info.season === "winter";
  const height = isWinter ? 3 : grown;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={BED_W}
        height={BED_H}
        fill={info.dry ? SOIL_DRY : SOIL_WET}
      />
      <rect x={x} y={y} width={BED_W} height="3" fill="#8b5e34" />
      {info.dry && (
        <path
          d={`M${x + 10} ${y + 6}l6 4M${x + 34} ${y + 8}l7 3M${x + 50} ${y + 5}l-4 6`}
          stroke="#8a6a38"
          strokeWidth="1"
          fill="none"
        />
      )}
      {[0, 1, 2, 3, 4].map((p) => (
        <g key={p}>
          <rect
            x={x + 6 + p * 12}
            y={y - height + 2}
            width="3"
            height={height}
            fill={look.leaf}
          />
          {info.bloom >= 0.4 && !isWinter && (
            <rect
              x={x + 4 + p * 12}
              y={y - height - 2}
              width="7"
              height="5"
              fill={look.bloom}
            />
          )}
        </g>
      ))}
      {info.sprinklers > 0 && !info.dry && info.waterFraction > 0 && (
        <g fill="#7cc4ff" fillOpacity="0.9">
          <rect x={x + 28} y={y - 18} width="2" height="3" />
          <rect x={x + 20} y={y - 14} width="2" height="3" />
          <rect x={x + 36} y={y - 14} width="2" height="3" />
          <rect x={x + 29} y={y - 9} width="4" height="3" />
        </g>
      )}
    </g>
  );
}

function Hive({ i }: { i: number }) {
  const { x, y } = hiveAt(i);
  return (
    <g>
      <rect x={x} y={y} width="16" height="14" fill="#f5c542" />
      <rect x={x} y={y + 5} width="16" height="2" fill="#8a5a12" />
      <rect x={x - 1} y={y - 2} width="18" height="3" fill="#8a5a12" />
      <rect x={x + 6} y={y + 9} width="4" height="3" fill="#3b2a10" />
      <rect x={x + 3} y={y - 8} width="2" height="2" fill="#ffe14d" />
      <rect x={x + 12} y={y - 12} width="2" height="2" fill="#ffe14d" />
    </g>
  );
}

function Barrel({ i, info }: { i: number; info: GrowSceneInfo }) {
  const { x, y } = barrelAt(i);
  const fill = Math.round(info.waterFraction * 20);
  return (
    <g>
      <rect x={x} y={y} width="14" height="22" fill="#5b7fa3" />
      <rect x={x} y={y + 6} width="14" height="2" fill="#35516e" />
      <rect x={x} y={y + 15} width="14" height="2" fill="#35516e" />
      <rect
        x={x + 2}
        y={y + 21 - fill}
        width="10"
        height={fill}
        fill="#7cc4ff"
      />
    </g>
  );
}

function Gardener({ i }: { i: number }) {
  const { x, y } = gardenerAt(i);
  return (
    <g>
      <rect x={x} y={y + 6} width="12" height="10" fill="#9aa5b1" />
      <rect x={x + 2} y={y} width="8" height="6" fill="#c7d0d9" />
      <rect x={x + 3} y={y + 2} width="2" height="2" fill="#1f6f3a" />
      <rect x={x + 7} y={y + 2} width="2" height="2" fill="#1f6f3a" />
      <rect x={x + 12} y={y + 4} width="2" height="12" fill="#8b5e34" />
    </g>
  );
}

/** The backyard: a window box on the sill, opening out into the garden. */
export default function YardLayer({ info }: { info: GrowSceneInfo }) {
  const look = LOOKS[info.season];
  const beds = Array.from({ length: info.beds }, (_, i) => i);
  const baskets = Math.min(8, Math.max(0, info.pickers - info.gardeners));
  const sprout = 14 + info.scaling * 4;
  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="1340" fill={look.sky} />
      {info.season === "summer" && (
        <circle cx={SUN.x} cy={SUN.y} r="18" fill="#ffe66d" />
      )}
      {info.season !== "winter" && info.season !== "summer" && (
        <circle cx={SUN.x} cy={SUN.y} r="12" fill="#fff3b0" />
      )}
      <rect
        x="40"
        y="30"
        width="46"
        height="10"
        fill="#ffffff"
        fillOpacity="0.8"
      />
      <rect
        x="60"
        y="24"
        width="30"
        height="10"
        fill="#ffffff"
        fillOpacity="0.8"
      />
      <rect x="-1200" y="136" width="2800" height="130" fill={look.ground} />
      {info.dry && (
        <rect
          x="-1200"
          y="136"
          width="2800"
          height="130"
          fill="#d9b25a"
          fillOpacity="0.4"
        />
      )}
      {info.season === "winter" && (
        <g fill="#ffffff">
          {[30, 90, 150, 220, 300, 360].map((x, k) => (
            <rect key={x} x={x} y={20 + ((k * 37) % 90)} width="3" height="3" />
          ))}
        </g>
      )}
      {info.season === "autumn" && (
        <g fill="#d9480f">
          {[50, 140, 210, 330].map((x, k) => (
            <rect key={x} x={x} y={150 + k * 22} width="4" height="3" />
          ))}
        </g>
      )}
      <rect x="-1200" y="108" width="2800" height="30" fill="#b98a55" />
      <defs>
        <pattern
          id="gs-fence-slats"
          x="-1199"
          y="108"
          width="10"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="30" fill="#c99a62" />
        </pattern>
      </defs>
      <rect
        x="-1199"
        y="108"
        width="2800"
        height="30"
        fill="url(#gs-fence-slats)"
      />
      <rect x="-1200" y="112" width="2800" height="3" fill="#8b5e34" />
      {info.orchard &&
        TREES.map((t) => (
          <g key={t.x}>
            <rect
              x={t.x - 2}
              y={t.y - 22}
              width="5"
              height="24"
              fill="#6b4423"
            />
            <rect
              x={t.x - 12}
              y={t.y - 44}
              width="25"
              height="24"
              fill={look.leaf}
            />
            {info.season !== "winter" && (
              <rect
                x={t.x - 4}
                y={t.y - 36}
                width="5"
                height="5"
                fill="#e03131"
              />
            )}
          </g>
        ))}
      {info.greenhouse && (
        <g>
          <rect
            x={GREENHOUSE.x}
            y={GREENHOUSE.y}
            width="70"
            height="44"
            fill="#c9f0ff"
            fillOpacity="0.7"
            stroke="#e8f8ff"
            strokeWidth="2"
          />
          <path
            d={`M${GREENHOUSE.x + 23} ${GREENHOUSE.y}v44M${GREENHOUSE.x + 46} ${GREENHOUSE.y}v44`}
            stroke="#e8f8ff"
            strokeWidth="2"
          />
          <rect
            x={GREENHOUSE.x + 8}
            y={GREENHOUSE.y + 28}
            width="6"
            height="14"
            fill="#2f8a2a"
          />
          <rect
            x={GREENHOUSE.x + 32}
            y={GREENHOUSE.y + 24}
            width="6"
            height="18"
            fill="#2f8a2a"
          />
          <rect
            x={GREENHOUSE.x + 54}
            y={GREENHOUSE.y + 30}
            width="6"
            height="12"
            fill="#e03131"
          />
        </g>
      )}
      {Array.from({ length: Math.min(8, info.bees) }, (_, i) => (
        <Hive key={i} i={i} />
      ))}
      {info.keeper && (
        <g>
          <rect
            x={KEEPER.x}
            y={KEEPER.y + 6}
            width="8"
            height="12"
            fill="#f8f4e8"
          />
          <rect
            x={KEEPER.x + 1}
            y={KEEPER.y}
            width="6"
            height="6"
            fill="#f2c9a0"
          />
          <rect
            x={KEEPER.x}
            y={KEEPER.y - 2}
            width="8"
            height="3"
            fill="#f8f4e8"
          />
        </g>
      )}
      {beds.map((i) => (
        <Bed key={i} i={i} info={info} look={look} />
      ))}
      {Array.from({ length: Math.min(4, info.storage) }, (_, i) => (
        <Barrel key={i} i={i} info={info} />
      ))}
      {info.storage > 4 && (
        <rect x="20" y="252" width="80" height="3" fill="#2f6f3f" />
      )}
      {Array.from({ length: Math.min(6, info.gardeners) }, (_, i) => (
        <Gardener key={i} i={i} />
      ))}
      {Array.from({ length: baskets }, (_, i) => (
        <g key={i}>
          <rect
            x={basketAt(i).x}
            y={basketAt(i).y}
            width="10"
            height="7"
            fill="#b9833f"
          />
          <rect
            x={basketAt(i).x + 2}
            y={basketAt(i).y - 2}
            width="6"
            height="3"
            fill="#e03131"
          />
        </g>
      ))}
      {info.tea && (
        <g>
          <rect x={TEA.x} y={TEA.y} width="12" height="12" fill="#5a4a2a" />
          <rect
            x={TEA.x + 1}
            y={TEA.y + 1}
            width="10"
            height="3"
            fill="#6fb04a"
          />
        </g>
      )}
      {info.barrow && (
        <g>
          <rect
            x={BARROW.x}
            y={BARROW.y}
            width="18"
            height="9"
            fill="#c0392b"
          />
          <rect
            x={BARROW.x + 14}
            y={BARROW.y + 7}
            width="6"
            height="6"
            fill="#222"
          />
          <rect
            x={BARROW.x - 8}
            y={BARROW.y + 2}
            width="9"
            height="2"
            fill="#8b5e34"
          />
        </g>
      )}
      {info.stand && (
        <g>
          <rect
            x={STAND.x}
            y={STAND.y + 14}
            width="44"
            height="22"
            fill="#a5733c"
          />
          <rect
            x={STAND.x - 3}
            y={STAND.y + 6}
            width="50"
            height="8"
            fill="#f5c542"
          />
          <rect
            x={STAND.x + 8}
            y={STAND.y + 6}
            width="8"
            height="8"
            fill="#fff"
          />
          <rect
            x={STAND.x + 28}
            y={STAND.y + 6}
            width="8"
            height="8"
            fill="#fff"
          />
          <rect
            x={STAND.x + 6}
            y={STAND.y + 18}
            width="8"
            height="9"
            fill="#e8a317"
          />
          <rect
            x={STAND.x + 20}
            y={STAND.y + 18}
            width="8"
            height="9"
            fill="#e8a317"
          />
        </g>
      )}
      {info.ended && (
        <g>
          <rect
            x={FRAME.x}
            y={FRAME.y + 6}
            width="34"
            height="8"
            fill="#8b5e34"
          />
          <path
            d={`M${FRAME.x} ${FRAME.y + 6}l34 -8v8z`}
            fill="#c9f0ff"
            fillOpacity="0.85"
          />
        </g>
      )}
      <rect x="-1200" y="262" width="2800" height="1200" fill="#7a5230" />
      <rect x="-1200" y="262" width="2800" height="5" fill="#a9763f" />
      <rect
        x={SILL_BOX.x}
        y={SILL_BOX.y}
        width="90"
        height="22"
        fill="#a0522d"
      />
      <rect
        x={SILL_BOX.x}
        y={SILL_BOX.y}
        width="90"
        height="7"
        fill={info.dry ? SOIL_DRY : SOIL_WET}
      />
      <rect
        x={SPROUT.x}
        y={SPROUT.y - sprout}
        width="4"
        height={sprout}
        fill="#3f9d3a"
      />
      <rect
        x={SPROUT.x - 10}
        y={SPROUT.y - sprout}
        width="10"
        height="5"
        fill="#58bf4f"
      />
      <rect
        x={SPROUT.x + 4}
        y={SPROUT.y - sprout - 3}
        width="10"
        height="5"
        fill="#58bf4f"
      />
      <rect x="-1200" y="0" width="2800" height="9" fill="#a9763f" />
    </g>
  );
}
