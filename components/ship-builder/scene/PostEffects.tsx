"use client";

import { useEffect, useRef, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import { ClearPass, EffectComposer, RenderPass } from "postprocessing";
import {
  Color,
  MultiplyBlending,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
} from "three";
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

/** Runs after the scene's own frame updates (priority 0) and its render. */
const OCCLUSION_PRIORITY = 1;

interface PostEffectsProps {
  /** The live look; the occlusion tint follows its eased colour. */
  environment: RuntimeEnvironment;
}

interface OcclusionLayerProps {
  environment: RuntimeEnvironment;
}

/**
 * The occlusion shading, laid over a frame the renderer has already drawn.
 *
 * The scene is rendered straight to the canvas exactly as with AO off (the
 * renderer's own per-material tone mapping, so the sky, clouds, stars and
 * night glows, which opt out with `toneMapped = false`, look the same). An
 * effect composer cannot do that: it draws into buffers, where three skips
 * tone mapping, so a composer ToneMapping step would grade the unlit sky and
 * glows too. Instead the composer starts from plain white, N8AO turns that
 * into a white-to-tint occlusion factor, and the factor is multiplied onto the
 * canvas. Multiplying the sRGB-encoded factor onto the sRGB frame equals
 * multiplying linear light, so shading strength is unchanged.
 */
function OcclusionLayer({ environment }: OcclusionLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const composerRef = useRef<EffectComposer | null>(null);
  const passRef = useRef<N8AOPostPass | null>(null);
  const sizeRef = useRef({ width: -1, height: -1, pixelRatio: -1 });
  const sizeScratch = useRef(new Vector2());

  useEffect(() => {
    // Only depth and the white clear matter here, so 8-bit buffers are plenty.
    const composer = new EffectComposer(gl, {
      multisampling: 0,
      frameBufferType: UnsignedByteType,
    });
    // N8AO reads the composer's depth, so the scene is drawn once into it;
    // the colour is then wiped to white, keeping the depth.
    const depth = new RenderPass(scene, camera);
    const white = new ClearPass(true, false, false);
    white.overrideClearColor = new Color(1, 1, 1);
    white.overrideClearAlpha = 1;
    const occlusion = new N8AOPostPass(scene, camera);
    occlusion.setQualityMode("Performance");
    occlusion.configuration.halfRes = true;
    occlusion.configuration.aoRadius = AO_RADIUS;
    occlusion.configuration.intensity = AO_INTENSITY;
    occlusion.configuration.distanceFalloff = AO_DISTANCE_FALLOFF;
    // The pass writes to the canvas last; multiply instead of replacing.
    const blit = occlusion.copyQuad.material as ShaderMaterial;
    blit.blending = MultiplyBlending;
    blit.premultipliedAlpha = true;
    composer.addPass(depth);
    composer.addPass(white);
    composer.addPass(occlusion);
    composerRef.current = composer;
    passRef.current = occlusion;
    sizeRef.current = { width: -1, height: -1, pixelRatio: -1 };
    return () => {
      composerRef.current = null;
      passRef.current = null;
      composer.dispose();
    };
  }, [gl, scene, camera]);

  useFrame((state, delta) => {
    const { gl: renderer } = state;
    const composer = composerRef.current;
    const occlusion = passRef.current;
    // Take over the frame: the same plain render R3F does when AO is off.
    renderer.render(scene, camera);
    if (!composer || !occlusion) return;

    // Written in place: the pass reads the colour each frame, so no rebuild.
    occlusion.configuration.color.copy(environment.colors.aoColor);

    const size = renderer.getSize(sizeScratch.current);
    const pixelRatio = renderer.getPixelRatio();
    const applied = sizeRef.current;
    if (
      size.x !== applied.width ||
      size.y !== applied.height ||
      pixelRatio !== applied.pixelRatio
    ) {
      composer.setSize(size.x, size.y);
      sizeRef.current = {
        width: size.x,
        height: size.y,
        pixelRatio,
      };
    }
    const wasAutoClear = renderer.autoClear;
    const wasShadowUpdate = renderer.shadowMap.autoUpdate;
    renderer.autoClear = false;
    // The shadow maps were just drawn by the render above; skip a repeat.
    renderer.shadowMap.autoUpdate = false;
    composer.render(delta);
    renderer.shadowMap.autoUpdate = wasShadowUpdate;
    renderer.autoClear = wasAutoClear;
  }, OCCLUSION_PRIORITY);

  return null;
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

  return (
    <>
      {forced === null && (
        <PerformanceMonitor onDecline={() => setHasDeclined(true)} />
      )}
      {isEnabled && <OcclusionLayer environment={environment} />}
    </>
  );
}
