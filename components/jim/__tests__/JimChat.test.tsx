import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import JimChat from "../JimChat";

jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, sendToJim: jest.fn() };
});
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: ({
    active,
    onDone,
  }: {
    active: boolean;
    onDone: (title: string) => void;
  }) => (
    <div data-testid="notes" data-active={String(active)}>
      <button type="button" onClick={() => onDone("Water the plants")}>
        Fake done
      </button>
    </div>
  ),
}));

const send = jest.mocked(api.sendToJim);
const getToken = jest.fn().mockResolvedValue("t");

function renderChat() {
  return render(
    <JimChat
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
});

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
  const [session, text, token, fetchFn, url] = send.mock.calls[0];
  expect(session).toMatch(/^[0-9a-f-]{36}$/);
  expect(text).toBe("what's on my list?");
  expect(token).toBe(getToken);
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
  expect(send.mock.calls[1][0]).toBe(send.mock.calls[0][0]);
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
  expect(send.mock.calls[0][1]).toBe("a\nb");
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

  it("puts Done: <title> in the box and switches to Chat without sending", async () => {
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "draft");
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake done" }));
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Message")).toHaveValue(
      "draft\nDone: Water the plants"
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("puts Done: <title> alone in an empty box", async () => {
    renderChat();
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake done" }));
    expect(screen.getByLabelText("Message")).toHaveValue(
      "Done: Water the plants"
    );
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
