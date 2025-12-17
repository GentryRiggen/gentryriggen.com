import { render, screen } from "@testing-library/react";
import Footer from "../Footer";

describe("Footer", () => {
  it("renders the copyright text", () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen. All rights reserved.`)
    ).toBeInTheDocument();
  });

  it("renders social media links", () => {
    render(<Footer />);
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Twitter")).toBeInTheDocument();
  });

  it("has correct target and rel attributes for external links", () => {
    render(<Footer />);
    const githubLink = screen.getByText("GitHub");
    const linkedinLink = screen.getByText("LinkedIn");
    const twitterLink = screen.getByText("Twitter");

    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(linkedinLink).toHaveAttribute("target", "_blank");
    expect(twitterLink).toHaveAttribute("target", "_blank");
  });
});

