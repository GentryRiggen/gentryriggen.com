import {
  EVER_ONWARD_THEME_COLOR,
  FLAMELINGS_THEME_COLOR,
  SHIPWRECK_THEME_COLOR,
  JIM_THEME_COLOR,
  TERM_THEME_KEY,
  THEME_SCRIPT,
  fixedThemeColor,
  isEverOnwardPath,
  isJimPath,
} from "../themeScript";

interface Run {
  themeColor: string | null;
  dark: boolean;
  termTheme?: string;
}

/** Runs the exact inline script against a fake page at `path`. */
function run(
  path: string,
  saved: string | null = "dark",
  savedTermTheme: string | null = null
): Run {
  const attributes: Record<string, string> = {};
  const meta = { content: "#ffffff" as string | null };
  const classes = new Set<string>();
  const document = {
    documentElement: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
    querySelector: () => ({
      setAttribute: (_name: string, value: string) => {
        meta.content = value;
      },
    }),
  };
  const fn = new Function(
    "localStorage",
    "window",
    "document",
    "location",
    THEME_SCRIPT
  );
  fn(
    {
      getItem: (key: string) =>
        key === TERM_THEME_KEY ? savedTermTheme : saved,
    },
    { matchMedia: () => ({ matches: false }) },
    document,
    { pathname: path }
  );
  const result: Run = { themeColor: meta.content, dark: classes.has("dark") };
  if (attributes["data-term-theme"]) {
    result.termTheme = attributes["data-term-theme"];
  }
  return result;
}

it("is valid JavaScript", () => {
  expect(() => new Function(THEME_SCRIPT)).not.toThrow();
});

it("sets the theme color on site pages", () => {
  expect(run("/")).toEqual({ themeColor: "#030712", dark: true });
  expect(run("/jimmy")).toEqual({ themeColor: "#030712", dark: true });
  expect(run("/", "light")).toEqual({ themeColor: "#ffffff", dark: false });
});

it("gives /jim its Ayu Mirage theme color in light and dark", () => {
  for (const path of ["/jim", "/jim/", "/jim.html", "/jim/x"]) {
    expect(run(path).themeColor).toBe(JIM_THEME_COLOR);
    expect(run(path, "light").themeColor).toBe(JIM_THEME_COLOR);
  }
});

it("knows /jim paths", () => {
  expect(isJimPath("/jim")).toBe(true);
  expect(isJimPath("/jim/")).toBe(true);
  expect(isJimPath("/jim.html")).toBe(true);
  expect(isJimPath("/jimmy")).toBe(false);
  expect(isJimPath("/")).toBe(false);
});

it("gives Ever Onward its dark theme color in light and dark", () => {
  for (const path of [
    "/ever-onward",
    "/ever-onward/",
    "/ever-onward.html",
    "/ever-onward/versions",
  ]) {
    expect(run(path).themeColor).toBe(EVER_ONWARD_THEME_COLOR);
    expect(run(path, "light").themeColor).toBe(EVER_ONWARD_THEME_COLOR);
  }
  expect(run("/ever-onwardx", "light").themeColor).toBe("#ffffff");
});

it("knows the pages with a fixed theme color", () => {
  expect(isEverOnwardPath("/ever-onward")).toBe(true);
  expect(isEverOnwardPath("/ever-onwardx")).toBe(false);
  expect(fixedThemeColor("/jim")).toBe(JIM_THEME_COLOR);
  expect(fixedThemeColor("/ever-onward/versions")).toBe(
    EVER_ONWARD_THEME_COLOR
  );
  expect(fixedThemeColor("/")).toBeNull();
});

it("keeps Flamelings its own purple, light or dark", () => {
  for (const path of [
    "/flamelings",
    "/flamelings/",
    "/flamelings.html",
    "/flamelings/versions",
  ]) {
    expect(run(path).themeColor).toBe(FLAMELINGS_THEME_COLOR);
    expect(run(path, "light").themeColor).toBe(FLAMELINGS_THEME_COLOR);
  }
  expect(run("/flamelingsx", "light").themeColor).toBe("#ffffff");
  expect(fixedThemeColor("/flamelings/versions")).toBe(FLAMELINGS_THEME_COLOR);
});

it("keeps Shipwreck its own night blue, light or dark", () => {
  for (const path of [
    "/shipwreck",
    "/shipwreck/",
    "/shipwreck.html",
    "/shipwreck/versions",
  ]) {
    expect(run(path).themeColor).toBe(SHIPWRECK_THEME_COLOR);
    expect(run(path, "light").themeColor).toBe(SHIPWRECK_THEME_COLOR);
  }
  expect(run("/shipwreckx", "light").themeColor).toBe("#ffffff");
  expect(fixedThemeColor("/shipwreck/versions")).toBe(SHIPWRECK_THEME_COLOR);
});

it("applies the saved homepage terminal theme before paint", () => {
  expect(run("/", "dark", "dracula").termTheme).toBe("dracula");
  expect(run("/", "dark", null).termTheme).toBeUndefined();
});
