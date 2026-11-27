import { render, screen } from "@testing-library/react";
import Shipped from "../Shipped";
import { ShippedProvider } from "../ShippedContext";
import { summarizeReleases } from "../releases";

const CHANGELOGS = {
  shipwreck: [
    { version: "1.14.1", date: "2026-11-28", title: "A small fix" },
    { version: "1.14.0", date: "2026-11-27", title: "Any ship in any wreck" },
    { version: "1.13.0", date: "2026-11-20", title: "Older" },
  ],
  flamelings: [
    { version: "2.1.1", date: "2026-11-21", title: "Patch" },
    { version: "2.1.0", date: "2026-11-27", title: "Tap to explain" },
  ],
  "planet-smasher": [
    { version: "1.0.1", date: "2026-11-16", title: "Only patches here" },
  ],
};

describe("summarizeReleases", () => {
  const summary = summarizeReleases(CHANGELOGS);

  it("takes each game's newest feature release, newest first", () => {
    expect(
      summary.latest.map((r) => [r.gameId, r.version, r.date, r.href])
    ).toEqual([
      ["shipwreck", "1.14.0", "Nov 27", "/shipwreck/versions"],
      ["flamelings", "2.1.0", "Nov 27", "/flamelings/versions"],
      ["planet-smasher", "1.0.1", "Nov 16", "/planet-smasher/versions"],
    ]);
  });

  it("counts every release of every game", () => {
    expect(summary.total).toBe(6);
  });

  it("skips games with no changelog", () => {
    expect(summary.latest.some((r) => r.gameId === "ship-builder")).toBe(false);
  });
});

it("renders the releases as done todos linking to each changelog", () => {
  render(
    <ShippedProvider shipped={summarizeReleases(CHANGELOGS)}>
      <Shipped />
    </ShippedProvider>
  );
  expect(
    screen.getByRole("link", { name: "Shipwreck 1.14.0" })
  ).toHaveAttribute("href", "/shipwreck/versions");
  expect(screen.getByText(": Any ship in any wreck")).toBeInTheDocument();
  expect(screen.getByText(/6 releases shipped/)).toBeInTheDocument();
});
