"use client";

import { useState } from "react";
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

/** Makes a picture card of a finish time and shares it (or saves it). */
export default function ShareTimeButton({ card }: ShareTimeButtonProps) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleClick() {
    setIsBusy(true);
    setMessage("");
    try {
      const blob = await renderTimeCard(card);
      if (!blob) {
        setMessage("Couldn't make the picture");
        return;
      }
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
        disabled={isBusy}
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
