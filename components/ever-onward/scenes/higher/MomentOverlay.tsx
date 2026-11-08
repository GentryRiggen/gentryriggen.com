"use client";

import { useEffect, useState } from "react";
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

/** When moments overlap, each one holds the banner this long before the next. */
const TURN_MS = 1400;

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
    if (info.flipped > 0)
      moments.push({
        key: `flip-${info.flips}`,
        text: info.flipped === 1 ? "LIGHTS WARMING UP" : "LIGHTS OFF",
        banner:
          info.flipped === 1
            ? "bg-amber-300 text-amber-950 border-amber-100"
            : "bg-slate-800 text-slate-100 border-slate-400",
        edge: info.flipped === 1 ? "border-amber-200" : "border-slate-500",
      });
    if (info.lit)
      moments.push({
        key: `lit-${info.lights}`,
        text: "LIGHTS ON!",
        banner: "bg-amber-400 text-amber-950 border-amber-100",
        edge: "border-amber-200",
      });
  }
  if (info.phase === "sky") {
    if (info.wx === 2 && !info.gust)
      moments.push({
        key: `coming-${info.gusts}`,
        text: info.strong ? "STRONG GUST COMING!" : "GUST COMING!",
        banner: info.strong
          ? "bg-rose-700 text-rose-50 border-rose-200"
          : "bg-slate-600 text-slate-50 border-slate-200",
        edge: info.strong ? "border-rose-500" : "",
      });
    if (info.gust)
      moments.push({
        key: `gust-${info.gusts}`,
        text: info.strong ? "STRONG GUST!" : "GUST!",
        banner: "bg-sky-200 text-sky-950 border-white",
        edge: "border-sky-100",
      });
    if (info.tied)
      moments.push({
        key: `tied-${info.ties}`,
        text: "TIED DOWN",
        banner: "bg-yellow-400 text-yellow-950 border-yellow-100",
        edge: "border-yellow-200",
      });
    if (info.dropped)
      moments.push({
        key: `drop-${info.drops}`,
        text: "DROPPED!",
        banner: "bg-orange-600 text-orange-50 border-orange-200",
        edge: "border-orange-400",
      });
    if (info.snapped)
      moments.push({
        key: `snap-${info.snaps}`,
        text: "SNAP!",
        banner: "bg-red-700 text-red-50 border-red-200",
        edge: "border-red-500",
      });
    if (info.ncLost)
      moments.push({
        key: `nclost-${info.ncFailed}`,
        text: "CLIMB ENDED",
        banner: "bg-slate-700 text-slate-50 border-slate-300",
        edge: "",
      });
    if (info.ncWon)
      moments.push({
        key: `ncwin-${info.badges}`,
        text: "MADE IT!",
        banner: "bg-amber-400 text-amber-950 border-yellow-100",
        edge: "border-yellow-300",
      });
  }
  return moments;
}

/**
 * Big HTML banners over the scene. The picture is an SVG that shrinks to a
 * thin strip on a phone, so its own words get tiny; these keep their size and
 * run the full width, with a flash round the screen edge. When two moments
 * overlap, the newest shows first and the others take turns after it.
 */
export default function MomentOverlay({ info }: { info: HigherSceneInfo }) {
  const moments = momentsFor(info);
  const keys = moments.map((m) => m.key).join("|");
  const [cycle, setCycle] = useState({ keys, turn: 0 });
  if (cycle.keys !== keys) setCycle({ keys, turn: 0 });
  const isMany = moments.length > 1;
  useEffect(() => {
    if (!isMany) return;
    const id = window.setInterval(
      () => setCycle((c) => ({ ...c, turn: c.turn + 1 })),
      TURN_MS
    );
    return () => window.clearInterval(id);
  }, [isMany, keys]);
  if (moments.length === 0) return null;
  const turn = cycle.keys === keys ? cycle.turn : 0;
  const latest = moments[moments.length - 1 - (turn % moments.length)];
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
