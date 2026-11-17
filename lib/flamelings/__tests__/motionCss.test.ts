import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/**
 * From the glade on. The blob section above it is switched off wholesale by the
 * `.fl-blob *` / `.fl-pet *` rule in its own reduced-motion block.
 */
const START = "/* ---------- Flamelings: the glade and screens";
const END = "/* ---- Make Everyone Smile";

/** The Flamelings part of globals.css (the "Make Everyone Smile" block follows it). */
const flamelings = css.slice(css.indexOf(START), css.indexOf(END));

/** Index of the `}` that closes the `{` at `open`. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return text.length - 1;
}

/** Split text into `@media (prefers-reduced-motion: reduce)` blocks and the rest. */
function split(text: string): { reduced: string[]; rest: string } {
  const marker = "@media (prefers-reduced-motion: reduce)";
  const reduced: string[] = [];
  let rest = "";
  let from = 0;
  let at = text.indexOf(marker);
  while (at !== -1) {
    const open = text.indexOf("{", at);
    const close = closeOf(text, open);
    rest += text.slice(from, at);
    reduced.push(text.slice(open, close + 1));
    from = close + 1;
    at = text.indexOf(marker, from);
  }
  return { reduced, rest: rest + text.slice(from) };
}

/** Every `.fl-*` class in a selector list whose rule sets `animation`. */
function animatedClasses(text: string): string[] {
  const names = new Set<string>();
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of text.matchAll(rule)) {
    // A rule that sets `animation: none` is itself a switch-off.
    if (!/(^|[\s;])animation(-name)?\s*:(?!\s*none)/.test(m[2])) continue;
    for (const sel of m[1].split(",")) {
      for (const c of sel.matchAll(/\.(fl-[a-z0-9-]+)/g)) names.add(c[1]);
    }
  }
  return [...names].sort();
}

describe("flamelings motion css", () => {
  const { reduced, rest } = split(flamelings);
  const animated = animatedClasses(rest);
  const reducedText = reduced.join("\n");

  it("finds the animated classes", () => {
    expect(animated.length).toBeGreaterThan(40);
    expect(reduced.length).toBeGreaterThan(5);
  });

  it.each(animated)(
    "%s is switched off under prefers-reduced-motion",
    (name) => {
      const mentioned = new RegExp(`\\.${name}(?![a-z0-9-])`);
      expect(mentioned.test(reducedText)).toBe(true);
    }
  );
});
