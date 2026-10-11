import { MAX_AIM_PITCH, MAX_AIM_YAW } from "../constants";
import { aimFromDrag, stickFromDrag } from "../aim";

describe("aimFromDrag", () => {
  it("has no power for no drag", () => {
    expect(aimFromDrag(0, 0, 100)).toEqual({ power: 0, pitch: 0, yaw: 0 });
  });

  it("aims up when dragging down and right when dragging left", () => {
    const aim = aimFromDrag(-50, 50, 100);
    expect(aim.pitch).toBeCloseTo(0.5 * MAX_AIM_PITCH);
    expect(aim.yaw).toBeCloseTo(0.5 * MAX_AIM_YAW);
    expect(aim.power).toBeCloseTo(Math.hypot(50, 50) / 100);
  });

  it("aims left when dragging right", () => {
    expect(aimFromDrag(40, 0, 100).yaw).toBeLessThan(0);
  });

  it("never aims below level", () => {
    expect(aimFromDrag(0, -80, 100).pitch).toBe(0);
  });

  it("clamps a full pull", () => {
    const aim = aimFromDrag(-500, 500, 100);
    expect(aim).toEqual({
      power: 1,
      pitch: MAX_AIM_PITCH,
      yaw: MAX_AIM_YAW,
    });
  });

  it("copes with a zero maxDrag", () => {
    expect(aimFromDrag(10, 10, 0).power).toBe(0);
  });
});

describe("stickFromDrag", () => {
  it("is centred for no drag", () => {
    expect(stickFromDrag(0, 0, 80)).toEqual({ pitch: 0, bank: 0 });
  });

  it("climbs when dragging up and banks right when dragging right", () => {
    expect(stickFromDrag(40, -40, 80)).toEqual({ pitch: 0.5, bank: 0.5 });
  });

  it("dives when dragging down and banks left when dragging left", () => {
    const stick = stickFromDrag(-40, 40, 80);
    expect(stick.pitch).toBe(-0.5);
    expect(stick.bank).toBe(-0.5);
  });

  it("clamps to the radius", () => {
    expect(stickFromDrag(900, -900, 80)).toEqual({ pitch: 1, bank: 1 });
  });
});
