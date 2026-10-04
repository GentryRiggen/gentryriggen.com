import { render, screen, within } from "@testing-library/react";
import { CHANGELOG } from "@/lib/ship-builder/changelog";
import { SHIP_BUILDER_VERSION } from "@/lib/ship-builder/version";
import ShipBuilderVersionsPage from "../page";

describe("Ship Builder versions page", () => {
  it("lists every release, newest first, with its highlights", () => {
    render(<ShipBuilderVersionsPage />);
    const releases = screen.getAllByRole("article");
    expect(releases).toHaveLength(CHANGELOG.length);
    expect(releases[0]).toHaveTextContent(`v${CHANGELOG[0].version}`);
    for (const highlight of CHANGELOG[0].highlights) {
      expect(within(releases[0]).getByText(highlight)).toBeInTheDocument();
    }
  });

  it("shows the current version and links back to the game", () => {
    render(<ShipBuilderVersionsPage />);
    expect(
      screen.getByText(`You're on v${SHIP_BUILDER_VERSION}`)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to ship builder/i })
    ).toHaveAttribute("href", "/ship-builder");
  });
});
