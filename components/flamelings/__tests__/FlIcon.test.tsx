import { render } from "@testing-library/react";
import FlIcon, { FL_ICON_NAMES } from "../FlIcon";

describe("FlIcon", () => {
  it.each(FL_ICON_NAMES)("renders %s as a hidden svg", (name) => {
    const { container } = render(<FlIcon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("path, circle, rect, ellipse")).not.toBeNull();
  });

  it("has unique names", () => {
    expect(new Set(FL_ICON_NAMES).size).toBe(FL_ICON_NAMES.length);
  });
});
