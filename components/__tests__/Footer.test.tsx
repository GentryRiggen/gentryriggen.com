import { render, screen } from "@testing-library/react";
import Footer from "../Footer";

describe("Footer", () => {
  it("renders the call to action text", () => {
    render(<Footer />);
    expect(
      screen.getByText("Let's build something incredible together.")
    ).toBeInTheDocument();
  });

  it("renders the LinkedIn link with correct attributes", () => {
    render(<Footer />);
    const linkedinLink = screen.getByRole("link", { name: "LinkedIn" });
    expect(linkedinLink).toBeInTheDocument();
    expect(linkedinLink).toHaveAttribute(
      "href",
      "https://linkedin.com/in/gentryriggen"
    );
    expect(linkedinLink).toHaveAttribute("target", "_blank");
    expect(linkedinLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the GitHub link with correct attributes", () => {
    render(<Footer />);
    const githubLink = screen.getByRole("link", { name: "GitHub" });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/gentryriggen"
    );
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the copyright text", () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeInTheDocument();
  });
});
