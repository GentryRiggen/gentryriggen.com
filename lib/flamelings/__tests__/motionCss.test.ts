import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** The text of every `@media (prefers-reduced-motion: reduce) { ... }` block. */
function reducedBlocks(): string[] {
  const blocks: string[] = [];
  const marker = "@media (prefers-reduced-motion: reduce)";
  let from = css.indexOf(marker);
  while (from !== -1) {
    const open = css.indexOf("{", from);
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    blocks.push(css.slice(open, i + 1));
    from = css.indexOf(marker, i);
  }
  return blocks;
}

describe("flamelings motion css", () => {
  const blocks = reducedBlocks();
  it.each([
    "fl-pop-in",
    "fl-sheet-up",
    "fl-shimmer",
    "fl-pulse-soft",
    "fl-purchase-pop",
  ])("%s has keyframes and a reduced-motion switch-off", (name) => {
    expect(css).toContain(`@keyframes ${name}`);
    expect(blocks.some((b) => b.includes(`.${name}`))).toBe(true);
  });
});
