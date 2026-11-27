import { GAMES } from "./games";
import { LINK_CLASS } from "./styles";

/** `ls ~/side-projects/`: one row per game, newest first. */
export default function SideProjects() {
  return (
    <div>
      <p className="mb-2 text-term-muted">
        Games I build for (and get QA&apos;d by) my two boys:
      </p>
      <ul className="space-y-1.5 sm:space-y-1">
        {GAMES.map((game) => (
          <li
            key={game.id}
            className="grid grid-cols-[1.75rem_1fr_auto] gap-x-2 sm:grid-cols-[1.75rem_10rem_1fr_auto]"
          >
            <span aria-hidden="true">{game.emoji}</span>
            <a href={game.href} className={`${LINK_CLASS} justify-self-start`}>
              {game.id}/
            </a>
            <span className="col-start-2 row-start-2 text-term-muted sm:col-start-3 sm:row-start-1">
              {game.tagline}
            </span>
            <span className="col-start-3 row-start-1 text-right text-xs leading-6 text-term-key sm:col-start-4">
              v{game.version}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-term-muted">
        Tap one to play, or type its name.
      </p>
    </div>
  );
}
