import { render, screen } from "@testing-library/react";
import Home from "../page";

describe("Home Page", () => {
  it("renders the hero section", () => {
    render(<Home />);
    expect(screen.getByText(/Hello, I'm/)).toBeInTheDocument();
  });

  it("renders the about section", () => {
    render(<Home />);
    expect(screen.getByLabelText("About section")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });

  it("renders the contact section", () => {
    render(<Home />);
    expect(screen.getByLabelText("Contact section")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Contact" })
    ).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<Home />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen. All rights reserved.`)
    ).toBeInTheDocument();
  });
});

