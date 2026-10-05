import {
  AO_DECLINE_STREAK_MS,
  AO_WARM_UP_MS,
  canRunOcclusion,
  createDeclineGate,
} from "../aoPolicy";

describe("canRunOcclusion", () => {
  const has =
    (...names: string[]) =>
    (name: string) =>
      names.includes(name);

  it("needs WebGL2", () => {
    expect(
      canRunOcclusion({
        isWebGL2: false,
        hasExtension: has("EXT_color_buffer_float"),
      })
    ).toBe(false);
  });

  it("accepts either colour-buffer extension", () => {
    expect(
      canRunOcclusion({
        isWebGL2: true,
        hasExtension: has("EXT_color_buffer_float"),
      })
    ).toBe(true);
    expect(
      canRunOcclusion({
        isWebGL2: true,
        hasExtension: has("EXT_color_buffer_half_float"),
      })
    ).toBe(true);
  });

  it("refuses when neither extension is present", () => {
    expect(canRunOcclusion({ isWebGL2: true, hasExtension: has() })).toBe(
      false
    );
  });
});

describe("createDeclineGate", () => {
  const started = () => {
    const gate = createDeclineGate();
    gate.restartWarmUp(0);
    return gate;
  };
  const afterWarmUp = AO_WARM_UP_MS + 1;

  it("never latches before the warm-up has started", () => {
    const gate = createDeclineGate();
    expect(gate.noteDecline(99999, false)).toBe(false);
    expect(gate.noteDecline(100000, false)).toBe(false);
  });

  it("ignores declines during the warm-up", () => {
    const gate = started();
    expect(gate.noteDecline(1000, false)).toBe(false);
    expect(gate.noteDecline(2500, false)).toBe(false);
    expect(gate.noteDecline(4000, false)).toBe(false);
    // The warm-up declines did not build a streak.
    expect(gate.noteDecline(afterWarmUp, false)).toBe(false);
  });

  it("needs a sustained run of declines", () => {
    const gate = started();
    expect(gate.noteDecline(afterWarmUp, false)).toBe(false);
    expect(gate.noteDecline(afterWarmUp + 2500, false)).toBe(true);
  });

  it("drops a stale decline from the streak", () => {
    const gate = started();
    gate.noteDecline(afterWarmUp, false);
    const later = afterWarmUp + AO_DECLINE_STREAK_MS + 1;
    expect(gate.noteDecline(later, false)).toBe(false);
  });

  it("ends the streak on a healthy reading", () => {
    const gate = started();
    gate.noteDecline(afterWarmUp, false);
    gate.noteIncline();
    expect(gate.noteDecline(afterWarmUp + 2500, false)).toBe(false);
  });

  it("ignores declines while the tab is hidden", () => {
    const gate = started();
    gate.noteDecline(afterWarmUp, false);
    expect(gate.noteDecline(afterWarmUp + 2500, true)).toBe(false);
    expect(gate.noteDecline(afterWarmUp + 5000, false)).toBe(false);
  });

  it("starts the warm-up over when asked, such as on return to the tab", () => {
    const gate = started();
    gate.noteDecline(afterWarmUp, false);
    gate.restartWarmUp(afterWarmUp + 1000);
    expect(gate.noteDecline(afterWarmUp + 2000, false)).toBe(false);
    expect(gate.noteDecline(afterWarmUp + 4500, false)).toBe(false);
  });
});
