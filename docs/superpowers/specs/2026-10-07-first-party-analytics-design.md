# First-party analytics and /admin dashboard

## Goal

Hand-rolled, privacy-friendly analytics for the two parts of the site, the
homepage (`/`) and Ship Builder (`/ship-builder`, including
`/ship-builder/versions`). Events are stored in Firestore. A Google-sign-in
`/admin` page, restricted to `gentry.riggen@gmail.com`, shows them per site,
including a map of where visitors are.

## Decisions

- **Scope:** pageviews plus device/browser/OS/screen/referrer. No custom
  events, no sessions, no cross-day visitor tracking.
- **Ingest:** the browser writes directly to Firestore. Spark plan, no Cloud
  Functions, CI unchanged apart from deploying rules. No IP or country data is
  available this way.
- **Location:** the browser timezone string (`Intl` resolved timezone) is
  stored in each event and resolved to coordinates in the dashboard. Region
  level only. No IP is collected or sent to any third party.
- **Own traffic:** signing in to `/admin` sets a local flag in that browser and
  tracking is skipped there. Tracking is also skipped on `localhost`, in dev
  builds, on `/admin`, and for obvious bots.
- **Per-site views:** the dashboard has Overview, Home and Ship Builder tabs.

## Collection

`AnalyticsTracker` (client component in the root layout) fires once per route
change via `usePathname`. It lazy-loads the Firebase SDK after the page is
idle so the terminal boot sequence and Ship Builder are not slowed.

Skip conditions: `localhost`, non-production build, path under `/admin`, admin
flag set, `navigator.webdriver`, bot-like user agent.

### Data model

Collection `pageviews`, one doc per view:

| Field           | Value                                |
| --------------- | ------------------------------------ |
| `ts`            | server timestamp                     |
| `site`          | `"home"` or `"ship-builder"`         |
| `path`          | exact pathname                       |
| `ref`           | referrer hostname only, or `""`      |
| `device`        | `mobile` / `tablet` / `desktop`      |
| `browser`, `os` | coarse family names                  |
| `screen`        | width bucket                         |
| `tz`            | IANA timezone, e.g. `America/Denver` |
| `vid`           | anonymous visitor id                 |

`vid` is a random id kept in localStorage that regenerates every UTC day. It
gives unique visitors per day without tracking anyone across days, so no
cookies and no consent banner. Returning visitors are not measurable by
design.

### Firestore rules

- `create` on `pageviews`: allowed for anyone when the doc has exactly the
  fields above, with correct types and bounded string lengths, `ts ==
request.time`, and `site` in the allowed set.
- `read`, `update`, `delete`: allowed only when
  `request.auth.token.email == "gentry.riggen@gmail.com"` and
  `request.auth.token.email_verified == true`. Update and delete are denied
  for everyone in practice.
- Known limit: the Firebase config is public, so valid-shaped writes can be
  spammed. Rules cannot prevent it. App Check can be added later if it
  happens.

## Auth

Firebase Auth, Google provider only, `signInWithPopup`. Authorization lives in
the Firestore rules, never in the UI. The `/admin` page is client-rendered:

- Signed out: only a "Sign in with Google" button.
- Signed in as another account: "Not authorized", signed out immediately, no
  data queried.
- Signed in as admin: dashboard, and the exclude-own-traffic flag is set.

`/admin` has `noindex` metadata, a `Disallow` in `robots.ts`, and is absent
from the sitemap.

## Dashboard

Tabs: Overview, Home (`/`), Ship Builder. Range picker: 7, 30, 90 days.

Each tab shows:

- Totals: views and unique visitors, with change versus the previous period.
- Time series: views and uniques per day.
- Breakdowns: top paths, referrers, device, browser, OS, screen.
- Map: world map with dots sized by visitors, by timezone region.

Overview shows the two sites side by side. Ship Builder also has a per-path
table. Aggregation runs in the browser over raw docs for the selected range,
with Firestore `count()` for totals. Daily rollup docs are deliberately out of
scope until read volume demands them.

Charts are plain SVG, with no charting library, styled with Tailwind in light
and dark mode. The world outline asset and the timezone-to-coordinates table
load only on `/admin`.

## Code layout

- `lib/analytics/`: pure, unit-tested logic (event building, UA and bot
  parsing, daily visitor id, aggregation, tz to coordinates).
- `lib/firebase/`: SDK init and lazy loading.
- `components/analytics/AnalyticsTracker.tsx`
- `components/admin/`: dashboard components.
- `app/admin/page.tsx`
- `firestore.rules`, `firestore.indexes.json`; `firebase.json` updated so CI
  deploys rules and indexes.

## Testing

- Unit: aggregation, UA parsing, event shape, visitor id rotation, tz lookup.
- Firestore rules via the emulator: valid public create succeeds; extra
  field, wrong type, bad `site` or wrong `ts` is rejected; reads are rejected
  for anonymous users and for other accounts; admin reads succeed.
- E2E: signed-out `/admin` shows the sign-in gate and no data.

## Manual setup (owner)

In the Firebase console: enable Firestore, enable the Google sign-in provider,
and add the site's domain to Auth authorized domains. The implementation plan
lists the exact steps.
