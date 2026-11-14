import { render, screen } from "@testing-library/react";
import PlanetSmasher from "../PlanetSmasher";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";

jest.mock(
  "next/dynamic",
  () => () =>
    function Stage() {
      return <div data-testid="planet-stage" />;
    }
);
jest.mock("@/components/ship-builder/hooks/useWebGLSupport", () => jest.fn());
jest.mock("../scene/planetTextures", () => ({
  loadPlanetTextures: () =>
    Promise.resolve({
      id: "earth",
      day: document.createElement("canvas"),
      night: null,
      population: {
        w: 2,
        h: 1,
        weights: new Float32Array([0.5, 0.5]),
      },
    }),
}));

const mockWebgl = useWebGLSupport as jest.Mock;

describe("PlanetSmasher", () => {
  it("shows a friendly message without WebGL", () => {
    mockWebgl.mockReturnValue(false);
    render(<PlanetSmasher />);
    expect(screen.getByText(/can't show 3D/i)).toBeInTheDocument();
    expect(screen.queryByTestId("planet-stage")).toBeNull();
  });
  it("renders the stage with WebGL", async () => {
    mockWebgl.mockReturnValue(true);
    render(<PlanetSmasher />);
    expect(await screen.findByTestId("planet-stage")).toBeInTheDocument();
  });
});
