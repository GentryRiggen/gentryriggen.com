import { act, renderHook, waitFor } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave, SAVE_KEY } from "@/lib/ever-onward/engine/save";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { useGame } from "../useGame";

jest.mock("../../audio/everOnwardSynth", () => ({
  everOnwardSynth: { tap: jest.fn(), buy: jest.fn() },
}));

function saveWith(patch: (run: ReturnType<typeof newRun>) => void): SaveData {
  const save = newSave();
  const run = newRun(lightUniverse);
  patch(run);
  save.universes.light = {
    run,
    best: null,
    completions: 0,
    embers: 0,
    prestigeUpgrades: {},
  };
  return save;
}

async function openLight(stored?: SaveData) {
  window.localStorage.clear();
  if (stored) window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
  const hook = renderHook(() => useGame());
  await waitFor(() => expect(hook.result.current.save).not.toBeNull());
  act(() => hook.result.current.open("light"));
  return hook;
}

describe("when the phase intro shows", () => {
  it("shows the opening intro on a new game, until it is dismissed", async () => {
    const { result } = await openLight();
    expect(result.current.overlay).toBe("phase");
    act(() => result.current.dismissOverlay());
    expect(result.current.overlay).toBeNull();
  });

  it("does not ambush a save that is already mid-phase", async () => {
    const { result } = await openLight(
      saveWith((run) => {
        run.time = 600;
        run.taps = 80;
      })
    );
    expect(result.current.overlay).toBeNull();
  });

  it("does not repeat an intro the player already passed", async () => {
    const { result } = await openLight(
      saveWith((run) => {
        run.time = 900;
        run.taps = 120;
        run.phase = 1;
        run.transitions.push({ from: "coast", to: "night", at: 800 });
      })
    );
    expect(result.current.overlay).toBeNull();
  });
});
