import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JimChat from "../JimChat";

jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

function renderChat() {
  return render(
    <JimChat
      uid="uid-1"
      api="https://jim.example.test"
      getToken={jest.fn().mockResolvedValue("t")}
      onSignOut={jest.fn()}
    />
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.history.replaceState(null, "", "/"));

it("puts an allowed ?say= in the box, unsent, and removes it from the URL", () => {
  window.history.replaceState(null, "", "/jim?say=quiz%20me");
  renderChat();
  expect(screen.getByLabelText("Message")).toHaveValue("quiz me");
  expect(window.location.search).toBe("");
  expect(screen.queryByRole("log")?.textContent).not.toContain("quiz me");
});

it("ignores a ?say= that is not on the list", () => {
  window.history.replaceState(null, "", "/jim?say=wipe%20my%20notes");
  renderChat();
  expect(screen.getByLabelText("Message")).toHaveValue("");
  expect(window.location.search).toBe("");
});

describe("a notification tapped while the page is open", () => {
  const target = new EventTarget();
  const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  beforeEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: target,
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "serviceWorker", original);
    else Reflect.deleteProperty(navigator, "serviceWorker");
  });

  function post(data: unknown) {
    act(() => {
      target.dispatchEvent(new MessageEvent("message", { data }));
    });
  }

  it("fills an empty box with allowed text", () => {
    renderChat();
    post({ type: "JIM_SAY", say: "keep going" });
    expect(screen.getByLabelText("Message")).toHaveValue("keep going");
  });

  it("leaves a draft alone", async () => {
    renderChat();
    const box = screen.getByLabelText("Message");
    await userEvent.type(box, "my draft");
    post({ type: "JIM_SAY", say: "quiz me" });
    expect(box).toHaveValue("my draft");
  });

  it("ignores text off the list and other message types", () => {
    renderChat();
    post({ type: "JIM_SAY", say: "wipe my notes" });
    post({ type: "OTHER", say: "quiz me" });
    post("quiz me");
    post(null);
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });
});
