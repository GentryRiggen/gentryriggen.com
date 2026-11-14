import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  BALLOT_FIXTURE,
  GRAPH_FIXTURE,
  MONEY_FIXTURE,
  TIMELINE_FIXTURE,
  VIEW_FIXTURE,
} from "../lib/jim/__tests__/fixtures";

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
  /** Short Home labels by todo order. */
  shorts?: Record<number, string>;
  /** More todos, open and done, added to the fixture's. */
  moreTodos?: { todos: unknown[]; doneTodos: unknown[] };
  /** Send the day's retro in the view payload. */
  retro?: boolean;
}

interface MockCalls {
  view: number;
  chat: number;
  health: number;
  money: number;
  /** Explore's reads: how many times each was asked for. */
  explore: { graph: number; timeline: number; ballot: number };
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
  /** Each /api/retro body, in order. */
  retro: unknown[];
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
/** Invented retro questions for the fixture's day, as the server sends them. */
const RETRO = {
  day: "2026-10-31",
  morning: {
    questions: [
      "What are you looking forward to today?",
      "What one thing would make today a win?",
      "How do you want to show up today?",
    ],
    answers: null,
  },
  evening: {
    questions: [
      "What went better today than you expected?",
      "What went well today?",
      "What would you change?",
    ],
    answers: null,
  },
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
    explore: { graph: 0, timeline: 0, ballot: 0 },
    todo: [],
    search: [],
    messages: [],
    push: [],
    reminderPatches: [],
    brief: 0,
    retro: [],
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
          ...(options.retro ? { retro: RETRO } : {}),
          todos: [
            ...VIEW_FIXTURE.todos
              .filter((t) => !done.has(t.order))
              .map((t) =>
                options.shorts?.[t.order]
                  ? { ...t, short: options.shorts[t.order] }
                  : t
              ),
            ...(options.moreTodos?.todos ?? []),
          ],
          // A checked-off line carries its done stamp, as the server writes it.
          doneTodos: VIEW_FIXTURE.todos
            .filter((t) => done.has(t.order))
            .map((t) => ({
              ...t,
              text: `${t.text} (done 2026-10-31)`,
              done: true,
              done_on: "2026-10-31",
            }))
            .concat(
              (options.moreTodos?.doneTodos ??
                []) as (typeof VIEW_FIXTURE.todos)[number][]
            ),
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
    if (url.pathname === "/api/retro") {
      calls.retro.push(route.request().postDataJSON());
      await reply(200, { ok: true, sha: "c0ffee1" });
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
    if (url.pathname === "/api/speak") {
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
    const explore = /^\/api\/(graph|timeline|ballot)$/.exec(url.pathname);
    if (explore) {
      const kind = explore[1] as keyof MockCalls["explore"];
      calls.explore[kind] += 1;
      await reply(
        200,
        kind === "graph"
          ? GRAPH_FIXTURE
          : kind === "timeline"
            ? TIMELINE_FIXTURE
            : BALLOT_FIXTURE
      );
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
      "https://jim.gentryriggen.com/jim"
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://jim.gentryriggen.com/jim"
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

  test("sends a message and shows the reply and saved files", async ({
    page,
  }) => {
    await signedIn(page);
    await send(page, "remember the milk", "Saved it.");
    await expect(page.getByText("remember the milk")).toBeVisible();
    await expect(page.getByText("Saved: lists/todos.md")).toBeVisible();
  });
});

for (const width of [320]) {
  test.describe(`Jim layout${width ? ` at ${width}px` : ""}`, () => {
    if (width) test.use({ viewport: { width, height: 568 } });

    for (const scheme of ["light"] as const) {
      test.describe(scheme, () => {
        test.use({ colorScheme: scheme });

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
      "the pages ported from the Mac fit the screen",
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
        const pills = page.getByRole("tablist", { name: "Notes pages" });

        // Work: meetings three ways, and the org chart.
        await pills.getByRole("tab", { name: "Work" }).click();
        await page.getByRole("tab", { name: "Next steps" }).click();
        await expect(page.getByText("Order the cedar boards")).toBeVisible();
        await expect(page.getByText("Yours")).toBeVisible();
        await shot("notes-work-steps");
        await page.getByRole("tab", { name: "Decisions" }).click();
        await expect(
          page.getByText("Spring beds go along the south fence")
        ).toBeVisible();
        await page.getByRole("tab", { name: "Org chart" }).click();
        const org = page.getByRole("list", { name: "Org chart" });
        await expect(org.getByText("Ava Torres")).toBeVisible();
        await shot("notes-work-org");

        // Health: Mindset, then a movement and a training day.
        await pills.getByRole("tab", { name: "Health" }).click();
        const health = page.getByRole("tablist", { name: "Health pages" });
        // Every label fits its tab at 320px with a few px to spare, so a
        // fallback font can't cut one off (text-sm fit "Training" by 0.8px).
        const tight = await health.getByRole("tab").evaluateAll((tabs) =>
          tabs
            .filter((t) => {
              const text = document.createRange();
              text.selectNodeContents(t);
              const cs = getComputedStyle(t);
              const room =
                t.clientWidth -
                parseFloat(cs.paddingLeft) -
                parseFloat(cs.paddingRight);
              return text.getBoundingClientRect().width + 4 > room;
            })
            .map((t) => t.textContent)
        );
        expect(tight).toEqual([]);
        await health.getByRole("tab", { name: "Mindset" }).click();
        await expect(page.getByText("“Listen before answering”")).toBeVisible();
        await shot("notes-mindset");
        await health.getByRole("tab", { name: "Training" }).click();
        await page.getByRole("link", { name: "Back squat" }).click();
        await expect(
          page.getByRole("heading", { name: "Back squat" })
        ).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(
          "/jim/notes/training/m/back-squat"
        );
        await expect(
          page.getByRole("img", { name: /done on 2 days in the past year/ })
        ).toBeVisible();
        await shot("notes-movement");
        await page
          .getByRole("region", { name: "Every entry" })
          .getByRole("link", { name: "Oct 15 2026" })
          .click();
        await expect(
          page.getByRole("heading", { name: "Thu, Oct 15 2026" })
        ).toBeVisible();
        await shot("notes-training-day");
        // A reload keeps the day.
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "Thu, Oct 15 2026" })
        ).toBeVisible();

        // People: the year ahead.
        await pills.getByRole("tab", { name: "People" }).click();
        await page
          .getByRole("tablist", { name: "People pages" })
          .getByRole("tab", { name: "Year" })
          .click();
        await expect(
          page.getByText("2 gift ideas, none chosen.")
        ).toBeVisible();
        await shot("notes-year");

        // Money: the grid scrolls inside its card only.
        await pills.getByRole("tab", { name: "Money" }).click();
        const grid = page.getByRole("region", { name: "By category" });
        await expect(grid.getByRole("table")).toBeVisible();
        await expect(
          page.getByRole("region", { name: "Amazon" }).getByText("Bought again")
        ).toBeVisible();
        await page
          .getByRole("region", { name: "Amazon" })
          .getByRole("button", { name: "Kitchen" })
          .click();
        await expect(page.getByText("Pruning shears")).toHaveCount(0);
        await grid.scrollIntoViewIfNeeded();
        await shot("notes-money-extras");

        // Explore: timeline, graph and ballot.
        await pills.getByRole("tab", { name: "Explore" }).click();
        await expect(
          page.getByText("Sketched the spring beds with the compost bins")
        ).toBeVisible();
        expect(
          await fontSize(page, "#jim-timeline-search")
        ).toBeGreaterThanOrEqual(16);
        await shot("notes-timeline");
        const explore = page.getByRole("tablist", { name: "Explore pages" });
        await explore.getByRole("tab", { name: "Graph" }).click();
        await expect(
          page.getByRole("img", { name: /Note graph: 4 notes and 3 links/ })
        ).toBeVisible();
        await page.getByRole("button", { name: "Zoom in" }).click();
        await shot("notes-graph");
        await page.getByLabel("Find a note in the graph").fill("shed");
        await page.getByRole("link", { name: /Potting shed/ }).click();
        expect(new URL(page.url()).pathname).toBe("/jim/notes/note/home/shed");
        await page.goBack();
        await explore.getByRole("tab", { name: "Ballot" }).click();
        await expect(
          page.getByRole("heading", { name: "Town ballot" })
        ).toBeVisible();
        await page.getByRole("tab", { name: "The guide" }).click();
        await expect(
          page.getByRole("heading", { name: "Town voting guide" })
        ).toBeVisible();
        await shot("notes-ballot");
      }
    );
  });
}

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

async function tapPin(page: Page, pin: string, submit?: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  if (submit) {
    await page.getByRole("button", { name: submit, exact: true }).click();
  }
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
  // Typed (the phone's number pad, or a keyboard), then Enter.
  const box = sheet.getByLabel("PIN", { exact: true });
  await box.pressSequentially("2468");
  await box.press("Enter");
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

  // The PIN's length is known, so the last digit unlocks: no OK.
  await page.getByLabel("PIN", { exact: true }).pressSequentially("1111");
  await expect(page.getByText("Wrong PIN. 9 attempts left.")).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveCount(0);
  await tapPin(page, "2468");
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(
    page.getByRole("log").getByText("remember the milk")
  ).toBeVisible();
});

/** Sets a 4-digit PIN from the menu (it locks Immediately when left). */
async function setPin(page: Page, pin: string) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "App lock: Off" }).click();
  const sheet = page.getByRole("dialog", { name: "App lock" });
  const box = sheet.getByLabel("PIN", { exact: true });
  await box.pressSequentially(pin);
  await box.press("Enter");
  await expect(sheet.getByText("Enter it again")).toBeVisible();
  await tapPin(page, pin, "Next");
  await sheet.getByRole("button", { name: "Turn on" }).click();
  await expect(sheet).toHaveCount(0);
}

test("a lock record deleted from the device still locks, with only Forgot PIN", async ({
  page,
}) => {
  await signedIn(page);
  await send(page, "remember the milk", "Saved it.");
  await setPin(page, "2468");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Enter PIN" })).toBeVisible();
  await tapPin(page, "2468");
  await expect(page.getByLabel("Message")).toBeVisible();

  // Someone with the unlocked browser deletes the lock record.
  const removed = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("jim:lock:")
    );
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  });
  expect(removed).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Jim is locked" })
  ).toBeVisible();
  await expect(page.getByLabel("PIN", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Message")).toHaveCount(0);
  await expect(page.getByText("remember the milk")).toHaveCount(0);
  await bigTargets(page);
  await noSidewaysScroll(page);
  await page.getByRole("button", { name: "Forgot PIN?" }).click();
  await page.getByRole("button", { name: "Sign out and wipe" }).click();
  await expect(page.getByText(/Sign in to set a new PIN/)).toBeVisible();
});

test("an open page left untouched for five minutes locks", async ({ page }) => {
  await page.clock.install();
  await signedIn(page);
  await setPin(page, "2468");
  await page.getByLabel("Message").click();
  await page.clock.fastForward("04:50");
  await expect(page.getByLabel("Message")).toBeVisible();
  // Typing counts as being there: the five minutes start over.
  await page.getByLabel("Message").press("a");
  await page.clock.fastForward("04:50");
  await expect(page.getByLabel("Message")).toBeVisible();
  await page.clock.fastForward("00:15");
  await expect(page.getByRole("heading", { name: "Enter PIN" })).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveCount(0);
  await tapPin(page, "2468");
  await expect(page.getByLabel("Message")).toHaveValue("a");
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
    "Pruning shears",
    "Twine roll",
    "Seed packets and bulbs",
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

test("Explore reads only on open and never rests on the device", async ({
  page,
}) => {
  const calls = await signedIn(page);
  await openNotes(page);
  expect(calls.explore).toEqual({ graph: 0, timeline: 0, ballot: 0 });
  const pills = page.getByRole("tablist", { name: "Notes pages" });
  await pills.getByRole("tab", { name: "Explore" }).click();
  await expect(page.getByText("Fixed the gate latch")).toBeVisible();
  const explore = page.getByRole("tablist", { name: "Explore pages" });
  await explore.getByRole("tab", { name: "Graph" }).click();
  await expect(page.getByRole("img", { name: /Note graph/ })).toBeVisible();
  await explore.getByRole("tab", { name: "Ballot" }).click();
  await expect(
    page.getByRole("heading", { name: "Town ballot" })
  ).toBeVisible();
  expect(calls.explore).toEqual({ graph: 1, timeline: 1, ballot: 1 });
  // Strings only the invented Explore reads carry.
  const values = [
    "Sketched the spring beds with the compost bins",
    "Potting shed",
    "Town voting guide",
    "Library board",
  ];
  await expect.poll(() => keptView(page)).not.toBeNull();
  const open = await everythingKept(page);
  for (const v of values) expect(open).not.toContain(v);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
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
});

/** Invented extra todos so the Todos charts have something to draw. */
function todoLine(
  order: number,
  text: string,
  due: string,
  area: string,
  project: string,
  doneOn = ""
) {
  return {
    text: doneOn ? `${text} (done ${doneOn})` : text,
    due,
    path: "lists/todos.md",
    area,
    project,
    done: doneOn !== "",
    done_on: doneOn,
    order,
  };
}

const MORE_TODOS = {
  todos: [
    todoLine(
      20,
      "Book the venue (due 2026-11-03)",
      "2026-11-03",
      "work",
      "onboarding"
    ),
    todoLine(
      21,
      "Order the welcome kits (due 2026-11-05)",
      "2026-11-05",
      "work",
      "onboarding"
    ),
    todoLine(
      22,
      "Fix the gate latch (due 2026-11-09)",
      "2026-11-09",
      "personal",
      "garden-map"
    ),
    todoLine(23, "Sketch the Q1 targets", "", "work", "quarterly-report"),
    todoLine(
      24,
      "Call the insurer about the roof (due 2026-10-27)",
      "2026-10-27",
      "personal",
      ""
    ),
  ],
  doneTodos: [
    todoLine(30, "Send the agenda", "", "work", "onboarding", "2026-10-30"),
    todoLine(31, "Pay the water bill", "", "personal", "", "2026-10-29"),
    todoLine(
      32,
      "Review the draft",
      "",
      "work",
      "quarterly-report",
      "2026-10-29"
    ),
    todoLine(
      33,
      "Clean the gutters",
      "",
      "personal",
      "garden-map",
      "2026-10-26"
    ),
    todoLine(34, "Reply to the vendor", "", "work", "", "2026-10-22"),
  ],
};

/** The titles in the open list, in order. */
async function todoTitles(page: Page): Promise<string[]> {
  return page
    .getByRole("region", { name: "Open todos" })
    .getByRole("checkbox")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
}

test.describe("Jim todos", () => {
  test(
    "opens from the nav, filters Work, a project and overdue, and keeps them on reload",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await signedIn(page, { moreTodos: MORE_TODOS });
      await page.getByRole("tab", { name: "Notes" }).click();
      await page.getByRole("tab", { name: "Todos" }).click();
      await expect(page).toHaveURL(/\/jim\/todos$/);
      await expect(page).toHaveTitle("Todos · Jim");
      await expect(page.getByText("12 todos", { exact: true })).toBeVisible();
      await page.screenshot({
        path: `${SHOTS}/todos-top-${testInfo.project.name}-${page.viewportSize()?.width}.png`,
      });
      await page.getByRole("radio", { name: "Work" }).click();
      await page
        .getByRole("group", { name: "Projects" })
        .getByRole("button", { name: /Quarterly report/ })
        .click();
      expect(await todoTitles(page)).toEqual([
        "Send the quarterly report",
        "Sketch the Q1 targets",
      ]);
      await page
        .getByRole("group", { name: "When" })
        .getByRole("button", { name: "Overdue" })
        .click();
      expect(await todoTitles(page)).toEqual(["Send the quarterly report"]);
      expect(new URL(page.url()).search).toBe(
        "?area=work&project=quarterly-report&when=overdue"
      );
      await page.reload();
      await expect(page.getByText("1 todo", { exact: true })).toBeVisible();
      expect(await todoTitles(page)).toEqual(["Send the quarterly report"]);
      await page.getByRole("button", { name: "Clear", exact: true }).click();
      const search = page.getByRole("searchbox", { name: "Search todos" });
      await search.fill("DENTIST");
      expect(await todoTitles(page)).toEqual(["Book the dentist"]);
      expect(await fontSize(page, "input[type=search]")).toBeGreaterThanOrEqual(
        16
      );
      await search.fill("");
      // A chart column filters too.
      await page.getByRole("button", { name: "Late: 3 todos" }).click();
      expect(await todoTitles(page)).toHaveLength(3);
      await noSidewaysScroll(page);
      // The other columns dim once their fade ends.
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${SHOTS}/todos-${testInfo.project.name}-${page.viewportSize()?.width}.png`,
        fullPage: true,
      });
    }
  );
});

test.describe("Jim's old address", () => {
  const NEW_ORIGIN = "https://jim.gentryriggen.com";
  const OWNER_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";

  /** The CSP firebase.json gives the main site's /jim/** addresses. */
  function stubCsp(): string {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "firebase.json"), "utf8")
    ) as {
      hosting: {
        target: string;
        headers: {
          source: string;
          headers: { key: string; value: string }[];
        }[];
      }[];
    };
    const main = config.hosting.find((site) => site.target === "main")!;
    const header = main.headers
      .filter((rule) => rule.source === "/jim/**")
      .flatMap((rule) => rule.headers)
      .find((h) => h.key === "Content-Security-Policy");
    return header!.value;
  }

  test("wipes Jim's data and moves to the new address", async ({
    page,
    baseURL,
  }) => {
    // A same-origin page with no Jim on it, to seed and inspect storage.
    await page.route("**/e2e-seed", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>seed</p>" })
    );
    // Hosting rewrites every old /jim address to the moved page (the e2e
    // server still serves Jim there), with the stub's own CSP.
    await page.route("**/jim/notes*", async (route) => {
      const response = await route.fetch({ url: `${baseURL}/jim-moved.html` });
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy": stubCsp(),
        },
      });
    });
    let arrived = "";
    await page.route(`${NEW_ORIGIN}/**`, (route) => {
      arrived = route.request().url();
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>New address</h1>",
      });
    });

    await page.goto("/e2e-seed");
    await page.evaluate(async (uid) => {
      const done = (req: IDBRequest | IDBTransaction) =>
        new Promise((resolve, reject) => {
          if ("oncomplete" in req && !("result" in req)) {
            req.oncomplete = resolve;
          } else {
            (req as IDBRequest).onsuccess = resolve;
          }
          req.onerror = reject;
        });
      localStorage.setItem("jim:chat:u", "[]");
      localStorage.setItem("theme", "dark");
      sessionStorage.setItem("jim:draft:u", "half");

      const jimOpen = indexedDB.open("jim", 1);
      jimOpen.onupgradeneeded = () => jimOpen.result.createObjectStore("kv");
      await done(jimOpen);
      jimOpen.result.close();

      const authOpen = indexedDB.open("firebaseLocalStorageDb", 1);
      authOpen.onupgradeneeded = () =>
        authOpen.result.createObjectStore("firebaseLocalStorage", {
          keyPath: "fbase_key",
        });
      await done(authOpen);
      const tx = authOpen.result.transaction(
        "firebaseLocalStorage",
        "readwrite"
      );
      const store = tx.objectStore("firebaseLocalStorage");
      store.put({ fbase_key: "owner", value: { uid } });
      store.put({ fbase_key: "player", value: { uid: "anon-player-1" } });
      await done(tx);
      authOpen.result.close();

      await (
        await caches.open("jim-shell-v1")
      ).put("/jim", new Response("old shell"));
      await (
        await caches.open("ship-builder-v3")
      ).put("/ship-builder", new Response("game"));
    }, OWNER_UID);
    const canRegister = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      // Jim's real worker, under a scope that ends in /jim like the old
      // one's but stays off this test's pages so it can't answer them.
      const reg = await navigator.serviceWorker.register("/jim-sw.js", {
        scope: "/e2e-old/jim",
      });
      const worker = reg.installing ?? reg.waiting ?? reg.active;
      // Let its install finish, so its cache can't land after the wipe.
      await new Promise<void>((resolve) => {
        if (!worker || worker.state === "activated") return resolve();
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated" || worker.state === "redundant")
            resolve();
        });
      });
      return true;
    });

    await page.goto("/jim/notes?a=1");
    await expect
      .poll(() => arrived, { timeout: 10_000 })
      .toBe(`${NEW_ORIGIN}/jim/notes?a=1`);
    await expect(
      page.getByRole("heading", { name: "New address" })
    ).toBeVisible();

    await page.goto("/e2e-seed");
    const left = await page.evaluate(async () => {
      const authOpen = indexedDB.open("firebaseLocalStorageDb");
      await new Promise((resolve) => (authOpen.onsuccess = resolve));
      const records = await new Promise<{ fbase_key: string }[]>((resolve) => {
        const all = authOpen.result
          .transaction("firebaseLocalStorage")
          .objectStore("firebaseLocalStorage")
          .getAll();
        all.onsuccess = () => resolve(all.result);
      });
      authOpen.result.close();
      const databases = indexedDB.databases
        ? (await indexedDB.databases()).map((db) => db.name)
        : null;
      const registrations = navigator.serviceWorker
        ? (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope)
        : [];
      return {
        local: Object.keys(localStorage).sort(),
        session: Object.keys(sessionStorage),
        auth: records.map((r) => r.fbase_key),
        databases,
        caches: (await caches.keys()).sort(),
        registrations,
      };
    });
    expect(left.local).toEqual(["theme"]);
    expect(left.session).toEqual([]);
    expect(left.auth).toEqual(["player"]);
    if (left.databases) expect(left.databases).not.toContain("jim");
    expect(left.caches).toEqual(["ship-builder-v3"]);
    if (canRegister) {
      expect(left.registrations.some((s) => s.endsWith("/jim"))).toBe(false);
    }
  });
});

test.describe("Sign-in & security", () => {
  /** Invented values for the stand-in authenticator setup. */
  const TWO_STEP = {
    enrolled: false,
    password: "invented-password",
    secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    code: "246810",
  };

  /** Signed in with the stand-in setup; every request off this host and API is listed. */
  async function openSecurity(page: Page, width: number) {
    // Size first: emulated iPhone WebKit keeps its layout viewport from load.
    await page.setViewportSize({ width, height: 800 });
    const outside: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname !== "localhost" && !req.url().startsWith(API)) {
        outside.push(url.origin);
      }
    });
    await page.addInitScript(
      ({ api, twoStep }) => {
        window.__JIM_TEST__ = { signedIn: true, api, twoStep };
      },
      { api: API, twoStep: TWO_STEP }
    );
    const calls = await mockServer(page);
    const revokes: number[] = [];
    let revokeStatus = 204;
    await page.route(`${API}/api/auth/revoke`, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fallback();
        return;
      }
      revokes.push(revokeStatus);
      await route.fulfill({
        status: revokeStatus,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body:
          revokeStatus === 204
            ? ""
            : JSON.stringify({
                error: "Couldn't sign out everywhere. Try again in a minute.",
              }),
      });
    });
    await page.goto("/jim");
    await expect(page.getByLabel("Message")).toBeVisible();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Sign-in & security" }).click();
    const sheet = page.getByRole("dialog", { name: "Sign-in & security" });
    await expect(sheet).toBeVisible();
    return {
      sheet,
      calls,
      outside,
      revokes,
      setRevokeStatus: (s: number) => {
        revokeStatus = s;
      },
    };
  }

  for (const width of [393]) {
    test(`turns two-step on, drawn on the device, at ${width}px`, async ({
      page,
    }, testInfo) => {
      const { sheet, outside } = await openSecurity(page, width);
      await expect(sheet.getByText("Two-step sign-in is off.")).toBeVisible();
      await sheet.getByRole("button", { name: "Turn on" }).click();

      const password = sheet.getByLabel("Confirm your password");
      await expect(password).toBeFocused();
      await password.fill("not-it");
      await sheet.getByRole("button", { name: "Continue" }).click();
      await expect(sheet.getByText("That password didn't work.")).toBeVisible();
      await password.fill(TWO_STEP.password);
      await sheet.getByRole("button", { name: "Continue" }).click();

      const link = sheet.getByRole("link", { name: "Add to Passwords" });
      await expect(link).toHaveAttribute("href", /^otpauth:\/\/totp\//);
      await expect(
        sheet.getByText("ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567")
      ).toBeVisible();
      const qr = sheet.getByRole("img", { name: /QR code/ });
      await expect(qr).toBeVisible();
      expect(await qr.evaluate((el) => el.tagName.toLowerCase())).toBe("svg");
      expect(await qr.boundingBox()).toMatchObject({ width: 176 });

      const code = sheet.getByLabel("6-digit code");
      expect(
        await code.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      ).toBeGreaterThanOrEqual(16);
      await noSidewaysScroll(page);
      await bigTargets(page);
      await page.screenshot({
        path: `${SHOTS}/security-setup-${testInfo.project.name}-${width}.png`,
        animations: "disabled",
      });

      await code.fill("111111");
      await sheet.getByRole("button", { name: "Turn on" }).click();
      await expect(
        sheet.getByText("That code didn't work. Try the newest one.")
      ).toBeVisible();
      await code.fill(TWO_STEP.code);
      await sheet.getByRole("button", { name: "Turn on" }).click();
      await expect(
        sheet.getByText(
          "Two-step sign-in is on. Jim asks for a code only when you sign in on a new device."
        )
      ).toBeVisible();
      // The setup key is gone from the page once enrolled.
      expect(await page.content()).not.toContain(TWO_STEP.secret);
      expect(await page.content()).not.toContain("ABCD EFGH");
      await page.screenshot({
        path: `${SHOTS}/security-done-${testInfo.project.name}-${width}.png`,
        animations: "disabled",
      });
      // Nothing in the sheet came from anywhere else (no QR service).
      expect(outside).toEqual([]);
    });
  }

  test("test_sign_out_everywhere_wipes: the server first, then this device", async ({
    page,
  }) => {
    const { sheet, revokes } = await openSecurity(page, 393);
    await sheet.getByRole("button", { name: "Sign out everywhere" }).click();
    await expect(
      sheet.getByText("This signs out every device, this one too.")
    ).toBeVisible();
    await bigTargets(page);
    expect(revokes).toEqual([]);
    await sheet
      .getByRole("button", { name: "Yes, sign out everywhere" })
      .click();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByText("You're signed out on every device.")
    ).toBeVisible();
    expect(revokes).toEqual([204]);
    await expect(page.getByLabel("Message")).toHaveCount(0);
  });
});
