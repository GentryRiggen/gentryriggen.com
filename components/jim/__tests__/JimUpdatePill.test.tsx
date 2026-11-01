import { fireEvent, render, screen } from "@testing-library/react";
import JimUpdatePill from "../JimUpdatePill";

describe("JimUpdatePill", () => {
  it("calls onUpdate when tapped", () => {
    const onUpdate = jest.fn();
    render(<JimUpdatePill onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: /update ready/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("is disabled while a reply is streaming", () => {
    const onUpdate = jest.fn();
    render(<JimUpdatePill onUpdate={onUpdate} disabled />);
    const button = screen.getByRole("button", { name: /after this reply/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
