"use client";

import { useShipped } from "./ShippedContext";
import { LINK_CLASS } from "./styles";

/** A Claude Code style todo list of what shipped lately. */
export default function Shipped() {
  const { latest, total } = useShipped();

  return (
    <div>
      <ul className="space-y-1.5 sm:space-y-1">
        {latest.map((release) => (
          <li
            key={release.gameId}
            className="grid grid-cols-[1.25rem_1fr_auto] gap-x-2"
          >
            <span className="text-term-ok">
              <span aria-hidden="true">☒</span>
              <span className="sr-only">done:</span>
            </span>
            <span className="min-w-0">
              <a href={release.href} className={LINK_CLASS}>
                {release.gameName} {release.version}
              </a>
              <span className="text-term-muted">: {release.title}</span>
            </span>
            <span className="text-xs leading-6 text-term-key">
              {release.date}
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[1.25rem_1fr] gap-x-2 text-term-muted">
          <span>
            <span aria-hidden="true">☐</span>
            <span className="sr-only">to do:</span>
          </span>
          <span>The next release (the boys have already filed bugs)</span>
        </li>
      </ul>
      {total > 0 && (
        <p className="mt-2 text-xs text-term-muted">
          {total} releases shipped so far. Tap one for its changelog.
        </p>
      )}
    </div>
  );
}
