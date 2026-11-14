import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type { ViewData } from "@/lib/jim/view";
import NotesHome from "../NotesHome";

const saves = { marks: {}, toast: null, toggle: () => {}, undo: () => {} };

function show(data: ViewData) {
  const onLog = jest.fn();
  const onDraft = jest.fn();
  render(
    <NotesHome data={data} saves={saves} onLog={onLog} onDraft={onDraft} />
  );
  return { onLog, onDraft };
}

const ACTION = {
  kind: "Email",
  title: "Confirm the carpool",
  when: "tomorrow",
  tone: "soon" as const,
  area: "personal" as const,
  ask: "Help me with: Confirm the carpool",
  link: "",
};

it("shows the daily word when present and nothing when daily is null", () => {
  show(VIEW_FIXTURE);
  expect(screen.getByText("On patience")).toBeInTheDocument();
  expect(screen.getByText(/ten calm minutes/)).toBeInTheDocument();
});

it("omits the daily word when daily is null", () => {
  show({ ...VIEW_FIXTURE, daily: null });
  expect(screen.queryByText("On patience")).toBeNull();
});

it("sends a row from his own notes straight to Jim", async () => {
  const { onLog, onDraft } = show({
    ...VIEW_FIXTURE,
    actions: [{ ...ACTION, kind: "Todo" }],
  });
  await userEvent.click(screen.getByRole("button", { name: /Ask Jim/ }));
  expect(onLog).toHaveBeenCalledWith("Help me with: Confirm the carpool");
  expect(onDraft).not.toHaveBeenCalled();
});

it.each(["Email", "Asana", "Calendar", "Something new"])(
  "only drafts a %s row, never sends it",
  async (kind) => {
    const { onLog, onDraft } = show({
      ...VIEW_FIXTURE,
      actions: [{ ...ACTION, kind }],
    });
    expect(screen.queryByRole("button", { name: /Ask Jim/ })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /Draft for Jim/ })
    );
    expect(onDraft).toHaveBeenCalledWith("Help me with: Confirm the carpool");
    expect(onLog).not.toHaveBeenCalled();
  }
);

it("has no anchor when link is empty, and a safe one when set", () => {
  show({
    ...VIEW_FIXTURE,
    actions: [
      ACTION,
      { ...ACTION, title: "Other", link: "https://example.test/x" },
    ],
  });
  const links = within(
    screen.getByRole("region", { name: "Needs you" })
  ).getAllByRole("link");
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute("target", "_blank");
  expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  expect(links[0]).toHaveAccessibleName(/Other/);
});

it("renders HTML in a title as text", () => {
  show({
    ...VIEW_FIXTURE,
    actions: [{ ...ACTION, title: "<b>bold</b><img src=x>" }],
  });
  expect(screen.getByText("<b>bold</b><img src=x>")).toBeInTheDocument();
  expect(document.querySelector("img")).toBeNull();
});

it("shows six, then all, and notes stale data", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    ...ACTION,
    title: `Item ${i}`,
  }));
  show({
    ...VIEW_FIXTURE,
    actions: many,
    actionsAsOf: "2026-10-29T13:40:00Z",
  });
  expect(screen.queryByText("Item 6")).toBeNull();
  expect(screen.getByText(/Email and Asana as of/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show all 8" }));
  expect(screen.getByText("Item 7")).toBeInTheDocument();
});

it("the Work chip hides personal todos", async () => {
  show(VIEW_FIXTURE);
  const personal = VIEW_FIXTURE.todos.find((t) => t.area === "personal")!;
  const title = personal.text.split(" (due")[0].replace(/ #\S+/g, "");
  expect(screen.getAllByText(title, { exact: false }).length).toBeGreaterThan(
    0
  );
  await userEvent.click(screen.getByRole("button", { name: "Work" }));
  expect(screen.queryByText(title, { exact: false })).toBeNull();
});

describe("Hear your morning", () => {
  function hear(props: {
    briefStage?: string | null;
    briefError?: string | null;
  }) {
    const onHearBrief = jest.fn();
    render(
      <NotesHome
        data={VIEW_FIXTURE}
        saves={saves}
        onLog={jest.fn()}
        onDraft={jest.fn()}
        onHearBrief={onHearBrief}
        {...props}
      />
    );
    return onHearBrief;
  }

  it("plays on a tap", async () => {
    const onHearBrief = hear({});
    const button = screen.getByRole("button", { name: "Hear your morning" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
    await userEvent.click(button);
    expect(onHearBrief).toHaveBeenCalled();
  });

  it("waits with a spinner and the stage while the brief loads", () => {
    hear({ briefStage: "Writing your morning…" });
    const button = screen.getByRole("button", {
      name: "Writing your morning…",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows why it didn't play, right by the button", () => {
    hear({ briefError: "Couldn't get your morning brief." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't get your morning brief."
    );
    expect(
      screen.getByRole("button", { name: "Hear your morning" })
    ).toBeEnabled();
  });
});
