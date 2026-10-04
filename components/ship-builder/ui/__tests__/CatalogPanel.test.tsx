import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PART_TYPES } from "@/lib/ship-builder/model/types";
import CatalogPanel from "../CatalogPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("CatalogPanel", () => {
  it("groups parts under category headings", () => {
    render(<CatalogPanel />);
    for (const heading of [
      "Decks",
      "Cabins",
      "Command",
      "Funnels",
      "Masts",
      "Lifeboat gear",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /Collapsible lifeboat/ })
    ).toBeInTheDocument();
  });

  it("shows an icon for every part", () => {
    render(<CatalogPanel />);
    expect(screen.getAllByTestId("part-icon")).toHaveLength(PART_TYPES.length);
  });

  it("selects a part and toggles it off on a second click", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const funnel = screen.getByRole("button", { name: /^Funnel/ });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "true");
    expect(useShipBuilderStore.getState().tool).toMatchObject({
      type: "funnel",
    });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "false");
    expect(useShipBuilderStore.getState().tool).toEqual({ kind: "none" });
  });

  it("calls onPick after selecting a part", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<CatalogPanel onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: /^Funnel/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
