import type { CameraId } from "@/lib/shipwreck/types";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import type { BodyPose, SimTrack } from "@/lib/shipwreck/sim/track";
import {
  levelToThree,
  shipToThree,
  type ShotContext,
  type V3,
  type View,
} from "./cameraMath";

/**
 * The Poseidon's night on camera (spec "Camera"): the lit ship on the
 * swell, the wave coming from her port beam (seen from off her starboard
 * quarter, low, so it rises behind her), the roll-over from ahead, keel up
 * with her propellers in the air, under water looking up at the ballroom's
 * dome facing the deep, the dive, and her rest keel up on the floor. Pure:
 * the camera rig and the tests read the same views. (Her hull boxes are in
 * `cameraMath.ts`, `POSEIDON_HULL_BOXES`.)
 */

export type PoseidonShot =
  | "poseidon-party"
  | "poseidon-wave"
  | "poseidon-roll"
  | "poseidon-keel"
  | "poseidon-dome"
  | "poseidon-dive"
  | "poseidon-floor";

export const POSEIDON_SHOTS: readonly PoseidonShot[] = [
  "poseidon-party",
  "poseidon-wave",
  "poseidon-roll",
  "poseidon-keel",
  "poseidon-dome",
  "poseidon-dive",
  "poseidon-floor",
];

/** The wave shot starts this long before the hit (shown s). */
const WAVE_SHOT_S = 28;
/** Keel up: the propellers in the air for this long, then the dome. */
const KEEL_SHOT_S = 70;
/** Her ballroom's dome, ship frame (x, z of its crown; ours, the model's). */
const DOME_X = -3;
const DOME_Z = 62;

function firstOf(events: readonly SimEvent[], kind: string): number | null {
  for (const e of events) if (e.kind === kind) return e.t;
  return null;
}

/** Which of her shots plays at shown time t (cinematic camera). */
export function poseidonShot(
  track: Pick<SimTrack, "events">,
  t: number
): PoseidonShot {
  const ev = track.events;
  const landed = firstOf(ev, "bow-lands") ?? firstOf(ev, "stern-lands");
  if (landed !== null && t >= landed - 4) return "poseidon-floor";
  const under = firstOf(ev, "bow-under");
  if (under !== null && t >= under - 15) return "poseidon-dive";
  const cap = firstOf(ev, "capsized");
  if (cap !== null && t >= cap + 6 + KEEL_SHOT_S) return "poseidon-dome";
  if (cap !== null && t >= cap + 6) return "poseidon-keel";
  const hit = firstOf(ev, "collision") ?? 0;
  if (t >= hit + 0.5) return "poseidon-roll";
  if (t >= hit - WAVE_SHOT_S) return "poseidon-wave";
  return "poseidon-party";
}

function main(ctx: ShotContext): BodyPose {
  return (
    ctx.bodies.find((b) => b.part === "whole") ??
    ctx.bodies.find((b) => b.part === "stern") ??
    ctx.bodies[0]
  );
}

/** The camera for one of her shots. */
export function poseidonView(shot: PoseidonShot, ctx: ShotContext): View {
  const b = main(ctx);
  switch (shot) {
    case "poseidon-party": {
      // Lit end to end on the long swell: a slow circle, a little high.
      const a = 2.3 + ctx.t * 0.004 + ctx.wall * 0.01;
      const tgt = levelToThree(b, [0, 0, 26]);
      return {
        pos: [tgt[0] + Math.cos(a) * 430, 48, tgt[2] + Math.sin(a) * 430],
        target: tgt,
      };
    }
    case "poseidon-wave":
      // Off her starboard quarter, low on the swell, looking across her to
      // port, where the wave rises out of the dark behind her.
      return {
        pos: levelToThree(b, [-260, -330, 12]),
        target: levelToThree(b, [30, 160, 30]),
      };
    case "poseidon-roll":
      // From ahead and a little to starboard: she rolls toward us.
      return {
        pos: levelToThree(b, [380, -120, 34]),
        target: levelToThree(b, [0, -10, 18]),
      };
    case "poseidon-keel": {
      // Keel up from off her stern quarter, above the sea: her red bottom,
      // her propellers and rudders in the air.
      const tgt = shipToThree(b, [-100, 0, 4]);
      tgt[1] = Math.max(tgt[1], 4);
      return { pos: levelToThree(b, [-260, -130, 30]), target: tgt };
    }
    case "poseidon-dome": {
      // Under water beside her, deeper than the dome, looking up at it
      // facing the deep (her decks hang down, upside down).
      const tgt = shipToThree(b, [DOME_X, 0, DOME_Z]);
      const pos: V3 = [tgt[0] + 70, tgt[1] - 30, tgt[2] + 95];
      pos[1] = Math.min(pos[1], -6);
      tgt[1] = Math.min(tgt[1], -3);
      return { pos, target: tgt };
    }
    case "poseidon-dive": {
      // Following her down, beside and a little below her.
      const tgt = shipToThree(b, [0, 0, 20]);
      const pos: V3 = [tgt[0] - 150, tgt[1] - 25, tgt[2] + 170];
      pos[1] = Math.min(pos[1], -6);
      tgt[1] = Math.min(tgt[1], -3);
      return { pos, target: tgt };
    }
    case "poseidon-floor": {
      // Keel up on the floor: a slow circle, over her.
      const tgt = shipToThree(b, [0, 0, 10]);
      const floor = -ctx.seaDepthM;
      const a = 0.7 + ctx.wall * 0.03;
      return {
        pos: [
          tgt[0] + Math.cos(a) * 230,
          Math.max(floor + 70, tgt[1] + 70),
          tgt[2] + Math.sin(a) * 230,
        ],
        target: tgt,
      };
    }
  }
}

/** Her bridge's starboard wing (deck 9, across her beam), looking aft. */
export function poseidonBridgeView(ctx: ShotContext): View {
  const b = main(ctx);
  return {
    pos: shipToThree(b, [106, -19.5, 43]),
    target: shipToThree(b, [-60, -16, 38]),
  };
}

/** Her sun deck aft of the funnel (deck 14), looking forward to the dome. */
export function poseidonSternView(ctx: ShotContext): View {
  const b = main(ctx);
  return {
    pos: shipToThree(b, [-122, 0, 56]),
    target: shipToThree(b, [0, 0, 60]),
  };
}

/**
 * The cameras that stand on her (the bridge, the stern) or on the water by
 * her (the lifeboat) hand over to the free camera once she is keel up
 * (`capsized`): no camera upside down in a flooded bridge or under her.
 * True when `camera` should now be the orbit. Any ship without a
 * `capsized` event: never.
 */
export function orbitOnceCapsized(
  camera: CameraId,
  events: readonly SimEvent[],
  t: number
): boolean {
  if (camera !== "bridge" && camera !== "lifeboat" && camera !== "stern")
    return false;
  const cap = firstOf(events, "capsized");
  return cap !== null && t >= cap;
}
