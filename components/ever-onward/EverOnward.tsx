"use client";

import { useState } from "react";
import { hasStartedUniverse } from "@/lib/ever-onward/engine/progress";
import useTitleMusic from "./audio/useTitleMusic";
import GameScreen from "./game/GameScreen";
import { useGame } from "./game/useGame";
import Hub from "./Hub";
import StartScreen from "./start/StartScreen";
import UpdatePill from "@/components/update/UpdatePill";
import { useStaleChunkRecovery } from "@/components/update/useStaleChunkRecovery";
import { useUpdateCheck } from "@/components/update/useUpdateCheck";
import useBlockPinchZoom from "./useBlockPinchZoom";

const UPDATE_PILL_BUTTON =
  "pointer-events-auto min-h-11 rounded-full border-2 border-amber-300 bg-slate-950 px-5 py-2 text-sm font-semibold text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.45)] hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export default function EverOnward() {
  useBlockPinchZoom();
  const game = useGame();
  const { isUpdateReady } = useUpdateCheck({
    versionUrl: "/ever-onward/version.json",
  });
  const [isOnStartScreen, setIsOnStartScreen] = useState(true);
  const { save, def, universe } = game;
  useStaleChunkRecovery(game.saveNow);
  // The title theme plays on the start screen and the hub, not in a universe.
  useTitleMusic(!!save && !def);

  if (!save) {
    return (
      <div
        role="status"
        className="grid min-h-dvh place-items-center bg-slate-950 text-slate-400"
      >
        Loading…
      </div>
    );
  }

  const startedIds = Object.entries(save.universes)
    .filter(([, saved]) => hasStartedUniverse(saved))
    .map(([id]) => id);

  // Only when the player taps: never reload in the middle of play.
  const handleUpdate = () => {
    game.saveNow();
    window.location.reload();
  };

  return (
    <>
      {def && universe ? (
        <GameScreen
          def={def}
          universe={universe}
          overlay={game.overlay}
          onTap={game.tap}
          onBuy={game.buyUpgrade}
          onAction={game.doAction}
          onGreet={game.greet}
          onChooseLantern={game.chooseLantern}
          onBuyEmber={game.buyEmberUpgrade}
          onDismissEmberTip={game.dismissEmberTip}
          onRestart={game.restart}
          onLeave={game.leave}
          onReplaceSave={game.replaceSave}
          currentSave={save}
          onDismissOverlay={game.dismissOverlay}
        />
      ) : isOnStartScreen ? (
        <StartScreen
          hasSave={startedIds.length > 0}
          startedIds={startedIds}
          onStart={() => setIsOnStartScreen(false)}
        />
      ) : (
        <Hub save={save} isRecovered={game.recovered} onPlay={game.open} />
      )}
      {(isUpdateReady || game.hasNewerSave) && (
        <UpdatePill
          onUpdate={handleUpdate}
          testId="eo-update"
          label="Update ready ✨ — tap to update"
          buttonClassName={UPDATE_PILL_BUTTON}
        />
      )}
    </>
  );
}
