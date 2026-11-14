# Ship Builder: Boom! (bombs free-for-all) and a tidier trial menu

## Why

Kids want to wreck the ship straight away. Finding a sea mine in Drive takes
too long, and the setup cards ask questions before anything happens. They want
explosions, pieces flying, a long slow sinking to watch, and people to save.

## What

- **Boom! menu** (replaces "Sea trial"): Bombs, Iceberg, Shipwreck storm.
  Waves leaves the menu; it lives on as the Shipshape challenge.
- **Bombs**: no card. A pill says "Tap the ship to drop a bomb"; time of day,
  lifeboats and how she breaks sit behind a gear. The first tap starts the
  trial; every later tap (while running, or on the result) adds a bomb at the
  current playback time and the same run plays on from there.
- Each bomb falls for 0.6 s, goes off with a fireball, smoke, a water column
  (near the waterline), a bang, a jolt, and blows up to 10 parts off near the
  spot (top-down, so nothing floats; repeat bombs dig deeper).
- Each bomb opens its own 4-cell hole. Inflow is slow (one bomb on an unwalled
  hull: about 30 s of real time to go under), more bombs sink her faster, and
  a walled ship can ride some out. Playback dips to 0.35x at every bang.
- The end card says how long she lasted after the first bomb and how many
  bombs it took, with Watch again (replays every bomb), Bomb a fresh ship, and
  taps on the wreck keep working.

## Approach (decided)

A new `boom` trial kind on the existing timeline machinery, rather than a
separate free-form physics mode. Bombs are inputs with times (`BoomInput.bombs`),
so the timeline stays deterministic: adding a bomb at time t rebuilds a
timeline that is identical before t, the runner resumes at t (`resumeAt`), and
"Watch again" and the scrubber come for free. Parts thrown and the blast point
are stored on each bomb (scene-only fields) so replay matches.

Rejected: a live, non-recorded sim for Boom! (loses replay and scrubbing);
bombs inside the iceberg/storm trials (more tuning for no extra fun now).

## Builder's calls

- Max 40 bombs per trial, 160 thrown parts in all; at most 6 blasts drawn at
  once and one shared blast light (adding lights recompiles every material).
- A Boom! ship that settles afloat ends 40 s after the last bomb.
- Analytics: `trial_run.kind` gains `boom` (schema, rules, admin all generic).
