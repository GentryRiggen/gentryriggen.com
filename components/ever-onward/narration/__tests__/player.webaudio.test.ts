import { getClip } from "@/lib/ever-onward/narration/manifest";
import {
  playNarration,
  resetNarrationPlayer,
  unlockNarrationOnGesture,
} from "../player";

type Win = Window & { AudioContext?: unknown };

/**
 * On iOS any <audio> element (even a silent unlock clip) takes the phone's
 * Now Playing slot and pauses the player's podcast. Narration must go
 * through Web Audio wherever it exists.
 */
describe("narration player with Web Audio", () => {
  const started: unknown[] = [];
  let mediaPlay: jest.SpyInstance;

  beforeEach(() => {
    resetNarrationPlayer();
    started.length = 0;
    (window as Win).AudioContext = class {
      destination = {};
      resume() {
        return Promise.resolve();
      }
      decodeAudioData(_bytes: ArrayBuffer, resolve: (buffer: unknown) => void) {
        resolve({ duration: 1 });
      }
      createBufferSource() {
        const node = {
          buffer: null as unknown,
          onended: null as null | (() => void),
          connect: () => node,
          start: () => started.push(node),
          stop: () => undefined,
        };
        return node;
      }
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }) as unknown as typeof fetch;
    mediaPlay = jest
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    delete (window as Win).AudioContext;
    mediaPlay.mockRestore();
    resetNarrationPlayer();
  });

  it("unlocks on a tap without touching a media element", () => {
    unlockNarrationOnGesture();
    document.dispatchEvent(new Event("pointerdown"));
    expect(mediaPlay).not.toHaveBeenCalled();
  });

  it("plays a clip through Web Audio, never an <audio> element", async () => {
    expect(getClip("light/intro-coast")).toBeTruthy();
    playNarration("light/intro-coast");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toHaveLength(1);
    expect(mediaPlay).not.toHaveBeenCalled();
  });
});
