import { act, render, screen } from "@testing-library/react";
import {
  clearNearMissPop,
  nearMissPop,
} from "@/lib/plane-builder/state/nearMissPop";
import CloseCallPop from "../CloseCallPop";

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => clearNearMissPop());
  jest.useRealTimers();
});

describe("CloseCallPop", () => {
  it("shows nothing until there is a near miss", () => {
    render(<CloseCallPop />);
    expect(screen.queryByTestId("close-call")).toBeNull();
  });

  it("pops 'Close call!' with the combo and coins, then goes away", () => {
    render(<CloseCallPop />);
    act(() => nearMissPop.push(3, 3));
    expect(screen.getByTestId("close-call")).toHaveTextContent(
      "Close call! ×3"
    );
    expect(screen.getByTestId("close-call")).toHaveTextContent("+3");
    expect(screen.getByTestId("close-call-lines")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.queryByTestId("close-call")).toBeNull();
  });

  it("leaves off the multiplier on the first near miss", () => {
    render(<CloseCallPop />);
    act(() => nearMissPop.push(1, 1));
    expect(screen.getByTestId("close-call")).toHaveTextContent(/^Close call!/);
    expect(screen.getByTestId("close-call")).not.toHaveTextContent("×");
  });
});
