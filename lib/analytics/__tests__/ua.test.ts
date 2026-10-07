import { isBot, parseBrowser, parseDevice, parseOs, screenBucket } from "../ua";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE = CHROME_WIN + " Edg/126.0.0.0";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("parseBrowser", () => {
  it.each([
    [CHROME_WIN, "Chrome"],
    [EDGE, "Edge"],
    [FIREFOX_MAC, "Firefox"],
    [SAFARI_IPHONE, "Safari"],
    [ANDROID_PHONE, "Chrome"],
    ["curl/8.0", "Other"],
  ])("%s", (ua, browser) => {
    expect(parseBrowser(ua)).toBe(browser);
  });
});

describe("parseOs", () => {
  it.each([
    [CHROME_WIN, 0, "Windows"],
    [FIREFOX_MAC, 0, "macOS"],
    [SAFARI_IPHONE, 5, "iOS"],
    [SAFARI_IPAD_DESKTOP_MODE, 5, "iOS"],
    [SAFARI_IPAD_DESKTOP_MODE, 0, "macOS"],
    [ANDROID_PHONE, 5, "Android"],
    ["Mozilla/5.0 (X11; Linux x86_64)", 0, "Linux"],
  ])("%s touch=%s", (ua, touch, os) => {
    expect(parseOs(ua, touch)).toBe(os);
  });
});

describe("parseDevice", () => {
  it.each([
    [CHROME_WIN, 0, "desktop"],
    [SAFARI_IPHONE, 5, "mobile"],
    [SAFARI_IPAD_DESKTOP_MODE, 5, "tablet"],
    [ANDROID_PHONE, 5, "mobile"],
    [ANDROID_TABLET, 5, "tablet"],
  ])("%s touch=%s", (ua, touch, device) => {
    expect(parseDevice(ua, touch)).toBe(device);
  });
});

describe("isBot", () => {
  it("flags crawlers, headless browsers, webdriver and empty UAs", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/126.0.0.0")).toBe(true);
    expect(isBot(CHROME_WIN, true)).toBe(true);
    expect(isBot("")).toBe(true);
  });

  it("lets real browsers through", () => {
    expect(isBot(CHROME_WIN)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });
});

describe("screenBucket", () => {
  it.each([
    [320, "<640"],
    [639, "<640"],
    [640, "640-1023"],
    [1023, "640-1023"],
    [1024, "1024-1439"],
    [1439, "1024-1439"],
    [1440, "1440+"],
    [3840, "1440+"],
  ])("%s -> %s", (w, bucket) => {
    expect(screenBucket(w)).toBe(bucket);
  });
});
