# Flamelings 2.0 Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every Flamelings screen into the approved "cozy dusk
storybook" look: a new HUD, glade, flameling, shelf, hatch and panels, and
juicier motion. No changes to game logic.

**Architecture:**

- A small shared foundation: a font, style tokens in `styles.ts`, an SVG
  icon set and motion keyframes.
- Each screen is then restyled on top of it, keeping every accessible name,
  role and `data-testid` so the unit and e2e tests keep proving behaviour.

**Tech Stack:** Next.js 16 (static export), React 19, Tailwind 4, inline SVG,
CSS keyframes in `app/globals.css`, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-flamelings-visual-overhaul-design.md`
(the mockup is `docs/superpowers/specs/2026-11-17-flamelings-visual-overhaul-mock.html`;
open it in a browser and match its feel).

## Global Constraints

- **Tokens:**
  - Panel cream `#fff6e6`; panel bottom edge `#e7c9a3`; plum ink `#3a2340`;
    muted ink `#7a5a78`.
  - Sparks pill gradient `#ffe58a`→`#ffc53d`, edge `#d9952a`, text
    `#7a3d00`.
  - Dark-mode backdrop: radial `#4b2f6b`→`#2a1d47`→`#1b1430`. Light-mode
    backdrop: warm peach→lavender (`#ffe3c4`→`#f3c9d9`→`#d9c6ef`).
- **Display font:** Fredoka (weights 500/600/700) via `next/font/google`,
  exposed as the CSS variable `--font-fl-display` and loaded only on
  `/flamelings` routes.
- **Tap targets ≥ 64px** (`min-h-16 min-w-16`). The body text stays at the
  current sizes or larger.
- **Tailwind only** in components. Art and keyframes go in `app/globals.css`
  with the `fl-` prefix, inside the existing Flamelings block, and the
  "Make Everyone Smile" block stays last in the file.
- **Animate transform and opacity only.** No animated filters or blur.
  Every new animation is switched off inside the existing
  `@media (prefers-reduced-motion: reduce)` Flamelings rules.
- **Light and dark** for every element. The glade follows the clock
  (`skyPhase`), not the theme. Cream panels are used in both themes.
- **Keep tests passing.** Keep every existing accessible name, role,
  `aria-*` and `data-testid`. Change a test only when the change is
  intended, and say so in the commit body.
- **Out of scope:**
  - Logic, save shape, analytics and online code (`lib/flamelings/**`
    except `version.ts` and `changelog.ts`).
  - The art in `Accessories.tsx`, `DecorArt.tsx` and `HappeningArt.tsx`.
- **Layouts to check:** 1024×768, 768×1024 and 390×844, all with safe areas
  (`SAFE_TOP`, `SAFE_SIDES`, `SAFE_BOTTOM` from `styles.ts`).
- **Commits:** one per task, conventional style, `feat(flamelings): …`.
  Don't bump the version before Task 8.

## Review Focus

1. **Phone portrait (390px) dock.** All six actions are reachable and
   ≥64px, and nothing overflows horizontally. Test it in Task 2 with the
   e2e phone check.
2. **Accessories at every stage and form.** Blob changes must not shift
   hats, face items or neck items off the body. Covered by Task 4's
   screenshot sweep across stages and two forms.
3. **Reduced motion.** With `prefers-reduced-motion: reduce` nothing bobs,
   flickers, shimmers or slides. Task 1 adds a test that the new keyframe
   classes are listed in the reduce block.
4. **Low-need signal.** A gauge under 30 must still be obvious, without
   relying on colour alone (pulse plus a `!` badge). Task 2's unit test
   checks it.
5. **Night glade contrast.** HUD and dock text must stay readable over the
   night sky and over the day sky. Cream panels handle this; check it in
   Task 3's screenshots at 02:00 and 12:00 (use `window.__flamelings` to
   move the clock).

---

### Task 1: Foundation — font, tokens, icons, motion

**Files:**

- Create: `components/flamelings/FlIcon.tsx`,
  `components/flamelings/__tests__/FlIcon.test.tsx`,
  `components/flamelings/fonts.ts`
- Modify: `components/flamelings/styles.ts`,
  `components/flamelings/Flamelings.tsx` (apply the font variable class and
  the new backdrop), `app/flamelings/versions/page.tsx` (font class),
  `app/globals.css` (Flamelings block: keyframes and reduce-motion entries)
- Test: `components/flamelings/__tests__/FlIcon.test.tsx`,
  `lib/flamelings/__tests__/motionCss.test.ts` (new)

**Interfaces — produces:**

- `FL_ICON_NAMES`, a readonly tuple:
  `["home","sound-on","sound-off","feed","play","dress","shop","emotes","friends","back","close","share","spark","fuel","joy","tidy","hat","face","neck","glade","gift","check","lock","plus","dice","camera"]`.
- `type FlIconName = (typeof FL_ICON_NAMES)[number]`.
- `export default function FlIcon({ name, className }: { name: FlIconName; className?: string })`
  renders an `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">`
  with its own colours (multicolour, filled, no strokes thinner than 1.5).
- `fonts.ts` exports `flDisplay`, the `next/font/google` Fredoka instance
  with `variable: "--font-fl-display"`.
- `styles.ts` adds:
  - `DISPLAY = "font-[family-name:var(--font-fl-display)]"`.
  - `STICKER`: a cream panel, `rounded-[28px] bg-[#fff6e6] text-[#3a2340]`
    with a bottom-edge shadow `shadow-[0_5px_0_#e7c9a3,0_12px_28px_rgba(30,10,40,.30)]`.
  - `STICKER_BUTTON`: a cream round button, ≥64px, with the press squish
    (`active:translate-y-[3px] active:shadow-[0_2px_0_#e7c9a3]`).
  - `PRIMARY_BUTTON`: orange `#ff8a3d`→`#f2542d`, white Fredoka text, edge
    `#c2410c`, same squish.
  - `SPARK_PILL`.
  - `CHROME_BG`: the light/dark backdrops from the Global Constraints.
  - Keep the existing names `BIG_BUTTON`, `CARD` and `FOCUS_RING` exported
    (repoint them to the new look) so untouched screens don't break.
- Keyframe classes in `globals.css`: `fl-pop-in` (scale .85→1.04→1 with
  fade, 260ms), `fl-sheet-up` (translateY 24px→0 with fade, 280ms),
  `fl-shimmer`, `fl-pulse-soft`, `fl-purchase-pop`, `fl-fade-in`.

- [ ] **Step 1: Write the failing tests.**
  - `FlIcon.test.tsx`:
    - `it.each(FL_ICON_NAMES)("renders %s as a hidden svg")` asserts the
      `svg` has `aria-hidden="true"` and at least one `path`, `circle`,
      `rect` or `ellipse`.
    - A second test asserts the names in `FL_ICON_NAMES` are unique.
  - `motionCss.test.ts`: read `app/globals.css` as text. For each of
    `fl-pop-in`, `fl-sheet-up`, `fl-shimmer`, `fl-pulse-soft` and
    `fl-purchase-pop`, assert that `@keyframes <name>` exists and that the
    class `.<name>` appears inside a `prefers-reduced-motion: reduce` block.
- [ ] **Step 2:** Run `npm test -- --testPathPatterns="FlIcon|motionCss"`.
      Expected: FAIL (the module is missing).
- [ ] **Step 3:** Implement `FlIcon.tsx`, `fonts.ts`, the `styles.ts`
      tokens and the keyframes. Apply `flDisplay.variable` plus `CHROME_BG`
      on the `GameShell` in `Flamelings.tsx`, replacing
      `bg-amber-100 dark:bg-slate-900`. Read the Next 16 font docs in
      `node_modules/next/dist/docs/` first.
- [ ] **Step 4:** Run `npm test -- --testPathPatterns="FlIcon|motionCss"`,
      then `npm run type-check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(flamelings): design foundation — font, tokens, icons, motion`.

### Task 2: Pet view HUD and dock

**Files:**

- Modify: `components/flamelings/Meters.tsx` (round gauges),
  `components/flamelings/PetView.tsx` (top bar layout, `BarButton` becomes
  the dock tile), `components/flamelings/SparkCounter.tsx`,
  `components/flamelings/SoundToggle.tsx`
- Test: `components/flamelings/__tests__/Meters.test.tsx` (new), the existing
  `Flamelings.test.tsx` and `e2e/flamelings.spec.ts`

**Interfaces:**

- Consumes `FlIcon`, `STICKER*`, `SPARK_PILL` and `DISPLAY` from Task 1.
- `Meters` keeps its signature `({ pet }: { pet: Pet })`. Each gauge:
  - is a `role="progressbar"` element named Fuel, Joy or Tidy, with
    `aria-valuenow` (rounded) and `aria-valuemin=0`/`aria-valuemax=100`;
  - draws an SVG ring (r=24, stroke 5) with the stat's `FlIcon` in the
    centre;
  - has `data-low="true"` when the value is under 30, which adds
    `fl-pulse-soft` and a red `!` badge (`aria-hidden`).
- Ring colours: fuel `#ff8a3d`, joy `#f43f5e`, tidy `#38bdf8`; low turns
  every ring `#ef4444`.
- The name plate keeps the `progressbar` named "Experience". Its level ring
  shows `pet.level` in the centre, and the subtitle is
  `<Stage label> · <xpToNext> to grow`.
- `BarButton` takes `icon: FlIconName` (was `string`) and keeps `label`,
  `active`, `disabled`, `badge` and `onClick`. The tile is a coloured
  50px rounded-square icon over a Fredoka label, inside a cream dock.
  Per-action icon backgrounds: feed `#ffb36b`, play `#b69cff`, dress
  `#ff8fb1`, shop `#ffd166`, emotes `#6fd3a8`, friends `#7cc4ff`.
- Keep each dock button's accessible name exactly as today (`Feed`, `Play`,
  `Wardrobe`, `Shop`, `Emotes`, `Friends`). The visible label for Wardrobe
  may read "Dress up" only if the `aria-label` stays "Wardrobe".
- Wish bubble: when the pet is awake and a need is under 30, a white
  speech bubble near the pet (`aria-hidden`, `fl-pop-in` then a gentle bob)
  shows the lowest need's wish: fuel "Snack time?", joy "Play with me!",
  tidy "It's messy!". Hide it while a tray, sheet or happening is open.
  Test in `Flamelings.test.tsx`, `wish bubble names the lowest need`: a pet
  with fuel 10 shows "Snack time?".
- Layout:
  - **≥ sm:** home, name plate, gauges, spacer, sparks, sound, all in one row.
  - **< sm:** home, name plate, sparks and sound on the first row, gauges on
    the second.
  - **Dock below sm:** a 3×2 grid of tiles, each ≥64px.

- [ ] **Step 1: Write the failing tests** in `Meters.test.tsx`:
  - `shows each need as a named progressbar`: for each of Fuel, Joy and
    Tidy, `getByRole("progressbar", { name })` has `aria-valuenow` equal to
    the rounded value.
  - `marks a need under 30 as low`: a pet with `joy: 12` gives the Joy
    gauge `data-low="true"` and Fuel `data-low="false"`.
- [ ] **Step 2:** Run `npm test -- --testPathPatterns=Meters`. Expected:
      FAIL.
- [ ] **Step 3:** Implement the gauges, name plate, sparks pill, sound
      button and dock.
- [ ] **Step 4:** Add the e2e phone check in `e2e/flamelings.spec.ts`,
      tagged `@smoke`: at viewport 390×844 after hatching, each of the six dock
      buttons is visible with bounding box width and height ≥ 64, and
      `document.documentElement.scrollWidth <= 390`.
- [ ] **Step 5:** Run `npm test -- --testPathPatterns=flamelings` and
      `npx playwright test e2e/flamelings.spec.ts --project=chromium`.
      Expected: PASS.
- [ ] **Step 6:** Commit `feat(flamelings): storybook HUD — name plate, need gauges, icon dock`.

### Task 3: Glade — the pet is the campfire

**Files:**

- Modify: `components/flamelings/Glade.tsx`, `components/flamelings/DecorArt.tsx`
  (only `DECOR_SPECS` x/y if the ground line moves),
  `components/flamelings/PetView.tsx` (pet anchor position over the
  fire), `app/globals.css` (glade keyframes: `fl-lantern-sway`,
  `fl-ember-rise`, `fl-pool-glow`)
- Test: the existing `Flamelings.test.tsx` decor test ids (`fl-decor-*`)

**Interfaces:**

- `Glade({ nowMs, decor })` keeps its signature.
- Add a `CampfireBase` sub-component, drawn below the pet, made of:
  - a stone ring (six ellipses with `#b8b2c6`→`#6f6884`);
  - two crossed logs with lit end-grain;
  - a ground light pool (radial `#ffb35c`), with its opacity scaled by
    `GLOW[phase]` and a minimum of 0.35 in the day.
- Lantern string: a catenary between the two trees with four bulbs
  (`#ffd27a`, `#ff9fb3`, `#9fd8ff`, `#ffd27a`) that sway via
  `fl-lantern-sway`. It replaces the lone hanging lantern so nothing hangs
  from off-screen.
- Hills:
  - three layers, far `#8c6aa6`, mid `#5b7a8f`, near `#4f8a5e`;
  - the near ridge gets a 3px rim stroke in the horizon colour at .45
    opacity;
  - distant pine triangles;
  - day colours are brighter variants per `skyPhase`.
- Keep the `SKY`, `TINT` and `GLOW` tables (tune the values) and the stars
  and fireflies.
- The pet's feet sit in the logs, centred horizontally, and the dock never
  covers the stones at any layout.

- [ ] **Step 1:** Run `npm test -- --testPathPatterns=Flamelings` to record
      the baseline.
- [ ] **Step 2:** Implement the art and the pet anchor.
- [ ] **Step 3:** Run the tests again (expected: PASS), then
      `npx playwright test e2e/flamelings.spec.ts --project=chromium`
      (expected: PASS).
- [ ] **Step 4:** Take screenshots with the dev server at 1024×768 and
      390×844, with the clock at 12:00, 18:00 and 02:00 (use the
      `window.__flamelings` test hooks). Save them to the scratchpad and list
      the paths in the report.
- [ ] **Step 5:** Commit `feat(flamelings): campfire glade with lantern string and layered hills`.

### Task 4: The flameling comes alive

**Files:**

- Modify: `components/flamelings/Blob.tsx` and `app/globals.css` (the
  `.fl-*` blob rules)
- Test: `components/flamelings/__tests__/Blob.test.tsx`

**Interfaces:**

- Keep `BlobProps` unchanged, along with every data attribute on `.fl-pet`
  and `.fl-blob`.
- Add `fl-cheek` ellipses (`#ff6b6b`, opacity .5) at about (44,84) and
  (76,84), r 5×3.
- Eyes: rx 5, ry 6.5; add a second small shine per eye (r .8, below-left of
  the main shine).
- `fl-core`: brighter, larger radial glow (`#fff6c2`).
- Idle animation `fl-idle-squash`: scaleX .97 / scaleY 1.04 at 50%, 2.6s,
  origin at the base.
- Tip flicker: skew ±4°, 1.1s, on the `fl-lick` group.
- Tap squish: add `data-squish` toggled by PetView on tap, giving
  `fl-tap-squish` (scaleY .88 → 1.08 → 1, 380ms).
- The existing mood, fade, stage and form rules must still win.
- New test in `Blob.test.tsx`: `draws cheeks and two shines per eye`
  asserts 2 `.fl-cheek` and 4 `.fl-shine`.

- [ ] **Step 1:** Write the test above. Run
      `npm test -- --testPathPatterns=Blob`. Expected: FAIL.
- [ ] **Step 2:** Implement the art, the CSS and the PetView tap hook.
- [ ] **Step 3:** Run `npm test -- --testPathPatterns=Blob`. Expected: PASS.
- [ ] **Step 4:** Take screenshots of a Wardrobe preview with a hat, face
      item and neck item, at stages spark, flame and bonfire, and at two forms
      (set them up via `window.__flamelings`). Check that the accessories still
      sit on the body, and list the paths.
- [ ] **Step 5:** Commit `feat(flamelings): livelier flameling — cheeks, sparkle eyes, squash and flicker`.

### Task 5: Shelf, hatch and naming

**Files:**

- Modify: `components/flamelings/Shelf.tsx`, `components/flamelings/Hatch.tsx`,
  `components/flamelings/EggArt.tsx`, `app/globals.css`
  (`fl-egg-wobble-1..5`, `fl-crack`, `fl-hatch-burst`)
- Test: `components/flamelings/__tests__/FlamelingsShell.test.tsx` and
  `e2e/flamelings.spec.ts` (existing)

**Interfaces:**

- Shelf:
  - Fredoka title with a warm glow and a flame `FlIcon` in place of the 🔥
    emoji.
  - Pets show in glassy "jar" cards (translucent fill, 2px light border,
    inner orange glow) in a responsive grid (1 column below sm, 2 at sm,
    3 at lg), resting on a wooden plank strip.
  - Each card shows the `Blob` (fit), the name in Fredoka, and
    `Stage · Lv n` plus a mood word from the existing mood.
  - The "Hatch new" card keeps its accessible name, with the egg in a twig
    nest and a dashed border.
  - The Memory Grove link and the "What's new · vX" footer are restyled but
    keep their text.
- Hatch:
  - The egg's wobble intensity rises with tap count (class
    `fl-egg-wobble-<n>`), and an SVG crack path is revealed per tap.
  - On the final tap: `fl-hatch-burst` (a radial light flash, scale and
    fade), the existing confetti, then the pet pops in with `fl-pop-in`.
  - Keep the button name `Tap the egg (n of 5)`.
- Naming: `STICKER` panels, Fredoka labels, a rounded input with a thick
  orange focus ring, colour and eye choices as sticker tiles with a
  selected check badge (`FlIcon check`), and a `PRIMARY_BUTTON` for
  "Welcome home!".

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npm test -- --testPathPatterns=flamelings` and
      `npx playwright test e2e/flamelings.spec.ts --project=chromium`.
      Expected: PASS.
- [ ] **Step 3:** Take shelf screenshots (0, 1 and 3 pets), plus the hatch
      mid-taps and the naming screen, at 1024×768 and 390×844 in light and
      dark mode. List the paths.
- [ ] **Step 4:** Commit `feat(flamelings): jar shelf, building hatch and sticker naming`.

### Task 6: Panels and sheets

**Files:**

- Modify: `Shop.tsx`, `Wardrobe.tsx`, `ItemPreview.tsx`, `FeedTray.tsx`,
  `PlayPicker.tsx`, `EmotePanel.tsx`, `CelebrationCard.tsx`,
  `HappeningIntro.tsx`, `MemoryGrove.tsx`, `TabLocked.tsx`,
  `SharePicture.tsx`, `VersionHistory.tsx` and `Flamelings.tsx` (the
  unsaved and update banners), all in `components/flamelings/`
- Test: `components/flamelings/__tests__/Shop.test.tsx` (add one test),
  plus the existing suites

**Interfaces:**

- **Full-screen panels** (Shop, Wardrobe, Memory Grove, Versions): the
  `CHROME_BG` backdrop, then a header row (Fredoka title with its `FlIcon`,
  `SPARK_PILL` where sparks show, a `PRIMARY_BUTTON` Done), then
  `fl-sheet-up` on mount.
- **Tabs:** sticker chips with an icon; the selected one is filled orange.
- **Item cards:** `STICKER`, with the art on a soft radial spotlight.
  - Price button: a gold `SPARK_PILL` when affordable, cream with a lock
    `FlIcon` when not.
  - Owned or worn: a green check badge.
- **Purchase:** add `data-just-bought` on the bought card for 700ms, which
  plays `fl-purchase-pop` and a sparkle burst. Add a test in
  `Shop.test.tsx`, `marks the item just bought`: after buying an
  affordable item, its card has `data-just-bought="true"`.
- **Bottom trays** (FeedTray, PlayPicker, EmotePanel): a cream tray that
  slides up (`fl-sheet-up`) above the dock, with tiles in the sticker
  style.
- **Dialogs** (CelebrationCard, HappeningIntro, TabLocked, SharePicture):
  a `STICKER` card with `fl-pop-in`, a dimmed backdrop (`bg-[#1b1430]/55`)
  and `PRIMARY_BUTTON` actions. Keep each dialog's role and name.
- **Screen changes** (`view.screen` in `Flamelings.tsx`): wrap the active
  screen in a keyed div with `fl-fade-in` (180ms).
- **Banners** (unsaved, update pill): same text and test ids, in the new
  button style.

- [ ] **Step 1:** Write the `Shop.test.tsx` test above. Run
      `npm test -- --testPathPatterns=Shop`. Expected: FAIL.
- [ ] **Step 2:** Implement all the panels.
- [ ] **Step 3:** Run `npm test -- --testPathPatterns=flamelings` and the
      Chromium e2e. Expected: PASS.
- [ ] **Step 4:** Take screenshots of the Shop (affordable and not),
      Wardrobe, Feed tray, Play picker, a celebration and a happening intro, at
      1024×768 and 390×844. List the paths.
- [ ] **Step 5:** Commit `feat(flamelings): sticker panels, sliding sheets and purchase pop`.

### Task 7: Friends and mini-game chrome

**Files:**

- Modify: `components/flamelings/friends/FriendsScreen.tsx`,
  `CodeKeypad.tsx`, `NamePicker.tsx`, `PlaydateScene.tsx`, `CardBlob.tsx`
  (frame only), `components/flamelings/FireflyCatch.tsx`,
  `MarshmallowToast.tsx`, `LogStack.tsx` (HUD, buttons and result cards
  only)
- Test: `components/flamelings/__tests__/Friends.test.tsx` and
  `FormsAndGames.test.tsx` (existing)

**Interfaces:**

- Friends uses the full-screen panel pattern from Task 6.
  - The friend code shows as big Fredoka digits in cream tiles.
  - Keypad keys are `STICKER_BUTTON`s (≥64px) with digits in Fredoka.
  - Friend cards are jar cards, as on the shelf.
- Mini-games: the score and timer become a `SPARK_PILL`-style chip plus a
  cream timer chip, and the end-of-game result is a `STICKER` dialog with
  `fl-pop-in`. Don't touch the game mechanics, timings or scoring.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npm test -- --testPathPatterns=flamelings` and the
      Chromium e2e. Expected: PASS.
- [ ] **Step 3:** Take screenshots of the Friends screen, keypad,
      playdate, and one mini-game mid-play and at its result. List the paths.
- [ ] **Step 4:** Commit `feat(flamelings): storybook friends and mini-game chrome`.

### Task 8: Release 2.0.0 and full verification

**Files:**

- Modify: `lib/flamelings/version.ts`, `lib/flamelings/changelog.ts`,
  `e2e/perf-budget.json` (only if perf runs Flamelings; it doesn't today)

- [ ] **Step 1:** Set `FLAMELINGS_VERSION = "2.0.0"` and add the top
      changelog entry. Write it in the kid-friendly voice of the existing
      entries, covering:
  - the cozy campfire glade with lanterns;
  - the flameling's new cheeks, sparkly eyes and wiggles;
  - the new buttons and gauges;
  - the glowing jar shelf;
  - the egg that cracks;
  - the shop pop.
- [ ] **Step 2:** Run `npm run validate`. Expected: lint, format, types,
      unit tests and build all pass.
- [ ] **Step 3:** Run `npx playwright test e2e/flamelings.spec.ts e2e/flamelings-offline.spec.ts`
      (all projects). Expected: PASS.
- [ ] **Step 4:** Commit `feat(flamelings): release 2.0.0 — the storybook glow-up`.
