import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FunnelStylePanel from "../FunnelStylePanel";
import SelectionBar from "../SelectionBar";
import type { PlacedPart } from "@/lib/ship-builder/model/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

function part(id: string, type: PlacedPart["type"], x: number): PlacedPart {
  return {
    id,
    type,
    anchor: { kind: "grid", level: 1, x, z: 0 },
    rotation: 0,
  };
}

beforeEach(() => {
  act(() => {
    const initial = createInitialState();
    useShipBuilderStore.setState({
      ...initial,
      ship: {
        ...initial.ship,
        parts: [
          part("f1", "funnel", 1),
          part("f2", "funnel-modern", 3),
          part("m1", "mast", 5),
        ],
      },
    });
  });
});

const markOf = (id: string) =>
  store().ship.parts.find((p) => p.id === id)?.mark;

describe("FunnelStylePanel", () => {
  beforeEach(() => {
    act(() => store().select("f1"));
  });

  it("paints a funnel area ship-wide", async () => {
    const user = userEvent.setup();
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    expect(screen.getByText("Colours for every funnel")).toBeVisible();
    const body = screen.getByRole("group", { name: "Body" });
    await user.click(within(body).getByRole("button", { name: "Red" }));
    expect(store().ship.funnelPaint?.body).toBe("red");
    expect(within(body).getByRole("button", { name: "Red" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(body).getByRole("button", { name: "Default" }));
    expect(store().ship.funnelPaint).toBeUndefined();
  });

  it("sets letters through normalizeMarkText and clears when empty", async () => {
    const user = userEvent.setup();
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Letters" }));
    const input = screen.getByLabelText("Letters", { selector: "input" });
    await user.type(input, "w$s");
    expect(input).toHaveValue("WS");
    expect(markOf("f1")).toEqual({
      kind: "letters",
      text: "WS",
      color: "white",
    });
    await user.clear(input);
    expect(markOf("f1")).toBeUndefined();
  });

  it("picks a logo and None removes the mark", async () => {
    const user = userEvent.setup();
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Logo" }));
    await user.click(screen.getByRole("button", { name: "Anchor" }));
    expect(markOf("f1")).toMatchObject({ kind: "logo", logo: "anchor" });
    await user.click(screen.getByRole("button", { name: "None" }));
    expect(markOf("f1")).toBeUndefined();
  });

  it("notes that modern funnels have no bands", () => {
    act(() => store().select("f2"));
    const { unmount } = render(
      <FunnelStylePanel partId="f2" onClose={jest.fn()} />
    );
    expect(screen.getByText("Modern funnels have no bands")).toBeVisible();
    unmount();
    act(() => store().select("f1"));
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    expect(screen.queryByText("Modern funnels have no bands")).toBeNull();
  });

  it("closes on Escape and the Close button", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<FunnelStylePanel partId="f1" onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("FunnelStylePanel auto-close", () => {
  it("closes when the selection changes", () => {
    const onClose = jest.fn();
    act(() => store().select("f1"));
    render(<FunnelStylePanel partId="f1" onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    act(() => store().select("f2"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SelectionBar Style button", () => {
  it("shows for a funnel and opens the panel", async () => {
    const user = userEvent.setup();
    act(() => store().select("f1"));
    render(<SelectionBar />);
    await user.click(screen.getByRole("button", { name: "Style" }));
    expect(screen.getByText("Funnel style")).toBeVisible();
  });

  it("is absent for a mast", () => {
    act(() => store().select("m1"));
    render(<SelectionBar />);
    expect(screen.queryByRole("button", { name: "Style" })).toBeNull();
  });
});
