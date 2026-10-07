import type { Device, ScreenBucket } from "./types";

export function parseBrowser(ua: string): string {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

// iPadOS Safari reports a Macintosh UA; touch support tells them apart.
function isIpadOs(ua: string, maxTouchPoints: number): boolean {
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export function parseOs(ua: string, maxTouchPoints = 0): string {
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs(ua, maxTouchPoints)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Other";
}

export function parseDevice(ua: string, maxTouchPoints = 0): Device {
  if (/iPad/.test(ua) || isIpadOs(ua, maxTouchPoints)) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (/iPhone|iPod|Android|Mobile/.test(ua)) return "mobile";
  return "desktop";
}

export function isBot(ua: string, webdriver = false): boolean {
  return (
    webdriver ||
    !ua ||
    /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|monitor/i.test(
      ua
    )
  );
}

export function screenBucket(width: number): ScreenBucket {
  if (width < 640) return "<640";
  if (width < 1024) return "640-1023";
  if (width < 1440) return "1024-1439";
  return "1440+";
}
