import { render, screen, within } from "@testing-library/react";
import GamesView from "../GamesView";
import type { GameEvent } from "@/lib/analytics/gameEvents";

function end(over: Record<string, string | number>): GameEvent {
  return {
    site: "plane-builder",
    name: "flight_end",
    day: "2026-10-30",
    props: {
      world: "canyon",
      outcome: "crash",
      dist: 3,
      crashX: 150,
      obstacle: "arch",
      tiers: 4,
      daily: 0,
      ...over,
    },
  };
}

it("shows empty states with no events", () => {
  render(<GamesView events={[]} />);
  expect(screen.getByText("No flights in this range")).toBeInTheDocument();
  expect(screen.getByTestId("plane-flights")).toHaveTextContent("0");
});

it("shows the finish rate, crash heatmap and obstacles per world", () => {
  render(
    <GamesView
      events={[
        end({}),
        end({ outcome: "finish", crashX: -1, obstacle: "none", dist: 10 }),
      ]}
    />
  );
  const card = screen.getByTestId("world-canyon");
  expect(card).toHaveTextContent("2 flights · 50% finish");
  expect(
    within(card).getByRole("img", {
      name: "Crashes along the course: 1 crashes",
    })
  ).toBeInTheDocument();
  expect(card).toHaveTextContent("Most hit: arch (1)");
});

it("renders stored values as plain text, never as markup", () => {
  const hostile: GameEvent = {
    site: "ship-builder",
    name: "template_used",
    day: "2026-10-30",
    props: { template: "titanic" },
  };
  const { container } = render(<GamesView events={[hostile]} />);
  expect(screen.getByText("titanic")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
});

it("shows a star distribution for each challenge", () => {
  render(
    <GamesView
      events={[
        {
          site: "ship-builder",
          name: "challenge_result",
          day: "2026-10-30",
          props: { id: "outlast", stars: 2 },
        },
      ]}
    />
  );
  expect(
    within(screen.getByTestId("challenge-outlast")).getByRole("img", {
      name: "Outlast: stars: 1 results",
    })
  ).toBeInTheDocument();
});
