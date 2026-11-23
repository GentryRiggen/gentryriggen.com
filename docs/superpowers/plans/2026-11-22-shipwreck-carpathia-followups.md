# Shipwreck — Carpathia follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Carpathia follow-ups cut from 1.5.0 (#566), in two releases: fixes first (Release A, patch), then her own sounds, Walk, convoy and boats (Release B, minor).

**Architecture:** Small, ship-gated changes on the existing Shipwreck code: scene effects (`components/shipwreck/scene/`), the sim's steady test (`lib/shipwreck/sim/run.ts`), captions, audio beds/cues, a walk deck map. Every other ship's goldens and budgets stay unchanged.

**Tech Stack:** Next.js 16 static export, React 19, three.js / R3F, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-shipwreck-carpathia-design.md` (rulings R12 convoy, R13 daytime rockets, R16 Walk, R18 sound; "Later" list), the 1.5.0 plan `docs/superpowers/plans/2026-11-22-shipwreck-carpathia.md`, the READMEs `components/shipwreck/model/README.md`, `components/shipwreck/scene/README.md`, `lib/shipwreck/sim/README.md`, `lib/shipwreck/walk/README.md`.

## Global Constraints

- Kid UI: big picture buttons, no reading. No people, no voices, no screams, no U-boat model.
- Titanic, Lusitania, Fitzgerald and Britannic goldens, recipes, settings and `e2e/perf-budget.json` entries do not move. Only Carpathia entries may change.
- iPad mini 6 budgets: ≤ 160 draw calls, ≤ 450k triangles at the top tier, no frame blocked > 8 ms. New effects tiered (iPads start at medium).
- Every sim change honest and documented in `lib/shipwreck/sim/README.md`; every visible feature sourced in the model/scene README.
- Shared files (Shipwreck.tsx, Hud, ShipRig, walk code, audio): keep edits small and additive. The sibling branch `feat/shipwreck-britannic-followups` edits the same files.
- Tailwind only, both themes, Safari 15 compat (`lib/game-kit/compat.ts`), no new analytics events.
- Save shape `localStorage["shipwreck:v1"]` unchanged.
- No version bump or changelog edit inside tasks; the controller does the release.

## Review Focus

- Seeking backwards/forwards on the timeline then pressing play: the caption shown must belong to the new time (Task A3 test).
- A What-if with only a forward-peak hit at ×1: the end card/“stays afloat” ending arrives within minutes of her settling, not at 3:35 PM (Task A2 test).
- Daylight rocket during X-ray and at low quality tier: no scene-wide flash, no crash, still visible (Task A1 test).
- Reduced motion / sound off: new sounds silent when muted, beds stop on pause (Task B1 test).
- Walk on her after the hit while she settles by the head: player stays on deck, can reach the water, Walk button hidden after she is under as on other ships (Task B2 e2e).

---

## Release A — fixes (patch)

### Task A1: Daytime rockets read right (Opus, scene)

**Files:** Modify `components/shipwreck/scene/Effects.tsx` (rocket loop ~l.535), `components/shipwreck/scene/afternoonEffects.ts` (blended day buffer); test `components/shipwreck/scene/__tests__/afternoonEffects.test.ts`; `components/shipwreck/scene/README.md`.

Ruling (R13, sourced): GOL records rockets fired to call patrol vessels, so keep them. In daylight a socket signal's stars barely show against the sky; what reads is its smoke trail and the burst's puff and bang. By day (`isDaylit(settings)`): a thin white-grey smoke trail up ~200 m in 4 s, a brief small bright pop at the top (a few additive points, < 0.3 s, **no `runtime.flash`**), then a grey-white smoke puff that spreads and drifts downwind and fades over ~20 s. Night (Titanic) unchanged. Rocket sound cue unchanged.

- [ ] Test: pure helper (e.g. `dayRocketParticles(age, index)` or equivalent in afternoonEffects.ts) — at age 2 s trail particles exist and rise; at age 4.1 s a puff exists; at age 25 s nothing; never sets flash. Existing night rocket test (if any) unchanged.
- [ ] Implement; screenshot her first rocket (9:32 AM) at 1133×744 and 744×1133.
- [ ] `npx jest components/shipwreck/scene` passes; commit.

### Task A2: Every What-if reaches a clear end (Opus, sim)

**Files:** `lib/shipwreck/sim/run.ts` (steady test ~l.1716), `lib/shipwreck/sim/events.ts` constants, `lib/shipwreck/sim/README.md`; tests `lib/shipwreck/sim/__tests__/carpathiaWhatIf.test.ts` (sims lane if slow, per `jest.sims.js`).

Problem: 14 Carpathia What-ifs (13 with a forward-peak hit, plus boiler room + No. 3) never log `floating-steady`: the peak trades water in a slow cycle, pitch rate just over 1e-5 rad/s; the boiler+No.3 run's coal doors still pass a trickle. They hold their pose to `END_T` (3:35 PM).

Approach: an honest "settled" test that also accepts a slow cycle around a fixed pose: over a window (e.g. 600 s) the pose's net change is tiny (pitch < 0.01°, list < 0.01°, sinkage < 1 cm) and the averaged inflow < `STEADY_INFLOW_M3S`. Gate so runs that already log `floating-steady` today log it at the same time (apply the window test only as a fallback, or only for torpedo ships with a finisher spec — implementer proves other ships unchanged). If a run is truly still sinking, it must sink before END_T (check: none should).

- [ ] Test: every one of the 14 listed What-ifs logs `floating-steady` before 11:30 AM her clock (or sinks); each of the other Carpathia What-ifs keeps its outcome; Titanic/Lusitania/Fitzgerald/Britannic goldens unchanged.
- [ ] Implement; update README (replace the "Fourteen of her What-ifs never log" paragraph).
- [ ] `npm test` + the Carpathia sim files + `npm run test:sims` subset for the other ships' goldens; commit.

### Task A3: Captions refresh after a seek; What-if Go button room (Sonnet, UI)

**Files:** `components/shipwreck/ui/Captions.tsx`, `components/shipwreck/ui/WhatIfEditor.tsx`; tests in `components/shipwreck/ui/__tests__/`.

- Captions: on a backward seek (`s.t < prev.t`, t ≥ 0) or a forward jump bigger than `CAPTION_RECENT_S`, drop the current caption and show the latest event caption within `CAPTION_RECENT_S` before `s.t` (or none). All ships.
- Go button: at 1133×744 it is cramped; give it its full size (≥ 44 px tap target, not squeezed by the spot row) without changing other layouts.
- [ ] Tests: caption after a backward seek shows the earlier event's caption (or none), never the later one; RTL layout test or e2e assertion that the Go button's box is ≥ 44×44 at 1133×744.
- [ ] Commit.

### Task A4: Ledger minors (Sonnet; folded with A3 if small)

From the 1.5.0 SDD ledger: (a) paint `acquireDazzleTexture` / `liveryShapeError` resource leak when a build throws → release in a finally; (b) one-frame wrong (null) livery swatch flash on the paint button; (c) Environment `warm` colour reference-comparison special case → add `warm` to the look table; (d) Torpedo side offset float-sensitive rounding → compare sides by sign, not rounded float; (e) missing test that the Lusitania's X-ray/panel holes show at their own hit time.

- [ ] One test per item where testable; commit per item or one commit.

**Release A ship:** lint, type-check, `npm test`, build, `npx playwright test e2e/shipwreck.spec.ts --project=chromium`, perf spec; bump patch + changelog; squash, PR, merge, confirm `version.json`.

## Release B — her own sounds, Walk, convoy, boats (minor)

### Task B1: Her own sounds (Sonnet)

**Files:** `components/shipwreck/audio/beds.ts`, `cues.ts`, `voices.ts`; tests `components/shipwreck/audio/__tests__/`.
Her morning sea bed (open Atlantic: deeper slow swell, fresh breeze, rare gulls, no coast surf), her torpedo hits (two hits 8 s apart: a hard double thud then the deep rumble of the engine-room hit, and the 10:50 one), and her going down (a long hull groan, rushing air and water as the bow goes, then quiet). Procedural like the others; no voices. Other ships' mixes unchanged (tests).

### Task B2: Walk the decks on her (Sonnet, Opus if deck math)

**Files:** Create `lib/shipwreck/walk/carpathiaDecks.ts`; modify `lib/shipwreck/walk/index.ts` (`walkMapFor`), tests in `lib/shipwreck/walk/__tests__/`, `e2e/shipwreck-walk.spec.ts`.
Per R16/R21: forecastle (~42 ft), forward well deck, the bridge-deck promenade and boat deck, the aft well, the open after deck with its deckhouse, joined by ladders; blockers from her recipe fittings (`carpathiaRecipe.ts`; boats 1–2 on the forward house roof). Template: `lusitaniaDecks.ts`.

### Task B3: Convoy ships + whitecaps/clouds if cheap (Opus, scene)

R12: 6 distant low-detail steamers in grey/dazzle on the horizon (instanced, ≤ 6 draw calls total), steaming in convoy, then scattering at full speed after the hit (GOL). Tiered off at low. Clouds/whitecaps only if within budget. Perf budget: update her entries only.

### Task B4: Lifeboats at true size; 1912 paint without the 1918 davits (Opus, model)

Boats ~26–28 ft (vs ~20 ft) with spacing that fits; in `cunard-1912` livery the boats sit in their stowed (not swung-out) davits if cheap. Model README sourced.

**Release B ship:** same verification + walk e2e; minor bump + changelog; squash, PR, merge, confirm deploy.
