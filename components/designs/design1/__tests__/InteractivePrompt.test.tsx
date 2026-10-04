import { act, fireEvent, render, screen } from "@testing-library/react";
import InteractivePrompt from "../InteractivePrompt";
import { navigateTo } from "../navigate";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));

jest.mock("../navigate", () => ({ navigateTo: jest.fn() }));

const assign = navigateTo as jest.MockedFunction<typeof navigateTo>;

function runCommand(command: string) {
  const input = screen.getByLabelText("Terminal command input");
  fireEvent.change(input, { target: { value: command } });
  fireEvent.submit(input);
}

describe("InteractivePrompt navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    assign.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("navigates to the game about 1.2s after `ships`", () => {
    render(<InteractivePrompt onClear={jest.fn()} />);
    runCommand("ships");

    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(assign).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/ship-builder");
  });

  it("does not navigate for ordinary commands", () => {
    render(<InteractivePrompt onClear={jest.fn()} />);
    runCommand("pwd");
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("cancels the pending navigation on unmount", () => {
    const { unmount } = render(<InteractivePrompt onClear={jest.fn()} />);
    runCommand("ships");
    unmount();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
