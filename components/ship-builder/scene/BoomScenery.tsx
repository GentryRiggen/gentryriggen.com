"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, PointLight } from "three";
import { buildOccupancy } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import { piecesOf, type BlastPiece } from "@/lib/ship-builder/sim/blast";
import { BOMB_FALL_S } from "@/lib/ship-builder/sim/bombs";
import { carrierOf, type BodyPose } from "@/lib/ship-builder/sim/funnelFall";
import { stateAt } from "@/lib/ship-builder/sim/timeline";
import type { BombHit, TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { clamp } from "./animationMath";
import { MineBlast, ThrownPart } from "./StrikeScenery";
import { trialPlayback } from "./trialPlayback";
import { trialTimelineFor } from "./trialTimeline";

const BOMB_BODY = "#1f2329";
const BOMB_CAP = "#6b7280";
const FUSE = "#f59e0b";
const FIRE_COLOR = "#ff7a1a";
/** How high above the spot a bomb starts its fall (world units). */
const DROP_HEIGHT = 14;
/** A blast is drawn from its fall until its smoke has cleared (sim seconds). */
const BLAST_LIFE_S = 9;
/** Below this height a blast throws up sea water too. */
const WATERLINE_BLAST_Y = 1.2;
/** Most blasts drawn at once; the oldest give way. */
const MAX_LIVE_BLASTS = 6;

/** A cartoon bomb: a round black body, a cap and a lit fuse. */
function BombShape() {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color={BOMB_BODY} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.18, 10]} />
        <meshStandardMaterial color={BOMB_CAP} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshBasicMaterial color={FUSE} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** One bomb falling on to its spot, seen only while it falls. */
function FallingBomb({ bomb }: { bomb: BombHit }) {
  const group = useRef<Group>(null);
  const point = bomb.point;
  useFrame(() => {
    const target = group.current;
    if (!target || !point) return;
    const left = bomb.at - trialPlayback.time;
    const isFalling = left > 0 && left <= BOMB_FALL_S;
    target.visible = isFalling;
    if (!isFalling) return;
    // Falls faster and faster: the last stretch is quick.
    const t = 1 - left / BOMB_FALL_S;
    target.position.set(point.x, point.y + DROP_HEIGHT * (1 - t * t), point.z);
    target.rotation.set(0.3, 0, 0.4 * t);
  });
  return (
    <group ref={group} visible={false}>
      <BombShape />
    </group>
  );
}

/** Indices of the bombs whose blast is on show at `time`, newest last. */
function liveBlastsAt(bombs: readonly BombHit[], time: number): number[] {
  const live: number[] = [];
  bombs.forEach((bomb, index) => {
    const since = time - bomb.at;
    if (since >= -BOMB_FALL_S && since < BLAST_LIFE_S) live.push(index);
  });
  return live.slice(-MAX_LIVE_BLASTS);
}

/**
 * One light for every blast (a light per blast would change the scene's
 * light count, and with it every material, each time a bomb went off): it
 * flares at whichever bomb went off last.
 */
function BlastLight({ bombs }: { bombs: readonly BombHit[] }) {
  const light = useRef<PointLight>(null);
  useFrame(() => {
    const target = light.current;
    if (!target) return;
    const time = trialPlayback.time;
    let latest: BombHit | null = null;
    for (const bomb of bombs) if (bomb.at <= time) latest = bomb;
    const seconds = latest ? time - latest.at : Infinity;
    const fade = clamp(1 - (seconds - 0.15) / 1, 0, 1);
    target.intensity = latest && seconds < 1.2 ? 140 * fade : 0;
    if (latest?.point) {
      target.position.set(latest.point.x, latest.point.y + 1, latest.point.z);
    }
  });
  return (
    <pointLight
      ref={light}
      color={FIRE_COLOR}
      intensity={0}
      distance={45}
      decay={1.5}
    />
  );
}

interface Thrown {
  key: string;
  bomb: BombHit;
  piece: BlastPiece;
  slot: number;
  carrier: BodyPose;
}

/** Every part the bombs blow off, with the ship's pose as each goes. */
function thrownOf(
  input: TrialInput,
  ship: Ship,
  descending: boolean
): Thrown[] {
  const bombs = input.boom?.bombs ?? [];
  if (bombs.length === 0) return [];
  const timeline = trialTimelineFor(input, descending);
  const occupancy = buildOccupancy(ship);
  const thrown: Thrown[] = [];
  bombs.forEach((bomb) => {
    const state = stateAt(timeline, bomb.at);
    for (const piece of piecesOf(ship, new Set(bomb.thrown), occupancy)) {
      thrown.push({
        key: piece.partId,
        bomb,
        piece,
        slot: thrown.length,
        carrier: carrierOf(state, piece.x),
      });
    }
  });
  return thrown;
}

/** Bombs falling, their blasts, and the parts they blow off the ship. */
function BoomTrial({
  input,
  descending,
}: {
  input: TrialInput;
  descending: boolean;
}) {
  const ship = useShipBuilderStore((s) => s.ship);
  const reducedMotion = usePrefersReducedMotion();
  const bombs = useMemo(() => input.boom?.bombs ?? [], [input]);
  const thrown = useMemo(
    () => thrownOf(input, ship, descending),
    [input, ship, descending]
  );
  const parts = useMemo(
    () => new Map(ship.parts.map((part) => [part.id, part])),
    [ship]
  );
  const [live, setLive] = useState<string>("");
  // Re-render only when the set of blasts on show changes, not every frame.
  useFrame(() => {
    const next = liveBlastsAt(bombs, trialPlayback.time).join(",");
    if (next !== live) setLive(next);
  });
  const liveIndices = live === "" ? [] : live.split(",").map(Number);
  return (
    <>
      <BlastLight bombs={bombs} />
      {bombs.map((bomb, index) => (
        <FallingBomb key={`fall-${index}-${bomb.at}`} bomb={bomb} />
      ))}
      {!reducedMotion &&
        liveIndices.map((index) => {
          const bomb = bombs[index];
          if (!bomb?.point) return null;
          return (
            <MineBlast
              key={`blast-${index}-${bomb.at}`}
              origin={bomb.point}
              at={bomb.at}
              hasWater={bomb.point.y < WATERLINE_BLAST_Y}
              hasLight={false}
            />
          );
        })}
      {thrown.map(({ key, bomb, piece, slot, carrier }) => {
        const part = parts.get(piece.partId);
        if (!part || !bomb.point) return null;
        return (
          <ThrownPart
            key={key}
            ship={ship}
            part={part}
            piece={piece}
            slot={slot}
            origin={bomb.point}
            at={bomb.at}
            carrier={carrier}
          />
        );
      })}
    </>
  );
}

/**
 * Boom!'s scenery: lives in the water, not in the ship, like `StrikeScenery`.
 * Mounted from the moment the player starts aiming, so the shared blast light
 * is in the scene before the first bomb goes off.
 */
export default function BoomScenery() {
  const trial = useShipBuilderStore((s) => s.trial);
  if (trial.status === "aiming" && trial.kind === "boom") {
    return <BlastLight bombs={[]} />;
  }
  if (trial.status !== "running" && trial.status !== "result") return null;
  if (!trial.input.boom) return null;
  return <BoomTrial input={trial.input} descending={trial.descending} />;
}
