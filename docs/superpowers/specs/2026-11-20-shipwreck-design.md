# Shipwreck — design

A realistic, high-fidelity sinking-ship simulator at `/shipwreck`. The first
ship is RMS Titanic on the night of 14–15 April 1912; the ship format is data
driven so more ships (Britannic, Lusitania, Andrea Doria, Edmund Fitzgerald)
are later data files plus a model recipe.

Players: Gentry's sons (6 and 8) on an iPad mini 6 (A15) home-screen app, plus
the public. It must run smoothly on an A15 and on phones, icon-first, every HUD
item explains itself on tap.

## Decisions (made by the controller; Gentry said "make it happen")

- **Name / slug:** Shipwreck, `/shipwreck`. Not a Ship Builder mode: it has its
  own realistic art direction and renderer. It reuses ideas, not the block-hull
  scene, from `lib/ship-builder/sim/`.
- **Built on the game kit** (`docs/games/foundation.md`, `.claude/skills/new-game`):
  every foundation item, including offline play via the generated worker.
- **No people are shown in danger.** Real history, young players: the game is
  about the ship. No figures on deck, no death counts, no screams. Lifeboats are
  shown leaving (small boats with lanterns, no visible figures). Text is factual
  and calm ("She broke in two and sank at 2:20 AM"). The Versions page and the
  title screen carry one parent-facing line: "Based on the real sinking of the
  Titanic in 1912. More than 1,500 people died; this game shows only the ship."
- **Realism lives in a physics sim**, not a script. Hydrostatics from the hull's
  own offsets, water flowing through openings by the orifice law, spilling over
  bulkhead tops, and the hull breaking where the bending moment exceeds the
  girder's strength. Historical events that are not physics (rockets, lifeboats,
  steam venting) happen at their historical clock times while she is afloat.
- **Two modes:** _The real night_ (the historical damage) and _What if?_ (tap
  any compartments on the hull diagram to open them; the physics decides).
  Titanic with the first four compartments open floats; that is the lesson.
- **Visual target:** as close to film quality as an iPad mini allows: a glassy
  moonless sea that mirrors the ship's lights, a starfield, a detailed
  procedural Titanic (portholes, promenade windows, four raked buff funnels,
  masts and wires, davits and 20 lifeboats, ventilators, cranes, wooden decks,
  plating seams, red antifouling, the propellers and rudder that show when the
  stern rises), lights dying deck by deck, the breakup between funnels 3 and 4,
  sparks, steam, spray, bubbles, the dark descent and the bow ploughing into
  the sea floor.
- **Renderer:** React Three Fiber on WebGL2 (as Ship Builder and Planet Smasher).
  No WebGPU in v1.

## The night (calibration targets, sources: Hackett & Bedford 1996; the British and US inquiries; modern reconstructions)

| Clock         | What                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11:40 PM      | Starboard bow strikes the iceberg. Forepeak, holds 1–3, boiler rooms 6 and 5 opened; total opening about 1.1–1.2 m² (12–13 ft²), spread along ~90 m, low on the hull (1–7 m above the keel). |
| 11:50 PM      | Boilers vent steam through the funnels' waste pipes (roar) until about 12:30 AM.                                                                                                             |
| 12:45 AM      | First lifeboat (No. 7) lowered; first distress rocket.                                                                                                                                       |
| 12:45–1:40 AM | Eight white distress rockets, about every 5–7 min.                                                                                                                                           |
| 1:40–2:05 AM  | Remaining boats lowered (20 in all, the last collapsibles ~2:05).                                                                                                                            |
| ~2:00 AM      | Forecastle deck at the water. Bow trim about 5°.                                                                                                                                             |
| ~2:10 AM      | Bow well deck under; water reaches the bridge.                                                                                                                                               |
| ~2:15 AM      | Forward funnel falls; a wave rolls up the boat deck.                                                                                                                                         |
| ~2:17–2:18 AM | Lights flicker and fail; the hull breaks between funnels 3 and 4 at a trim of roughly 10–20°.                                                                                                |
| ~2:20 AM      | Stern, briefly settling back, floods, rises near-vertical and sinks.                                                                                                                         |
| ~2:20–2:30 AM | Bow and stern fall 3,800 m; the bow ploughs into the mud; the stern lands crushed.                                                                                                           |
| (4:10 AM)     | Carpathia arrives (end card mention only).                                                                                                                                                   |

Sea: flat calm, no moon, starlit, air about −2 °C, water about −2 °C. Ship
heading ~266°, iceberg on the starboard bow. She stopped within minutes.

Titanic particulars: LOA 269.1 m, LBP 259.1 m, beam 28.2 m, moulded depth
19.7 m (to C deck), draught ~10.5 m, displacement ~52,300 t, keel to funnel
tops ~53 m. 15 transverse watertight bulkheads (A–P), 16 compartments; the
first two bulkheads and those aft of the engine room reach D deck, the rest E
deck (the controller accepts the builder's researched values within this
shape).

## Pass criteria for the sim (real night, enforced by tests)

- Breakup between 2:05 and 2:25 AM, at a station between funnels 3 and 4
  (between ~35% and ~45% of length from the stern), trim 8°–25°.
- Stern under (ship fully submerged) between 2:10 and 2:30 AM.
- List never past 10° before the breakup.
- What if: any 1–4 of the forward compartments open → still afloat at 6:00 AM
  with no breakup. 5 forward → sinks later than the real night (or floats).
  7 forward → sinks sooner than the real night.
- Deterministic: same inputs, same track. No `Math.random` in the sim.

## Pass criteria for the look (checked on screenshots and the perf spec)

- iPad mini portrait 744×1133 and landscape 1133×744 screenshots at: 11:45 PM
  (lit ship, glassy sea, iceberg), 1:00 AM (rocket burst, boats on the water),
  2:10 AM (bow under, stern lifting), 2:18 AM (breakup), underwater descent,
  the wreck on the floor.
- Whole scene ≤ 160 draw calls and ≤ 450k triangles at the highest quality tier
  (the perf spec records it in `e2e/perf-budget.json`).
- Adaptive quality: drei `PerformanceMonitor` drops DPR and costly passes when
  the frame rate falls; never below DPR 1.

## Out of scope for 1.0

People, other ships (the picker shows Titanic and silhouettes marked "Coming
soon"), sail-before-impact driving, leaderboards, WebGPU.
