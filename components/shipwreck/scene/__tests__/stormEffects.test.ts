import { Group } from "three";
import { QUALITY_TIERS } from "@/lib/shipwreck/playback";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import type { SimFrame, SimTrack } from "@/lib/shipwreck/sim/track";
import { stormOf, waveField } from "@/lib/shipwreck/sim/waves";
import { createSceneRuntime } from "../runtime";
import { STORM_PARTICLES, snowAt } from "../storm";
import { StormEffects, type StormFrame } from "../stormEffects";

/**
 * The storm's particles share one pool: in the thickest squall (the
 * 6:45–7:16 PM one, when the big seas come) the snow must not crowd out
 * the spray and the smoke (fix round 2).
 */

/** Shown seconds after 3:30 PM for h:mm PM. */
const pm = (h: number, m: number) => (h + 12 - 15) * 3600 + (m - 30) * 60;

describe("the storm's particle pool in a squall", () => {
  const storm = stormOf(fitzgerald)!;
  const hull = buildHull(fitzgerald);
  const t = pm(7, 0);

  it("is a full squall at 7 PM", () => {
    expect(snowAt(t)).toBe(1);
  });

  for (const q of QUALITY_TIERS)
    it(`keeps spray and smoke within the pool at ${q}`, () => {
      const pool = STORM_PARTICLES.high.pool;
      const runtime = createSceneRuntime();
      runtime.sea.storm = storm;
      runtime.sea.field = waveField(storm);
      runtime.sea.t = t;
      // The sea over her deck edge all along her (every emitter sprays),
      // under her funnel's top (it smokes).
      runtime.seaY = () => 10;
      const fx = new StormEffects(
        fitzgerald,
        hull,
        runtime,
        new Float32Array(pool * 3),
        new Float32Array(pool * 4),
        new Float32Array(pool)
      );
      const body = {
        part: "whole" as const,
        x: 0,
        y: 0,
        z: -8.3,
        pitch: 0,
        roll: 0,
        yaw: 0,
      };
      const frame = { t, realT: t, bodies: [body] } as unknown as SimFrame;
      const funnel = new Group();
      funnel.position.set(-94, 8.5, 0);
      const f: StormFrame = {
        track: { frames: [frame], events: [] } as unknown as SimTrack,
        frame,
        t,
        wall: 12.3,
        dt: 1 / 60,
        quality: q,
        funnel,
        // Off her starboard quarter, as the big-seas shots stand.
        camX: -200,
        camY: 40,
        camZ: 200,
        under: false,
        firesOut: false,
      };
      // A second of frames (the spray's emitters warm up).
      for (let k = 0; k < 60; k += 1) {
        f.wall += 1 / 60;
        fx.update(f);
      }
      const tier = STORM_PARTICLES[q];
      expect(fx.n).toBeLessThanOrEqual(tier.pool);
      expect(fx.counts.spray).toBeGreaterThan(tier.spray * 0.5);
      expect(fx.counts.smoke).toBeGreaterThan(tier.smoke * 0.5);
      expect(fx.counts.snow).toBeGreaterThan(tier.snow * 0.8);
      expect(fx.counts.snowFar).toBeGreaterThan(0);
      expect(
        fx.counts.snow + fx.counts.snowFar + fx.counts.spray + fx.counts.smoke
      ).toBe(fx.n);
    });
});
