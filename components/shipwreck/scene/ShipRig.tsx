"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PointLight } from "three";
import { useStore } from "zustand";
import TitanicModel from "@/components/shipwreck/model/TitanicModel";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import { shipToThree } from "./cameraMath";
import type { SceneRuntime } from "./runtime";

/**
 * The ship driven by the track: samples the sim frame at the store's `t`
 * each frame and poses the model. Both models are built up front: the whole
 * ship at load and the two halves as soon as the sim knows where she breaks
 * (long before playback gets there); the halves are drawn hidden under the
 * whole for a few frames so their buffers and shaders are on the GPU before
 * 2:14. At the break the whole hides and the halves take over.
 */

/** Warm-up frames for the split model (drawn under the whole ship). */
const WARM_FRAMES = 3;
/**
 * Real deck lights near the decks (≤ 4 lights in the scene): fore and aft,
 * a little over the boat deck (the Titanic's at 31 m).
 */
function lampsOf(spec: ShipSpec): [number, number, number][] {
  const boat = spec.decks.find((d) => d.name === "Boat")?.z ?? spec.depth;
  const z = Math.round((boat + 2.81) * 100) / 100;
  return [
    [52, 0, z],
    [-50, 0, z],
  ];
}

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

  const LAMPS = useMemo(() => lampsOf(spec), [spec]);
  // The decks lit by deck (the top eight), with the sheer measured from the
  // C deck as the model does.
  const decks = useMemo(() => spec.decks.slice(0, 8), [spec]);
  const sheerRef = spec.decks.find((d) => d.name === "C")?.z ?? spec.depth;
  const lamps = useMemo(
    () =>
      LAMPS.map(() => {
        const l = new PointLight(0xffd6a0, 0, 160, 1.6);
        return l;
      }),
    [LAMPS]
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

  useFrame(() => {
    const s = store.getState();
    const track = s.track;
    if (!track || track.frames.length === 0) return;
    const frame = sampleTrack(track, s.t);
    runtime.frame = frame;
    const two = frame.bodies.some((b) => b.part !== "whole");
    const whole = runtime.whole;
    const split =
      runtime.split && runtime.split.breakX === breakX ? runtime.split : null;
    runtime.broken = two && split !== null;
    // Halves kept from an earlier run that has not broken (yet): hidden.
    if (!split && runtime.split) runtime.split.root.visible = false;
    const power = frame.power;
    const flicker = power > 0 && power < 1 ? 0.6 : 0;

    if (whole) {
      whole.root.visible = !runtime.broken;
      if (!runtime.broken) {
        applyBodyPose(whole.whole, frame.bodies[0]);
        whole.setPower(power);
        whole.setFlicker(flicker);
      }
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
    const main =
      frame.bodies.find((b) => b.part === "stern") ?? frame.bodies[0];
    const model = runtime.broken ? split : whole;
    if (model) {
      decks.forEach((d, i) => {
        let under = 0;
        for (let k = 0; k < 9; k += 1) {
          const x = -120 + k * 30;
          const body =
            runtime.broken && breakX !== null && x > breakX
              ? (frame.bodies.find((b) => b.part === "bow") ?? main)
              : main;
          if (earthZ(body, x, 0, d.z + (spec.sheerZ(x) - sheerRef)) < 0)
            under += 1;
        }
        model.setDeckPower(i, 1 - (under / 9) * 0.8);
      });
    }

    // Two warm lamps over the decks, fading with the power.
    LAMPS.forEach((p, i) => {
      const body = runtime.broken
        ? (frame.bodies.find(
            (b) => b.part === (p[0] > (breakX ?? 0) ? "bow" : "stern")
          ) ?? main)
        : main;
      const w = shipToThree(body, p);
      lamps[i].position.set(w[0], w[1], w[2]);
      lamps[i].intensity = power * 900;
    });
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
