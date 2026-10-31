import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import { historyKey, saveHistory } from "@/lib/jim/history";
import JimChat from "../JimChat";

/** How often each text's Markdown rendered. */
const renders = new Map<string, number>();

jest.mock("@/lib/jim/markdown", () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => {
    renders.set(text, (renders.get(text) ?? 0) + 1);
    return <div>{text}</div>;
  },
}));
jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, streamToJim: jest.fn() };
});
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const send = jest.mocked(api.streamToJim);
const UID = "uid-1";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderChat(onSignOut = jest.fn()) {
  return render(
    <JimChat
      uid={UID}
      api="https://jim.example.test"
      getToken={async () => "t"}
      onSignOut={onSignOut}
    />
  );
}

/** A turn the test drives; also hands back the signal it was given. */
function streamed() {
  const reply = deferred<api.JimReply>();
  let emit: (event: api.JimStreamEvent) => void = () => {};
  let signal: AbortSignal | undefined;
  send.mockImplementation((...args) => {
    emit = args[3] ?? (() => {});
    signal = args[8];
    return reply.promise;
  });
  return {
    reply,
    emit: (event: api.JimStreamEvent) => act(() => emit(event)),
    signal: () => signal,
  };
}

async function sendText(text: string) {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  renders.clear();
  send.mockReset();
  window.localStorage.clear();
});

it("redraws only the live reply as it streams, not the messages above", async () => {
  saveHistory(UID, {
    session: "s",
    messages: [
      { id: 0, from: "me", text: "hi" },
      { id: 1, from: "jim", text: "An old reply" },
    ],
  });
  const turn = streamed();
  renderChat();
  await sendText("what's new?");
  turn.emit({ t: "delta", text: "One" });
  await screen.findByText("One");
  const before = renders.get("An old reply");
  for (const word of [" two", " three", " four"]) {
    turn.emit({ t: "delta", text: word });
  }
  await screen.findByText("One two three four");
  expect(renders.get("An old reply")).toBe(before);
});

it("keeps nothing on this device once signed out, even a reply that lands after", async () => {
  const turn = streamed();
  const onSignOut = jest.fn(() => window.localStorage.clear());
  renderChat(onSignOut);
  await sendText("remember the milk");
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  expect(onSignOut).toHaveBeenCalled();
  expect(turn.signal()?.aborted).toBe(true);
  await act(async () =>
    turn.reply.resolve({ reply: "Saved.", changed: [], commit: null })
  );
  expect(window.localStorage.getItem(historyKey(UID))).toBeNull();
});

it("aborts the turn that is out on New chat and on leaving", async () => {
  const first = streamed();
  const { unmount } = renderChat();
  await sendText("one");
  expect(first.signal()?.aborted).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New chat" }));
  expect(first.signal()?.aborted).toBe(true);

  const second = streamed();
  await sendText("two");
  unmount();
  expect(second.signal()?.aborted).toBe(true);
});
