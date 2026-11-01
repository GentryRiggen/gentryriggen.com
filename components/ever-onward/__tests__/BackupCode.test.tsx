import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { encodeBackup } from "@/lib/ever-onward/engine/backupCode";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave, writeSave } from "@/lib/ever-onward/engine/save";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import EverOnward from "../EverOnward";

function saveWith(completions: number): SaveData {
  return {
    ...newSave(),
    seenIntro: true,
    universes: {
      light: {
        run: { ...newRun(lightUniverse), taps: 1, time: 5 },
        best: null,
        completions,
        embers: 0,
        prestigeUpgrades: {},
      },
    },
  };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Continue/ }));
  await user.click(screen.getByRole("button", { name: "Menu" }));
}

beforeEach(() => {
  window.localStorage.clear();
  writeSave(saveWith(1));
});

describe("Ever Onward backup code", () => {
  it("copies the code to the clipboard and says so", async () => {
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, "writeText");
    render(<EverOnward />);
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Copy my code" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(encodeBackup(saveWith(1)));
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("shows a friendly error for a bad code and keeps the game", async () => {
    const user = userEvent.setup();
    render(<EverOnward />);
    await openMenu(user);
    await user.type(screen.getByLabelText("Load a code"), "nonsense");
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code didn't work"
    );
    expect(screen.queryByText(/replaces the game/)).not.toBeInTheDocument();
  });

  it("replaces the game after confirming a good code", async () => {
    const user = userEvent.setup();
    render(<EverOnward />);
    await openMenu(user);
    const code = encodeBackup(saveWith(7));
    await user.click(screen.getByLabelText("Load a code"));
    await user.paste(`${code.slice(0, 15)}\n${code.slice(15)}`);
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(
      screen.getByText("This replaces the game on this device. Continue?")
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Yes, replace my game" })
    );
    expect(await screen.findByText("Finished 7 times")).toBeInTheDocument();
    const stored = JSON.parse(
      window.localStorage.getItem("ever-onward:save") ?? "{}"
    );
    await waitFor(() => expect(stored.universes.light.completions).toBe(7));
  });
});
