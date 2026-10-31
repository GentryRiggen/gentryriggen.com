import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { VIEW_FIXTURE } from "../lib/jim/__tests__/fixtures";

/**
 * /jim is a private chat that is used mostly on an iPhone. Runs on Chromium
 * (desktop), the `iphone` project (WebKit, touch) and the WebKit smoke set.
 * The server URL is mocked through the e2e-only `__JIM_TEST__` hook (the
 * Notes data is an invented fixture), and the screenshots in
 * test-results/jim/ are for a human to look at.
 */

// Calendar times are UTC in the payload and shown in local time.
test.use({ timezoneId: "America/Denver" });

/** Ayu Mirage's background, in light and dark mode alike. */
const AYU_BG = "rgb(31, 36, 48)";

const API = "https://jim.example.test";
const SHOTS = "test-results/jim";

const LONG_REPLY = [
  "Here's what is on the list:",
  "",
  "- **Renew** the registration (due Friday)",
  "- Call about the `invoice`",
  "- Read https://example.com/a/very/long/link/that/should/wrap/instead/of/scrolling/sideways",
].join("\n");

interface MockOptions {
  /** Refuse the first /api/view call with a 401 (an expired token). */
  viewExpiredOnce?: boolean;
}

interface MockCalls {
  view: number;
  chat: number;
}

async function mockServer(
  page: Page,
  options: MockOptions = {}
): Promise<MockCalls> {
  const calls: MockCalls = { view: 0, chat: 0 };
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
    if (route.request().url().endsWith("/api/view")) {
      calls.view += 1;
      if (options.viewExpiredOnce && calls.view === 1) {
        await route.fulfill({
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "expired" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(VIEW_FIXTURE),
      });
      return;
    }
    calls.chat += 1;
    const { text } = route.request().postDataJSON() as { text: string };
    if (text.startsWith("drop: ")) {
      await route.abort("connectionreset");
      return;
    }
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
  return calls;
}

async function signedIn(
  page: Page,
  options: MockOptions = {}
): Promise<MockCalls> {
  await page.addInitScript((api) => {
    window.__JIM_TEST__ = { signedIn: true, api };
  }, API);
  const calls = await mockServer(page, options);
  await page.goto("/jim");
  await expect(page.getByLabel("Message")).toBeVisible();
  return calls;
}

async function openNotes(page: Page) {
  await page.getByRole("tab", { name: "Notes" }).click();
  await expect(page.getByText("Water the plants")).toBeVisible();
}

/** Every visible button and tab on screen is at least 44px tall. */
async function bigTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=tab], summary, input")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map((el) => el.textContent?.trim() || el.getAttribute("aria-label"))
  );
  expect(small).toEqual([]);
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
    // The status bar is Ayu Mirage in light and dark mode: the first
    // theme-color (the one Safari uses) stays put after the theme script.
    await expect(
      page.locator('meta[name="theme-color"]').first()
    ).toHaveAttribute("content", "#1f2430");
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
            // Ayu Mirage whatever the system scheme.
            expect(
              await page.evaluate(
                () => getComputedStyle(document.body).backgroundColor
              )
            ).toBe(AYU_BG);
            await expect(
              page.locator('meta[name="theme-color"]').first()
            ).toHaveAttribute("content", "#1f2430");
            await page.screenshot({
              path: shotName(page, testInfo, "chat", scheme),
              animations: "disabled",
            });
          }
        );
      });
    }

    test(
      "every Notes page fits the screen with big targets",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        await signedIn(page);
        await openNotes(page);
        const shot = async (name: string) => {
          await noSidewaysScroll(page);
          await bigTargets(page);
          await page.screenshot({
            path: shotName(page, testInfo, name, "ayu"),
            animations: "disabled",
          });
        };
        // The bottom bar clears the home bar and the tabs are thumb-sized.
        const notesTab = await page
          .getByRole("tab", { name: "Notes" })
          .boundingBox();
        expect(notesTab?.height).toBeGreaterThanOrEqual(44);
        await expect(page.getByRole("tab", { name: "Notes" })).toBeInViewport({
          ratio: 1,
        });
        await shot("notes-home");
        // Each page pill, once selected, sits well inside the screen.
        for (const name of ["People", "Golf", "Training", "Health", "Home"]) {
          const tab = page.getByRole("tab", { name });
          await tab.click();
          await expect(tab).toHaveAttribute("aria-selected", "true");
          const width = page.viewportSize()?.width ?? 0;
          await expect
            .poll(async () => {
              const box = await tab.boundingBox();
              return box ? Math.min(box.x, width - (box.x + box.width)) : -1;
            })
            .toBeGreaterThanOrEqual(12);
          await noSidewaysScroll(page);
        }
        await page.getByText(/^Later/).click();
        await expect(page.getByText("Book the dentist")).toBeVisible();
        await shot("notes-home-later");

        await page.getByRole("tab", { name: "Health" }).click();
        await expect(page.getByText("Hemoglobin")).toBeVisible();
        // A new page opens at its top, not where the last one was scrolled.
        await expect(
          page.getByRole("button", { name: "Refresh" })
        ).toBeInViewport();
        await shot("notes-health");

        await page.getByRole("tab", { name: "Training" }).click();
        await expect(page.getByText("Back squat")).toBeVisible();
        // A new page opens at its top, not where the last one was scrolled.
        await expect(
          page.getByRole("button", { name: "Refresh" })
        ).toBeInViewport();
        await shot("notes-training");

        await page.getByRole("tab", { name: "Golf" }).click();
        await expect(page.getByText("Cedar Ridge").first()).toBeVisible();
        await shot("notes-golf");

        await page.getByRole("tab", { name: "People" }).click();
        const search = page.getByLabel("Search people");
        await expect(search).toBeVisible();
        expect(
          await fontSize(page, "#jim-people-search")
        ).toBeGreaterThanOrEqual(16);
        await shot("notes-people");

        await page.getByRole("button", { name: /Sam Okafor/ }).click();
        await expect(
          page.getByRole("heading", { name: "Sam Okafor" })
        ).toBeVisible();
        // A wide table scrolls inside itself, never the page.
        await expect(page.locator("table")).toBeVisible();
        await shot("notes-person-table");

        await page.getByRole("button", { name: "People" }).click();
        await page.getByRole("button", { name: /Wren Rivera/ }).click();
        await expect(page.getByText("Jun 16, 1990")).toBeVisible();
        await shot("notes-person");
      }
    );
  });
}

test(
  "Done on a Notes todo puts it in the chat box without sending",
  { tag: "@smoke" },
  async ({ page }) => {
    const calls = await signedIn(page);
    await openNotes(page);
    await page.getByRole("button", { name: "Done: Water the plants" }).click();
    await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const box = page.getByLabel("Message");
    await expect(box).toBeVisible();
    await expect(box).toHaveValue("Done: Water the plants");
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(calls.chat).toBe(0);
  }
);

test("Notes loads once and is instant on the way back", async ({ page }) => {
  const calls = await signedIn(page);
  await openNotes(page);
  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByRole("tab", { name: "Notes" }).click();
  await expect(page.getByText("Water the plants")).toBeVisible();
  expect(calls.view).toBe(1);
});

test("Notes refreshes an expired sign-in and tries once more", async ({
  page,
}) => {
  const calls = await signedIn(page, { viewExpiredOnce: true });
  await openNotes(page);
  expect(calls.view).toBe(2);
});

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

test("a dropped connection after sending keeps the message out of the box", async ({
  page,
}, testInfo) => {
  await signedIn(page);
  const box = page.getByLabel("Message");
  await box.fill("drop: remember the milk");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByText("Jim may have saved this — check before sending again")
  ).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(
    page.getByRole("log").getByText("drop: remember the milk")
  ).toBeVisible();
  const putBack = page.getByRole("button", { name: "Put my message back" });
  await expect(putBack).toBeInViewport({ ratio: 1 });
  expect((await putBack.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);
  await box.blur();
  await page.screenshot({
    path: shotName(page, testInfo, "maybe-saved", "light"),
    animations: "disabled",
  });
  await putBack.click();
  await expect(box).toHaveValue("drop: remember the milk");
});
