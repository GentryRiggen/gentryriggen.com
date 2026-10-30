"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import {
  cardFilename,
  renderTimeCard,
  shareMessage,
  type TimeCardData,
} from "@/lib/plane-builder/share/timeCard";
import { describeOutcome, shareImage } from "@/lib/share/shareImage";
import { secondaryButtonClass } from "./styles";

interface ShareTimeButtonProps {
  card: TimeCardData;
}

/**
 * Shares a picture card of a finish time (or saves it). The card is drawn
 * ahead of time, so a tap goes straight to the share sheet: browsers only
 * allow sharing right after a tap, not after a wait.
 */
export default function ShareTimeButton({ card }: ShareTimeButtonProps) {
  const { worldName, time, nickname, planeTier, twist } = card;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setBlob(null);
    void renderTimeCard({ worldName, time, nickname, planeTier, twist }).then(
      (next) => {
        if (!isCancelled) setBlob(next);
      }
    );
    return () => {
      isCancelled = true;
    };
  }, [worldName, time, nickname, planeTier, twist]);

  async function handleClick() {
    if (!blob) return;
    setIsBusy(true);
    setMessage("");
    try {
      // No await before this call: the tap's permission must still be fresh.
      const outcome = await shareImage({
        blob,
        filename: cardFilename(card),
        title: "My Plane Builder time",
        text: shareMessage(card),
      });
      setMessage(describeOutcome(outcome));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={isBusy || !blob}
        onClick={handleClick}
        className={secondaryButtonClass}
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
        Share my time
      </button>
      <p role="status" className="basis-full text-sm font-semibold">
        {message}
      </p>
    </>
  );
}
