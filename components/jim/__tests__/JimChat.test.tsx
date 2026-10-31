import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import JimChat from "../JimChat";

jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, sendToJim: jest.fn() };
});

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
