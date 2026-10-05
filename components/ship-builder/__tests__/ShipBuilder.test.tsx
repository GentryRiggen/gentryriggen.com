import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShipBuilder from "../ShipBuilder";
import { SHIP_BUILDER_VERSION } from "@/lib/ship-builder/version";
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

  it("closes the Parts drawer after picking a part", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    const parts = screen.getByRole("button", { name: "Parts" });
    await user.click(parts);
    expect(parts).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: /^Funnel/ }));
    expect(parts).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the Stats drawer open when a part is picked", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    const stats = screen.getByRole("button", { name: "Stats" });
    await user.click(stats);
    await user.click(screen.getByRole("button", { name: /^Funnel/ }));
    expect(stats).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ShipBuilder collapsible panels", () => {
  afterEach(() => window.localStorage.clear());

  it("collapses and re-expands the Parts panel only", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    await user.click(screen.getByRole("button", { name: "Collapse Parts" }));
    expect(
      screen.getByRole("button", { name: "Expand Parts" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Stats" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand Parts" }));
    expect(
      screen.getByRole("button", { name: "Collapse Parts" })
    ).toBeInTheDocument();
  });
});

describe("ShipBuilder shell", () => {
  it("disables text selection and the touch callout app-wide", () => {
    const { container } = render(<ShipBuilder />);
    expect(container.firstElementChild).toHaveClass(
      "select-none",
      "[-webkit-touch-callout:none]"
    );
  });

  it("keeps the ship name input selectable and editable", async () => {
    const user = userEvent.setup();
    render(<ShipBuilder />);
    const input = screen.getByRole("textbox", { name: "Ship name" });
    expect(input).not.toHaveClass("select-none");
    expect(input).toHaveClass("select-text");
    await user.clear(input);
    await user.type(input, "Sea Dog");
    expect(input).toHaveValue("Sea Dog");
  });
});

describe("ShipBuilder version", () => {
  it("shows the app version beside the title", () => {
    render(<ShipBuilder />);
    expect(screen.getByRole("heading", { name: "Ship Builder" })).toBeVisible();
    expect(screen.getByTestId("app-version")).toHaveTextContent(
      `v${SHIP_BUILDER_VERSION}`
    );
  });
});

describe("ShipBuilder focus mode", () => {
  it("clears the chrome while a trial runs and brings it back after", () => {
    render(<ShipBuilder />);
    expect(screen.getByRole("group", { name: "Camera" })).toBeVisible();
    act(() => useShipBuilderStore.getState().startTrial("calm", 12));
    expect(screen.queryByRole("group", { name: "Camera" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Parts" })).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    act(() => useShipBuilderStore.getState().endTrial());
    expect(screen.getByRole("group", { name: "Camera" })).toBeVisible();
  });

  it("keeps the chrome while the player is aiming an iceberg", () => {
    render(<ShipBuilder />);
    act(() => useShipBuilderStore.getState().aimIceberg());
    expect(useShipBuilderStore.getState().trial.status).toBe("aiming");
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("button", { name: "Parts" })).toBeVisible();
  });

  it("keeps the drawers mounted so their state survives a trial", () => {
    render(<ShipBuilder />);
    const parts = screen.getByRole("button", { name: "Parts" });
    act(() => useShipBuilderStore.getState().startTrial("calm", 12));
    expect(screen.queryByRole("button", { name: "Parts" })).toBeNull();
    act(() => useShipBuilderStore.getState().endTrial());
    expect(screen.getByRole("button", { name: "Parts" })).toBe(parts);
  });
});
