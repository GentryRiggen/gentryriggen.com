"use client";

import GameScreen from "./game/GameScreen";
import { useGame } from "./game/useGame";
import Hub from "./Hub";

export default function EverOnward() {
  const game = useGame();
  const { save, def, universe } = game;

  if (!save) {
    return (
      <div
        role="status"
        className="grid min-h-dvh place-items-center bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400"
      >
        Loading…
      </div>
    );
  }

  if (def && universe) {
    return (
      <GameScreen
        def={def}
        universe={universe}
        overlay={game.overlay}
        onTap={game.tap}
        onBuy={game.buyUpgrade}
        onBuyEmber={game.buyEmberUpgrade}
        onRestart={game.restart}
        onLeave={game.leave}
        onReplaceSave={game.replaceSave}
        currentSave={save}
        onDismissOverlay={game.dismissOverlay}
      />
    );
  }

  return <Hub save={save} isRecovered={game.recovered} onPlay={game.open} />;
}
