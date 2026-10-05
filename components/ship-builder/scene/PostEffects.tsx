"use client";

import { useRef, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { Color } from "three";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { testAoOverride } from "./testClock";

/**
 * Soft, toy-like contact shadows: a wide, gentle radius and a modest
 * intensity, tinted by the time of day so they never go black. Half
 * resolution keeps the cost low; the depth-aware upsample keeps edges clean.
 */
const AO_RADIUS = 1.4;
const AO_INTENSITY = 3;
const AO_DISTANCE_FALLOFF = 1.2;

/** The part of N8AO's pass we write to (the package ships no typings). */
interface OcclusionPass {
  configuration: { color: Color };
}

interface PostEffectsProps {
  /** The live look; the occlusion tint follows its eased colour. */
  environment: RuntimeEnvironment;
}

/**
 * Ambient occlusion over the scene. A struggling device (drei's
 * `PerformanceMonitor` reports a decline) turns it off for the rest of the
 * session; with it off the scene renders straight to the canvas as before.
 * Tests can force it either way with `__SHIP_BUILDER_TEST__.ao`, which also
 * stops the monitor, so a slow software renderer cannot change a screenshot.
 */
export default function PostEffects({ environment }: PostEffectsProps) {
  const forced = testAoOverride();
  const [hasDeclined, setHasDeclined] = useState(false);
  const isEnabled = forced ?? !hasDeclined;
  const occlusion = useRef<OcclusionPass>(null);

  useFrame(() => {
    // Written in place: the pass reads the colour each frame, so no rebuild.
    occlusion.current?.configuration.color.copy(environment.colors.aoColor);
  });

  return (
    <>
      {forced === null && (
        <PerformanceMonitor onDecline={() => setHasDeclined(true)} />
      )}
      {isEnabled && (
        <EffectComposer multisampling={0}>
          <N8AO
            ref={occlusion}
            halfRes
            quality="performance"
            aoRadius={AO_RADIUS}
            intensity={AO_INTENSITY}
            distanceFalloff={AO_DISTANCE_FALLOFF}
          />
          {/* The composer draws to buffers, which skip the renderer's own tone
              mapping; this repeats it (same curve) so colours match AO off. */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}
