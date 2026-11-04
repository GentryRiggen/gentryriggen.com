import { fireEvent, render, screen } from "@testing-library/react";
import { NotesElection } from "../NotesElection";
import { clearExplore } from "@/lib/jim/explore";

const API = "https://jim.example.test";
const getToken = async () => "token";

const ELECTION = {
  slug: "night",
  title: "Town night",
  date: "2026-11-03",
  races: {
    oh: {
      name: "Town Senate",
      kind: "senate",
      a: "Ada",
      aParty: "D",
      b: "Bo",
      bParty: "R",
      seat: "R",
    },
    co: {
      name: "Town House",
      kind: "house",
      a: "Cy",
      aParty: "D",
      b: "Di",
      bParty: "R",
      seat: "R",
      mine: true,
    },
  },
  updates: [
    {
      at: "2026-11-03T20:00:00-05:00",
      asked: "How is it going",
      headline: "Too early",
      senate: { d: 40, r: 30, uncalled: 30, flips: 0 },
      results: { oh: { a: 55, b: 44, counted: 20 } },
    },
    {
      at: "2026-11-03T21:00:00-05:00",
      asked: "Latest?",
      headline: "Ada wins",
      senate: { d: 51, r: 40, uncalled: 9, flips: 1 },
      results: {
        oh: { a: 52, b: 47, counted: 90, called: "a" },
        co: { a: 50, b: 48, counted: 70 },
      },
    },
  ],
};

function serve(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function show() {
  render(
    <NotesElection
      getToken={getToken}
      api={API}
      today="2026-11-04"
      onOpenNote={() => {}}
    />
  );
}

describe("NotesElection", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    clearExplore();
    global.fetch = realFetch;
  });

  it("opens on the newest update and marks calls, flips and his ballot", async () => {
    serve({ elections: [ELECTION] });
    show();
    expect(
      await screen.findByRole("heading", { name: "Town night" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ada wins").length).toBeGreaterThan(0);
    expect(screen.getByText("Flip")).toBeInTheDocument();
    expect(screen.getAllByText("Your ballot").length).toBe(2);
    expect(screen.getByText("Past 51")).toBeInTheDocument();
    expect(screen.getByText("You asked: “Latest?”")).toBeInTheDocument();
  });

  it("goes back in time with the slider", async () => {
    serve({ elections: [ELECTION] });
    show();
    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: "0" } });
    expect(
      screen.getByText("You asked: “How is it going”")
    ).toBeInTheDocument();
    expect(screen.queryByText("Flip")).not.toBeInTheDocument();
    expect(screen.queryByText("Town House")).not.toBeInTheDocument();
    expect(screen.getByText("51 for control")).toBeInTheDocument();
  });

  it("refreshes, then opens on the new moment", async () => {
    serve({ elections: [ELECTION] });
    show();
    await screen.findByRole("slider");
    const later = {
      ...ELECTION,
      updates: [
        ...ELECTION.updates,
        {
          at: "2026-11-03T22:00:00-05:00",
          headline: "Cy wins",
          results: { co: { a: 51, b: 48, counted: 90, called: "a" } },
        },
      ],
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ added: 1, why: "updated" }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ elections: [later] }),
      }) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("New results added.")).toBeInTheDocument();
    expect(screen.getByText(/update 3 of 3/)).toBeInTheDocument();
  });

  it("says when there is nothing new or the check fails", async () => {
    serve({ elections: [ELECTION] });
    show();
    await screen.findByRole("slider");
    serve({ added: 0, why: "nothing new" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Nothing new yet.")).toBeInTheDocument();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/Couldn't reach/)).toBeInTheDocument();
  });

  it("says so when there is nothing saved", async () => {
    serve({ elections: [] });
    show();
    expect(
      await screen.findByText("No election nights saved yet.")
    ).toBeInTheDocument();
  });
});
