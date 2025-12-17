import { render, screen } from "@testing-library/react";
import Hero from "../Hero";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill, // eslint-disable-line @typescript-eslint/no-unused-vars
    priority: _priority, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props
  }: React.ComponentPropsWithoutRef<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
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

  it("renders the subtitle", () => {
    render(<Hero />);
    expect(screen.getByText("Software Leader & Developer")).toBeInTheDocument();
  });

  it("renders the main content text", () => {
    render(<Hero />);
    expect(
      screen.getByText(/I build products and lead teams/)
    ).toBeInTheDocument();
  });

  it("renders the image", () => {
    render(<Hero />);
    const image = screen.getByAltText("Gentry Riggen");
    expect(image).toBeInTheDocument();
  });
});
