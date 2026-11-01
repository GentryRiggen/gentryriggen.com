import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import JimChat from "../JimChat";

jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, streamToJim: jest.fn() };
});
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const send = jest.mocked(api.streamToJim);

class FakeUtterance {
  text: string;
  volume = 1;
  rate = 1;
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const spoken: FakeUtterance[] = [];
const synth = {
  speak: jest.fn((u: FakeUtterance) => {
    spoken.push(u);
  }),
  cancel: jest.fn(() => {
    spoken.length = 0;
  }),
  getVoices: jest.fn(() => []),
};

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

function installSpeech() {
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: synth,
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
}

function removeSpeech() {
  Reflect.deleteProperty(window, "speechSynthesis");
  Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
}

async function chat(reply: string) {
  send.mockResolvedValue({ reply, changed: [], commit: null });
  await userEvent.type(screen.getByLabelText("Message"), "hi");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(send).toHaveBeenCalled());
  await screen.findByLabelText("Conversation");
  await act(async () => {});
}

beforeEach(() => {
  send.mockReset();
  window.localStorage.clear();
  spoken.length = 0;
  synth.speak.mockClear();
  synth.cancel.mockClear();
  installSpeech();
});

afterEach(removeSpeech);

describe("Listen button", () => {
  it("reads a reply as plain text, and Stop cuts it off", async () => {
    renderChat();
    await chat("Here is **bold** news.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    expect(spoken.map((u) => u.text)).toEqual(["Here is bold news."]);
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("goes back to Listen when the speech ends", async () => {
    renderChat();
    await chat("One reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    act(() => spoken[spoken.length - 1].onend?.());
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("is absent when the browser cannot speak", async () => {
    removeSpeech();
    renderChat();
    await chat("Silent reply.");
    expect(
      screen.queryByRole("button", { name: "Listen" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByText(/Read replies aloud/)).not.toBeInTheDocument();
  });

  it("is absent on a reply that may not have been saved", async () => {
    send.mockRejectedValue(new api.JimError("uncertain"));
    renderChat();
    await userEvent.type(screen.getByLabelText("Message"), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/Jim may have saved this/);
    expect(
      screen.queryByRole("button", { name: "Listen" })
    ).not.toBeInTheDocument();
  });
});

describe("Read replies aloud setting", () => {
  async function toggleSetting() {
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Read replies aloud/ })
    );
  }

  it("defaults to Off, and On is remembered on this device", async () => {
    const { unmount } = renderChat();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Read replies aloud: Off" })
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Read replies aloud/ })
    );
    expect(window.localStorage.getItem("jim:read-aloud")).toBe("on");
    unmount();

    renderChat();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Read replies aloud: On" })
    ).toBeInTheDocument();
  });

  it("unlocks speech in the Send tap, then reads the new reply", async () => {
    renderChat();
    await toggleSetting();
    synth.speak.mockClear();
    await chat("Auto reply.");
    // The silent unlock came first, inside the tap.
    expect(synth.speak.mock.calls[0][0]).toMatchObject({
      text: " ",
      volume: 0,
    });
    expect(spoken.map((u) => u.text)).toContain("Auto reply.");
  });

  it("does not read replies when Off", async () => {
    renderChat();
    await chat("Quiet reply.");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("stops speaking on New chat and when the page is hidden", async () => {
    renderChat();
    await chat("Long reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    synth.cancel.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Reflect.deleteProperty(document, "visibilityState");
    expect(synth.cancel).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    synth.cancel.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New chat" }));
    expect(synth.cancel).toHaveBeenCalled();
  });
});
