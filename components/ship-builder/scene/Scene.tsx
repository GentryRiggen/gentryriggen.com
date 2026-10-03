"use client";

import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import AttachMarkers from "./AttachMarkers";
import CameraRig from "./CameraRig";
import GhostPreview from "./GhostPreview";
import GridTargets from "./GridTargets";
import Hull from "./Hull";
import Ocean from "./Ocean";
import { PALETTE } from "./palette";
import ShipParts from "./ShipParts";

export default function Scene() {
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const select = useShipBuilderStore((s) => s.select);

  return (
    <div
      data-testid="ship-canvas"
      role="img"
      aria-label="3D view of your ship"
      className="h-full w-full"
    >
      <Canvas
        shadows="percentage"
        camera={{ position: [24, 16, 24], fov: 45 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[PALETTE.sky]} />
        <fog attach="fog" args={[PALETTE.sky, 80, 260]} />
        <Sky sunPosition={[100, 40, 80]} distance={450} />
        <ambientLight intensity={0.55} />
        {/* The default ±5 shadow frustum clips anything past a few cells; this
            covers the longest hull (36 cells) from the light's angle. */}
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.4}
          castShadow
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
          shadow-camera-far={150}
          shadow-mapSize={[2048, 2048]}
        />
        <Ocean />
        <Hull lengthCells={lengthCells} />
        <ShipParts />
        <GridTargets />
        <AttachMarkers />
        <GhostPreview />
        <CameraRig />
      </Canvas>
    </div>
  );
}
