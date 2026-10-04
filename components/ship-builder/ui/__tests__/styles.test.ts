import {
  buttonClass,
  dangerButtonClass,
  pressedButtonClass,
  primaryButtonClass,
} from "../styles";

describe("button styles", () => {
  it.each([
    ["buttonClass", buttonClass],
    ["pressedButtonClass", pressedButtonClass],
    ["primaryButtonClass", primaryButtonClass],
    ["dangerButtonClass", dangerButtonClass],
  ])("%s disables double-tap zoom on touch screens", (_name, className) => {
    expect(className.split(" ")).toContain("touch-manipulation");
  });
});
