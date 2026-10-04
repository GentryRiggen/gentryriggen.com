import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import Scene from "../Scene";

jest.mock("@react-three/fiber", () => ({ Canvas: () => null }));
jest.mock("@react-three/drei", () => ({ Sky: () => null }));
jest.mock("../AttachMarkers", () => () => null);
jest.mock("../CameraRig", () => () => null);
jest.mock("../GhostPreview", () => () => null);
jest.mock("../GridTargets", () => () => null);
jest.mock("../Hull", () => () => null);
jest.mock("../LongPressRing", () => () => null);
jest.mock("../Ocean", () => () => null);
jest.mock("../ShipParts", () => () => null);
jest.mock("../ShipAnimation", () => () => null);

describe("Scene canvas wrapper", () => {
  it.each(["contextmenu", "selectstart", "dragstart"])(
    "prevents the default %s so iOS cannot cancel a hold",
    (type) => {
      render(<Scene />);
      const wrapper = screen.getByTestId("ship-canvas");
      const event = createEvent(type, wrapper, { cancelable: true });
      fireEvent(wrapper, event);
      expect(event.defaultPrevented).toBe(true);
    }
  );

  it("leaves touchstart alone so taps still synthesize clicks", () => {
    render(<Scene />);
    const wrapper = screen.getByTestId("ship-canvas");
    const event = createEvent.touchStart(wrapper, { cancelable: true });
    fireEvent(wrapper, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("blocks touch gestures, selection and the callout with classes", () => {
    render(<Scene />);
    expect(screen.getByTestId("ship-canvas")).toHaveClass(
      "touch-none",
      "select-none",
      "[-webkit-touch-callout:none]"
    );
  });
});
