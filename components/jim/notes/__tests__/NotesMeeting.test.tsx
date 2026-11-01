import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MeetingCard } from "@/lib/jim/view";
import NotesMeeting from "../NotesMeeting";

const CARD: MeetingCard = {
  id: "0123456789abcdef",
  subject: "Roadmap sync",
  start: "2026-11-02T16:00:00Z",
  end: "2026-11-02T16:30:00Z",
  where: "Room 4",
  attendees: [
    {
      name: "Sam Okafor",
      role: "Design lead",
      path: "people/sam-okafor.md",
      last: "Oct 28",
      todos: ["Send the mockups"],
    },
    { name: "Pat Lindqvist", role: "", path: "", last: "", todos: [] },
  ],
};

const props = {
  onBack: jest.fn(),
  onOpenPath: jest.fn(),
  onHome: jest.fn(),
};

it("shows the meeting, linking an attendee who has a note", async () => {
  render(<NotesMeeting card={CARD} {...props} />);
  expect(
    screen.getByRole("heading", { name: "Roadmap sync" })
  ).toBeInTheDocument();
  expect(screen.getByText("Room 4")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Sam Okafor" });
  expect(link).toHaveAttribute("href", "/jim/notes/people/sam-okafor");
  await userEvent.click(link);
  expect(props.onOpenPath).toHaveBeenCalledWith("people/sam-okafor.md");
  expect(screen.getByText("Pat Lindqvist")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Pat Lindqvist" })).toBeNull();
});

it("lists open todos only for who has them", () => {
  render(<NotesMeeting card={CARD} {...props} />);
  expect(screen.getAllByRole("list")).toHaveLength(2);
  expect(screen.getByText("Send the mockups")).toBeInTheDocument();
  const pat = screen.getByText("Pat Lindqvist").closest("li")!;
  expect(within(pat).queryByRole("list")).toBeNull();
});

it("says when the meeting is gone", () => {
  render(<NotesMeeting card={undefined} {...props} homeHref="/jim/notes" />);
  expect(
    screen.getByText("This meeting isn't in the calendar anymore.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute(
    "href",
    "/jim/notes"
  );
});
