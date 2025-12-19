import { render, screen, fireEvent, act } from "@testing-library/react";
import Hero from "../Hero";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill, // eslint-disable-line @typescript-eslint/no-unused-vars
    priority: _priority, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props
  }: React.ComponentPropsWithoutRef<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock canvas-confetti
const mockConfetti = jest.fn();
jest.mock("canvas-confetti", () => ({
  __esModule: true,
  default: () => mockConfetti(),
}));

describe("Hero", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    mockConfetti.mockClear();
  });

  it("renders the main heading", () => {
    render(<Hero />);
    expect(screen.getByText("GENTRY")).toBeInTheDocument();
    expect(screen.getByText("RIGGEN")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<Hero />);
    expect(screen.getByText("Software Leader & Developer")).toBeInTheDocument();
  });

  it("renders the main content text", () => {
    render(<Hero />);
    expect(
      screen.getByText(/I build products and lead teams/)
    ).toBeInTheDocument();
  });

  it("renders the image", () => {
    render(<Hero />);
    const image = screen.getByAltText("Gentry Riggen");
    expect(image).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<Hero />);
    // Footer should be present (checking for common footer content)
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
  });

  it("handles image clicks", () => {
    render(<Hero />);
    const imageButton = screen.getByRole("button", {
      name: /click me three times/i,
    });
    expect(imageButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(imageButton);
    });
    // Should not throw error
  });

  it("triggers confetti after 3 clicks", () => {
    mockConfetti.mockClear();

    render(<Hero />);
    const imageButton = screen.getByRole("button", {
      name: /click me three times/i,
    });

    // Click 3 times rapidly
    act(() => {
      fireEvent.click(imageButton);
      fireEvent.click(imageButton);
      fireEvent.click(imageButton);
    });

    // Advance timers to allow confetti to trigger
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Confetti should be called (it's called multiple times for different bursts)
    expect(mockConfetti).toHaveBeenCalled();
  });
});
