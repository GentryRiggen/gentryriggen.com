import { act, render, screen, fireEvent } from "@testing-library/react";
import EndingOverlay from "../EndingOverlay";
import { useGameStore } from "@/lib/planet-smasher/store";

const mockLoad = jest.fn();
jest.mock("../../scene/planetTextures", () => ({
  loadPlanetTextures: (...args: unknown[]) => mockLoad(...args),
}));

beforeEach(() => {
  mockLoad.mockReset();
  mockLoad.mockResolvedValue({
    population: { w: 1, h: 1, weights: new Float32Array([1]) },
  });
});

describe("EndingOverlay", () => {
  it("shows nothing while playing", () => {
    act(() => useGameStore.setState({ phase: "playing", ending: null }));
    render(<EndingOverlay />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the emoji, the points and a New planet button once ended", async () => {
    const newPlanet = jest.fn();
    act(() =>
      useGameStore.setState({
        phase: "ended",
        ending: "frozen",
        planetPoints: 1234,
        newPlanet,
      })
    );
    render(<EndingOverlay />);
    expect(screen.getByTestId("ending-emoji")).toHaveTextContent("🧊");
    expect(screen.getByLabelText("1,234 points earned")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /new planet/i }));
    await act(async () => {});
    expect(newPlanet).toHaveBeenCalledTimes(1);
  });

  it("still starts a new planet when the textures fail to load", async () => {
    mockLoad.mockRejectedValue(new Error("offline"));
    const newPlanet = jest.fn();
    act(() =>
      useGameStore.setState({
        phase: "ended",
        ending: "shatter",
        planetPoints: 10,
        newPlanet,
      })
    );
    render(<EndingOverlay />);
    fireEvent.click(screen.getByRole("button", { name: /new planet/i }));
    await act(async () => {});
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(newPlanet).toHaveBeenCalledTimes(1);
  });
});
