import { render, screen } from "@testing-library/react";
import HeroContent from "../HeroContent";

describe("HeroContent", () => {
  it("renders the main content paragraph", () => {
    render(<HeroContent />);
    expect(
      screen.getByText(/I build products and lead teams/)
    ).toBeInTheDocument();
  });

  it("renders the second paragraph about CrossFit", () => {
    render(<HeroContent />);
    expect(
      screen.getByText(/Off the clock, you'll find me at the gym/)
    ).toBeInTheDocument();
  });

  it("includes technology mentions", () => {
    render(<HeroContent />);
    expect(screen.getByText(/React/)).toBeInTheDocument();
    expect(screen.getByText(/Next.js/)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/Node.js/)).toBeInTheDocument();
  });

  it("renders all technology stack items", () => {
    render(<HeroContent />);
    const technologies = [
      "React",
      "Next.js",
      "Node.js",
      "TypeScript",
      "Tailwind CSS",
      "Postgres",
      "Prisma",
      "GraphQL",
      "Docker",
      "Terraform",
      "GitHub Actions",
    ];

    technologies.forEach((tech) => {
      expect(screen.getByText(tech)).toBeInTheDocument();
    });
  });

  it("has proper paragraph structure", () => {
    render(<HeroContent />);
    const paragraphs = screen.getAllByText(/./);
    const contentParagraphs = paragraphs.filter(
      (p) =>
        p.textContent?.includes("I build products") ||
        p.textContent?.includes("Off the clock")
    );
    expect(contentParagraphs.length).toBeGreaterThan(0);
  });
});
