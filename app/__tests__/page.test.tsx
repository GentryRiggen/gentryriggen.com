import { render, screen } from "@testing-library/react";
import Home from "../page";
import { ThemeProvider } from "@/components/ThemeProvider";

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

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe("Home Page", () => {
  it("renders the hero section", () => {
    renderWithTheme(<Home />);
    expect(screen.getByText("GENTRY")).toBeInTheDocument();
    expect(screen.getByText("RIGGEN")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    renderWithTheme(<Home />);
    expect(screen.getByText("Software Leader & Developer")).toBeInTheDocument();
  });

  it("renders the footer with copyright", () => {
    renderWithTheme(<Home />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeInTheDocument();
  });

  it("renders social media links", () => {
    renderWithTheme(<Home />);
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
  });
});
