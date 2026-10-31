import { act } from "react";
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import useSeaState, { getSeaState } from "../../hooks/useSeaState";
import useTimeOfDay, { getTimeOfDay } from "../../hooks/useTimeOfDay";
import { getTrialChoices } from "../../hooks/useTrialChoices";
import IcebergAimHint from "../IcebergAimHint";
import SeaTrialButton, { SEA_TRIAL_BUTTON_ID } from "../SeaTrialButton";
import TrialSetupCard from "../TrialSetupCard";

const store = () => useShipBuilderStore.getState();

function ShortcutsHost() {
  useKeyboardShortcuts();
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("ship-builder:ui:sea", "choppy");
  window.localStorage.setItem("ship-builder:ui:time", "day");
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});

function running(): Extract<TrialSlice, { status: "running" }> {
  const { trial } = store();
  if (trial.status !== "running") throw new Error("no trial is running");
  return trial;
}

function row(name: string) {
  return screen.getByRole("group", { name });
}

function pressed(name: string): string[] {
  return within(row(name))
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent ?? "");
}

async function pickFromMenu(item: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Sea trial" }));
  await user.click(screen.getByRole("menuitem", { name: item }));
  return user;
}

function renderSlot() {
  return render(
    <>
      <ShortcutsHost />
      <SeaTrialButton />
      <TrialSetupCard />
      <IcebergAimHint />
    </>
  );
}

describe("TrialSetupCard", () => {
  it("is hidden unless a card is open", () => {
    const { container } = render(<TrialSetupCard />);
    expect(container).toBeEmptyDOMElement();
    act(() => store().aimIceberg());
    expect(container).toBeEmptyDOMElement();
  });

  it("Waves shows Sea and Time, each option with an icon and a word", async () => {
    renderSlot();
    await pickFromMenu("Waves");
    expect(screen.getByRole("heading", { name: "Waves" })).toBeInTheDocument();
    expect(
      within(row("Sea"))
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Calm", "Choppy", "Stormy"]);
    expect(
      within(row("Time"))
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Day", "Sunset", "Night"]);
    for (const button of within(row("Sea")).getAllByRole("button")) {
      expect(button.querySelector("svg")).not.toBeNull();
    }
    expect(screen.queryByRole("group", { name: "Lifeboats" })).toBeNull();
    expect(pressed("Sea")).toEqual(["Choppy"]);
    expect(pressed("Time")).toEqual(["Day"]);
    expect(screen.getByRole("button", { name: "Go!" })).toHaveFocus();
  });

  it("Waves: picking Stormy and Night previews them, is remembered, and Go uses them", async () => {
    renderSlot();
    const user = await pickFromMenu("Waves");
    const look = renderHook(() => ({
      sea: useSeaState().seaState,
      time: useTimeOfDay().timeOfDay,
    }));
    await user.click(
      within(row("Sea")).getByRole("button", { name: "Stormy" })
    );
    await user.click(
      within(row("Time")).getByRole("button", { name: "Night" })
    );
    expect(store().trial).toMatchObject({
      status: "setup",
      look: { sea: "stormy", time: "night" },
    });
    expect(look.result.current).toEqual({ sea: "stormy", time: "night" });
    expect(getTrialChoices().waveSea).toBe("stormy");

    await user.click(screen.getByRole("button", { name: "Go!" }));
    const trial = running();
    expect(trial.input.sea).toBe("stormy");
    expect(trial.look.time).toBe("night");
    expect(screen.queryByRole("button", { name: "Go!" })).toBeNull();
  });

  it("Storm shows Time, Lifeboats and How she breaks, and Go starts the storm", async () => {
    renderSlot();
    const user = await pickFromMenu("Shipwreck storm");
    expect(
      screen.getByRole("heading", { name: "Shipwreck storm" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Sea" })).toBeNull();
    expect(
      within(row("Lifeboats"))
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Like the Titanic", "Fill every seat"]);
    expect(pressed("Lifeboats")).toEqual(["Fill every seat"]);
    expect(row("How she breaks")).toBeInTheDocument();

    await user.click(
      within(row("Lifeboats")).getByRole("button", { name: "Like the Titanic" })
    );
    await user.click(
      within(row("How she breaks")).getByRole("button", { name: "Break her" })
    );
    await user.click(
      within(row("Time")).getByRole("button", { name: "Sunset" })
    );
    await user.click(screen.getByRole("button", { name: "Go!" }));
    const trial = running();
    expect(trial.input.storm).toMatchObject({ breakMode: "always" });
    expect(trial.input.sea).toBe("wild");
    expect(trial.input.lifeboats).toBe("titanic");
    expect(trial.look).toEqual({ sea: "wild", time: "sunset" });
  });

  it("cancel restores main look", async () => {
    renderSlot();
    const user = await pickFromMenu("Waves");
    const look = renderHook(() => ({
      sea: useSeaState().seaState,
      time: useTimeOfDay().timeOfDay,
    }));
    await user.click(
      within(row("Sea")).getByRole("button", { name: "Stormy" })
    );
    await user.click(
      within(row("Time")).getByRole("button", { name: "Night" })
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store().trial).toEqual({ status: "idle" });
    expect(look.result.current).toEqual({ sea: "choppy", time: "day" });
    expect(getSeaState()).toBe("choppy");
    expect(getTimeOfDay()).toBe("day");
    await waitFor(() =>
      expect(document.getElementById(SEA_TRIAL_BUTTON_ID)).toHaveFocus()
    );
  });

  it("Esc cancels the card and hands focus back to the Sea trial button", async () => {
    renderSlot();
    const user = await pickFromMenu("Shipwreck storm");
    await user.keyboard("{Escape}");
    expect(store().trial).toEqual({ status: "idle" });
    await waitFor(() =>
      expect(document.getElementById(SEA_TRIAL_BUTTON_ID)).toHaveFocus()
    );
  });

  it("arrows move inside a row and Tab moves between rows", async () => {
    renderSlot();
    const user = await pickFromMenu("Waves");
    const choppy = within(row("Sea")).getByRole("button", { name: "Choppy" });
    choppy.focus();
    await user.keyboard("{ArrowRight}");
    const stormy = within(row("Sea")).getByRole("button", { name: "Stormy" });
    expect(stormy).toHaveFocus();
    expect(store().trial).toMatchObject({ look: { sea: "stormy" } });
    await user.keyboard("{ArrowRight}");
    expect(
      within(row("Sea")).getByRole("button", { name: "Calm" })
    ).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(stormy).toHaveFocus();
    // Only the picked option of a row is a Tab stop.
    await user.tab();
    expect(
      within(row("Time")).getByRole("button", { name: "Day" })
    ).toHaveFocus();
  });
});

describe("the iceberg aim card", () => {
  it("adds Time and Lifeboats rows beside the break switch", async () => {
    renderSlot();
    const user = await pickFromMenu("Iceberg");
    expect(row("Time")).toBeInTheDocument();
    expect(row("Lifeboats")).toBeInTheDocument();
    expect(row("How she breaks")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Sea" })).toBeNull();
    expect(screen.getByText("Tap where the iceberg hits")).toBeInTheDocument();

    await user.click(
      within(row("Time")).getByRole("button", { name: "Night" })
    );
    await user.click(
      within(row("Lifeboats")).getByRole("button", { name: "Like the Titanic" })
    );
    // Striking (the hull tap) keeps the chosen time.
    act(() => store().startTrial("choppy", 4));
    const trial = running();
    expect(trial.look.time).toBe("night");
    expect(trial.input.lifeboats).toBe("titanic");
  });
});
