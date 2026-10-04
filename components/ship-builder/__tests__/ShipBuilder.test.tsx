import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShipBuilder from "../ShipBuilder";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

jest.mock(
  "next/dynamic",
  () => () =>
    function Scene() {
      return null;
    }
);
jest.mock("@/components/ThemeToggle", () => () => null);
jest.mock("../hooks/useWebGLSupport", () => () => true);
jest.mock("../hooks/useShipPersistence", () => () => undefined);
jest.mock("../hooks/useTestHook", () => () => undefined);

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("ShipBuilder drawers", () => {
  it("opens one drawer at a time", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    const parts = screen.getByRole("button", { name: "Parts" });
    const stats = screen.getByRole("button", { name: "Stats" });

    await user.click(parts);
    expect(parts).toHaveAttribute("aria-expanded", "true");

    await user.click(stats);
    expect(stats).toHaveAttribute("aria-expanded", "true");
    expect(parts).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the open drawer when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    expect(screen.queryByTestId("drawer-backdrop")).toBeNull();

    const parts = screen.getByRole("button", { name: "Parts" });
    await user.click(parts);
    const backdrop = screen.getByTestId("drawer-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    await user.click(backdrop);
    expect(parts).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("drawer-backdrop")).toBeNull();
  });
});
