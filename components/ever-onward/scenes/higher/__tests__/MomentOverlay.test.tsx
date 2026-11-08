import { render, screen } from "@testing-library/react";
import {
  sceneInfo,
  type HigherSceneInfo,
} from "@/lib/ever-onward/universes/higher";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/higher/__tests__/fixtures";
import MomentOverlay from "../MomentOverlay";

const skyInfo = (flags: Partial<HigherSceneInfo>): HigherSceneInfo =>
  ({ ...sceneInfo(runAtPhaseStart(2)), ...flags }) as HigherSceneInfo;

const shown = (info: HigherSceneInfo): string => {
  const { unmount } = render(<MomentOverlay info={info} />);
  const text = screen.getByTestId("hs-moment-text").textContent ?? "";
  unmount();
  return text;
};

describe("the sky's banner", () => {
  it("shows a drop over a climb that ended with it", () => {
    expect(shown(skyInfo({ dropped: true, ncLost: true, drops: 1 }))).toBe(
      "DROPPED!"
    );
  });

  it("shows a snap over a climb that ended with it", () => {
    expect(shown(skyInfo({ snapped: true, ncLost: true, snaps: 1 }))).toBe(
      "SNAP!"
    );
  });

  it("shows the gust over a climb that ended and a tie that just finished", () => {
    expect(
      shown(skyInfo({ gust: true, ncLost: true, tied: true, gusts: 1 }))
    ).toBe("GUST!");
  });

  it("is a small tag on a phone, so the picture stays clear", () => {
    render(<MomentOverlay info={skyInfo({ snapped: true, snaps: 1 })} />);
    expect(screen.getByTestId("hs-moment-text").className).toContain(
      "max-w-[92%]"
    );
  });
});

describe("the top's banner", () => {
  const topInfo = (flags: Partial<HigherSceneInfo>): HigherSceneInfo =>
    ({ ...sceneInfo(runAtPhaseStart(3)), ...flags }) as HigherSceneInfo;

  it("says a keepsake was packed, or left with a goodbye, as a small tag", () => {
    expect(shown(topInfo({ packed: true, packs: 1 }))).toBe("PACKED IT!");
    expect(shown(topInfo({ parted: true, parts: 1 }))).toBe("GOODBYE!");
    render(<MomentOverlay info={topInfo({ packed: true, packs: 1 })} />);
    expect(screen.getByTestId("hs-moment-text").className).toContain("text-xs");
  });
});
