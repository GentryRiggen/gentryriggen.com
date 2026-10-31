import { test, expect, type Page, type TestInfo } from "@playwright/test";

/**
 * /jim is a private chat that is used mostly on an iPhone. Runs on Chromium
 * (desktop), the `iphone` project (WebKit, touch) and the WebKit smoke set.
 * The server URL is mocked through the e2e-only `__JIM_TEST__` hook, and the
 * screenshots in test-results/jim/ are for a human to look at.
 */

const API = "https://jim.example.test";
const SHOTS = "test-results/jim";

const LONG_REPLY = [
  "Here's what is on the list:",
  "",
  "- **Renew** the registration (due Friday)",
  "- Call about the `invoice`",
  "- Read https://example.com/a/very/long/link/that/should/wrap/instead/of/scrolling/sideways",
].join("\n");

async function mockServer(page: Page) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  await page.route(`${API}/**`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const { text } = route.request().postDataJSON() as { text: string };
    if (text.startsWith("slow: ")) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.fulfill({
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: text.includes("remember") ? "Saved it." : LONG_REPLY,
        changed: text.includes("remember") ? ["lists/todos.md"] : [],
        commit: null,
      }),
    });
  });
}

async function signedIn(page: Page) {
  await page.addInitScript((api) => {
    window.__JIM_TEST__ = { signedIn: true, api };
  }, API);
  await mockServer(page);
  await page.goto("/jim");
  await expect(page.getByLabel("Message")).toBeVisible();
}

async function send(page: Page, text: string, reply: string | RegExp) {
  const box = page.getByLabel("Message");
  await box.fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  // The box keeps focus, so the phone keyboard stays up for the next message.
  await expect(box).toBeFocused();
  await expect(page.getByRole("log").getByText(reply).last()).toBeVisible();
}

async function noSidewaysScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

async function fontSize(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

function shotName(
  page: Page,
  testInfo: TestInfo,
  name: string,
  scheme: string
) {
  const width = page.viewportSize()?.width ?? 0;
  return `${SHOTS}/${name}-${testInfo.project.name}-${width}-${scheme}.png`;
}

test.describe("Jim", () => {
  test(
    "signed out: shows the sign-in form and never calls the server",
    { tag: "@smoke" },
    async ({ page }) => {
      const calls: string[] = [];
      page.on("request", (req) => {
        if (req.url().startsWith(API) || /\.run\.app\//.test(req.url())) {
          calls.push(req.url());
        }
      });
      await page.addInitScript((api) => {
        window.__JIM_TEST__ = { api };
      }, API);
      await page.goto("/jim");
      await expect(page.getByRole("heading", { name: "Jim" })).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(page.getByLabel("Message")).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      expect(calls).toEqual([]);
    }
  );

  test("is not indexable and is a home-screen app", async ({ page }) => {
    await page.goto("/jim");
    await expect(page).toHaveTitle("Jim");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/jim.webmanifest"
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]')
    ).toHaveAttribute("content", "yes");
    await expect(
      page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')
    ).toHaveAttribute("href", "/jim-icons/apple-touch-icon.png");
    const manifest = await page.request.get("/jim.webmanifest");
    expect(await manifest.json()).toMatchObject({ start_url: "/jim" });
    // Not the homepage's canonical or share card.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://gentryriggen.com/jim"
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://gentryriggen.com/jim"
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Jim"
    );
    // The status bar follows light and dark mode.
    await expect(
      page.locator('meta[name="theme-color"][media*="dark"]')
    ).toHaveAttribute("content", "#030712");
    await expect(
      page.locator('meta[name="theme-color"][media*="light"]')
    ).toHaveAttribute("content", "#ffffff");
  });

  test("says Jim isn't connected when there is no server URL", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__JIM_TEST__ = { signedIn: true, api: "" };
    });
    await page.goto("/jim");
    await expect(page.getByText("Jim isn't connected yet")).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveCount(0);
  });

  test("sends a message and shows the reply and saved files", async ({
    page,
  }) => {
    await signedIn(page);
    await send(page, "remember the milk", "Saved it.");
    await expect(page.getByText("remember the milk")).toBeVisible();
    await expect(page.getByText("Saved: lists/todos.md")).toBeVisible();
  });
});

for (const width of [undefined, 320]) {
  test.describe(`Jim layout${width ? ` at ${width}px` : ""}`, () => {
    if (width) test.use({ viewport: { width, height: 568 } });

    for (const scheme of ["light", "dark"] as const) {
      test.describe(scheme, () => {
        test.use({ colorScheme: scheme });

        test(
          "sign-in fits the screen with 16px inputs",
          { tag: "@smoke" },
          async ({ page }, testInfo) => {
            await page.goto("/jim");
            await expect(page.getByLabel("Email")).toBeVisible();
            await noSidewaysScroll(page);
            expect(await fontSize(page, "#jim-email")).toBeGreaterThanOrEqual(
              16
            );
            expect(
              await fontSize(page, "#jim-password")
            ).toBeGreaterThanOrEqual(16);
            const button = await page
              .getByRole("button", { name: "Sign in" })
              .boundingBox();
            expect(button?.height).toBeGreaterThanOrEqual(44);
            await expect(
              page.getByRole("button", { name: "Sign in" })
            ).toBeEnabled();
            await page.screenshot({
              path: shotName(page, testInfo, "sign-in", scheme),
              animations: "disabled",
            });
          }
        );

        test(
          "a long chat keeps the box and the latest message on screen",
          { tag: "@smoke" },
          async ({ page }, testInfo) => {
            await signedIn(page);
            for (let i = 1; i <= 4; i++) {
              await send(page, `what's on my list? (${i})`, /^Here's what/);
            }
            await send(
              page,
              "remember to call\nabout the invoice",
              "Saved it."
            );

            const box = page.getByLabel("Message");
            const sendButton = page.getByRole("button", { name: "Send" });
            await expect(box).toBeInViewport({ ratio: 1 });
            await expect(sendButton).toBeInViewport({ ratio: 1 });
            await expect(
              page.getByText("Saved: lists/todos.md")
            ).toBeInViewport({ ratio: 1 });
            await noSidewaysScroll(page);
            expect(await fontSize(page, "#jim-message")).toBeGreaterThanOrEqual(
              16
            );
            // Send must not inherit the site-wide `transition: all` (it made
            // the button lag a state behind in screenshots).
            expect(
              await sendButton.evaluate(
                (el) => getComputedStyle(el).transitionProperty
              )
            ).not.toContain("all");
            const size = await sendButton.boundingBox();
            expect(size?.width).toBeGreaterThanOrEqual(44);
            expect(size?.height).toBeGreaterThanOrEqual(44);

            // A draft grows the box, and the latest message stays in view.
            await box.fill("one\ntwo\nthree");
            await expect
              .poll(async () => (await box.boundingBox())?.height ?? 0)
              .toBeGreaterThan(60);
            await expect(
              page.getByText("Saved: lists/todos.md")
            ).toBeInViewport();
            await expect(box).toBeInViewport({ ratio: 1 });
            await box.fill("");
            await box.blur();

            // Wait for the settled state (an empty box disables Send).
            await expect(sendButton).toBeDisabled();
            await expect(box).toHaveJSProperty("value", "");
            await page.screenshot({
              path: shotName(page, testInfo, "chat", scheme),
              animations: "disabled",
            });
          }
        );
      });
    }
  });
}

test("a reply that lands while scrolled up does not yank the view", async ({
  page,
}) => {
  await signedIn(page);
  for (let i = 1; i <= 4; i++) {
    await send(page, `what's on my list? (${i})`, /^Here's what/);
  }
  await page.getByLabel("Message").fill("slow: remember the milk");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Jim is thinking…")).toBeInViewport();
  await page.waitForTimeout(600); // let the smooth scroll finish
  const first = page.getByText("what's on my list? (1)");
  await first.evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
  await expect(page.getByText("Saved it.")).toHaveCount(1);
  await page.waitForTimeout(600);
  await expect(first).toBeInViewport();
});
