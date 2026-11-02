import { render, screen } from "@testing-library/react";
import JimMarkdown, { markdownNodes } from "../markdown";

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

it("renders non-https links as plain text, never anchors", () => {
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

it("makes plain https links tappable, showing the site", () => {
  const { container } = render(
    <JimMarkdown text="Per [the Fed](https://www.federalreserve.gov/a.pdf) and [mlb.com](https://mlb.com/x)." />
  );
  const anchors = container.querySelectorAll("a");
  expect(anchors).toHaveLength(2);
  expect(anchors[0]).toHaveAttribute(
    "href",
    "https://www.federalreserve.gov/a.pdf"
  );
  expect(anchors[0]).toHaveAttribute("target", "_blank");
  expect(anchors[0]).toHaveAttribute("rel", "noopener noreferrer nofollow");
  expect(container).toHaveTextContent(
    "Per the Fed (federalreserve.gov) and mlb.com."
  );
});

it("keeps anything but an exactly spelled https URL as plain text", () => {
  const { container } = render(
    <JimMarkdown
      text={
        "[a](http://x.test) [b](https://user:pw@x.test) [c](data:text/html,hi) [d](HTTPS://e.test) [f](https:\\\\e.test) [g](https:/e.test) [h](https://e.test/a b)"
      }
    />
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container).toHaveTextContent("d (HTTPS://e.test)");
  expect(container).toHaveTextContent("g (https:/e.test)");
});

it("keeps a cut-off reply's links plain in the chat", () => {
  const { container } = render(
    <JimMarkdown links="plain" text="[x](https://e.test/)" />
  );
  expect(container.querySelector("a")).toBeNull();
});

it("keeps every link plain while a reply is still streaming", () => {
  const { container } = render(
    <JimMarkdown links="plain" text="See [site](https://x.test/a)" />
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container).toHaveTextContent("See site (https://x.test/a)");
});

it("never makes a link whose label holds a bracket tappable", () => {
  const { container } = render(
    <JimMarkdown text="[[b](mailto:q)](https://e.test/?d=1)" />
  );
  expect(container.querySelector("a")).toBeNull();
});

it("keeps a link with an over-long label or URL as plain text", () => {
  const label = "a".repeat(201);
  const url = `https://example.com/${"p".repeat(1000)}`;
  const { container } = render(
    <JimMarkdown text={`[${label}](https://example.com) [b](${url})`} />
  );
  expect(container.querySelector("a")).toBeNull();
  const ok = render(
    <JimMarkdown text={`[${"a".repeat(200)}](https://example.com/x)`} />
  );
  expect(ok.container.querySelector("a")).toHaveAttribute(
    "href",
    "https://example.com/x"
  );
});

describe("crafted text renders in linear time", () => {
  const SIZE = 16_000;
  /** `unit` repeated to SIZE characters. */
  const fill = (unit: string) =>
    unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);

  it.each([
    ["half-open links", fill("[a](")],
    ["open brackets", fill("[")],
    ["labels with no URL", fill("[a]")],
    ["open URLs", ("[a](" + fill("(")).slice(0, SIZE)],
    ["URLs with parens", fill("[a](x(y)")],
    ["bold openers", fill("**a")],
    ["underscore openers", fill("__a")],
    ["italic openers", fill("*a ")],
    ["backticks", fill("`a")],
    ["stars", fill("*")],
    ["underscores", fill("_")],
    ["closers", fill("](")],
    ["long labels", fill("[" + "a".repeat(300) + "](x)")],
    ["a table row", ("|" + fill("[a](|")).slice(0, SIZE)],
    ["mixed", fill("**[a](`_*(")],
  ])("%s", (_name, text) => {
    expect(text.length).toBe(SIZE);
    // Warm up once (JIT), then time the parse (not jsdom's DOM work).
    markdownNodes({ text: text.slice(0, 200) });
    const start = performance.now();
    markdownNodes({ text });
    const took = performance.now() - start;
    if (process.env.MD_TIMING) console.log(_name, took.toFixed(1));
    expect(took).toBeLessThan(50);
  });
});
