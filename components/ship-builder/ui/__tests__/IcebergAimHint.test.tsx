import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import IcebergAimHint from "../IcebergAimHint";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("IcebergAimHint", () => {
  it("is hidden unless the player is aiming", () => {
    const { container } = render(<IcebergAimHint />);
    expect(container).toBeEmptyDOMElement();
    act(() => store().startTrial("calm"));
    expect(container).toBeEmptyDOMElement();
  });

  it("tells the player where to tap and Cancel goes back to building", async () => {
    const user = userEvent.setup();
    render(<IcebergAimHint />);
    act(() => store().aimIceberg());
    expect(screen.getByText("Tap where the iceberg hits")).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();

    await user.click(cancel);
    expect(store().trial.status).toBe("idle");
    expect(screen.queryByText("Tap where the iceberg hits")).toBeNull();
  });

  it("Escape cancels", async () => {
    const user = userEvent.setup();
    render(<IcebergAimHint />);
    act(() => store().aimIceberg());
    await user.keyboard("{Escape}");
    expect(store().trial.status).toBe("idle");
  });
});
