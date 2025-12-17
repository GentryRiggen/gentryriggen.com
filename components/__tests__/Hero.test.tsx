import { render, screen } from "@testing-library/react";
import Hero from "../Hero";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("Hero", () => {
  it("renders the main heading", () => {
    render(<Hero />);
    expect(screen.getByText("GENTRY")).toBeInTheDocument();
    expect(screen.getByText("RIGGEN")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<Hero />);
    expect(screen.getByText(/Web & Mobile Developer/)).toBeInTheDocument();
    expect(
      screen.getByText(/Crafting digital experiences that hit different/)
    ).toBeInTheDocument();
  });

  it("renders the about section", () => {
    render(<Hero />);
    expect(screen.getByText("What I Do")).toBeInTheDocument();
    expect(
      screen.getByText(/I build products for clients/)
    ).toBeInTheDocument();
  });

  it("renders the image", () => {
    render(<Hero />);
    const image = screen.getByAltText("Gentry Riggen");
    expect(image).toBeInTheDocument();
  });
});
