import { render } from "@testing-library/react";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
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

describe("the diagram's funnels in another livery", () => {
  it("wear the livery's paint (the Lusitania's 1907 Cunard red)", () => {
    const paint = lusitania.liveries![1].funnelPaint!;
    const { container } = render(
      <HullDiagram spec={lusitania} title="Side" funnelPaint={paint} />
    );
    const fills = [...container.querySelectorAll("rect")]
      .filter((r) => r.getAttribute("transform") === "skewX(8)")
      .map((r) => r.getAttribute("fill"));
    expect(fills.filter((f) => f === "#cc5a28")).toHaveLength(4);
    expect(fills.filter((f) => f === "#141416")).toHaveLength(4);
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

describe("the Carpathia's diagram (R21)", () => {
  it("draws no raised poop: only the stern deckhouse, clear of her stern", () => {
    const { container } = render(<HullDiagram spec={carpathia} title="Side" />);
    const boxes = [...container.querySelectorAll("rect")].filter(
      (r) =>
        r.getAttribute("fill") === "#e7e2d4" &&
        r.getAttribute("opacity") === "0.75"
    );
    expect(boxes).toHaveLength(carpathia.superstructure.length);
    // Her hull's outline starts at her stern; the aftmost box (the stern
    // deckhouse, 30 ft long) stands well forward of it.
    const hull = container.querySelector("clipPath path")!.getAttribute("d")!;
    const sternPx = Number(hull.slice(1).split(",")[0]);
    const xs = boxes.map((r) => Number(r.getAttribute("x")));
    const widths = boxes.map((r) => Number(r.getAttribute("width")));
    const aft = xs.indexOf(Math.min(...xs));
    const pxPerM =
      widths[aft] /
      (carpathia.superstructure[0].toX - carpathia.superstructure[0].fromX);
    expect((xs[aft] - sternPx) / pxPerM).toBeGreaterThan(4);
    expect(widths[aft] / pxPerM).toBeLessThan(12);
  });
});

describe("the struck side's label", () => {
  it("stands clear of the red dashed edge, on a halo over the plan's lines", () => {
    const { container, getByText, getByTestId } = render(
      <HullDiagram spec={carpathia} title="Side" />
    );
    const edge = getByTestId("shipwreck-struck-side");
    const edgeY = Number(edge.getAttribute("y1"));
    const label = getByText("Port: torpedoes hit here");
    const fontSize = Number(label.getAttribute("font-size"));
    // Its caps' top (about 0.72 of the font size over the baseline) at
    // least 5 units under the dashed edge (the holes' zigzag on it reaches
    // about 2 under).
    const capTop = Number(label.getAttribute("y")) - 0.72 * fontSize;
    expect(capTop - edgeY).toBeGreaterThanOrEqual(5);
    // The plan's bulkhead lines pass behind a halo, not through the words.
    expect(label.getAttribute("paint-order")).toBe("stroke");
    expect(label.getAttribute("stroke")).toBe("#111827");
    expect(
      container.querySelector("[data-testid='shipwreck-plan']")
    ).toContainElement(label);
  });
});
