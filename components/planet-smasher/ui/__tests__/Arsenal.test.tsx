import { act, fireEvent, render, screen } from "@testing-library/react";
import Arsenal from "../Arsenal";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";
import {
  CATEGORIES,
  TOOLS,
  TOOL_ORDER,
  type ToolId,
} from "@/lib/planet-smasher/tools";
import { markFresh, resetFresh } from "../freshItems";

function setProgress(patch: Partial<ReturnType<typeof freshProgress>>) {
  act(() => {
    useGameStore.setState({ progress: { ...freshProgress(), ...patch } });
    resetFresh();
  });
}
const setPoints = (points: number) => setProgress({ points });

const tab = (name: string) => screen.getByRole("tab", { name });
const tileNames = () =>
  screen
    .getAllByTestId("arsenal-tile")
    .map((t) => t.getAttribute("aria-label"));

describe("Arsenal tabs", () => {
  it("renders four category tabs", () => {
    setPoints(0);
    render(<Arsenal />);
    expect(
      screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"))
    ).toEqual(["Space", "Bombs", "Nature", "Aliens"]);
  });

  it("every tool belongs to exactly one category", () => {
    for (const id of TOOL_ORDER) {
      const homes = CATEGORIES.filter((c) => c.tools.includes(id));
      expect(homes).toHaveLength(1);
      expect(homes[0].id).toBe(TOOLS[id].category);
    }
    expect(CATEGORIES.flatMap((c) => c.tools)).toHaveLength(TOOL_ORDER.length);
  });

  it("starts on the Space tab with the asteroid first and open", () => {
    setPoints(0);
    render(<Arsenal />);
    expect(tileNames()[0]).toBe("Asteroid");
    expect(tileNames()).toHaveLength(6);
    expect(
      screen.getByRole("button", { name: "Asteroid" })
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("⭐ 25")).toBeInTheDocument();
  });

  it("shows only the Bombs tools on the Bombs tab", () => {
    setPoints(0);
    render(<Arsenal />);
    fireEvent.click(tab("Bombs"));
    expect(tileNames()).toEqual([
      "Mega bomb",
      "Nuke",
      "Twin nuke",
      "Nuke rain",
    ]);
  });

  it("opens the tab of a restored tool", () => {
    setProgress({ points: 100000, toolId: "ufoSwarm" });
    render(<Arsenal />);
    expect(tab("Aliens")).toHaveAttribute("aria-selected", "true");
    expect(tileNames()).toContain("UFO swarm");
  });

  it("follows the tool when it is selected from elsewhere", () => {
    setPoints(109000);
    render(<Arsenal />);
    act(() => useGameStore.getState().selectTool("nuke" as ToolId));
    expect(tab("Bombs")).toHaveAttribute("aria-selected", "true");
  });

  it("switches back to Space and shows the asteroid first", () => {
    setProgress({ points: 100000, toolId: "ufoSwarm" });
    render(<Arsenal />);
    fireEvent.click(tab("Space"));
    expect(tileNames()[0]).toBe("Asteroid");
  });

  it("keeps the selected tool when only the tab changes", () => {
    setProgress({ points: 100000, toolId: "ufoSwarm" });
    render(<Arsenal />);
    fireEvent.click(tab("Bombs"));
    expect(useGameStore.getState().progress.toolId).toBe("ufoSwarm");
  });

  it("dots a tab holding a fresh unlock", () => {
    setPoints(100000);
    render(<Arsenal />);
    expect(screen.queryByTestId("tab-dot-aliens")).toBeNull();
    act(() => markFresh([{ kind: "tool", id: "mothership" }]));
    expect(screen.getByTestId("tab-dot-aliens")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-dot-space")).toBeNull();
  });

  it("jumps to the tab of an unlocked tool", () => {
    setPoints(100000);
    render(<Arsenal />);
    act(() =>
      useGameStore.setState({
        lastUnlocks: [{ kind: "tool", id: "tsunami" }],
      })
    );
    expect(tab("Nature")).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a tap on a locked tile", () => {
    setPoints(0);
    render(<Arsenal />);
    fireEvent.click(tab("Bombs"));
    fireEvent.click(screen.getByRole("button", { name: "Nuke" }));
    expect(useGameStore.getState().progress.toolId).toBe("asteroid");
  });

  it("opens the supervolcano at 10,800 points and selects it", () => {
    setPoints(10800);
    render(<Arsenal />);
    fireEvent.click(tab("Nature"));
    const tile = screen.getByRole("button", { name: "Supervolcano" });
    expect(tile).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tile);
    expect(useGameStore.getState().progress.toolId).toBe("supervolcano");
  });

  it("shows the Twin nuke's radiation sign twice", () => {
    setPoints(0);
    render(<Arsenal />);
    fireEvent.click(tab("Bombs"));
    const tile = screen.getByRole("button", { name: "Twin nuke" });
    expect(tile.textContent?.match(/☢️/g)).toHaveLength(2);
  });

  it("writes locked progress into a ring", () => {
    setPoints(0);
    render(<Arsenal />);
    fireEvent.click(tab("Bombs"));
    const tile = screen.getByRole("button", { name: "Nuke" });
    expect(tile.style.getPropertyValue("--ps-prog")).toMatch(/deg$/);
  });
});
