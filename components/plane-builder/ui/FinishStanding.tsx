import type { Ref } from "react";
import type { Standing } from "@/lib/leaderboard/rank";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { medalFor } from "./standing";
import { secondaryButtonClass } from "./styles";

interface FinishStandingProps {
  levelId: LevelId;
  standing: Standing;
  onOpenBoard: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

/** Names come from the database: they are only ever rendered as text. */
function detailFor(standing: Standing): string | null {
  if (standing.kind === "offBoard") {
    return `${standing.gap.toFixed(1)} s faster to reach the top 50!`;
  }
  const [closest, ...others] = standing.passed;
  if (closest) {
    const more = others.length > 0 ? ` +${others.length} more` : "";
    return `You passed ${closest.nickname}${more}!`;
  }
  if (standing.rival && standing.gap !== null) {
    return `${standing.gap.toFixed(1)} s faster to pass ${standing.rival.nickname}`;
  }
  return null;
}

/** The after-finish leaderboard line, with a button to open the board. */
export default function FinishStanding({
  levelId,
  standing,
  onOpenBoard,
  buttonRef,
}: FinishStandingProps) {
  const name = LEVELS[levelId].name;
  const headline =
    standing.kind === "ranked"
      ? `${medalFor(standing.rank) ?? "🏆"} #${standing.rank} on ${name}!`
      : `🏆 So close on ${name}!`;
  const detail = detailFor(standing);

  return (
    <div
      data-testid="finish-standing"
      className="rounded-xl bg-sky-100 p-3 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100"
    >
      <p className="text-lg font-extrabold">{headline}</p>
      {detail ? <p className="font-semibold">{detail}</p> : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={onOpenBoard}
        className={`${secondaryButtonClass} mt-2`}
      >
        See the board 🏆
      </button>
    </div>
  );
}
