import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("✻ claude — ~/gentry")).toBeInTheDocument();
  });

  it("renders the footer with copyright", () => {
    renderWithTheme(<Home />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeInTheDocument();
  });

  it("no longer links to the ship builder from the footer", () => {
    renderWithTheme(<Home />);
    expect(
      screen.queryByRole("link", { name: "⚓ Ship Builder" })
    ).not.toBeInTheDocument();
  });

  it("renders the theme menu", () => {
    renderWithTheme(<Home />);
    expect(
      screen.getByRole("button", { name: "Choose theme" })
    ).toBeInTheDocument();
  });
});

describe("Home theme menu", () => {
  it("opens a menu of themes and closes after picking one", () => {
    renderWithTheme(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Choose theme" }));
    fireEvent.click(screen.getByRole("button", { name: /Gruvbox/ }));
    expect(document.documentElement.getAttribute("data-term-theme")).toBe(
      "gruvbox"
    );
    expect(
      screen.queryByRole("list", { name: "Themes" })
    ).not.toBeInTheDocument();
  });
});

describe("Home terminal window", () => {
  function runPwd() {
    fireEvent.keyDown(window, { key: "Enter" });
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "pwd" } });
    fireEvent.submit(input);
    expect(screen.getByText("/home/gentry/portfolio")).toBeInTheDocument();
  }

  it("keeps its history through minimize and restore", () => {
    renderWithTheme(<Home />);
    runPwd();
    fireEvent.click(screen.getByRole("button", { name: "Minimize terminal" }));
    fireEvent.click(screen.getByRole("button", { name: /Minimized/ }));
    expect(screen.getByText("/home/gentry/portfolio")).toBeInTheDocument();
  });

  it("keeps its history through fullscreen and back", () => {
    renderWithTheme(<Home />);
    runPwd();
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(screen.getByText("/home/gentry/portfolio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(screen.getByText("/home/gentry/portfolio")).toBeInTheDocument();
  });

  it("starts fresh after close and reopen", () => {
    renderWithTheme(<Home />);
    runPwd();
    fireEvent.click(screen.getByRole("button", { name: "Close terminal" }));
    fireEvent.click(screen.getByRole("button", { name: /Closed/ }));
    expect(
      screen.queryByText("/home/gentry/portfolio")
    ).not.toBeInTheDocument();
  });
});
