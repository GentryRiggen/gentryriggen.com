import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import * as offline from "@/lib/jim/offlineStore";
import NotesShell from "../NotesShell";

jest.mock("@/lib/jim/offlineStore", () => ({
  loadView: jest.fn(async () => null),
}));

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return {
    ...actual,
    fetchView: jest.fn(),
    toggleTodo: jest.fn(),
    searchNotes: jest.fn(),
    fetchNote: jest.fn(),
  };
});

const fetchView = jest.mocked(view.fetchView);
const toggleTodo = jest.mocked(view.toggleTodo);
const searchNotes = jest.mocked(view.searchNotes);
const fetchNote = jest.mocked(view.fetchNote);
const getToken = jest.fn().mockResolvedValue("t");

/** fetchView that also fills the cache, like the real one. */
function resolvesWith(data: view.ViewData) {
  return async () => {
    const real = jest.requireActual("@/lib/jim/view") as typeof view;
    await real.fetchView(
      async () => "t",
      (async () =>
        ({
          status: 200,
          ok: true,
          json: async () => data,
        }) as Response) as typeof fetch,
      "https://jim.example.test"
    );
    return data;
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderShell(active = true) {
  return render(
    <NotesShell
      uid="uid-1"
      api="https://jim.example.test"
      getToken={getToken}
      active={active}
      onLog={jest.fn()}
    />
  );
}

beforeEach(() => {
  fetchView.mockReset();
  toggleTodo.mockReset();
  searchNotes.mockReset();
  fetchNote.mockReset();
  jest.mocked(offline.loadView).mockReset().mockResolvedValue(null);
  (jest.requireActual("@/lib/jim/view") as typeof view).clearViewCache();
});

it("shows a skeleton, then Home", async () => {
  const pending = deferred<view.ViewData>();
  fetchView.mockReturnValue(pending.promise);
  renderShell();
  expect(screen.getByText("Loading notes…")).toBeInTheDocument();
  await act(async () => pending.resolve(VIEW_FIXTURE));
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  const [token, fetchFn, url] = fetchView.mock.calls[0];
  expect(token).toBe(getToken);
  expect(fetchFn).toBeUndefined();
  expect(url).toBe("https://jim.example.test");
});

it("does not fetch until the tab is opened", () => {
  renderShell(false);
  expect(fetchView).not.toHaveBeenCalled();
});

it("shows the cached payload at once on the next open", async () => {
  fetchView.mockImplementation(resolvesWith(VIEW_FIXTURE));
  const first = renderShell();
  await screen.findByText("Water the plants");
  first.unmount();

  fetchView.mockReset();
  fetchView.mockReturnValue(new Promise(() => {}));
  renderShell();
  // Straight from the cache, no skeleton, and no refetch while it's fresh.
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  expect(fetchView).not.toHaveBeenCalled();
});

it("refreshes on request and keeps showing the old data meanwhile", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  const pending = deferred<view.ViewData>();
  fetchView.mockReturnValueOnce(pending.promise);
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  await act(async () =>
    pending.resolve({
      ...VIEW_FIXTURE,
      todos: VIEW_FIXTURE.todos.slice(0, 1),
    })
  );
  expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
});

it("keeps the data and says so quietly when a refresh fails", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  fetchView.mockRejectedValueOnce(new api.JimError("waking"));
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(
    await screen.findByText(/Couldn't refresh\. Showing what loaded/)
  ).toBeInTheDocument();
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
});

it("offers Try again when the first load fails", async () => {
  fetchView.mockRejectedValueOnce(new api.JimError("waking"));
  renderShell();
  expect(
    await screen.findByText("Jim is waking up. Try again in a moment.")
  ).toBeInTheDocument();
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Water the plants")).toBeInTheDocument();
});

it("asks to sign in again when the server refuses the token", async () => {
  fetchView.mockRejectedValueOnce(new api.JimError("denied"));
  renderShell();
  expect(
    await screen.findByText(
      "Jim didn't accept your sign-in. Sign out and back in."
    )
  ).toBeInTheDocument();
});

it("says quietly when the notes may be behind", async () => {
  fetchView.mockResolvedValueOnce({ ...VIEW_FIXTURE, stale: true });
  renderShell();
  expect(
    await screen.findByText(/Jim couldn't sync, so these may be behind/)
  ).toBeInTheDocument();
});

it("has five page pills in order", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  const pills = within(
    screen.getByRole("tablist", { name: "Notes pages" })
  ).getAllByRole("tab");
  expect(pills.map((t) => t.textContent)).toEqual([
    "Home",
    "Work",
    "Money",
    "Health",
    "People",
  ]);
  expect(screen.queryByRole("tablist", { name: "Health pages" })).toBeNull();
});

it("switches Health between Health, Training and Golf", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  await userEvent.click(screen.getByRole("tab", { name: "Health" }));
  const sub = screen.getByRole("tablist", { name: "Health pages" });
  const tabs = within(sub).getAllByRole("tab");
  expect(tabs.map((t) => t.textContent)).toEqual([
    "Health",
    "Training",
    "Golf",
  ]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Hemoglobin")).toBeInTheDocument();
  await userEvent.click(within(sub).getByRole("tab", { name: "Training" }));
  expect(screen.getByText("Back squat")).toBeInTheDocument();
  expect(screen.queryByText("Hemoglobin")).toBeNull();
  // The Health pill stays selected, and the choice is kept on return.
  const pills = screen.getByRole("tablist", { name: "Notes pages" });
  expect(within(pills).getByRole("tab", { name: "Health" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await userEvent.click(within(pills).getByRole("tab", { name: "Home" }));
  await userEvent.click(within(pills).getByRole("tab", { name: "Health" }));
  expect(screen.getByText("Back squat")).toBeInTheDocument();
});

it("shows calm placeholders on Work and Money for now", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  await userEvent.click(screen.getByRole("tab", { name: "Work" }));
  expect(screen.getByRole("tab", { name: "Work" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.queryByText("Water the plants")).toBeNull();
  await userEvent.click(screen.getByRole("tab", { name: "Money" }));
  expect(screen.getByRole("tab", { name: "Money" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

it("moves between pages and into a profile and back", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  await userEvent.click(screen.getByRole("tab", { name: "Health" }));
  const sub = screen.getByRole("tablist", { name: "Health pages" });
  await userEvent.click(within(sub).getByRole("tab", { name: "Golf" }));
  expect(within(sub).getByRole("tab", { name: "Golf" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByRole("region", { name: "Rounds" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  await userEvent.type(screen.getByLabelText("Search people"), "sam");
  await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
  expect(
    screen.getByRole("heading", { name: "Sam Okafor" })
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "People" }));
  // The search is kept.
  expect(screen.getByLabelText("Search people")).toHaveValue("sam");
  // Tapping People again from a profile also returns to the list.
  await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  expect(screen.getByLabelText("Search people")).toBeInTheDocument();
});

it("refetches in the background after a todo is checked off", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  renderShell();
  await screen.findByText("Water the plants");
  fetchView.mockResolvedValueOnce({
    ...VIEW_FIXTURE,
    todos: VIEW_FIXTURE.todos.filter((t) => t.order !== 3),
  });
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Water the plants" })
  );
  expect(fetchView).toHaveBeenCalledTimes(2);
  // No skeleton meanwhile, and the ticked todo is gone once it lands.
  expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Undo" })).toBeVisible();
  expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
});

it("loads once more when a todo saves while a load is out", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  const slow = deferred<view.ViewData>();
  fetchView.mockReturnValueOnce(slow.promise);
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  const save = deferred<view.TodoResult>();
  toggleTodo.mockReturnValue(save.promise);
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Water the plants" })
  );
  await act(async () => save.resolve({ ok: true, sha: "s" }));
  expect(fetchView).toHaveBeenCalledTimes(2);
  fetchView.mockResolvedValueOnce({ ...VIEW_FIXTURE, todos: [] });
  await act(async () => slow.resolve(VIEW_FIXTURE));
  expect(fetchView).toHaveBeenCalledTimes(3);
  expect(await screen.findByText("No open todos.")).toBeInTheDocument();
});

it("a save still out when Home is left refetches and shows right on return", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  const save = deferred<view.TodoResult>();
  toggleTodo.mockReturnValue(save.promise);
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Water the plants" })
  );
  await userEvent.click(screen.getByRole("tab", { name: "Health" }));
  // Back while it still saves: ticked and busy, and a re-tap sends nothing.
  await userEvent.click(screen.getByRole("tab", { name: "Home" }));
  const box = screen.getByRole("checkbox", { name: "Water the plants" });
  expect(box).toHaveAttribute("aria-checked", "true");
  expect(box).toHaveAttribute("aria-busy", "true");
  await userEvent.click(box);
  expect(toggleTodo).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("tab", { name: "Health" }));
  fetchView.mockResolvedValueOnce({
    ...VIEW_FIXTURE,
    todos: VIEW_FIXTURE.todos.filter((t) => t.order !== 3),
  });
  await act(async () => save.resolve({ ok: true, sha: "s" }));
  expect(fetchView).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole("tab", { name: "Home" }));
  expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  expect(toggleTodo).toHaveBeenCalledTimes(1);
});

it("hides the all-notes search on People, which has its own", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  expect(screen.getByLabelText("Search notes")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  expect(screen.queryByLabelText("Search notes")).toBeNull();
  expect(screen.getByLabelText("Search people")).toBeInTheDocument();
});

it("is memoized, so a chat redraw leaves it alone", () => {
  expect((NotesShell as unknown as { $$typeof: symbol }).$$typeof).toBe(
    Symbol.for("react.memo")
  );
});

describe("offline", () => {
  // A past day, so the label carries its date.
  const SAVED_AT = new Date(2025, 9, 30, 21, 5).getTime();

  it("shows the payload kept on this device when there's no signal", async () => {
    fetchView.mockRejectedValue(new api.JimError("waking"));
    jest
      .mocked(offline.loadView)
      .mockResolvedValue({ payload: VIEW_FIXTURE, savedAt: SAVED_AT });
    renderShell();
    expect(await screen.findByText("Water the plants")).toBeInTheDocument();
    expect(offline.loadView).toHaveBeenCalledWith("uid-1");
    expect(
      screen.getByText("Offline · as of Oct 30, 9:05pm")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("swaps in fresh data once the signal is back", async () => {
    fetchView.mockRejectedValueOnce(new api.JimError("waking"));
    jest
      .mocked(offline.loadView)
      .mockResolvedValue({ payload: VIEW_FIXTURE, savedAt: SAVED_AT });
    renderShell();
    await screen.findByText(/^Offline · as of/);
    fetchView.mockResolvedValueOnce({ ...VIEW_FIXTURE, todos: [] });
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("No open todos.")).toBeInTheDocument();
    expect(screen.queryByText(/^Offline/)).toBeNull();
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });

  it("keeps what's showing rather than the device copy on a failed refresh", async () => {
    fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
    renderShell();
    await screen.findByText("Water the plants");
    fetchView.mockRejectedValueOnce(new api.JimError("waking"));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/^Couldn't refresh/)).toBeInTheDocument();
    expect(offline.loadView).not.toHaveBeenCalled();
  });

  it("never falls back when the sign-in was refused", async () => {
    fetchView.mockRejectedValue(new api.JimError("denied"));
    jest
      .mocked(offline.loadView)
      .mockResolvedValue({ payload: VIEW_FIXTURE, savedAt: SAVED_AT });
    renderShell();
    expect(
      await screen.findByText(
        "Jim didn't accept your sign-in. Sign out and back in."
      )
    ).toBeInTheDocument();
    expect(offline.loadView).not.toHaveBeenCalled();
    expect(screen.queryByText("Water the plants")).toBeNull();
  });

  it("offers Try again when nothing is kept either", async () => {
    fetchView.mockRejectedValue(new api.JimError("waking"));
    renderShell();
    expect(
      await screen.findByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});

describe("search", () => {
  const RESULTS = [
    { path: "home/garden.md", title: "Garden", snippet: "the plants" },
    { path: "people/sam-okafor.md", title: "Sam Okafor", snippet: "data" },
  ];

  it("replaces the page with results, opens notes and people, and clears", async () => {
    fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
    searchNotes.mockResolvedValue(RESULTS);
    fetchNote.mockResolvedValue({
      path: "home/garden.md",
      title: "Garden",
      updated: "2026-10-12",
      body: "- Tomatoes",
    });
    renderShell();
    await screen.findByText("Water the plants");
    const field = screen.getByLabelText("Search notes");
    await userEvent.type(field, "plants");
    expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    await userEvent.click(
      await screen.findByRole("button", { name: /Garden/ })
    );
    expect(await screen.findByText("Tomatoes")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search notes")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Results" }));
    expect(screen.getByLabelText("Search notes")).toHaveValue("plants");
    expect(searchNotes).toHaveBeenCalledTimes(1);

    // A person in the payload opens as their profile.
    await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
    expect(
      screen.getByRole("heading", { name: "Sam Okafor" })
    ).toBeInTheDocument();
    expect(fetchNote).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Results" }));

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Search notes")).toHaveValue("");
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
  });

  it("a page pill leaves the search for that page", async () => {
    fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
    searchNotes.mockResolvedValue(RESULTS);
    renderShell();
    await screen.findByText("Water the plants");
    await userEvent.type(screen.getByLabelText("Search notes"), "plants");
    await userEvent.click(screen.getByRole("tab", { name: "Home" }));
    expect(screen.getByLabelText("Search notes")).toHaveValue("");
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
  });
});
