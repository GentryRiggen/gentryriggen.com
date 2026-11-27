# Homepage: Claude Code skin and a tidier games list

**Why:** the homepage markets Gentry as a software leader. The hobbies section
grew into six near-identical game paragraphs and buried the pitch.

## Goals

- Replace the bash-terminal look with a Claude Code session homage: a welcome
  box, boot steps shown as tool calls (`⏺ Read(bio.txt)` with `⎿` output), a
  spinner with whimsical verbs between steps, a bordered input box and a
  status line.
- Split hobbies: a one-line `about` (family, CrossFit, golf) and
  `ls ~/side-projects/`, a compact table (icon, name, short tagline, live
  version from each game's `version.ts`) under "Built for (and QA'd by) my two
  boys."
- One `GAMES` list drives the table, the per-game commands and help, so a new
  game is one entry.
- Skip the boot by tap or keypress; reduced motion shows everything at once.
- Clickable suggestion chips under the prompt (`games`, `skills`, `contact`, …)
  so phone visitors don't have to type.
- `hire me` / `contact` render real links.

## Non-goals and anti-goals

- No Anthropic logos or wordmarks; an homage in style only.
- Don't break the existing commands, aliases, navigation delay or easter eggs.
- Must stay readable in light and dark mode and at phone width.

## Approaches

- **Replace the bash look (picked).** One look to maintain; the Claude Code
  skin is the pitch.
- Easter egg behind a `claude` command: keeps bash as the default, but the
  better look stays hidden and both skins need maintaining.

## Left to the builder

Spinner verbs, taglines, chip set, exact colours (Claude Code's orange accent
over the existing green/amber palette).
