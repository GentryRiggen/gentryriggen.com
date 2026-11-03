import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MONEY_FIXTURE, VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import type { MoneyState } from "@/lib/jim/money";
import { AmazonSection, MoneyGridSection } from "../MoneyExtras";
import NotesMoney from "../NotesMoney";
import NotesYear, { yearDetail } from "../NotesYear";

const DATES = VIEW_FIXTURE.yearDates!;

describe("NotesYear", () => {
  it("draws the wheel and lists dates by month with gift status", async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    render(<NotesYear data={VIEW_FIXTURE} onOpen={onOpen} />);
    expect(
      screen.getByRole("img", {
        name: "4 dates in the next 12 months: 2 birthdays, 1 anniversaries, 1 renewals",
      })
    ).toBeInTheDocument();
    const nov = screen.getByRole("region", { name: "November 2026" });
    expect(within(nov).getByText("Jordan Lee")).toBeInTheDocument();
    expect(within(nov).getByText("2 gift ideas, none chosen.")).toHaveClass(
      "text-ayu-orange"
    );
    expect(within(nov).getByText("in 3d")).toBeInTheDocument();
    const mar = screen.getByRole("region", { name: "March 2027" });
    expect(within(mar).getByText("Gift chosen.")).toHaveClass("text-ayu-green");
    await user.click(within(nov).getByRole("button", { name: /Jordan Lee/ }));
    expect(onOpen).toHaveBeenCalledWith("people/jordan-lee.md");
  });

  it("words approximate and unconfirmed dates", () => {
    expect(yearDetail(DATES[0])).toBe("birthday · unconfirmed");
    expect(yearDetail({ ...DATES[0], turns: 30 })).toBe(
      "turns ~30 · unconfirmed"
    );
    expect(yearDetail(DATES[2])).toBe("turns 41 · sometime in March");
    expect(yearDetail(DATES[3])).toBe("anniversary · sometime in June");
  });

  it("is calm without year data", () => {
    render(
      <NotesYear
        data={{ ...VIEW_FIXTURE, yearDates: undefined }}
        onOpen={() => {}}
      />
    );
    expect(screen.getByText(/once Jim sends it/)).toBeInTheDocument();
  });
});

describe("the money grid", () => {
  it("groups rows, flags cells and keeps the first column sticky", () => {
    render(<MoneyGridSection grid={MONEY_FIXTURE.grid!} />);
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Aug 26" })
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Garden" })
    ).toBeInTheDocument();
    expect(within(table).getByText("$320")).toHaveClass("text-ayu-red");
    expect(within(table).getByText("$40")).toHaveClass("text-ayu-blue");
    expect(within(table).getByRole("rowheader", { name: /Seeds/ })).toHaveClass(
      "sticky"
    );
    expect(within(table).getByText("fixed")).toBeInTheDocument();
  });
});

describe("the Amazon section", () => {
  it("charts months and filters the items by a tapped category", async () => {
    const user = userEvent.setup();
    render(<AmazonSection amazon={MONEY_FIXTURE.amazon!} />);
    expect(
      screen.getByRole("img", {
        name: "Amazon spending per month: Sep $96, Oct so far $25",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Items").parentElement).toHaveTextContent("4");
    expect(screen.getByText("+$15")).toHaveClass("text-ayu-green");
    await user.click(screen.getByRole("button", { name: "Kitchen" }));
    expect(screen.getByText("Kitchen items")).toBeInTheDocument();
    expect(screen.queryByText("Pruning shears")).toBeNull();
    expect(screen.getByText("Spice rack")).toBeInTheDocument();
    expect(screen.getByText("3×")).toBeInTheDocument();
  });
});

describe("NotesMoney with the newer sections", () => {
  function state(data = MONEY_FIXTURE): MoneyState {
    return {
      status: "ready",
      data,
      error: null,
      reload: async () => {},
    };
  }

  it("shows the share line, grid and Amazon", () => {
    render(<NotesMoney money={state()} />);
    expect(screen.getByText(MONEY_FIXTURE.share!.line)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "By category" })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Amazon" })).toBeInTheDocument();
  });

  it("hides them for an older server", () => {
    render(
      <NotesMoney
        money={state({
          ...MONEY_FIXTURE,
          grid: null,
          share: null,
          amazon: null,
        })}
      />
    );
    expect(screen.queryByRole("region", { name: "By category" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Amazon" })).toBeNull();
  });
});
