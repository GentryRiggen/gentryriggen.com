"use client";

import { Camera, Download, Share2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { pictureFilename } from "@/lib/share/caption";
import {
  describeOutcome,
  downloadBlob,
  shareImage,
} from "@/lib/share/shareImage";
import { buildShareUrl } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePhotoStore from "../hooks/usePhotoStore";
import { takeSnapshot } from "../scene/photoSnapshot";
import { PHOTO_ANGLES } from "../scene/photoAngles";
import { developPhoto, PHOTO_TITLE_FALLBACK } from "./photoShot";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";
import ViewControls from "./ViewControls";

const CHIP_BASE =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-md px-3 text-sm font-medium";
const CHIP_IDLE = `${CHIP_BASE} text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`;
const CHIP_PRESSED = `${CHIP_BASE} bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100`;

interface Shot {
  blob: Blob;
  url: string;
}

/**
 * Photo mode: the building controls step aside, the camera drifts gently, and
 * a big shutter takes a picture of the ship. Time of day and sea state stay
 * on hand. The picture can be shared or saved from the preview.
 */
export default function PhotoMode() {
  const angle = usePhotoStore((s) => s.angle);
  const setAngle = usePhotoStore((s) => s.setAngle);
  const exit = usePhotoStore((s) => s.exit);
  const [shot, setShot] = useState<Shot | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");

  // Revoke a picture's address once it is replaced or closed.
  const shotUrl = shot?.url;
  useEffect(
    () => () => {
      if (shotUrl) URL.revokeObjectURL(shotUrl);
    },
    [shotUrl]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (shot) setShot(null);
      else exit();
    },
    [shot, exit]
  );

  async function handleShutter() {
    if (isBusy) return;
    setIsBusy(true);
    setStatus("");
    try {
      const scene = await takeSnapshot();
      const name = useShipBuilderStore.getState().ship.name;
      const blob = scene ? await developPhoto(scene, name) : null;
      if (!blob) {
        setStatus("Couldn't take that picture. Try again!");
        return;
      }
      setShot({ blob, url: URL.createObjectURL(blob) });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      data-testid="photo-mode"
      className="pointer-events-none absolute inset-0 z-20"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={exit}
        className={`${buttonClass} pointer-events-auto absolute left-3 top-3 min-h-11 shadow-sm`}
      >
        <X aria-hidden="true" className="h-4 w-4" />
        Done
      </button>
      <ViewControls hideCamera />
      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label="Photo angle"
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-lg border border-slate-300 bg-white/90 p-0.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90"
        >
          {PHOTO_ANGLES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={angle === id}
              onClick={() => setAngle(id)}
              className={angle === id ? CHIP_PRESSED : CHIP_IDLE}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Take photo"
          disabled={isBusy}
          onClick={handleShutter}
          className="pointer-events-auto inline-flex h-20 w-20 touch-manipulation items-center justify-center rounded-full border-4 border-white bg-violet-600 text-white shadow-xl ring-2 ring-slate-900/30 hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 disabled:opacity-60 dark:ring-white/30"
        >
          <Camera aria-hidden="true" className="h-9 w-9" />
        </button>
        <p role="status" className="sr-only">
          {status}
        </p>
        {status && (
          <p
            aria-hidden="true"
            className="pointer-events-none rounded-full bg-slate-900/85 px-3 py-1 text-sm text-white dark:bg-slate-100/90 dark:text-slate-900"
          >
            {status}
          </p>
        )}
      </div>
      {shot && <PhotoPreview shot={shot} onClose={() => setShot(null)} />}
    </div>
  );
}

interface PhotoPreviewProps {
  shot: Shot;
  onClose: () => void;
}

function PhotoPreview({ shot, onClose }: PhotoPreviewProps) {
  const [message, setMessage] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const shareRef = useRef<HTMLButtonElement>(null);
  const name = useShipBuilderStore((s) => s.ship.name);
  const filename = pictureFilename(name, "my-ship");

  useEffect(() => {
    shareRef.current?.focus();
  }, []);

  async function handleShare() {
    setIsSharing(true);
    try {
      const { ship } = useShipBuilderStore.getState();
      const link = buildShareUrl(ship, window.location.origin);
      const title = ship.name.trim() || PHOTO_TITLE_FALLBACK;
      const outcome = await shareImage({
        blob: shot.blob,
        filename,
        title,
        text: `Look at my ship, ${title}, from Ship Builder!`,
        url: link ?? undefined,
      });
      setMessage(describeOutcome(outcome));
    } finally {
      setIsSharing(false);
    }
  }

  function handleSave() {
    downloadBlob(shot.blob, filename);
    setMessage("Picture saved");
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your photo"
        className={`flex max-h-full w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-xl border p-3 shadow-xl ${panelClass}`}
      >
        {/* A blob address made on this device: nothing for next/image to do. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.url}
          alt={`A photo of ${name.trim() || "your ship"}`}
          data-testid="photo-preview"
          className="max-h-[55dvh] w-full rounded-lg object-contain"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={shareRef}
            type="button"
            disabled={isSharing}
            onClick={handleShare}
            className={`${primaryButtonClass} min-h-11`}
          >
            <Share2 aria-hidden="true" className="h-4 w-4" />
            Share
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`${buttonClass} min-h-11`}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Save picture
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${buttonClass} ml-auto min-h-11`}
          >
            Take another
          </button>
        </div>
        <p
          role="status"
          className="min-h-5 text-sm text-slate-600 dark:text-slate-400"
        >
          {message}
        </p>
      </div>
    </div>
  );
}
