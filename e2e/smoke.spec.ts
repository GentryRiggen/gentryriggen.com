import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * The CI e2e check: every page loads with no uncaught error and no
 * console.error (where React reports a crashed render). It catches the
 * breakage that matters most (a crashed page, a bad import, a missing asset)
 * in about a minute. The deeper specs beside it run locally, not in CI.
 */

// Headless Chromium has no GPU, so ask for SwiftShader to let the 3D pages
// start their scenes (Chromium only; WebKit refuses these flags).
test.use({
  launchOptions: [
    async ({ browserName }, use) =>
      use(
        browserName === "chromium"
          ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
          : {}
      ),
    { scope: "worker" },
  ],
});

/** Every page in app/ (app/foo/bar/page.tsx is /foo/bar), so new pages join. */
const ROUTES = (
  fs.readdirSync("app", { recursive: true, encoding: "utf8" }) as string[]
)
  .filter((file) => path.basename(file) === "page.tsx")
  .map((file) => path.dirname(file).split(path.sep).join("/"))
  .map((dir) => (dir === "." ? "/" : `/${dir}`))
  .sort();

for (const route of ROUTES) {
  test(`${route} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    // Give client components and 3D scenes a moment to mount and throw.
    await page.waitForTimeout(3_000);
    expect(errors).toEqual([]);
  });
}
