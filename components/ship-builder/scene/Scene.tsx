"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import AttachMarkers from "./AttachMarkers";
import CameraRig from "./CameraRig";
import DescentParticles from "./DescentParticles";
import useSeaState from "../hooks/useSeaState";
import useTimeOfDay from "../hooks/useTimeOfDay";
import { shouldSwallowClick } from "./clickGuard";
import GhostPreview from "./GhostPreview";
import GridTargets from "./GridTargets";
import Environment from "./Environment";
import { createGlowController } from "./GlowContext";
import PoweredGlow from "./PoweredGlow";
import { glowFor } from "./timeOfDay";
import { environmentFor } from "./environmentModel";
import { toRuntimeEnvironment } from "./environmentRuntime";
import Hull from "./Hull";
import HullGash from "./HullGash";
import Iceberg from "./Iceberg";
import LongPressRing from "./LongPressRing";
import Ocean from "./Ocean";
import PostEffects from "./PostEffects";
import Railings from "./Railings";
import ReflectionEnvironment from "./ReflectionEnvironment";
import RenderInfoProbe from "./RenderInfoProbe";
import SeaFloor from "./SeaFloor";
import SeaTrialEffects from "./SeaTrialEffects";
import SeaTrialRunner from "./SeaTrialRunner";
import ShipAnimation from "./ShipAnimation";
import ShipParts from "./ShipParts";
import TrialSound from "../audio/TrialSound";
import UnderwaterFog from "./UnderwaterFog";
import { usePartLongPress } from "./usePartLongPress";

/**
 * iOS Safari starts its own UI during a press-and-hold (callout, selection,
 * drag preview) and then cancels the pointer, which would abort a hold-to-
 * delete. Cancelling these events keeps the hold alive. `touchstart` is left
 * alone on purpose: preventing it would suppress the click R3F needs for taps.
 */
const NATIVE_HOLD_EVENTS = ["contextmenu", "selectstart", "dragstart"] as const;

function preventDefault(event: Event) {
  event.preventDefault();
}

export default function Scene() {
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const beam = useShipBuilderStore((s) => beamOf(s.ship));
  const bow = useShipBuilderStore((s) => s.ship.hull.bow);
  const stern = useShipBuilderStore((s) => s.ship.hull.stern);
  const paint = useShipBuilderStore((s) => s.ship.hull.paint);
  const select = useShipBuilderStore((s) => s.select);
  const isBelow = useShipBuilderStore((s) => s.camera.view === "below");
  const { seaState } = useSeaState();
  const { timeOfDay } = useTimeOfDay();
  // Built once from the first look; Environment eases it from there.
  const [environment] = useState(() =>
    toRuntimeEnvironment(environmentFor(timeOfDay, seaState))
  );
  const [glow] = useState(() => createGlowController(glowFor(timeOfDay)));
  const wrapper = useRef<HTMLDivElement>(null);
  const { ring, startPress } = usePartLongPress(wrapper);

  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    for (const type of NATIVE_HOLD_EVENTS) {
      element.addEventListener(type, preventDefault);
    }
    return () => {
      for (const type of NATIVE_HOLD_EVENTS) {
        element.removeEventListener(type, preventDefault);
      }
    };
  }, []);

  return (
    // The canvas owns every touch gesture (orbit, pinch, pan, hold), so the
    // browser must not scroll, zoom, select text or open its callout menu.
    <div
      ref={wrapper}
      data-testid="ship-canvas"
      role="img"
      aria-label="3D view of your ship"
      className="relative h-full w-full touch-none select-none [-webkit-touch-callout:none]"
    >
      <Canvas
        shadows="percentage"
        camera={{ position: [24, 16, 24], fov: 45 }}
        onPointerMissed={() => {
          // A hold that deleted the last part under the pointer releases onto
          // empty water; that click must not drop a pending removal.
          if (shouldSwallowClick()) return;
          select(null);
        }}
      >
        <Environment
          current={environment}
          timeOfDay={timeOfDay}
          seaState={seaState}
          isBelow={isBelow}
          glow={glow}
        />
        <ReflectionEnvironment timeOfDay={timeOfDay} />
        <Ocean seeThrough={isBelow} environment={environment} />
        <ShipAnimation>
          <PoweredGlow glow={glow}>
            {(powered) => (
              <>
                <Hull
                  lengthCells={lengthCells}
                  beam={beam}
                  bow={bow}
                  stern={stern}
                  paint={paint}
                />
                <ShipParts glow={powered} onPartPress={startPress} />
              </>
            )}
          </PoweredGlow>
          <HullGash />
          <Railings />
          <GridTargets />
          <AttachMarkers />
          <GhostPreview />
        </ShipAnimation>
        <Iceberg />
        <SeaTrialRunner />
        <SeaTrialEffects />
        <TrialSound />
        <SeaFloor />
        <DescentParticles />
        <UnderwaterFog />
        <CameraRig />
        <PostEffects environment={environment} />
        <RenderInfoProbe />
      </Canvas>
      {ring && <LongPressRing key={ring.key} x={ring.x} y={ring.y} />}
    </div>
  );
}
