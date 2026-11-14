import { render, screen } from "@testing-library/react";
import { PLANET_SMASHER_VERSION } from "@/lib/planet-smasher/version";
import VersionLink from "../VersionLink";

it("links to the versions page with the current version", () => {
  render(<VersionLink />);
  const link = screen.getByRole("link", { name: /what's new/i });
  expect(link).toHaveAttribute("href", "/planet-smasher/versions");
  expect(link).toHaveTextContent(`v${PLANET_SMASHER_VERSION}`);
});
