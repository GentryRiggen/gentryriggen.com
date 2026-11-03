import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type { DirectoryPerson, WorkMeeting } from "@/lib/jim/view";
import NotesWork from "../NotesWork";
import OrgTree, { buildOrg, MAX_INDENT_LEVELS } from "../OrgTree";
import WorkMeetings, {
  meetingMatches,
  projectWords,
  topCounts,
} from "../WorkMeetings";

const MEETINGS = VIEW_FIXTURE.work!.meetings;

function renderMeetings(meetings: WorkMeeting[] = MEETINGS) {
  const onOpenMeeting = jest.fn();
  render(<WorkMeetings meetings={meetings} onOpenMeeting={onOpenMeeting} />);
  return { onOpenMeeting };
}

function person(
  id: number,
  name: string,
  managerId: number | null
): DirectoryPerson {
  return {
    id,
    name,
    title: "",
    team: "",
    location: "",
    email: "",
    cell: "",
    birthday: "",
    anniversary: "",
    disc: "",
    discGloss: "",
    strengths: [],
    managerId,
    managerName: "",
    reportIds: [],
    path: "",
  };
}

describe("WorkMeetings", () => {
  it("shows decisions, steps and the transcript in a meeting's disclosure", () => {
    renderMeetings();
    expect(screen.getByText("1 decision · 3 next steps")).toBeInTheDocument();
    expect(
      screen.getByText("Spring beds go along the south fence")
    ).toBeInTheDocument();
    expect(screen.getByText("No owner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Transcript/ })).toHaveAttribute(
      "href",
      "https://notes.example.test/t/1"
    );
    expect(screen.getByText("Garden sync")).toBeInTheDocument();
  });

  it("splits next steps into yours and everyone else's", async () => {
    const user = userEvent.setup();
    const { onOpenMeeting } = renderMeetings();
    await user.click(screen.getByRole("tab", { name: "Next steps" }));
    const yours = screen.getByText("Yours").closest("div")!;
    expect(within(yours).getByText("Order the cedar boards")).toBeVisible();
    expect(within(yours).queryByText("Sketch the bed layout")).toBeNull();
    const rest = screen.getByText("Everyone else").closest("div")!;
    expect(within(rest).getByText("Sketch the bed layout")).toBeVisible();
    expect(within(rest).getByText("Check the soil test results")).toBeVisible();
    await user.click(
      within(yours).getByRole("button", { name: /Garden planning/ })
    );
    expect(onOpenMeeting).toHaveBeenCalledWith(
      "meetings/2026-10-30-garden-planning.md"
    );
  });

  it("lists decisions with the meeting they came from", async () => {
    const user = userEvent.setup();
    renderMeetings();
    await user.click(screen.getByRole("tab", { name: "Decisions" }));
    expect(
      screen.getByText("Spring beds go along the south fence")
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Oct 30 · Garden planning/ })
    ).toBeVisible();
  });

  it("filters by a person chip and clears on a second tap", async () => {
    const user = userEvent.setup();
    renderMeetings();
    const group = screen.getByRole("group", { name: "Filter by person" });
    const ava = within(group).getByRole("button", { name: /Ava Torres/ });
    await user.click(ava);
    expect(ava).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Harvest review")).toBeNull();
    await user.click(ava);
    expect(screen.getByText("Harvest review")).toBeVisible();
  });

  it("hides the switch and chips for an older server's meetings", () => {
    renderMeetings([
      { ...MEETINGS[1], steps: undefined, decisions: undefined },
    ]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByText("Harvest review")).toBeVisible();
  });

  it("finds a meeting by its project in words", () => {
    const m = { ...MEETINGS[0], projects: ["forecasting-tool"] };
    expect(projectWords("forecasting-tool")).toBe("forecasting tool");
    expect(meetingMatches(m, ["forecasting", "tool"], "", "")).toBe(true);
    expect(meetingMatches(m, ["forecasting tool"], "", "")).toBe(true);
    expect(meetingMatches(m, ["budget"], "", "")).toBe(false);
  });

  it("counts chips most-met first and keeps a picked one past the cap", () => {
    const names = Array.from({ length: 12 }, (_, i) => `P${i}`);
    const counts = topCounts([...names, "P3", "P3"], "P9");
    expect(counts[0]).toEqual({ key: "P3", n: 3 });
    expect(counts).toHaveLength(11);
    expect(counts.at(-1)).toEqual({ key: "P9", n: 1 });
  });
});

describe("the org chart", () => {
  it("builds manager trees, biggest first, and survives a loop", () => {
    const roots = buildOrg({
      updated: "",
      people: [
        person(0, "Lone Wolf", null),
        person(1, "Sam Okafor", null),
        person(2, "Priya Lane", 1),
        person(3, "Jo Park", 2),
        person(4, "Loop A", 5),
        person(5, "Loop B", 4),
        person(6, "Orphan", 99),
      ],
    });
    expect(roots.map((r) => [r.person.name, r.total])).toEqual([
      ["Sam Okafor", 2],
      ["Loop A", 1],
      ["Lone Wolf", 0],
      ["Orphan", 0],
    ]);
    expect(roots[0].reports[0].reports[0].person.name).toBe("Jo Park");
  });

  it("stops stepping in after a few levels, so a deep name keeps its room", async () => {
    const user = userEvent.setup();
    // A chain nine deep: Level 0 manages Level 1, who manages Level 2...
    const chain = Array.from({ length: 9 }, (_, i) =>
      person(i, `Level ${i}`, i === 0 ? null : i - 1)
    );
    render(
      <OrgTree directory={{ updated: "", people: chain }} onOpen={() => {}} />
    );
    for (let i = 1; i < 8; i++) {
      await user.click(
        screen.getByRole("button", { name: `Show Level ${i}'s team` })
      );
    }
    const deepest = screen.getByText("Level 8");
    expect(deepest).toBeVisible();
    let steps = 0;
    for (let el = deepest.parentElement; el; el = el.parentElement) {
      if (el.tagName === "UL" && el.dataset.indented) steps++;
    }
    expect(steps).toBe(MAX_INDENT_LEVELS);
  });

  it("switches the directory to the org chart, folds a team and opens a card", async () => {
    const user = userEvent.setup();
    const onOpenPerson = jest.fn();
    render(
      <NotesWork
        data={VIEW_FIXTURE}
        onOpenMeeting={() => {}}
        onOpenPerson={onOpenPerson}
      />
    );
    await user.click(screen.getByRole("tab", { name: "Org chart" }));
    const tree = screen.getByRole("list", { name: "Org chart" });
    expect(within(tree).getByText("Ava Torres")).toBeVisible();
    await user.click(
      within(tree).getByRole("button", { name: "Hide Quinn Hale's team" })
    );
    expect(within(tree).queryByText("Ava Torres")).toBeNull();
    await user.click(within(tree).getByRole("button", { name: /^Quinn Hale/ }));
    expect(onOpenPerson).toHaveBeenCalledWith(0);
  });
});
