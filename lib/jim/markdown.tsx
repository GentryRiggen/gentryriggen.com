import { memo, type ReactNode } from "react";

/**
 * A small Markdown renderer for Jim's replies: paragraphs, headings, `-` and
 * numbered lists, pipe tables, fenced code, **bold**, *italic* and `code`.
 * Everything is built as React elements from text, so nothing in a reply can
 * become HTML. A markdown link to a plain https URL (Jim's web sources) is a
 * tappable link, with its site's name beside the label so the destination is
 * always visible; every other link renders as plain text ("label (url)").
 */

interface JimMarkdownProps {
  text: string;
  /**
   * "label-url" (default, Jim's finished replies): plain https links are
   * tappable, others "label (url)". "label" (note pages): nothing tappable;
   * links to other notes (anything not http or https) show just their label.
   * "plain": nothing tappable, every link "label (url)" (a reply still
   * streaming or cut off, before the server has checked its links).
   */
  links?: LinkMode;
}

type LinkMode = "label-url" | "label" | "plain";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[]; start?: number }
  | { kind: "pre"; lines: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const LEADING_NUMBER = /^\s*(\d+)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*```/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|[\s:|-]+\|\s*$/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableStart(lines: string[], i: number): boolean {
  return (
    TABLE_ROW.test(lines[i]) &&
    i + 1 < lines.length &&
    TABLE_RULE.test(lines[i + 1])
  );
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end of text)
      blocks.push({ kind: "pre", lines: code });
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (isTableStart(lines, i)) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }
    const list = BULLET.test(line)
      ? { kind: "ul" as const, pattern: BULLET }
      : NUMBERED.test(line)
        ? { kind: "ol" as const, pattern: NUMBERED }
        : null;
    if (list) {
      const items: string[] = [];
      let item = list.pattern.exec(lines[i]);
      while (item) {
        items.push(item[1]);
        i += 1;
        item = i < lines.length ? list.pattern.exec(lines[i]) : null;
      }
      const start =
        list.kind === "ol"
          ? Number((LEADING_NUMBER.exec(line) as RegExpExecArray)[1])
          : undefined;
      blocks.push({ kind: list.kind, items, start });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

/**
 * The URL if the link is written as a plain https URL exactly as a browser
 * would spell it (lowercase scheme, no user:password@, nothing the parser
 * had to clean up), else null. Jim's server keeps only links matching its web
 * sources character for character, so anything looser here could let a
 * planted link through.
 */
function safeHttps(raw: string): URL | null {
  if (!raw.startsWith("https://")) return null;
  try {
    const url = new URL(raw);
    const exact = url.href === raw || url.href === `${raw}/`;
    return exact && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

/** `code`, **bold**, *italic* / _italic_, [label](url) → React nodes. */
const INLINE =
  /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]*(?:\([^)\s]*\)[^)\s]*)*)\)/g;

function renderInline(
  text: string,
  keyPrefix: string,
  links: LinkMode = "label-url"
): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      out.push(
        <code
          key={key}
          className="rounded bg-ayu-line px-1 py-0.5 font-mono text-[0.9em] text-ayu-orange"
        >
          {m[1]}
        </code>
      );
    } else if (m[2] !== undefined || m[3] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold">
          {renderInline(m[2] ?? m[3], key, links)}
        </strong>
      );
    } else if (m[4] !== undefined) {
      out.push(<em key={key}>{renderInline(m[4], key, links)}</em>);
    } else if (
      links === "label-url" &&
      !/[[\]]/.test(m[5]) &&
      safeHttps(m[6])
    ) {
      const url = safeHttps(m[6])!;
      const site = url.hostname.replace(/^www\./, "");
      out.push(
        <a
          key={key}
          href={url.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-ayu-accent underline underline-offset-2"
        >
          {m[5]}
        </a>
      );
      if (m[5].toLowerCase() !== site.toLowerCase()) {
        out.push(
          <span key={`${key}-site`} className="text-[0.85em] text-ayu-subtle">
            {` (${site})`}
          </span>
        );
      }
    } else if (links === "label" && !/^https?:/i.test(m[6])) {
      out.push(m[5]);
    } else {
      out.push(`${m[5]} (${m[6]})`);
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderLines(
  lines: string[],
  key: string,
  links: LinkMode
): ReactNode[] {
  return lines.flatMap((line, i) =>
    i === 0
      ? renderInline(line, `${key}-${i}`, links)
      : [
          <br key={`${key}-br-${i}`} />,
          ...renderInline(line, `${key}-${i}`, links),
        ]
  );
}

function JimMarkdown({ text, links = "label-url" }: JimMarkdownProps) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-3 [overflow-wrap:anywhere]">
      {blocks.map((block, b) => {
        const key = `b${b}`;
        switch (block.kind) {
          case "h": {
            const Tag = block.level <= 2 ? "h2" : "h3";
            return (
              <Tag
                key={key}
                className={
                  block.level <= 2
                    ? "text-lg font-semibold"
                    : "text-base font-semibold"
                }
              >
                {renderInline(block.text, key, links)}
              </Tag>
            );
          }
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List
                key={key}
                start={block.start !== 1 ? block.start : undefined}
                className={`space-y-1 pl-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}
              >
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>
                    {renderInline(item, `${key}-${i}`, links)}
                  </li>
                ))}
              </List>
            );
          }
          case "table":
            return (
              <div
                key={key}
                className="overflow-x-auto rounded-lg border border-ayu-line"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-ayu-line/60">
                    <tr>
                      {block.header.map((cell, c) => (
                        <th
                          key={`${key}-h${c}`}
                          className="px-3 py-2 font-semibold whitespace-nowrap"
                        >
                          {renderInline(cell, `${key}-h${c}`, links)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr
                        key={`${key}-r${r}`}
                        className="border-t border-ayu-line"
                      >
                        {row.map((cell, c) => (
                          <td
                            key={`${key}-r${r}-${c}`}
                            className="px-3 py-2 align-top [overflow-wrap:normal]"
                          >
                            {renderInline(cell, `${key}-r${r}-${c}`, links)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "pre":
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-lg bg-ayu-line p-3 font-mono text-sm"
              >
                <code>{block.lines.join("\n")}</code>
              </pre>
            );
          default:
            return <p key={key}>{renderLines(block.lines, key, links)}</p>;
        }
      })}
    </div>
  );
}

/** Memoized: the same text never parses twice in a row. */
export default memo(JimMarkdown);
