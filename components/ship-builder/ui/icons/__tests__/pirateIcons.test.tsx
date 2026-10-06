import { render } from "@testing-library/react";
import { DECO_ICONS } from "../pirate/deco";

describe("pirate deco icons", () => {
  it("draws eight distinct, real icons", () => {
    const entries = Object.entries(DECO_ICONS);
    expect(entries).toHaveLength(8);
    const markup = entries.map(([, Icon]) => {
      const { container } = render(
        <svg>
          <Icon />
        </svg>
      );
      expect(container.querySelector("[data-placeholder]")).toBeNull();
      return container.innerHTML;
    });
    expect(new Set(markup).size).toBe(8);
  });
});
