# Flamelings 2.0 — visual overhaul ("cozy dusk storybook")

Status: approved by Gentry on 2026-11-17 ("It's great. Make it happen").
Reference mockup: `docs/superpowers/specs/2026-11-17-flamelings-visual-overhaul-mock.html`
(open it in a browser to see the animated glade and shelf).

## Intent

Flamelings (1.5.0) works but looks "lowkey ugly". The players are Gentry's sons
(6 and 8) on iPads plus the public on phones. Gentry asked for a full zhuzh of
UX, UI and animation, and let Claude choose the direction. He approved the
mockup.

What's wrong today:

- The glade is flat clip art. The lantern hangs from a branch the top bar
  hides, and the pet sits on the rim of what reads as a dirt hole.
- Three long lime progress bars in slate pills cover the sky.
- System emoji are used as UI icons (🏠 🔊 🍖 🛒 👫) next to hand-drawn SVG art.
- The menu screens look like a web form: a lone dashed card on a beige
  gradient, white cards, grey price pills.
- The pet is small, and the big moments (hatching, buying) have no build-up.

Success: the boys open it and it feels like a real, polished kids' game: warm,
alive and tactile, with every screen in one consistent style.

## Goals

1. **One visual language** on every Flamelings screen.
   - Cream "sticker" panels: `#fff6e6`, with a 4–6px darker bottom edge as a
     chunky shadow and a soft drop shadow.
   - Rounded display font (Fredoka) for headings, names, numbers and buttons.
   - Plum ink (`#3a2340`) for text on the panels.
2. **Custom SVG icons** replace every emoji used as a UI control or label
   icon (home, sound on/off, feed, play, dress up, shop, emotes, friends,
   back, close, share, sparks, fuel/joy/tidy, tab icons).
   - Emoji that are _content_ stay: emote bubbles, the treats in the feed
     tray if they have no art, item art.
3. **Pet view HUD redesign**, per the mockup:
   - **Top left:** home button, then a name plate pill with a level ring
     (XP progress) and the subtitle `<Stage> · <n> to grow`.
   - **Stats:** three round gauges (fuel, joy, tidy) with ring progress. A
     gauge pulses and shows a red `!` badge when low.
   - **Top right:** a gold sparks pill with a shimmer, then the sound button.
   - **Bottom:** a cream dock of action tiles. Each tile is a coloured
     rounded-square icon with a label. Tiles keep their current badges (the
     `!`/gift dots) in the new style.
   - The sky stays mostly clear.
4. **Glade art upgrade** (`Glade.tsx`). The pet _is_ the campfire.
   - A stone ring and crossed logs under the pet, and a warm light pool on
     the ground that pulses.
   - Layered hills with a rim-light stroke on the near ridge, rounder trees,
     distant pines.
   - A string of lanterns between the two trees, which sway.
   - Rising embers and fireflies.
   - Keep the time-of-day sky (`skyPhase`) and its tint and glow tables. Tune
     the colours so day is still bright and dusk matches the mockup.
   - Decor and happenings must still sit in sensible places, so retune
     `DECOR_SPECS` positions if the ground line moves.
5. **The flameling (`Blob.tsx` + `.fl-*` CSS)** gets more life. Keep the
   metaball construction (shapes, forms, colours and accessories depend on
   it), then add:
   - Cheeks.
   - Bigger eyes with a big and a small highlight.
   - A brighter inner core glow.
   - An idle squash-and-stretch bob and a flickering tip.
   - Periodic blinks (if not already present).
   - A tap "squish" response.
   - Accessories must still line up at every stage and form.
6. **Shelf** becomes pets glowing in glassy "jar" cards on a wooden plank.
   Each card shows the name, stage, level and a mood word. The "Hatch an egg"
   card has the egg in a twig nest. The title has a warm glow.
7. **Hatch flow** builds up:
   - The egg wobbles more with each tap, and cracks appear.
   - A burst of light and confetti, then the pet pops out with a squash.
   - The naming screen uses sticker panels.
8. **All other screens and panels** get the new style:
   - Shop, Wardrobe, FeedTray, PlayPicker, EmotePanel, Friends (and its
     keypad, name picker, playdate), CelebrationCard, HappeningIntro,
     MemoryGrove, TabLocked, SharePicture, the Versions page.
   - The mini-game chrome (FireflyCatch, MarshmallowToast, LogStack): their
     HUD and buttons only, not their mechanics.
9. **Motion and feel:**
   - Buttons squish on press (scale plus a lowered bottom edge).
   - Sheets and panels slide or pop in and out instead of appearing.
   - Buying something plays a "pop" (scale bounce plus sparkle) on the item.
   - Screen changes cross-fade.
   - All of it is CSS keyframes in `app/globals.css` under the `fl-` prefix,
     and all of it is disabled under `prefers-reduced-motion`.
10. Ship as **Flamelings 2.0.0** with a changelog entry kids can follow.

## Non-goals

- No game-logic, balance, save-shape, analytics or online/Firestore changes.
- No redraw of the accessory art (`Accessories.tsx`), decor art
  (`DecorArt.tsx`) or happening art (`HappeningArt.tsx`). They stay; only
  their containers are restyled. Small fixes are fine where the new layout
  makes them look wrong.
- No new sounds (existing sound hooks may be called from new interactions).
- No new screens or features.

## Anti-goals (a failure even if it works)

- Tap targets smaller than 64px, or text kids can't read.
- Jank on an iPad mini 6. Animations must be transform/opacity only, with no
  animated SVG filters or blur.
- Any element that breaks in light or dark mode, or at phone width (390×844
  portrait) or iPad width (1024×768 landscape, 768×1024 portrait).
- Breaking safe-area padding (`SAFE_*`, guard test in `lib/game-kit`).
- Losing accessibility: labels, roles and focus rings stay. Decorative SVG
  stays `aria-hidden`.

## Constraints

- Static export Next.js 16, Tailwind 4, React 19. Read
  `node_modules/next/dist/docs/` before touching fonts or layouts.
- **Tailwind only** in components (project rule). Arbitrary values are fine.
  Shared class strings live in `components/flamelings/styles.ts`.
  Keyframes and `.fl-*` art rules live in `app/globals.css`, and the Flamelings
  block must stay _before_ the "Make Everyone Smile" block, which must stay
  last.
- Every element supports light and dark mode.
  - _Claude's call:_ the chrome backdrop follows the theme. Light is a warm
    peach→lavender dawn gradient; dark is the mockup's dusk purple.
  - Cream sticker panels are used in both themes.
  - The glade follows the clock, not the theme (as today).
- The existing e2e tests (`e2e/flamelings*.spec.ts`) and unit tests find
  elements by role, label and test id. Keep every accessible name, role and
  `data-testid`. Update a test only when the change is intended, never to
  paper over a regression.
- **Release rules:** bump `FLAMELINGS_VERSION` to 2.0.0 and add a changelog
  entry. `public/flamelings-sw.js` is generated, never hand-edited.
- **Font:** Fredoka via `next/font/google`, loaded only by Flamelings routes.
  Nunito, or the site's current font, stays the body font.

## Approaches considered

1. **Polish in place: new chrome and art around the existing art (chosen).**
   - Restyle every screen, redraw the glade and HUD, and upgrade the blob,
     while keeping the accessory, decor and happening art and all logic.
   - Biggest visual change for the work, and low risk to the game.
2. **Full art redraw** (all accessories, decor and happenings in a new
   style). About double the work. The existing item art is already decent
   and would mostly look the same.
3. **Theme-only pass** (colours, font, buttons). Cheap, but it leaves the
   flat glade and the bar-heavy HUD, which are the main reasons it looks
   ugly.

Gentry handed the direction to Claude. Claude picked 1, showed the mockup, and
Gentry approved it.

## Left to the builder

- Exact icon drawings, colour values beyond the tokens above, animation
  timings, and per-screen layout details, matching the mockup's feel.
- How the dock fits on a phone in portrait. All six tiles must stay ≥64px:
  two rows, or a scrollable row with a fade, whichever looks better.
- Whether the gauges sit beside the name plate (wide) or under it (narrow).

## Verification

- The unit tests, rules tests, type-check, lint, format and build pass, and
  e2e `flamelings*.spec.ts` passes on Chromium.
- Screenshot check-ins at iPad landscape, iPad portrait and phone portrait,
  in light and dark mode, for the shelf, hatch, naming, glade (day and dusk),
  shop, wardrobe, friends and one mini-game.
