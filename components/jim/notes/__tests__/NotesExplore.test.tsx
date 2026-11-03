import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TimelineEvent } from "@/lib/jim/explore";
import {
  ExploreBallot,
  ExploreGraph,
  ExploreTimeline,
  filterTimeline,
} from "../NotesExplore";

const API = "https://jim.example.test";
const getToken = async () => "token";

const GRAPH = {
  nodes: [
    { id: "people/sam-okafor.md", title: "Sam Okafor", folder: "people" },
    { id: "home/garden.md", title: "Garden", folder: "home" },
    { id: "home/shed.md", title: "Shed", folder: "home" },
  ],
  links: [
    { source: "home/garden.md", target: "people/sam-okafor.md" },
    { source: "home/garden.md", target: "home/shed.md" },
  ],
};

const EVENTS: TimelineEvent[] = [
  {
    date: "2026-11-05",
    kind: "due",
    text: "Return the library books",
    path: "lists/todos.md",
    src: "todos",
  },
  {
    date: "2026-10-30",
    time: "9:30",
    kind: "log",
    title: "Planning",
    text: "Sketched the spring beds",
    path: "log/2026-10/2026-10-30.md",
    src: "session log",
  },
  {
    date: "2026-10-12",
    kind: "done",
    text: "Fixed the gate latch",
    path: "lists/todos.md",
    src: "todos",
  },
  {
    date: "2025-01-04",
    kind: "note",
    text: "Planted the plum tree",
    path: "home/garden.md",
    src: "Garden",
  },
];

const BALLOT = {
  voted: {
    path: "notes/ballot.md",
    title: "Town ballot",
    facts: { Precinct: "12", Marked: "Oct 20" },
    sections: [
      {
        heading: "Offices",
        before: "",
        after: "",
        tables: [
          {
            heading: "",
            header: ["Contest", "Vote"],
            rows: [["Library board", "Priya Lane"]],
          },
        ],
      },
    ],
  },
  guide: {
    path: "notes/guide.md",
    title: "Town voting guide",
    intro: "A short **guide**.",
    date: "2026-11-03",
    sections: [],
  },
};

let realFetch: typeof fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  realFetch = global.fetch;
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

function props() {
  return {
    getToken,
    api: API,
    today: "2026-10-31",
    onOpenNote: jest.fn(),
    hrefForNote: (p: string) => `/jim/notes/note/${p.replace(/\.md$/, "")}`,
  };
}

describe("filterTimeline", () => {
  const all = new Set(["log", "done", "note", "due"] as const);
  it("keeps the window unless searching, which looks at everything", () => {
    expect(filterTimeline(EVENTS, all, "", "2026-07-03")).toHaveLength(3);
    expect(filterTimeline(EVENTS, all, "plum", "2026-07-03")).toHaveLength(1);
    expect(filterTimeline(EVENTS, new Set(["done"]), "", null)).toHaveLength(1);
  });
});

describe("ExploreTimeline", () => {
  it("posts {} on open, groups by month and filters by kind", async () => {
    respond({ events: EVENTS });
    const user = userEvent.setup();
    const p = props();
    render(<ExploreTimeline {...p} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Loading/);
    const oct = await screen.findByRole("region", { name: "October 2026" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/timeline`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(within(oct).getByText("Sketched the spring beds")).toBeVisible();
    expect(screen.getByText("in 5d", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Planted the plum tree")).toBeNull();
    await user.click(screen.getByRole("button", { name: /All time/ }));
    expect(screen.getByText("Planted the plum tree")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Sessions/ }));
    expect(screen.queryByText("Sketched the spring beds")).toBeNull();
    await user.click(
      screen.getByRole("link", { name: /Fixed the gate latch/ })
    );
    expect(p.onOpenNote).toHaveBeenCalledWith("lists/todos.md");
  });

  it("offers Try again when Jim is waking", async () => {
    respond({}, 503);
    render(<ExploreTimeline {...props()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/waking up/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("ExploreGraph", () => {
  it("draws the graph and opens a tapped note", async () => {
    respond(GRAPH);
    const p = props();
    render(<ExploreGraph {...p} />);
    const svg = await screen.findByRole("img", {
      name: /Note graph: 3 notes and 2 links/,
    });
    const garden = svg.querySelector('[data-id="home/garden.md"] circle')!;
    fireEvent.pointerDown(garden, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(garden, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(p.onOpenNote).toHaveBeenCalledWith("home/garden.md");
  });

  it("pans on a drag without opening, and zooms with the buttons", async () => {
    respond(GRAPH);
    const user = userEvent.setup();
    const p = props();
    render(<ExploreGraph {...p} />);
    const svg = await screen.findByRole("img", { name: /Note graph/ });
    const layer = svg.querySelector("g")!;
    const garden = svg.querySelector('[data-id="home/garden.md"] circle')!;
    fireEvent.pointerDown(garden, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 60, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 60, clientY: 40 });
    expect(p.onOpenNote).not.toHaveBeenCalled();
    expect(layer.getAttribute("transform")).not.toBe("translate(0 0) scale(1)");
    await user.click(
      screen.getByRole("button", { name: "Fit the whole graph" })
    );
    expect(layer.getAttribute("transform")).toBe("translate(0 0) scale(1)");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(layer.getAttribute("transform")).toMatch(/scale\(1\.4\)/);
  });

  it("finds a note by name as a real link", async () => {
    respond(GRAPH);
    const user = userEvent.setup();
    render(<ExploreGraph {...props()} />);
    await user.type(
      await screen.findByLabelText("Find a note in the graph"),
      "shed"
    );
    expect(screen.getByRole("link", { name: /Shed/ })).toHaveAttribute(
      "href",
      "/jim/notes/note/home/shed"
    );
  });
});

describe("ExploreBallot", () => {
  it("shows the voted ballot's facts and choices, and the guide on a toggle", async () => {
    respond(BALLOT);
    const user = userEvent.setup();
    render(<ExploreBallot {...props()} />);
    expect(
      await screen.findByRole("heading", { name: "Town ballot" })
    ).toBeVisible();
    expect(screen.getByText("Precinct").nextSibling).toHaveTextContent("12");
    expect(screen.getByText("Library board")).toBeVisible();
    expect(screen.getByText("Priya Lane")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "The guide" }));
    expect(
      screen.getByRole("heading", { name: "Town voting guide" })
    ).toBeVisible();
    expect(screen.getByText("3 days to go")).toBeVisible();
  });

  it("is calm with no ballot", async () => {
    respond({});
    render(<ExploreBallot {...props()} />);
    expect(await screen.findByText(/No ballot yet/)).toBeVisible();
  });
});
