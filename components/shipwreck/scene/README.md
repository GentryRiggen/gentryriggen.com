# Shipwreck scene

Each ship's last hours in three.js: the Titanic's night of 14–15 April 1912
(a moonless sky, a glassy sea), the Lusitania's afternoon of 7 May 1915
(sun, haze, the Cork coast, 93 m of green water), the Carpathia's morning
of 17 July 1918 (the open Atlantic, the sun in the east, 150 m of blue
water: "The Carpathia's morning" below) and the Edmund
Fitzgerald's November storm on Lake Superior, 10 November 1975 (grey 3:30
PM light to black night, the sim's own storm waves, snow, spray, 162 m of
cold fresh water: "The Fitzgerald's storm" below), the ship posed from the
sim's track every frame, the effects, the cameras, the X-ray cutaway and
the place pins. `settings.ts` picks the scene per ship. Everything moves
from one **playback store** (`lib/shipwreck/playback.ts`); the DOM UI
(Task 5) reads and drives the same store.

## Files

| File              | What                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.ts`     | `SCENE_SETTINGS` per ship (time of day, sun, fog, under-water colour, coast, iceberg, a daylight ship's own colours `daylight`; the Titanic's are 1.0's constants), `LUSITANIA_DAYLIGHT`, `sunPosition` (NOAA), `sunDirection`, `LUSITANIA_HIT` and `CARPATHIA_HIT` (place, time, heading).                                                                                                                      |
| `Coast.tsx`       | The south Cork coast from Galley Head to Ballycotton from real coordinates, the Old Head and its lighthouse (heights ×2.5). One draw.                                                                                                                                                                                                                                                                            |
| `Torpedo.tsx`     | Each torpedo's bubble track (square to her course on the side it struck, from 700 m out, bubbles 1.6 s behind the torpedo, shown from `RUN_IN_S` before its own hit, fading over 150 s). One draw a track.                                                                                                                                                                                                       |
| `NightScene.tsx`  | The `<Canvas>`: renderer, quality tiers (PerformanceMonitor), bloom + ACES tone mapping, the frame driver, `RenderInfoProbe`.                                                                                                                                                                                                                                                                                    |
| `ShipRig.tsx`     | Samples the track at `t`, poses the model; builds the whole ship and the two halves up front, warms the halves, swaps them at the break.                                                                                                                                                                                                                                                                         |
| `Sky.tsx`         | Star dome (6,000 stars, twinkle, Milky Way, horizon glow); `DaySky`: blue to haze, the sun's glow and disc. Follows the camera.                                                                                                                                                                                                                                                                                  |
| `Sea.tsx`         | One quad: procedural ripples, Fresnel, planar reflection at the high tier (mirrored camera, half-res target, mip blur), seen from below. By day (`DAY` define): sun glitter, lit water, Snell's window, her wake (centre and Kelvin arms, from `runtime.wake`).                                                                                                                                                  |
| `Environment.tsx` | Night: starlight, night fog, under-water fog by depth, the mud floor, the lamp. Afternoon: the sun (directional) and sky light, haze, green water dimming with depth, light shafts, sand and shingle with caustics.                                                                                                                                                                                              |
| `Effects.tsx`     | Lifeboats (swing out, lower, row away, lanterns), steam/smoke, rockets, funnels falling, break sparks, white water. One `Points` draw. By day a second, blended `Points`: smoke from four funnels (thinning with her steam), steam, the hit's water column and the second explosion, rockets' smoke (no stars or flash by day); boats hang plumb from their falls (starboard far out, port in against her side). |
| `XRay.tsx`        | Ghost hull, compartment water cut at the sim's level, bulkheads, red openings, place blockouts and the pins.                                                                                                                                                                                                                                                                                                     |
| `PlacePins.tsx`   | The place pins: DOM buttons over the canvas, shown in X-ray or at a place (XRay moves them each frame and writes the live water depth).                                                                                                                                                                                                                                                                          |
| `Iceberg.tsx`     | The procedural iceberg, off the starboard bow at the collision, drifting astern.                                                                                                                                                                                                                                                                                                                                 |
| `xrayGeometry.ts` | The water lofts, bulkhead lines, opening quads and the four places' blockouts.                                                                                                                                                                                                                                                                                                                                   |
| `CameraRig.tsx`   | The free camera (OrbitControls, double-tap fly-to, rides with the ship, bounds) and the presets/cinematic shots.                                                                                                                                                                                                                                                                                                 |
| `cameraMath.ts`   | Pure camera maths: `shipToThree`, `dampSpring`, `pushOutOfHull`, `clampAboveFloor`, `nearFor`, `cinematicShot`, `shotView`, preset views.                                                                                                                                                                                                                                                                        |
| `WalkRunner.tsx`  | Walking (camera `walk`): places the walker on `walk.seq` changes, steps them on her deck or the swimmer in the sea (real time), WASD/arrow keys into `walkInput`, writes `runtime.walker`.                                                                                                                                                                                                                       |
| `walkCamera.ts`   | Pure: the walker's eyes (`deckEyes`, `waterEyes`, `bob`), `followShipPitch`, and Look under's numbers (fog, hull light floor, the ambient lift).                                                                                                                                                                                                                                                                 |
| `runtime.ts`      | The per-frame values the scene's parts share (sampled frame, visible parts, flash).                                                                                                                                                                                                                                                                                                                              |
| `sceneHooks.ts`   | The `window.__shipwreck` test hooks for a store.                                                                                                                                                                                                                                                                                                                                                                 |
| `SceneCheck.tsx`  | `/shipwreck?scene` (dev and e2e builds only): the real night with no UI. `&quality=high\|medium\|low` pins a tier; `&ship=lusitania\|fitzgerald` picks her.                                                                                                                                                                                                                                                      |

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

The Britannic's morning adds (see "The Britannic's morning" below):

| File             | What                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `funnelWreck.ts` | Her fallen funnels: each sinks from where it toppled to its spot beside her wreck (funnel 1 by the boat deck, 2–4 off her stern) and lies there. |
| `Coast.tsx`      | Per ship: the Cork coast (the Lusitania) or the Kea Channel (Kea, Makronisos, Attica, Port St Nikolo light).                                     |

The Concordia's night adds (see "The Concordia's night" below):

| File        | What                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `giglio.ts` | Pure: Giglio's land (SRTM) and her floor (`floorAt`) as one grid, Le Scole and the struck rock, the island's lights, seagrass places, the strike's white water, her boats' way in. |
| `Coast.tsx` | A third coastline: `GiglioCoast` (the land in one draw, the lights in another).                                                                                                    |

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
wreck"), `setLivery(id | null)` (her paint, `livery` in the state; nothing
else changes; `ShipRig` repaints the built models live: model README,
"Liveries"; `setShip` puts it back to null, her default), `reset()`.

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
read from the runtime's `walkInfo`). `pump(ms)` computes ahead (e2e). The
game's own: `setLivery(id)` and `livery()` (her paint, as the paint button). Installed
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

## The Carpathia's morning (Task 6, the MVP cut)

The Lusitania's daylight pipeline (`timeOfDay: "afternoon"`, a 1.1 name
kept so the other ships' settings stay deep-equal) with her own place,
sun and colours. Added nothing beyond what she needs to read right.

- **Place and sun** (`CARPATHIA_HIT`, spec R6): her wreck's surveyed
  position, 49°30.03′ N 10°43.04′ W, at 9:15 AM BST = 08:15 GMT on 17
  July 1918: the sun 29.93° up at 91.60° (due east, low-ish). Read as GMT
  it would be 39.56° at 103.95°. Heading 270° (west for Boston; the great
  circle leaves at about 284°, the rhumb line at 260°; no source gives
  her course: ours), so her port side faces south and the sun is nearly
  astern. No coast, no iceberg.
- **Look** (`SceneSettings.daylight`, R7 visual only): a greyer haze
  (`#b3bcc4`, density 0.000055 against the Lusitania's 0.000027) and a
  paler, greyer sky overhead for the cloudy-bright morning; a deep blue
  sea, its ripple about twice the Lusitania's (0.75, a define in the sea
  shader: a moderate sea breaking up the reflections; the Lusitania's
  program is unchanged); broken cloud and small whitecaps (below). Under water:
  blue (`#1e5a82`) darkening to `#04121f` at her 150 m floor, exp² 0.0062
  to 0.0082 (clearer open-ocean water than the Celtic Sea's, so she is
  seen about 120 m off on the way down and on the floor), blue shafts,
  a grey-brown floor tint over the sand texture, the sun's ripples on it
  all but gone (0.035).
- **Light** (`daylight.sunColor`, `sunIntensity`, `skyColor`,
  `skyGround`, `skyIntensity`, named as the Britannic branch's `DayLook`;
  the Lusitania's are 1.1's 0xfff0d8 × 4 and 0xa9c8ee / 0x2f4a4c × 0.75):
  the low sun nearly astern left her port side in shade and the dazzle
  read near black, so her sky fill is stronger (× 1.5, a grey-blue sky
  over light off the sea, 0x7c8d9a) and her sun a little softer (× 3.6,
  broken cloud): the dazzle reads black, white and grey from port, the
  sunnier side not washed out.
- **Torpedoes** (`PlaybackState.torpedoes`, from `torpedoHits` in the
  game and in `?scene`): each track lands at its own time on the side it
  struck: hers from port (`trackSideY`: her half-breadth plus 0.05 m,
  9.9 m) at 0, 8 and 5700 s; each shows from `RUN_IN_S` (40.5 s) before
  its hit, so the 10:50 AM wake runs in then, not at 9:15. `preRollS:
40` on her spec (scene only) plays the first two running in; a run with
  no hit at the first moment (the U-boat alone) has no pre-roll. The hit
  columns (`columnOpenAt`, `columnSideY`: 10.1 m to port) rise at each
  hit's time. She has no second explosion (no `explosion` event), so no
  coal-dust cloud or steam; her one funnel's smoke thins as her steam
  fails (the existing headway rule, her 60 s half-life). The Lusitania's
  tracks and columns are 1.1's (13.4 / 13.6 m to starboard, `hitTimeS`).
- **×1 at each hit** (`PlaybackState.hitTimesS`, `inOwnHitWindow`): on
  the cinematic camera her hits play at ×1 from 20 s before to 20 s after
  each, the 10:50 AM one too. The Lusitania keeps `inHitWindow`.
- **Boats**: port boats 8 and 10 (`wreckedAtT` in `CARPATHIA_BOATS`,
  carried on `BoatRecipe.wreckedAtT`) are hidden from the engine-room hit
  at 8 s (`boatWreckedAt`: a torpedo at that time on that side within
  8 m); a What if that spares the engine room spares them.
- **Cameras** (`carpathiaShot`, `carpathiaView`): `run-in` high off her
  port side beside the track's far end, looking in at the hit (again for
  the 10:50 AM torpedo, `torpedoInView`), `hit` low off her port bow,
  `list`, `boats` (high off her port quarter) / `port-boats` (her
  starboard side's), `list` again once all are away, `bow-down`,
  `grounded` (her stern up, off the port quarter), `grounded-below`
  (under water off her port beam as she swings down, R22: from 3 s after
  stern-under to 8 s after `stern-lands`, 16 s after `bow-lands`),
  `on-floor` (circling the upright wreck off her port side). Bridge: her
  port wing; stern: over her stern deckhouse; boat: low off her port
  quarter. `CARPATHIA_HULL_BOXES` from her data. Every view stays above
  −150 + 2 m and outside her boxes (tested over her whole run).
- **The white water** where her stern goes under is 10 m in from her
  stern (`max(-100, sternX + 10)`; the other ships' stay at −100).
- **Rockets by day** (R13; GOL: fired to call the patrol vessels;
  `dayRocketParticles` in `afternoonEffects.ts`): in daylight a socket
  signal's stars barely show, so any daylit ship's rockets draw no stars
  and set no `runtime.flash` (`rocketFlash(age, true)` is 0). From her
  starboard bridge wing (her `bridge` place, half her beam out; where she
  was at launch, kept per run): a thin white-grey smoke trail up 200 m
  in 4 s (laid evenly in height, each bit widening and drifting from when
  it was laid, gone 16 s later), a pop at the top (six additive points
  for 0.25 s, drawn into the night buffer from `AfternoonEffects.pops`),
  then a grey-white puff (shaded underneath) that spreads, drifts the
  way her smoke does when she lies stopped (1.5 m/s astern, 0.25 m/s
  across) and fades over 20 s. Particles per tier like `DAY_PARTICLES`
  (110 trail and 150 puff at high, × the tier's share), in the two
  existing point buffers: no new draws. The Titanic's night rockets and
  the rocket sound are unchanged.
- **Her convoy** (R12; `convoyMotion.ts`, pure, and `Convoy.tsx`): the
  escort left early on 17 July and the convoy split; she was commodore
  ship of the remaining seven (thegreatoceanliners.com, Wikipedia), so
  six other steamers. After the first torpedo "the convoy scattered at
  full speed" (GOL). No source gives their names, stations, paint,
  speeds or courses: all ours. Three columns 3 km apart, she at the head
  of the centre one, ships 2–2.6 km apart in a column (an open order,
  wider than a close convoy's 3–5 cables: the escort had gone), 2.2–4.4
  km from her; at her 10 knots (R9) until the first hit's time (the
  run's first torpedo, `scatterAtOf`; a What-if starts them later), then
  each, 40–110 s after it, turns at 1°/s (a steamer with the helm hard
  over) 35–115° away from her and works up (0.012 m/s²) to its full
  speed of 11.5–13 knots, the two astern of her sheering off to
  starboard past her stopped hull. Everything is a function of the shown
  `t` (seeking is right; tested: continuous, never within 1.2 km of her
  or 800 m of each other). By 10:00 AM all are more than 12 km off; they
  fade into her haze from 22 km (at 28 km it leaves under a tenth of
  their contrast) and are not drawn past 28 km, all of them by about
  10:30, well before the third torpedo. They sit lower with the earth's
  curve beyond the camera's horizon (`hullDownM`, 7/6 of the earth's
  radius for refraction). One low-detail steamer shape (about 350
  triangles: hull with raised forecastle and poop, midships house and
  bridge, one raked funnel, two masts thickened to hold a pixel)
  instanced six times, scaled to 110–135 m; paint per ship in the shader:
  plain battle grey, a darker grey, or one of two dazzle patterns (bold
  black, white, blue-grey and grey bands whose angle flips along her and
  differs side to side), British merchant style of 1918. Their smoke: one
  camera-facing ribbon each (75 s of drift on the wind less their way,
  rising 34 m and widening to 45 m, heavier at full speed). Two draws
  (hulls, smoke), four with the high tier's reflection; none at the low
  tier or under water.
- **Broken cloud and whitecaps** (R7, from the sinking photograph:
  `DaylightLook.clouds` 0.5, `whitecaps` 0.03; shader defines, so the
  other ships' sky and sea programs are unchanged; no new draws). The sky:
  value-noise cumulus on a layer, half the sky covered, grey underneath,
  lit at the edges toward the sun, thinning into the haze at the horizon;
  cloud over the sun hides its disc. The sea: small whitecaps in 14 m
  cells breaking in groups (where a 140 m noise is high), each a ragged
  crest across the wind that flares in a second, spreads downwind and
  fades over a few (a 7–12 s cycle per cell); past 700 m only their
  average whitening is left, so they never flicker as pixels.
- **A faint sea mirror** (`DaylightLook.mirror` 0.2, the `DAY_MIRROR`
  define; Task B4): at the high tier the planar reflection is blended at
  a fifth over the sea's own sky gradient, so her moderate, wind-broken
  sea no longer mirrors the clouds and her hull like a calm one (the
  sinking photograph's sea is grey and broken, with no reflections; the
  other ships keep the full mirror, and no draws change).
- **Not in this cut** (follow-ups): steam from her waste pipe.

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

## The Britannic's morning (1.4)

- **Settings** (`SCENE_SETTINGS.britannic`): `timeOfDay: "morning"`, drawn
  as the afternoon is (`isDaylit`) with its own look (`DAY_LOOKS.morning`:
  a warm low sun, the Aegean's deep blue, clear blue water, a pale sand
  and mud floor; the afternoon's look is 1.1's constants exactly). The
  scene's origin is her place at the mine (`BRITANNIC_MINE`, 37.6886 N
  24.2388 E), worked back from her wreck (37°42′05″ N 24°17′02″ E [WP])
  along the sim's real run (4.2 km, most of it east-north-east after her
  turn): about 3.8 nmi N 70° W of Port St Nikolo light (sim README: [FI]
  3 miles N 48° W, Divernet 4 nmi). Her heading there (the scene's +x) is
  N 18° E (`BRITANNIC_HEADING_DEG`), her course up the channel.
- **The sun**: NOAA's algorithm (`sunPosition`, from Meeus) at 08:12 EET
  (06:12 UTC, the sources' clock) on 21 November 1916 at the mine:
  **9.97° up, azimuth 124.87°** (south-east by east). After her turn
  (heading about 88°) it is on her starboard bow, behind Kea.
- **The coast** (`Coast.tsx`, one draw): Kea and Makronisos from
  OpenStreetMap's outlines (simplified to about 300 m), Kea rising to
  Profitis Ilias (568 m), Makronisos to about 280 m; Attica from west of
  Cape Sounion to Porto Rafti from the chart (about 300 m). Heights true
  (`KEA_HEIGHT_SCALE` 1; it was ×1.5 to read at 6–12 km, but at true
  height Kea still stands clear on the horizon in the turn and in the boats
  shots), and a share of the hills' own colour as light (`vColor × 0.3`) so their shaded side,
  between her and the low sun, reads brown-green. Port St Nikolo light as
  a small white tower. No temple, no people. Kea lies ahead to starboard
  once she has turned, Attica and Makronisos low and hazy to port.
- **The mine** (`afternoonEffects.ts`): a white column at her starboard
  side by the hole (`realNight[0].x`, 84.3 m: hold 3 against the hold 2/3
  bulkhead, under the forward well deck), at the waterline, at the sim's
  `explosion` (`hitColumnTimes`; a What-if's other mines 3 s apart), no
  track (`hasTorpedoTrack`), no second explosion (`hasSecondExplosion`).
  The column rides with her while it stands (a look: at 20 knots the real
  spray fell astern of the hole) so it reads where the mine struck. The
  playback keeps a mine ship's hits (the HUD's "the mines").
- **Smoke** from her three working funnels (the fourth a dummy) thins
  with her speed: 0.25 + 0.75 × her track's speed over 20 knots (the sim's
  `speedAt` profile as run, so a What-if with her engines stopped thins
  too).
- **The turn and her wake**: the rig poses her yaw from the track; her
  wake follows her stern's path (`runtime.wake.path`, 8 points 20 s apart,
  a polyline the morning's sea shader measures; `WAKE_PATH` define, the
  morning only). Its "stern up" test uses her waterline aft (the liners'
  keel test hides their wake once hit: a follow-up, left as it is).
- **Boats** (R15): stowed in their chocks or gantries until their
  `boat-lowered` event, swung out (15 s; an inboard Welin boat on its
  outboard partner's davits), lowered (60 s), then pulled out from her
  side and a little ahead of the beam (`mineBoatAt`), never aft toward her
  screws, coming to rest 60–170 m off her side, a set's boats fanned
  further ahead and further out so none share a spot. Fun over realism:
  they keep station off her while she has way (`mineBoatHoldUntil`: her
  stop at 8:50, or her bow on the floor if sooner), as if lying off her,
  though 2 knots is more than a boat could pull; otherwise her way left
  the first boats 300–750 m astern and out past the boats camera (165 m
  off her side) by 8:45, and only two or three showed. From her stop they
  lie where they are and she leaves them astern when she goes ahead
  again, 40 m or more out from her side by the time her stern passes
  (`afternoonEffects.test.ts`, which also checks every boat down by 8:45
  is afloat, apart and near her).
- **The bent bow** (R12) bends about the line through the hinge that is
  upright in the sea for her pose (`applyBowBendAbout`), so the bow lies
  on the floor where the sim puts it (within 0.5 m: `bowBend.test.ts`):
  on her side it is the stem bent up from her keel line.
- **Funnels on the floor** (`funnelWreck.ts`): after the sim's
  `funnel-falls` and the topple, each sinks (40 s) to its spot beside the
  wreck's last pose and lies there; the model's own funnel groups (no
  new draws).
- **The foremast on the floor** (`mastWreck.ts`) [WP]: once her bow lands
  (the strike that bends it), if she ends whole, sunk and on her side,
  the foremast (`handles.foremast`) comes down over 30 s to lie bent
  (about 30°, toward her bow) on the floor beside her forward end, its
  wires hidden. Where she floats, breaks or lands upright it stays on
  her. Its own mesh (one draw); bent in place on the CPU (a few hundred
  vertices, only while it moves).
- **Camera**: `BRITANNIC_HULL_BOXES` (the Titanic's on her 94 ft beam);
  her cinematic shots are the Lusitania's (hit, list, boats, port boats,
  bow down, grounded above and below, on the floor) with `turn` (40 s–5
  min, high off her port quarter, Kea ahead) and `morning` (the title).
  Floor 120 m; `keepClear` is tested with her wreck's pose (on her side,
  turned 70°). `WRECK_VIEW.britannic` looks along her from over her port
  side and off her deck side (funnel 1 on the floor there).
- **X-ray places**: the wheelhouse; hold 2's stores and the torn plating
  of the hole; boiler room 6's boilers inside the inner skin; the open
  E-deck portholes; the gantry's motor and drum; the low-pressure
  turbine and its condensers.
- **Perf**: three scenes (`shipwreck-britannic-blast`, `-boats`,
  `-grounded`) at the top tier, hospital paint (Task 6 report).

## The Concordia's night (1.9)

- **Settings** (`SCENE_SETTINGS.concordia`): the Titanic's night look
  (`timeOfDay: "night"`, the same starlight and fog) with the island
  (`coast: true`), her heading 350° (`CONCORDIA_NIGHT`: 42.36° N 10.92° E,
  21:45:07 CET = 20:45:07 UTC [MIT §3]), a thin broken cloud
  (`clouds` 0.3: "partly cloudy" [MIT §2.3]), a light north-east chop on
  the sea shader (`chop` 0.4, short waves running toward 225°: the wind
  E-NE 17 kn, "rough sea NE 4" [MIT §2.3]; a look only, the sim's water is
  still) and her own darker blue water under the surface. Every other
  ship's settings deep-equal what they were (`settings.test.ts` against a
  fixture written before her night was added).
- **The moon** (`moonPosition`): the Astronomical Almanac's low-precision
  lunar formulas (about 0.3°), topocentric, at the shown clock (the
  frame's real seconds after 21:45:07). At the strike it is 4.5° under
  the eastern horizon; it rises at about 22:05 at 91° (timeanddate.com:
  moonrise at Rome 21:59 CET at 91°, Giglio 1.58° further west, about
  6.5 minutes later); at her rest (00:41) it stands about 25° up at 119°,
  a waning gibbous about 76% lit (timeanddate: 83.9% on the 13th, 74.5% on
  the 14th). So her lit run and the strike are moonless; from 22:05 the
  moon (disc, glow, its path on the chop, a faint blue-white directional
  light) is in the east, over the sea, away from the island. The disc is
  drawn round (no phase shape: a gibbous reads round at its size).
- **The island** (`giglio.ts`, `Coast.tsx`, one draw): one grid over land
  and sea (10 m where she sails, drifts and lies; 60–300 m out to the
  edges). Offshore every vertex is her seabed's `floorAt` (the sim's own
  floor: `giglio.test.ts` checks every floor vertex to 0.2 m); inland of
  the same traced shoreline (`shoreDistance` < 0, [OSM]) the land climbs
  from the shore at the profile's own slope, then the granite coast's
  (never lower than that rise up to 70 m: SRTM's 200 m lattice carried
  its sea-level samples a cell inland and drew flat sheets there), into
  SRTM's heights 30–200 m in [SRTM: 1″ (30 m), sampled every
  0.002° over 42.335–42.395° N, 10.870–10.934° E through OpenTopoData's
  `srtm30m`], with ±6 m of hashed roughness (ours). So the drawn waterline
  is the sim's shore (within 5 m along the fine grid's edges: tested).
  South of where the traced shore begins (south of Giglio Porto) the land
  slopes into the sea by the grid's edge, about 2 km short of the real
  south cape (not drawn: never in her shots). Heights true: Poggio della
  Chiusa 485 m, Giglio Castello about 400 m on the ridge [OSM]. Colours:
  dark macchia over grey granite, bare granite at the shore [WC], with a
  little of their own colour as light (×0.06) so the hill reads against
  the stars.
- **Le Scole** (`rockArrays`): each islet of her seabed as a granite lump
  over its bump, standing out of the sea (`isletHeight`: 1.5 m + a quarter
  of its radius, at most 10 m; not surveyed in any source we have, so
  ours, to read from her decks at night). The rock she struck: the sim's
  islet is a round bump (57.5 m deep under her side at the strike), but
  the real rock reached her below the waterline [MIT §3, §4.7.2], so a
  ridge runs from Scola piccola to her port side at frame 124, its face
  0.3 m off her plating (`STRIKE_GAP_M`) from 1.5 m under the sea down to
  the floor: it meets her as she passes and never goes into her. A look,
  not physics (the sim's floor is unchanged). The rock left in her side
  is the model's (from 7 s, in a run that opens WTC 4).
- **Under water** (`Environment.tsx`): the grid's floor mesh (its own
  draw, only from under the sea) coloured by depth: granite above 6 m,
  Posidonia meadows broken by sand and boulders to about 35 m, sand and
  mud below [WPP, MIT; Posidonia oceanica grows to about 35–40 m in clear
  water, WP "Posidonia oceanica"; the meadows round her wreck, WPS
  "environmental concerns"]; the spurs (`SPURS`) as granite lumps; and
  about 2,600 seagrass clumps (five narrow blades, about a metre) as one
  instanced draw on the meadows round where she lies. The submersible
  lamp is full on from 4 m down and the ambient light under her is 0.6
  (the Titanic's 0.25) so the shallow shelf reads.
- **Reflections**: her night's sea takes four more taps of the planar
  reflection, stretched up and down the water (`SOFT_MIRROR`), so the
  harbour's small bright lights do not show the mips' squares.
- **The lights** (`giglioLights`, one draw of points): Giglio Porto's,
  Arenella's and Giglio Castello's houses [OSM building outlines' centres:
  a third of the Porto's, a quarter of the Castello's], one to three lit
  windows each (one, at under half the brightness, in Giglio Castello, whose
  close-packed houses 1.5 km off otherwise ran together into one glow),
  warm (a few cool); sodium lamps every 30 m along the harbour's
  quay; the two mole lights [OSM seamarks]: E 1488 on the Molo Rosso
  (the eastern breakwater), flashing red every 3 s (0.5 s on), 9 m, 7
  nmi, and E 1490 on the Molo Verde (the northern one), flashing green
  every 3 s, 9 m (Lighthouse Digest: a green conical tower). Their towers
  are small red and green columns in the land's draw. No people.
- **Her rails** are unlit lines in their paint's colour (white): for a
  ship with a blackout they dim with her lights (`dimRails`), to her
  emergency level after `lights-out`, so they do not glow.
- **Her lights** (`ShipRig.tsx`): lit end to end until the sim's
  `lights-out`; then a 2.5 s flicker (`blackoutFlicker`) and only her
  emergency panes, the model's fixed mask at `blackout.emergencyLight`
  (`setEmergency`; 0 before `lights-out`, so a seek back before it, or
  another ship, has none), her deck lamps at a quarter of that level.
- **The strike** (`strikeSpray`, `Effects.tsx`): from the first
  `collision` until the rock lodges, white water thrown up and trailing
  aft along her port side at the waterline, where the rock is (it stays
  put while she runs on past it: frame 124 less how far she has run,
  never aft of frame 52). It lodges (`rockLodgedT`) when Le Scole's tip
  reaches frame 52 along her side, about 13 s in at her sim's 8.3 kn (the
  gash's 7 s assumes her 15.5 kn); the model's rock shows in her side
  from then, so it is the islet's. Once a run; none without a collision
  (no spots: she sails past).
- **Her boats** (R19): lowered as the sim's `boat-lowered` events say
  (starboard first from 22:55, then port; three port boats stay), then
  motoring in to Giglio Porto (`boatRoute`: out from her side, a port
  boat round her bow, to a fan of slots off the harbour mouth between the
  mole lights) at a lifeboat's 6 knots by the run's real time (`realT`:
  18 shown m/s on the aground clock's sixth of real time, 3 m/s blown out
  to sea), each with a small white lamp. No people.
- **Camera**: `CONCORDIA_HULL_BOXES` (the Carpathia's rule on her data:
  her hull and superstructure blocks, deck 14 at 50.6 m). The ground
  (`groundFor("concordia")`: the island's land and her sloping floor)
  replaces the flat floor for the camera's clamp (`clampAboveGround`) and
  for `keepClear`'s faces, so no camera goes under her floor, into the
  island, or into her lying at 65° (`cameraMath.test.ts`: 720 orbit
  points round her rest). Her cinematic shots: `giglio` (the title and
  her lit run past the island, from her starboard bow on the sea side),
  `giglio-strike` (0–40 s, low on her port quarter: the white water and
  the rock), `giglio-drift` (out to sea from her, looking in: Giglio
  Porto behind her), `giglio-boats` (between her and the harbour, to
  seaward: the boats going in), `giglio-aground` (from the sea off her
  port side: her bottom half out of the water, the harbour's lights
  beyond). Her underwater view: when a spur lies under her, low across
  the shelf at its granite with her starboard side lying on it (60–75 m
  off, the first clear bearing round from her starboard beam toward her
  stern); else ahead of her bow, looking aft at her starboard bilge. Bridge: her starboard wing on deck
  8; stern: the aft terraces on deck 9.
- **The other outcomes**: no spots (no `collision`) sails past lit, no
  white water; four compartments rest at about 17° on the shelf; "blown
  out to sea" sinks stern first in 146–150 m (the profile 2 km out),
  where the floor mesh is deep and coarse: no island floor under her.
- **Perf**: three scenes (`shipwreck-concordia-salute`: lit, passing the
  island before the strike; `-drift`: 22:33, after the blackout, listing
  about 10°, the harbour behind; `-aground`: on her side, the harbour's
  lights) at the top tier (Task 6 report). The island (grid, normals, rocks, lights,
  seagrass and its instance matrices) is built a step at a time
  (`giglioBuild`, a generator: 762 steps, the longest 1.5 ms in node, 44 ms
  in all) by `GiglioBuild` each frame, 1.5 ms while her night computes and
  6 ms after, so no frame is blocked; the island and its floor appear when
  it is done (about a second in) and the CPU arrays are kept for the page
  (the GPU copies are disposed with the components). The camera's ground
  (`concordiaGround`) costs about 0.5 µs a call (the seabed's per-cell
  shore candidates), about 0.01 ms a frame.
- **Attribution**: coastline, buildings, harbour lights and place names
  © OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright.
  Heights: NASA SRTM (public domain), through OpenTopoData.
