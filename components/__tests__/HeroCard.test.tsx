import { render, screen } from "@testing-library/react";
import HeroCard from "../HeroCard";

describe("HeroCard", () => {
  it("renders children content", () => {
    render(
      <HeroCard>
        <div>Test Content</div>
      </HeroCard>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("applies correct CSS classes for card styling", () => {
    const { container } = render(
      <HeroCard>
        <div>Test</div>
      </HeroCard>
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("bg-gray-100/80");
    expect(card).toHaveClass("dark:bg-white/5");
    expect(card).toHaveClass("backdrop-blur-sm");
    expect(card).toHaveClass("rounded-2xl");
  });

  it("renders multiple children", () => {
    render(
      <HeroCard>
        <div>First Child</div>
        <div>Second Child</div>
      </HeroCard>
    );
    expect(screen.getByText("First Child")).toBeInTheDocument();
    expect(screen.getByText("Second Child")).toBeInTheDocument();
  });

  it("has proper flex layout classes", () => {
    const { container } = render(
      <HeroCard>
        <div>Test</div>
      </HeroCard>
    );
    const innerDiv = container.querySelector(".flex");
    expect(innerDiv).toBeInTheDocument();
    expect(innerDiv).toHaveClass("flex-col");
    expect(innerDiv).toHaveClass("md:flex-row");
  });
});
