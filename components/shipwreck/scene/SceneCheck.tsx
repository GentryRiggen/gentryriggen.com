"use client";

import { useEffect } from "react";
import { playback } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import NightScene from "./NightScene";

/**
 * The checking entry for the night (`/shipwreck?scene`, dev and e2e builds
 * only): the real night on the playback store, no UI. Drive it with
 * `window.__shipwreck.seek / setCamera / setXray / flyToPlace`. Add
 * `&quality=high|medium|low` to pin a tier (the frame-rate monitor is off).
 */
export default function SceneCheck() {
  const pinned =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("quality");

  useEffect(() => {
    const s = playback.getState();
    if (pinned === "high" || pinned === "medium" || pinned === "low")
      s.setQuality(pinned);
    s.start(titanic, titanic.realNight);
    s.play();
    // Checking only: compute the night in bigger chunks than the frame loop
    // (software WebGL can run at a frame a second).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const chunk = () => {
      if (playback.getState().done) return;
      playback.getState().pump(40);
      timer = setTimeout(chunk, 0);
    };
    chunk();
    return () => {
      clearTimeout(timer);
      playback.getState().reset();
    };
  }, [pinned]);

  return (
    <div
      data-testid="shipwreck-scene"
      // safe-area-ok: a full-bleed stage for checking the scene, no controls
      className="fixed inset-0 bg-[#02040a]"
    >
      <NightScene store={playback} autoQuality={pinned === null} />
    </div>
  );
}
