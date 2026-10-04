import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gridPart } from "@/lib/ship-builder/testing";
import ShareButton from "../ShareButton";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const TOO_BIG_NOTICE =
  "This ship is too big to share — save it to My Ships instead";

describe("ShareButton", () => {
  beforeEach(() => {
    act(() => useShipBuilderStore.setState(createInitialState()));
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  it("copies the link and shows it", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ShareButton />);
    // userEvent.setup() installs its own clipboard stub, so override it afterwards.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    const input = screen.getByLabelText("Share link URL") as HTMLInputElement;
    expect(input.value).toMatch(/\/ship-builder#ship=/);
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(
      await screen.findByText("Link copied to clipboard")
    ).toBeInTheDocument();
  });

  it("still shows the link without clipboard access", async () => {
    const user = userEvent.setup();
    render(<ShareButton />);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(
      await screen.findByText("Copy this link to share your ship")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Share link URL")).toHaveFocus();
  });

  it("closes on Escape and returns focus to Share", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ShareButton />);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const share = screen.getByRole("button", { name: "Share" });
    await user.click(share);
    await screen.findByText("Link copied to clipboard");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Share link" })).toBeNull();
    expect(share).toHaveFocus();
  });

  it("closes when the ship changes", async () => {
    const user = userEvent.setup();
    render(<ShareButton />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("dialog", { name: "Share link" })).toBeVisible();
    act(() => useShipBuilderStore.getState().rename("Renamed"));
    expect(screen.queryByRole("dialog", { name: "Share link" })).toBeNull();
  });

  it("closes on a pointer press outside, but not inside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <ShareButton />
      </>
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByLabelText("Share link URL"));
    expect(screen.getByRole("dialog", { name: "Share link" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog", { name: "Share link" })).toBeNull();
  });

  it("explains when the ship is too big to share instead of copying", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ShareButton />);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const parts = Array.from({ length: 3000 }, (_, i) =>
      gridPart(
        `p-${Math.random().toString(36).slice(2)}${i}`,
        "deck-1x1",
        0,
        i,
        0
      )
    );
    act(() =>
      useShipBuilderStore.setState({
        ship: { ...useShipBuilderStore.getState().ship, parts },
      })
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(useShipBuilderStore.getState().notice?.text).toBe(TOO_BIG_NOTICE);
    expect(screen.queryByRole("dialog", { name: "Share link" })).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });
});
