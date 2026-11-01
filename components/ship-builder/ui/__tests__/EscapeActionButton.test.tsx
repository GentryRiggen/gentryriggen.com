import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  publishEscape,
  resetEscape,
} from "@/lib/ship-builder/state/escapeLive";
import { takeEscapeRequest } from "@/lib/ship-builder/state/escapeActions";
import EscapeActionButton from "../EscapeActionButton";

beforeEach(() => {
  act(() => resetEscape());
  takeEscapeRequest();
});

const aboard = { kind: "aboard" } as const;

describe("EscapeActionButton", () => {
  it("is hidden with nothing to board", () => {
    render(<EscapeActionButton />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reads Board for a davit and asks to board", async () => {
    render(<EscapeActionButton />);
    act(() =>
      publishEscape({
        phase: aboard,
        boardable: { boatId: "b", kind: "davit" },
        pickup: null,
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(takeEscapeRequest()).toBe("board");
  });

  it("reads Jump for a raft", () => {
    render(<EscapeActionButton />);
    act(() =>
      publishEscape({
        phase: aboard,
        boardable: { boatId: "r", kind: "raft" },
        pickup: null,
      })
    );
    expect(screen.getByRole("button", { name: "Jump" })).toBeTruthy();
  });

  it("reads Climb in for a pickup and asks to climb in", async () => {
    render(<EscapeActionButton />);
    act(() =>
      publishEscape({ phase: aboard, boardable: null, pickup: { boatId: "b" } })
    );
    await userEvent.click(screen.getByRole("button", { name: "Climb in" }));
    expect(takeEscapeRequest()).toBe("climb-in");
  });
});
