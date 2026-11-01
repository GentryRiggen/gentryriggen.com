import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { Crop } from "@/lib/ever-onward/universes/grow/market";
import {
  AGENT,
  COMPOST,
  DITCH,
  FARM_BARN,
  FARM_GLASS,
  FIELD_W,
  SILO,
  TOWN,
  droneAt,
  fieldAt,
  tractorAt,
  wellAt,
} from "./anchors";

const SOIL_WET = "#5a3a1c";
const SOIL_DRY = "#c9a56a";
const PLANTS = 6;

/** One row of the planted crop across a field. */
function Plant({
  x,
  y,
  crop,
  dry,
}: {
  x: number;
  y: number;
  crop: Crop;
  dry: boolean;
}) {
  const sag = dry ? 3 : 0;
  if (crop === "corn")
    return (
      <g>
        <rect
          x={x}
          y={y - 14 + sag}
          width="3"
          height={14 - sag}
          fill="#3f9d3a"
        />
        <rect x={x - 3} y={y - 9 + sag} width="9" height="2" fill="#58bf4f" />
        <rect x={x - 1} y={y - 18 + sag} width="5" height="4" fill="#f5d33d" />
      </g>
    );
  if (crop === "pumpkin")
    return (
      <g>
        <rect x={x - 4} y={y - 6} width="10" height="7" fill="#f08a24" />
        <rect x={x - 4} y={y - 4} width="10" height="1" fill="#c96a10" />
        <rect x={x} y={y - 9} width="2" height="3" fill="#3f9d3a" />
        <rect x={x - 7} y={y - 3} width="4" height="2" fill="#58bf4f" />
      </g>
    );
  return (
    <g>
      <rect x={x} y={y - 10 + sag} width="2" height={10 - sag} fill="#3f9d3a" />
      <rect x={x - 3} y={y - 7 + sag} width="8" height="2" fill="#58bf4f" />
      <rect x={x - 3} y={y - 5} width="4" height="4" fill="#e03131" />
      <rect x={x + 2} y={y - 3} width="4" height="4" fill="#e03131" />
    </g>
  );
}

function Field({
  i,
  info,
  scarecrow,
}: {
  i: number;
  info: GrowSceneInfo;
  scarecrow: boolean;
}) {
  const { x, y } = fieldAt(i);
  const h = i < 4 ? 34 : 40;
  const rows = i < 4 ? 2 : 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={FIELD_W}
        height={h}
        fill={info.dry ? SOIL_DRY : SOIL_WET}
      />
      <rect x={x} y={y} width={FIELD_W} height="3" fill="#7a5230" />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: PLANTS }, (_, k) => (
          <Plant
            key={`${r}-${k}`}
            x={x + 8 + k * 13}
            y={y + 16 + r * (h / 2 - 3)}
            crop={info.crop}
            dry={info.dry}
          />
        ))
      )}
      {scarecrow && (
        <g>
          <rect
            x={x + FIELD_W - 14}
            y={y - 14}
            width="2"
            height="22"
            fill="#6b4423"
          />
          <rect
            x={x + FIELD_W - 20}
            y={y - 8}
            width="14"
            height="2"
            fill="#6b4423"
          />
          <rect
            x={x + FIELD_W - 17}
            y={y - 20}
            width="8"
            height="7"
            fill="#e8c27a"
          />
          <rect
            x={x + FIELD_W - 19}
            y={y - 23}
            width="12"
            height="3"
            fill="#7a3b1c"
          />
        </g>
      )}
    </g>
  );
}

/** The town beyond the fields: its windows light up as it is fed. */
function Town({ lit }: { lit: number }) {
  const houses = [0, 1, 2, 3];
  const colours = ["#c9824a", "#b25a4a", "#d2a35a", "#a86a8a"];
  return (
    <g>
      {houses.map((h) => {
        const x = TOWN.x + h * 42;
        const top = TOWN.y + (h % 2) * 6;
        return (
          <g key={h}>
            <rect
              x={x}
              y={top}
              width="34"
              height={30 - (h % 2) * 6}
              fill={colours[h]}
            />
            <path d={`M${x - 3} ${top}l20 -14l20 14z`} fill="#7a3b1c" />
            {[0, 1].map((w) => {
              const n = h * 2 + w;
              return (
                <rect
                  key={w}
                  x={x + 6 + w * 15}
                  y={top + 8}
                  width="8"
                  height="8"
                  fill={n < lit ? "#ffe66d" : "#4a3f55"}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Tractor({ i }: { i: number }) {
  const { x, y } = tractorAt(i);
  return (
    <g>
      <rect x={x} y={y + 6} width="26" height="10" fill="#2f9e44" />
      <rect x={x + 14} y={y} width="12" height="8" fill="#2f9e44" />
      <rect x={x + 16} y={y + 2} width="7" height="5" fill="#c9f0ff" />
      <rect x={x + 2} y={y + 12} width="10" height="10" fill="#222" />
      <rect x={x + 18} y={y + 14} width="7" height="7" fill="#222" />
    </g>
  );
}

function Well({ i }: { i: number }) {
  const { x, y } = wellAt(i);
  return (
    <g>
      <rect x={x} y={y} width="14" height="9" fill="#8d8f96" />
      <rect x={x + 2} y={y - 5} width="10" height="2" fill="#6b4423" />
      <rect x={x} y={y - 5} width="2" height="5" fill="#6b4423" />
      <rect x={x + 12} y={y - 5} width="2" height="5" fill="#6b4423" />
      <rect x={x + 3} y={y + 2} width="8" height="3" fill="#38a3e8" />
    </g>
  );
}

function Drone({ i }: { i: number }) {
  const { x, y } = droneAt(i);
  return (
    <g>
      <rect x={x} y={y} width="14" height="5" fill="#495057" />
      <rect x={x - 5} y={y - 3} width="10" height="2" fill="#adb5bd" />
      <rect x={x + 9} y={y - 3} width="10" height="2" fill="#adb5bd" />
      <rect x={x + 6} y={y + 5} width="2" height="4" fill="#f5c542" />
    </g>
  );
}

/** The farm: sky, a town on the horizon, fields of the planted crop. */
export default function FarmLayer({ info }: { info: GrowSceneInfo }) {
  const drones = Math.min(
    4,
    Math.max(0, info.machines - info.tractors - info.greenhouses)
  );
  const irrigation = Math.max(0, info.storage - info.wells);
  const sky = info.dry ? "#e9d6a4" : "#a8dcff";
  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="1324" fill={sky} />
      <circle cx="356" cy="40" r="16" fill="#ffe66d" />
      <rect
        x="60"
        y="28"
        width="50"
        height="10"
        fill="#ffffff"
        fillOpacity="0.8"
      />
      <rect
        x="80"
        y="22"
        width="32"
        height="10"
        fill="#ffffff"
        fillOpacity="0.8"
      />
      <rect x="-1200" y="108" width="2800" height="20" fill="#8cbf6a" />
      <rect
        x="-1200"
        y="122"
        width="2800"
        height="1200"
        fill={info.dry ? "#b8a75a" : "#6fb04f"}
      />
      <Town lit={Math.round(info.townFed * 8)} />
      {info.silos > 0 && (
        <g>
          <rect x={SILO.x} y={SILO.y} width="18" height="46" fill="#b8c0c8" />
          <rect
            x={SILO.x}
            y={SILO.y - 5}
            width="18"
            height="6"
            fill="#868e96"
          />
          <rect
            x={SILO.x + 3}
            y={SILO.y + 12}
            width="12"
            height="2"
            fill="#868e96"
          />
          <rect
            x={SILO.x + 3}
            y={SILO.y + 24}
            width="12"
            height="2"
            fill="#868e96"
          />
        </g>
      )}
      <g>
        <rect
          x={FARM_BARN.x}
          y={FARM_BARN.y}
          width={info.ended ? 70 : 52}
          height={info.ended ? 36 : 28}
          fill="#b03a2e"
        />
        <rect
          x={FARM_BARN.x + 18}
          y={FARM_BARN.y + (info.ended ? 16 : 10)}
          width="16"
          height="18"
          fill="#7f241b"
        />
        <path
          d={`M${FARM_BARN.x - 4} ${FARM_BARN.y}l${info.ended ? 39 : 30} -16l${info.ended ? 39 : 30} 16z`}
          fill="#5b2a1c"
        />
      </g>
      {Array.from({ length: info.fields }, (_, i) => (
        <Field key={i} i={i} info={info} scarecrow={i < info.helpers} />
      ))}
      {irrigation > 0 && (
        <rect x="22" y={DITCH.y - 6} width="350" height="4" fill="#38a3e8" />
      )}
      {info.scaling > 0 && (
        <g>
          <rect
            x={COMPOST.x}
            y={COMPOST.y + 4}
            width="26"
            height="12"
            fill="#4a2f18"
          />
          <rect
            x={COMPOST.x + 4}
            y={COMPOST.y}
            width="18"
            height="6"
            fill="#5e3d20"
          />
          <rect
            x={COMPOST.x + 10}
            y={COMPOST.y - 6}
            width="2"
            height="4"
            fill="#ffffff"
            fillOpacity="0.6"
          />
        </g>
      )}
      {info.agent && (
        <g>
          <rect x={AGENT.x} y={AGENT.y} width="8" height="8" fill="#e8c27a" />
          <rect
            x={AGENT.x - 1}
            y={AGENT.y + 8}
            width="10"
            height="14"
            fill="#1971c2"
          />
          <rect
            x={AGENT.x + 9}
            y={AGENT.y + 10}
            width="7"
            height="9"
            fill="#f8f9fa"
          />
        </g>
      )}
      {info.greenhouses > 0 && (
        <g>
          <rect
            x={FARM_GLASS.x}
            y={FARM_GLASS.y}
            width="72"
            height="40"
            fill="#c9f0ff"
            fillOpacity="0.7"
            stroke="#e8f8ff"
            strokeWidth="2"
          />
          <rect
            x={FARM_GLASS.x + 10}
            y={FARM_GLASS.y + 24}
            width="6"
            height="14"
            fill="#e03131"
          />
          <rect
            x={FARM_GLASS.x + 34}
            y={FARM_GLASS.y + 20}
            width="6"
            height="18"
            fill="#2f8a2a"
          />
          <rect
            x={FARM_GLASS.x + 54}
            y={FARM_GLASS.y + 26}
            width="6"
            height="12"
            fill="#e03131"
          />
        </g>
      )}
      {Array.from({ length: Math.min(info.tractors, 4) }, (_, i) => (
        <Tractor key={i} i={i} />
      ))}
      {Array.from({ length: Math.min(info.wells, 6) }, (_, i) => (
        <Well key={i} i={i} />
      ))}
      {Array.from({ length: drones }, (_, i) => (
        <Drone key={i} i={i} />
      ))}
      {info.dry && (
        <rect
          x="-1200"
          y="122"
          width="2800"
          height="1200"
          fill="#d9b25a"
          fillOpacity="0.25"
        />
      )}
    </g>
  );
}
