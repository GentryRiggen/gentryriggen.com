import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MONEY_FIXTURE, VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import { clearMoney, useMoney, type MoneySummary } from "@/lib/jim/money";
import {
  loadView,
  saveView,
  setOfflineBackend,
  type KeyValueStore,
} from "@/lib/jim/offlineStore";
import { clearViewCache, setViewSaver } from "@/lib/jim/view";
import NotesMoney from "../NotesMoney";
import NotesShell from "../NotesShell";

const API = "https://jim.example.test";
const getToken = async () => "t";

function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

/** The page fed by the real hook, as NotesShell feeds it. */
function Harness({ fetchFn }: { fetchFn: typeof fetch }) {
  const money = useMoney(getToken, API, true, fetchFn);
  return <NotesMoney money={money} />;
}

function renderMoney(summary: MoneySummary | null = MONEY_FIXTURE) {
  const fetchFn = jest
    .fn()
    .mockResolvedValue(
      summary ? json(200, summary) : json(404, { error: "x" })
    ) as jest.Mock & typeof fetch;
  render(<Harness fetchFn={fetchFn} />);
  return fetchFn;
}

/** Strings from the invented fixture that must never rest on the device. */
const MONEY_VALUES = [
  "Hill Hardware",
  "Green Acres",
  "Page Turners",
  "Spare jar used",
  "Seed order",
  "Greenhouse repair",
  "Pause new tools",
  "Invented rule for tests",
];

afterEach(() => {
  clearMoney();
  jest.restoreAllMocks();
});

it("shows a skeleton while loading, then the tiles and every month", async () => {
  renderMoney();
  expect(screen.getByRole("status")).toHaveTextContent("Loading money");
  const tiles = await screen.findByRole("region", { name: "Overview" });
  expect(within(tiles).getByText("Good months")).toBeInTheDocument();
  expect(within(tiles).getByText("1 of 2")).toBeInTheDocument();
  expect(within(tiles).getByText("+$120")).toHaveClass("text-ayu-green");
  expect(within(tiles).getByText("$0.4k")).toHaveClass("text-ayu-red");
  expect(within(tiles).getByText("1 of 2")).not.toHaveClass("text-ayu-red");
  expect(screen.getByText("Invented rule for tests.")).toBeInTheDocument();

  const chart = screen.getByRole("group", { name: "Net per month" });
  const bars = within(chart).getAllByRole("img");
  expect(bars.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Aug: +$340",
    "Sep: −$100, used $0.4k",
    "Oct, so far: +$60",
  ]);
  // A deficit is red, a surplus green.
  expect(bars[0].querySelector("rect.fill-ayu-green")).not.toBeNull();
  expect(bars[1].querySelector("rect.fill-ayu-red")).not.toBeNull();
  // The flag shows as text under the chart.
  expect(
    within(screen.getByRole("region", { name: "Net per month" })).getByText(
      "used $0.4k"
    )
  ).toBeInTheDocument();

  const chips = within(screen.getByRole("group", { name: "Months" }));
  expect(chips.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Aug",
    "Sep",
    "Oct",
  ]);
  // The last full month is picked to start.
  expect(chips.getByRole("button", { name: "Sep" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

it("changes the month detail when another month is picked", async () => {
  renderMoney();
  const detail = await screen.findByRole("region", { name: "Sep detail" });
  expect(within(detail).getByText("Hill Hardware")).toBeInTheDocument();
  expect(within(detail).getByText("+$220")).toHaveClass("text-ayu-red");
  expect(within(detail).getByText("$85.50")).toBeInTheDocument();

  const chips = within(screen.getByRole("group", { name: "Months" }));
  await userEvent.click(chips.getByRole("button", { name: "Aug" }));
  expect(chips.getByRole("button", { name: "Aug" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  const aug = screen.getByRole("region", { name: "Aug detail" });
  expect(within(aug).getByText("Green Acres")).toBeInTheDocument();
  expect(within(aug).getByText("A quiet month.")).toBeInTheDocument();
  expect(within(aug).getByText("−$80")).toHaveClass("text-ayu-green");
  expect(screen.queryByText("Hill Hardware")).toBeNull();

  await userEvent.click(chips.getByRole("button", { name: "Oct" }));
  const oct = screen.getByRole("region", { name: "Oct detail" });
  expect(within(oct).getByText("So far")).toBeInTheDocument();
});

it("shows the check-in with its own month, coming up, log and next date", async () => {
  renderMoney({
    ...MONEY_FIXTURE,
    checkin: {
      ...MONEY_FIXTURE.checkin!,
      month: "2026-09",
      plan: [
        { cat: "Tools", target: 100, actual: 60, why: "Bought enough" },
        { cat: "Treats", target: 50, actual: 80, why: "" },
      ],
      log: [1, 2, 3, 4, 5, 6].map((n) => ({
        date: `2026-10-0${n}`,
        kind: "note",
        text: `Entry ${n}`,
      })),
    },
  });
  const checkin = await screen.findByRole("region", { name: "Check-in" });
  // An earlier month than today's says which month it is.
  expect(within(checkin).getByText("Plan for Sep 2026")).toBeInTheDocument();
  const tools = within(checkin).getByRole("img", {
    name: "Tools: $60 of $100",
  });
  const treats = within(checkin).getByRole("img", {
    name: "Treats: $80 of $50, over by $30",
  });
  expect(tools.querySelector("rect.fill-ayu-green")).not.toBeNull();
  expect(treats.querySelector("rect.fill-ayu-red")).not.toBeNull();
  expect(treats.querySelector("rect.fill-ayu-green")).toBeNull();
  expect(within(checkin).getByText("Bought enough")).toBeInTheDocument();

  expect(within(checkin).getByText("Seed order")).toBeInTheDocument();
  expect(within(checkin).getByText("$90")).toBeInTheDocument();
  expect(within(checkin).getByText("Greenhouse repair")).toBeInTheDocument();
  // The last five entries only.
  expect(within(checkin).getByText("Entry 1")).toBeInTheDocument();
  expect(within(checkin).getByText("Entry 5")).toBeInTheDocument();
  expect(within(checkin).queryByText("Entry 6")).toBeNull();
  expect(within(checkin).getByText("Thu, Nov 5")).toBeInTheDocument();
});

it("shows cash on hand and the watch list without tappable links", async () => {
  renderMoney({
    ...MONEY_FIXTURE,
    watch: "- Keep an eye on [tools](https://example.com/tools)",
  });
  const cash = await screen.findByRole("region", { name: "Cash on hand" });
  expect(within(cash).getByText("$4,700")).toBeInTheDocument();
  expect(
    within(cash)
      .getAllByRole("img")
      .map((b) => b.getAttribute("aria-label"))
  ).toEqual(["Aug 31: $5,200", "Sep 30: $4,700"]);
  const watch = screen.getByRole("region", { name: "Watch" });
  expect(within(watch).queryByRole("link")).toBeNull();
  expect(watch).toHaveTextContent("Keep an eye on");
});

it("says so calmly when there's no money data", async () => {
  renderMoney(null);
  expect(await screen.findByText(/No money summary yet/)).toBeInTheDocument();
});

it("shows an error with Try again when nothing has loaded", async () => {
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(json(503, {}))
    .mockResolvedValueOnce(json(200, MONEY_FIXTURE)) as jest.Mock &
    typeof fetch;
  render(<Harness fetchFn={fetchFn} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/waking up/);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Good months")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps the numbers and adds a quiet banner when a refresh fails", async () => {
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(json(200, MONEY_FIXTURE))
    .mockResolvedValueOnce(json(500, {}))
    .mockResolvedValueOnce(json(200, MONEY_FIXTURE)) as jest.Mock &
    typeof fetch;
  render(<Harness fetchFn={fetchFn} />);
  await screen.findByText("Good months");
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't refresh money"
  );
  expect(screen.getByText("Good months")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(fetchFn).toHaveBeenCalledTimes(3);
});

it("says when the server couldn't sync", async () => {
  renderMoney({ ...MONEY_FIXTURE, stale: true });
  expect(await screen.findByText(/may be behind/)).toBeInTheDocument();
});

it("drops the numbers on sign-out and shows the skeleton", async () => {
  renderMoney();
  await screen.findByText("Good months");
  act(() => clearMoney());
  expect(screen.queryByText("Good months")).toBeNull();
  expect(screen.queryByText("Hill Hardware")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Loading money");
});

it("leaves no money on the device: web storage and the offline store", async () => {
  // The real offline store over a Map, and the real view fetch, as signed in.
  const map = new Map<string, unknown>();
  const store: KeyValueStore = {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, JSON.parse(JSON.stringify(value)));
    },
    clear: async () => map.clear(),
  };
  setOfflineBackend(store);
  setViewSaver((data) => void saveView("uid-a", data));
  window.localStorage.clear();
  window.sessionStorage.clear();
  const fetchFn = jest.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/api/money")
      ? json(200, MONEY_FIXTURE)
      : json(200, VIEW_FIXTURE)
  );
  const realFetch = global.fetch;
  global.fetch = fetchFn as unknown as typeof fetch;
  try {
    render(
      <NotesShell
        uid="uid-a"
        api={API}
        getToken={getToken}
        active
        onLog={() => {}}
      />
    );
    await screen.findByText("Water the plants");
    await userEvent.click(screen.getByRole("tab", { name: "Money" }));
    await screen.findByText("Hill Hardware");
    // A view refresh while Money is open saves the view, not the money.
    await userEvent.click(screen.getByRole("tab", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(
        fetchFn.mock.calls.filter(([u]) => String(u).endsWith("/api/view"))
      ).toHaveLength(2)
    );
    await waitFor(async () => expect(await loadView("uid-a")).not.toBeNull());

    const saved = JSON.stringify(await loadView("uid-a"));
    const web =
      JSON.stringify(window.localStorage) +
      JSON.stringify(window.sessionStorage);
    for (const value of MONEY_VALUES) {
      expect(saved).not.toContain(value);
      expect(web).not.toContain(value);
    }
  } finally {
    global.fetch = realFetch;
    setOfflineBackend(null);
    clearViewCache();
  }
});
