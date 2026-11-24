import { render } from "@testing-library/react";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { fitzgeraldRecipe } from "../../model/fitzgeraldRecipe";
import { lusitaniaRecipe } from "../../model/lusitaniaRecipe";
import { spotAria } from "@/lib/shipwreck/whatIf";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
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

describe("the diagram of a wave ship (the Poseidon)", () => {
  const pose = (rollDeg: number, pitchDeg = 0, z = 0): BodyPose => ({
    part: "whole",
    x: 0,
    y: 0,
    z,
    pitch: (pitchDeg * Math.PI) / 180,
    roll: (rollDeg * Math.PI) / 180,
    yaw: 0,
  });

  it("stays finite at every roll, keel up and past it", () => {
    for (const roll of [0, 45, 90, 135, 180, 190]) {
      for (const z of [-9, 0, 9]) {
        const { container, unmount } = render(
          <HullDiagram spec={poseidon} pose={pose(roll, 1, z)} title="Side" />
        );
        const bad: string[] = [];
        for (const el of container.querySelectorAll("*"))
          for (const a of el.getAttributeNames())
            if (/NaN|Infinity/.test(el.getAttribute(a) ?? ""))
              bad.push(`${el.tagName} ${a}`);
        expect(bad).toEqual([]);
        // The sea line is drawn only where it can be read.
        const line = container.querySelector(
          "[data-testid='shipwreck-sea-line']"
        );
        if (roll === 90) expect(line).toBeNull();
        else expect(line).not.toBeNull();
        unmount();
      }
    }
  });

  it("draws her upside down once she is past her side, never for other ships", () => {
    const body = (spec: typeof poseidon, roll: number) => {
      const { container, unmount } = render(
        <HullDiagram spec={spec} pose={pose(roll, 0, 9)} title="Side" />
      );
      const g = container.querySelector(
        "[data-testid='shipwreck-diagram-body']"
      )!;
      const out = [g.getAttribute("data-flipped"), g.getAttribute("transform")];
      unmount();
      return out;
    };
    expect(body(poseidon, 0)[0]).toBe("false");
    expect(body(poseidon, 80)[0]).toBe("false");
    expect(body(poseidon, 100)[0]).toBe("true");
    const [flipped, transform] = body(poseidon, 180);
    expect(flipped).toBe("true");
    expect(transform).toMatch(/^translate\(0 \d+\) scale\(1 -1\)$/);
    // A ship with a plan (the Carpathia's side bunkers) is never turned.
    expect(body(carpathia, 180)[0]).toBe("false");
  });

  it("marks her seven spots on her side, each a tap target, no plan", () => {
    const onToggle = jest.fn();
    const { container, getByTestId } = render(
      <HullDiagram
        spec={poseidon}
        selected={new Set(["vents"])}
        onToggle={onToggle}
        title="Side"
      />
    );
    expect(
      container.querySelector("[data-testid='shipwreck-plan']")
    ).toBeNull();
    const ids = poseidon.wave!.spots.map((s) => s.id);
    expect(ids).toHaveLength(7);
    for (const id of ids)
      expect(getByTestId(`shipwreck-spot-${id}`)).toHaveAttribute(
        "aria-checked",
        id === "vents" ? "true" : "false"
      );
    getByTestId("shipwreck-spot-lobby").dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(onToggle).toHaveBeenCalledWith("lobby");
    // No per-compartment targets: her spots are what the wave smashes.
    expect(
      container.querySelector("[data-testid^='shipwreck-comp-']")
    ).toBeNull();
    // Her whole funnel and dome fit: the picture is as tall as she is.
    const [, , , h] = container
      .querySelector("svg")!
      .getAttribute("viewBox")!
      .split(" ")
      .map(Number);
    expect(h).toBeGreaterThan(78 * 2);
  });
});

describe("the water in her named boxes (the Poseidon, Task 9)", () => {
  it("draws each box's water from its floor, only where there is some", () => {
    const fills = poseidon.superstructure.map((b, i) =>
      b.id === "ballroom" ? 0.5 : i === 0 ? 1 : 0
    );
    const { container } = render(
      <HullDiagram spec={poseidon} boxWater={fills} title="Side" />
    );
    const rects = container.querySelectorAll("[data-box-water]");
    expect(rects).toHaveLength(2);
    const ball = container.querySelector("[data-box-water='ballroom']")!;
    const full = container.querySelector(
      `[data-box-water='${poseidon.superstructure[0].id}']`
    )!;
    const h = (r: Element) => Number(r.getAttribute("height"));
    expect(h(ball)).toBeGreaterThan(0);
    for (const r of rects)
      for (const a of ["x", "y", "width", "height"])
        expect(Number.isFinite(Number(r.getAttribute(a)))).toBe(true);
    expect(h(full)).toBeGreaterThan(h(ball));
    // Without box water (every other ship), none.
    const plain = render(<HullDiagram spec={poseidon} title="Side" />);
    expect(plain.container.querySelector("[data-box-water]")).toBeNull();
  });
});
