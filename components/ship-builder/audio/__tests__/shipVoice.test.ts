import { act } from "react";
import { shipChannels } from "../channelSettings";
import { playShipVoice, resetShipVoice, shipVoicePlayer } from "../shipVoice";
import { soundSetting } from "../soundSetting";
import { trialSynth } from "../synth";

describe("playShipVoice", () => {
  let play: jest.SpyInstance;
  let isEnabled: jest.SpyInstance;

  beforeEach(() => {
    localStorage.clear();
    act(() => {
      soundSetting.resetMemory();
      shipChannels.voice.resetMemory();
    });
    resetShipVoice();
    play = jest.spyOn(shipVoicePlayer, "play").mockImplementation(() => {});
    isEnabled = jest.spyOn(trialSynth, "isEnabled").mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it("stays quiet while sound is locked", () => {
    isEnabled.mockReturnValue(false);
    act(() => soundSetting.set(true));
    playShipVoice("splash");
    expect(play).not.toHaveBeenCalled();
  });

  it("stays quiet while the sound setting is off", () => {
    playShipVoice("splash");
    expect(play).not.toHaveBeenCalled();
  });

  it("stays quiet with the voice switched off", () => {
    act(() => {
      soundSetting.set(true);
      shipChannels.voice.set(false);
    });
    playShipVoice("splash");
    expect(play).not.toHaveBeenCalled();
  });

  it("speaks the picked line, a different one each time", () => {
    act(() => soundSetting.set(true));
    playShipVoice("splash");
    playShipVoice("splash");
    playShipVoice("cold");
    expect(play.mock.calls.map((call) => call[0])).toEqual([
      "escape/splash-1",
      "escape/splash-2",
      "escape/cold-1",
    ]);
  });
});
