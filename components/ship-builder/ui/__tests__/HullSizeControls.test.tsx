import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HullSizeControls from "../HullSizeControls";
import {
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
} from "@/lib/ship-builder/model/grid";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const hull = () => useShipBuilderStore.getState().ship.hull;

function setHullSize(lengthSegments: number, beam: number) {
  act(() =>
    useShipBuilderStore.setState((state) => ({
      ship: {
        ...state.ship,
        hull: { ...state.ship.hull, lengthSegments, beam },
      },
    }))
  );
}

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("HullSizeControls", () => {
  it("shows the current length and width", () => {
    render(<HullSizeControls />);
    expect(screen.getByTestId("hull-length")).toHaveTextContent(
      `${hull().lengthSegments} segments`
    );
    expect(screen.getByTestId("beam-width")).toHaveTextContent(
      `${hull().beam} wide`
    );
  });

  it("lengthens, shortens, widens and narrows the hull", async () => {
    const user = userEvent.setup();
    render(<HullSizeControls />);
    const { lengthSegments, beam } = hull();
    await user.click(screen.getByRole("button", { name: "Lengthen hull" }));
    await user.click(screen.getByRole("button", { name: "Wider" }));
    expect(hull()).toMatchObject({
      lengthSegments: lengthSegments + 1,
      beam: beam + 1,
    });
    expect(screen.getByTestId("hull-length")).toHaveTextContent(
      `${lengthSegments + 1} segments`
    );
    await user.click(screen.getByRole("button", { name: "Shorten hull" }));
    await user.click(screen.getByRole("button", { name: "Narrower" }));
    expect(hull()).toMatchObject({ lengthSegments, beam });
  });

  it("disables each button at its limit", () => {
    render(<HullSizeControls />);
    setHullSize(MIN_SEGMENTS, MIN_BEAM);
    expect(screen.getByRole("button", { name: "Shorten hull" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Narrower" })).toBeDisabled();
    setHullSize(MAX_SEGMENTS, MAX_BEAM);
    expect(
      screen.getByRole("button", { name: "Lengthen hull" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wider" })).toBeDisabled();
  });
});
