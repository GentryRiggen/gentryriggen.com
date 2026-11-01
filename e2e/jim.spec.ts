import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { MONEY_FIXTURE, VIEW_FIXTURE } from "../lib/jim/__tests__/fixtures";

/**
 * /jim is a private chat that is used mostly on an iPhone. Runs on Chromium
 * (desktop), the `iphone` project (WebKit, touch) and the WebKit smoke set.
 * The server URL is mocked through the e2e-only `__JIM_TEST__` hook (the
 * Notes data is an invented fixture), and the screenshots in
 * test-results/jim/ are for a human to look at.
 */

// Calendar times are UTC in the payload and shown in local time.
test.use({ timezoneId: "America/Denver" });

/** The desktop layout's breakpoint (Tailwind's lg), as JimChat uses it. */
const DESKTOP_MIN = 1024;

/**
 * The phone layout's tests run below the desktop breakpoint on the desktop
 * browsers too (their default 1280px window is a desktop now); the iPhone
 * keeps its own screen. The desktop layout has its own tests, at 1440.
 */
test.use({
  viewport: async ({}, provide, testInfo) => {
    const own = testInfo.project.use.viewport ?? { width: 1280, height: 720 };
    await provide(
      own.width >= DESKTOP_MIN ? { width: 820, height: own.height } : own
    );
  },
});

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
  /** How /api/todo answers (200 by default). */
  todoStatus?: number;
}

interface MockCalls {
  view: number;
  chat: number;
  health: number;
  money: number;
  /** Each /api/todo body, in order. */
  todo: {
    order: number;
    text: string;
    area: string;
    project: string;
    done: boolean;
  }[];
  /** Each /api/search query, in order. */
  search: string[];
  /** Each /api/chat message, in order. */
  messages: string[];
  /** Each /api/push call ("POST /api/push/subscribe"), in order. */
  push: string[];
  /** Each reminder PATCH body, in order. */
  reminderPatches: unknown[];
  /** How many times the morning brief script was asked for. */
  brief: number;
}

const REMINDER_ID = "0123456789ab";
const MEETING_ID = "0123456789abcdef";
const REFLECTION_QUESTION = "What went well today?";
const PUSH_SETTINGS = {
  kinds: [
    { id: "morning", label: "Morning brief", on: true },
    { id: "reminders", label: "Reminders", on: true },
    { id: "evening", label: "Evening wrap", on: true },
  ],
  eveningTime: "21:00",
  lessonTime: "12:00",
};
/** An invented reminder, as the server sends one. */
const REMINDER = {
  id: REMINDER_ID,
  at: "2026-10-31T15:30:00-06:00",
  text: "Call the plumber about the kitchen tap",
  created: "2026-10-31T09:00:00-06:00",
  sent: null,
  rev: 0,
  when: "Today 3:30 PM",
};
/** An invented meeting card for the view payload. */
const MEETING_CARD = {
  id: MEETING_ID,
  subject: "Team standup",
  start: "2026-10-31T16:00:00Z",
  end: "2026-10-31T16:30:00Z",
  where: "Room 4",
  attendees: [
    {
      name: "Ava Torres",
      role: "Analyst",
      path: "people/ava-torres.md",
      last: "2026-10-20: agreed to send the draft",
      todos: ["Send the draft"],
    },
  ],
};

/** Invented search hits and the one note behind them. */
const SEARCH_RESULTS = [
  {
    path: "home/garden.md",
    title: "Garden",
    snippet: "…water the plants on Saturdays, more in a dry week…",
  },
  {
    path: "people/sam-okafor.md",
    title: "Sam Okafor",
    snippet: "Works on the data team.",
  },
  {
    path: "work/a-project-with-a-really-long-file-name-that-has-to-wrap.md",
    title: "A project with a really long title that has to wrap somewhere",
    snippet: "Mentions the plants once.",
  },
];

const GARDEN_NOTE = {
  path: "home/garden.md",
  title: "Garden",
  updated: "2026-10-12",
  body: [
    "## Beds",
    "- Tomatoes along the **south** fence",
    "- Water the plants on Saturdays (see [the list](../lists/todos.md))",
    "",
    "## Supplies",
    "| Item | Where | Bought | Notes |",
    "| --- | --- | --- | --- |",
    "| Hose | Garage, left wall | 2026-04-02 | Fifty feet, the green one |",
    "| Seeds | Kitchen drawer | 2026-03-15 | Heirloom, keep dry |",
    "",
    "More at https://example.com/a/very/long/link/about/gardening/that/should/wrap",
  ].join("\n"),
};

async function mockServer(
  page: Page,
  options: MockOptions = {}
): Promise<MockCalls> {
  const calls: MockCalls = {
    view: 0,
    chat: 0,
    health: 0,
    money: 0,
    todo: [],
    search: [],
    messages: [],
    push: [],
    reminderPatches: [],
    brief: 0,
  };
  /** Todos checked off on the "server": the next view leaves them out. */
  const done = new Set<number>();
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "POST, GET, PUT, PATCH, DELETE, OPTIONS",
  };
  await page.route(`${API}/**`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (route.request().url().endsWith("/api/health")) {
      calls.health += 1;
      await route.fulfill({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      });
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
        body: JSON.stringify({
          ...VIEW_FIXTURE,
          reflection: { question: REFLECTION_QUESTION },
          meetingCards: { [MEETING_ID]: MEETING_CARD },
          todos: VIEW_FIXTURE.todos.filter((t) => !done.has(t.order)),
          // A checked-off line carries its done stamp, as the server writes it.
          doneTodos: VIEW_FIXTURE.todos
            .filter((t) => done.has(t.order))
            .map((t) => ({
              ...t,
              text: `${t.text} (done 2026-10-31)`,
              done: true,
              done_on: "2026-10-31",
            })),
        }),
      });
      return;
    }
    const url = new URL(route.request().url());
    const reply = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    if (url.pathname === "/api/todo") {
      const body = route.request().postDataJSON() as MockCalls["todo"][0];
      calls.todo.push(body);
      const status = options.todoStatus ?? 200;
      if (status === 409) {
        await reply(409, { error: "That todo changed. Pull to refresh." });
      } else if (status !== 200) {
        await reply(status, { error: "busy" });
      } else {
        if (body.done) done.add(body.order);
        else done.delete(body.order);
        await reply(200, { ok: true, commit: "c0ffee1234", sha: "c0ffee1" });
      }
      return;
    }
    if (url.pathname === "/api/push/settings") {
      await reply(200, PUSH_SETTINGS);
      return;
    }
    if (url.pathname === "/api/reminders") {
      await reply(200, { reminders: [REMINDER] });
      return;
    }
    if (url.pathname === `/api/reminders/${REMINDER_ID}`) {
      if (route.request().method() === "PATCH") {
        calls.reminderPatches.push(route.request().postDataJSON());
        await reply(200, { ...REMINDER, when: "Today 3:40 PM", rev: 1 });
      } else {
        await reply(200, REMINDER);
      }
      return;
    }
    if (url.pathname === "/api/brief/script") {
      calls.brief += 1;
      await reply(200, {
        day: "2026-10-31",
        text: "Good morning. You have one meeting today and two things due.",
      });
      return;
    }
    if (url.pathname === "/api/speech") {
      // No voice here: the player falls back or waits for a tap.
      await reply(503, { error: "no voice in tests" });
      return;
    }
    if (url.pathname.startsWith("/api/push/")) {
      calls.push.push(`${route.request().method()} ${url.pathname}`);
      if (url.pathname === "/api/push/key") {
        await reply(200, { publicKey: "AQID_w" });
      } else {
        await route.fulfill({ status: 204, headers: cors });
      }
      return;
    }
    if (url.pathname === "/api/search") {
      const { q } = route.request().postDataJSON() as { q: string };
      calls.search.push(q);
      await reply(200, { results: q === "zzz" ? [] : SEARCH_RESULTS });
      return;
    }
    if (url.pathname === "/api/note") {
      const { path } = route.request().postDataJSON() as { path: string };
      if (path === GARDEN_NOTE.path) await reply(200, GARDEN_NOTE);
      else await reply(404, { error: "not found" });
      return;
    }
    if (url.pathname === "/api/money") {
      calls.money += 1;
      await reply(200, MONEY_FIXTURE);
      return;
    }
    calls.chat += 1;
    const { text } = route.request().postDataJSON() as { text: string };
    calls.messages.push(text);
    if (text.startsWith("drop: ")) {
      await route.abort("connectionreset");
      return;
    }
    if (text.startsWith("slow: ")) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const result = {
      reply: text.includes("remember") ? "Saved it." : LONG_REPLY,
      changed: text.includes("remember") ? ["lists/todos.md"] : [],
      commit: null,
    };
    // The page asks for a stream; the whole stream arrives at once here (a
    // real streaming server is in the "streams" test below).
    const wantsStream =
      route.request().headers()["accept"] === "application/x-ndjson";
    if (!wantsStream) {
      await route.fulfill({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      return;
    }
    const events: object[] = [
      { t: "step", text: "Searching notes" },
      { t: "ping" },
      { t: "reply", text: result.reply },
    ];
    // "cut: " ends the stream before done, as a dropped signal would.
    if (!text.startsWith("cut: ")) {
      if (result.changed.length) events.push({ t: "saving" });
      events.push({ t: "done", ...result });
    }
    await route.fulfill({
      status: 200,
      headers: { ...cors, "Content-Type": "application/x-ndjson" },
      body: events.map((e) => `${JSON.stringify(e)}\n`).join(""),
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
    ).toHaveAttribute("href", "/jim-icons/glow-pal-180.png");
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
      "the keyboard leaves only the header, the chat and the box",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        await signedIn(page);
        const root = page.locator(".jim-app");
        await send(page, "what's on my list?", /^Here's what/);
        await expect(root).toHaveAttribute("data-keyboard", "closed");

        // The header is one slim row, with the switch and the menu in it.
        const header = page.getByRole("banner");
        expect((await header.boundingBox())?.height).toBeLessThanOrEqual(49);
        await expect(header.getByRole("tab", { name: "Chat" })).toHaveAttribute(
          "aria-selected",
          "true"
        );
        await bigTargets(page);
        await noSidewaysScroll(page);

        // The menu holds Sign out and fits the screen.
        await page.getByRole("button", { name: "Menu" }).click();
        const signOut = page.getByRole("menuitem", { name: "Sign out" });
        await expect(signOut).toBeInViewport({ ratio: 1 });
        await bigTargets(page);
        await noSidewaysScroll(page);
        await page.screenshot({
          path: shotName(page, testInfo, "menu", "ayu"),
          animations: "disabled",
        });
        await page.keyboard.press("Escape");
        await expect(signOut).toHaveCount(0);

        // Simulate the iOS keyboard as a home-screen app sees it: the whole
        // window (innerHeight too) shrinks while the box has focus.
        const box = page.getByLabel("Message");
        await box.focus();
        const full = page.viewportSize() ?? { width: 0, height: 0 };
        const above = full.height - Math.round(full.height * 0.5);
        await page.setViewportSize({ width: full.width, height: above });
        await expect(root).toHaveAttribute("data-keyboard", "open");
        await expect(box).toBeFocused();
        await expect(box).toBeInViewport({ ratio: 1 });
        await expect(header).toBeInViewport({ ratio: 1 });
        // Nothing between the box and the keyboard: the composer ends at the
        // bottom edge, with only its own 8px under the box.
        const form = page.locator("form").filter({ has: box });
        await expect
          .poll(async () => {
            const r = await form.boundingBox();
            return r ? Math.round(r.y + r.height) : -1;
          })
          .toBe(above);
        const boxBottom = await box.evaluate(
          (el) => el.getBoundingClientRect().bottom
        );
        expect(above - boxBottom).toBeLessThanOrEqual(9);
        // The end of the latest reply stays in view above the box.
        await expect(
          page.getByRole("log").getByText(/that\/should\/wrap/)
        ).toBeInViewport();
        await noSidewaysScroll(page);
        await page.screenshot({
          path: shotName(page, testInfo, "chat-keyboard", "ayu"),
          animations: "disabled",
        });

        // Keyboard down again: the full height is back.
        await page.setViewportSize(full);
        await box.blur();
        await expect(root).toHaveAttribute("data-keyboard", "closed");
        await expect(box).toBeInViewport({ ratio: 1 });
        await page.screenshot({
          path: shotName(page, testInfo, "chat-keyboard-down", "ayu"),
          animations: "disabled",
        });
      }
    );

    test(
      "Home's Today card, boxes, quick log, search and a note fit the screen",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        // Before the standup, so the Today card has its next meeting.
        await page.clock.setFixedTime(new Date("2026-10-31T15:00:00Z"));
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
        const today = page.getByRole("region", { name: "Today" });
        await expect(today.getByText("Team standup")).toBeVisible();
        await expect(today.getByText("3 days ago")).toBeVisible();
        expect(
          await fontSize(page, "#jim-notes-search")
        ).toBeGreaterThanOrEqual(16);
        await shot("notes-home-today");

        // Tick a box: the toast sits above the home bar, on screen.
        await page
          .getByRole("checkbox", { name: "Renew the car registration" })
          .click();
        const undo = page.getByRole("button", { name: "Undo" });
        await expect(undo).toBeInViewport({ ratio: 1 });
        await shot("notes-home-toast");

        await page.getByRole("button", { name: "Add todo" }).click();
        const sheet = page.getByRole("dialog", { name: "Add todo" });
        await expect(sheet).toBeInViewport({ ratio: 1 });
        await sheet.getByLabel("Todo").fill("Call the vet about the dog");
        for (const id of await sheet.locator("input").all()) {
          if ((await id.getAttribute("type")) === "radio") continue;
          expect(
            await id.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
          ).toBeGreaterThanOrEqual(16);
        }
        await sheet.getByLabel("Todo").blur();
        await shot("notes-quicklog");
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);

        await page.getByLabel("Search notes").fill("plants");
        await expect(page.getByRole("link", { name: /Garden/ })).toBeVisible();
        await page.getByLabel("Search notes").blur();
        await shot("notes-search");

        await page.getByRole("link", { name: /Garden/ }).click();
        await expect(
          page.getByRole("heading", { name: "Garden" })
        ).toBeVisible();
        await expect(page.locator("table")).toBeVisible();
        await shot("notes-note");
        await page.getByRole("link", { name: "Results" }).click();
        await page.getByRole("button", { name: "Clear search" }).click();
        await expect(page.getByText("Water the plants")).toBeVisible();
      }
    );

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
        // The switch sits in the header and the tabs are thumb-sized.
        const notesTab = page.getByRole("banner").getByRole("tab", {
          name: "Notes",
        });
        expect((await notesTab.boundingBox())?.height).toBeGreaterThanOrEqual(
          44
        );
        await expect(notesTab).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("navigation")).toHaveCount(0);
        await shot("notes-home");
        // Each page pill, once selected, sits well inside the screen.
        const pills = page.getByRole("tablist", { name: "Notes pages" });
        for (const name of ["People", "Health", "Money", "Work", "Home"]) {
          const tab = pills.getByRole("tab", { name });
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

        await pills.getByRole("tab", { name: "Health" }).click();
        await expect(page.getByText("Hemoglobin")).toBeVisible();
        // A new page opens at its top, not where the last one was scrolled.
        await expect(
          page.getByRole("button", { name: "Refresh" })
        ).toBeInViewport();
        await shot("notes-health");

        const healthPages = page.getByRole("tablist", { name: "Health pages" });
        await healthPages.getByRole("tab", { name: "Training" }).click();
        await expect(page.getByText("Back squat")).toBeVisible();
        // A new page opens at its top, not where the last one was scrolled.
        await expect(
          page.getByRole("button", { name: "Refresh" })
        ).toBeInViewport();
        await shot("notes-training");

        await healthPages.getByRole("tab", { name: "Golf" }).click();
        await expect(page.getByText("Cedar Ridge").first()).toBeVisible();
        await shot("notes-golf");

        await pills.getByRole("tab", { name: "People" }).click();
        const search = page.getByLabel("Search people");
        await expect(search).toBeVisible();
        expect(
          await fontSize(page, "#jim-people-search")
        ).toBeGreaterThanOrEqual(16);
        await shot("notes-people");

        await page.getByRole("link", { name: /Sam Okafor/ }).click();
        await expect(
          page.getByRole("heading", { name: "Sam Okafor" })
        ).toBeVisible();
        // A wide table scrolls inside itself, never the page.
        await expect(page.locator("table")).toBeVisible();
        await shot("notes-person-table");

        await page.getByRole("link", { name: "People" }).click();
        await page.getByRole("link", { name: /Wren Rivera/ }).click();
        await expect(page.getByText("Jun 16, 1990")).toBeVisible();
        await shot("notes-person");

        await pills.getByRole("tab", { name: "Work" }).click();
        await expect(page.getByRole("region", { name: "Team" })).toBeVisible();
        for (const id of ["#jim-meetings-search", "#jim-directory-search"]) {
          expect(await fontSize(page, id)).toBeGreaterThanOrEqual(16);
        }
        await shot("notes-work");
        await page
          .getByRole("region", { name: "Wins per week" })
          .scrollIntoViewIfNeeded();
        await shot("notes-work-wins");
        const dir = page.getByRole("region", { name: "Directory" });
        await dir.getByLabel("Search the directory").fill("ava");
        await dir.getByLabel("Search the directory").scrollIntoViewIfNeeded();
        await shot("notes-work-directory");
        await dir.getByRole("link", { name: /Ava Torres/ }).click();
        await expect(
          page.getByRole("heading", { name: "Ava Torres" })
        ).toBeVisible();
        await shot("notes-directory-card");
        await page
          .getByRole("navigation", { name: "Reports to" })
          .getByRole("link", { name: "Quinn Hale" })
          .click();
        await expect(page.getByText("Direct and careful")).toBeVisible();
        await shot("notes-directory-manager");
        await page
          .getByRole("region", { name: "Direct reports" })
          .scrollIntoViewIfNeeded();
        await shot("notes-directory-reports");

        await pills.getByRole("tab", { name: "Money" }).click();
        await expect(page.getByText("Good months")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Refresh" })
        ).toBeInViewport();
        await shot("notes-money");
        await page
          .getByRole("region", { name: "Net per month" })
          .scrollIntoViewIfNeeded();
        await shot("notes-money-net");
        await page
          .getByRole("group", { name: "Months" })
          .getByRole("button", { name: "Aug" })
          .click();
        const aug = page.getByRole("region", { name: "Aug detail" });
        await expect(aug.getByText("Green Acres")).toBeVisible();
        await page
          .getByRole("group", { name: "Months" })
          .scrollIntoViewIfNeeded();
        await shot("notes-money-month");
        await page
          .getByRole("region", { name: "Check-in" })
          .scrollIntoViewIfNeeded();
        await shot("notes-money-checkin");
        await page
          .getByRole("region", { name: "Watch" })
          .scrollIntoViewIfNeeded();
        await shot("notes-money-cash");
      }
    );
  });
}

test(
  "a Notes todo box checks it off, offers Undo, and the list refreshes",
  { tag: "@smoke" },
  async ({ page }) => {
    const calls = await signedIn(page);
    await openNotes(page);
    const box = page.getByRole("checkbox", { name: "Water the plants" });
    expect((await box.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await box.click();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await expect(undo).toBeInViewport({ ratio: 1 });
    expect(calls.todo).toEqual([
      {
        order: 3,
        text: "Water the plants (due 2026-10-31; every 1 week, Saturdays)",
        area: "personal",
        project: "",
        done: true,
      },
    ]);
    // The background refetch drops it from the list.
    await expect(page.getByText("Water the plants")).toHaveCount(0);
    expect(calls.view).toBeGreaterThanOrEqual(2);
    await undo.click();
    await expect(page.getByText("Water the plants")).toBeVisible();
    // Undo sends the line as it is now, done stamp included.
    expect(calls.todo[1]).toEqual({
      order: 3,
      text: "Water the plants (due 2026-10-31; every 1 week, Saturdays) (done 2026-10-31)",
      area: "personal",
      project: "",
      done: false,
    });
    expect(calls.chat).toBe(0);
  }
);

test("a todo that changed on the Mac reverts and says so", async ({ page }) => {
  await signedIn(page, { todoStatus: 409 });
  await openNotes(page);
  const box = page.getByRole("checkbox", { name: "Water the plants" });
  await box.click();
  await expect(
    page.getByText("That todo changed. Pull to refresh.")
  ).toBeVisible();
  await expect(box).toHaveAttribute("aria-checked", "false");
});

test(
  "a quick log sends a plain sentence and Chat shows Jim's reply",
  { tag: "@smoke" },
  async ({ page }) => {
    const calls = await signedIn(page);
    await openNotes(page);
    await page.getByRole("button", { name: "Log injection" }).click();
    const sheet = page.getByRole("dialog", { name: "Log injection" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Dose")).toBeFocused();
    await sheet.getByLabel("Dose").fill("1 ml");
    await sheet.getByLabel("Site").fill("right arm");
    await sheet.getByRole("button", { name: "Send to Jim" }).click();
    await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const log = page.getByRole("log");
    await expect(
      log.getByText("Log my injection today: 1 ml, right arm.")
    ).toBeVisible();
    await expect(log.getByText(/^Here's what/)).toBeVisible();
    expect(calls.messages).toEqual([
      "Log my injection today: 1 ml, right arm.",
    ]);
  }
);

test("Notes loads once and is instant on the way back", async ({ page }) => {
  const calls = await signedIn(page);
  // Signing in wakes the server and fetches Notes before it is opened.
  await expect.poll(() => calls.health).toBe(1);
  await expect.poll(() => calls.view).toBe(1);
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

test("a stream cut off before it finishes says check before resending", async ({
  page,
}) => {
  const calls = await signedIn(page);
  const box = page.getByLabel("Message");
  await box.fill("cut: remember the milk");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByText("Jim may have saved this — check before sending again")
  ).toBeVisible();
  await expect(page.getByRole("log").getByText("Saved it.")).toBeVisible();
  await expect(box).toHaveValue("");
  expect(calls.chat).toBe(1);
});

test("the chat survives a reload and New chat clears it", async ({ page }) => {
  await signedIn(page);
  await send(page, "remember the milk", "Saved it.");
  await page.reload();
  const log = page.getByRole("log");
  await expect(log.getByText("remember the milk")).toBeVisible();
  await expect(log.getByText("Saved it.")).toBeVisible();
  await expect(page.getByText("Saved: lists/todos.md")).toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "New chat" }).click();
  await expect(log.getByText("remember the milk")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(log.getByText("remember the milk")).toHaveCount(0);
});

async function tapPin(page: Page, pin: string, submit: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: submit, exact: true }).click();
}

test("an app lock PIN locks the chat on reload until it is entered", async ({
  page,
}) => {
  await signedIn(page);
  await send(page, "remember the milk", "Saved it.");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "App lock: Off" }).click();
  const sheet = page.getByRole("dialog", { name: "App lock" });
  await expect(sheet.getByText("Choose a PIN (4 to 8 digits)")).toBeVisible();
  await tapPin(page, "2468", "Next");
  await expect(sheet.getByText("Enter it again")).toBeVisible();
  await tapPin(page, "2468", "Next");
  await expect(sheet.getByRole("radio", { name: /Immediately/ })).toBeChecked();
  await sheet.getByRole("button", { name: "Turn on" }).click();
  await expect(sheet).toHaveCount(0);
  // Turning it on doesn't lock right away.
  await expect(page.getByLabel("Message")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Enter PIN" })).toBeVisible();
  // Nothing of the chat is in the page while locked.
  await expect(page.getByLabel("Message")).toHaveCount(0);
  await expect(page.getByText("remember the milk")).toHaveCount(0);
  await bigTargets(page);
  await noSidewaysScroll(page);

  await tapPin(page, "1111", "OK");
  await expect(page.getByText("Wrong PIN. 9 attempts left.")).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveCount(0);
  await tapPin(page, "2468", "OK");
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(
    page.getByRole("log").getByText("remember the milk")
  ).toBeVisible();
});

/**
 * A real streaming server on localhost (Playwright's route can only answer
 * all at once): each step of the turn waits for the test to let it go on.
 */
async function streamingServer() {
  const gates: (() => void)[] = [];
  const waiting: ((go: () => void) => void)[] = [];
  /** Resolves when the server reaches its next pause. */
  const paused = () =>
    new Promise<() => void>((resolve) => {
      const go = gates.shift();
      if (go) resolve(go);
      else waiting.push(resolve);
    });
  const pause = () =>
    new Promise<void>((resolve) => {
      const next = waiting.shift();
      if (next) next(resolve);
      else gates.push(resolve);
    });
  let chats = 0;
  let lastResponse: ServerResponse | null = null;
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept"
    );
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (req.url !== "/api/chat") {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "busy" }));
      return;
    }
    chats += 1;
    lastResponse = res;
    const send = (event: object) => res.write(`${JSON.stringify(event)}\n`);
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    send({ t: "step", text: "Searching notes" });
    await pause();
    send({
      t: "delta",
      text: "Here's what is on the list:\n\n- **Renew** the",
    });
    send({ t: "delta", text: " registration (due Friday)\n- Call about" });
    await pause();
    send({ t: "reply", text: LONG_REPLY });
    send({ t: "saving" });
    await pause();
    send({
      t: "done",
      reply: LONG_REPLY,
      changed: ["lists/todos.md"],
      commit: "abc",
    });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    paused,
    chats: () => chats,
    /** Drops the connection mid-stream, like losing signal. */
    drop: () => lastResponse?.socket?.destroy(),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test(
  "streams the steps and the reply as Jim writes it",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const server = await streamingServer();
    try {
      await page.addInitScript((api) => {
        window.__JIM_TEST__ = { signedIn: true, api };
      }, server.url);
      await page.goto("/jim");
      const box = page.getByLabel("Message");
      await box.fill("remember to renew the registration");
      await page.getByRole("button", { name: "Send" }).click();

      let go = await server.paused();
      await expect(page.getByText("Jim is thinking…")).toBeVisible();
      await expect(page.getByText("Searching notes…")).toBeVisible();
      await box.blur();
      await page.screenshot({
        path: shotName(page, testInfo, "stream-step", "ayu"),
        animations: "disabled",
      });

      go();
      go = await server.paused();
      await expect(page.getByRole("log").getByText("Call about")).toBeVisible();
      await expect(page.getByText("Jim is thinking…")).toHaveCount(0);
      await noSidewaysScroll(page);
      await page.screenshot({
        path: shotName(page, testInfo, "stream-text", "ayu"),
        animations: "disabled",
      });

      go();
      go = await server.paused();
      await expect(page.getByText("Saving…")).toBeVisible();
      await expect(
        page.getByRole("log").getByText(/that\/should\/wrap/)
      ).toBeVisible();
      await page.screenshot({
        path: shotName(page, testInfo, "stream-saving", "ayu"),
        animations: "disabled",
      });

      go();
      await expect(page.getByText("Saved: lists/todos.md")).toBeVisible();
      await expect(page.getByText("Saving…")).toHaveCount(0);
      expect(server.chats()).toBe(1);
    } finally {
      await server.close();
    }
  }
);

test(
  "losing signal mid-stream keeps the message and never sends it twice",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const server = await streamingServer();
    try {
      await page.addInitScript((api) => {
        window.__JIM_TEST__ = { signedIn: true, api };
      }, server.url);
      await page.goto("/jim");
      const box = page.getByLabel("Message");
      await box.fill("remember to renew the registration");
      await page.getByRole("button", { name: "Send" }).click();
      await server.paused();
      await expect(page.getByText("Searching notes…")).toBeVisible();
      server.drop();
      await expect(
        page.getByText("Jim may have saved this — check before sending again")
      ).toBeVisible();
      await expect(box).toHaveValue("");
      await expect(
        page.getByRole("log").getByText("remember to renew the registration")
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Put my message back" })
      ).toBeVisible();
      await box.blur();
      await page.screenshot({
        path: shotName(page, testInfo, "stream-dropped", "ayu"),
        animations: "disabled",
      });
      // A reload doesn't bring it back as unsent either.
      await page.reload();
      await expect(
        page.getByRole("log").getByText("remember to renew the registration")
      ).toBeVisible();
      await expect(
        page.getByText("Jim may have saved this — check before sending again")
      ).toBeVisible();
      await expect(page.getByLabel("Message")).toHaveValue("");
      expect(server.chats()).toBe(1);
    } finally {
      await server.close();
    }
  }
);

/** The Notes payload kept in IndexedDB for this uid, or null. */
async function keptView(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("jim", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("kv");
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          const get = db
            .transaction("kv", "readonly")
            .objectStore("kv")
            .getAll();
          get.onsuccess = () => {
            db.close();
            resolve(get.result.length ? get.result[0] : null);
          };
          get.onerror = () => resolve(null);
        };
      })
  );
}

test(
  "opens Notes from the device and holds Send without signal",
  { tag: "@smoke" },
  async ({ page, context }, testInfo) => {
    await signedIn(page);
    // The early fetch keeps the payload on the device.
    await expect.poll(() => keptView(page)).not.toBeNull();

    // Back later with no way to reach Jim.
    await page.route(`${API}/**`, (route) =>
      route.abort("internetdisconnected")
    );
    await page.reload();
    await expect(page.getByLabel("Message")).toBeVisible();
    await context.setOffline(true);
    try {
      await expect(page.getByText("You're offline")).toBeVisible();
      const box = page.getByLabel("Message");
      await box.fill("remember the milk");
      await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
      await expect(box).toHaveValue("remember the milk");

      await page.getByRole("tab", { name: "Notes" }).click();
      await expect(page.getByText("Water the plants")).toBeVisible();
      await expect(page.getByText(/^Offline · as of /)).toBeVisible();
      await noSidewaysScroll(page);
      await page.screenshot({
        path: shotName(page, testInfo, "notes-offline", "ayu"),
        animations: "disabled",
      });
      await page.setViewportSize({ width: 320, height: 568 });
      await noSidewaysScroll(page);
      await page.screenshot({
        path: shotName(page, testInfo, "notes-offline", "ayu"),
        animations: "disabled",
      });

      // Signal back: Send works again and the text is still there.
      await context.setOffline(false);
      await page.getByRole("tab", { name: "Chat" }).click();
      await expect(page.getByText("You're offline")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
      await expect(page.getByLabel("Message")).toHaveValue("remember the milk");
    } finally {
      await context.setOffline(false);
    }
  }
);

test(
  "Notifications in the menu, and its Home Screen hint on an iPhone",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "iphone",
      "the hint is for iOS in a browser tab"
    );
    // Size the page before it loads. Emulated iPhone WebKit keeps its layout
    // viewport at the device's 659px when a loaded page is made taller, so
    // nothing fixed below 659px can be tapped (shrinking is fine).
    const sizes = [
      { width: 393, height: 852 },
      { width: 320, height: 568 },
    ];
    await page.setViewportSize(sizes[0]);
    const calls = await signedIn(page);
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.getByRole("button", { name: "Menu" }).click();
      const item = page.getByRole("menuitem", { name: "Notifications" });
      await expect(item).toBeInViewport({ ratio: 1 });
      await bigTargets(page);
      await noSidewaysScroll(page);
      await page.screenshot({
        path: shotName(page, testInfo, "menu-briefing", "ayu"),
        animations: "disabled",
      });
      await item.click();
      const sheet = page.getByRole("dialog", { name: "Notifications" });
      await expect(sheet).toContainText("Add Jim to your Home Screen first");
      await bigTargets(page);
      await noSidewaysScroll(page);
      await page.getByRole("switch").click();
      const hint = page.getByRole("alertdialog");
      await expect(hint).toContainText(
        "Add Jim to your Home Screen first (Share → Add to Home Screen), then turn this on there."
      );
      await bigTargets(page);
      await noSidewaysScroll(page);
      await page.screenshot({
        path: shotName(page, testInfo, "briefing-hint", "ayu"),
        animations: "disabled",
      });
      await page.getByRole("button", { name: "OK" }).click();
      await expect(hint).toHaveCount(0);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toHaveCount(0);
    }
    expect(calls.push).toEqual([]);
  }
);

test("turns the morning briefing on, and sign-out turns it off and wipes the device", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "stands in for the push service on Chromium"
  );
  // A stand-in service worker registration and push service.
  await page.addInitScript(() => {
    let sub: PushSubscription | null = null;
    const make = () =>
      ({
        endpoint: "https://push.example.test/device",
        options: {
          applicationServerKey: new Uint8Array([1, 2, 3, 255]).buffer,
        },
        toJSON: () => ({
          endpoint: "https://push.example.test/device",
          keys: { p256dh: "p", auth: "a" },
        }),
        unsubscribe: async () => {
          sub = null;
          return true;
        },
      }) as unknown as PushSubscription;
    const registration = {
      pushManager: {
        getSubscription: async () => sub,
        subscribe: async () => (sub = make()),
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => registration,
        ready: Promise.resolve(registration),
        register: async () => registration,
      },
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: async () => "granted" },
    });
    Object.defineProperty(window, "__pushOn", {
      configurable: true,
      get: () => sub !== null,
    });
  });
  const calls = await signedIn(page);
  await expect.poll(() => keptView(page)).not.toBeNull();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Notifications" }).click();
  const master = page.getByRole("switch", {
    name: "Notifications on this device",
  });
  await master.click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Notifications are on. A test notification is on its way."
  );
  expect(calls.push).toEqual([
    "GET /api/push/key",
    "POST /api/push/subscribe",
    "POST /api/push/test",
  ]);
  await page.getByRole("button", { name: "OK" }).click();
  await expect(master).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Menu" }).click();

  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect.poll(() => calls.push.length).toBe(4);
  expect(calls.push[3]).toBe("DELETE /api/push/subscribe");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __pushOn: boolean }).__pushOn)
    )
    .toBe(false);
  await expect.poll(() => keptView(page)).toBeNull();
});

/** Every string kept on this device: web storage and every IndexedDB
 * database, each store read in full. */
async function everythingKept(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: string[] = [
      JSON.stringify({ ...localStorage }),
      JSON.stringify({ ...sessionStorage }),
    ];
    const dbs =
      typeof indexedDB.databases === "function"
        ? await indexedDB.databases()
        : [{ name: "jim" }];
    for (const { name } of dbs) {
      if (!name) continue;
      out.push(
        await new Promise<string>((resolve) => {
          const open = indexedDB.open(name);
          open.onerror = () => resolve("");
          open.onsuccess = () => {
            const db = open.result;
            const stores = [...db.objectStoreNames];
            if (!stores.length) {
              db.close();
              resolve("");
              return;
            }
            const tx = db.transaction(stores, "readonly");
            const parts: unknown[] = [];
            for (const store of stores) {
              const all = tx.objectStore(store).getAll();
              all.onsuccess = () => parts.push(all.result);
            }
            tx.oncomplete = () => {
              db.close();
              resolve(JSON.stringify(parts));
            };
            tx.onerror = () => {
              db.close();
              resolve("");
            };
          };
        })
      );
    }
    return out.join("\n");
  });
}

test("money never rests on the device, open or after sign-out", async ({
  page,
}) => {
  const calls = await signedIn(page);
  await openNotes(page);
  expect(calls.money).toBe(0);
  await page
    .getByRole("tablist", { name: "Notes pages" })
    .getByRole("tab", { name: "Money" })
    .click();
  await expect(page.getByText("Hill Hardware")).toBeVisible();
  expect(calls.money).toBe(1);
  // Strings only the invented money summary carries.
  const values = [
    "Hill Hardware",
    "Green Acres",
    "Page Turners",
    "Spare jar used",
    "Seed order",
    "Greenhouse repair",
    "Pause new tools",
    "Invented rule for tests",
  ];
  // The Notes payload is kept by now (it's what the offline store holds).
  await expect.poll(() => keptView(page)).not.toBeNull();
  const open = await everythingKept(page);
  for (const v of values) expect(open).not.toContain(v);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText("Hill Hardware")).toHaveCount(0);
  const after = await everythingKept(page);
  for (const v of values) expect(after).not.toContain(v);
});

/** Every app address serves the one page; a reload keeps the place. */
test.describe("Jim routes", () => {
  test(
    "a deep link reloads to the same profile, and Back returns to the list",
    { tag: "@smoke" },
    async ({ page }) => {
      // Counts page loads, and any same-origin 404 (Next fetching data for
      // an address it doesn't know would show up here).
      await page.addInitScript(() => {
        const n = Number(sessionStorage.getItem("jim-loads") ?? "0");
        sessionStorage.setItem("jim-loads", String(n + 1));
      });
      const missing: string[] = [];
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (
          url.origin === new URL(page.url()).origin &&
          response.status() === 404
        )
          missing.push(url.pathname);
      });
      const loads = () =>
        page.evaluate(() => Number(sessionStorage.getItem("jim-loads")));
      await signedIn(page);
      await page.goto("/jim/notes/people/sam-okafor");
      const heading = page.getByRole("heading", { name: "Sam Okafor" });
      await expect(heading).toBeVisible();
      await expect(page).toHaveTitle("Sam Okafor · Jim");
      // Hydrating at a deep address doesn't bounce or reload the page.
      await page.waitForTimeout(1000);
      expect(await loads()).toBe(2);
      expect(new URL(page.url()).pathname).toBe("/jim/notes/people/sam-okafor");
      // Next's router must not 404, bounce or hard-reload the page here.
      await page.evaluate(() => {
        (window as { __stillHere?: boolean }).__stillHere = true;
      });
      await page.reload();
      await expect(heading).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/jim/notes/people/sam-okafor");

      // Opened from its address: Back (the link) goes up to the list.
      await page.getByRole("link", { name: "People" }).click();
      await expect(page.getByLabel("Search people")).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/jim/notes/people");
      await page.evaluate(() => {
        (window as { __stillHere?: boolean }).__stillHere = true;
      });

      // List → profile → browser Back: the list, at the same spot.
      const scroller = page.locator("[data-notes-scroller]");
      // Instant: the site's smooth scrolling would still be on its way.
      await scroller.evaluate((el) =>
        el.scrollTo({ top: 120, behavior: "instant" })
      );
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollTop))
        .toBe(120);
      const top = 120;
      // The scroll event (which records the spot) lands on the next frame.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)))
      );
      await page.getByRole("link", { name: /Wren Rivera/ }).click();
      await expect(
        page.getByRole("heading", { name: "Wren Rivera" })
      ).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(
        "/jim/notes/people/wren-rivera"
      );
      await page.goBack();
      await expect(page.getByLabel("Search people")).toBeVisible();
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollTop))
        .toBe(top);
      await page.goForward();
      await expect(
        page.getByRole("heading", { name: "Wren Rivera" })
      ).toBeVisible();
      // All of it in the one page: no reload since.
      expect(
        await page.evaluate(
          () => (window as { __stillHere?: boolean }).__stillHere
        )
      ).toBe(true);
      expect(await loads()).toBe(3);
      expect(missing).toEqual([]);
    }
  );

  test(
    "Chat and Notes have addresses, and an unknown one says so",
    { tag: "@smoke" },
    async ({ page }) => {
      await signedIn(page);
      await openNotes(page);
      expect(new URL(page.url()).pathname).toBe("/jim/notes");
      await page.getByRole("tab", { name: "Chat" }).click();
      expect(new URL(page.url()).pathname).toBe("/jim/chat");
      await page.goBack();
      await expect(page.getByText("Water the plants")).toBeVisible();
      await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute(
        "aria-selected",
        "true"
      );

      await page.goto("/jim/notes/nothing-here");
      await expect(
        page.getByText("Nothing lives at this address")
      ).toBeVisible();
      await page.getByRole("link", { name: "Go to Notes home" }).click();
      await expect(page.getByText("Water the plants")).toBeVisible();

      // A search never reaches the address.
      await page.getByLabel("Search notes").fill("plants");
      await page.getByRole("link", { name: /Garden/ }).click();
      await expect(page.getByRole("heading", { name: "Garden" })).toBeVisible();
      expect(page.url()).not.toContain("plants");
      expect(new URL(page.url()).pathname).toBe("/jim/notes/note/home/garden");
    }
  );
});

/** Shots for a human: the desktop layout at 1440×900. */
const DESKTOP_SHOTS = `${SHOTS}/desktop`;

test.describe("Jim desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test(
    "sidebar, page and docked chat; the chat sends from the dock",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "iphone", "a desktop layout");
      await page.clock.setFixedTime(new Date("2026-10-31T15:00:00Z"));
      await signedIn(page);
      const shot = async (name: string) => {
        await noSidewaysScroll(page);
        await page.screenshot({
          path: `${DESKTOP_SHOTS}/${name}-${testInfo.project.name}.png`,
          animations: "disabled",
        });
      };
      const nav = page.getByRole("navigation", { name: "Jim" });
      await expect(nav).toBeVisible();
      await expect(page.getByRole("tab", { name: "Notes" })).toHaveCount(0);
      await send(page, "what's on my list?", /^Here's what/);
      await shot("chat");

      await nav.getByRole("link", { name: "Home" }).click();
      await expect(page.getByText("Water the plants")).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/jim/notes");
      const dock = page.getByRole("complementary", { name: "Chat with Jim" });
      // Sidebar, page and chat side by side, all on screen.
      const sidebar = await nav.boundingBox();
      const center = await page.locator("#jim-notes-page").boundingBox();
      const chat = await dock.boundingBox();
      expect(sidebar && center && chat).toBeTruthy();
      if (sidebar && center && chat) {
        expect(sidebar.x).toBeLessThan(center.x);
        expect(center.x + center.width).toBeLessThanOrEqual(chat.x);
        expect(chat.x + chat.width).toBeLessThanOrEqual(1440);
        expect(chat.width).toBeGreaterThanOrEqual(360);
      }
      // The day and the todos side by side.
      const today = await page
        .getByRole("region", { name: "Today" })
        .boundingBox();
      const todo = await page
        .getByRole("checkbox", { name: "Renew the car registration" })
        .boundingBox();
      expect(today && todo && todo.x > today.x + today.width - 1).toBe(true);
      await expect(dock.getByText("Saved: lists/todos.md")).toHaveCount(0);
      await shot("notes-home");

      // The one conversation, sent from the dock, without leaving the page.
      await dock.getByLabel("Message").fill("remember the milk");
      await dock.getByLabel("Message").press("Enter");
      await expect(dock.getByText("Saved it.")).toBeVisible();
      await expect(dock.getByText("what's on my list?")).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/jim/notes");

      await nav.getByRole("link", { name: "People" }).click();
      await expect(nav.getByRole("link", { name: "People" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      await page.getByRole("link", { name: /Sam Okafor/ }).click();
      await expect(
        page.getByRole("heading", { name: "Sam Okafor" })
      ).toBeVisible();
      await expect(page).toHaveTitle("Sam Okafor · Jim");
      await shot("person");
      // Esc steps back out of a profile.
      await page.keyboard.press("Escape");
      await expect(page.getByLabel("Search people")).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/jim/notes/people");

      await nav.getByRole("link", { name: "Training" }).click();
      await expect(page.getByText("Back squat")).toBeVisible();
      await expect(page).toHaveTitle("Training · Jim");
      await shot("training");

      await nav.getByRole("link", { name: "Health" }).click();
      await expect(page.getByText("Hemoglobin")).toBeVisible();
      await shot("health");

      // ⌘K (Ctrl+K) finds the search; the query stays out of the address.
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByLabel("Search notes")).toBeFocused();
      await page.keyboard.type("plants");
      await expect(page.getByRole("link", { name: /Garden/ })).toBeVisible();
      expect(page.url()).not.toContain("plants");
      await shot("search");
    }
  );
});

/** An iPad turning, or Split View: the layout changes, nothing is lost. */
test(
  "crossing the desktop breakpoint keeps the chat, Notes and what's typed",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "iphone", "resizes a desktop window");
    await page.setViewportSize({ width: 820, height: 720 });
    await signedIn(page);
    await send(page, "what's on my list?", /^Here's what/);
    await openNotes(page);
    // Marks on the live elements: a remount would lose them.
    await page.evaluate(() => {
      const mark = (el: Element | null) => {
        if (el) (el as Element & { __kept?: boolean }).__kept = true;
      };
      mark(document.querySelector(".jim-app"));
      mark(document.querySelector("[data-notes-scroller]"));
      mark(document.querySelector("#jim-message"));
    });
    const kept = () =>
      page.evaluate(() =>
        [".jim-app", "[data-notes-scroller]", "#jim-message"].map(
          (sel) =>
            (
              document.querySelector(sel) as
                (Element & { __kept?: boolean }) | null
            )?.__kept === true
        )
      );
    await page.getByRole("button", { name: "Add todo" }).click();
    const sheet = page.getByRole("dialog", { name: "Add todo" });
    await sheet.getByLabel("Todo").fill("Call the vet about the dog");
    const scroller = page.locator("[data-notes-scroller]");
    const vh = () =>
      page
        .locator(".jim-app")
        .evaluate((el) =>
          (el as HTMLElement).style.getPropertyValue("--jim-vh")
        );

    for (const size of [
      { width: 1280, height: 700 },
      { width: 820, height: 680 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator(".jim-app")).toHaveAttribute(
        "data-layout",
        size.width >= 1024 ? "wide" : "phone"
      );
      // The viewport hook still writes to the one root.
      await expect.poll(vh).toBe(`${size.height}px`);
      expect(await kept()).toEqual([true, true, true]);
      await expect(sheet.getByLabel("Todo")).toHaveValue(
        "Call the vet about the dog"
      );
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    // Notes keeps its place (Home is long in both layouts)...
    await page.setViewportSize({ width: 820, height: 400 });
    await scroller.evaluate((el) =>
      el.scrollTo({ top: 120, behavior: "instant" })
    );
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(120);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)))
    );
    // The same scroller, not reset to the top (the browser keeps its
    // place as the page reflows; the pixel offset differs per layout).
    for (const [width, layout] of [
      [1280, "wide"],
      [820, "phone"],
    ] as const) {
      await page.setViewportSize({ width, height: 400 });
      await expect(page.locator(".jim-app")).toHaveAttribute(
        "data-layout",
        layout
      );
      expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    }

    // ...and its page and search.
    await page
      .getByRole("tablist", { name: "Notes pages" })
      .getByRole("tab", { name: "People" })
      .click();
    await page.getByLabel("Search people").fill("a");
    await page.setViewportSize({ width: 1280, height: 600 });
    await expect(page.getByLabel("Search people")).toHaveValue("a");
    await page.setViewportSize({ width: 820, height: 600 });
    await expect(page.getByLabel("Search people")).toHaveValue("a");
    // And the conversation is the same one.
    await page.getByRole("tab", { name: "Chat" }).click();
    await expect(
      page.getByRole("log").getByText("what's on my list?")
    ).toBeVisible();
  }
);

test.describe("Jim pings", () => {
  test("a reminder opens from its address and snoozes", async ({ page }) => {
    const calls = await signedIn(page);
    await page.goto(`/jim/reminders/${REMINDER_ID}`);
    await expect(
      page.getByRole("heading", { name: REMINDER.text })
    ).toBeVisible();
    await page.getByRole("button", { name: "Snooze 10 min" }).click();
    await expect.poll(() => calls.reminderPatches).toEqual([{ snooze: "10m" }]);
    await expect(page.getByText("Today 3:40 PM")).toBeVisible();
  });

  test("?listen=brief fetches the brief and plays it or leaves a chip", async ({
    page,
  }) => {
    await page.addInitScript((api) => {
      window.__JIM_TEST__ = { signedIn: true, api };
    }, API);
    const calls = await mockServer(page);
    await page.goto("/jim?listen=brief");
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect.poll(() => calls.brief).toBe(1);
    await expect(
      page
        .getByRole("region", { name: "Now playing" })
        .or(page.getByRole("button", { name: "Play your morning" }))
    ).toBeVisible();
    // The way in leaves no trace in the address.
    expect(new URL(page.url()).search).toBe("");
  });

  test("?reflect=1 shows tonight's question and sends the answer with it", async ({
    page,
  }) => {
    await page.addInitScript((api) => {
      window.__JIM_TEST__ = { signedIn: true, api };
    }, API);
    const calls = await mockServer(page);
    await page.goto("/jim/chat?reflect=1");
    await expect(page.getByText(REFLECTION_QUESTION)).toBeVisible();
    const box = page.getByPlaceholder("Your answer…");
    await box.fill("Finished the draft");
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => calls.messages.length).toBe(1);
    expect(calls.messages[0].startsWith("Evening reflection.")).toBe(true);
    expect(calls.messages[0]).toContain(`Q: ${REFLECTION_QUESTION}`);
    expect(calls.messages[0]).toContain("A: Finished the draft");
    await expect(page.getByPlaceholder("Message Jim")).toBeVisible();
  });

  for (const width of [393, 320]) {
    test(`reminders, a meeting card and Notifications fit a ${width}px phone`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      // A stand-in push service with this device already subscribed.
      await page.addInitScript(() => {
        const sub = {
          endpoint: "https://push.example.test/device",
          unsubscribe: async () => true,
        };
        const registration = {
          pushManager: { getSubscription: async () => sub },
        };
        Object.defineProperty(navigator, "serviceWorker", {
          configurable: true,
          value: {
            getRegistration: async () => registration,
            ready: Promise.resolve(registration),
            register: async () => registration,
          },
        });
        Object.defineProperty(window, "PushManager", {
          configurable: true,
          value: function PushManager() {},
        });
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: { requestPermission: async () => "granted" },
        });
      });
      await signedIn(page);
      const shot = (name: string) =>
        page.screenshot({
          path: `${SHOTS}/${name}-${testInfo.project.name}-${width}.png`,
          animations: "disabled",
        });

      await page.goto("/jim/reminders");
      await expect(
        page.getByRole("link", { name: REMINDER.text })
      ).toBeVisible();
      await noSidewaysScroll(page);
      await bigTargets(page);
      await shot("reminders");

      await page.goto(`/jim/reminders/${REMINDER_ID}`);
      await expect(
        page.getByRole("heading", { name: REMINDER.text })
      ).toBeVisible();
      await noSidewaysScroll(page);
      await bigTargets(page);

      await page.goto(`/jim/meeting/${MEETING_ID}`);
      await expect(
        page.getByRole("heading", { name: "Team standup" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Ava Torres" })
      ).toBeVisible();
      await noSidewaysScroll(page);
      await bigTargets(page);
      await shot("meeting-card");

      await page.goto("/jim");
      await expect(page.getByLabel("Message")).toBeVisible();
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("menuitem", { name: "Notifications" }).click();
      if (testInfo.project.name === "iphone") {
        // In a Safari tab push can't be on: the sheet shows the hint.
        await expect(
          page.getByText("Add Jim to your Home Screen")
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("switch", { name: "Evening wrap" })
        ).toBeVisible();
        await expect(page.getByText("Quiet 10 PM–6:30 AM")).toBeVisible();
      }
      await noSidewaysScroll(page);
      await bigTargets(page);
      await shot("notifications");
    });
  }
});
