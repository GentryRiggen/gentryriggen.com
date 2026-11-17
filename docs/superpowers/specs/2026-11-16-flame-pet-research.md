# Flame pet (Tamagotchi-style) — research notes

2026-11-16. Background for a virtual-pet game built around the knowling flame blob.

## The knowling blob today (`../knowling/apps/web/src/ui/blob.tsx`)

- One 120×120 SVG: 8 circles merged by a "goo" filter (blur + alpha threshold), filled with a 3-stop vertical gradient, plus a core glow, two eyes and three mouths.
- All look lives in CSS keyed on data attributes: 8 colours (ember, rose, gold, lime, aqua, sky, violet, ash), 4 shapes (flame, drop, puff, spark: the same circles moved/hidden), 5 eyes (round, wide, sharp, sleepy, dots), 5 moods (idle, excited, proud, thinking, sleepy) as CSS animations.
- It is cheap (no canvas, no WebGL), so it ports to this site as a React component + Tailwind/globals.css keyframes. Accessories would layer as extra SVG groups anchored to the face/peak; emotes as extra mouth/eye/animation states.

## How the classic loop works

- Meters: Hunger and Happy drain over time; Discipline only rises when you scold a fake tantrum. Meals fill hunger but add weight; snacks fill happy; minigames fill happy and cut weight.
- Born with empty meters, so the first hour is very needy (beeps). This is the attachment hook.
- Poop and sickness need cleaning/medicine; the light must be turned off at bedtime.
- Neglect counts "care mistakes", which pick a worse evolution. Death can come in a few hours; most pets died within 1–2 weeks. Different deaths for different care.
- Pets sleep on a schedule (roughly 9pm–9am), so nights are safe.
- Death presentation was softened by region: ghost + grave (Japan), angel (US), or "went home to its planet".
- The only pause was setting the clock.

## How modern pets soften it

- Tamagotchi iD and later: after the teen stage the pet runs away / goes on a journey instead of dying. Many modern versions do the same.
- Tamagotchi Uni: care mistakes carry over across evolutions, so neglect shapes the adult rather than ending the game.
- Recent devices turn the light off themselves.
- Nintendogs: no death; the dog gets dirty and sad and, after long absence, may run off briefly. The guilt is real (players report compulsive make-up sessions).
- Finch (self-care app): the bird never dies; it grows and goes on adventures as _you_ do your tasks. Rewards returning, never punishes leaving.
- Pou / Neopets: the long tail is cosmetics. Minigames earn coins; coins buy food, outfits, room decor. Dress-up is what players keep coming back for.

## What the research warns about

- Guilt is a strong return hook (loss aversion), but brittle: once a player lets a pet go, they often never come back, and a pet nobody asked to be responsible for feels like a chore. Kids reportedly cried over dead Tamagotchis.
- A pet that is the _only_ reason to open the game produces dependency, not fun. The fun has to be in the visit itself (playing, dressing up, unlocking).

## Implications for "dying lite"

- Drain slowly in real time, never during the pet's night, and cap how far it can fall while you're away for a short time (a skipped school day must not kill it).
- Make the failure state the flame going out to an **ember** rather than instant death: rekindle it with care within a grace window. Only a long neglect ends the pet, and it ends gently (a little memorial), never wiping unlocks.
- Neglect should cost something visible but recoverable (mood, a missed growth stage, a lost streak) more often than it costs the pet.
- Make each visit fun on its own: an emote reaction, a mini-game, a new accessory, a coin pop. Unlocks give the reason to return; care gives the stakes.

## Sources

- [Tamagotchi — Wikipedia](https://en.wikipedia.org/wiki/Tamagotchi)
- [Care — Tamagotchi Wiki](https://tamagotchi.fandom.com/wiki/Care)
- [Tamagotchi — TV Tropes](https://www.tvtropes.org/pmwiki/pmwiki.php/Toys/Tamagotchi)
- [Nostalgic fans recall when taking care of a Tamagotchi wasn't so easy — ANN](https://www.animenewsnetwork.com/interest/2016-06-01/nostalgic-fans-recall-when-taking-care-of-a-tamagotchi-wasnt-so-easy/.102704)
- [The pet companion design in gamification — Yu-kai Chou](https://yukaichou.com/advanced-gamification/the-pet-companion-design-in-gamification/)
- [Why gamification kills the products it's supposed to save — Mind the Product](https://www.mindtheproduct.com/why-gamification-kills-the-products-its-supposed-to-save/)
- [Guilty party: Nintendogs and guilt as game design](https://amostagreeablepastime.com/2015/05/07/guilty-party-nintendogs-and-guilt-as-game-design)
