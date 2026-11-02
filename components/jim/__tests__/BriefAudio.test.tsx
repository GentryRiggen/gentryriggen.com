import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { JimError } from "@/lib/jim/api";
import * as brief from "@/lib/jim/brief";
import { emitOpenIntent } from "@/lib/jim/openUrl";
import { JimPlayer, SILENT_CLIP, type PlayerDeps } from "@/lib/jim/player";
import type { ReadAloud } from "../useReadAloud";
import JimChat from "../JimChat";
import useBriefAudio, { BRIEF_STAGES } from "../useBriefAudio";

jest.mock("@/lib/jim/brief", () => ({ fetchBriefScript: jest.fn() }));

/** What the (mocked) Notes shell was last given for the brief. */
let notesBrief: {
  stage: string | null;
  error: string | null;
} | null = null;
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: (props: {
    onHearBrief?: () => void;
    briefStage?: string | null;
    briefError?: string | null;
  }) => {
    notesBrief = {
      stage: props.briefStage ?? null,
      error: props.briefError ?? null,
    };
    return props.onHearBrief ? (
      <button type="button" onClick={props.onHearBrief}>
        Hear your morning
      </button>
    ) : null;
  },
}));

/** An audio element that plays (or, like iOS without a tap, refuses). */
class FakeAudio extends EventTarget {
  src = "";
  paused = true;
  ended = false;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  refuse = false;
  play = jest.fn(() => {
    if (this.refuse && this.src !== SILENT_CLIP) {
      return Promise.reject(
        Object.assign(new Error("no"), { name: "NotAllowedError" })
      );
    }
    this.paused = false;
    return Promise.resolve();
  });
  pause = jest.fn(() => {
    this.paused = true;
  });
}

interface Pending {
  resolve: (blob: Blob) => void;
}

let player: JimPlayer;
let audio: FakeAudio;
let speechFetches: Pending[];
/** The calls the hook made into the reader, in order. */
let calls: string[];

function newPlayer() {
  audio = new FakeAudio();
  speechFetches = [];
  calls = [];
  const deps: PlayerDeps = {
    fetchAudio: () =>
      new Promise<Blob>((resolve) => speechFetches.push({ resolve })),
    createAudio: () => audio as unknown as HTMLAudioElement,
    createUrl: () => "blob:test",
    revokeUrl: () => {},
    speech: null,
    loadSpeed: () => 1,
    saveSpeed: () => {},
  };
  player = new JimPlayer(deps);
}

/** useReadAloud, over the test's player. */
function useTestReader(): ReadAloud {
  const state = useSyncExternalStore(player.subscribe, player.getState);
  return {
    supported: true,
    auto: false,
    speakingId: null,
    state,
    toggle: jest.fn(),
    readNew: jest.fn(),
    toggleSample: jest.fn(),
    play: (key, text, options) => {
      calls.push("play");
      return player.play(key, text, options);
    },
    prepare: (key, title, stage) => {
      calls.push("prepare");
      return player.prepare(key, title, stage);
    },
    failPrepared: (message) => player.failPrepared(message),
    prime: () => {
      calls.push("prime");
      player.unlock();
    },
    unlock: jest.fn(),
    togglePause: () => player.togglePause(),
    setSpeed: jest.fn(),
    dismiss: () => player.dismiss(),
    stop: () => player.stop(),
    setArtist: jest.fn(),
    menuItem: null,
  };
}

jest.mock("../useReadAloud", () => ({
  __esModule: true,
  default: function useReadAloud() {
    return useTestReader();
  },
}));

const fetchScript = jest.mocked(brief.fetchBriefScript);
const getToken = jest.fn().mockResolvedValue("t");
const API = "https://jim.example.test";
const SCRIPT = { day: "2026-11-02", text: "Good morning. Two meetings today." };

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The script fetch, held until the test lets it land. */
function heldScript() {
  const script = deferred<brief.BriefScript>();
  let signal: AbortSignal | undefined;
  fetchScript.mockImplementation((...args) => {
    signal = args[4];
    return script.promise;
  });
  return { script, signal: () => signal };
}

function listen() {
  act(() => emitOpenIntent({ listen: "brief" }));
}

function renderBrief() {
  return renderHook(() => useBriefAudio(getToken, API, useTestReader()));
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  notesBrief = null;
  newPlayer();
  fetchScript.mockResolvedValue(SCRIPT);
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("useBriefAudio", () => {
  it("unlocks audio and shows the bar in the tap, before any wait", () => {
    const { signal } = heldScript();
    const { result } = renderBrief();
    act(() => {
      void result.current.playBrief();
    });
    expect(calls.slice(0, 2)).toEqual(["prime", "prepare"]);
    expect(player.getState()).toMatchObject({
      status: "loading",
      stage: BRIEF_STAGES.script,
    });
    expect(result.current.stage).toBe(BRIEF_STAGES.script);
    expect(signal()).toBeDefined();
  });

  it("goes from writing, to warming up the voice, to playing", async () => {
    const { script } = heldScript();
    const { result } = renderBrief();
    act(() => {
      void result.current.playBrief();
    });
    expect(result.current.stage).toBe("Writing your morning…");
    await act(async () => script.resolve(SCRIPT));
    expect(player.getState().key).toBe("brief:2026-11-02");
    expect(result.current.stage).toBe("Warming up the voice…");
    await act(async () => speechFetches[0].resolve(new Blob(["x"])));
    await flush();
    expect(player.getState().status).toBe("playing");
    expect(result.current.stage).toBeNull();
  });

  it("asks for a rewrite only when told to", async () => {
    const { result } = renderBrief();
    await act(() => result.current.playBrief({ fresh: true }));
    expect(fetchScript).toHaveBeenCalledWith(
      getToken,
      { fresh: true },
      undefined,
      API,
      expect.any(AbortSignal)
    );
  });

  it("cancel aborts the script and nothing plays when it lands", async () => {
    const { script, signal } = heldScript();
    const { result } = renderBrief();
    act(() => {
      void result.current.playBrief();
    });
    act(() => player.stop());
    expect(signal()?.aborted).toBe(true);
    await act(async () => script.resolve(SCRIPT));
    expect(calls).not.toContain("play");
    expect(player.getState().status).toBe("idle");
    expect(result.current.stage).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("a cancel's rejected fetch shows no error", async () => {
    const { script } = heldScript();
    const { result } = renderBrief();
    act(() => {
      void result.current.playBrief();
    });
    act(() => player.stop());
    await act(async () => script.reject(new JimError("waking")));
    expect(result.current.error).toBeNull();
    expect(player.getState().status).toBe("idle");
  });

  it("shows the server's own words, as they are, in the bar", async () => {
    fetchScript.mockRejectedValue(
      new Error("Your morning brief has been rewritten enough for today.")
    );
    const { result } = renderBrief();
    await act(() => result.current.playBrief({ fresh: true }));
    expect(result.current.error).toBe(
      "Your morning brief has been rewritten enough for today."
    );
    expect(player.getState()).toMatchObject({
      status: "error",
      error: "Your morning brief has been rewritten enough for today.",
    });
    expect(calls).not.toContain("play");
  });

  it("says plainly when the script can't be had", async () => {
    fetchScript.mockRejectedValue(new JimError("server"));
    const { result } = renderBrief();
    await act(() => result.current.playBrief());
    expect(result.current.error).toMatch(/Couldn't get your morning brief/);
  });

  it("fetches once from ?listen=brief and plays under brief:<day>", async () => {
    renderBrief();
    listen();
    await waitFor(() => expect(calls).toContain("play"));
    expect(fetchScript).toHaveBeenCalledTimes(1);
    expect(player.getState().key).toBe("brief:2026-11-02");
  });

  it("a second ask while it plays doesn't restart it", async () => {
    player.play("brief:2026-11-02", SCRIPT.text);
    speechFetches[0].resolve(new Blob(["x"]));
    await flush();
    renderBrief();
    listen();
    listen();
    await flush();
    expect(fetchScript).not.toHaveBeenCalled();
  });

  it("two asks while the script is on its way fetch it once", async () => {
    renderBrief();
    listen();
    listen();
    await waitFor(() => expect(calls).toContain("play"));
    expect(fetchScript).toHaveBeenCalledTimes(1);
  });

  it("never cuts in over other audio: the chip waits for a tap", async () => {
    player.play("msg:3", "A reply being read.");
    speechFetches[0].resolve(new Blob(["x"]));
    await flush();
    const { result } = renderBrief();
    listen();
    await flush();
    expect(fetchScript).not.toHaveBeenCalled();
    expect(player.getState().key).toBe("msg:3");
    expect(result.current.chip).toBe(true);
    await act(async () => result.current.playFromChip());
    await waitFor(() => expect(calls).toContain("play"));
    expect(result.current.chip).toBe(false);
  });

  it("leaves a chip when nothing could start", async () => {
    fetchScript.mockResolvedValue({ day: "2026-11-02", text: "   " });
    const { result } = renderBrief();
    listen();
    await waitFor(() => expect(result.current.chip).toBe(true));
  });
});

describe("in the app", () => {
  function renderApp() {
    return render(
      <JimChat
        uid="uid-1"
        api={API}
        getToken={getToken}
        onSignOut={jest.fn()}
      />
    );
  }

  beforeEach(() => window.history.replaceState(null, "", "/jim/notes"));

  it("Hear your morning stays on Home and shows the loading bar there (phone)", async () => {
    const { script } = heldScript();
    renderApp();
    await userEvent.click(
      screen.getByRole("button", { name: "Hear your morning" })
    );
    expect(window.location.pathname).toBe("/jim/notes");
    const notes = document.getElementById("jim-notes") as HTMLElement;
    const bar = within(notes).getByRole("region", { name: "Now playing" });
    expect(within(bar).getByRole("status")).toHaveTextContent(
      "Writing your morning…"
    );
    expect(notesBrief?.stage).toBe("Writing your morning…");
    // One bar: the hidden chat doesn't draw a second one.
    expect(screen.getAllByRole("region", { name: "Now playing" })).toHaveLength(
      1
    );
    await act(async () => script.resolve(SCRIPT));
    expect(within(bar).getByRole("status")).toHaveTextContent(
      "Warming up the voice…"
    );
    expect(notesBrief?.stage).toBe("Warming up the voice…");
    await act(async () => speechFetches[0].resolve(new Blob(["x"])));
    await flush();
    expect(notesBrief?.stage).toBeNull();
    expect(
      within(notes).getByRole("button", { name: "Pause" })
    ).toBeInTheDocument();
  });

  it("Cancel in the bar stops the wait", async () => {
    const { signal } = heldScript();
    renderApp();
    await userEvent.click(
      screen.getByRole("button", { name: "Hear your morning" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal()?.aborted).toBe(true);
    expect(screen.queryByRole("region", { name: "Now playing" })).toBeNull();
    expect(notesBrief?.stage).toBeNull();
  });

  it("an error shows in the bar and by the Home button", async () => {
    fetchScript.mockRejectedValue(
      new Error("Your morning brief has been rewritten enough for today.")
    );
    renderApp();
    await userEvent.click(
      screen.getByRole("button", { name: "Hear your morning" })
    );
    const notes = document.getElementById("jim-notes") as HTMLElement;
    await waitFor(() =>
      expect(within(notes).getByRole("alert")).toHaveTextContent(
        "rewritten enough for today"
      )
    );
    expect(notesBrief?.error).toBe(
      "Your morning brief has been rewritten enough for today."
    );
  });

  it("plays from ?listen=brief and clears it from the address", async () => {
    window.history.replaceState(null, "", "/jim?listen=brief");
    renderApp();
    expect(window.location.search).toBe("");
    expect(
      screen.getByRole("region", { name: "Now playing" })
    ).toBeInTheDocument();
    await waitFor(() => expect(player.getState().key).toBe("brief:2026-11-02"));
    expect(fetchScript).toHaveBeenCalledTimes(1);
  });

  it("a refused start (iOS) shows Tap to play, and the tap plays it", async () => {
    audio.refuse = true;
    renderApp();
    listen();
    await waitFor(() => expect(speechFetches).toHaveLength(1));
    await act(async () => speechFetches[0].resolve(new Blob(["x"])));
    await flush();
    const tapToPlay = await screen.findByRole("button", {
      name: /Tap to play/,
    });
    audio.refuse = false;
    await userEvent.click(tapToPlay);
    expect(player.getState().status).toBe("playing");
    expect(screen.queryByRole("button", { name: /Tap to play/ })).toBeNull();
  });

  it("over other audio, Tap to play your morning waits for a tap", async () => {
    player.play("msg:3", "A reply being read.");
    speechFetches[0].resolve(new Blob(["x"]));
    await flush();
    renderApp();
    listen();
    const chip = await screen.findByRole("button", {
      name: "Tap to play your morning",
    });
    await userEvent.click(chip);
    await waitFor(() => expect(fetchScript).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Tap to play your morning" })
      ).toBeNull()
    );
  });
});
