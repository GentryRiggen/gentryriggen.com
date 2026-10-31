import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import * as view from "@/lib/jim/view";
import NotesNote from "../NotesNote";
import NotesSearch from "../NotesSearch";

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, searchNotes: jest.fn(), fetchNote: jest.fn() };
});

const searchNotes = jest.mocked(view.searchNotes);
const fetchNote = jest.mocked(view.fetchNote);
const API = "https://jim.example.test";
const getToken = jest.fn().mockResolvedValue("t");
const RESULTS: view.SearchResult[] = [
  { path: "home/garden.md", title: "Garden", snippet: "Water the **plants**" },
  { path: "people/sam-okafor.md", title: "Sam Okafor", snippet: "Data team" },
];

beforeEach(() => {
  searchNotes.mockReset();
  fetchNote.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

function renderSearch(query: string, onOpen = jest.fn()) {
  const utils = render(
    <NotesSearch query={query} api={API} getToken={getToken} onOpen={onOpen} />
  );
  return { ...utils, onOpen };
}

async function wait(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe("NotesSearch", () => {
  it("asks for 2 letters before searching", async () => {
    renderSearch("a");
    await wait(1000);
    expect(searchNotes).not.toHaveBeenCalled();
    expect(screen.getByText("Type at least 2 letters.")).toBeInTheDocument();
  });

  it("waits 300 ms after typing stops, then lists title, path and snippet", async () => {
    searchNotes.mockResolvedValue(RESULTS);
    const { rerender } = renderSearch("pl");
    await wait(200);
    rerender(
      <NotesSearch
        query="pla"
        api={API}
        getToken={getToken}
        onOpen={jest.fn()}
      />
    );
    await wait(299);
    expect(searchNotes).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    await wait(1);
    expect(searchNotes).toHaveBeenCalledTimes(1);
    expect(searchNotes).toHaveBeenCalledWith("pla", getToken, undefined, API);
    const first = screen.getByRole("button", { name: /Garden/ });
    expect(within(first).getByText("home/garden.md")).toBeInTheDocument();
    expect(within(first).getByText("Water the plants")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 notes");
  });

  it("opens a result by its path", async () => {
    searchNotes.mockResolvedValue(RESULTS);
    const { onOpen } = renderSearch("sam");
    await wait(300);
    jest.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
    expect(onOpen).toHaveBeenCalledWith("people/sam-okafor.md");
  });

  it("never shows results for an older query that lands late", async () => {
    let resolveOld: (r: view.SearchResult[]) => void = () => {};
    searchNotes
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveOld = r;
        })
      )
      .mockResolvedValueOnce([RESULTS[1]]);
    const { rerender } = renderSearch("ga");
    await wait(300);
    rerender(
      <NotesSearch
        query="sam"
        api={API}
        getToken={getToken}
        onOpen={jest.fn()}
      />
    );
    await wait(300);
    await act(async () => resolveOld([RESULTS[0]]));
    expect(screen.queryByRole("button", { name: /Garden/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Sam Okafor/ })
    ).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    searchNotes.mockResolvedValue([]);
    renderSearch("zzz");
    await wait(300);
    expect(screen.getByText("No notes match.")).toBeInTheDocument();
  });

  it("offers Try again when the search fails", async () => {
    searchNotes.mockRejectedValueOnce(new api.JimError("waking"));
    searchNotes.mockResolvedValueOnce(RESULTS);
    renderSearch("garden");
    await wait(300);
    expect(screen.getByText("Couldn't search. Try again.")).toBeInTheDocument();
    jest.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Garden/ })).toBeVisible();
  });
});

describe("NotesNote", () => {
  beforeEach(() => jest.useRealTimers());

  it("loads the note and renders its Markdown with a back button", async () => {
    fetchNote.mockResolvedValue({
      path: "home/garden.md",
      title: "Garden",
      updated: "2026-10-12",
      body: "## Beds\n- **Tomatoes**",
    });
    const onBack = jest.fn();
    render(
      <NotesNote
        path="home/garden.md"
        api={API}
        getToken={getToken}
        onBack={onBack}
      />
    );
    expect(screen.getByText("Loading note…")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Garden", level: 2 })
    ).toBeInTheDocument();
    expect(fetchNote).toHaveBeenCalledWith(
      "home/garden.md",
      getToken,
      undefined,
      API
    );
    expect(screen.getByRole("heading", { name: "Beds" })).toBeInTheDocument();
    expect(screen.getByText("Tomatoes").tagName).toBe("STRONG");
    expect(screen.getByText("Updated Oct 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("home/garden.md")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Results" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("says so when the note is gone", async () => {
    fetchNote.mockResolvedValue(null);
    render(
      <NotesNote
        path="home/gone.md"
        api={API}
        getToken={getToken}
        onBack={jest.fn()}
      />
    );
    expect(
      await screen.findByText("That note isn't there anymore.")
    ).toBeInTheDocument();
  });

  it("offers Try again when loading fails", async () => {
    fetchNote.mockRejectedValueOnce(new api.JimError("waking"));
    fetchNote.mockResolvedValueOnce({
      path: "home/garden.md",
      title: "Garden",
      updated: "",
      body: "Hi",
    });
    render(
      <NotesNote
        path="home/garden.md"
        api={API}
        getToken={getToken}
        onBack={jest.fn()}
      />
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" })
    );
    expect(await screen.findByText("Hi")).toBeInTheDocument();
  });
});
