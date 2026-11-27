/**
 * "Recently shipped": the newest feature release of each game, read from the
 * changelogs at build time (app/page.tsx) so the changelogs never reach the
 * browser.
 */

import { GAMES } from "./games";

/** The fields of a changelog entry this needs. */
export interface ChangelogEntry {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
}

export interface ShippedRelease {
  gameId: string;
  gameName: string;
  emoji: string;
  version: string;
  /** e.g. "Nov 27" */
  date: string;
  title: string;
  /** The game's Versions page. */
  href: string;
}

export interface ShippedSummary {
  latest: ShippedRelease[];
  /** Every release of every game. */
  total: number;
}

function isPatch(version: string): boolean {
  return !version.endsWith(".0");
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Each game's newest feature release (its newest release if it only has
 * patches), newest first. Patches like "works on older iPads" say less about
 * what got built.
 */
export function summarizeReleases(
  changelogs: Readonly<Record<string, readonly ChangelogEntry[]>>
): ShippedSummary {
  const latest: { release: ShippedRelease; iso: string; order: number }[] = [];
  let total = 0;
  GAMES.forEach((game, order) => {
    const changelog = changelogs[game.id] ?? [];
    total += changelog.length;
    const entry = changelog.find((e) => !isPatch(e.version)) ?? changelog[0];
    if (!entry) return;
    latest.push({
      release: {
        gameId: game.id,
        gameName: game.name,
        emoji: game.emoji,
        version: entry.version,
        date: shortDate(entry.date),
        title: entry.title,
        href: `${game.href}/versions`,
      },
      iso: entry.date,
      order,
    });
  });
  latest.sort((a, b) => b.iso.localeCompare(a.iso) || a.order - b.order);
  return {
    latest: latest.map(({ release }) => release),
    total,
  };
}

export const EMPTY_SHIPPED: ShippedSummary = { latest: [], total: 0 };
