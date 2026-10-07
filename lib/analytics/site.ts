import type { Site } from "./types";

export function normalizePath(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.slice(0, 200) || "/";
}

/** Which tracked part of the site a path belongs to, or null if untracked. */
export function siteForPath(pathname: string): Site | null {
  const path = normalizePath(pathname);
  if (path === "/") return "home";
  if (path === "/ship-builder" || path.startsWith("/ship-builder/")) {
    return "ship-builder";
  }
  return null;
}
