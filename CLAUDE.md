# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build (static export)
npm run lint             # ESLint
npm run format           # Prettier (write)
npm run format:check     # Prettier (check)
npm run type-check       # TypeScript --noEmit
npm test                 # Jest unit tests
npm test -- --testPathPattern=ComponentName  # Run single test file
npm run test:watch       # Jest watch mode
npm run test:e2e         # Playwright E2E tests (auto-starts dev server)
npm run test:e2e:ui      # Playwright UI mode
npm run test:all         # Unit + E2E tests
npm run validate         # Full CI check (lint + format + types + tests + build)
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

**Static export site** (`output: "export"` in next.config.ts). No API routes, no SSR, no middleware, no `next/headers`. All data must be available at build time. Images use `unoptimized: true`.

**Deployment:** Firebase Hosting (static files). CI/CD via GitHub Actions.

### Structure

- `app/` — Single-page app. Root layout handles fonts, metadata, ThemeProvider, and a hydration-prevention inline script for theme.
- `components/` — All components. The current design lives in `components/designs/design1/`.
- `components/designs/design1/` — Interactive terminal UI: `Terminal.tsx` orchestrates a boot sequence of typing animations, then hands off to `InteractivePrompt.tsx` for command input. Commands are resolved via `commandResponses.tsx` (centralized command→response map supporting JSX, `shouldClear`, `shouldConfetti` flags).
- `components/ThemeProvider.tsx` — React Context for dark/light mode. Class-based dark mode (`.dark` on `<html>`). Persists to localStorage.
- `e2e/` — Playwright tests.

### Key Patterns

- **Server components by default.** Only add `"use client"` when the component uses hooks, event handlers, or browser APIs.
- **`export default function` for components** (not arrow functions).
- **`interface` for props** (not `type`).
- **Path alias:** `@/` maps to project root (e.g., `@/components/...`).
- **Tailwind only** for styling — no inline styles, no CSS modules. Every element must support both light and dark mode.
- **Mobile-first responsive:** base → `sm:` → `md:` → `lg:`.
- **Custom animations** defined as `@keyframes` in `app/globals.css`.

### Testing

- **Unit tests:** Jest + React Testing Library. Tests live alongside code in `__tests__/` directories. Components needing ThemeProvider use a `renderWithTheme()` helper. Next Image is mocked in tests.
- **E2E tests:** Playwright across Chromium, Firefox, WebKit. Tests in `e2e/`.

### Formatting

Prettier: double quotes, semicolons, trailing commas (es5), 80 char width, 2-space indent.

<!-- BEGIN:nextjs-agent-rules -->

### Ship Builder releases

Every Ship Builder change that ships to users (anything in `components/ship-builder`, `lib/ship-builder`, `app/ship-builder` or `public/ship-builder-sw.js`) is a release:

1. Bump `SHIP_BUILDER_VERSION` in `lib/ship-builder/version.ts` (semver: patch for fixes, minor for features, major for big new modes).
2. Add a matching entry at the top of `CHANGELOG` in `lib/ship-builder/changelog.ts`, written from the commits since the last release (`git log <last version commit>..HEAD -- lib/ship-builder components/ship-builder app/ship-builder`), in plain words a young builder or their parent would follow.

The Versions page (`/ship-builder/versions`, linked from the version label) renders the changelog. `lib/ship-builder/__tests__/changelog.test.ts` fails if the version and the top entry disagree.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
