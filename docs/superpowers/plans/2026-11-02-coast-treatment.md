# Ever Onward Coast Treatment Implementation Plan

**Goal:** Carry the v1.22 Coast's clear goals, obvious purchase effects, focused controls and satisfying growth through every remaining chapter of Light, Grow, Higher and Smile.

**Design reference:** Commit `0ae31df1`, especially Light's goal, preview, keeper progression and the compact shop. The user authorized this rollout and confirmed Ever Onward only. No Asana. Preserve existing saves, story identity, endings and optional side activities.

**Architecture:** Use each universe's existing goal hook and income functions. Keep progression facts in universe modules and shared presentation in game components. Show chapter progress separately from the money being saved for the next purchase. Keep secondary resources accessible. Reuse existing controls rather than adding a second action for the same mechanic.

## Task 1: Progression and purchase effects

- [ ] Establish the game-test baseline before edits.
- [ ] Add tested goal views for all 16 chapters, using actual completion conditions, with finite clamped progress for old saves and no goal after completion.
- [ ] Give every upgrade a concise, truthful effect preview, including progression unlocks and automation. Highlight real new abilities without labelling ordinary multipliers as abilities.
- [ ] Audit growth in remaining chapters against the Coast: retain already-compounding helper lines, strengthen weak purchases where necessary, and tune prices only from measured active/idle runs. Do not arbitrarily multiply the whole economy or weaken test floors to hide regressions.
- [ ] Test goals at entry, halfway, completion and restored-save boundaries; test effect previews against actual income changes. Run relevant simulation and anti-stuck suites.

## Task 2: Shared focused screens

- [ ] Add component tests for compact upgrades in each story, useful resources remaining accessible, and goal rendering with targets larger than 16.
- [ ] Apply compact shop presentation consistently, keep visitors below the shop, and group secondary resources behind an accessible disclosure rather than discard them.
- [ ] Place each chapter's primary control near the shop without duplicating it. Keep other systems accessible below, with the endings' central interaction prominent.
- [ ] Correct segmented goal rendering for continuous and large targets. Preserve Coast's eight-lighthouse display.
- [ ] Verify component tests, keyboard semantics and phase transitions.

## Task 3: Review and verification

- [ ] One combined specification and quality review for this ordinary UI/gameplay work; fix important findings.
- [ ] Run all game tests and scorecards, TypeScript, changed-file formatting/lint, production build and relevant existing e2e where environment supports them.
- [ ] Record concrete outcomes and remaining limitations in the lab notebook. No push or deployment without an explicit shipping request.

## Review focus

Existing saves with missing new fields must remain playable. Phase-entry goals must not reveal later story spoilers. A hidden secondary resource must remain inspectable. Goal meters must represent large and fractional targets honestly. Temporary boosts and depleted consumables must not make purchase claims false.
