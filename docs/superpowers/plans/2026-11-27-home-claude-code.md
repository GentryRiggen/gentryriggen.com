# Homepage Claude Code skin Implementation Plan

> Executed natively in one session (user said "go"); one combined review at the end.

**Goal:** Restyle the homepage terminal as a Claude Code session and replace the hobbies wall with an `about` line plus a side-projects table.

**Architecture:** One `GAMES` list (`components/designs/design1/games.ts`) feeds the table, per-game commands and help. Boot steps render as `ToolCall` blocks gated by a `Spinner`; a `skipped` flag (keypress, tap, reduced motion) shows them all at once. `InteractivePrompt` gets a bordered input box, suggestion chips and a status line.

**Spec:** `docs/superpowers/specs/2026-11-27-home-claude-code-design.md`

## Global Constraints

- Tailwind only, light and dark mode, phone width with no horizontal scroll.
- No Anthropic logos or wordmarks.
- Existing commands, aliases and the 1.2s navigation delay keep working.

## Review Focus

- Skipping mid-boot shows every step once (no duplicates, prompt appears).
- Chip click runs the command and cancels a pending navigation like typing does.
- `clear` still hides the boot content.
- Keypress-to-skip must not swallow typing once the prompt is up.
- Reduced-motion visitors get no spinner and no staged reveal.

---

### Task 1: Games list and side-projects table

**Files:** create `games.ts`, `SideProjects.tsx`, `About.tsx`; delete `Hobbies.tsx`; modify `commandResponses.tsx`; tests in `__tests__/commandResponses.test.tsx`.

- `GAMES: readonly Game[]` with `{ id, name, emoji, tagline, href, version, command, aliases, blurb, launch }`, versions imported from each `lib/<game>/version.ts`.
- `gameForCommand(lower: string): Game | undefined`.
- New commands: `games` / `projects` / `ls ~/side-projects/` (table), `about` / `cat about.txt`; `cat hobbies.txt` shows about + table.
- Help lists every game from `GAMES`.
- Tests: table lists every game with its version and a link; existing per-game command tests stay green.

### Task 2: Claude Code boot

**Files:** create `ToolCall.tsx`, `Spinner.tsx`, `WelcomeBox.tsx`; modify `Terminal.tsx`; delete `CommandBlock.tsx`, `TypingEffect.tsx`, `AsciiArt.tsx`; tests in `__tests__/Terminal.test.tsx`.

- Steps: `Bash(whoami)`, `Read(bio.txt)`, `Read(about.txt)`, `Bash(ls ~/side-projects/)`, `Read(skills.md)`, `Read(links.txt)`, then `✻ Brewed for Ns`.
- Tests: prompt only after the last step; a keypress skips to the end; table and links present after boot.

### Task 3: Prompt box, chips, status line, slash commands

**Files:** modify `InteractivePrompt.tsx`, `commandResponses.tsx`, `app/page.tsx` (sr-only game list), `e2e/home.spec.ts` (title text).

- Leading `/` is stripped for lookup (`/help`, `/clear`, `/ship-builder`).
- Cheeky extras: `claude`, `/model`, `/cost`, `ultrathink`.
- `hire me` renders links.
- Tests: chip click runs `games`; `/help` works.
