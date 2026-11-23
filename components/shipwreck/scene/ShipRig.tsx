"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PointLight } from "three";
import { useStore } from "zustand";
import TitanicModel from "@/components/shipwreck/model/TitanicModel";
import {
  applyBowBendAbout,
  bowBend,
  hardLandingAt,
} from "@/components/shipwreck/model/bowBend";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import {
  createFrame,
  sampleTrackInto,
  type BodyPose,
  type SimFrame,
} from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import { seaFieldOf } from "./seaWaves";
import { ridePose } from "./stormRide";
import { shipToThreeInto, trackSpeedAt, type V3 } from "./cameraMath";
import { MAX_LAMPS, WAKE_PATH_POINTS, type SceneRuntime } from "./runtime";
import { SCENE_SETTINGS, isDaylit } from "./settings";
import { walkHullPower } from "./walkCamera";

/**
 * The ship driven by the track: samples the sim frame at the store's `t`
 * each frame and poses the model. Both models are built up front: the whole
 * ship at load and the two halves as soon as the sim knows where she breaks
 * (long before playback gets there); the halves are drawn hidden under the
 * whole for a few frames so their buffers and shaders are on the GPU before
 * 2:14. At the break the whole hides and the halves take over.
 */

/** Seconds between the points of a turning ship's wake (8 points: 140 s). */
const WAKE_STEP_S = 20;

/** Warm-up frames for the split model (drawn under the whole ship). */
const WARM_FRAMES = 3;
/**
 * Real deck lights near the decks, fore and aft, a little over the boat
 * deck (the Titanic's at 31 m): with the starlight and the submersible lamp,
 * 4 lights at night. By day there are none (the sun outshines them), so the
 * afternoon has 3: the sun, the sky light and the submersible lamp.
 */
function lampsOf(spec: ShipSpec): [number, number, number][] {
  if (isDaylit(SCENE_SETTINGS[spec.id])) return [];
  if (SCENE_SETTINGS[spec.id].storm) {
    // A laker's deck floodlights: on the forecastle's after face and the
    // after house's forward face, a few metres over her spar deck, lighting
    // the hatches between (on all afternoon in the storm).
    const fwd = spec.openDeck?.toX ?? 88;
    const aft = spec.openDeck?.fromX ?? -69;
    return [
      [fwd - 8, 0, Math.round((spec.sheerZ(fwd) + 6.5) * 100) / 100],
      [aft + 8, 0, Math.round((spec.sheerZ(aft) + 6) * 100) / 100],
    ];
  }
  const boat = spec.decks.find((d) => d.name === "Boat")?.z ?? spec.depth;
  const z = Math.round((boat + 2.81) * 100) / 100;
  // The Lusitania's boat deck runs from 72 m forward to -63 m aft.
  const [fwd, aft] = spec.id === "lusitania" ? [46, -42] : [52, -50];
  return [
    [fwd, 0, z],
    [aft, 0, z],
  ];
}

/**
 * A laker's deck lights along her hatches (on the hatch crane's rails
 * and the deck-edge posts: the builder's assumption, as her photographs
 * show lights there but not where each stood), lighting the storm's sea,
 * spray and green water only (`runtime.lamps`; no three.js lights, so
 * the model's shaders are not touched). The liners have none.
 */
export function deckLightsOf(spec: ShipSpec): [number, number, number][] {
  if (!SCENE_SETTINGS[spec.id].storm || !spec.openDeck) return [];
  const { fromX, toX } = spec.openDeck;
  const out: [number, number, number][] = [];
  const n = 6;
  for (let i = 0; i < n; i += 1) {
    const x = fromX + ((toX - fromX) * (i + 0.5)) / n;
    const side = i % 2 === 0 ? -1 : 1;
    out.push([
      Math.round(x * 10) / 10,
      Math.round(side * (spec.beam / 2 - 2) * 10) / 10,
      Math.round((spec.sheerZ(x) + 5) * 100) / 100,
    ]);
  }
  return out;
}

/**
 * By day her lights barely show (the sun outshines them; her portholes
 * read as dark glass): the panes run at this share.
 */
const DAY_LIGHTS = 0.025;

/**
 * The models are built once, at high detail (rigging wires and rails: they
 * are what make her read as the Titanic): the render tier (which the
 * frame rate moves) only changes the pixel ratio, the reflection and the
 * particles, so a tier step never rebuilds the ship mid-playback. The split
 * model is built as soon as the sim finds the break, which it does within
 * seconds of the start (long before playback reaches it).
 */
export const MODEL_QUALITY = "high" as const;

interface ShipRigProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /**
   * The ship on the stage. The scene keys the rig by ship, so another ship
   * builds new models and the old ones are disposed with the old rig.
   */
  spec: ShipSpec;
}

export default function ShipRig({ store, runtime, spec }: ShipRigProps) {
  const breakX = useStore(store, (s) => s.track?.breakX ?? null);
  // The halves stay built between runs (the track has no break for its
  // first seconds): Watch again on the same night never rebuilds them.
  const [modelBreakX, setModelBreakX] = useState<number | null>(null);
  if (breakX !== null && breakX !== modelBreakX) setModelBreakX(breakX);
  const warm = useRef(0);
  const { gl, scene, camera } = useThree();

  const lampPositions = useMemo(() => lampsOf(spec), [spec]);
  const allLamps = useMemo(
    () => [...lampPositions, ...deckLightsOf(spec)],
    [lampPositions, spec]
  );
  // The night's two lamps light a liner's long decks; a laker's floodlights
  // stand close over her deck and hatches (a dimmer lamp does).
  const lampStrength = SCENE_SETTINGS[spec.id].storm ? 260 : 900;
  // In the storm her lights are on all afternoon (the overcast is dim).
  const lightShare = isDaylit(SCENE_SETTINGS[spec.id]) ? DAY_LIGHTS : 1;
  // Scratch for her run-in frame and her wake (no allocation per frame).
  const scratch = useMemo(
    () => ({
      frame: null as SimFrame | null,
      body: null as BodyPose | null,
      bodies: [] as BodyPose[],
      stern: [0, 0, 0] as V3,
      fwd: [0, 0, 0] as V3,
      sternP: [0, 0, 0] as [number, number, number],
      fwdP: [0, 0, 0] as [number, number, number],
      // Her ride on the storm's waves (`stormRide.ts`).
      ride: new Float64Array(3),
      rode: null as SimFrame | null,
      rodeBodies: [] as BodyPose[],
      sampled: createFrame(),
      lamp: [0, 0, 0] as V3,
      past: createFrame(),
      pathP: [0, 0, 0] as V3,
    }),
    []
  );
  const sternX = useMemo(
    () => Math.min(...spec.stations.map((st) => st.x)),
    [spec]
  );
  // The decks lit by deck (the top eight), with the sheer measured from the
  // C deck as the model does.
  const decks = useMemo(() => spec.decks.slice(0, 8), [spec]);
  const sheerRef = spec.decks.find((d) => d.name === "C")?.z ?? spec.depth;
  const lamps = useMemo(
    () =>
      lampPositions.map(() => {
        const l = new PointLight(0xffd6a0, 0, 160, 1.6);
        return l;
      }),
    [lampPositions]
  );

  // Another ship (or the game leaving): forget this rig's models, which
  // their components dispose as they unmount.
  useEffect(
    () => () => {
      runtime.whole = null;
      runtime.split = null;
      runtime.broken = false;
    },
    [runtime]
  );

  // A break somewhere new: forget the old halves until the new ones are built.
  useEffect(() => {
    if (runtime.split && runtime.split.breakX !== modelBreakX)
      runtime.split = null;
  }, [modelBreakX, runtime]);

  const onWhole = useCallback(
    (h: TitanicHandles) => {
      runtime.whole = h;
    },
    [runtime]
  );
  const onSplit = useCallback(
    (h: TitanicHandles) => {
      runtime.split = h;
      warm.current = WARM_FRAMES;
      // Compile the halves' programs now (hidden objects are skipped).
      h.root.visible = true;
      try {
        gl.compile(scene, camera);
      } catch {
        // Not fatal: the first frame compiles them instead.
      }
    },
    [runtime, gl, scene, camera]
  );

  useFrame((state) => {
    const s = store.getState();
    const track = s.track;
    const sea = runtime.sea;
    if (!track || track.frames.length === 0) {
      sea.storm = null;
      sea.field = null;
      return;
    }
    let frame = sampleTrackInto(track, s.t, scratch.sampled);
    // Before the hit (a torpedo's run-in) she steams on at her speed: the
    // first frame, run back along her heading (into scratch objects).
    if (s.t < 0 && spec.headway) {
      const b0 = frame.bodies[0];
      const d = spec.headway.startMs * s.t;
      const body = Object.assign(scratch.body ?? { ...b0 }, b0);
      body.x = b0.x + Math.cos(b0.yaw) * d;
      body.y = b0.y + Math.sin(b0.yaw) * d;
      scratch.body = body;
      scratch.bodies.length = 0;
      scratch.bodies.push(body);
      const f = Object.assign(scratch.frame ?? { ...frame }, frame);
      f.t = s.t;
      f.realT = s.t;
      f.bodies = scratch.bodies;
      scratch.frame = f;
      frame = f;
    }
    // A storm: the sea's time (her real time; on the title's stage the
    // wall clock, so the sea runs while the playback waits) and her ride
    // on it, added to the sim's still-water pose (no allocation).
    sea.storm = track.storm ?? null;
    sea.scale = track.stormScale ?? 1;
    sea.field = seaFieldOf(track);
    sea.t = frame.realT + (s.preview ? state.clock.elapsedTime : 0);
    if (sea.storm) {
      const rode = Object.assign(scratch.rode ?? { ...frame }, frame);
      // (A frame without deck water, after the break, must not keep the
      // last one's.)
      rode.deckWater = frame.deckWater;
      const bodies = scratch.rodeBodies;
      bodies.length = frame.bodies.length;
      for (let i = 0; i < frame.bodies.length; i += 1) {
        const out = bodies[i] ?? { ...frame.bodies[i] };
        bodies[i] = out;
        ridePose(
          spec,
          track,
          frame.bodies[i],
          frame.realT,
          sea.t,
          out,
          scratch.ride
        );
      }
      rode.bodies = bodies;
      scratch.rode = rode;
      frame = rode;
    }
    runtime.frame = frame;
    const two = frame.bodies.some((b) => b.part !== "whole");
    const whole = runtime.whole;
    const split =
      runtime.split && runtime.split.breakX === breakX ? runtime.split : null;
    runtime.broken = two && split !== null;
    // Halves kept from an earlier run that has not broken (yet): hidden.
    if (!split && runtime.split) runtime.split.root.visible = false;
    const lit = frame.power * lightShare;
    const flicker = lit > 0 && lit < 1 ? 0.6 : 0;
    // Looking under from the sea: her hull lights stay faintly on, so she
    // is a dim lit shape going down.
    const power = walkHullPower(lit, runtime.walkLookUnder);

    if (whole) {
      whole.root.visible = !runtime.broken;
      if (!runtime.broken) {
        applyBodyPose(whole.whole, frame.bodies[0]);
        whole.setPower(power);
        whole.setFlicker(flicker);
      }
      // Her bow bends when it strikes the floor with her stern still up
      // (R12, a ship with a hinge: the Britannic), about the upright
      // through the hinge so it lies on the floor where the sim puts it.
      if (whole.bend && whole.recipe.hinge)
        applyBowBendAbout(
          whole.bend,
          bowBend(frame.t, hardLandingAt(track)),
          whole.recipe.hinge,
          frame.bodies[0].roll,
          frame.bodies[0].pitch
        );
    }
    if (split) {
      if (runtime.broken) {
        split.root.visible = true;
        for (const b of frame.bodies) {
          if (b.part === "bow" || b.part === "stern")
            applyBodyPose(split[b.part], b);
        }
        split.setPower(power);
        split.setFlicker(flicker);
      } else {
        // Hidden, or drawn exactly under the whole ship while warming up.
        const pose = frame.bodies[0];
        applyBodyPose(split.bow, pose);
        applyBodyPose(split.stern, pose);
        split.root.visible = warm.current > 0;
        if (warm.current > 0) warm.current -= 1;
      }
    }

    // Decks dim as the sea closes over them.
    // (Plain loops: no closures or searches allocated per frame.)
    let sternBody: BodyPose | null = null;
    let bowBody: BodyPose | null = null;
    for (const b of frame.bodies) {
      if (b.part === "stern" && !sternBody) sternBody = b;
      if (b.part === "bow" && !bowBody) bowBody = b;
    }
    const main = sternBody ?? frame.bodies[0];
    const bowPart = bowBody ?? main;
    const model = runtime.broken ? split : whole;
    if (model) {
      for (let i = 0; i < decks.length; i += 1) {
        const d = decks[i];
        let under = 0;
        for (let k = 0; k < 9; k += 1) {
          const x = -120 + k * 30;
          const body =
            runtime.broken && breakX !== null && x > breakX ? bowPart : main;
          if (earthZ(body, x, 0, d.z + (spec.sheerZ(x) - sheerRef)) < 0)
            under += 1;
        }
        model.setDeckPower(i, 1 - (under / 9) * 0.8);
      }
    }

    // Two warm lamps over the decks, fading with the power (and, in the
    // storm, her deck lights along her hatches for the sea and the spray:
    // `runtime.lamps` only, no three.js lights).
    let nl = 0;
    for (let i = 0; i < allLamps.length && nl < MAX_LAMPS; i += 1) {
      const p = allLamps[i];
      let body = main;
      if (runtime.broken) {
        const part = p[0] > (breakX ?? 0) ? "bow" : "stern";
        for (const b of frame.bodies) if (b.part === part) body = b;
      }
      const w = shipToThreeInto(body, p, scratch.lamp);
      if (i < lamps.length) {
        lamps[i].position.set(w[0], w[1], w[2]);
        lamps[i].intensity = lit * lampStrength;
      }
      // A lamp deep under the sea lights nothing on it (one just under a
      // breaking sea still glows through the foam over her deck).
      if (w[1] < -6) continue;
      runtime.lamps[nl * 3] = w[0];
      runtime.lamps[nl * 3 + 1] = w[1];
      runtime.lamps[nl * 3 + 2] = w[2];
      nl += 1;
    }
    runtime.lampCount = nl;
    runtime.lampPower = allLamps.length > 0 ? lit : 0;

    // Her wake while she has way (ships with headway).
    const wake = runtime.wake;
    if (spec.headway && !runtime.broken) {
      const now = frame.bodies[0];
      const start = track.frames[0].bodies[0];
      // Her speed off the track's own frames over the last 2 s.
      const speed =
        s.t > 2.2 ? trackSpeedAt(track.frames, s.t, 2) : spec.headway.startMs;
      // Before the hit she has been steaming all along.
      const steaming = s.openings.length === 0 || s.t < 0;
      scratch.sternP[0] = sternX;
      scratch.fwdP[0] = sternX + 10;
      const stern = shipToThreeInto(now, scratch.sternP, scratch.stern);
      const fwd = shipToThreeInto(now, scratch.fwdP, scratch.fwd);
      const len = Math.hypot(fwd[0] - stern[0], fwd[2] - stern[2]) || 1;
      wake.x = stern[0];
      wake.z = stern[2];
      wake.dx = (fwd[0] - stern[0]) / len;
      wake.dz = (fwd[2] - stern[2]) / len;
      // The title's calm ship (no hole) steams on at full speed.
      // (A turning ship's stern is "up" while her waterline aft is: the
      // keel's 4 m test leaves the liners' wake out once they are hit, a
      // follow-up kept as it is so their scenes do not change.)
      let sternUp = stern[1] > -4;
      if (spec.headway.turn) {
        scratch.pathP[0] = sternX;
        scratch.pathP[1] = 0;
        scratch.pathP[2] = spec.draught;
        sternUp = shipToThreeInto(now, scratch.pathP, scratch.lamp)[1] > -4;
      }
      wake.amount = steaming
        ? 1
        : Math.min(1, speed / spec.headway.startMs) * (sternUp ? 1 : 0);
      wake.length = Math.max(
        steaming ? 900 : 0,
        Math.min(900, Math.hypot(now.x - start.x, now.y - start.y))
      );
      // A turning ship's wake follows her stern's path (the morning's sea
      // draws it): where her stern was every WAKE_STEP_S back, and before
      // the first event straight back along her course then.
      wake.pathN = 0;
      if (spec.headway.turn && !steaming) {
        let len = 0;
        for (let k = 0; k < WAKE_PATH_POINTS; k += 1) {
          const back = s.t - k * WAKE_STEP_S;
          const f = sampleTrackInto(track, Math.max(0, back), scratch.past);
          const p = shipToThreeInto(f.bodies[0], scratch.sternP, scratch.pathP);
          if (back < 0) {
            const b0 = f.bodies[0];
            const d = spec.headway.startMs * back;
            p[0] += Math.cos(b0.yaw) * d;
            p[2] -= Math.sin(b0.yaw) * d;
          }
          if (k > 0)
            len += Math.hypot(
              p[0] - wake.path[k * 2 - 2],
              p[2] - wake.path[k * 2 - 1]
            );
          wake.path[k * 2] = p[0];
          wake.path[k * 2 + 1] = p[2];
          wake.pathN = k + 1;
        }
        wake.length = Math.min(900, len);
      }
    } else wake.amount = 0;
  }, -2);

  return (
    <>
      {lamps.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      <TitanicModel spec={spec} quality={MODEL_QUALITY} onReady={onWhole} />
      {modelBreakX !== null && (
        <TitanicModel
          spec={spec}
          breakX={modelBreakX}
          quality={MODEL_QUALITY}
          onReady={onSplit}
        />
      )}
    </>
  );
}

/**
 * The rig for the ship on the stage, keyed by ship: picking another ship
 * builds her models and disposes the old ones (their components unmount).
 */
export function ShipOnStage({ store, runtime }: Omit<ShipRigProps, "spec">) {
  const ship = useStore(store, (s) => s.ship);
  return (
    <ShipRig key={ship} store={store} runtime={runtime} spec={getShip(ship)} />
  );
}
