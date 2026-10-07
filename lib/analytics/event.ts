import { isExcluded } from "./exclude";
import { normalizePath, siteForPath } from "./site";
import type { KeyValueStorage } from "./storage";
import type { PageviewEvent } from "./types";
import { isBot, parseBrowser, parseDevice, parseOs, screenBucket } from "./ua";
import { getVisitorId } from "./visitor";

export interface PageviewEnv {
  pathname: string;
  hostname: string;
  referrer: string;
  userAgent: string;
  webdriver: boolean;
  maxTouchPoints: number;
  screenWidth: number;
  timeZone: string;
  isProduction: boolean;
  storage: KeyValueStorage | null;
  /** True only for the first view of this page load (the referrer is only meaningful then). */
  firstView: boolean;
  now?: Date;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function bareHost(host: string): string {
  return host.replace(/^www\./, "");
}

function referrerHost(referrer: string, hostname: string): string {
  if (!referrer) return "";
  try {
    const host = bareHost(new URL(referrer).hostname);
    return host === bareHost(hostname) ? "" : host.slice(0, 100);
  } catch {
    return "";
  }
}

/** The event to record for this view, or null if it should not be tracked. */
export function buildPageview(env: PageviewEnv): PageviewEvent | null {
  if (!env.isProduction) return null;
  if (LOCAL_HOSTS.has(env.hostname)) return null;
  if (isExcluded(env.storage)) return null;
  if (isBot(env.userAgent, env.webdriver)) return null;
  const site = siteForPath(env.pathname);
  if (!site) return null;

  return {
    site,
    path: normalizePath(env.pathname),
    ref: env.firstView ? referrerHost(env.referrer, env.hostname) : "",
    device: parseDevice(env.userAgent, env.maxTouchPoints),
    browser: parseBrowser(env.userAgent),
    os: parseOs(env.userAgent, env.maxTouchPoints),
    screen: screenBucket(env.screenWidth),
    tz: env.timeZone.slice(0, 64),
    vid: getVisitorId(env.storage, env.now),
  };
}
