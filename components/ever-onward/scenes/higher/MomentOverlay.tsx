import type { HigherSceneInfo } from "@/lib/ever-onward/universes/higher";
import { DAYS } from "@/lib/ever-onward/universes/higher/town";
import { pixelClass } from "../../game/retro/retroStyles";

interface Moment {
  key: string;
  text: string;
  /** Full class names for the banner and the screen-edge flash. */
  banner: string;
  edge: string;
}

const BANK_WORDS = ["BANKED!", "BIG BANK!", "JACKPOT!"] as const;

/** What is happening in the picture right now, as big words (the newest last). */
function momentsFor(info: HigherSceneInfo): Moment[] {
  const moments: Moment[] = [];
  if (info.phase === "playroom") {
    if (info.toddler === 1)
      moments.push({
        key: "toddler-coming",
        text: "TODDLER COMING!",
        banner: "bg-rose-700 text-rose-50 border-rose-200",
        edge: "",
      });
    if (info.toddler === 2)
      moments.push({
        key: "toddler-stomp",
        text: "STOMP! STOMP!",
        banner: "bg-pink-700 text-pink-50 border-pink-200",
        edge: "border-pink-400",
      });
    if (info.tumbling)
      moments.push({
        key: `tumble-${info.tumbles}`,
        text: "TUMBLE!",
        banner: "bg-red-700 text-red-50 border-red-200",
        edge: "border-red-500",
      });
    if (info.banking > 0)
      moments.push({
        key: `bank-${info.banks}`,
        text: BANK_WORDS[info.banking - 1],
        banner: "bg-amber-500 text-amber-950 border-amber-100",
        edge: "border-amber-300",
      });
  }
  if (info.phase === "town") {
    if (info.dayNew && info.day > 0)
      moments.push({
        key: `day-${info.days}`,
        text: `${DAYS[info.day].name.toUpperCase()}!`,
        banner: "bg-sky-700 text-sky-50 border-sky-200",
        edge: "",
      });
    if (info.tossed > 0)
      moments.push({
        key: `toss-${info.tosses}`,
        text: "HAT TOSS!",
        banner: "bg-orange-600 text-orange-50 border-orange-200",
        edge: "",
      });
    if (info.arrived > 0)
      moments.push({
        key: `arrive-${info.arrivals}`,
        text: "NEW FOREMAN!",
        banner: "bg-emerald-600 text-emerald-50 border-emerald-200",
        edge: "border-emerald-300",
      });
    if (info.lit)
      moments.push({
        key: `lit-${info.lights}`,
        text: "LIGHTS ON!",
        banner: "bg-amber-400 text-amber-950 border-amber-100",
        edge: "border-amber-200",
      });
  }
  return moments;
}

/**
 * Big HTML banners over the scene. The picture is an SVG that shrinks to a
 * thin strip on a phone, so its own words get tiny; these keep their size and
 * run the full width, with a flash round the screen edge.
 */
export default function MomentOverlay({ info }: { info: HigherSceneInfo }) {
  const moments = momentsFor(info);
  if (moments.length === 0) return null;
  const latest = moments[moments.length - 1];
  return (
    <div
      aria-hidden="true"
      data-testid="hs-moment"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {latest.edge && (
        <div
          key={`edge-${latest.key}`}
          className={`bh-edge absolute inset-0 border-8 ${latest.edge}`}
        />
      )}
      <p
        key={latest.key}
        data-testid="hs-moment-text"
        className={`${pixelClass} bh-banner absolute inset-x-0 top-1/2 -translate-y-1/2 border-y-4 px-2 py-2 text-center text-xl leading-none sm:text-2xl ${latest.banner}`}
      >
        {latest.text}
      </p>
    </div>
  );
}
