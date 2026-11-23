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

it("shows the Flamelings section, with no pet names to show", () => {
  const fl = (
    name: GameEvent["name"],
    props: GameEvent["props"]
  ): GameEvent => ({
    site: "flamelings",
    name,
    props,
    day: "2026-11-16",
  });
  render(
    <GamesView
      events={[
        fl("fl_visit", { window: "morning", pets: 3 }),
        fl("fl_hatch", {}),
        fl("fl_play_end", { game: "logs", score: 12 }),
        fl("fl_form", { form: "sparkly" }),
        fl("fl_level", { level: 4, stage: "flicker" }),
        fl("fl_unlock", { kind: "hat", via: "gift" }),
        fl("fl_buy", { kind: "decor", price: 120 }),
        fl("fl_happening", { kind: "treasure", done: 1 }),
        fl("fl_friend", { action: "visited" }),
      ]}
    />
  );
  expect(screen.getByTestId("flamelings-visits")).toHaveTextContent("1");
  expect(screen.getByTestId("flamelings-hatches")).toHaveTextContent("1");
  expect(screen.getByTestId("flamelings-purchases")).toHaveTextContent("1");
  expect(screen.getByTestId("flamelings-spent")).toHaveTextContent("120");
  expect(screen.getByTestId("flamelings-happenings")).toHaveTextContent("1");
  expect(screen.getByText("treasure · done")).toBeInTheDocument();
  expect(screen.getByText("visited")).toBeInTheDocument();
  expect(screen.getByTestId("flamelings-averages")).toHaveTextContent(
    "3.0 pets per visit · 12.0 points per round · highest level 4"
  );
  expect(screen.getByText("hat · gift")).toBeInTheDocument();
});

it("shows the Shipwreck section", () => {
  const sw = (
    name: GameEvent["name"],
    props: GameEvent["props"]
  ): GameEvent => ({
    site: "shipwreck",
    name,
    props,
    day: "2026-11-20",
  });
  render(
    <GamesView
      events={[
        sw("shipwreck_start", { mode: "real", opened: 0 }),
        sw("shipwreck_start", {
          mode: "whatif",
          opened: 4,
          ship: "lusitania",
        }),
        sw("shipwreck_end", { mode: "real", outcome: "sank", minutes: 160 }),
        sw("shipwreck_end", {
          mode: "whatif",
          outcome: "floated",
          minutes: 300,
          ship: "lusitania",
        }),
        sw("shipwreck_start", {
          mode: "real",
          opened: 0,
          ship: "fitzgerald",
        }),
        sw("shipwreck_end", {
          mode: "real",
          outcome: "sank",
          minutes: 20,
          ship: "fitzgerald",
        }),
        sw("shipwreck_start", {
          mode: "whatif",
          opened: 2,
          ship: "britannic",
        }),
        sw("shipwreck_end", {
          mode: "whatif",
          outcome: "sank",
          minutes: 70,
          ship: "britannic",
        }),
        sw("shipwreck_camera", { camera: "bridge" }),
      ]}
    />
  );
  expect(screen.getByTestId("shipwreck-starts")).toHaveTextContent("4");
  expect(screen.getByTestId("shipwreck-sank")).toHaveTextContent("3");
  expect(screen.getByTestId("shipwreck-floated")).toHaveTextContent("1");
  expect(screen.getByText("whatif · floated")).toBeInTheDocument();
  expect(screen.getByText("bridge")).toBeInTheDocument();
  // An event without a ship is from before the Lusitania: the Titanic.
  expect(screen.getByText("titanic")).toBeInTheDocument();
  expect(screen.getByText("lusitania")).toBeInTheDocument();
  expect(screen.getByText("lusitania · floated")).toBeInTheDocument();
  expect(screen.getByText("titanic · sank")).toBeInTheDocument();
  expect(screen.getByText("fitzgerald")).toBeInTheDocument();
  expect(screen.getByText("fitzgerald · sank")).toBeInTheDocument();
  expect(screen.getByText("britannic")).toBeInTheDocument();
  expect(screen.getByText("britannic · sank")).toBeInTheDocument();
  expect(screen.getByTestId("shipwreck-averages")).toHaveTextContent(
    "What if? openings: lusitania 4.0, britannic 2.0 · sank after 83 min on average"
  );
});
