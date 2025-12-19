import { render, screen } from "@testing-library/react";
import HeroHeader from "../HeroHeader";

describe("HeroHeader", () => {
  it("renders the main heading with GENTRY and RIGGEN", () => {
    render(<HeroHeader />);
    expect(screen.getByText("GENTRY")).toBeInTheDocument();
    expect(screen.getByText("RIGGEN")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<HeroHeader />);
    expect(screen.getByText("Software Leader & Developer")).toBeInTheDocument();
  });

  it("has proper heading structure", () => {
    render(<HeroHeader />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("GENTRY");
    expect(heading).toHaveTextContent("RIGGEN");
  });

  it("applies correct CSS classes for styling", () => {
    render(<HeroHeader />);
    const container = screen.getByText("GENTRY").closest("div");
    expect(container).toHaveClass("text-center");
  });
});
