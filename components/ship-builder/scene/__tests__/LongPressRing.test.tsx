import { render, screen } from "@testing-library/react";
import LongPressRing from "../LongPressRing";

describe("LongPressRing", () => {
  it("sits at the pointer, hidden from assistive tech", () => {
    render(<LongPressRing x={120} y={48} />);
    const ring = screen.getByTestId("long-press-ring");
    expect(ring).toHaveAttribute("aria-hidden", "true");
    expect(ring.style.getPropertyValue("--ship-ring-x")).toBe("120px");
    expect(ring.style.getPropertyValue("--ship-ring-y")).toBe("48px");
  });

  it("follows a new position", () => {
    const { rerender } = render(<LongPressRing x={1} y={2} />);
    rerender(<LongPressRing x={30} y={40} />);
    const ring = screen.getByTestId("long-press-ring");
    expect(ring.style.getPropertyValue("--ship-ring-x")).toBe("30px");
  });
});
