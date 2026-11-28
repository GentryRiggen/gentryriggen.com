import { render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import Hud, { railRows } from "../Hud";

/**
 * The right rail on a short band (a phone with its home-screen insets):
 * into columns rather than under the speed buttons (1.18).
 */

describe("railRows: how many rail buttons fit in one column", () => {
  it("fits the Walk button (80 px) and the round ones (64 px), 12 px apart under 12 px", () => {
    // 12 + 80 + 5 × (12 + 64) = 472: all six.
    expect(railRows(472, 6, true)).toBe(6);
    expect(railRows(471, 6, true)).toBe(5);
    // Without the Walk button first, 16 px less.
    expect(railRows(456, 6, false)).toBe(6);
    // A pinned iPhone's band (about 400 px): five, then a second column.
    expect(railRows(404, 6, true)).toBe(5);
    // A landscape phone's band (about 190 px): two rows.
    expect(railRows(190, 6, true)).toBe(2);
  });

  it("is at least one and never more than the buttons", () => {
    expect(railRows(10, 6, true)).toBe(1);
    expect(railRows(5000, 2, true)).toBe(2);
  });
});

describe("the rail on a short band", () => {
  // jsdom has no layout: the band's height, stood in on every element,
  // and an observer that reports once on observing (as browsers do).
  class ReportingObserver {
    constructor(private cb: () => void) {}
    observe() {
      this.cb();
    }
    disconnect() {}
  }
  const hadObserver = window.ResizeObserver;
  beforeEach(() => {
    window.ResizeObserver =
      ReportingObserver as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    window.ResizeObserver = hadObserver;
  });
  function setup(bandPx: number) {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => bandPx,
    });
    const store = createPlaybackStore();
    store.getState().start(titanic, titanic.realNight);
    render(<Hud store={store} onBack={() => {}} runId={1} />);
    return screen.getByTestId("shipwreck-rail");
  }

  it("goes into columns, the first at the edge, when the buttons do not fit", () => {
    const rail = setup(300);
    expect(rail.className).toContain("grid-flow-col");
    expect(rail.className).toContain("grid-rows-[repeat(3,auto)]");
    expect(rail.className).toContain("[direction:rtl]");
    expect(
      rail.querySelector('[data-testid="shipwreck-cameras-button"]')
    ).not.toBeNull();
  });

  it("stays one column where they fit (a tablet, a laptop)", () => {
    const rail = setup(900);
    expect(rail.className).toContain("flex-col");
    expect(rail.className).not.toContain("grid");
  });
});
