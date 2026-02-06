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
  it("renders the terminal window", () => {
    renderWithTheme(<Home />);
    expect(
      screen.getByText("gentry@portfolio ~ (bash)")
    ).toBeInTheDocument();
  });

  it("renders the footer with copyright", () => {
    renderWithTheme(<Home />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    renderWithTheme(<Home />);
    expect(
      screen.getByRole("button", { name: "Toggle theme" })
    ).toBeInTheDocument();
  });
});
