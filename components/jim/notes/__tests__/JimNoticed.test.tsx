import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Noticed } from "@/lib/jim/view";
import JimNoticed from "../JimNoticed";

const row = (i: number, tone: Noticed["tone"] = ""): Noticed => ({
  kind: "Todo",
  title: `Thing ${i}`,
  when: `When ${i}`,
  tone,
  ask: `Ask about ${i}`,
});

it("shows at most five rows in order and asks with the row's phrase", async () => {
  const onAsk = jest.fn();
  render(
    <JimNoticed items={[1, 2, 3, 4, 5, 6].map((i) => row(i))} onAsk={onAsk} />
  );
  const titles = screen.getAllByText(/^Thing \d$/).map((e) => e.textContent);
  expect(titles).toEqual([
    "Thing 1",
    "Thing 2",
    "Thing 3",
    "Thing 4",
    "Thing 5",
  ]);
  await userEvent.click(
    screen.getByRole("button", { name: "Ask Jim: Thing 2" })
  );
  expect(onAsk).toHaveBeenCalledWith("Ask about 2");
});

it("colors the time by tone", () => {
  render(<JimNoticed items={[row(1, "over")]} onAsk={jest.fn()} />);
  expect(screen.getByText("When 1")).toHaveClass("text-ayu-red");
});

it("renders nothing when empty", () => {
  const { container } = render(<JimNoticed items={[]} onAsk={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
