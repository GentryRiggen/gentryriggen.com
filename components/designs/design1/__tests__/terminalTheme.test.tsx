import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import InteractivePrompt from "../InteractivePrompt";
import { getCommandResponse } from "../commandResponses";
import { TerminalThemeProvider, findTerminalTheme } from "../terminalTheme";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));

function runCommand(command: string) {
  const input = screen.getByLabelText("Terminal command input");
  fireEvent.change(input, { target: { value: command } });
  fireEvent.submit(input);
}

function renderPrompt() {
  return render(
    <ThemeProvider>
      <TerminalThemeProvider>
        <InteractivePrompt onClear={jest.fn()} />
      </TerminalThemeProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-term-theme");
  document.documentElement.classList.remove("dark");
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
});

it("finds themes by id prefix or name", () => {
  expect(findTerminalTheme("ayu")?.id).toBe("ayu-mirage");
  expect(findTerminalTheme("Ayu Mirage")?.id).toBe("ayu-mirage");
  expect(findTerminalTheme("solarized")?.id).toBe("solarized-light");
  expect(findTerminalTheme("nope")).toBeUndefined();
  expect(findTerminalTheme("")).toBeUndefined();
});

it("`theme <name>` switches theme, saves it and matches the site mode", () => {
  renderPrompt();
  runCommand("theme dracula");
  expect(document.documentElement.getAttribute("data-term-theme")).toBe(
    "dracula"
  );
  expect(localStorage.getItem("term-theme")).toBe("dracula");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

it("the picker switches theme and Light clears it", () => {
  renderPrompt();
  runCommand("/theme");
  fireEvent.click(screen.getByRole("button", { name: /Nord/ }));
  expect(document.documentElement.getAttribute("data-term-theme")).toBe("nord");
  expect(screen.getByRole("button", { name: /Nord/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  fireEvent.click(screen.getByRole("button", { name: /^Light$/ }));
  expect(document.documentElement.hasAttribute("data-term-theme")).toBe(false);
  expect(localStorage.getItem("term-theme")).toBeNull();
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

it("rejects an unknown theme without changing anything", () => {
  const result = getCommandResponse("theme neon", []);
  expect(result.terminalTheme).toBeUndefined();
  expect(result.output).toMatch(/no theme called 'neon'/);
});
