import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import { historyKey, loadHistory, saveHistory } from "@/lib/jim/history";
import JimChat from "../JimChat";

jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, streamToJim: jest.fn() };
});
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: ({
    active,
    onLog,
    onDraft,
    routing,
  }: {
    active: boolean;
    onLog: (text: string) => void;
    onDraft: (text: string) => void;
    routing?: { route: { kind: string; page?: string; slug?: string } };
  }) => (
    <div
      data-testid="notes"
      data-active={String(active)}
      data-route={
        routing
          ? [routing.route.kind, routing.route.page ?? routing.route.slug]
              .filter(Boolean)
              .join(":")
          : ""
      }
    >
      <button type="button" onClick={() => onLog("Log my workout today: Ran.")}>
        Fake log
      </button>
      <button type="button" onClick={() => onDraft("Help me with: A reply")}>
        Fake draft
      </button>
    </div>
  ),
}));

const send = jest.mocked(api.streamToJim);
const getToken = jest.fn().mockResolvedValue("t");
const UID = "uid-1";

function renderChat() {
  return render(
    <JimChat
      uid={UID}
      api="https://jim.example.test"
      getToken={getToken}
      onSignOut={jest.fn()}
    />
  );
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  send.mockReset();
  window.localStorage.clear();
  // Each test opens /jim, as the app does.
  window.history.replaceState(null, "", "/jim");
});

/** matchMedia that answers true for the desktop width (and nothing else). */
function desktopMedia() {
  return jest.fn().mockImplementation((query: string) => ({
    matches: query.includes("min-width: 1024px"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

it("shows the message, then Jim's reply and the files it saved", async () => {
  const reply = deferred<api.JimReply>();
  send.mockReturnValue(reply.promise);
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "what's on my list?");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(screen.getByText("what's on my list?")).toBeInTheDocument();
  expect(box).toHaveValue("");
  expect(screen.getByText(/Jim is thinking/)).toBeInTheDocument();
  const [text, session, token, onEvent, fetchFn, url] = send.mock.calls[0];
  expect(session).toMatch(/^[0-9a-f-]{36}$/);
  expect(text).toBe("what's on my list?");
  expect(token).toBe(getToken);
  expect(onEvent).toEqual(expect.any(Function));
  expect(fetchFn).toBeUndefined();
  expect(url).toBe("https://jim.example.test");

  await act(async () =>
    reply.resolve({
      reply: "You have **two** things.",
      changed: ["lists/todos.md"],
      commit: "abc",
    })
  );
  expect(screen.getByText("two").tagName).toBe("STRONG");
  expect(screen.getByText("Saved: lists/todos.md")).toBeInTheDocument();
  expect(screen.queryByText(/Jim is thinking/)).not.toBeInTheDocument();
});

it("keeps one session id for the whole page load", async () => {
  send.mockResolvedValue({ reply: "ok", changed: [], commit: null });
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "one");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("ok");
  await userEvent.type(box, "two");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(send.mock.calls[1][1]).toBe(send.mock.calls[0][1]);
  expect(screen.queryByText(/^Saved:/)).not.toBeInTheDocument();
});

it("shows the waking banner and puts the draft back", async () => {
  send.mockRejectedValue(new api.JimError("waking"));
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "remember this");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(
    await screen.findByText("Jim is waking up, one moment")
  ).toBeInTheDocument();
  expect(box).toHaveValue("remember this");
  expect(
    within(screen.getByRole("log")).queryByText("remember this")
  ).not.toBeInTheDocument();
});

it("says it couldn't reach Jim on a server error", async () => {
  send.mockRejectedValue(new api.JimError("server"));
  renderChat();
  await userEvent.type(screen.getByLabelText("Message"), "hi");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Couldn't reach Jim")).toBeInTheDocument();
});

it("sends with Enter on desktop and makes a new line with Shift+Enter", async () => {
  send.mockResolvedValue({ reply: "ok", changed: [], commit: null });
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "a{Shift>}{Enter}{/Shift}b");
  expect(box).toHaveValue("a\nb");
  expect(send).not.toHaveBeenCalled();
  await userEvent.type(box, "{Enter}");
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toBe("a\nb");
});

it("makes a new line with Return on a phone", async () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes("coarse"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  try {
    renderChat();
    const box = screen.getByLabelText("Message");
    await userEvent.type(box, "a{Enter}b");
    expect(box).toHaveValue("a\nb");
    expect(send).not.toHaveBeenCalled();
  } finally {
    window.matchMedia = original;
  }
});

it("does not send an empty message", async () => {
  renderChat();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Message"), "   {Enter}");
  expect(send).not.toHaveBeenCalled();
});

it("ignores the Enter that commits an IME composition in Safari", async () => {
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "ni");
  fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });
  expect(send).not.toHaveBeenCalled();
});

it("keeps the box focused after tapping Send, so the keyboard stays up", async () => {
  send.mockResolvedValue({ reply: "ok", changed: [], commit: null });
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "hi");
  box.blur();
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(box).toHaveFocus();
});

it("keeps the message and warns when Jim may have saved it", async () => {
  send.mockRejectedValue(new api.JimError("uncertain"));
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "remember the milk");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(
    await screen.findByText(
      "Jim may have saved this — check before sending again"
    )
  ).toBeInTheDocument();
  // Not put back automatically, so one tap can't save it twice.
  expect(box).toHaveValue("");
  expect(
    within(screen.getByRole("log")).getByText("remember the milk")
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: "Put my message back" })
  );
  expect(box).toHaveValue("remember the milk");
  expect(
    screen.queryByRole("button", { name: "Put my message back" })
  ).not.toBeInTheDocument();
});

it("still puts the draft back when the server was busy (503)", async () => {
  send.mockRejectedValue(new api.JimError("waking"));
  renderChat();
  const box = screen.getByLabelText("Message");
  await userEvent.type(box, "hi");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Jim is waking up, one moment");
  expect(box).toHaveValue("hi");
  expect(
    screen.queryByRole("button", { name: "Put my message back" })
  ).not.toBeInTheDocument();
});

it("says it is still working after 20 seconds", async () => {
  jest.useFakeTimers();
  try {
    send.mockReturnValue(new Promise(() => {}));
    renderChat();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "big question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Jim is thinking…")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(19_000));
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1_500));
    expect(screen.getByText("Still working…")).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

describe("tabs", () => {
  it("opens on Chat and switches to Notes and back", async () => {
    renderChat();
    const chatTab = screen.getByRole("tab", { name: "Chat" });
    const notesTab = screen.getByRole("tab", { name: "Notes" });
    expect(chatTab).toHaveAttribute("aria-selected", "true");
    // Notes isn't built (or fetched) until it is first opened.
    expect(screen.queryByTestId("notes")).not.toBeInTheDocument();
    await userEvent.click(notesTab);
    expect(notesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("notes")).toHaveAttribute("data-active", "true");
    await userEvent.click(chatTab);
    // Kept mounted, so its data and scroll survive the switch.
    expect(screen.getByTestId("notes")).toHaveAttribute("data-active", "false");
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("drops the keyboard when Notes opens", async () => {
    renderChat();
    const box = screen.getByLabelText("Message");
    box.focus();
    // On iOS a tap on a button doesn't move focus, so click without it.
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(box).not.toHaveFocus();
  });

  it("keeps the conversation across a trip to Notes", async () => {
    send.mockResolvedValue({ reply: "ok", changed: [], commit: null });
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});

describe("routes", () => {
  it("gives Chat and Notes their own addresses, with Back between them", async () => {
    renderChat();
    expect(document.title).toBe("Chat · Jim");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(window.location.pathname).toBe("/jim/notes");
    expect(screen.getByTestId("notes")).toHaveAttribute(
      "data-route",
      "page:home"
    );
    await userEvent.click(screen.getByRole("tab", { name: "Chat" }));
    expect(window.location.pathname).toBe("/jim/chat");
    // Browser Back returns to Notes.
    act(() => window.history.back());
    await screen.findByText(
      (_, el) => el?.getAttribute("data-active") === "true"
    );
    expect(window.location.pathname).toBe("/jim/notes");
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("opens straight on the Notes page in the address", () => {
    window.history.replaceState(null, "", "/jim/notes/people/sam-okafor");
    renderChat();
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("notes")).toHaveAttribute(
      "data-route",
      "person:sam-okafor"
    );
  });

  it("names the tab just Jim while locked, and forgets the address on sign-out", async () => {
    window.history.replaceState(null, "", "/jim/notes/people/sam-okafor");
    const onSignOut = jest.fn();
    const lock = {
      locked: true,
      enabled: true,
    } as unknown as React.ComponentProps<typeof JimChat>["lock"];
    const { rerender } = render(
      <JimChat
        uid={UID}
        api="https://jim.example.test"
        getToken={getToken}
        onSignOut={onSignOut}
        lock={lock}
      />
    );
    expect(document.title).toBe("Jim");
    expect(screen.queryByTestId("notes")).not.toBeInTheDocument();
    rerender(
      <JimChat
        uid={UID}
        api="https://jim.example.test"
        getToken={getToken}
        onSignOut={onSignOut}
      />
    );
    // Unlocked: straight to the address it opened on.
    expect(screen.getByTestId("notes")).toHaveAttribute(
      "data-route",
      "person:sam-okafor"
    );
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
    expect(window.location.pathname).toBe("/jim");
  });
});

describe("desktop", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = desktopMedia();
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("has a sidebar, the page, and the chat docked beside it", async () => {
    window.history.replaceState(null, "", "/jim/notes");
    renderChat();
    const nav = screen.getByRole("navigation", { name: "Jim" });
    const home = within(nav).getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("aria-current", "page");
    expect(home).toHaveAttribute("href", "/jim/notes");
    expect(within(nav).getByRole("link", { name: "People" })).toHaveAttribute(
      "href",
      "/jim/notes/people"
    );
    expect(screen.getByTestId("notes")).toHaveAttribute("data-active", "true");
    // One chat, docked: no Chat | Notes switch, no ⋯ menu.
    const dock = screen.getByRole("complementary", { name: "Chat with Jim" });
    expect(within(dock).getByLabelText("Message")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Notes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    // The menu's settings live in the sidebar.
    expect(screen.getByRole("button", { name: "New chat" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();

    await userEvent.click(within(nav).getByRole("link", { name: "People" }));
    expect(window.location.pathname).toBe("/jim/notes/people");
    expect(screen.getByTestId("notes")).toHaveAttribute(
      "data-route",
      "page:people"
    );

    // Chat takes the middle on its own route, and the dock steps aside.
    await userEvent.click(within(nav).getByRole("link", { name: "Chat" }));
    expect(window.location.pathname).toBe("/jim/chat");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("sends from the dock and stays on the page", async () => {
    send.mockResolvedValue({ reply: "Noted.", changed: [], commit: null });
    window.history.replaceState(null, "", "/jim/notes/people");
    renderChat();
    const dock = screen.getByRole("complementary", { name: "Chat with Jim" });
    await userEvent.type(within(dock).getByLabelText("Message"), "hi{Enter}");
    expect(await within(dock).findByText("Noted.")).toBeInTheDocument();
    // A quick log from Notes doesn't leave the page either.
    await userEvent.click(screen.getByRole("button", { name: "Fake log" }));
    expect(window.location.pathname).toBe("/jim/notes/people");
  });

  it("focuses the search on ⌘K and goes back with Esc from a profile", async () => {
    window.history.replaceState(null, "", "/jim/notes/people");
    renderChat();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByLabelText("Search notes")).toHaveFocus();
    screen.getByLabelText("Search notes").blur();

    // Opened straight on a profile: Esc goes up to its list.
    window.history.replaceState(null, "", "/jim/notes/people/sam-okafor");
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.getByTestId("notes")).toHaveAttribute(
      "data-route",
      "person:sam-okafor"
    );
    await userEvent.keyboard("{Escape}");
    expect(window.location.pathname).toBe("/jim/notes/people");
  });

  it("searching from Chat shows the results in Notes, never in the address", async () => {
    renderChat();
    await userEvent.type(screen.getByLabelText("Search notes"), "plants");
    expect(window.location.pathname).toBe("/jim/notes");
    expect(window.location.href).not.toContain("plants");
  });
});

describe("layout", () => {
  it("has the Chat | Notes switch in the header and no bottom bar", () => {
    renderChat();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("tab", { name: "Chat" })).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("signs out from the header menu", async () => {
    const onSignOut = jest.fn();
    render(
      <JimChat
        uid={UID}
        api="https://jim.example.test"
        getToken={getToken}
        onSignOut={onSignOut}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("clears the home bar only while the keyboard is down", () => {
    const vv = Object.assign(new EventTarget(), {
      width: 393,
      height: 800,
      offsetTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: vv,
    });
    try {
      renderChat();
      const composer = screen.getByLabelText("Message").closest("form")!;
      expect(composer.className).toContain("safe-area-inset-bottom");
      act(() => {
        vv.height = 460;
        vv.dispatchEvent(new Event("resize"));
      });
      expect(composer.className).not.toContain("safe-area-inset-bottom");
    } finally {
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: undefined,
      });
    }
  });
});

/** A turn the test drives event by event, as the server streams it. */
function streamed() {
  const reply = deferred<api.JimReply>();
  let emit: (event: api.JimStreamEvent) => void = () => {};
  send.mockImplementation((_text, _session, _token, onEvent) => {
    emit = onEvent ?? (() => {});
    return reply.promise;
  });
  return {
    reply,
    emit: (event: api.JimStreamEvent) => act(() => emit(event)),
  };
}

async function sendText(text: string) {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("streaming", () => {
  it("shows each step, the text as it comes, Saving… and then the saved line", async () => {
    const turn = streamed();
    renderChat();
    await sendText("remember the milk");
    expect(screen.getByText("Jim is thinking…")).toBeInTheDocument();

    turn.emit({ t: "step", text: "Searching notes" });
    expect(screen.getByText("Searching notes…")).toBeInTheDocument();
    expect(screen.getByText("Jim is thinking…")).toBeInTheDocument();

    turn.emit({ t: "delta", text: "Adding **mi" });
    turn.emit({ t: "delta", text: "lk** now" });
    // Drawn on the next animation frame.
    expect(await screen.findByText("milk")).toHaveProperty("tagName", "STRONG");
    expect(screen.queryByText("Jim is thinking…")).not.toBeInTheDocument();

    // Text before a tool call was provisional.
    turn.emit({ t: "step", text: "Saving lists/todos.md" });
    expect(screen.queryByText("milk")).not.toBeInTheDocument();
    expect(screen.getByText("Jim is thinking…")).toBeInTheDocument();
    expect(screen.getByText("Saving lists/todos.md…")).toBeInTheDocument();

    turn.emit({ t: "reply", text: "Added the milk." });
    expect(screen.getByText("Added the milk.")).toBeInTheDocument();
    turn.emit({ t: "saving" });
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    await act(async () =>
      turn.reply.resolve({
        reply: "Added the milk. (Not saved yet.)",
        changed: ["lists/todos.md"],
        commit: "abc",
      })
    );
    expect(
      screen.getByText("Added the milk. (Not saved yet.)")
    ).toBeInTheDocument();
    expect(screen.queryByText("Added the milk.")).not.toBeInTheDocument();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    expect(screen.getByText("Saved: lists/todos.md")).toBeInTheDocument();
  });

  it("losing signal mid-reply keeps the message and what Jim wrote, never resends", async () => {
    const turn = streamed();
    renderChat();
    await sendText("remember the milk");
    turn.emit({ t: "reply", text: "Added the milk." });
    turn.emit({ t: "saving" });
    await act(async () => turn.reply.reject(new api.JimError("uncertain")));

    expect(
      screen.getByText("Jim may have saved this — check before sending again")
    ).toBeInTheDocument();
    const log = within(screen.getByRole("log"));
    expect(log.getByText("remember the milk")).toBeInTheDocument();
    expect(log.getByText("Added the milk.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    // Kept as uncertain, not as waiting.
    expect(loadHistory(UID)?.messages).toEqual([
      { id: 0, from: "me", text: "remember the milk", uncertain: true },
      { id: 1, from: "jim", text: "Added the milk.", uncertain: true },
    ]);
  });
});

describe("kept chat", () => {
  it("comes back after a reload, in the same session", async () => {
    send.mockResolvedValue({ reply: "Noted.", changed: [], commit: null });
    const first = renderChat();
    await sendText("hello");
    await screen.findByText("Noted.");
    const session = send.mock.calls[0][1];
    first.unmount();

    renderChat();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("Noted.")).toBeInTheDocument();
    await sendText("again");
    expect(send.mock.calls[1][1]).toBe(session);
  });

  it("a reload mid-turn shows the message as maybe saved, not as unsent", async () => {
    send.mockReturnValue(new Promise(() => {}));
    const first = renderChat();
    await sendText("remember the milk");
    first.unmount();

    renderChat();
    expect(screen.getByText("remember the milk")).toBeInTheDocument();
    expect(
      screen.getByText("Jim may have saved this — check before sending again")
    ).toBeInTheDocument();
    expect(screen.queryByText("Jim is thinking…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("New chat clears it here and on the device and starts a new session", async () => {
    saveHistory(UID, {
      session: "old-session",
      messages: [{ id: 4, from: "me", text: "old news" }],
    });
    send.mockResolvedValue({ reply: "Fresh.", changed: [], commit: null });
    renderChat();
    expect(screen.getByText("old news")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New chat" }));
    expect(screen.queryByText("old news")).not.toBeInTheDocument();
    expect(loadHistory(UID)?.messages).toEqual([]);
    await sendText("hi");
    expect(send.mock.calls[0][1]).not.toBe("old-session");
    expect(loadHistory(UID)?.session).toBe(send.mock.calls[0][1]);
    expect(window.localStorage.getItem(historyKey(UID))).toContain("Fresh.");
  });

  it("drops a reply that lands after New chat", async () => {
    const turn = streamed();
    renderChat();
    await sendText("first");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New chat" }));
    await act(async () =>
      turn.reply.resolve({ reply: "Late.", changed: [], commit: null })
    );
    expect(screen.queryByText("Late.")).not.toBeInTheDocument();
    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});

describe("quick log from Notes", () => {
  it("sends the sentence, switches to Chat and keeps the draft", async () => {
    const reply = deferred<api.JimReply>();
    send.mockReturnValue(reply.promise);
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "half typed");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake log" }));
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(send.mock.calls[0][0]).toBe("Log my workout today: Ran.");
    expect(
      within(screen.getByRole("log")).getByText("Log my workout today: Ran.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("half typed");
    await act(async () =>
      reply.resolve({ reply: "Logged.", changed: [], commit: null })
    );
    expect(screen.getByText("Logged.")).toBeInTheDocument();
  });

  it("waits in the box while another turn is out", async () => {
    send.mockReturnValue(new Promise(() => {}));
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "first");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake log" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Message")).toHaveValue(
      "Log my workout today: Ran."
    );
  });
});

describe("draft from Notes", () => {
  it("fills the box, switches to Chat and sends nothing", async () => {
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "half typed");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake draft" }));
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Message")).toHaveValue(
      "Help me with: A reply\nhalf typed"
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("fills an empty box with just the phrase", async () => {
    renderChat();
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake draft" }));
    expect(screen.getByLabelText("Message")).toHaveValue(
      "Help me with: A reply"
    );
    expect(send).not.toHaveBeenCalled();
  });
});

describe("offline", () => {
  function goOffline(offline: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value: !offline,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event(offline ? "offline" : "online"));
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "onLine");
  });

  it("says so, keeps the text and holds Send until the signal is back", async () => {
    renderChat();
    const box = screen.getByLabelText("Message");
    await userEvent.type(box, "remember the milk");
    goOffline(true);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    expect(box).toHaveValue("remember the milk");

    goOffline(false);
    expect(screen.queryByText("You're offline")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("puts a quick log in the box instead of sending it", async () => {
    renderChat();
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    goOffline(true);
    await userEvent.click(screen.getByRole("button", { name: "Fake log" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message")).toHaveValue(
      "Log my workout today: Ran."
    );
  });
});

it("drops the keyboard from any field when switching tabs", async () => {
  renderChat();
  await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
  // A field on Notes (here the fake's button) has focus...
  const field = screen.getByRole("button", { name: "Fake log" });
  field.focus();
  expect(field).toHaveFocus();
  // fireEvent: like an iOS tap, it doesn't move focus to the tab itself.
  fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
  expect(field).not.toHaveFocus();
  // ...and the box does too, going the other way.
  screen.getByLabelText("Message").focus();
  fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
  expect(screen.getByLabelText("Message")).not.toHaveFocus();
});
