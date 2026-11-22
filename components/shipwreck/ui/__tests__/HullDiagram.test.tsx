import { render } from "@testing-library/react";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { fitzgeraldRecipe } from "../../model/fitzgeraldRecipe";
import { lusitaniaRecipe } from "../../model/lusitaniaRecipe";
import { spotAria } from "@/lib/shipwreck/whatIf";
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

  it("are the Fitzgerald's own stack paint, the model's colour", () => {
    const paint = fitzgeraldRecipe(fitzgerald).paint!;
    expect(fitzgerald.funnelPaint).toEqual({
      funnel: paint.funnel,
      top: paint.funnelTop,
    });
    expect(funnelFills(fitzgerald)).toEqual(["#45201b", "#161616"]);
  });
});

describe("a storm ship's diagram", () => {
  it("draws her cargo, her hatches, and the spots to tap", () => {
    const onToggle = jest.fn();
    const { container } = render(
      <HullDiagram
        spec={fitzgerald}
        title="Side"
        selected={new Set(["hatch-1", "vents"])}
        onToggle={onToggle}
      />
    );
    expect(container.querySelectorAll("[data-cargo]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-hatch]")).toHaveLength(21);
    expect(
      container.querySelector('[data-testid="shipwreck-spot-hatch-1"]')
    ).toHaveAttribute("aria-checked", "true");
    expect(
      container.querySelector('[data-testid="shipwreck-spot-hatch-2"]')
    ).toHaveAttribute("aria-checked", "false");
    // No compartment targets: her spots are on her deck and bottom.
    expect(
      container.querySelector('[data-testid^="shipwreck-comp-"]')
    ).toBeNull();
    (
      container.querySelector(
        '[data-testid="shipwreck-spot-shoal-3"]'
      ) as SVGElement
    ).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith("shoal-3");
  });

  it("marks the hatch covers that have given way", () => {
    const { container } = render(
      <HullDiagram
        spec={fitzgerald}
        title="Side"
        failedHatches={new Set([15])}
      />
    );
    expect(container.querySelector('[data-hatch="hatch-15"]')).toHaveAttribute(
      "fill",
      "#f87171"
    );
    expect(container.querySelector('[data-hatch="hatch-14"]')).toHaveAttribute(
      "fill",
      "#64748b"
    );
  });
});

describe("a liner's compartment targets", () => {
  it("are checkboxes named like the editor's chips", () => {
    const onToggle = jest.fn();
    const { container } = render(
      <HullDiagram
        spec={lusitania}
        title="Side"
        selected={new Set(["br1"])}
        onToggle={onToggle}
      />
    );
    const on = container.querySelector('[data-testid="shipwreck-comp-br1"]');
    expect(on).toHaveAttribute("role", "checkbox");
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(on).not.toHaveAttribute("aria-pressed");
    expect(on).toHaveAttribute("aria-label", spotAria(lusitania, "br1", true));
    const off = container.querySelector('[data-testid="shipwreck-comp-br2"]');
    expect(off).toHaveAttribute("aria-checked", "false");
    expect(off).toHaveAttribute(
      "aria-label",
      spotAria(lusitania, "br2", false)
    );
  });
});
