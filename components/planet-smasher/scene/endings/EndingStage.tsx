"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Material } from "three";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  FlashSprite,
  clamp01,
  rand,
  stepDt,
  useDispose,
  useLatest,
  useParticles,
} from "../effects/particles";
import { playCue, type Cue } from "../../audio/sfx";
import Molten from "./Molten";
import Shatter from "./Shatter";
import Swallowed from "./Swallowed";
import { planetFx, resetPlanetFx } from "./planetFx";

const GROW_SECONDS = 0.8;

const ENDING_CUES: Record<string, Cue> = {
  shatter: "endShatter",
  molten: "endMolten",
  frozen: "endFrozen",
  swallowed: "endSwallowed",
};

/** A new planet pops in from nothing with a puff of sparkles. */
function GrowIn({ onDone }: { onDone(): void }) {
  const cb = useLatest({ onDone });
  const run = useRef({ age: 0, done: false, burst: false });
  const flash = useMemo(() => new FlashSprite(0xfff2c0), []);
  useDispose(flash);
  const sys = useParticles(80);
  const origin = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    r.age += stepDt(rawDt);
    const k = clamp01(r.age / GROW_SECONDS);
    // Ease out with a little overshoot.
    const c = 1.9;
    planetFx.scale = Math.max(0, 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2);
    flash.set(origin, 3.2, 0.9 * (1 - k));
    if (!r.burst) {
      r.burst = true;
      for (let i = 0; i < 70; i++) {
        dir.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        sys.emit({
          x: dir.x,
          y: dir.y,
          z: dir.z,
          vx: dir.x * rand(0.4, 1.2),
          vy: dir.y * rand(0.4, 1.2),
          vz: dir.z * rand(0.4, 1.2),
          life: rand(0.6, 1.1),
          size: rand(0.03, 0.06),
          endSize: 0.01,
          color: [1, 0.95, 0.6],
          endColor: [1, 0.7, 0.3],
          drag: 0.4,
        });
      }
    }
    if (k >= 1 && !r.done) {
      r.done = true;
      planetFx.scale = 1;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <primitive object={flash.sprite} />
      <primitive object={sys.points} />
    </>
  );
}

interface EndingStageProps {
  /** The planet's material (the shatter chunks share it). */
  material: Material;
}

/**
 * Plays the ending the store chose when the phase becomes "ending", calls
 * endingShown() when it is over, and leaves its final state (a lava ball, or
 * nothing) up while the phase is "ended". Starting a new planet brings the
 * globe back.
 */
export default function EndingStage({ material }: EndingStageProps) {
  const phase = useGameStore((s) => s.phase);
  const ending = useGameStore((s) => s.ending);
  // Coming back to "playing" from "ended" grows the new globe in.
  const [prevPhase, setPrevPhase] = useState(phase);
  const [grow, setGrow] = useState(false);
  if (phase !== prevPhase) {
    setPrevPhase(phase);
    setGrow(phase === "playing" && prevPhase === "ended");
  }

  useLayoutEffect(() => {
    if (phase !== "playing") return;
    resetPlanetFx();
    if (grow) planetFx.scale = 0;
  }, [phase, grow]);

  // The ending's sound starts with the ending (and cuts the laser hum).
  useEffect(() => {
    if (phase !== "ending" || !ending) return;
    playCue("zapStop");
    playCue(ENDING_CUES[ending]);
  }, [phase, ending]);

  const shown = () => useGameStore.getState().endingShown();
  const active = phase !== "playing" && ending;

  return (
    <>
      {active === "shatter" && (
        <Shatter key="shatter" material={material} onDone={shown} />
      )}
      {active === "frozen" && (
        <Shatter key="frozen" frozen material={material} onDone={shown} />
      )}
      {active === "molten" && <Molten key="molten" onDone={shown} />}
      {active === "swallowed" && <Swallowed key="swallowed" onDone={shown} />}
      {grow && phase === "playing" && <GrowIn onDone={() => setGrow(false)} />}
    </>
  );
}
