# Shipwreck scene

Each ship's last hours in three.js: the Titanic's night of 14–15 April 1912
(a moonless sky, a glassy sea) and the Lusitania's afternoon of 7 May 1915
(sun, haze, the Cork coast, 93 m of green water), the ship posed from the
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
| `runtime.ts`      | The per-frame values the scene's parts share (sampled frame, visible parts, flash).                                                                                                                                                                                                                                                                                   |
| `sceneHooks.ts`   | The `window.__shipwreck` test hooks for a store.                                                                                                                                                                                                                                                                                                                      |
| `SceneCheck.tsx`  | `/shipwreck?scene` (dev and e2e builds only): the real night with no UI. `&quality=high\|medium\|low` pins a tier.                                                                                                                                                                                                                                                    |

Frame loop order (R3F priorities): driver −3 (pump the runner, advance `t`),
ship rig −2, effects −1.5, X-ray −0.9, environment −0.8, sky −0.7, camera −1
… sea reflection −0.5, then the composer renders (1).

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
| `computedT`, `done`, `progress` | How far the runner has got (`computedT` = last frame's shown time). Show computed vs not on the timeline.                                                                                                                             |
| `t`                             | Shown seconds after the collision (11:40 PM). The clock is `(CLOCK_START_S + t) mod 86400`.                                                                                                                                           |
| `realT`                         | Real seconds after the collision at `t` (from the sim's frames). Differs from `t` during the way down (×6): show the real clock from it.                                                                                              |
| `playing`, `speed`              | Play state and the chosen speed (1, 10, 30, 100). Playback stops at the end of a finished track.                                                                                                                                      |
| `slowMo`                        | True while the cinematic camera holds ×1 around the break and the plunge (`speed` keeps the choice).                                                                                                                                  |
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
`window.__shipwreckRenderInfo` has the same plus the tier and DPR. Task 5
installs them with `installTestHooks(getScreen, undefined, sceneHooks(playback))`.

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
- **Bounds per ship**: `hullBoxesFor(ship)`; `keepClear` pushes the free
  camera out of the boxes through a face that leaves it above the floor (a
  wreck on her side has a face on the floor).

## Performance (see the task 4 report for numbers)

- The planar reflection is a second scene render at 1024² (high only).
- Bloom at half (high) or 0.35 (lower) resolution; MSAA 4× at every tier (changing it rebuilds the composer).
- The models are built once at `MODEL_QUALITY` (high detail: rigging and rails), never per tier.
- Double-tap fly-to raycasts the hull boxes (`HULL_BOXES`) in each part's frame, not the meshes.
- A place pin's camera is lifted to stay 2.5 m above the sea, so it never sits inside the flooded water.
- Hidden models (whole after the break, halves before it) cost no draws.
- X-ray adds about 5–10 draws (water, lines, gashes, blockouts).
- DPR: high 2, medium 1.5, low 1 (capped by the device).
- The afternoon adds about 3–5 draws (day sky instead of stars, coast,
  torpedo track, day particles; shafts and floor only under water). No
  shadow maps (they would pass the ship again). Bloom threshold 1.6 by day
  so sunlit paint does not glow. Her lights and lamps run at 2.5 %.
