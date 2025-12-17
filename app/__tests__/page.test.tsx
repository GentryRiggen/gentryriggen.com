import { render, screen } from "@testing-library/react";
import Home from "../page";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ComponentPropsWithoutRef<"img">) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("Home Page", () => {
  it("renders the hero section", () => {
    render(<Home />);
    expect(screen.getByText("GENTRY")).toBeInTheDocument();
    expect(screen.getByText("RIGGEN")).toBeInTheDocument();
  });

  it("renders the about section", () => {
    render(<Home />);
    expect(screen.getByText("What I Do")).toBeInTheDocument();
  });

  it("renders the footer with contact section", () => {
    render(<Home />);
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen. All rights reserved.`)
    ).toBeInTheDocument();
  });
});
