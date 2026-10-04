import { render } from "@testing-library/react";
import PartIcon from "../PartIcon";
import { warningIcons } from "../warningIcons";
import { PART_TYPES } from "@/lib/ship-builder/model/types";

describe("PartIcon", () => {
  it.each(PART_TYPES)("renders an aria-hidden 48x48 svg for %s", (type) => {
    const { container } = render(
      <PartIcon type={type} className="h-10 w-10" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 48 48");
    expect(svg).toHaveClass("h-10", "w-10");
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it("draws every part differently", () => {
    const markup = PART_TYPES.map(
      (type) => render(<PartIcon type={type} />).container.innerHTML
    );
    expect(new Set(markup).size).toBe(PART_TYPES.length);
  });

  it("draws wider bridges wider", () => {
    const widths = (
      ["bridge-3", "bridge", "bridge-5", "bridge-6", "bridge-7"] as const
    ).map((type) => {
      const { container } = render(<PartIcon type={type} />);
      return Number(container.querySelector("rect")?.getAttribute("width"));
    });
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(new Set(widths).size).toBe(5);
  });
});

describe("warningIcons", () => {
  it("has a distinct icon per warning code", () => {
    const icons = Object.values(warningIcons);
    expect(icons).toHaveLength(7);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
