# Planet Smasher 1.3 — rethink: pacing, arsenal, more worlds

Date: 2026-11-14 · Status: directed by Gentry ("rethink gameplay, progression, design,
capabilities; plan, build and deploy")

## What's wrong after 1.0–1.2 (designer read)

1. **The good stuff unlocks far too late.**
   - The star path runs to 20,000, and a wrecked planet pays roughly 600 stars.
     That's about 30+ planets to unlock everything.
   - The boys' favourites sit deep in the path: twin nuke at 6,000 and nuke rain
     at 9,500, behind tools they care less about. The alien tech sits from 7,000
     to 13,000.
   - The path is append-only by release, not designed as a whole.
2. **The tray is a 20-tile scrolling strip.**
   - On an iPad mini, a 6-year-old can't find tools.
   - There's no grouping, and most of the strip is off-screen.
3. **No visible next goal.** Stars go up, but nothing shows what you're working
   toward or how close you are (fun-loop rule: "a bar toward the next goal").
4. **Only three worlds.** The destruction is the show, and new canvases
   multiply it cheaply.
5. **First 10 seconds.** Nothing tells a brand-new 6-year-old to tap the planet.
6. **Little feedback after a wreck.** The ending overlay shows points only. It
   doesn't say how far that wreck pushed toward the next unlock.

## What changes in 1.3

- **A progression simulator, scorecard and lab notebook** (fun-loop method) that
  measures unlock cadence with bot players. The star path is retuned against it.
  - Targets:
    - first unlock ≤ 60 s;
    - no gap > 5 min between new things (tool, planet or trophy) in the first
      90 min;
    - every tool unlocked in about 60–90 min of play;
    - the nuke family and alien tech come early.
- **A redesigned star path** across 20 tools and 6 planets, with nukes and aliens
  pulled forward. The order is designed as a whole.
- **Arsenal tabs:**
  - Four category tabs: 🌠 Space, 💣 Bombs, 🌋 Nature, 👽 Aliens. Each holds ≤ 6
    tiles, so nothing scrolls.
  - A tab shows a dot when it holds something new.
  - Locked tiles show a progress ring toward their unlock.
- **A "next unlock" bar in the HUD:** the next item's icon as a dark silhouette,
  plus a bar of stars toward it. The ending overlay shows the same bar filling
  with the stars just earned.
- **Three new procedural worlds:**
  - 🌋 Magmar (lava world; the people are "Lava folk" 🔥);
  - 🍭 Sweetopia (candy world; 🍬);
  - 🌊 Aquaria (ocean world with islands; 🐙).

  Each gets a population, an atmosphere colour and a population map.

- **Planet picker:** each planet shows 💥×N, the number of times you've wrecked it.
- **First-play hint:** a pulsing 👆 on the planet until the first hit ever.

## Non-goals

A sandbox/unlock-all mode, spending stars, analytics, new tools, and leaderboards.

## Constraints

As in 1.0–1.2:

- iPad mini 6 budgets;
- kid guardrails: no timers, streaks or loot boxes;
- old saves load. Items an old save already passes on the new path are simply
  unlocked, with no flood of toasts.
