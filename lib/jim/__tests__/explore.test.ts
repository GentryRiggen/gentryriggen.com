import { act, renderHook, waitFor } from "@testing-library/react";
import { JimError } from "../api";
import {
  MAX_EVENTS,
  clearExplore,
  fetchExplore,
  normalizeBallot,
  normalizeGraph,
  normalizeTimeline,
  useExplore,
} from "../explore";

const API = "https://jim.example.test";

function json(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof JimError) return err.kind;
    throw err;
  }
  throw new Error("expected a JimError");
}

const GRAPH = {
  nodes: [
    { id: "people/sam-okafor.md", title: "Sam Okafor", folder: "people" },
    { id: "home/garden.md", title: "Garden", folder: "home" },
  ],
  links: [{ source: "home/garden.md", target: "people/sam-okafor.md" }],
};

describe("normalizeGraph", () => {
  it("keeps a good graph", () => {
    expect(normalizeGraph(GRAPH)).toEqual(GRAPH);
  });

  it("drops bad nodes, repeats, self-links and links to unknown notes", () => {
    const graph = normalizeGraph({
      nodes: [
        ...GRAPH.nodes,
        GRAPH.nodes[0],
        { id: "", title: "x" },
        { id: "notes/untitled.md" },
        "nope",
      ],
      links: [
        ...GRAPH.links,
        { source: "people/sam-okafor.md", target: "home/garden.md" },
        { source: "home/garden.md", target: "home/garden.md" },
        { source: "home/garden.md", target: "home/missing.md" },
        { source: 1, target: 2 },
      ],
      stale: true,
    })!;
    expect(graph.nodes.map((n) => n.id)).toEqual([
      "people/sam-okafor.md",
      "home/garden.md",
      "notes/untitled.md",
    ]);
    expect(graph.nodes[2]).toEqual({
      id: "notes/untitled.md",
      title: "notes/untitled",
      folder: "",
    });
    expect(graph.links).toEqual(GRAPH.links);
    expect(graph.stale).toBe(true);
  });

  it("is null without a node list", () => {
    expect(normalizeGraph({})).toBeNull();
    expect(normalizeGraph(null)).toBeNull();
  });
});

describe("normalizeTimeline", () => {
  it("keeps good events and drops the rest", () => {
    const timeline = normalizeTimeline({
      events: [
        {
          date: "2026-10-31",
          time: "9:30",
          kind: "log",
          title: "Morning",
          text: "Planned the beds",
          path: "log/2026-10/2026-10-31.md",
          src: "Session log",
        },
        {
          date: "2026-10-30",
          kind: "due",
          text: "Book the dentist",
          path: "lists/todos.md",
          src: "todos",
        },
        { date: "Oct 30", kind: "due", text: "x" },
        { date: "2026-10-30", kind: "party", text: "x" },
        { date: "2026-10-30", kind: "note" },
      ],
    })!;
    expect(timeline.events).toEqual([
      {
        date: "2026-10-31",
        time: "9:30",
        kind: "log",
        title: "Morning",
        text: "Planned the beds",
        path: "log/2026-10/2026-10-31.md",
        src: "Session log",
      },
      {
        date: "2026-10-30",
        kind: "due",
        text: "Book the dentist",
        path: "lists/todos.md",
        src: "todos",
      },
    ]);
  });

  it("caps the list", () => {
    const events = Array.from({ length: MAX_EVENTS + 5 }, () => ({
      date: "2026-10-30",
      kind: "note",
      text: "x",
      path: "a.md",
      src: "a",
    }));
    expect(normalizeTimeline({ events })!.events).toHaveLength(MAX_EVENTS);
  });

  it("is null without an event list", () => {
    expect(normalizeTimeline({ events: "x" })).toBeNull();
  });
});

describe("normalizeBallot", () => {
  it("is empty for {}", () => {
    expect(normalizeBallot({})).toEqual({ guide: null, voted: null });
  });

  it("lines every row up with its header", () => {
    const ballot = normalizeBallot({
      voted: {
        path: "notes/ballot.md",
        title: "Ballot",
        facts: { Election: "General", Precinct: 12, Empty: " " },
        sections: [
          {
            heading: "Measures",
            before: "",
            after: "",
            tables: [
              {
                heading: "",
                header: ["Measure", "Vote"],
                rows: [["1A", "Yes", "extra"], ["2B"], [3, "No"]],
              },
              { heading: "", header: [], rows: [] },
            ],
          },
          { heading: "", before: "", after: "", tables: [] },
        ],
      },
      guide: { title: "Guide", date: "Nov 3", sections: "x" },
    })!;
    expect(ballot.voted!.facts).toEqual({ Election: "General" });
    expect(ballot.voted!.sections).toHaveLength(1);
    expect(ballot.voted!.sections[0].tables).toEqual([
      {
        heading: "",
        header: ["Measure", "Vote"],
        rows: [
          ["1A", "Yes"],
          ["2B", ""],
        ],
      },
    ]);
    expect(ballot.guide).toEqual({
      path: "",
      title: "Guide",
      intro: "",
      date: "",
      sections: [],
    });
  });
});

describe("fetchExplore", () => {
  it("posts {} to its route with the bearer token", async () => {
    const fetchFn = jest.fn(async () => json(200, GRAPH));
    const graph = await fetchExplore("graph", async () => "tok", fetchFn, API);
    expect(graph.nodes).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledWith(
      `${API}/api/graph`,
      expect.objectContaining({
        method: "POST",
        body: "{}",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });

  it("says waking for a 503, denied for a 403, server for a bad body", async () => {
    const token = async () => "tok";
    expect(
      await kindOf(
        fetchExplore("timeline", token, async () => json(503, {}), API)
      )
    ).toBe("waking");
    expect(
      await kindOf(
        fetchExplore("timeline", token, async () => json(403, {}), API)
      )
    ).toBe("denied");
    expect(
      await kindOf(
        fetchExplore("timeline", token, async () => json(200, []), API)
      )
    ).toBe("server");
    expect(
      await kindOf(
        fetchExplore("ballot", token, async () => json(500, {}), API)
      )
    ).toBe("server");
  });

  it("never touches web storage or IndexedDB", async () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    const open = jest.fn();
    Object.defineProperty(window, "indexedDB", {
      value: { open },
      configurable: true,
    });
    const { result } = renderHook(() =>
      useExplore(
        "graph",
        async () => "tok",
        API,
        true,
        async () => json(200, GRAPH)
      )
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe("useExplore", () => {
  it("waits until active, then fetches once", async () => {
    const fetchFn = jest.fn(async () => json(200, { events: [] }));
    const { result, rerender } = renderHook(
      ({ active }) =>
        useExplore("timeline", async () => "tok", API, active, fetchFn),
      { initialProps: { active: false } }
    );
    expect(result.current.status).toBe("idle");
    rerender({ active: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ active: false });
    rerender({ active: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("forgets everything on sign-out", async () => {
    const { result } = renderHook(() =>
      useExplore(
        "graph",
        async () => "tok",
        API,
        true,
        async () => json(200, GRAPH)
      )
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => clearExplore());
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
