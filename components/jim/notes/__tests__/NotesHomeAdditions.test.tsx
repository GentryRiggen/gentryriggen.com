import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type { ViewData } from "@/lib/jim/view";
import NotesHome from "../NotesHome";

const saves = { marks: {}, toast: null, toggle: () => {}, undo: () => {} };

function show(data: ViewData, onLog = jest.fn()) {
  render(<NotesHome data={data} saves={saves} onLog={onLog} />);
  return onLog;
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

it("sends exactly the ask text through onLog", async () => {
  const onLog = show({ ...VIEW_FIXTURE, actions: [ACTION] });
  await userEvent.click(screen.getByRole("button", { name: /Ask Jim/ }));
  expect(onLog).toHaveBeenCalledWith("Help me with: Confirm the carpool");
});

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
