"use client";

import { useState } from "react";
import { hasStartedUniverse } from "@/lib/ever-onward/engine/progress";
import GameScreen from "./game/GameScreen";
import { useGame } from "./game/useGame";
import Hub from "./Hub";
import StartScreen from "./start/StartScreen";
import UpdatePill from "./UpdatePill";
import { useStaleChunkRecovery } from "./useStaleChunkRecovery";
import { useUpdateCheck } from "./useUpdateCheck";
import useBlockPinchZoom from "./useBlockPinchZoom";

export default function EverOnward() {
  useBlockPinchZoom();
  const game = useGame();
  const { isUpdateReady } = useUpdateCheck();
  const [isOnStartScreen, setIsOnStartScreen] = useState(true);
  const { save, def, universe } = game;
  useStaleChunkRecovery(game.saveNow);

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
          onBuyEmber={game.buyEmberUpgrade}
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
        <UpdatePill onUpdate={handleUpdate} />
      )}
    </>
  );
}
