import { render, screen } from "@testing-library/react";
import Hero from "../Hero";

describe("Hero", () => {
  it("renders the main heading", () => {
    render(<Hero />);
    expect(screen.getByText(/Hello, I'm/)).toBeInTheDocument();
    expect(screen.getByText("Gentry Riggen")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<Hero />);
    expect(
      screen.getByText(
        /Building modern web experiences with clean code and thoughtful design/
      )
    ).toBeInTheDocument();
  });

  it("renders call-to-action buttons", () => {
    render(<Hero />);
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
    expect(screen.getByText("Learn More")).toBeInTheDocument();
  });

  it("has correct href attributes for buttons", () => {
    render(<Hero />);
    const contactButton = screen.getByText("Get in Touch");
    const learnMoreButton = screen.getByText("Learn More");

    expect(contactButton).toHaveAttribute("href", "#contact");
    expect(learnMoreButton).toHaveAttribute("href", "#about");
  });
});

