# Shipwreck 1.16: finding the way inside — design (short)

## Why

1.15 let kids walk into the Titanic's rooms, but getting there takes five
steps nobody would find alone: pick the Titanic, find the walking button
(or "Walk the deck" in the camera picker), walk ~25 m to a door that only
glows, stand right beside it, then tap a door button that only appears
there. Gentry's kids couldn't find the inside. Success: a young child who
has never been told gets into a room within a few taps, and on deck can
always see where the doors are.

## Goals

1. **Start inside from the menu.** Next to "Walk the deck" in the camera
   picker, a ship with an interior gets picture buttons that start a walk
   standing in a room: **Grand Staircase** (Boat deck entrance under the
   dome, facing down the stairs), **Suite** (`suite-1`), **Third class
   cabin**, **Scotland Road** (its dry forward part at the start of the
   night). One tap: camera goes to walk, walker placed in that room.
2. **Lead them to a door on deck.** While walking on the Titanic's open
   decks with the rooms open: a big amber arrow bobbing over the nearest
   open deck door, sized to read from anywhere on that deck (billboard,
   unlit, no new three.js lights, one or two draws). Hidden inside, after
   the break, when not walking, and on ships without rooms. Reduced
   motion: no bob.
3. **Start facing a door.** The Titanic's walk spawn faces the Grand
   Staircase door (yaw change; move the spawn only if it stays on the boat
   deck and every existing walk test still passes).
4. **The walking button asks to be tapped.** On a ship you can walk, the
   Walk button pulses (CSS, reduced motion: none) until the player has
   walked once. Remembered in the save as an optional flag
   (`seen.walked`, missing = false: additive, no reset; covered by the
   save tests).

## Room buttons: rules

- Shown only for a ship whose `interiorFor(ship.id)` is non-null (only the
  Titanic now; Concordia later gets them as data).
- Each room button is per-ship data next to the interior (`entries`: id,
  icon, room area id, spawn point and yaw), so a new ship adds data, not
  code.
- A room you can't stand in right now (rooms closed after the break, or
  its water above wading depth at the current time) is hidden, not greyed:
  kids read grey as broken. If every room is hidden, only "Walk the deck"
  shows.
- Starting in a room uses the existing placement path (`placeWalk`-style:
  the same code the e2e hooks use), so `walkInside`, FOV, water, lights
  and the torch all start correctly.
- Picture buttons only; words only in `aria-label` ("Walk inside: Grand
  Staircase", …). New icons in `Icon.tsx`: staircase, bed, bunk, corridor.

## Non-goals

- Concordia (separate design, built in parallel).
- New analytics events or props (a schema change means rules and dashboard
  too; not worth it for this).
- Moving the doors, new doors, a map, or a tutorial with words.

## Constraints

- Deck walking behaves as before apart from the spawn's facing; existing
  walk and scene tests pass unchanged (a spawn-yaw assertion, if one
  exists, is the one allowed edit).
- No per-frame allocations in `useFrame`; Safari 15 compat; Tailwind only,
  light and dark; safe areas (`safeAreaGuard.test.ts`).
- Existing `e2e/perf-budget.json` entries unchanged (the arrow is not built
  when not walking; walk scenes stay within the 5% margin).
- Release: `SHIPWRECK_VERSION` 1.16.0 and a changelog entry in plain words.

## Approaches considered

- **Start inside from the menu** only: fastest, but kids never learn the
  doors on deck exist.
- **Lead them on deck** only: keeps finding the way in, but still depends
  on finding the Walk button and walking there.
- **Both** (picked by Gentry): menu for one-tap rooms, the arrow and the
  pulse so the doors are obvious on deck.

## Left to the builder

Exact spawn points inside each room, arrow size and height, pulse timing,
icon drawings, where the room buttons sit in the picker at phone width.

## Checks

Unit tests for: room entries data (every entry's area exists, spawn inside
its outline, on the floor), the hide rules (after the break, deep water),
the picker showing room buttons only for a ship with rooms, the save flag
default and round trip, the arrow's nearest-door choice and its hiding
rules. e2e (local): tap Grand Staircase in the picker → `getWalk().inside`
and area `gs-boat`. Screenshots at iPad landscape, iPad portrait and phone
with the picker open and with the arrow on deck.
