"use client";

import { useCallback, useMemo, useRef } from "react";
import { Matrix4, Vector3 } from "three";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { clamp } from "./animationMath";
import { halfMatrix, worldXOf } from "./halfTransform";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import { slotNoise } from "./particles";
import { createDroplet, type Droplet } from "./trialEffects";
import { trialPlayback } from "./trialPlayback";

const DEBRIS_COUNT = 36;
const SPARK_COUNT = 18;
const SPRAY_COUNT = 24;
const BUBBLE_COUNT = 24;
const WATER_COUNT = SPRAY_COUNT + BUBBLE_COUNT;

const DEBRIS_COLOR = "#2a2d33";
const SPARK_COLOR = "#ffa640";
const WATER_COLOR = "#e8f6ff";

const GRAVITY = 6;
const DEBRIS_LIFE = 2.2;
const SPARK_LIFE = 0.8;
const SPRAY_LIFE = 1.5;
const BUBBLE_LIFE = 2.6;
/** The whole burst is over this long after the break. */
const BURST_SECONDS = 4;
/**
 * The break point is caught from the halves this soon after the break; past
 * it the burst stays where it started instead of riding with the wreck.
 */
const CAPTURE_SECONDS = 0.1;

interface BurstFrame {
  /** Seconds since the break. */
  seconds: number;
  origin: Vector3;
  halfBeam: number;
}

/** A plain thrown particle: start offset, launch speed, gravity. */
function ballistic(
  frame: BurstFrame,
  t: number,
  spread: Vector3,
  velocity: Vector3,
  gravity: number,
  out: Droplet
) {
  out.x = frame.origin.x + spread.x + velocity.x * t;
  out.y = frame.origin.y + spread.y + velocity.y * t - 0.5 * gravity * t * t;
  out.z = frame.origin.z + spread.z + velocity.z * t;
}

const spread = new Vector3();
const velocity = new Vector3();

/** Chunks of dark plating thrown out of the break, tumbling down. */
function debris(slot: number, frame: BurstFrame, out: Droplet): Droplet {
  const t = frame.seconds - 0.12 * ((slotNoise(slot, 41) + 1) / 2);
  const life = DEBRIS_LIFE * (0.7 + 0.3 * slotNoise(slot, 42));
  spread.set(
    slotNoise(slot, 43) * 0.3,
    slotNoise(slot, 44) * 1.1,
    slotNoise(slot, 45) * frame.halfBeam * 0.8
  );
  velocity.set(
    slotNoise(slot, 46) * 2.4,
    1.6 + 3 * ((slotNoise(slot, 47) + 1) / 2),
    Math.sign(spread.z || 1) * (0.6 + 2 * ((slotNoise(slot, 48) + 1) / 2))
  );
  ballistic(frame, t, spread, velocity, GRAVITY, out);
  out.scale = 0.09 + 0.12 * ((slotNoise(slot, 49) + 1) / 2);
  out.alpha = t < 0 || t > life ? 0 : 1 - clamp((t - life + 0.5) / 0.5, 0, 1);
  return out;
}

/** Bright sparks off tearing steel: fast, short-lived, shrinking. */
function spark(slot: number, frame: BurstFrame, out: Droplet): Droplet {
  const t = frame.seconds - 0.25 * ((slotNoise(slot, 51) + 1) / 2);
  const life = SPARK_LIFE * (0.6 + 0.4 * ((slotNoise(slot, 52) + 1) / 2));
  spread.set(0, 0.4 + slotNoise(slot, 53) * 0.7, slotNoise(slot, 54) * 0.6);
  velocity.set(
    slotNoise(slot, 55) * 3.5,
    3 + 3.5 * ((slotNoise(slot, 56) + 1) / 2),
    slotNoise(slot, 57) * 4
  );
  ballistic(frame, t, spread, velocity, GRAVITY * 1.6, out);
  const age = clamp(t / life, 0, 1);
  out.scale = 0.07 * (1 - age);
  out.alpha = t < 0 || t > life ? 0 : 1 - age * age;
  return out;
}

/** White water: a spout thrown up at the surface, then a gush of bubbles. */
function water(slot: number, frame: BurstFrame, out: Droplet): Droplet {
  if (slot < SPRAY_COUNT) {
    const t = frame.seconds - 0.2 * ((slotNoise(slot, 61) + 1) / 2);
    spread.set(
      slotNoise(slot, 62) * 0.8,
      Math.max(0, -frame.origin.y),
      slotNoise(slot, 63) * frame.halfBeam
    );
    velocity.set(
      slotNoise(slot, 64) * 1.2,
      3 + 2.5 * ((slotNoise(slot, 65) + 1) / 2),
      slotNoise(slot, 66) * 1.6
    );
    ballistic(frame, t, spread, velocity, GRAVITY, out);
    const flying = t > 0 && t < SPRAY_LIFE && out.y > -0.1;
    out.scale = 0.16 + 0.1 * ((slotNoise(slot, 67) + 1) / 2);
    out.alpha = flying ? 0.85 * (1 - t / SPRAY_LIFE) : 0;
    return out;
  }
  const bubble = slot - SPRAY_COUNT;
  const t = frame.seconds - 1.4 * ((slotNoise(bubble, 71) + 1) / 2);
  const rise = Math.max(0, t) * (1 + 0.6 * ((slotNoise(bubble, 72) + 1) / 2));
  out.x = frame.origin.x + slotNoise(bubble, 73) * 0.6 + Math.sin(t * 5) * 0.08;
  out.y = frame.origin.y + slotNoise(bubble, 74) * 0.8 + rise;
  out.z = frame.origin.z + slotNoise(bubble, 75) * frame.halfBeam * 0.7;
  out.scale = 0.1 + 0.08 * ((slotNoise(bubble, 76) + 1) / 2);
  const isLive = t > 0 && t < BUBBLE_LIFE && out.y < 0;
  out.alpha = isLive ? 0.65 * Math.min(1, t / 0.15) * (1 - t / BUBBLE_LIFE) : 0;
  return out;
}

type Emitter = (slot: number, frame: BurstFrame, out: Droplet) => Droplet;

const breakPoint = new Vector3();
const bowPoint = new Vector3();
const sternPoint = new Vector3();
const matrixBow = new Matrix4();
const matrixStern = new Matrix4();

/**
 * The burst the moment she breaks: dark debris, a few orange sparks and a
 * gush of spray and bubbles at the break. Everything is a function of the
 * time since `breakup.at`, so a scrub or a replay shows the right moment.
 * It lives in the water, not in either half.
 */
export default function BreakBurst() {
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const halfBeam = useShipBuilderStore((s) => beamOf(s.ship) / 2);
  const reducedMotion = usePrefersReducedMotion();
  const droplet = useMemo(() => createDroplet(), []);
  const frame = useRef<BurstFrame>({
    seconds: -1,
    origin: new Vector3(),
    halfBeam,
  });
  const hasOrigin = useRef(false);

  /** Brings the shared frame up to date; false when there is no burst. */
  const refreshFrame = useCallback((): boolean => {
    const { breakup, halves, time } = trialPlayback;
    const seconds = breakup ? time - breakup.at : -1;
    if (!breakup || !halves || seconds < 0 || seconds > BURST_SECONDS) {
      // A later scrub back into the burst catches the break point afresh.
      hasOrigin.current = false;
      return false;
    }
    const current = frame.current;
    current.seconds = seconds;
    current.halfBeam = halfBeam;
    if (!hasOrigin.current || seconds <= CAPTURE_SECONDS) {
      // Midway between where each half now has its broken end.
      breakPoint.set(worldXOf(breakup.atX, lengthCells), 0, 0);
      bowPoint
        .copy(breakPoint)
        .applyMatrix4(halfMatrix(halves.bow, lengthCells, matrixBow));
      sternPoint
        .copy(breakPoint)
        .applyMatrix4(halfMatrix(halves.stern, lengthCells, matrixStern));
      current.origin.copy(bowPoint).add(sternPoint).multiplyScalar(0.5);
      hasOrigin.current = true;
    }
    return true;
  }, [halfBeam, lengthCells]);

  const fill = useCallback(
    (writer: ParticleWriter, emit: Emitter, count: number) => {
      if (!refreshFrame()) return 0;
      for (let slot = 0; slot < count; slot++) {
        emit(slot, frame.current, droplet);
        writer.set(
          slot,
          droplet.x,
          droplet.y,
          droplet.z,
          droplet.scale,
          droplet.alpha
        );
      }
      return count;
    },
    [droplet, refreshFrame]
  );

  const updateDebris = useCallback(
    (writer: ParticleWriter) => fill(writer, debris, DEBRIS_COUNT),
    [fill]
  );
  const updateSparks = useCallback(
    (writer: ParticleWriter) => fill(writer, spark, SPARK_COUNT),
    [fill]
  );
  const updateWater = useCallback(
    (writer: ParticleWriter) => fill(writer, water, WATER_COUNT),
    [fill]
  );

  if (reducedMotion) return null;
  return (
    <>
      <ParticleField
        capacity={DEBRIS_COUNT}
        color={DEBRIS_COLOR}
        update={updateDebris}
      />
      <ParticleField
        capacity={SPARK_COUNT}
        color={SPARK_COLOR}
        update={updateSparks}
      />
      <ParticleField
        capacity={WATER_COUNT}
        color={WATER_COLOR}
        update={updateWater}
      />
    </>
  );
}
