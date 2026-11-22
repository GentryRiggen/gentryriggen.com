# Shipwreck scene

Each ship's last hours in three.js: the Titanic's night of 14–15 April 1912
(a moonless sky, a glassy sea), the Lusitania's afternoon of 7 May 1915
(sun, haze, the Cork coast, 93 m of green water) and the Edmund
Fitzgerald's November storm on Lake Superior, 10 November 1975 (grey 3:30
PM light to black night, the sim's own storm waves, snow, spray, 162 m of
cold fresh water: "The Fitzgerald's storm" below), the ship posed from the
sim's track every frame, the effects, the cameras, the X-ray cutaway and
the place pins. `settings.ts` picks the scene per ship. Everything moves
from one **playback store** (`lib/shipwreck/playback.ts`); the DOM UI
(Task 5) reads and drives the same store.

## Files

| File              | What                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.ts`     | `SCENE_SETTINGS` per ship (time of day, sun, fog, under-water colour, coast, iceberg; the Titanic's are 1.0's constants), `sunPosition` (NOAA), `sunDirection`, `LUSITANIA_HIT` (place, time, heading).                                                                                                                                                               |
| `Coast.tsx`       | The south Cork coast from Galley Head to Ballycotton from real coordinates, the Old Head and its lighthouse (heights ×2.5). One draw.                                                                                                                                                                                                                                 |
| `Torpedo.tsx`     | The torpedo's bubble track (square to her course, from 700 m out, bubbles 1.6 s behind the torpedo, fading over 150 s). One draw.                                                                                                                                                                                                                                     |
| `NightScene.tsx`  | The `<Canvas>`: renderer, quality tiers (PerformanceMonitor), bloom + ACES tone mapping, the frame driver, `RenderInfoProbe`.                                                                                                                                                                                                                                         |
| `ShipRig.tsx`     | Samples the track at `t`, poses the model; builds the whole ship and the two halves up front, warms the halves, swaps them at the break.                                                                                                                                                                                                                              |
| `Sky.tsx`         | Star dome (6,000 stars, twinkle, Milky Way, horizon glow); `DaySky`: blue to haze, the sun's glow and disc. Follows the camera.                                                                                                                                                                                                                                       |
| `Sea.tsx`         | One quad: procedural ripples, Fresnel, planar reflection at the high tier (mirrored camera, half-res target, mip blur), seen from below. By day (`DAY` define): sun glitter, lit water, Snell's window, her wake (centre and Kelvin arms, from `runtime.wake`).                                                                                                       |
| `Environment.tsx` | Night: starlight, night fog, under-water fog by depth, the mud floor, the lamp. Afternoon: the sun (directional) and sky light, haze, green water dimming with depth, light shafts, sand and shingle with caustics.                                                                                                                                                   |
| `Effects.tsx`     | Lifeboats (swing out, lower, row away, lanterns), steam/smoke, rockets, funnels falling, break sparks, white water. One `Points` draw. By day a second, blended `Points`: smoke from four funnels (thinning with her steam), steam, the hit's water column and the second explosion; boats hang plumb from their falls (starboard far out, port in against her side). |
| `XRay.tsx`        | Ghost hull, compartment water cut at the sim's level, bulkheads, red openings, place blockouts and the pins.                                                                                                                                                                                                                                                          |
| `PlacePins.tsx`   | The place pins: DOM buttons over the canvas, shown in X-ray or at a place (XRay moves them each frame and writes the live water depth).                                                                                                                                                                                                                               |
| `Iceberg.tsx`     | The procedural iceberg, off the starboard bow at the collision, drifting astern.                                                                                                                                                                                                                                                                                      |
| `xrayGeometry.ts` | The water lofts, bulkhead lines, opening quads and the four places' blockouts.                                                                                                                                                                                                                                                                                        |
| `CameraRig.tsx`   | The free camera (OrbitControls, double-tap fly-to, rides with the ship, bounds) and the presets/cinematic shots.                                                                                                                                                                                                                                                      |
| `cameraMath.ts`   | Pure camera maths: `shipToThree`, `dampSpring`, `pushOutOfHull`, `clampAboveFloor`, `nearFor`, `cinematicShot`, `shotView`, preset views.                                                                                                                                                                                                                             |
| `WalkRunner.tsx`  | Walking (camera `walk`): places the walker on `walk.seq` changes, steps them on her deck or the swimmer in the sea (real time), WASD/arrow keys into `walkInput`, writes `runtime.walker`.                                                                                                                                                                            |
| `walkCamera.ts`   | Pure: the walker's eyes (`deckEyes`, `waterEyes`, `bob`), `followShipPitch`, and Look under's numbers (fog, hull light floor, the ambient lift).                                                                                                                                                                                                                      |
| `runtime.ts`      | The per-frame values the scene's parts share (sampled frame, visible parts, flash).                                                                                                                                                                                                                                                                                   |
| `sceneHooks.ts`   | The `window.__shipwreck` test hooks for a store.                                                                                                                                                                                                                                                                                                                      |
| `SceneCheck.tsx`  | `/shipwreck?scene` (dev and e2e builds only): the real night with no UI. `&quality=high\|medium\|low` pins a tier; `&ship=lusitania\|fitzgerald` picks her.                                                                                                                                                                                                           |

The Fitzgerald's storm adds (see its section):

| File              | What                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storm.ts`        | Pure data: her 3:30 PM place (the scene's origin), `stormSun` / `stormDaylight`, `snowAt` (the squalls), `geoToScene`, Whitefish Point, the Anderson astern, `STORM_PARTICLES`. |
| `seaWaves.ts`     | The sea shader's waves: `seaFieldOf(track)` (`waveField` of the track's storm), `packSeaWaves` (phases about the mesh's centre, float64), `SEA_WAVES_GLSL` and its TS mirror.   |
| `StormSea.tsx`    | The storm's sea: a disc of rings round the camera displaced by `seaWave`, foam, her lamps on the water, no mirror. One draw.                                                    |
| `stormRide.ts`    | `ridePose`: the sim's `waveRide` × `rideWeight` on her whole hull's pose (the plan's `stormMotion`).                                                                            |
| `stormEffects.ts` | Snow, spray where the sea meets her deck edge, her funnel's torn smoke (tiered), into the blended points.                                                                       |
| `GreenWater.tsx`  | The sim's green water on her deck (`SimFrame.deckWater`) at the sim's level. One draw.                                                                                          |
| `Wreckage.tsx`    | The broken middle and spilled taconite between her parts on the floor. Two draws.                                                                                               |

Frame loop order (R3F priorities): driver −3 (pump the runner, advance `t`),
ship rig −2, effects and the walk runner −1.5, camera −1, X-ray −0.9,
environment −0.8, sky −0.7, sea reflection −0.5, then the composer renders
(1).

## Using it (Task 5)

```tsx
import { playback } from "@/lib/shipwreck/playback";
import NightScene from "@/components/shipwreck/scene/NightScene";

playback.getState().start(titanic, titanic.realNight); // or What-if openings
playback.getState().play();
<NightScene store={playback} />; // DOM UI on top, subscribing with useStore
```

`NightScene` pumps the runner (6 ms a frame) and advances time itself; the
UI only calls actions. Read state in React with
`useStore(playback, (s) => s.t)` (zustand), never per frame in a loop.

## The playback store

State (`PlaybackState`):

| Field                           | Meaning                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ship`                          | The ship on the stage (`ShipId`). `start` sets it; `setShip` changes it and drops the run. The scene builds this ship (the rig is keyed by ship: the old model is disposed).                                                          |
| `track`                         | The `SimTrack` so far (null before `start`). A new object each pump.                                                                                                                                                                  |
| `openings`                      | The holes this run started with.                                                                                                                                                                                                      |
| `preview`                       | The title's stage (`start(..., { preview: true })`): the storm's sea and her ride run on the wall clock while paused.                                                                                                                 |
| `computedT`, `done`, `progress` | How far the runner has got (`computedT` = last frame's shown time). Show computed vs not on the timeline.                                                                                                                             |
| `t`                             | Shown seconds after the collision (11:40 PM). The clock is `(CLOCK_START_S + t) mod 86400`.                                                                                                                                           |
| `realT`                         | Real seconds after the collision at `t` (from the sim's frames). Differs from `t` during the way down (×6): show the real clock from it.                                                                                              |
| `playing`, `speed`              | Play state and the chosen speed (1, 10, 30, 100). Playback stops at the end of a finished track.                                                                                                                                      |
| `slowMo`                        | True while the cinematic camera holds a slower speed (`slowMoSpeed`: ×1 around the break and the plunge; a storm ship also from her big seas through bow-under, and ×½ as her parts fall; `speed` keeps the choice).                  |
| `camera`                        | `CameraId`: `orbit` (free), `bridge`, `stern`, `lifeboat`, `underwater`, `cinematic`. Starts `orbit`.                                                                                                                                 |
| `quality`                       | `high` / `medium` / `low`. Starts `medium`; the PerformanceMonitor steps it (reflection only at high; never up on touch devices). The ship models are always built at `MODEL_QUALITY` (`ShipRig.tsx`), so a step never rebuilds them. |
| `xray`                          | The cutaway on/off.                                                                                                                                                                                                                   |
| `place`, `placeWaterM`          | The selected place and the water over its floor (m, live, ±5 cm; `waterHereText(m)` words it).                                                                                                                                        |
| `snapId`, `flyId`, `flyView`    | Internal: bumps the camera rig reads.                                                                                                                                                                                                 |
| `speedTouchedAt`                | When the player last chose a speed (wall seconds).                                                                                                                                                                                    |

Actions: `start(spec, openings, { portholesOpen? })`, `setShip(id)`,
`pump(budgetMs?)`, `tick(dt, nowS)`,
`play()`, `pause()`, `setSpeed(speed)`, `seek(t)` (clamped to computed,
camera snaps), `setCamera(id)`, `takeControl()` (free camera from the
current view, no jump), `setQuality(tier)`, `setXray(on)`,
`flyToPlace(placeId | null)` (free camera, X-ray on for interior places),
`flyToView({ target, cam, snap? })` (ship-frame points, e.g. "Look at the
wreck"), `reset()`.

Helpers: `phaseAt(track, t)` (`settling`, `lifeboats`, `final-plunge`,
`breakup`, `descent`, `wreck`, `afloat`), `eventsSeen(track, t)`,
`realTimeAt(track, t)`, `effectiveSpeed`, `inSlowMoWindow`.

Lists for buttons: `CAMERA_IDS` (`lib/shipwreck/types.ts`),
`PLACES_BY_SHIP[ship]` and `placeFor(ship, id)` (label, fact, position;
`lib/shipwreck/places.ts`; both ships have a `bridge`, so look places up
with the ship), `SPEEDS`.

Every time the scene shows or computes comes from the track: events carry
`t` and `realT`, `brokeAtT` / `sankAtT` are the sim's, never a fixed clock.

## Test hooks (`window.__shipwreck`, dev and e2e only)

`seek(t)`, `play()`, `pause()`, `setSpeed(s)`, `setCamera(id)`,
`setXray(on)`, `flyToPlace(id | null)`, `flyToView(target, cam, snap?)`,
`setQuality(tier)`, `getEvents()`, `getState()` (`t`, `realT`, `phase`,
`eventsSeen`, `quality`, `camera`, `xray`, `place`, `playing`, `speed`,
`slowMo`, `done`, `computedT`, `progress`), `getRenderInfo()` (last frame's
draw calls and triangles over every pass, and the camera position).
`window.__shipwreckRenderInfo` has the same plus the tier and DPR. Walking:
`startWalk()`, `setWalkInput(forward, strafe)`, `turnWalk(yawRad)`,
`setLookUnder(on)`, `getWalk()` (phase, part, x, y, slope, depth, look under;
read from the runtime's `walkInfo`). `pump(ms)` computes ahead (e2e). Installed
with `installTestHooks(getScreen, undefined, sceneHooks(playback, runtime))`.

## Cameras

Presets stand further back on portrait screens (`portraitPullBack`), so a
shot framed for landscape still fits the ship.

- **orbit** (free): one finger orbits, pinch / wheel zooms 3 m–3 km, two
  fingers or right/shift drag pan, double-tap the ship to fly 26 m from that
  spot. Damped. Rides with the part it looks at (the target is kept in that
  part's frame, handed to the right half at the break), never under the
  floor, pushed out of the hull boxes unless X-ray is on. Touching the scene
  on any other camera switches to orbit from the current view.
- **lifeboat**: 2 m above the water about 420 m off the port quarter,
  drifting; looks a little above the ship so rocket bursts are in frame.
- **underwater**: follows the bow down, then circles the wreck.
- **bridge** / **stern**: on the starboard bridge wing looking aft; on the
  poop looking forward (both ride with their part).
- **cinematic**: shots keyed to the track's events (`cinematicShot`):
  establishing, along the hull, the lifeboat view from the first rocket,
  wide starboard after the last boat, the break, the plunge from the boats,
  follow the bow, the wreck. Critically damped between shots.
  The Lusitania's (`cinematicShot(track, t, "lusitania", hit)`): `afternoon`
  (no hole: the title), `hit` (0–40 s, low off the starboard bow), `list`,
  `boats` / `port-boats`, `bow-down`, `grounded` then `grounded-below` (bow
  on the floor, stern up), `on-floor`. Her shots stand at `levelToThree`
  points (her heading, not her list), so a list never tips them under.
  The cinematic camera plays her hit at ×1 for its first 20 s
  (`inHitWindow`). Her boat camera is off the starboard quarter (her boats
  got away from that side); bridge and stern views are hers.
- **walk** (first person, the Titanic and the Lusitania): the eyes 1.6 m
  over her deck (straight up from the feet, so a list never tilts the
  view; yaw and pitch are the player's look only, no roll, no head bob),
  or 0.3 m over the sea on a 0.25 m, 7 s swell when floating (the sea quad
  is flat: the swell is the camera's own), or 1 m under to **Look under**.
  `WalkRunner` writes `runtime.walker`; the rig stands the camera there,
  turns OrbitControls off, skips the bounds and the anchor, uses
  `nearFor(0.5)`, and ignores double-tap fly-to. Look under clears the
  water (night fog 0.0018; by day 0.35 of its own), keeps her hull lights
  at ≥ 0.5 power (`LOOK_UNDER_MIN_POWER`) and tilts down to keep her nearest piece in frame while
  she is within 600 m; paddling comes back up. On deck the ambient light
  is lifted ×1.25. The rules are `lib/shipwreck/walk/` (see its README).
  Keys: WASD or the arrows (the HUD's ←/→ seek is off while walking).
- **Bounds per ship**: `hullBoxesFor(ship)`; `keepClear` pushes the free
  camera out of the boxes through a face that leaves it above the floor (a
  wreck on her side has a face on the floor).

## The Fitzgerald's storm

- **One sea.** The sea drawn is the sim's: `seaFieldOf(track)` is
  `waveField(track.storm, track.stormScale)` (the field as the run used
  it, its three sisters re-locked on her real path; rebuilt when the
  storm object changes), drawn as `boardingElevation` (the second-order
  crests her deck openings see). `waveShader.test.ts` checks the shader's
  surface (its TS mirror, in float32) against the sim's at 20 points,
  also 76–101 km out, and its slope.
- **Precision (trap 1).** She is 76 km from the origin by evening: each
  frame the CPU works out every component's phase (and the groups'
  envelope) at the mesh's centre in float64 and the shader adds only the
  vertex's offset. The chop's noise runs about an anchor near the camera.
- **Time (trap 2).** The sea's time is the frame's real time (hers plays
  at ×1 to the floor); on the title's stage (`playback.preview`, set by
  the title and the editor) the sea and her ride run on the wall clock
  so the stage is alive while the playback waits (no green water there).
  The shaders get it continuous (no wrap, no jump). Their noise drifts
  with it to about 12,000 lattice cells by 7 PM, past where a float32
  hash of the cell keeps its fraction, so each storm shader's hash takes
  the cell mod 289 first (exact for whole floats; the pattern repeats
  every 289 cells, about 1.4 km for the chop).
- **Speed (fix round 1).** Her run starts at ×10 at most (`startSpeed`;
  at ×30 her sea is a time-lapse). On the cinematic camera
  (`slowMoSpeed`) the big seas play at ×1 from 30 s before the three
  sisters through her bow going under, joined to the break's window, and
  her fall to the floor at ×½ (from 3 s before the bow strikes to 3 s
  after the stern lands: the stern's roll lasts about 3 s). The liners'
  windows are unchanged.
- **Her ride** (`stormRide.ts`): exactly the sim's `waveRide` ×
  `rideWeight` (faded from the `bow-under` event's real time), added to
  her whole hull's pose in the ship rig; `runtime.frame` carries the
  ridden pose, so the camera, X-ray and effects see it. No extra heave:
  the green water on screen is the sim's. Her list (the sim's roll)
  shows all afternoon.
- **The mesh**: rings round the camera, 256 × 1.5 m (high), 160 × 2.5 m
  (medium), 112 × 3.5 m (low) finest, geometric outward to 6 km, a flat
  skirt to 30 km; a component too short for the local spacing fades out.
  About 122k triangles high, 50k medium, 25k low. No reflection pass
  (trap 3).
- **The camera (trap 4)**: every camera stays 1.5 m clear of the local
  wave surface on its side of it (`aboveWaves`; `runtime.sea.atCamera`,
  `runtime.underwater` against it), and above the 162 m floor. Her hull
  boxes come from her data (`FITZGERALD_HULL_BOXES`: after house, open
  deck, forecastle). Her cinematic shots: `storm` (high on the starboard
  quarter), `storm-beam` and `deck` (over her after house looking
  forward), 15 minutes each in turn; `sisters` from 7 PM; `going`,
  `dive`, `strike` (low on the clay ahead of her bow, the hull rising
  behind), `stern-roll` (off the stern quarter, a little below), `parts`
  (both parts and the gap), the under-water ones 60–90 m off; `astern`
  (from the pilothouse aft at the Anderson's lights) in the dark between
  squalls (5:50–6:05, 6:34–6:40). The `storm` shot stands 26–43° off
  dead astern at 65 m (nearer astern her square house and long side read
  as a kink). Portrait: her wide shots stand back until 1.15 × her length
  fits across (`fitAcross`, at most 2.8×); under water the pull-back is
  at most 1.2 (both her and the Lusitania). Bridge: her pilothouse's
  wing; stern: her after house by the funnel; boat: off her starboard
  quarter, 17 m up. `WRECK_VIEW.fitzgerald` looks at her bow toward the
  gap.
- **Light**: `stormDaylight(t)` from the sun's height at her place (NOAA,
  `sunPosition`): grey at 3:30 PM (sun 13° up behind the cloud), sunset
  about 5:10, black by about 5:45. No sun disc or shadows; an overcast
  hemisphere light, her two deck floodlights (the night's lamps, 260),
  her windows at full power, and six more deck lights along her hatches
  (`deckLightsOf`: an assumption, a laker's deck lights stood on the
  hatch crane's rails and the deck-edge posts) that only the sea, spray,
  snow and green water read (`runtime.lamps`, up to 8; no three.js
  lights). At night white things (foam, spray, snow, the green water's
  churn) keep `STORM_NIGHT_WHITE` (0.18) of their day light: her lights
  scattered by the snow and cloud (a look, not physics, as the 1.0
  night's starlight). The sea foams where it meets her hull and where it
  stands over her deck. Under water: cold fresh water, clear below the
  storm's murk (about twice the 1.0 night's water light), a light grey
  clay floor that follows the camera (she ends 76 km out), the lamp.
- **Far lights** (`StormSky`): the Anderson's masthead, range and side
  lights about 17 miles astern at 3:35 closing to 10 by 7 PM, 1.5° off
  her centre line to starboard (an assumption: dead astern her mast and
  funnel hide them), 6 px with a halo, seen only in the dark when the
  snow is thin (`snowAt`); Whitefish Point's light
  ahead is out in her real run (reported out that evening) and lit, a
  flash every 20 s, only in a calmer What-if storm (the builder's call).
- **Snow squalls** (`SQUALLS`): thin snow all afternoon, squalls about
  4:10, 5:15, 6:10 and 6:45–7:16 PM (an assumption but for the last,
  which the Anderson reported), clearing about 7:20; the fog thickens
  from about 6 km to under 2 km in a squall.
- **Particles** (`STORM_PARTICLES`, tiered; iPads start at medium):
  snow 2000 / 1100 / 600 (×0.25–1 by `snowAt`; within 30 m each flake
  streaks along the wind), far snow 700 / 380 / 200 (a squall's curtain,
  large and faint, only in the snow), spray 900 / 500 / 280, smoke
  220 / 120 / 70, clay plume 360 / 200 / 110, pool 5000 / 2800 / 1500
  (the liners keep their own pool), max size 120 / 80 / 56 px. A storm
  particle under 2 px on screen fades out instead of becoming a 1.5 px
  pinpoint (`STORM_MIN_PX`; the afternoon's are unchanged). Spray rises
  where the sea (`runtime.seaY`, the sim's) comes within 1.6 m of her
  deck edge, at 28 points along her sides and her stem. Soft particles
  fade out near the lens. The green water's foam lingers about a second
  of wall time after the sim's runs off (a look).
- **The floor**: once her bow strikes, the broken middle (140 plates,
  frames and hatch covers, one instanced draw) and a spill of taconite
  between her parts' torn ends; a plume of grey clay where each part
  lands (`bow-lands`, `stern-lands`; 45 s, by shown time).
- **Quality.** The frame-rate monitor's step down is ignored while the
  run is still computing in the browser (`stepQuality`: her run takes
  about three times the Titanic's), so the start never locks a touch
  device at a lower tier.
- **No per-frame allocation**: the ship rig samples the track with
  `sampleTrackInto` (one frame, its arrays reused, `deckWater` too);
  `stormSun` keeps its last answer; `sunDirectionInto`; the wind is
  worked out again only for a new field.
- **Ruling R16**: no "New ending found!" on her real run
  (`showsNewEnding`, story.ts); her What-ifs keep it.

## Performance (see the task 4 report for numbers)

- The planar reflection is a second scene render at 1024² (high only).
- Bloom at half (high) or 0.35 (lower) resolution; MSAA 4× at every tier (changing it rebuilds the composer).
- The models are built once at `MODEL_QUALITY` (high detail: rigging and rails), never per tier.
- Double-tap fly-to raycasts the hull boxes (`HULL_BOXES`) in each part's frame, not the meshes.
- A place pin's camera is lifted to stay 2.5 m above the sea, so it never sits inside the flooded water.
- Hidden models (whole after the break, halves before it) cost no draws.
- X-ray adds about 5–10 draws (water, lines, gashes, blockouts).
- DPR: high 2, medium 1.5, low 1 (capped by the device).
- The Fitzgerald (task 6 report): 36–42 draws, about 190k triangles at
  the top tier; 36–42 draws, about 120k at medium.
- The afternoon adds about 3–5 draws (day sky instead of stars, coast,
  torpedo track, day particles; shafts and floor only under water). No
  shadow maps (they would pass the ship again). Bloom threshold 1.6 by day
  so sunlit paint does not glow. Her lights and lamps run at 2.5 %.
