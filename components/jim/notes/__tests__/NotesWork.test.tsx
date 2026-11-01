import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type {
  DirectoryPerson,
  Person,
  ViewData,
  WorkDirectory,
} from "@/lib/jim/view";
import NotesWork from "../NotesWork";
import WinsChart from "../WinsChart";
import { DirectoryCard } from "../WorkDirectory";

const WORK = VIEW_FIXTURE.work!;

function person(
  id: number,
  name: string,
  extra: Partial<DirectoryPerson> = {}
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
    managerId: null,
    managerName: "",
    reportIds: [],
    path: "",
    ...extra,
  };
}

/** A card that follows its own taps, like NotesShell does. */
function Card({
  directory,
  start,
  people = [],
  onProfile = () => {},
}: {
  directory: WorkDirectory;
  start: number;
  people?: Person[];
  onProfile?: (path: string) => void;
}) {
  const [id, setId] = useState(start);
  return (
    <DirectoryCard
      directory={directory}
      id={id}
      people={people}
      onOpen={setId}
      onProfile={onProfile}
      onBack={() => {}}
    />
  );
}

function renderWork(data: ViewData = VIEW_FIXTURE) {
  const onOpenMeeting = jest.fn();
  const onOpenPerson = jest.fn();
  render(
    <NotesWork
      data={data}
      onOpenMeeting={onOpenMeeting}
      onOpenPerson={onOpenPerson}
    />
  );
  return { onOpenMeeting, onOpenPerson };
}

describe("NotesWork", () => {
  it("shows each team member's next 1:1, wins count and latest wins", () => {
    renderWork();
    const team = screen.getByRole("region", { name: "Team" });
    const ava = within(team).getByRole("article", { name: "Ava Torres" });
    expect(within(ava).getByText("Leads the garden map project")).toBeVisible();
    expect(within(ava).getByText("Tue, Nov 3")).toBeVisible();
    expect(within(ava).getByText("in 3 days")).toBeVisible();
    expect(within(ava).getByText("2 wins")).toBeVisible();
    expect(
      within(ava).getByText("Ava: shipped the seed catalog")
    ).toBeVisible();
    const ben = within(team).getByRole("article", { name: "Ben Ruiz" });
    expect(within(ben).getByText("None booked")).toBeVisible();
    expect(within(ben).getByText("0 wins")).toBeVisible();
  });

  it("charts wins per week with a legend for each key", () => {
    renderWork();
    const chart = screen.getByRole("region", { name: "Wins per week" });
    const legend = within(chart).getByRole("list", { name: "Legend" });
    for (const key of ["You", "Ava", "Ben"]) {
      expect(within(legend).getByText(key)).toBeVisible();
    }
    expect(
      within(chart).getByRole("img", { name: /Week of Oct 26: 3 wins/ })
    ).toBeInTheDocument();
  });

  it("caps the chart at three keys and twelve weeks", () => {
    const weeks = Array.from({ length: 14 }, (_, i) => ({
      week: `2026-08-${String(i + 1).padStart(2, "0")}`,
      counts: { A: 1, B: 1, C: 1, D: 1 },
    }));
    render(<WinsChart weeks={weeks} keys={["A", "B", "C", "D"]} />);
    expect(screen.getAllByRole("img")).toHaveLength(12);
    expect(screen.queryByText("D")).toBeNull();
  });

  it("narrows meetings by a person's name and opens the tapped one", async () => {
    const user = userEvent.setup();
    const { onOpenMeeting } = renderWork();
    const meetings = screen.getByRole("region", { name: "Meetings" });
    expect(within(meetings).getByText("Garden planning")).toBeVisible();
    expect(within(meetings).getByText("Harvest review")).toBeVisible();
    await user.type(within(meetings).getByLabelText("Search meetings"), "ava");
    expect(within(meetings).getByText("Garden planning")).toBeVisible();
    expect(within(meetings).queryByText("Harvest review")).toBeNull();
    await user.click(
      within(meetings).getByRole("button", { name: /Garden planning/ })
    );
    expect(onOpenMeeting).toHaveBeenCalledWith(
      "meetings/2026-10-30-garden-planning.md"
    );
  });

  it("finds a directory person and asks to open their card", async () => {
    const user = userEvent.setup();
    const { onOpenPerson } = renderWork();
    const dir = screen.getByRole("region", { name: "Directory" });
    await user.type(within(dir).getByLabelText("Search the directory"), "gard");
    await user.click(within(dir).getByRole("button", { name: /Quinn Hale/ }));
    expect(onOpenPerson).toHaveBeenCalledWith(0);
  });

  it("says calmly when there is no work data", () => {
    renderWork({ ...VIEW_FIXTURE, work: undefined });
    expect(screen.getByText(/No work notes yet/)).toBeVisible();
  });
});

describe("DirectoryCard", () => {
  it("shows B's manager A; tapping A shows A's reports", async () => {
    const user = userEvent.setup();
    render(<Card directory={WORK.directory} start={1} />);
    expect(screen.getByRole("heading", { name: "Ava Torres" })).toBeVisible();
    const chain = screen.getByRole("navigation", { name: "Reports to" });
    await user.click(within(chain).getByRole("button", { name: "Quinn Hale" }));
    expect(screen.getByRole("heading", { name: "Quinn Hale" })).toBeVisible();
    const reports = screen.getByRole("region", { name: "Direct reports" });
    expect(
      within(reports).getByRole("button", { name: /Ava Torres/ })
    ).toBeVisible();
  });

  it("shows DISC, strengths and contact links", () => {
    render(<Card directory={WORK.directory} start={0} />);
    expect(screen.getByText("D/C")).toBeVisible();
    expect(screen.getByText(/Direct and careful/)).toBeVisible();
    expect(screen.getByText("Achiever")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /quinn@example.test/ })
    ).toHaveAttribute("href", "mailto:quinn%40example.test");
    expect(screen.getByRole("link", { name: /555-0100/ })).toHaveAttribute(
      "href",
      "tel:5550100"
    );
  });

  it("shows an unknown manager as plain text", () => {
    const directory = {
      updated: "",
      people: [person(0, "Rory Vale", { managerName: "Sky Moss" })],
    };
    render(<Card directory={directory} start={0} />);
    expect(screen.getByText("Sky Moss")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sky Moss" })).toBeNull();
  });

  it("stops walking a manager cycle", () => {
    const directory = {
      updated: "",
      people: [
        person(0, "Ash One", { managerId: 1, managerName: "Bay Two" }),
        person(1, "Bay Two", { managerId: 0, managerName: "Ash One" }),
      ],
    };
    render(<Card directory={directory} start={0} />);
    const chain = screen.getByRole("navigation", { name: "Reports to" });
    expect(within(chain).getAllByRole("button")).toHaveLength(1);
  });

  it("offers the profile when the person has a people note", async () => {
    const user = userEvent.setup();
    const onProfile = jest.fn();
    const ava: Person = {
      ...VIEW_FIXTURE.people[0],
      path: "people/ava-torres.md",
    };
    render(
      <Card
        directory={WORK.directory}
        start={1}
        people={[ava]}
        onProfile={onProfile}
      />
    );
    await user.click(screen.getByRole("button", { name: "Open profile" }));
    expect(onProfile).toHaveBeenCalledWith("people/ava-torres.md");
  });

  it("builds no link from a hostile contact string", () => {
    const directory = {
      updated: "",
      people: [
        person(0, "Rory Vale", {
          email: "javascript:alert(1)",
          cell: "call me",
        }),
      ],
    };
    render(<Card directory={directory} start={0} />);
    for (const link of screen.queryAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^(mailto|tel):/);
    }
    expect(screen.queryByRole("link", { name: /call me/ })).toBeNull();
  });
});
