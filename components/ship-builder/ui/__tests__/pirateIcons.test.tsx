import { renderToStaticMarkup } from "react-dom/server";
import { SAIL_ICONS } from "../icons/pirate/sails";

describe("pirate sail icons", () => {
  const ids = Object.keys(SAIL_ICONS) as (keyof typeof SAIL_ICONS)[];
  const draw = (id: (typeof ids)[number]) =>
    renderToStaticMarkup(<svg>{SAIL_ICONS[id]()}</svg>);

  it("has all nine icons, none a placeholder", () => {
    expect(ids).toHaveLength(9);
    for (const id of ids) {
      expect(draw(id)).not.toContain("data-placeholder");
    }
  });

  it("draws each one differently", () => {
    expect(new Set(ids.map(draw)).size).toBe(ids.length);
  });
});
