# gentryriggen.com

My personal site, [gentryriggen.com](https://gentryriggen.com). It is a
terminal-style landing page you can type commands into, plus **Ship Builder**,
a 3D ship-building toy that runs entirely in the browser.

## Highlights

- **Interactive terminal.** A boot sequence hands off to a command prompt.
  Commands are resolved from one map in
  `components/designs/design1/commandResponses.tsx`.
- **Ship Builder** (`/ship-builder`). Design ships deck by deck, sail or drive
  them, walk the decks, and watch them sink. It is a React Three Fiber app
  that works offline as an installable PWA. Release notes live at
  `/ship-builder/versions`.
- **Static export.** No server, API routes or middleware. Everything is built
  ahead of time and served from Firebase Hosting.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
React Three Fiber, Jest + React Testing Library, Playwright, Firebase Hosting,
GitHub Actions.

## Getting started

Requires Node 24 (see `.mise.toml`).

```bash
git clone https://github.com/GentryRiggen/gentryriggen.com.git
cd gentryriggen.com
npm install
npm run dev     # http://localhost:3000
```

## Scripts

| Command                         | What it does                                   |
| ------------------------------- | ---------------------------------------------- |
| `npm run dev`                   | Dev server                                     |
| `npm run build`                 | Production build (static export to `out/`)     |
| `npm run lint` / `format:check` | ESLint / Prettier check                        |
| `npm run type-check`            | `tsc --noEmit`                                 |
| `npm test`                      | Jest unit tests                                |
| `npm run test:e2e`              | Playwright (starts the dev server itself)      |
| `npm run validate`              | Lint, format, types, tests and build, as in CI |

## Project structure

```
app/                  App Router: layout, landing page, /ship-builder
components/
  designs/design1/    Terminal UI
  ship-builder/       3D scene, UI, audio, hooks
lib/ship-builder/     Model, simulation, persistence, templates, changelog
e2e/                  Playwright tests
scripts/              Screenshot, icon and offline-check tooling
docs/superpowers/     Design specs and implementation plans
```

## Testing

Unit tests live in `__tests__/` folders next to the code. E2E tests run on
Chromium for everything; WebKit and an iPad profile run only the tests tagged
`@smoke`. Set `E2E_FULL=1` to run everything on every project.

## Deployment

Pushes to `main` run CI (lint, format, types, unit and e2e tests, build) and
deploy both Firebase Hosting sites (the main site from `out/`, Jim's from
`out-jim/`) plus the Firestore rules and indexes through GitHub Actions.

The deploy is keyless: the job trades GitHub's OIDC token for a short-lived
token of a deployer service account through Workload Identity Federation, and
the pool trusts only this repository's `main` branch. No service account key
or `FIREBASE_SERVICE_ACCOUNT` secret is used. The workflow needs three
repository variables (not secrets): `GCP_WIF_PROVIDER` (the full provider
name), `GCP_DEPLOYER_SA` (the deployer's email) and `JIM_TENANT` (Jim's
sign-in tenant id). CI on `main` fails with a clear error if one is missing.
Renovate keeps dependencies current.

## Contributing

This is a personal project, but issues and suggestions are welcome. Run
`npm run validate` before opening a pull request.

## License

All rights reserved. No license is granted for reuse of this code.
