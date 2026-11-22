import { render } from "@testing-library/react";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { lusitaniaRecipe } from "../../model/lusitaniaRecipe";
import HullDiagram from "../HullDiagram";

function funnelFills(spec: typeof titanic): string[] {
  const { container } = render(<HullDiagram spec={spec} title="Side" />);
  // Each funnel's body: the first rect of its group, or its own rect.
  return [...container.querySelectorAll("rect")]
    .filter((r) => r.getAttribute("transform") === "skewX(8)")
    .map((r) => r.getAttribute("fill") ?? "");
}

describe("the diagram's funnels", () => {
  it("are the Titanic's buff, as in 1.0", () => {
    const fills = funnelFills(titanic);
    expect(fills).toHaveLength(4);
    expect(fills.slice(0, 3)).toEqual(["#d9a35a", "#d9a35a", "#d9a35a"]);
    expect(fills[3]).toBe("#c9a06a"); // the dummy
  });

  it("are the Lusitania's own paint, the model's colour", () => {
    const paint = lusitaniaRecipe(lusitania).paint!;
    expect(lusitania.funnelPaint).toEqual({
      funnel: paint.funnel,
      top: paint.funnelTop,
    });
    const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
    const fills = funnelFills(lusitania);
    // Body and top band per funnel.
    expect(fills).toHaveLength(8);
    expect(fills.filter((f) => f === hex(paint.funnel))).toHaveLength(4);
    expect(fills.filter((f) => f === hex(paint.funnelTop))).toHaveLength(4);
    expect(fills).not.toContain("#d9a35a");
  });
});
