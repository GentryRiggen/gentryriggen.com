import { render, screen } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import { sceneInfo } from "@/lib/ever-onward/universes/light";
import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import SkyDials from "../SkyDials";

function view(change: Partial<LightSceneInfo>) {
  const run = newRun(def);
  const info: LightSceneInfo = {
    ...sceneInfo(run),
    dialsOpen: 1,
    probes: 20,
    ...change,
  };
  return render(
    <svg>
      <SkyDials info={info} />
    </svg>
  );
}

const hotOpacity = (): number =>
  Number(screen.getByTestId("lm-hot-edge").getAttribute("opacity"));

describe("the sky's moments in the picture", () => {
  it("shows what a flare burned in 5% steps, and what the shields saved", () => {
    view({ flareHit: 3, flareLost: 9, flareSaved: 6 });
    expect(screen.getByText("FLARE!")).toBeInTheDocument();
    expect(
      screen.getByText("45% burned, shields saved 30%")
    ).toBeInTheDocument();
  });

  it("says a burn of 5% is a burn, and only a scratch is safe", () => {
    const small = view({ flareHit: 1, flareLost: 1, flareSaved: 0 });
    expect(screen.getByText("5% burned")).toBeInTheDocument();
    small.unmount();
    view({ flareHit: 1, flareLost: 0, flareSaved: 0 });
    expect(screen.getByText("the fleet is safe")).toBeInTheDocument();
  });

  it("shows a bigger pack the more has gone wild, with a name on it", () => {
    const counts = [1, 2, 3, 4].map((wild) => {
      const v = view({ wild });
      const pack = screen.getByTestId("lm-wild-cluster");
      const dots = pack.querySelectorAll("circle[r='8.5']").length;
      v.unmount();
      return dots;
    });
    expect(counts).toEqual([3, 6, 9, 12]);
    const v = view({ wild: 2 });
    expect(screen.getByText("wild")).toBeInTheDocument();
    v.unmount();
  });

  it("heats the edge of the picture as the fleet flies closer: Brushing is far hotter than Near", () => {
    const at = (sunDist: number): number => {
      const v = view({ sunDist });
      const opacity = screen.queryByTestId("lm-hot-edge") ? hotOpacity() : 0;
      v.unmount();
      return opacity;
    };
    // Safe (2), Near (4), Close (6), Brushing (8)
    expect(at(2)).toBe(0);
    expect(at(4)).toBeGreaterThan(0);
    expect(at(6)).toBeGreaterThan(2 * at(4));
    expect(at(8)).toBeGreaterThan(1.5 * at(6));
  });

  it("shouts GONE WILD! and HOME! on their own", () => {
    const wild = view({ goneWild: 1, wild: 2 });
    expect(screen.getByTestId("lm-banner-wild")).toBeInTheDocument();
    wild.unmount();
    view({ homeAgain: 1 });
    expect(screen.getByTestId("lm-banner-home")).toBeInTheDocument();
  });
});
