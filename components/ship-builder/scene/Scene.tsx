"use client";

import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import AttachMarkers from "./AttachMarkers";
import CameraRig from "./CameraRig";
import { shouldSwallowClick } from "./clickGuard";
import GhostPreview from "./GhostPreview";
import GridTargets from "./GridTargets";
import Hull from "./Hull";
import LongPressRing from "./LongPressRing";
import Ocean from "./Ocean";
import { PALETTE } from "./palette";
import ShipParts from "./ShipParts";
import { usePartLongPress } from "./usePartLongPress";

/** Water swallows distance faster than air, so the fog closes in. */
const UNDERWATER_FOG_NEAR = 40;
const UNDERWATER_FOG_FAR = 200;

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
  const select = useShipBuilderStore((s) => s.select);
  const isBelow = useShipBuilderStore((s) => s.camera.view === "below");
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
        {/* Both themes share one scene, so the sky and the water are the same
            colours in light and dark mode. Seen from below, the ship must sit
            in water rather than sky. */}
        <color
          attach="background"
          args={[isBelow ? PALETTE.underwater : PALETTE.sky]}
        />
        <fog
          attach="fog"
          args={
            isBelow
              ? [PALETTE.underwater, UNDERWATER_FOG_NEAR, UNDERWATER_FOG_FAR]
              : [PALETTE.sky, 80, 260]
          }
        />
        {!isBelow && <Sky sunPosition={[100, 40, 80]} distance={450} />}
        <ambientLight intensity={0.55} />
        {/* The default ±5 shadow frustum clips anything past a few cells; this
            covers the longest hull (36 cells) from the light's angle. */}
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.4}
          castShadow
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
          shadow-camera-far={150}
          shadow-mapSize={[2048, 2048]}
        />
        <Ocean seeThrough={isBelow} />
        <Hull lengthCells={lengthCells} beam={beam} />
        <ShipParts onPartPress={startPress} />
        <GridTargets />
        <AttachMarkers />
        <GhostPreview />
        <CameraRig />
      </Canvas>
      {ring && <LongPressRing key={ring.key} x={ring.x} y={ring.y} />}
    </div>
  );
}
