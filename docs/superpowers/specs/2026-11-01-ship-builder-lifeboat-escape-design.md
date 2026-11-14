# Ship Builder: escape the sinking ship (lifeboats, rafts, swimming, voice)

Date: 2026-11-01. Status: approved by Gentry in chat ("Write it up and get
going"). Ships as a Ship Builder minor release (2.39.0, or whatever minor is
next when it merges).

## Intent

While walking a sinking ship (walk mode during an iceberg or storm sea trial)
the player can watch passengers hurry into lifeboats, but the player can't
get in themselves. They stay on deck until the walk ends. Gentry wants the
player to **get saved**: walk up to a lifeboat, tap **Board**, ride it down
the side and row away. Or jump into a raft. If they miss the boats, they end
up **in the water and have to survive**: they swim about, which should be fun
and funny, and a boat in the water can still pick them up. Each ending gets a
**popup**, and the key moments get a **voice line** like Ever Onward's
narration.

The players are kids, so it's playful and never grim. Nobody drowns.

## Goals

1. **Board a lifeboat from the deck.** Near a davit lifeboat's boarding spot,
   before that boat lowers, a **Board** button appears. Tapping it seats the
   player in the boat in first person. The boat lowers to the water and rows
   out exactly as the evacuation plan already moves it (`boatPoseAt`), and the
   camera rides along at a seat. The player can still drag to look around. The
   joystick, jump and walking are off while seated.
2. **Jump into a life raft.** At a raft canister's boarding spot, from the
   moment the raft is open on the water (`launch.ready`) until it drifts off
   (`launch.departs`), the button reads **Jump**. The player arcs from the
   deck edge into the raft (the same shape as the `jumping` crowd fate, about
   `JUMP_S`), then rides it as it drifts away.
3. **Saved popup.** Once the player's boat has finished lowering and rowing
   out (davit boat: `launch.at + LOWER_S + ROW_S`; raft: its drift is under
   way), a celebratory popup appears with a voice line: "You're safe! You made
   it into a lifeboat." It offers **Keep watching** (closes it; you stay in
   the boat while she goes down) and **See how she did** (stops walking, shows
   the result card).
4. **In the water.** When the water reaches the player on deck, they go into
   the water instead of sinking with the ship. There's a splash, a popup
   ("Splash! You'll have to survive the waters!") and a voice line. The popup
   closes on a tap or on its own after a few seconds, because the player needs
   to swim.
5. **Swimming.** First person, eyes just above the surface, a gentle bob. The
   same stick and keys move the player, slower than walking (my call: about
   half of `WALK_SPEED`). Turning works as it does on deck. The jump button
   becomes a **kick**, a short burst forward. The player can't climb back onto
   the ship, the ship's hull and halves block them, and the swim area is
   clamped to a sensible radius around the wreck. Movement is in the world
   (water) frame, not the ship's frame.
6. **Rescue from the water.** Any launched boat or open raft that is already
   on the water (past lowering) is a target. When the player swims close
   enough, a **Climb in** button appears. Tapping it seats them, and the saved
   popup and voice play with "after a swim" wording.
7. **Warmth meter.** A meter shows while swimming and drains steadily (my
   call: about 60 seconds from full to empty at 1x trial speed, tuned so a
   nearby boat is comfortably reachable). If it runs out, a funny rescue plays:
   a popup and voice line ("Brrr! You're a human ice cube. Luckily a passing
   fishing boat scooped you up."). That counts as **survived (just)**. With
   no boats at all, the meter still runs and the same rescue comes, so there
   is never a dead end.
8. **Result card.** When the walk produced one of the three endings, the sea
   trial result card shows a line for it: saved from the deck, saved after a
   swim, or fished out frozen. (Nothing extra is shown for a walk where the
   player never got into the water or a boat.)
9. **Voice.** Short, pre-recorded voice lines for these moments (boarded or
   jumped, saved, splash into the water, climbed in from the water, warmth
   running low, fished out frozen). Each moment has 2–3 variants so it doesn't
   get repetitive. The lines are recorded with Google Text-to-Speech the way
   Ever Onward's are (`scripts/ever-onward-narration.mjs`: lines file, hash
   manifest, MP3s under `public/`, nothing calls the API at runtime). They're
   played through Web Audio with the ambient audio session
   (`components/game-audio/audioSession.ts`), so a podcast or music on the
   iPad keeps playing. Voice plays only when Ship Builder's sound is unlocked,
   and it has its own **Voice** switch beside Music and Effects (my call). The
   popup text always shows, voice or not.
10. **Analytics.** Add one `trackGame` event for the ending, with a closed enum
    for the ending (`deck`, `swim`, `frozen`) and the boat kind (`davit`,
    `raft`, `none`). Follow the CLAUDE.md rules: edit the schema, the
    `firestore.rules`, the rules test and the dashboard together. No ids or
    free text.

## Non-goals

- No change to how the passengers' evacuation is planned or drawn. The player
  is an extra rider shown only through the camera. Their seat doesn't take one
  of the drawn passenger figures' seats, and no player body is drawn.
- No rowing or steering a boat yourself. Boats move on their planned paths.
- No new trial kinds, and no swimming outside a sinking (a ship that survives
  never puts you in the water).
- No change to the result card's stars or the challenges score. The ending is
  information only.
- No underwater swimming, diving or holding your breath.

## Anti-goals (would make it a failure even if it works)

- Anything scary: drowning, bodies, a dark "you died" screen. The tone is
  playful.
- Breaking the existing walk-a-sinking-ship flow for someone who ignores the
  boats. Walking on a broken half, exploring the wreck and Stop walking all
  keep working. If the player never goes into the water or a boat, the only
  difference is that going into the water now happens at all (see the open
  call below).
- Voice that pauses the player's podcast or music on iOS, or voice that plays
  while sound is off.
- Tanking the frame rate on a tablet. Swimming must stay inside the existing
  perf budget (`e2e/perf.spec.ts` scenes aren't trials, so the budget is
  unchanged; just don't add per-frame allocations).

## Constraints and what already exists

- Walk mode: `lib/ship-builder/walk/` (pure model: `stepWalker`, grids,
  halves), scene `components/ship-builder/scene/WalkRunner.tsx` (fixed-step
  loop), `WalkEyes.tsx` (camera in the ship's bobbing group, blended by
  `swayShare`), HUD `components/ship-builder/ui/WalkHud.tsx`, live state
  `lib/ship-builder/state/walkLive.ts`, input
  `lib/ship-builder/state/walkInput.ts`, store slice `walk` in
  `lib/ship-builder/state/store.ts`. Today the walker rides the ship (or their
  half) all the way down.
- Evacuation: `lib/ship-builder/crowd/evacuation.ts` (`planEvacuation`,
  `BoatLaunch` with `at`/`ready`/`departs`/`origin`/`outward`, `boatPoseAt`,
  `personWorldPoint`, `floatingSince`, constants `LOWER_S`, `ROW_S`,
  `JUMP_S`, raft timings). The scene caches the plan per trial with
  `trialEvacuationFor` (`scene/trialTimeline.ts`) and draws boats with
  `LaunchedBoats.tsx` (`launchedBoatMatrix`, `boatSeatOffsets` in
  `crowdView.ts`). The plan is pure in sim time `t` (`trialPlayback.time`).
  A plan only exists for iceberg and storm trials that end `sank`. For a
  trial with no plan (she survives, or the waves trial), the boarding and
  swimming features simply don't appear.
- Boarding spots: each lifeboat has a boarding spot (the walkable column
  nearest it, see the crowd README). The player's Board button keys off the
  player's distance to that spot on the body that carries them. The plan
  doesn't currently expose spots; expose what's needed (pure, tested).
- Time: the trial timeline can be fast-forwarded and replayed. Player state
  must stay consistent with `trialPlayback.time`. Time going backward, or a
  replay or Try again, resets the player to walking (or ends the walk) rather
  than leaving them seated in a boat that isn't launched yet. The warmth meter
  drains in sim time.
- Static export site, Tailwind only, light and dark mode, mobile-first, kids
  on iPad (landscape) and iPhone. Buttons are ≥44px tap targets. Respect
  `prefers-reduced-motion` (no bob or arc shake; fade instead).
- Ship Builder releases: bump `SHIP_BUILDER_VERSION`, add a top
  `CHANGELOG` entry in plain words for a young builder.
- Tests: pure logic gets Jest tests beside it. The flow gets Playwright
  coverage in `e2e/ship-builder-walk.spec.ts` using the existing
  `window.__shipBuilderWalk` and `walkSpawn` test hooks (board → saved popup;
  stay aboard → in the water popup → climb in → saved). Voice isn't asserted
  in e2e beyond "no errors".

## Calls I made (Gentry can override)

- Swimming speed about half of walking. The kick is a short forward burst.
- The warmth meter lasts about 60 seconds. It's a blue-to-white "warmth" bar
  with a little thermometer icon. There's a voice nudge at about 25% left.
- A Voice switch beside Music and Effects. The voice is a cheerful one from
  Google's Chirp3-HD set (not the Ever Onward narrator, so the games sound
  different).
- Going into the water happens automatically when the water reaches the
  player's feet on deck (the same rule the crowd uses, `floatingSince`), and
  it replaces today's "ride her down to the sea floor". Explore the wreck from
  the deck still works until the water gets you.
- The ending is also recorded so the result card can show it. It's kept in
  the store for the run only and isn't saved.

## Settled after the builder check (my calls)

- **Catching a boat.** After rowing out, a davit boat stops and bobs in place
  (`boatPoseAt`). A raft drifts `RAFT_DRIFT` over `RAFT_DRIFT_S`, then bobs in
  place. Both stay reachable. The pickup radius is generous (about 1 world
  unit from the boat's centre). A boat counts as a target from the moment it
  is on the water. Tune the warmth time so the nearest launched boat from any
  water-entry point is reachable with time to spare. Test that in the pure
  model.
- **When it ends.** Seated, saved or fished out, the walk keeps going until
  the player taps See how she did or Stop walking (today's rule: the result
  waits until they stop walking). The camera keeps riding the boat as it bobs.
  For the frozen rescue, the camera stays in the water at the player's spot,
  bobbing, with the meter hidden. No fishing boat is modelled; the popup tells
  that part.
- **Voice MP3s.** The controller generates them with the script (gcloud works
  on this machine) and commits them with the manifest. Code must tolerate a
  missing clip (play nothing). The voice is `en-US-Chirp3-HD-Puck`.
- **Riding her down is gone for everyone.** That includes broken halves. Any
  walker the water reaches goes into the water. Existing e2e and unit tests
  that expect riding to the sea floor get updated. In the water, the ship's
  hull or halves are just obstacles the swimmer can't enter (an approximate
  footprint is fine).
- **Boarding any boat.** Board works for any davit boat or raft with a
  boarding spot, whatever its capacity. The player is an extra rider, and the
  camera sits at the boat's centre at seated eye height. No figure is moved
  and no seat slot is used. Board isn't offered for a boat on the half the
  player isn't standing on.
- **Speed while it matters.** While the player is swimming, the trial speed is
  held at 1x (the speed switch is hidden or disabled). Swimming steps run on
  frame time at a fixed step, and warmth drains on the same clock, so there's
  no catch-up integration. Seated in a boat, fast-forward is fine because
  the boat's pose is pure in `t`.
- **Test hooks.** Add whatever hooks the e2e needs (for example, jump the
  trial clock, place the player at a boarding spot or in the water).

## Left to the builder

- How player state is modelled. My suggestion: a small pure state machine
  beside the walk model (`walking` → `boarding/jumping` → `in-boat` →
  `saved`, and `walking` → `swimming` → `in-boat`/`frozen`), with the scene
  and HUD only reading it.
- How the voice player is shared with Ever Onward. Extracting a small shared
  player plus a per-game script config is preferred over copying, but Ever
  Onward's behaviour must not change.
- Exact copy for the popups and the variant lines (fun, short, kid-friendly).
- Popup styling (it should match Ship Builder's existing cards and dialogs).
