import { render, screen } from "@testing-library/react";
import Header from "../Header";

describe("Header", () => {
  it("renders the site title", () => {
    render(<Header />);
    expect(screen.getByText("Gentry Riggen")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Header />);
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("has correct href attributes", () => {
    render(<Header />);
    const aboutLink = screen.getByText("About");
    const contactLink = screen.getByText("Contact");

    expect(aboutLink).toHaveAttribute("href", "#about");
    expect(contactLink).toHaveAttribute("href", "#contact");
  });
});

