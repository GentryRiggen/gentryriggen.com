import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  REGIONS,
  isFlockReady,
  sendActionId,
} from "@/lib/ever-onward/universes/grow/migration";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import SeedMigration from "../SeedMigration";

function openRun(): RunState {
  const base = newRun(def);
  return tick(
    def,
    { ...base, phase: 2, owned: { windbreak: 4, "planting-rover": 1 } },
    0.1
  );
}

function readyRun(): RunState {
  let run = openRun();
  for (let t = 0; t < 400 && !isFlockReady(run); t += 1)
    run = tick(def, run, 1);
  return run;
}

describe("SeedMigration", () => {
  it("renders nothing before the migration opens", () => {
    const { container } = render(
      <SeedMigration def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group whose choices say they are off, never disabled, while the flock gathers", async () => {
    const onAct = jest.fn();
    render(<SeedMigration def={def} run={openRun()} onAct={onAct} />);
    expect(screen.getByTestId("lm-migration")).toHaveAttribute(
      "data-stage",
      "gathering"
    );
    expect(
      screen.getByRole("radiogroup", { name: "Where to send the flock" })
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(REGIONS.length);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).not.toBeDisabled();
    }
    await userEvent.click(radios[0]);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("shows the welcome before sending and calls onAct with migration-send-<n>", async () => {
    const onAct = jest.fn();
    render(<SeedMigration def={def} run={readyRun()} onAct={onAct} />);
    expect(screen.getByTestId("lm-migration")).toHaveAttribute(
      "data-stage",
      "ready"
    );
    expect(screen.getByTestId("lm-migration-welcome-0")).toHaveTextContent(
      /About \+[\d.]+K? green \(\d+% welcome\)/
    );
    const radio = screen.getByRole("radio", {
      name: "Send the flock to Rocky Coast",
    });
    expect(radio).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(radio);
    expect(onAct).toHaveBeenCalledWith(sendActionId(3));
  });

  it("keeps one tab stop and moves it with the arrow keys, without sending", async () => {
    const onAct = jest.fn();
    render(<SeedMigration def={def} run={readyRun()} onAct={onAct} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    const first = radios.find((r) => r.tabIndex === 0) as HTMLElement;
    act(() => first.focus());
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).not.toBe(first);
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(radios[radios.length - 1]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(radios[0]);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("keeps the buttons mounted when the flock lands", () => {
    const sent = performAction(def, readyRun(), sendActionId(0));
    const { rerender } = render(
      <SeedMigration def={def} run={sent} onAct={jest.fn()} />
    );
    const before = screen.getAllByRole("radio");
    let run = sent;
    for (let t = 0; t < 12; t += 1) run = tick(def, run, 1);
    rerender(<SeedMigration def={def} run={run} onAct={jest.fn()} />);
    screen.getAllByRole("radio").forEach((el, i) => expect(el).toBe(before[i]));
  });

  it("marks the destination as checked while the flock flies", () => {
    const sent = performAction(def, readyRun(), sendActionId(2));
    render(<SeedMigration def={def} run={sent} onAct={jest.fn()} />);
    expect(
      screen.getByRole("radio", { name: "Send the flock to Salt Marsh" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("announces a kind result in a status region once a flock lands", () => {
    let run = performAction(def, readyRun(), sendActionId(0));
    for (let t = 0; t < 12; t += 1) run = tick(def, run, 1);
    render(<SeedMigration def={def} run={run} onAct={jest.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-testid", "lm-migration-result");
    expect(status.textContent).toMatch(/flock landed on Dry Plains/);
    expect(status.textContent).not.toMatch(/lose|lost|fail|wrong|bad/i);
  });
});
