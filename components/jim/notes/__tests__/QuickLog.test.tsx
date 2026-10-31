import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickLog, {
  injectionSentence,
  todoSentence,
  workoutSentence,
} from "../QuickLog";

const TODAY = "2026-10-31";

describe("sentences", () => {
  it("logs an injection today or on another day", () => {
    expect(
      injectionSentence(
        { dose: "100 mg", site: "left glute", date: TODAY },
        TODAY
      )
    ).toBe("Log my injection today: 100 mg, left glute.");
    expect(
      injectionSentence(
        { dose: " 100 mg. ", site: "", date: "2026-10-30" },
        TODAY
      )
    ).toBe("Log my injection on 2026-10-30: 100 mg.");
  });

  it("logs a workout", () => {
    expect(workoutSentence("5k run, 26:10.")).toBe(
      "Log my workout today: 5k run, 26:10."
    );
  });

  it("adds a todo with or without a date", () => {
    expect(
      todoSentence({ text: "Call the vet", due: "2026-11-04", area: "work" })
    ).toBe("Add a todo: Call the vet, due 2026-11-04, work.");
    expect(
      todoSentence({ text: "Call the vet.", due: "", area: "personal" })
    ).toBe("Add a todo: Call the vet, personal.");
  });
});

function renderLog() {
  const onLog = jest.fn();
  render(<QuickLog today={TODAY} onLog={onLog} />);
  return onLog;
}

it("opens a focused sheet, closes on Escape and returns focus", async () => {
  renderLog();
  const opener = screen.getByRole("button", { name: "Log injection" });
  await userEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Log injection" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.getByLabelText("Dose")).toHaveFocus();
  expect(screen.getByLabelText("Date")).toHaveValue(TODAY);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(opener).toHaveFocus();
});

it("closes when the backdrop is tapped", async () => {
  renderLog();
  await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
  await userEvent.click(screen.getByTestId("quicklog-backdrop"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps Tab inside the sheet", async () => {
  renderLog();
  await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
  const box = screen.getByLabelText("Workout");
  await userEvent.type(box, "Ran");
  const close = screen.getByRole("button", { name: "Close" });
  const sendIt = screen.getByRole("button", { name: "Send to Jim" });
  expect(box).toHaveFocus();
  await userEvent.tab();
  expect(sendIt).toHaveFocus();
  await userEvent.tab();
  expect(close).toHaveFocus();
  await userEvent.tab();
  expect(box).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(close).toHaveFocus();
});

it("sends an injection as a sentence and closes", async () => {
  const onLog = renderLog();
  await userEvent.click(screen.getByRole("button", { name: "Log injection" }));
  const sendIt = screen.getByRole("button", { name: "Send to Jim" });
  expect(sendIt).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Dose"), "100 mg");
  await userEvent.type(screen.getByLabelText("Site"), "left glute");
  await userEvent.click(sendIt);
  expect(onLog).toHaveBeenCalledWith(
    "Log my injection today: 100 mg, left glute."
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("adds a work todo with a due date", async () => {
  const onLog = renderLog();
  await userEvent.click(screen.getByRole("button", { name: "Add todo" }));
  await userEvent.type(screen.getByLabelText("Todo"), "Call the vet");
  await userEvent.type(screen.getByLabelText("Due (optional)"), "2026-11-04");
  await userEvent.click(screen.getByRole("radio", { name: "Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Send to Jim" }));
  expect(onLog).toHaveBeenCalledWith(
    "Add a todo: Call the vet, due 2026-11-04, work."
  );
});

it("starts each sheet empty again", async () => {
  renderLog();
  await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
  await userEvent.type(screen.getByLabelText("Workout"), "Ran");
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
  expect(screen.getByLabelText("Workout")).toHaveValue("");
});

it("locks the page behind the sheet while it is open", async () => {
  const onLog = jest.fn();
  render(
    <div data-notes-scroller style={{ overflow: "auto" }}>
      <button type="button">Behind</button>
      <QuickLog today={TODAY} onLog={onLog} />
    </div>
  );
  const scroller = document.querySelector<HTMLElement>(
    "[data-notes-scroller]"
  )!;
  const behind = screen.getByRole("button", { name: "Behind" });
  await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
  expect(scroller.style.overflow).toBe("hidden");
  expect(behind).toHaveAttribute("inert");
  // The opener row is behind the sheet too.
  expect(
    screen.getByRole("button", { name: "Log injection", hidden: true })
      .parentElement
  ).toHaveAttribute("inert");
  expect(screen.getByTestId("quicklog-backdrop")).toHaveClass("touch-none");
  await userEvent.keyboard("{Escape}");
  expect(scroller.style.overflow).toBe("auto");
  expect(behind).not.toHaveAttribute("inert");
  expect(screen.getByRole("button", { name: "Log workout" })).toHaveFocus();
});
