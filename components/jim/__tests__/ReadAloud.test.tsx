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
  default: ({ onLog }: { onLog: (text: string) => void }) => (
    <button type="button" onClick={() => onLog("Log my workout: Ran.")}>
      Fake log
    </button>
  ),
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
  getVoices: jest.fn((): unknown[] => [
    { name: "Test (Premium)", lang: "en-US", default: true },
  ]),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  speaking: false,
  pending: false,
};

/** The shared audio element the player makes. */
class FakeAudio extends EventTarget {
  static last: FakeAudio | null = null;
  src = "";
  paused = true;
  ended = false;
  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  currentTime = 0;
  duration = Number.NaN;
  play = jest.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = jest.fn(() => {
    this.paused = true;
  });
  constructor() {
    super();
    FakeAudio.last = this;
  }
  finish() {
    this.ended = true;
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
  }
}

function audio(): FakeAudio {
  if (!FakeAudio.last) throw new Error("no audio element yet");
  return FakeAudio.last;
}

/** /api/speak: MP3 bytes (ok) or a failure. */
const fetchMock = jest.fn();

function speakOk() {
  fetchMock.mockImplementation(async () => ({
    status: 200,
    ok: true,
    blob: async () => ({ size: 3, type: "audio/mpeg" }),
  }));
}

function speakFails() {
  fetchMock.mockImplementation(async () => ({
    status: 502,
    ok: false,
    blob: async () => ({ size: 0 }),
  }));
}

function spokenTexts(): string[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/api/speak"))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string).text);
}

function installAudio() {
  FakeAudio.last = null;
  Object.defineProperty(window, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  let n = 0;
  URL.createObjectURL = jest.fn(() => `blob:test/${n++}`);
  URL.revokeObjectURL = jest.fn();
}

function removeAudio() {
  Reflect.deleteProperty(window, "Audio");
  Reflect.deleteProperty(globalThis, "Audio");
}

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

const realAudio = Object.getOwnPropertyDescriptor(window, "Audio");

beforeEach(() => {
  send.mockReset();
  fetchMock.mockReset();
  speakOk();
  window.localStorage.clear();
  spoken.length = 0;
  synth.speak.mockClear();
  synth.cancel.mockClear();
  installSpeech();
  installAudio();
});

afterEach(() => {
  removeSpeech();
  removeAudio();
  if (realAudio) Object.defineProperty(window, "Audio", realAudio);
  Reflect.deleteProperty(globalThis, "fetch");
});

describe("Listen button", () => {
  it("reads a reply in Jim's voice as plain text, and Stop cuts it off", async () => {
    renderChat();
    await chat("Here is **bold** news.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await waitFor(() => expect(audio().play).toHaveBeenCalled());
    expect(spokenTexts()).toEqual(["Here is bold news."]);
    expect(audio().src).toMatch(/^blob:/);
    expect(synth.speak).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(audio().pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("goes back to Listen when the reply ends", async () => {
    renderChat();
    await chat("One reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    await waitFor(() => expect(audio().play).toHaveBeenCalled());
    act(() => audio().finish());
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("falls back to the browser's voice when Jim's can't be fetched", async () => {
    speakFails();
    renderChat();
    await chat("Here is **bold** news.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await waitFor(() =>
      expect(spoken.map((u) => u.text)).toEqual(["Here is bold news."])
    );
    act(() => spoken[spoken.length - 1].onend?.());
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });

  it("is absent when the browser can neither play audio nor speak", async () => {
    removeSpeech();
    removeAudio();
    renderChat();
    await chat("Silent reply.");
    expect(
      screen.queryByRole("button", { name: "Listen" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByText(/Read replies aloud/)).not.toBeInTheDocument();
  });

  it("is there with audio alone (no speechSynthesis)", async () => {
    removeSpeech();
    renderChat();
    await chat("Audio only.");
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
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

  it("unlocks audio and speech in the Send tap, then reads the new reply", async () => {
    renderChat();
    await toggleSetting();
    synth.speak.mockClear();
    audio().play.mockClear();
    let srcAtSend = "";
    send.mockImplementation(async () => {
      srcAtSend = audio().src;
      return { reply: "Auto reply.", changed: [], commit: null };
    });
    await userEvent.type(screen.getByLabelText("Message"), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    // The silent unlocks came first, inside the tap.
    expect(srcAtSend).toMatch(/^data:audio\/wav;base64,/);
    expect(synth.speak.mock.calls[0][0]).toMatchObject({
      text: " ",
      volume: 0,
    });
    await waitFor(() => expect(spokenTexts()).toContain("Auto reply."));
    await waitFor(() => expect(audio().src).toMatch(/^blob:/));
  });

  it("skips the auto-read when the page is hidden, and does not queue it", async () => {
    renderChat();
    await toggleSetting();
    send.mockResolvedValue({
      reply: "Hidden reply.",
      changed: [],
      commit: null,
    });
    await userEvent.type(screen.getByLabelText("Message"), "hi");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    await act(async () => {});
    expect(spokenTexts()).not.toContain("Hidden reply.");
    Reflect.deleteProperty(document, "visibilityState");
    await act(async () => {});
    expect(spokenTexts()).not.toContain("Hidden reply.");
  });

  it("unlocks for a send that doesn't come from the box (quick log)", async () => {
    renderChat();
    await toggleSetting();
    synth.speak.mockClear();
    audio().play.mockClear();
    send.mockResolvedValue({ reply: "Logged.", changed: [], commit: null });
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: "Fake log" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(synth.speak.mock.calls[0][0]).toMatchObject({ volume: 0 });
    expect(audio().play).toHaveBeenCalled();
  });

  it("does not read replies when Off", async () => {
    renderChat();
    await chat("Quiet reply.");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(spokenTexts()).toEqual([]);
  });
});

describe("stopping", () => {
  it("stops on New chat", async () => {
    renderChat();
    await chat("Long reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await waitFor(() => expect(audio().play).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New chat" }));
    expect(audio().pause).toHaveBeenCalled();
  });

  it("keeps Jim's voice playing when the page is hidden (lock screen)", async () => {
    renderChat();
    await chat("Long reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await waitFor(() => expect(audio().play).toHaveBeenCalled());
    audio().pause.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Reflect.deleteProperty(document, "visibilityState");
    expect(audio().pause).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("stops the browser's voice when the page is hidden", async () => {
    speakFails();
    renderChat();
    await chat("Long reply.");
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await waitFor(() => expect(spoken.length).toBeGreaterThan(0));
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
    expect(screen.getByRole("button", { name: "Listen" })).toBeInTheDocument();
  });
});
