# Flamelings — design (1.0 tonight, phases after)

Research: `2026-11-16-flame-pet-research.md`.

## Intent

A Tamagotchi-style pet for Gentry's sons (6 and 8) on their iPad, played morning and evening, public at `/flamelings` for anyone. You hatch, name and dress up a little flame blob (ported from the knowling blob), keep it fed, happy and tidy, and it grows through levels that take longer each time, unlocking accessories, emotes, colours and more. Neglect has stakes but is "dying lite": hungry → sad → ember (relightable) → out for good only after about a week, with a memorial and no lost unlocks.

- **Goals:** delight on every visit (something reacts, pops, unlocks); clear, icon-first UI a 6-year-old can use without reading; several pets per device; steady long progression.
- **Non-goals (1.0):** accounts, cloud save, leaderboards, shop/currency, daily happenings, sound.
- **Anti-goals:** guilt that makes kids cry or quit; a pet that dies over one busy school day; anything sent off the device that a child typed (names never leave the iPad).

## Constraints

- Static export site (Next 16, React 19, Tailwind 4). No server. Save in `localStorage`.
- iPad mini 6 (A15) must be smooth: SVG + CSS animations only, no WebGL.
- Follow repo conventions in `CLAUDE.md` (server components by default, `export default function`, `interface` props, Tailwind only, light and dark).
- Analytics only via `trackGame` with closed enums/ints; schema, `firestore.rules`, rules tests and dashboard change together.

## Approach

Picked: one 2D SVG/CSS game, all state a pure, testable model in `lib/flamelings/` (time simulation, levels, unlocks, catalog, save), UI in `components/flamelings/`. Considered and dropped: a 3D (three.js) world like Planet Smasher (heavier, slower to build, worse for a calm pet game); a canvas game loop (loses the cheap CSS blob and accessibility of DOM buttons).

## The world: Ember Hollow

A cozy glade where flamelings live: a stone hearth ring the pet sits on, a hanging lantern, mushrooms, ferns, drifting fireflies, a woodpile/basket of food. The sky follows the iPad's real clock: dawn (6:30–8), day (8–17), dusk (17–19:30), evening (19:30–21), night (21–6:30) with moon and stars. Layered SVG + Tailwind, CSS keyframes in `app/globals.css`. Works in light and dark (the scene itself is the scene; surrounding chrome respects the theme).

## The pet

- Blob ported from `../knowling/apps/web/src/ui/blob.tsx` + its `.kb` CSS (styles.css lines ~1057–1145), renamed to `fl-` classes. Same goo filter, gradient, colours (ember, rose, gold, lime, aqua, sky, violet, ash), shapes (flame, drop, puff, spark), eyes (round, wide, sharp, sleepy, dots).
- Moods: `happy` (idle), `excited`, `hungry` (droopy, small flames), `sad` (droopy, flat mouth, dim), `sleepy`/`asleep` (zzz, eyes shut), `ember` (tiny, grey-orange, faint glow), `eating` (flare-up chomp).
- Accessories are SVG groups in the same 120×120 viewBox, three slots: **hat** (party hat, crown, wizard hat, top hat, beanie, cowboy hat, propeller cap, viking helmet, flower), **face** (sunglasses, round glasses, monocle, mustache, star cheeks), **neck** (bow tie, scarf, medal). Hats sit on the peak and ride the breathe animation.
- Emotes: love (floating hearts), laugh (bounce + open mouth), dance, spin, wow (wide eyes + "!"), sleepy (zzz), grumpy (steam puffs), sparkle (stars burst). Each ~1.5 s, played on tap from the emote bar or as a reaction.
- Growth stages by level (scale + extra licks/particles): Spark 1–2 (0.6), Flicker 3–5 (0.7), Flame 6–9 (0.8), Blaze 10–14 (0.9), Bonfire 15+ (1.0, ember particles).

## Care and time (all in `lib/flamelings/sim.ts`, pure, injected clock)

- **Awake hours** 6:30–21:00 local. Nothing drains at night; the pet sleeps (care buttons except dress-up and emotes disabled; tapping shows a sleepy zzz).
- **Fuel** (hunger) drains 100→0 over 16 awake hours. Morning full → about 25 by evening.
- **Joy** drains 100→0 over 20 awake hours (1.5× faster while 2+ ash piles sit uncleaned).
- **Ash**: one pile per 4 awake hours, max 4. Tap to puff away.
- **Glow** (health, hidden as a number, shown as brightness): drains 100→0 over 28 awake hours while Fuel is 0; recovers +10/awake hour while Fuel > 30 and Joy > 30.
- **Ember**: Glow 0. Pet tiny and dim. Relight: feed it 3 times → Glow 40, Fuel 50, big celebration.
- **Out for good**: 5 wall-clock days as an ember. Moves to the Memory Grove (name, look, level, days lived). Unlocks are per pet; the device keeps a "collection" of every item ever unlocked, and new pets hatched later start with that collection unlocked (so loss never costs the boys their stuff).
- Net effect: fed in the morning and missed ~2.5 days → ember; ~1 week → out.
- `advance(pet, fromMs, toMs)` integrates only awake time, handles DST and multi-day gaps, and is unit-tested with fixed timezones.

## Actions

- **Feed**: food basket — twig (+15 fuel), pinecone (+25 fuel, +5 joy), log (+40 fuel), marshmallow (+15 joy, +5 fuel), coal (+60 fuel, unlocks at level 4). Tap a food → it arcs into the pet → flare-up chomp. Overfeeding at 100: pet shakes head (no penalty).
- **Play**: Firefly Catch, 20 s, fireflies drift through the glade, tap to catch; the pet cheers. Score → joy (+2 each, cap +40) and XP.
- **Clean**: tap ash piles.
- **Pet**: tap the blob → random unlocked emote reaction.
- **Dress up**: wardrobe tabs Colour / Shape / Eyes / Hat / Face / Neck. Locked items show a silhouette, a lock and the level (or a gift icon).

## Progression

- XP: feed while Fuel < 80 (+10), clean (+3 each), Firefly Catch (score/2, cap +20), pet tap (+1, cap 10/day), gift (+15), relight (+20).
- `xpToNext(level) = round(40 * level^1.4)`; level-ups get slower naturally.
- Each level-up unlocks the next item from a fixed, hand-ordered unlock list (a mix of hats, emotes, colours, faces, foods) with a "NEW!" celebration card. Levels without an item list give a stage change or extra emote slot.
- **Check-in gift**: once per pet per window (morning 6:30–14:00, evening 14:00–21:00), a wrapped present bounces in; tap to open → a random still-locked item (or bonus XP if none). This is the "something new every visit".
- Starting unlocks: colours ember, sky, lime; shape flame; eyes round, wide; emotes love, dance; foods twig, pinecone, log, marshmallow.

## Pets and screens

- **Shelf** (landing): up to 8 pets as big blob cards with name and a state glyph (🍽 hungry, 💤 asleep, 🎁 gift waiting, ember). "Hatch new" card. "Memory Grove" button if any are out.
- **Hatch**: an ember egg wobbles; tap it 5 times → crack → baby spark. Then name (text field, 12 chars max, plus 🎲 random-name button from a kid-friendly list) and pick colour/shape/eyes from the starting set.
- **Pet view**: the glade, the pet center, three need meters as icons (🔥 fuel, 😊 joy, 🧹 tidy) with fill, level/XP bar with stage name, bottom bar: Feed, Play, Wardrobe, Emotes, back to Shelf. Gift appears when available.
- **Versions page** `/flamelings/versions` linked from a small "What's new" label, like Planet Smasher.

## Save

`localStorage["flamelings:v1"]` = `{ v: 1, pets, memorial, collection, updatedAt }`. Validate on load; a corrupt save is copied to `flamelings:v1:corrupt` and the game starts fresh (never throws). Save on every action and on `visibilitychange`.

## Stats (anonymous, `site: "flamelings"`)

Add to `GAME_EVENTS`, `firestore.rules`, `firestore-tests/gameEvents.test.ts`, the admin Games tab, and the pageviews `site` list (`/flamelings` paths), mirroring how ship-builder/plane-builder do it:

- `fl_visit` {window: morning|evening|night, pets: int 0–8} — on opening the shelf, once per page load.
- `fl_hatch` {}
- `fl_care` {action: feed|play|clean|pet|gift|relight} — sample 0.25.
- `fl_play_end` {score: int 0–99}.
- `fl_level` {level: int 2–99, stage: spark|flicker|flame|blaze|bonfire}.
- `fl_state` {to: ember|relit|out}.
- `fl_unlock` {kind: colour|shape|eyes|hat|face|neck|emote|food, via: level|gift}.

Never the pet's name or any typed text.

## Release plumbing

`lib/flamelings/version.ts` (`FLAMELINGS_VERSION = "1.0.0"`), `lib/flamelings/changelog.ts`, versions page, changelog test, a "Flamelings releases" section in `CLAUDE.md` like Planet Smasher's, sitemap entry, home-screen web app manifest + 180px apple-touch icon (no service worker in 1.0), link from wherever the site links Planet Smasher.

## Phases after 1.0

- **1.1 Sparks and shop**: fireflies and care drop Sparks (always-visible counter, juicy pops); a shop of accessories and hearth decor (rugs, lanterns, plants) for the glade; more hats.
- **1.2 Happenings**: something happens most visits — a visitor (owl, snail, frog) brings a gift, rain shower (cover the hearth!), a treasure to dig up, shooting stars at night, seasonal days (snow, Halloween, birthdays = pet's hatch day).
- **1.3 Friends and forms**: two pets play together on the shelf; care shapes branching grown-up forms at Blaze (e.g. Cozy, Wild, Sparkly), more mini-games (Marshmallow Toast, Log Stack).
- **1.4 Sound + offline**: chirps, chomps, a soft glade loop; service worker for offline home-screen play; share a pet card image.

## Left to the builder

Exact SVG art for accessories and the glade, animation timings, the random-name list, the level unlock order, exact layout per breakpoint (iPad portrait and landscape first, then phone, then desktop).
