import { render, screen } from "@testing-library/react";
import JimMarkdown from "../markdown";

it("renders HTML in the text as literal text", () => {
  const { container } = render(
    <JimMarkdown
      text={'<script>alert("x")</script> <img src=x onerror=alert(1)>'}
    />
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent('<script>alert("x")</script>');
});

it("renders bold and inline code", () => {
  const { container } = render(<JimMarkdown text="a **b** and `c`" />);
  expect(container.querySelector("strong")).toHaveTextContent("b");
  expect(container.querySelector("code")).toHaveTextContent("c");
});

it("renders dash lists as list items", () => {
  render(<JimMarkdown text={"Todo:\n- one\n- **two**\n\nAfter"} />);
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[1].querySelector("strong")).toHaveTextContent("two");
  expect(screen.getByText("After").tagName).toBe("P");
});

it("renders numbered lists and headings", () => {
  render(<JimMarkdown text={"## Plan\n1. first\n2. second"} />);
  expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

it("renders links as plain text, never anchors", () => {
  const { container } = render(
    <JimMarkdown text="See [notes](javascript:alert(1)) or https://x.test" />
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container).toHaveTextContent("notes (javascript:alert(1))");
});

it("renders fenced code as a block with the text untouched", () => {
  const { container } = render(
    <JimMarkdown text={"```\n**not bold**\n- not a list\n```"} />
  );
  expect(container.querySelector("pre")).toHaveTextContent("**not bold**");
  expect(container.querySelector("strong")).toBeNull();
  expect(container.querySelector("li")).toBeNull();
});

it("keeps the start number of an ordered list", () => {
  const { container } = render(<JimMarkdown text={"3. third\n4. fourth"} />);
  expect(container.querySelector("ol")).toHaveAttribute("start", "3");
});

it("renders a pipe table, scrollable on its own, cells as inline text", () => {
  const { container } = render(
    <JimMarkdown
      text={
        "Intro\n| Rank | Theme |\n| --- | :-: |\n| 1 | **Focus** |\n| 2 | Learner | extra |\n\nAfter"
      }
    />
  );
  const table = container.querySelector("table");
  expect(table).not.toBeNull();
  expect(table?.parentElement?.className).toContain("overflow-x-auto");
  expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(
    ["Rank", "Theme"]
  );
  expect(screen.getAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("Focus").tagName).toBe("STRONG");
  // A row with an extra cell keeps it rather than dropping text.
  expect(container).toHaveTextContent("extra");
  expect(screen.getByText("After").tagName).toBe("P");
});

it("treats a lone pipe line as text, not a table", () => {
  const { container } = render(<JimMarkdown text={"a | b\nc"} />);
  expect(container.querySelector("table")).toBeNull();
  expect(container).toHaveTextContent("a | b");
});

it("can show relative links as their label only", () => {
  const { container } = render(
    <JimMarkdown
      links="label"
      text="Met at [the meeting](../meetings/2026-01-01-x.md), see [site](https://x.test)"
    />
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container).toHaveTextContent(
    "Met at the meeting, see site (https://x.test)"
  );
});
