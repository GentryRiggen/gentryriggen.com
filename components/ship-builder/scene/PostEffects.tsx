"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import { ClearPass, EffectComposer, RenderPass } from "postprocessing";
import {
  Color,
  MeshBasicMaterial,
  MultiplyBlending,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  type Camera,
  type Scene,
  type WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { AO_LAYER } from "./aoLayer";
import { canRunOcclusion, createDeclineGate } from "./aoPolicy";
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

/**
 * Draws only the occluders (see `AO_LAYER`) into the composer's depth, with a
 * flat material since colour is wiped straight after. The camera's own layers
 * are put back afterwards, so nothing else sees the change.
 */
class OccluderDepthPass extends RenderPass {
  private readonly depthCamera: Camera;

  constructor(scene: Scene, camera: Camera) {
    super(scene, camera, new MeshBasicMaterial());
    this.depthCamera = camera;
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean
  ): void {
    const { layers } = this.depthCamera;
    const savedMask = layers.mask;
    layers.set(AO_LAYER);
    try {
      super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    } finally {
      layers.mask = savedMask;
    }
  }
}

interface PostEffectsProps {
  /** The live look; the occlusion tint follows its eased colour. */
  environment: RuntimeEnvironment;
}

interface OcclusionLayerProps {
  environment: RuntimeEnvironment;
  /** Called when the composer throws; the plain render carries on alone. */
  onFailure: () => void;
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
function OcclusionLayer({ environment, onFailure }: OcclusionLayerProps) {
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
    // N8AO reads the composer's depth, so the occluders are drawn once into
    // it; the colour is then wiped to white, keeping the depth.
    const depth = new OccluderDepthPass(scene, camera);
    const white = new ClearPass(true, false, false);
    white.overrideClearColor = new Color(1, 1, 1);
    white.overrideClearAlpha = 1;
    const occlusion = new N8AOPostPass(scene, camera);
    occlusion.setQualityMode("Performance");
    // The default re-draws the transparent objects (sea, glass, glows) in two
    // more passes to keep them out of the shading; the multiply-over-canvas
    // approach has no need of that.
    (
      occlusion as N8AOPostPass & { autoDetectTransparency: boolean }
    ).autoDetectTransparency = false;
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
    try {
      composer.render(delta);
    } catch {
      // The scene is already on the canvas, so a failing AO pass only costs
      // the shading: stop using it rather than throwing every frame.
      renderer.setRenderTarget(null);
      onFailure();
    } finally {
      renderer.shadowMap.autoUpdate = wasShadowUpdate;
      renderer.autoClear = wasAutoClear;
    }
  }, OCCLUSION_PRIORITY);

  return null;
}

interface OcclusionBoundaryProps {
  onFailure: () => void;
  children: ReactNode;
}

/**
 * Catches anything the AO layer throws while setting up, so the canvas keeps
 * the plain render instead of going blank.
 */
class OcclusionBoundary extends Component<OcclusionBoundaryProps> {
  state = { hasFailed: false };

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true };
  }

  componentDidCatch(): void {
    this.props.onFailure();
  }

  render(): ReactNode {
    return this.state.hasFailed ? null : this.props.children;
  }
}

/** Monitor windows are 250 ms each, ten to a reading (~2.5 s). */
const MONITOR_WINDOW_MS = 250;
const MONITOR_WINDOW_COUNT = 10;
/** Below this many frames per second AO is a candidate for switching off. */
const DECLINE_FPS = 30;
/** At or above this a reading counts as healthy and ends a decline streak. */
const HEALTHY_FPS = 50;

/**
 * Ambient occlusion over the scene. A device that stays slow (drei's
 * `PerformanceMonitor` reports sustained declines, see `createDeclineGate`)
 * turns it off for the rest of the session, as does a device without float
 * colour buffers or any error in the AO pass; with it off the scene renders
 * straight to the canvas as before. Tests can force it either way with
 * `__SHIP_BUILDER_TEST__.ao`, which also stops the monitor, so a slow
 * software renderer cannot change a screenshot.
 */
export default function PostEffects({ environment }: PostEffectsProps) {
  const forced = testAoOverride();
  const renderer = useThree((state) => state.gl);
  const [hasDeclined, setHasDeclined] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const isCapable = useMemo(
    () =>
      canRunOcclusion({
        isWebGL2: renderer.capabilities.isWebGL2,
        hasExtension: (name) => renderer.extensions.has(name),
      }),
    [renderer]
  );
  const isEnabled = isCapable && !hasFailed && (forced ?? !hasDeclined);
  const gate = useRef(createDeclineGate());
  const handleFailure = () => setHasFailed(true);

  useEffect(() => {
    const gateNow = gate.current;
    gateNow.restartWarmUp(performance.now());
    // Frames stall while the tab is hidden; the dip on return is not the device.
    const handleVisibility = () => {
      if (!document.hidden) gateNow.restartWarmUp(performance.now());
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <>
      {forced === null && isEnabled && (
        <PerformanceMonitor
          ms={MONITOR_WINDOW_MS}
          iterations={MONITOR_WINDOW_COUNT}
          bounds={() => [DECLINE_FPS, HEALTHY_FPS]}
          onIncline={() => gate.current.noteIncline()}
          onDecline={() => {
            if (gate.current.noteDecline(performance.now(), document.hidden)) {
              setHasDeclined(true);
            }
          }}
        />
      )}
      {isEnabled && (
        <OcclusionBoundary onFailure={handleFailure}>
          <OcclusionLayer environment={environment} onFailure={handleFailure} />
        </OcclusionBoundary>
      )}
    </>
  );
}
