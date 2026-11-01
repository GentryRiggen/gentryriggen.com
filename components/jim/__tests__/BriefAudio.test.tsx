import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JimError } from "@/lib/jim/api";
import * as brief from "@/lib/jim/brief";
import { emitOpenIntent } from "@/lib/jim/openUrl";
import type { PlayerState } from "@/lib/jim/player";
import type { ReadAloud } from "../useReadAloud";
import JimChat from "../JimChat";
import useBriefAudio from "../useBriefAudio";

jest.mock("@/lib/jim/brief", () => ({ fetchBriefScript: jest.fn() }));
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const IDLE: PlayerState = {
  key: null,
  status: "idle",
  title: "",
  part: 0,
  parts: 0,
  partProgress: 0,
  speed: 1,
  engine: null,
  error: null,
  errorKey: null,
};

function fakeReader(state: Partial<PlayerState> = {}): ReadAloud {
  return {
    supported: true,
    auto: false,
    speakingId: null,
    state: { ...IDLE, ...state },
    toggle: jest.fn(),
    readNew: jest.fn(),
    toggleSample: jest.fn(),
    play: jest.fn().mockReturnValue(true),
    prime: jest.fn(),
    unlock: jest.fn(),
    togglePause: jest.fn(),
    setSpeed: jest.fn(),
    dismiss: jest.fn(),
    stop: jest.fn(),
    setArtist: jest.fn(),
    menuItem: null,
  };
}

let current: ReadAloud;
jest.mock("../useReadAloud", () => ({
  __esModule: true,
  default: () => current,
}));

const fetchScript = jest.mocked(brief.fetchBriefScript);
const getToken = jest.fn().mockResolvedValue("t");
const API = "https://jim.example.test";
const SCRIPT = { day: "2026-11-02", text: "Good morning. Two meetings today." };

function listen() {
  act(() => emitOpenIntent({ listen: "brief", reflect: false }));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  current = fakeReader();
  fetchScript.mockResolvedValue(SCRIPT);
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("useBriefAudio", () => {
  it("fetches once and plays under brief:<day>", async () => {
    const reader = fakeReader();
    renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    await waitFor(() => expect(reader.play).toHaveBeenCalled());
    expect(fetchScript).toHaveBeenCalledTimes(1);
    expect(fetchScript).toHaveBeenCalledWith(getToken, {}, undefined, API);
    expect(reader.play).toHaveBeenCalledWith("brief:2026-11-02", SCRIPT.text, {
      artist: "Jim",
    });
  });

  it("asks for a rewrite only when told to", async () => {
    const reader = fakeReader();
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    await act(() => result.current.playBrief({ fresh: true }));
    expect(fetchScript).toHaveBeenCalledWith(
      getToken,
      { fresh: true },
      undefined,
      API
    );
  });

  it("leaves a chip when the browser won't start it without a tap", () => {
    const { result, rerender } = renderHook(
      ({ reader }) => useBriefAudio(getToken, API, reader),
      { initialProps: { reader: fakeReader() } }
    );
    listen();
    expect(result.current.chip).toBe(false);
    rerender({
      reader: fakeReader({ key: "brief:2026-11-02", status: "paused" }),
    });
    expect(result.current.chip).toBe(true);
  });

  it("leaves a chip when nothing could start", async () => {
    const reader = fakeReader();
    jest.mocked(reader.play).mockReturnValue(false);
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    await waitFor(() => expect(result.current.chip).toBe(true));
  });

  it("a tap on the chip resumes the paused brief", () => {
    const reader = fakeReader({ key: "brief:2026-11-02", status: "paused" });
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    act(() => result.current.playFromChip());
    expect(reader.togglePause).toHaveBeenCalled();
    expect(fetchScript).not.toHaveBeenCalled();
  });

  it("a second ask while it plays doesn't restart it", async () => {
    const reader = fakeReader({ key: "brief:2026-11-02", status: "playing" });
    renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    listen();
    await Promise.resolve();
    expect(fetchScript).not.toHaveBeenCalled();
    expect(reader.play).not.toHaveBeenCalled();
  });

  it("never cuts in over other audio: the chip waits for a tap", async () => {
    const reader = fakeReader({ key: "msg:3", status: "playing" });
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    await Promise.resolve();
    expect(fetchScript).not.toHaveBeenCalled();
    expect(reader.play).not.toHaveBeenCalled();
    expect(result.current.chip).toBe(true);
    await act(async () => result.current.playFromChip());
    await waitFor(() => expect(reader.play).toHaveBeenCalled());
  });

  it("two asks while the script is on its way fetch it once", async () => {
    const reader = fakeReader();
    renderHook(() => useBriefAudio(getToken, API, reader));
    listen();
    listen();
    await waitFor(() => expect(reader.play).toHaveBeenCalled());
    expect(fetchScript).toHaveBeenCalledTimes(1);
  });

  it("shows the server's own words, as they are", async () => {
    fetchScript.mockRejectedValue(
      new Error("Your morning brief has been rewritten enough for today.")
    );
    const reader = fakeReader();
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    await act(() => result.current.playBrief({ fresh: true }));
    expect(result.current.error).toBe(
      "Your morning brief has been rewritten enough for today."
    );
    expect(reader.play).not.toHaveBeenCalled();
  });

  it("says plainly when the script can't be had", async () => {
    fetchScript.mockRejectedValue(new JimError("server"));
    const reader = fakeReader();
    const { result } = renderHook(() => useBriefAudio(getToken, API, reader));
    await act(() => result.current.playBrief());
    expect(result.current.error).toMatch(/Couldn't get your morning brief/);
  });
});

describe("in the chat", () => {
  function renderChat() {
    return render(
      <JimChat
        uid="uid-1"
        api={API}
        getToken={getToken}
        onSignOut={jest.fn()}
      />
    );
  }

  it("plays from ?listen=brief and clears it from the address", async () => {
    window.history.replaceState(null, "", "/jim?listen=brief");
    renderChat();
    expect(window.location.search).toBe("");
    await waitFor(() =>
      expect(current.play).toHaveBeenCalledWith(
        "brief:2026-11-02",
        SCRIPT.text,
        { artist: "Jim" }
      )
    );
    expect(fetchScript).toHaveBeenCalledTimes(1);
  });

  it("shows Play your morning when the play was refused, and a tap plays it", async () => {
    jest.mocked(current.play).mockReturnValue(false);
    renderChat();
    listen();
    const chip = await screen.findByRole("button", {
      name: "Play your morning",
    });
    jest.mocked(current.play).mockReturnValue(true);
    await userEvent.click(chip);
    await waitFor(() => expect(current.play).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Play your morning" })
      ).toBeNull()
    );
  });
});
