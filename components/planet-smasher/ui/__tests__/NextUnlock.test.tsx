import { act, render, screen } from "@testing-library/react";
import NextUnlock from "../NextUnlock";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";
import { TOOLS } from "@/lib/planet-smasher/tools";
import { UNLOCK_PATH, nextUnlock } from "@/lib/planet-smasher/unlocks";

function setPoints(points: number) {
  act(() => {
    useGameStore.setState({ progress: { ...freshProgress(), points } });
  });
}

describe("NextUnlock", () => {
  it("shows the next item as a silhouette with stars and a bar", () => {
    setPoints(100);
    const next = nextUnlock(100)!;
    render(<NextUnlock />);
    expect(screen.getByText(`⭐ 100 / ${next.at}`)).toBeInTheDocument();
    const icon = screen.getByTestId("next-unlock-icon");
    expect(icon).toHaveTextContent(
      next.item.kind === "tool" ? TOOLS[next.item.id].icon : /./
    );
    expect(icon.className).toContain("brightness-0");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });

  it("groups thousands", () => {
    const entry = UNLOCK_PATH.find((e) => e.at >= 1000)!;
    setPoints(entry.at - 1);
    render(<NextUnlock />);
    expect(
      screen.getByText(
        `⭐ ${(entry.at - 1).toLocaleString("en-US")} / ${entry.at.toLocaleString("en-US")}`
      )
    ).toBeInTheDocument();
  });

  it("says All unlocked! at the end of the path", () => {
    setPoints(UNLOCK_PATH.at(-1)!.at + 1000);
    render(<NextUnlock />);
    expect(screen.getByText("All unlocked!")).toBeInTheDocument();
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });
});
