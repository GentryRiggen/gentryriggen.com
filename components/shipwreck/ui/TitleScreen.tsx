"use client";

import Link from "next/link";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { SHIP_IDS, getShip } from "@/lib/shipwreck/ships";
import {
  funnelPaintOf,
  type ShipId,
  type ShipSpec,
} from "@/lib/shipwreck/ships/types";
import { storyOf } from "@/lib/shipwreck/story";
import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";
import { PARENT_LINES } from "../parentLine";
import Icon from "./Icon";
import LiveryButton from "./LiveryButton";
import { FOCUS, PANEL, PRIMARY, SECONDARY } from "./styles";

interface TitleScreenProps {
  /** The chosen ship. */
  ship: ShipId;
  onShip: (ship: ShipId) => void;
  onRealNight: () => void;
  onWhatIf: () => void;
  /** The chosen ship's livery (null: hers) and the paint button's choice. */
  livery?: string | null;
  onLivery?: (id: string) => void;
}

const COMING: string[] = [];

/** The What if? button's words and icon, by what sank her. */
const WHAT_IF: Record<
  ShipSpec["cause"],
  { label: string; icon: "iceberg" | "torpedo" | "storm" | "mine" | "rocks" }
> = {
  iceberg: {
    label: "What if? Choose where the iceberg opens the hull",
    icon: "iceberg",
  },
  torpedo: { label: "What if? Choose where torpedoes hit", icon: "torpedo" },
  mine: {
    label:
      "What if? Choose where mines hit, and her portholes, doors and engines",
    icon: "mine",
  },
  storm: {
    label: "What if? Choose what lets the lake in, and the storm",
    icon: "storm",
  },
  rocks: {
    label:
      "What if? Choose where the rocks open the hull, and which way the wind blows",
    icon: "rocks",
  },
};

/**
 * A small side picture of a ship from her own data (bow to the right): her
 * hull to the deck edge, her superstructure and her funnels, so each card
 * shows which ship it is without reading (one tall funnel, four, or a
 * laker's long low hull).
 */
interface ShipPictureProps {
  spec: ShipSpec;
  /** Her livery (null: hers): the funnels' paint. */
  livery?: string | null;
}

function ShipPicture({ spec, livery = null }: ShipPictureProps) {
  const funnelPaint = funnelPaintOf(spec, livery);
  const x0 = spec.stations[0].x;
  const x1 = spec.stations[spec.stations.length - 1].x;
  const top = Math.max(
    ...spec.funnels.map((f) => f.topZ),
    ...spec.superstructure.map((b) => b.topZ),
    ...spec.stations.map((st) => spec.sheerZ(st.x))
  );
  // One scale for every ship: a longer ship is a longer picture.
  const S = 0.42;
  const W = (x1 - x0) * S;
  const H = top * S;
  const X = (x: number) => (x - x0) * S;
  const Z = (z: number) => (top - z) * S;
  const keel = spec.stations.map(
    (st) => `${X(st.x).toFixed(1)},${Z(st.offsets[0][0]).toFixed(1)}`
  );
  const sheer = spec.stations.map(
    (st) => `${X(st.x).toFixed(1)},${Z(spec.sheerZ(st.x)).toFixed(1)}`
  );
  return (
    <svg
      viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`}
      aria-hidden="true"
      data-testid={`shipwreck-ship-picture-${spec.id}`}
      className="h-6 w-auto max-w-28"
    >
      {spec.superstructure.map((b, i) => (
        <rect
          key={`s${i}`}
          x={X(b.fromX)}
          y={Z(b.topZ)}
          width={(b.toX - b.fromX) * S}
          height={(b.topZ - spec.sheerZ((b.fromX + b.toX) / 2)) * S + 0.5}
          className="fill-slate-200"
        />
      ))}
      {spec.funnels.map((f, i) => (
        <rect
          key={`f${i}`}
          data-funnel={i}
          x={X(f.x - 2.5)}
          y={Z(f.topZ)}
          width={5 * S}
          height={(f.topZ - f.baseZ) * S + 2}
          // Her own funnel paint in her livery (the Carpathia's 1918
          // grey), else buff.
          fill={
            funnelPaint
              ? `#${funnelPaint.funnel.toString(16).padStart(6, "0")}`
              : "#e0a85a"
          }
        />
      ))}
      <path
        d={`M${sheer.join("L")}L${[...keel].reverse().join("L")}Z`}
        className="fill-slate-400"
      />
    </svg>
  );
}

/** The title over the slowly circling, lit ship, and the ship picker. */
export default function TitleScreen({
  ship,
  onShip,
  onRealNight,
  onWhatIf,
  livery = null,
  onLivery,
}: TitleScreenProps) {
  const spec = getShip(ship);
  const story = storyOf(spec);
  const whatIf = WHAT_IF[spec.cause];

  return (
    <main
      data-testid="shipwreck-screen"
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-between overflow-y-auto ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-2 pt-4 text-center">
        <h1
          data-testid="shipwreck-title"
          className="text-5xl font-semibold tracking-wide text-slate-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:text-7xl"
        >
          Shipwreck
        </h1>
        <p
          data-testid="shipwreck-parent-line"
          className="max-w-md rounded-xl bg-slate-950/50 px-3 py-1 text-sm text-slate-300 backdrop-blur-sm"
        >
          {PARENT_LINES[ship]}
        </p>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-4 pb-2">
        <div
          role="radiogroup"
          aria-label="Choose a ship"
          className="flex w-full shrink-0 flex-wrap justify-center gap-2 p-1"
        >
          {SHIP_IDS.map((id) => {
            const s = getShip(id);
            const on = id === ship;
            const length = Math.round(s.loa);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`Ship: ${s.name}, ${s.year}, ${length} metres long`}
                data-testid={`shipwreck-ship-${id}`}
                onClick={() => onShip(id)}
                className={`${PANEL} pointer-events-auto flex min-h-16 shrink-0 touch-manipulation flex-col items-start px-4 py-2 text-left active:scale-95 ${
                  on
                    ? "border-sky-300/70 ring-2 ring-sky-400/60"
                    : "opacity-80 hover:opacity-100"
                } ${FOCUS}`}
              >
                <ShipPicture spec={s} livery={on ? livery : null} />
                <span
                  className={`text-xl font-semibold ${on ? "text-white" : "text-slate-200"}`}
                >
                  {s.name}
                </span>
                <span className="text-sm text-slate-300">
                  {s.year} · {length} m long
                </span>
              </button>
            );
          })}
          {COMING.map((name) => (
            <div
              key={name}
              className={`${PANEL} hidden shrink-0 flex-col items-start px-4 py-2 opacity-50 sm:flex`}
              aria-label={`${name}: coming soon`}
            >
              <span className="text-base font-semibold text-slate-300">
                {name}
              </span>
              <span className="text-xs text-slate-400">Coming soon</span>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            data-testid="shipwreck-real-night"
            aria-label={`${story.realLabel}: watch what happened`}
            onClick={onRealNight}
            className={PRIMARY}
          >
            <Icon name="clock" className="size-8" />
            {story.realLabel}
          </button>
          <button
            type="button"
            data-testid="shipwreck-what-if"
            aria-label={whatIf.label}
            onClick={onWhatIf}
            className={SECONDARY}
          >
            <Icon name={whatIf.icon} className="size-8" />
            What if?
          </button>
          {onLivery && (
            <div className="self-center">
              <LiveryButton
                spec={spec}
                livery={livery}
                onChange={onLivery}
                bubble="above"
              />
            </div>
          )}
        </div>
        <Link
          href="/shipwreck/versions"
          className={`pointer-events-auto inline-flex min-h-11 items-center rounded-full bg-slate-950/50 px-4 text-sm font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200 ${FOCUS}`}
        >
          What&apos;s new · v{SHIPWRECK_VERSION}
        </Link>
      </div>
    </main>
  );
}
