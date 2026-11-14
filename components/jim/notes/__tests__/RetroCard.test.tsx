import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RetroData } from "@/lib/jim/view";
import RetroCard from "../RetroCard";

const RETRO: RetroData = {
  day: "2026-10-31",
  morning: {
    questions: ["What are you looking forward to?", "b?", "c?"],
    answers: null,
  },
  evening: {
    questions: ["What surprised you today?", "b?", "c?"],
    answers: ["x", "", ""],
  },
};

const at = (h: number, m = 0) => new Date(2026, 9, 31, h, m);

it("shows the morning retro before 15:00", async () => {
  const onOpen = jest.fn();
  render(
    <RetroCard
      retro={RETRO}
      now={at(14, 59)}
      onOpen={onOpen}
      hrefFor={(k) => `/jim/retro/${k}`}
    />
  );
  const link = screen.getByRole("link", { name: /Morning retro/ });
  expect(link).toHaveAttribute("href", "/jim/retro/morning");
  expect(link).toHaveTextContent("What are you looking forward to?");
  expect(screen.queryByText("Done")).not.toBeInTheDocument();
  await userEvent.click(link);
  expect(onOpen).toHaveBeenCalledWith("morning");
});

it("shows the evening retro from 15:00, Done once saved", () => {
  render(<RetroCard retro={RETRO} now={at(15)} onOpen={jest.fn()} />);
  const button = screen.getByRole("button", { name: /Evening retro/ });
  expect(button).toHaveTextContent("Done");
});

it("hides without retro data", () => {
  const { container } = render(
    <RetroCard retro={undefined} now={at(9)} onOpen={jest.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
});
