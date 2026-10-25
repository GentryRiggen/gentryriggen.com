import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
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

describe("FunnelStylePanel undo", () => {
  it("shows the previous letters after Undo", async () => {
    const user = userEvent.setup();
    act(() => store().select("f1"));
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Letters" }));
    const input = screen.getByLabelText("Letters");
    await user.type(input, "A");
    await user.type(input, "B");
    expect(input).toHaveValue("AB");
    act(() => store().undo());
    expect(screen.getByLabelText("Letters")).toHaveValue("A");
  });

  it("does not commit when Letters or Logo is chosen with nothing to set", async () => {
    const user = userEvent.setup();
    act(() => store().select("f1"));
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    const before = store().past.length;
    await user.click(screen.getByRole("button", { name: "Letters" }));
    await user.click(screen.getByRole("button", { name: "Logo" }));
    expect(store().past).toHaveLength(before);
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

function Shortcuts() {
  useKeyboardShortcuts();
  return null;
}

describe("FunnelStylePanel with a stored mark", () => {
  it("keeps the Letters box (and focus) when the last letter is cleared", async () => {
    const user = userEvent.setup();
    act(() => {
      store().select("f1");
      store().setFunnelMark("f1", {
        kind: "letters",
        text: "WS",
        color: "white",
      });
    });
    render(<FunnelStylePanel partId="f1" onClose={jest.fn()} />);
    const input = screen.getByLabelText("Letters", { selector: "input" });
    await user.click(input);
    await user.keyboard("{Backspace}{Backspace}");
    expect(markOf("f1")).toBeUndefined();
    const after = screen.getByLabelText("Letters", { selector: "input" });
    expect(after).toBe(input);
    expect(after).toHaveFocus();
  });
});

describe("SelectionBar Style panel lifecycle", () => {
  it("starts closed when a funnel is selected again", async () => {
    const user = userEvent.setup();
    act(() => store().select("f1"));
    render(<SelectionBar />);
    await user.click(screen.getByRole("button", { name: "Style" }));
    expect(screen.getByText("Funnel style")).toBeVisible();
    act(() => store().select("f2"));
    expect(screen.queryByText("Funnel style")).toBeNull();
    act(() => store().select("f1"));
    expect(screen.queryByText("Funnel style")).toBeNull();
  });

  it("Escape closes only the panel and keeps the part selected", async () => {
    const user = userEvent.setup();
    act(() => store().select("f1"));
    render(
      <>
        <Shortcuts />
        <SelectionBar />
      </>
    );
    await user.click(screen.getByRole("button", { name: "Style" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Funnel style")).toBeNull();
    expect(store().selectedId).toBe("f1");
    await user.keyboard("{Escape}");
    expect(store().selectedId).toBeNull();
  });

  it("Undo keeps the part selected while it still exists", async () => {
    const user = userEvent.setup();
    act(() => {
      store().select("f1");
      store().setFunnelMark("f1", {
        kind: "logo",
        logo: "anchor",
        color: "white",
      });
    });
    render(<SelectionBar />);
    await user.click(screen.getByRole("button", { name: "Style" }));
    act(() => store().undo());
    expect(store().selectedId).toBe("f1");
    expect(screen.getByText("Funnel style")).toBeVisible();
  });
});
