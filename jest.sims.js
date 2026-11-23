/**
 * The game-balance simulations: tests that play whole runs with bots (Ever
 * Onward's scorecards, dials and maps, the plane balance sweep). They are
 * about 97% of unit-test time, so they run in their own lane:
 *
 * - `npm test` (and CI's unit job) skips them: JEST_LANE=fast.
 * - `npm run test:sims` runs only them: JEST_LANE=sims. CI runs them only by
 *   hand (.github/workflows/sims.yml, Actions > Sims > Run workflow).
 *
 * A new test that plays whole runs goes here, so it stays out of CI.
 */
module.exports = [
  "components/ever-onward/scenes/grow/__tests__/TradeoffArt.test.tsx",
  "components/ever-onward/scenes/higher/__tests__/HigherScene.test.tsx",
  "lib/ever-onward/engine/__tests__/noDeadUpgrades.test.ts",
  "lib/ever-onward/test/__tests__/jump.test.ts",
  "lib/ever-onward/universes/grow/__tests__/biomes.test.ts",
  "lib/ever-onward/universes/grow/__tests__/economy.test.ts",
  "lib/ever-onward/universes/grow/__tests__/farm.test.ts",
  "lib/ever-onward/universes/grow/__tests__/forks.test.ts",
  "lib/ever-onward/universes/grow/__tests__/knowhow.test.ts",
  "lib/ever-onward/universes/grow/__tests__/map.test.ts",
  "lib/ever-onward/universes/grow/__tests__/market.test.ts",
  "lib/ever-onward/universes/grow/__tests__/scene.test.ts",
  "lib/ever-onward/universes/grow/__tests__/scorecard.test.ts",
  "lib/ever-onward/universes/grow/__tests__/skeleton.test.ts",
  "lib/ever-onward/universes/grow/__tests__/world.test.ts",
  "lib/ever-onward/universes/grow/__tests__/worldMix.test.ts",
  "lib/ever-onward/universes/higher/__tests__/economy.test.ts",
  "lib/ever-onward/universes/higher/__tests__/guardrails.test.ts",
  "lib/ever-onward/universes/higher/__tests__/keepsakes.test.ts",
  "lib/ever-onward/universes/higher/__tests__/map.test.ts",
  "lib/ever-onward/universes/higher/__tests__/scorecard.test.ts",
  "lib/ever-onward/universes/higher/__tests__/skeleton.test.ts",
  "lib/ever-onward/universes/higher/__tests__/sky.test.ts",
  "lib/ever-onward/universes/higher/__tests__/topPack.test.ts",
  "lib/ever-onward/universes/higher/__tests__/town.test.ts",
  "lib/ever-onward/universes/higher/__tests__/tradeoffs.test.ts",
  "lib/ever-onward/universes/light/__tests__/antiStuck.test.ts",
  "lib/ever-onward/universes/light/__tests__/beamDial.test.ts",
  "lib/ever-onward/universes/light/__tests__/map.test.ts",
  "lib/ever-onward/universes/light/__tests__/nightDials.test.ts",
  "lib/ever-onward/universes/light/__tests__/oilDial.test.ts",
  "lib/ever-onward/universes/light/__tests__/scorecard.test.ts",
  "lib/ever-onward/universes/light/__tests__/skyDials.test.ts",
  "lib/ever-onward/universes/light/__tests__/tollDial.test.ts",
  "lib/ever-onward/universes/light/__tests__/warmth.test.ts",
  "lib/ever-onward/universes/light/__tests__/warmthDials.test.ts",
  "lib/ever-onward/universes/smile/__tests__/bench.test.ts",
  "lib/ever-onward/universes/smile/__tests__/economy.test.ts",
  "lib/ever-onward/universes/smile/__tests__/map.test.ts",
  "lib/ever-onward/universes/smile/__tests__/scorecard.test.ts",
  "lib/ever-onward/universes/smile/__tests__/together.test.ts",
  "lib/ever-onward/universes/smile/__tests__/town.test.ts",
  "lib/ever-onward/universes/smile/__tests__/world.test.ts",
  "lib/plane-builder/balance/__tests__/balance.test.ts",
  "lib/shipwreck/sim/__tests__/carpathiaWhatIf.test.ts",
  "lib/shipwreck/sim/__tests__/concordiaNight.test.ts",
  "lib/shipwreck/sim/__tests__/concordiaToSeaFixture.test.ts",
  "lib/shipwreck/sim/__tests__/concordiaWhatIf.test.ts",
  "lib/shipwreck/sim/__tests__/perf.test.ts",
  "lib/shipwreck/sim/__tests__/realAfternoon.test.ts",
  "lib/shipwreck/sim/__tests__/realStorm.test.ts",
  "lib/shipwreck/sim/__tests__/robustness.test.ts",
  "lib/shipwreck/sim/__tests__/seabed.test.ts",
];
