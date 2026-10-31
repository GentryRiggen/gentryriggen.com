import { act, renderHook } from "@testing-library/react";
import useTrialChoices, {
  getTrialChoices,
  trialChoicesSetting,
} from "../useTrialChoices";

const KEY = "ship-builder:ui:trial-choices";
const SEA_KEY = "ship-builder:ui:sea";

afterEach(() => window.localStorage.clear());

describe("useTrialChoices", () => {
  it("defaults to the main sea and filling every seat", () => {
    window.localStorage.setItem(SEA_KEY, "choppy");
    const { result } = renderHook(useTrialChoices);
    expect(result.current.waveSea).toBe("choppy");
    expect(result.current.lifeboats).toBe("fill");
    expect(getTrialChoices()).toEqual({ waveSea: "choppy", lifeboats: "fill" });
  });

  it("remembers each choice on the device", () => {
    const first = renderHook(useTrialChoices);
    act(() => first.result.current.setWaveSea("stormy"));
    act(() => first.result.current.setLifeboats("titanic"));
    first.unmount();
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      waveSea: "stormy",
      lifeboats: "titanic",
    });
    const second = renderHook(useTrialChoices);
    expect(second.result.current.waveSea).toBe("stormy");
    expect(second.result.current.lifeboats).toBe("titanic");
  });

  it("ignores junk in storage", () => {
    window.localStorage.setItem(KEY, '{"waveSea":"wild","lifeboats":"x"}');
    expect(getTrialChoices()).toEqual({ waveSea: "calm", lifeboats: "fill" });
    window.localStorage.setItem(KEY, "not json");
    expect(getTrialChoices()).toEqual({ waveSea: "calm", lifeboats: "fill" });
  });

  it("can be set from outside React", () => {
    trialChoicesSetting.set({ lifeboats: "titanic" });
    expect(getTrialChoices().lifeboats).toBe("titanic");
  });
});
