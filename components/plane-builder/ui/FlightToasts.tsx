"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { flightToasts } from "@/lib/plane-builder/state/flightToasts";

const TOAST_MS = 1200;

/** The newest pop-up ("Boost!", "+Fuel", "Halfway!") for 1.2 seconds. */
export default function FlightToasts() {
  const toast = useSyncExternalStore(
    flightToasts.subscribe,
    flightToasts.get,
    () => null
  );
  const [expiredId, setExpiredId] = useState<number | null>(null);
  const id = toast?.id ?? null;

  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(() => setExpiredId(id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id]);

  const visible = toast !== null && toast.id !== expiredId ? toast : null;

  return (
    <>
      {visible ? (
        <p
          key={visible.id}
          aria-hidden="true"
          className="pb-finish-banner absolute inset-x-0 top-16 text-center text-4xl font-black text-white drop-shadow-lg [text-shadow:0_2px_0_rgb(15_23_42),0_0_8px_rgb(15_23_42)]"
        >
          {visible.text}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {visible?.text ?? ""}
      </p>
    </>
  );
}
