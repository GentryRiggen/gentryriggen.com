"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, PointLight } from "three";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { blastPiecesOf, type BlastPiece } from "@/lib/ship-builder/sim/blast";
import { ICEBERG_IMPACT_S } from "@/lib/ship-builder/sim/flooding";
import { strikeOf } from "@/lib/ship-builder/sim/strike";
import type { IcebergInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { clamp } from "./animationMath";
import { modelToWorld } from "./coords";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import PartMesh from "./PartMesh";
import { slotNoise } from "./particles";
import { IslandShape, MineShape } from "./strikeModels";
import {
  approachLeft,
  blastPiecePose,
  isMineGone,
  strikeRest,
  TRIAL_ISLAND_RADIUS,
  type PiecePose,
} from "./strikeMotion";
import { trialPlayback } from "./trialPlayback";

/** The island's look in a trial: a fixed seed, so it never changes. */
const ISLAND_SEED = 417;

const FLASH_COLOR = "#ffd27a";
const FIRE_COLOR = "#ff7a1a";
const SMOKE_COLOR = "#4b4f57";
const WATER_COLOR = "#eef8ff";
const CHUNK_COLOR = "#2a2d33";

const WATER_COUNT = 70;
const FIRE_COUNT = 28;
const SMOKE_COUNT = 36;
const CHUNK_COUNT = 30;
/** Everything but the smoke is over this long after the blast. */
const BLAST_SECONDS = 4;
const SMOKE_SECONDS = 9;
const GRAVITY = 9.8;

interface StrikeBodyProps {
  iceberg: IcebergInput;
  length: number;
  beam: number;
}

/** The island she runs onto: closes in as she sails, then holds her fast. */
function IslandBody({ iceberg, length, beam }: StrikeBodyProps) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const rest = strikeRest("island", iceberg.impactX, length, beam);
  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const left = reducedMotion ? 0 : approachLeft(trialPlayback.time);
    target.position.set(
      rest.x + rest.awayX * left,
      0,
      rest.z + rest.awayZ * left
    );
  });
  return (
    <group ref={group} position={[rest.x, 0, rest.z]}>
      <IslandShape radius={TRIAL_ISLAND_RADIUS} seed={ISLAND_SEED} />
    </group>
  );
}

/** The mine drifting onto her, gone the moment it goes off. */
function MineBody({ iceberg, length, beam }: StrikeBodyProps) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const rest = strikeRest("mine", iceberg.impactX, length, beam);
  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const time = trialPlayback.time;
    target.visible = !isMineGone(time);
    const left = reducedMotion ? 0 : approachLeft(time);
    target.position.set(
      rest.x + rest.awayX * left,
      0,
      rest.z + rest.awayZ * left
    );
  });
  return (
    <group ref={group} position={[rest.x, 0, rest.z]}>
      <MineShape />
    </group>
  );
}

interface BlastFrame {
  seconds: number;
  x: number;
  z: number;
}

/** The fireball and its light: a bright flash that swells and fades fast. */
function Fireball({ origin }: { origin: { x: number; z: number } }) {
  const ball = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const light = useRef<PointLight>(null);
  useFrame(() => {
    const seconds = trialPlayback.time - ICEBERG_IMPACT_S;
    const live = seconds >= 0 && seconds < 1.2;
    const grow = clamp(seconds / 0.25, 0, 1);
    const fade = clamp(1 - (seconds - 0.15) / 1, 0, 1);
    if (ball.current) {
      ball.current.visible = live;
      ball.current.scale.setScalar(0.5 + 3.2 * grow);
    }
    if (material.current) material.current.opacity = 0.9 * fade;
    if (light.current) light.current.intensity = live ? 120 * fade : 0;
  });
  return (
    <group position={[origin.x, 0.6, origin.z]}>
      <mesh ref={ball} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          ref={material}
          color={FLASH_COLOR}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={light}
        color={FIRE_COLOR}
        intensity={0}
        distance={40}
        decay={1.5}
      />
    </group>
  );
}

/** A tall column of white water thrown up by the blast, falling back. */
function water(slot: number, f: BlastFrame, w: ParticleWriter) {
  const t = f.seconds - 0.05 * ((slotNoise(slot, 1) + 1) / 2);
  const life = 2.6;
  const vy = 7 + 7 * ((slotNoise(slot, 2) + 1) / 2);
  const spreadX = slotNoise(slot, 3) * 1.6;
  const spreadZ = slotNoise(slot, 4) * 1.6;
  const y = vy * t - 0.5 * GRAVITY * t * t;
  const live = t > 0 && t < life && y > -0.2;
  w.set(
    slot,
    f.x + spreadX * (0.4 + t),
    Math.max(0, y),
    f.z + spreadZ * (0.4 + t),
    0.35 + 0.35 * ((slotNoise(slot, 5) + 1) / 2),
    live ? 0.9 * (1 - t / life) : 0
  );
}

/** Orange fire and sparks flung out fast. */
function fire(slot: number, f: BlastFrame, w: ParticleWriter) {
  const t = f.seconds;
  const life = 0.9 * (0.6 + 0.4 * ((slotNoise(slot, 11) + 1) / 2));
  const vx = slotNoise(slot, 12) * 7;
  const vy = 4 + 6 * ((slotNoise(slot, 13) + 1) / 2);
  const vz = slotNoise(slot, 14) * 7;
  const age = clamp(t / life, 0, 1);
  w.set(
    slot,
    f.x + vx * t,
    0.5 + vy * t - 0.5 * GRAVITY * t * t,
    f.z + vz * t,
    0.35 * (1 - age) + 0.05,
    t > 0 && t < life ? 1 - age * age : 0
  );
}

/** A dark plume of smoke that rises, spreads and thins out. */
function smoke(slot: number, f: BlastFrame, w: ParticleWriter) {
  const t = f.seconds - 0.25 * ((slotNoise(slot, 21) + 1) / 2);
  const life = SMOKE_SECONDS * (0.6 + 0.4 * ((slotNoise(slot, 22) + 1) / 2));
  const age = clamp(t / life, 0, 1);
  w.set(
    slot,
    f.x + slotNoise(slot, 23) * (0.5 + t * 0.6),
    1 + t * (1.4 + 0.8 * ((slotNoise(slot, 24) + 1) / 2)),
    f.z + slotNoise(slot, 25) * (0.5 + t * 0.6),
    0.8 + age * 2.6,
    t > 0 && t < life ? 0.55 * Math.min(1, t / 0.3) * (1 - age) : 0
  );
}

/** Chunks of plating thrown high, tumbling down into the sea. */
function chunk(slot: number, f: BlastFrame, w: ParticleWriter) {
  const t = f.seconds;
  const vx = slotNoise(slot, 31) * 5;
  const vy = 5 + 7 * ((slotNoise(slot, 32) + 1) / 2);
  const vz = slotNoise(slot, 33) * 5;
  const y = 0.6 + vy * t - 0.5 * GRAVITY * t * t;
  w.set(
    slot,
    f.x + vx * t,
    y,
    f.z + vz * t,
    0.12 + 0.14 * ((slotNoise(slot, 34) + 1) / 2),
    t > 0 && y > -0.3 ? 1 : 0
  );
}

type Emitter = (slot: number, f: BlastFrame, w: ParticleWriter) => void;

/** The blast itself: fireball, water column, fire, smoke and chunks. */
function MineBlast({ origin }: { origin: { x: number; z: number } }) {
  const frame = useRef<BlastFrame>({ seconds: -1, x: origin.x, z: origin.z });
  const fill = useCallback(
    (writer: ParticleWriter, emit: Emitter, count: number, seconds: number) => {
      const since = trialPlayback.time - ICEBERG_IMPACT_S;
      if (since < 0 || since > seconds) return 0;
      const current = frame.current;
      current.seconds = since;
      current.x = origin.x;
      current.z = origin.z;
      for (let slot = 0; slot < count; slot++) emit(slot, current, writer);
      return count;
    },
    [origin.x, origin.z]
  );
  const updateWater = useCallback(
    (w: ParticleWriter) => fill(w, water, WATER_COUNT, BLAST_SECONDS),
    [fill]
  );
  const updateFire = useCallback(
    (w: ParticleWriter) => fill(w, fire, FIRE_COUNT, BLAST_SECONDS),
    [fill]
  );
  const updateSmoke = useCallback(
    (w: ParticleWriter) => fill(w, smoke, SMOKE_COUNT, SMOKE_SECONDS),
    [fill]
  );
  const updateChunks = useCallback(
    (w: ParticleWriter) => fill(w, chunk, CHUNK_COUNT, BLAST_SECONDS),
    [fill]
  );
  return (
    <>
      <Fireball origin={origin} />
      <ParticleField
        capacity={SMOKE_COUNT}
        color={SMOKE_COLOR}
        update={updateSmoke}
      />
      <ParticleField
        capacity={WATER_COUNT}
        color={WATER_COLOR}
        update={updateWater}
      />
      <ParticleField
        capacity={FIRE_COUNT}
        color={FIRE_COLOR}
        update={updateFire}
      />
      <ParticleField
        capacity={CHUNK_COUNT}
        color={CHUNK_COLOR}
        update={updateChunks}
      />
    </>
  );
}

interface ThrownPartProps {
  ship: Ship;
  part: PlacedPart;
  piece: BlastPiece;
  slot: number;
  origin: { x: number; z: number };
}

/**
 * One part's thrown twin, in the water's frame. Mounted for the whole trial
 * but hidden until the blast; the ship hides the real one from the same
 * moment (`ShipParts`), so scrubbing back puts it back on board.
 */
function ThrownPart({ ship, part, piece, slot, origin }: ThrownPartProps) {
  const group = useRef<Group>(null);
  const from = useMemo(() => {
    const [x, y, z] = modelToWorld(gridLength(ship), beamOf(ship), {
      x: piece.x,
      y: piece.level,
      z: piece.z,
    });
    return { x, y, z };
  }, [ship, piece]);
  const pose = useMemo<PiecePose>(
    () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, visible: false }),
    []
  );
  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const seconds = trialPlayback.time - ICEBERG_IMPACT_S;
    if (seconds < 0) {
      target.visible = false;
      return;
    }
    blastPiecePose(slot, from, origin.x, origin.z, seconds, pose);
    target.visible = pose.visible;
    target.position.set(pose.x, pose.y, pose.z);
    target.rotation.set(pose.rx, pose.ry, pose.rz);
  });
  return (
    <group ref={group} visible={false}>
      {/* The part draws itself at its place on the ship; undo that. */}
      <group position={[-from.x, -from.y, -from.z]}>
        <PartMesh ship={ship} part={part} color={part.color} mark={part.mark} />
      </group>
    </group>
  );
}

/** Everything a sea mine does to her that the sim does not draw. */
function MineStrike({ iceberg, length, beam }: StrikeBodyProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const reducedMotion = usePrefersReducedMotion();
  const rest = strikeRest("mine", iceberg.impactX, length, beam);
  const origin = useMemo(() => ({ x: rest.x, z: rest.z }), [rest.x, rest.z]);
  const thrown = useMemo(() => {
    const byId = new Map(ship.parts.map((part) => [part.id, part]));
    return blastPiecesOf(ship, iceberg.impactX).flatMap((piece) => {
      const part = byId.get(piece.partId);
      return part ? [{ piece, part }] : [];
    });
  }, [ship, iceberg.impactX]);
  return (
    <>
      <MineBody iceberg={iceberg} length={length} beam={beam} />
      {!reducedMotion && <MineBlast origin={origin} />}
      {thrown.map(({ piece, part }, slot) => (
        <ThrownPart
          key={part.id}
          ship={ship}
          part={part}
          piece={piece}
          slot={slot}
          origin={origin}
        />
      ))}
    </>
  );
}

/**
 * The mine or island of a trial started by a hit while driving (an iceberg
 * hit draws its berg in `Iceberg`). Lives in the water, not in the ship.
 */
export default function StrikeScenery() {
  const iceberg = useShipBuilderStore((s) =>
    s.trial.status === "running" || s.trial.status === "result"
      ? s.trial.input.iceberg
      : undefined
  );
  const length = useShipBuilderStore((s) => gridLength(s.ship));
  const beam = useShipBuilderStore((s) => beamOf(s.ship));
  const strike = strikeOf(iceberg);
  if (!iceberg || strike === "iceberg") return null;
  if (strike === "island") {
    return <IslandBody iceberg={iceberg} length={length} beam={beam} />;
  }
  return <MineStrike iceberg={iceberg} length={length} beam={beam} />;
}
