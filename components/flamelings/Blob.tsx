import { useId } from "react";
import type { EmoteId } from "@/lib/flamelings/catalog";
import type { FormId, StageId } from "@/lib/flamelings/types";
import type { Mood } from "@/lib/flamelings/sim";
import type { Look, Worn } from "@/lib/flamelings/types";
import Accessories, { AccessoriesBack } from "./Accessories";
import EmoteFx from "./EmoteFx";
import { FormBack, FormFront, FormTips } from "./FormFx";

export interface BlobProps {
  look: Look;
  mood: Mood;
  /** Growth stage: sets the scale and the embers. Defaults to full size. */
  stage?: StageId;
  worn?: Worn;
  /** The grown-up form (from level 10), drawn on top of the look. */
  form?: FormId | null;
  /** 0 (healthy) to 4 (nearly out): how faded the pet looks. */
  fade?: number;
  emote?: EmoteId | null;
  /** Bumps to replay the same emote. */
  emoteKey?: number;
  /** Tailwind size classes, e.g. `size-48`. */
  className?: string;
  /**
   * Fill the box: young pets are shown nearly as big as grown ones, for
   * previews where a tiny spark would float in an empty card.
   */
  fit?: boolean;
}

const NO_WORN: Worn = { hat: null, face: null, neck: null };

/**
 * The flameling, drawn. Decoration only: hidden from assistive tech (the
 * screens around it carry the labels). The look lives in `.fl-` rules in
 * globals.css, keyed on the data attributes below.
 */
export default function Blob({
  look,
  mood,
  stage = "bonfire",
  worn = NO_WORN,
  form = null,
  fade = 0,
  emote = null,
  emoteKey = 0,
  className = "size-48",
  fit = false,
}: BlobProps) {
  // Two blobs on one page must not share an id.
  const id = useId().replace(/:/g, "");
  const goo = `fl-goo-${id}`;
  const fill = `fl-fill-${id}`;
  const halo = `fl-halo-${id}`;
  const glow = `fl-glow-${id}`;
  return (
    <div
      className={`fl-pet relative ${fit ? "fl-pet-fit " : ""}${className}`}
      data-stage={stage}
      data-form={form ?? undefined}
      data-mood={mood}
      data-fade={fade}
      data-emote={emote ?? undefined}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="fl-blob"
        viewBox="0 0 120 120"
        data-colour={look.colour}
        data-shape={look.shape}
        data-eyes={look.eyes}
        data-form={form ?? undefined}
        data-mood={mood}
        data-fade={fade}
      >
        <defs>
          <filter
            id={goo}
            x="-30%"
            y="-40%"
            width="160%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
          </filter>
          <linearGradient
            id={fill}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="108"
            x2="0"
            y2="38"
          >
            <stop className="fl-hot" offset="0" />
            <stop className="fl-mid" offset="0.55" />
            <stop className="fl-tip" offset="1" />
          </linearGradient>
          <radialGradient id={glow}>
            <stop className="fl-core-stop" offset="0" stopOpacity="0.95" />
            <stop className="fl-core-stop" offset="1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="fl-all">
          <g className="fl-droop">
            <FormBack form={form} gradientId={halo} />
            <AccessoriesBack neck={worn.neck} />
            <g filter={`url(#${goo})`} fill={`url(#${fill})`}>
              <circle className="fl-body" cx="60" cy="78" r="30" />
              <circle className="fl-side-l" cx="42" cy="70" r="16" />
              <circle className="fl-side-r" cx="78" cy="70" r="16" />
              <circle className="fl-peak" cx="60" cy="48" r="14" />
              <g className="fl-licks">
                <circle className="fl-lick fl-lick-1" cx="60" cy="42" r="11" />
                <circle className="fl-lick fl-lick-2" cx="46" cy="54" r="8" />
                <circle className="fl-lick fl-lick-3" cx="74" cy="54" r="8" />
                <circle className="fl-lick fl-lick-4" cx="64" cy="50" r="6" />
              </g>
              <FormTips form={form} />
            </g>
            <ellipse
              className="fl-core"
              cx="60"
              cy="90"
              rx="24"
              ry="15"
              fill={`url(#${glow})`}
            />
            <g className="fl-eyes">
              <ellipse
                className="fl-eye fl-eye-l"
                cx="50"
                cy="76"
                rx="5"
                ry="6.5"
              />
              <ellipse
                className="fl-eye fl-eye-r"
                cx="70"
                cy="76"
                rx="5"
                ry="6.5"
              />
              <circle className="fl-shine" cx="52" cy="73.4" r="1.7" />
              <circle className="fl-shine" cx="72" cy="73.4" r="1.7" />
              <circle className="fl-shine" cx="48.6" cy="78.6" r="0.8" />
              <circle className="fl-shine" cx="68.6" cy="78.6" r="0.8" />
            </g>
            <ellipse className="fl-cheek" cx="44" cy="84" rx="5" ry="3" />
            <ellipse className="fl-cheek" cx="76" cy="84" rx="5" ry="3" />
            <path className="fl-mouth fl-mouth-smile" d="M54 87 Q60 92 66 87" />
            <path
              className="fl-mouth fl-mouth-open"
              d="M54 86 Q60 96 66 86 Z"
            />
            <path className="fl-mouth fl-mouth-flat" d="M56 89 L64 89" />
            <path className="fl-brow fl-brow-l" d="M43 66 L56 62" />
            <path className="fl-brow fl-brow-r" d="M64 62 L77 66" />
            <path className="fl-mouth fl-mouth-sad" d="M54 91 Q60 86 66 91" />
            <FormFront form={form} />
            <Accessories hat={worn.hat} face={worn.face} neck={worn.neck} />
          </g>
        </g>
        <g className="fl-embers">
          <circle cx="44" cy="40" r="2.4" />
          <circle cx="76" cy="36" r="2" />
          <circle cx="60" cy="30" r="2.8" />
        </g>
      </svg>
      <EmoteFx
        key={`${emote}-${emoteKey}`}
        emote={emote}
        asleep={mood === "asleep"}
      />
    </div>
  );
}
