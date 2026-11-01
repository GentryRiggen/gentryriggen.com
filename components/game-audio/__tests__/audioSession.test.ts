import { mixWithOtherAudio } from "../audioSession";

type Nav = Navigator & { audioSession?: { type: string } };

describe("mixWithOtherAudio", () => {
  afterEach(() => {
    delete (navigator as Nav).audioSession;
  });

  it("switches the page's audio session to ambient so podcasts keep playing", () => {
    (navigator as Nav).audioSession = { type: "auto" };
    mixWithOtherAudio();
    expect((navigator as Nav).audioSession?.type).toBe("ambient");
  });

  it("does nothing where the browser has no audio session API", () => {
    expect(() => mixWithOtherAudio()).not.toThrow();
  });
});
