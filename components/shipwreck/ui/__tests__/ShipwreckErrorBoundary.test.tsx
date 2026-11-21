import { fireEvent, render, screen } from "@testing-library/react";
import ShipwreckErrorBoundary from "../ShipwreckErrorBoundary";

function Boom(): never {
  throw new Error("WebGL context could not be created");
}

describe("ShipwreckErrorBoundary", () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    // React logs the caught error; keep the test output quiet.
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("shows its children when nothing goes wrong", () => {
    render(
      <ShipwreckErrorBoundary>
        <p>the night</p>
      </ShipwreckErrorBoundary>
    );
    expect(screen.getByText("the night")).toBeInTheDocument();
    expect(screen.queryByTestId("shipwreck-crash")).toBeNull();
  });

  it("shows a calm panel with a big start-again button on a crash", () => {
    const onRestart = jest.fn();
    render(
      <ShipwreckErrorBoundary onRestart={onRestart}>
        <Boom />
      </ShipwreckErrorBoundary>
    );
    const panel = screen.getByTestId("shipwreck-crash");
    expect(panel).toHaveTextContent("Something went wrong with the ship.");
    expect(panel.className).toContain("env(safe-area-inset-top)");
    const button = screen.getByRole("button", { name: "Tap to start again" });
    expect(button.className).toContain("min-h-16");
    fireEvent.click(button);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
