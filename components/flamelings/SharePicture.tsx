import { useEffect, useRef, useState } from "react";
import { trackShare } from "@/lib/flamelings/analytics";
import { stageFor } from "@/lib/flamelings/progress";
import {
  composeShareSvg,
  daysAliveSince,
  SHARE_HEIGHT,
  SHARE_WIDTH,
} from "@/lib/flamelings/shareCard";
import {
  canShareFile,
  petMarkupOf,
  SHARE_FILE_NAME,
  shareOrDownload,
  svgToPng,
} from "@/lib/flamelings/shareImage";
import { stageTitle } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import Blob from "./Blob";
import FlIcon from "./FlIcon";
import PanelHeader from "./PanelHeader";
import {
  CHROME_BG,
  DONE_BUTTON,
  PRIMARY_BUTTON_BASE,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

interface SharePictureProps {
  pet: Pet;
  nowMs: number;
  onClose: () => void;
}

type Picture =
  | { kind: "making" }
  | { kind: "ready"; blob: Blob; url: string }
  | { kind: "failed" };

/**
 * Take a picture of the pet: a card in Ember Hollow with its name, level and
 * form, made on this device and handed to the share sheet (or saved).
 */
export default function SharePicture({
  pet,
  nowMs,
  onClose,
}: SharePictureProps) {
  const source = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<Picture>({ kind: "making" });
  const [needsHold, setNeedsHold] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const stage = stageFor(pet.level).id;
  const title = stageTitle(pet.level, pet.form);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    void (async () => {
      try {
        const svg = source.current?.querySelector("svg");
        if (!svg) throw new Error("The pet is not drawn yet");
        const card = composeShareSvg({
          petMarkup: petMarkupOf(svg),
          name: pet.name,
          level: pet.level,
          stage,
          stageTitle: title,
          daysAlive: daysAliveSince(pet.bornAt, nowMs),
        });
        const blob = await svgToPng(card);
        url = URL.createObjectURL(blob);
        if (!cancelled) setPicture({ kind: "ready", blob, url });
      } catch {
        if (!cancelled) setPicture({ kind: "failed" });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // The picture is of the pet as it was when the camera opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (picture.kind !== "ready" || isBusy) return;
    setIsBusy(true);
    try {
      const result = await shareOrDownload(picture.blob);
      if (result === "cancelled") return;
      trackShare(result);
      // A download may be dropped silently (a pinned iOS app), so never say
      // "saved": point at the picture to press and hold instead.
      setNeedsHold(result === "download");
    } finally {
      setIsBusy(false);
    }
  }

  const canShare =
    picture.kind === "ready" &&
    canShareFile(new File([picture.blob], SHARE_FILE_NAME));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Picture of your flameling"
      data-testid="share-picture"
      className={`fl-sheet-up fixed inset-0 z-30 flex flex-col overflow-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <PanelHeader icon="camera" title="Picture">
        <button type="button" onClick={onClose} className={DONE_BUTTON}>
          Done
        </button>
      </PanelHeader>

      {/* A still copy of the pet to read the styles from; never on screen. */}
      <div
        ref={source}
        aria-hidden="true"
        className="fl-share-still pointer-events-none fixed -left-[9999px] top-0 size-64"
      >
        <Blob
          look={pet.look}
          worn={pet.worn}
          form={pet.form}
          stage={stage}
          mood={pet.state === "ember" ? "ember" : "happy"}
          className="size-64"
        />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        {picture.kind === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob URL
          <img
            src={picture.url}
            width={SHARE_WIDTH}
            height={SHARE_HEIGHT}
            alt={`${pet.name}, ${title}, level ${pet.level}`}
            data-testid="share-image"
            className="fl-pop-in h-full max-h-full w-auto max-w-full select-auto rounded-[28px] border-[6px] border-[#fff6e6] shadow-[0_6px_0_#e7c9a3,0_14px_30px_rgba(30,10,40,.3)] [-webkit-touch-callout:default]"
          />
        ) : picture.kind === "making" ? (
          <p
            role="status"
            aria-label="Making the picture"
            className="fl-pulse-soft grid size-28 place-items-center rounded-full bg-[#fff6e6] shadow-[0_5px_0_#e7c9a3]"
            data-testid="share-making"
          >
            <FlIcon name="camera" className="size-16" />
          </p>
        ) : (
          <p
            role="alert"
            className="rounded-[28px] bg-[#fff6e6] p-6 text-center text-xl font-extrabold text-[#3a2340] shadow-[0_5px_0_#e7c9a3]"
          >
            <span aria-hidden="true" className="block text-6xl">
              😢
            </span>
            The picture did not work this time.
          </p>
        )}
      </div>

      {needsHold && (
        <p
          role="status"
          aria-label="Press and hold the picture to save it"
          data-testid="share-hold-hint"
          className="pb-1 text-center text-4xl"
        >
          <span aria-hidden="true">👆🖼️💾</span>
        </p>
      )}
      <p className="mx-auto max-w-xl pb-2 text-center text-sm font-semibold leading-snug opacity-80">
        For parents: the picture is made on this device and goes nowhere on its
        own. It only leaves if you choose where to share it.
      </p>
      <button
        type="button"
        onClick={handleShare}
        disabled={picture.kind !== "ready" || isBusy}
        data-testid="share-button"
        className={`${PRIMARY_BUTTON_BASE} mx-auto mb-1 flex w-full max-w-md items-center justify-center gap-2 px-8 py-4 text-2xl`}
      >
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-[#fff6e6]"
        >
          <FlIcon name="share" className="size-7" />
        </span>
        {canShare ? "Share" : "Save picture"}
      </button>
    </div>
  );
}
