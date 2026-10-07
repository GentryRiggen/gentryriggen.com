export type Site = "home" | "ship-builder";
export const SITES: readonly Site[] = ["home", "ship-builder"];

export type Device = "mobile" | "tablet" | "desktop";
export type ScreenBucket = "<640" | "640-1023" | "1024-1439" | "1440+";

/** The fields stored in a pageviews doc (besides the server timestamp). */
export interface PageviewEvent {
  site: Site;
  path: string;
  ref: string;
  device: Device;
  browser: string;
  os: string;
  screen: ScreenBucket;
  tz: string;
  vid: string;
}

/** A pageviews doc as the dashboard reads it. */
export interface PageviewDoc extends PageviewEvent {
  ts: Date;
}
