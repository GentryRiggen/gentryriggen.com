import { THEME_SCRIPT, isJimPath } from "../themeScript";

interface Run {
  themeColor: string | null;
  dark: boolean;
}

/** Runs the exact inline script against a fake page at `path`. */
function run(path: string, saved: string | null = "dark"): Run {
  const meta = { content: "#ffffff" as string | null };
  const classes = new Set<string>();
  const document = {
    documentElement: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
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
    { getItem: () => saved },
    { matchMedia: () => ({ matches: false }) },
    document,
    { pathname: path }
  );
  return { themeColor: meta.content, dark: classes.has("dark") };
}

it("is valid JavaScript", () => {
  expect(() => new Function(THEME_SCRIPT)).not.toThrow();
});

it("sets the theme color on site pages", () => {
  expect(run("/")).toEqual({ themeColor: "#030712", dark: true });
  expect(run("/jimmy")).toEqual({ themeColor: "#030712", dark: true });
  expect(run("/", "light")).toEqual({ themeColor: "#ffffff", dark: false });
});

it("leaves /jim's theme color alone", () => {
  for (const path of ["/jim", "/jim/", "/jim.html", "/jim/x"]) {
    expect(run(path).themeColor).toBe("#ffffff");
  }
});

it("knows /jim paths", () => {
  expect(isJimPath("/jim")).toBe(true);
  expect(isJimPath("/jim/")).toBe(true);
  expect(isJimPath("/jim.html")).toBe(true);
  expect(isJimPath("/jimmy")).toBe(false);
  expect(isJimPath("/")).toBe(false);
});
