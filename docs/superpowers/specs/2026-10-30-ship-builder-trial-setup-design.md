# Ship Builder: trial setup, Shipwreck storm, speed and lifeboats

Date: 2026-10-30. Status: approved by Gentry to plan and build ("I trust you to
pick sensible answers"). Calls marked **(our call)** were made by Claude, not
Gentry.

## Why

Gentry's kids run sea trials a lot. Today:

- The Waves trial uses the sea picked on the main screen, so changing the trial
  means leaving it, changing a view chip, and starting again.
- The Iceberg trial is forced to night ("I hate that we're forced to do
  iceberg at night").
- There is no trial where the ship reliably goes down in the waves, and the
  waves feel tame.
- Long trials can't be sped up.
- Lifeboats leave half-empty at random (true to the Titanic), so "did we build
  enough lifeboats?" can't be seen.

Success: a kid opens Sea trial, picks a trial, sees big, icon-labelled choices
for that trial right there, presses go, can fast-forward, and in a sinking can
see whether the lifeboats were enough for everyone.

## Goals

1. **Trial setup card.** Each trial gets its choices when you pick it from the
   Sea trial menu, not from the main screen.
2. **Time of day per trial** (all trials), defaulting to the main-screen time.
   The forced night for Iceberg goes away.
3. **Shipwreck storm**, a new trial in the Sea trial menu: wild, chaotic waves
   that always sink the ship, over a moderately long run.
4. **Speed 1x to 20x** while any trial plays (and on its replay).
5. **Lifeboat switch** the kids flip: "Like the Titanic" (today's behaviour) or
   "Fill every seat" (people board as long as there are seats; the rest stay on
   board). Either way, every lifeboat is lowered during a sinking.
6. Every option in these pickers has an icon plus a short word, so a child who
   can't read well can tell them apart.

## Non-goals

- The main-screen sea and time chips stay exactly as they are (Gentry: "Still
  have the main sea setting"). They are the building backdrop and the default
  for a trial's choices. A trial's choices never change them.
- No new main-screen "wild" sea. Wild is the storm trial's own sea.
- Drive mode is untouched, apart from the iceberg trial a hard hit starts
  (below).
- No change to how challenges pick their conditions.

## Anti-goals

- A "Shipwreck storm" that some ship survives. It must always sink.
- A storm that is over in a few seconds (a quick capsize). It should feel long.
- Fast-forward that changes what happens. Every speed plays the same trial
  faster, nothing else.
- "Fill every seat" that leaves people behind when there were enough seats
  (for example because they couldn't walk to a boat, or a boat can't draw that
  many figures).
- Any new analytics prop that could identify a child. Only closed enums.

## The flow

1. **Sea trial menu** (bottom centre, as today) lists three items, each with an
   icon: **Waves** (`Waves`), **Shipwreck storm** (`Tornado`), **Iceberg**
   (`Snowflake`).
2. Picking one opens that trial's **setup card** in the bottom-centre slot (the
   one `IcebergAimHint` uses now). The card has a title with the trial's icon,
   rows of icon-plus-word segmented choices, a **Cancel** (X) button and, for
   Waves and Storm, a big **Go** button. Iceberg keeps its current "tap the
   hull to aim" step: the card is the aim hint with the extra rows, and tapping
   the hull starts it.
3. While the card is open the scene previews the choices (pick Night and it
   goes dark, pick Stormy and the sea gets rough) **(our call)**. Cancel goes
   back to the main-screen look.
4. The trial runs with those choices. The result card's Replay and close work
   as today. Closing returns to the main-screen sea and time.

Rows per trial:

| Trial           | Rows                                                      |
| --------------- | --------------------------------------------------------- |
| Waves           | Sea (Calm / Choppy / Stormy), Time (Day / Sunset / Night) |
| Shipwreck storm | Time, Lifeboats, How she breaks                           |
| Iceberg         | Time, Lifeboats, How she breaks (existing switch)         |

Iceberg keeps using the main-screen sea, as today **(our call: it already has
three rows and the sea barely matters to it)**.

Icons (lucide): sea uses the main screen's own icons (Calm `Sailboat`, Choppy
`Wind`, Stormy `CloudLightning`); time uses `Sun`, `Sunset`, `Moon` like the
main screen; lifeboats use `Ship` for "Like the Titanic" and `Users` for "Fill
every seat" **(our call)**. Each segment shows icon and word together, never
icon only, at least 44px tall.

Remembering: the setup card opens on the last choice made in a setup card on
this device for sea, lifeboats and speed; time opens on the main-screen time
each time **(our call: time is the one Gentry wants to vary, and the main
screen is the natural default)**. Stored with `createStoredSetting`, like the
other UI settings, not saved with the ship.

Trials started some other way skip the card and use defaults: a challenge uses
its own definition plus the main-screen time; an iceberg trial started by a
hard hit in Drive mode uses the main-screen sea and time and the remembered
lifeboat choice.

## Time of day

`useTimeOfDay` reports the trial's chosen time while a trial is in setup,
running or showing its result, and the main-screen time otherwise. The
"iceberg is always night" rule is removed. The trial's time is scene-only; the
sim never reads it.

## Speed 1x to 20x

- A small segmented control (`Play` 1x, `FastForward` 2x, `ChevronsRight` 3x, `Rabbit` 5x,
  `Rocket` 10x, `Zap` 20x, each with its label "1x" ... "20x") shows in the running trial's status
  area and on the result card while a replay plays **(our call on placement;
  next to the existing trial status, not covering the ship)**.
- It multiplies the playback rate the runner already has. It composes with the
  breakup slow-mo (`slowMoSpeed`): effective rate = slow-mo rate x multiplier.
- The sim stays fixed-step and deterministic: speeding up runs more steps per
  frame, never bigger steps. Same outcome, same events, same timeline at every
  speed (tested).
- Everything driven by `trialPlayback.time` (crowd, boats, funnels, effects,
  bubbles, the story clock) follows automatically. Sounds keep their pitch.
- The choice is remembered on the device and applies to every trial.
- Reduced motion: still offered; it changes nothing about the reduced-motion
  rules already in place.

## Shipwreck storm

A new trial kind. It always sinks, takes a moderately long time, and uses a
new **wild** sea.

**The wild sea** (scene and sim, kept in step as today: the sim's roll waves
use the same weights and frequencies as the scene's sea):

- Bigger and faster than stormy, overcast and dark, full cloud.
- Chaotic: waves from more than one direction (a cross sea) and frequencies
  that don't line up, so there's no steady rhythm. More summed components than
  the other seas, still pure sine sums, still deterministic.
- Fits the perf budget: the wild sea must not add draw calls (it is the same
  sea mesh with different wave parameters).

**How she goes down** (builder chooses the exact model and tuning; these are
the targets):

- She is battered for a while first: big chaotic rolls, spray, the story of a
  storm. Water then gets in, progressively, by reusing the iceberg trial's
  flooding machinery (compartments, walls, spill, trim, plunge, breakup, power,
  funnels, descent) with a storm source of water instead of a gash, so a
  well-bulkheaded ship lasts longer but still goes.
- **Always sinks**, for every template and for degenerate builds (one block, no
  walls, all walls, tiny, huge). Tested.
- **Duration:** from Go to `sunk` between 60 and 120 sim seconds at 1x for
  every template **(our call on the window: "moderately long")**, then the
  descent to the sea floor as today.
- A very top-heavy or lopsided ship may roll over, but not in the first 30
  seconds, and a capsize in the storm also ends in sinking with the
  evacuation (so it never ends early as a plain capsize) **(our call)**.
- Lights flicker and go out, funnels may fall, and she breaks in two by the
  "How she breaks" switch, all as in the iceberg trial.
- The scrubber, Replay, story clock and result card work as they do for the
  iceberg trial. The result card explains it in kid words (for example "The
  storm was too strong. Waves filled her up until she sank.") and shows the
  lifeboat line (below).

## Lifeboats

**Every sinking lowers every lifeboat**, in both modes, in the iceberg and the
storm trial (already true for the iceberg trial, where a boat with no riders
still launches; the storm trial gets the same evacuation). A plain capsize in
the Waves trial stays as it is, with no evacuation **(our call: she rolls over
in seconds; there is no time to lower boats)**.

**The switch** (shown on the Storm and Iceberg setup cards, remembered on the
device, default **Fill every seat** **(our call: it is the lesson)**):

- **Like the Titanic** (`Ship`): today's behaviour, unchanged. Boats leave when
  riders are in, after the wait, or when water reaches them, some half-empty.
- **Fill every seat** (`Users`):
  - Count the real people (passengers plus crew berths from the ship's stats)
    against the real lifeboat seats (sum of catalog `seats` of lifeboats that
    hang from a davit).
  - If seats >= people: every figure on board ends up in a boat. Nobody is
    left on the ship.
  - If seats < people: the share of figures saved is seats / people (rounded),
    picked by who is nearest a boat; the rest stay aboard and go down with her
    (floating afterwards, as today).
  - Figures are spread across boats by each boat's share of the seats. The
    drawing must fit them: a boat may draw more figures than today's
    `BOAT_SHOWN_MAX` in this mode (packed tighter), so no figure is left
    behind only because a boat can't show them.
  - No random half-empty boats.
  - Boats wait for all their riders (no fixed launch wait), but every boat
    still leaves before the water reaches its boarding spot.
  - Everyone saved must actually reach a boat, even on ships whose decks are
    joined only by jumps (the Titanic template has no stairs). Prefer a
    believable route (climbing between decks along the crowd graph with jump
    links); if a figure truly has no route, it may fade out where it stands
    and appear in its boat. Builder's choice how.

**Result card lifeboat line** (both modes, any trial that sank) **(our
call)**: "Lifeboat seats: N. People aboard: M." plus "Everyone fit in the
lifeboats!" or "Not enough lifeboats: K people were left on board." in Fill
mode, and "Some boats left half-empty, like the Titanic." in Titanic mode.
Numbers are the real counts, not figures.

## Analytics

`trial_run` gains `kind: "storm"` and `sea: "wild"`. Edit
`lib/analytics/gameEvents.ts`, `firestore.rules` and the admin Games tab
together, and extend `firestore-tests/gameEvents.test.ts` (it feeds every enum
value through the rules). No new props (no speed, no lifeboat mode, no time):
the fewer props, the safer for kids **(our call)**. This touches the
security boundary, so it gets the stricter review.

## Constraints

- Sim and crowd stay pure TypeScript, deterministic, no `Math.random`.
- Tailwind only, light and dark mode, mobile-first, touch-friendly (44px), the
  setup card fits a phone-width viewport without horizontal scroll.
- Keyboard: the setup card's segmented groups work with Tab and arrow keys;
  Esc cancels (as aiming does today); focus returns to the Sea trial button.
- Release: Ship Builder minor bump in `lib/ship-builder/version.ts` and a
  matching top `CHANGELOG` entry in kid-and-parent words.
- Work happens in its own git worktree on a feature branch; ship with
  `/ship-reviewed-pr`.
- Update `lib/ship-builder/sim/README.md` and `lib/ship-builder/crowd/README.md`
  for the storm trial, wild sea and fill mode.

## Tests

- Sim: storm sinks every template within the 60 to 120 s window; degenerate
  builds sink; same timeline at any playback speed; wild sea waves match the
  scene's.
- Crowd: fill mode puts every figure in a boat when seats >= people (every
  template with lifeboats, including the Titanic); leaves the right share
  aboard otherwise; every boat launches in both modes; Titanic mode is
  unchanged (existing tests pass untouched).
- UI: menu has three items; each setup card's rows and icons; choices
  remembered; Cancel and Esc; time preview and restore; speed control.
- Rules: new enum values accepted, unknown ones still rejected.
- e2e: a smoke test that opens the storm setup card, presses Go and sees the
  speed control (tagged `@smoke` so it runs on touch projects).

## Left to the builder

Exact wave components and storm flooding model and tuning, story clock wording
for the storm, card layout details, fill-mode packing in a boat, how stranded
figures reach a boat, file and component names.
