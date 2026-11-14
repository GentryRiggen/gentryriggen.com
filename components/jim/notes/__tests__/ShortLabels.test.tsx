import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import JimNoticed from "../JimNoticed";
import NotesHomePage from "../NotesHome";
import useTodoSaves from "../useTodoSaves";

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, toggleTodo: jest.fn() };
});
const toggleTodo = jest.mocked(view.toggleTodo);
const getToken = jest.fn().mockResolvedValue("t");

const PLANTS = VIEW_FIXTURE.todos.find((t) => t.order === 3)!;
const FULL = "Water the plants";
const DATA: view.ViewData = {
  ...VIEW_FIXTURE,
  todos: VIEW_FIXTURE.todos.map((t) =>
    t.order === 3 ? { ...t, short: "Plants" } : t
  ),
};

function Home({ data }: { data: view.ViewData }) {
  const saves = useTodoSaves({
    data,
    api: "https://jim.example.test",
    getToken,
    onChanged: async () => data,
  });
  return (
    <NotesHomePage
      data={data}
      saves={saves}
      onLog={() => {}}
      onDraft={() => {}}
    />
  );
}

beforeEach(() => toggleTodo.mockReset());

describe("Home todo short labels", () => {
  it("shows the short label and hides the full text until tapped", async () => {
    render(<Home data={DATA} />);
    const label = screen.getByRole("button", { name: /Plants/ });
    expect(label).toHaveAttribute("aria-expanded", "false");
    expect(label.getAttribute("class")).toMatch(/min-h-11/);
    expect(screen.queryByText(FULL, { selector: "span" })).toBeNull();
    await userEvent.click(label);
    expect(label).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(FULL, { selector: "span" })).toBeVisible();
    await userEvent.click(label);
    expect(label).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(FULL, { selector: "span" })).toBeNull();
  });

  it("the checkbox still sends the real todo", async () => {
    toggleTodo.mockResolvedValue({ ok: true, sha: "abc1235" });
    render(<Home data={DATA} />);
    await act(async () => {
      await userEvent.click(screen.getByRole("checkbox", { name: FULL }));
    });
    expect(toggleTodo.mock.calls[0][0].text).toBe(PLANTS.text);
  });

  it("without short, renders as before", () => {
    render(<Home data={VIEW_FIXTURE} />);
    expect(screen.getByText(FULL)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Plants/ })).toBeNull();
  });
});

describe("Jim noticed short labels", () => {
  const item: view.Noticed = {
    kind: "Todo",
    title: "Renew the long registration paperwork",
    short: "Registration",
    when: "Late",
    tone: "over",
    ask: "Help me renew the registration",
  };

  it("shows short, expands to the full title, and Ask uses the full phrase", async () => {
    const onAsk = jest.fn();
    render(<JimNoticed items={[item]} onAsk={onAsk} />);
    expect(screen.queryByText(item.title)).toBeNull();
    const label = screen.getByRole("button", { name: /Registration/ });
    await userEvent.click(label);
    expect(label).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(item.title)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: `Ask Jim: ${item.title}` })
    );
    expect(onAsk).toHaveBeenCalledWith(item.ask);
  });

  it("without short shows the title", () => {
    const plain: view.Noticed = { ...item, short: undefined };
    render(<JimNoticed items={[plain]} onAsk={jest.fn()} />);
    expect(screen.getByText(item.title)).toBeVisible();
  });
});

describe("normalizeView short", () => {
  const base = (short: unknown) => ({
    today: "2026-10-31",
    todos: [{ ...PLANTS, short }],
    noticed: [{ kind: "k", title: "T", when: "w", tone: "", ask: "a", short }],
  });
  it("keeps a trimmed short, drops malformed ones", () => {
    const ok = view.normalizeView(base("  Plants  "))!;
    expect(ok.todos[0].short).toBe("Plants");
    expect(ok.noticed?.[0].short).toBe("Plants");
    for (const bad of ["", "   ", 5, null, "x".repeat(81)]) {
      const v = view.normalizeView(base(bad))!;
      expect(v.todos[0]).not.toHaveProperty("short");
      expect(v.noticed?.[0]).not.toHaveProperty("short");
    }
  });
});
