# Shipwreck 1.1 — the Lusitania

Second ship for `/shipwreck`: RMS Lusitania, torpedoed off the Old Head of
Kinsale, Ireland, on the afternoon of 7 May 1915. Builds on the 1.0 spec
(`2026-11-20-shipwreck-design.md`), which still holds for everything this
document does not change.

## Why

Gentry's son (iPad mini 6) loves the realistic Titanic sinking: "zoom in and
fly around", "go inside certain places, see things as it sinks". The title
screen already promises Lusitania as "Coming soon". **The Lusitania is his
favourite ship**, so she gets at least the Titanic's level of detail and
love: he will know her features and notice what is wrong. Gentry said to
dive in, so the calls below are ours; he may revisit any of them.

## North-star goals (every builder re-reads these)

1. **She sinks the way she really did, from physics, not a script.** One
   torpedo on the starboard side, a second explosion moments later, a fast
   list to starboard, the bow ploughing into a 93 m sea floor while the
   stern is still in the air, gone in about 18 minutes. Tuning stays inside
   honest ranges; document every assumption in the sim README.
2. **It looks as good as the Titanic and still runs at 60 fps on an iPad
   mini 6.** The 1.0 budgets apply (≤ 160 draw calls, ≤ 450k triangles at
   the top tier, no frame blocked > 8 ms).
3. **It is a different afternoon, not a reskinned night.** Sunlit calm sea,
   the green Irish coast on the horizon, four funnels all smoking, the
   torpedo's wake streaking in, the water column of the hit.
4. **The Titanic does not regress.** Every 1.0 test and scenario passes
   unchanged; the Titanic's real night gives the same track as before.
5. **Kind to a young player.** The 1.0 rule holds: no people shown, no death
   counts in play, no screams. A parent line tells the adults.

## History the sim and scene aim at

(Builders verify and cite sources in the sim README; correct this list if
a source disagrees.)

- Cunard, built by John Brown, Clydebank; maiden voyage 1907. LOA 787 ft
  (239.9 m), LBP 760 ft (231.6 m), beam 87 ft 8 in (26.7 m), draught about
  33–34 ft at sea. Four funnels, all working: Cunard red with black tops and
  thin black bands. Black hull, white superstructure, red below the
  waterline. Four propellers, one rudder.
- Subdivision: transverse watertight bulkheads plus **longitudinal coal
  bunkers along both sides of the boiler rooms** (built for Admiralty
  protection). Flooding the starboard wing bunkers is what gave the list.
- 7 May 1915, 2:10 PM ship's time, about 11 nautical miles south of the Old
  Head of Kinsale, making about 18 knots. U-20's torpedo struck the starboard
  side below the bridge, near the forward boiler room. A second, larger
  explosion inside followed within seconds (cause disputed: we show it as an
  explosion low in the hull with no claim about the cause).
- She listed to starboard at once (about 15° within minutes, up to about
  25°), down by the head. Steam failed, the engines could not be stopped and
  she kept way, which made lowering boats hard; starboard boats swung far
  out from the hull, port boats swung in against it. Many portholes were
  open on the warm day and flooded once the list put them under.
- 48 boats (22 wooden, 26 collapsibles); only six got away properly.
- Sank at about 2:28 PM, 18 minutes after the hit. Water depth about 93 m,
  shorter than the ship: the bow struck the floor while the stern was still
  above the water. She came to rest on her starboard side.
- Weather: sunny, calm, light haze. Coast in sight.
- More than 1,190 people died. The parent line says so; play never does.

## Calls made without asking (Gentry may revisit)

- **Her paint is as on 7 May 1915.** Many sources say her funnels were
  painted dark (grey or black) for the war and her name painted out; the
  model builder checks the sources and follows them, keeping Cunard red as
  a one-line recipe switch in case Gentry wants the peacetime look.

- **No U-boat shown**: only the torpedo's bubble wake and the hit. Keeps the
  focus on the ship and away from "who did it".
- **The second explosion is shown, its cause is not named.**
- **She keeps way at first**: the sim carries a scripted forward speed that
  decays (no propulsion physics); the sea, wake and camera follow it.
- **"What if?" for the Lusitania** = choose where the torpedo hits (which
  compartment, along the starboard side) and whether the portholes were open.
- **Release**: Shipwreck 1.1.0 (minor), with a changelog entry in plain
  words. Titanic stays the default ship.
- **Analytics**: `shipwreck_start` and `shipwreck_end` get a closed-enum
  `ship` prop (`titanic` | `lusitania`); schema, rules and dashboard change
  together.

## Non-goals

- People, crowds, a U-boat model, blame, the munitions controversy.
- Walk-in interiors beyond the existing X-ray blockouts (still the long-term
  goal for both ships, not this release).
- Britannic and Edmund Fitzgerald (they stay "Coming soon").

## Anti-goals (fail even if it technically works)

- A canned animation pretending to be physics.
- The Titanic's track, look or performance changing.
- A daytime scene that looks like the night scene with the lights up.
