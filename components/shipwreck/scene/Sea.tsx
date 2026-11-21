"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  DoubleSide,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import type { QualityTier } from "@/lib/shipwreck/playback";
import type { SceneRuntime } from "./runtime";
import { sunDirection, type SceneSettings } from "./settings";

/**
 * The sea on the night: flat calm, "like glass". One big quad with a
 * shader: fine ripple normals from procedural noise (nothing downloaded),
 * Fresnel, and at the high tier a planar reflection rendered from a mirrored
 * camera into a half-resolution target whose mip chain blurs it. Lower tiers
 * reflect the sky's gradient only. From below it is the surface seen from
 * under water. The X-ray mode fades it so the hull below the waterline shows.
 */

const REFLECTION_SIZE: Record<QualityTier, number> = {
  high: 1024,
  medium: 0,
  low: 0,
};

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec4 vReflect;
  uniform mat4 uTextureMatrix;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vReflect = uTextureMatrix * world;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec3 vWorld;
  varying vec4 vReflect;
  uniform sampler2D uReflection;
  uniform float uHasReflection;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFlash;
  uniform vec3 uDeep;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyHigh;
  uniform vec3 uUnder;
  #ifdef DAY
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uScatter;
  uniform vec4 uWake;
  uniform float uWakeAmt;
  uniform float uWakeLen;
  #define RIPPLE 0.34
  #else
  #define RIPPLE 0.18
  #endif

  // Value noise and its gradient, for the ripples.
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float height(vec2 p) {
    float t = uTime;
    float h = noise(p * 0.11 + vec2(t * 0.020, t * 0.013)) * 0.6;
    h += noise(p * 0.37 + vec2(-t * 0.041, t * 0.027)) * 0.25;
    h += noise(p * 1.30 + vec2(t * 0.09, -t * 0.07)) * 0.08;
    // The long, low swell.
    h += sin(p.x * 0.012 + p.y * 0.004 + t * 0.35) * 0.4;
    return h;
  }

  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 v = toEye / dist;
    // Ripples fade with distance (the glassy look far off).
    float fine = clamp(1.0 - dist / 1600.0, 0.0, 1.0);
    vec2 p = vWorld.xz;
    float e = 0.6;
    float h0 = height(p);
    vec2 grad = vec2(height(p + vec2(e, 0.0)) - h0, height(p + vec2(0.0, e)) - h0) / e;
    vec3 n = normalize(vec3(-grad.x * RIPPLE * fine, 1.0, -grad.y * RIPPLE * fine));

    if (!gl_FrontFacing) {
      // From under the water: the bright window overhead, dark beyond.
      float up = clamp(-v.y, 0.0, 1.0);
      vec3 c = mix(uUnder * 0.25, uUnder, pow(up, 3.0));
      #ifdef DAY
      // Snell's window: the bright sky overhead, the sun in it.
      c += smoothstep(0.6, 0.72, up) * vec3(0.35, 0.5, 0.45);
      c += uSunColor * pow(max(dot(-v, normalize(uSunDir + vec3(0.0, 1.2, 0.0))), 0.0), 60.0) * 1.5;
      #endif
      gl_FragColor = vec4(c, 1.0);
      #include <fog_fragment>
      return;
    }

    float cosT = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uSkyLow, uSkyHigh, pow(clamp(r.y, 0.0, 1.0), 0.45));
    vec3 refl = sky;
    if (uHasReflection > 0.5) {
      vec2 uv = vReflect.xy / vReflect.w + n.xz * 0.04 * fine;
      // Blur grows with distance and ripple slope (mip bias).
      float bias = clamp(log2(dist / 120.0), 0.0, 3.0);
      vec3 mirror = texture2D(uReflection, uv, bias).rgb;
      refl = mirror + sky * 0.15;
    }
    #ifdef DAY
    // The sea in the sun: blue-green water lit from within, the sky's
    // reflection, the glitter of the sun on the ripples, and her wake.
    vec3 body = uDeep + uScatter * max(uSunDir.y, 0.0) * (0.7 + 0.3 * n.y);
    vec3 c = mix(body, refl, clamp(fres * 1.1 + 0.05, 0.0, 1.0));
    float sd = max(dot(r, uSunDir), 0.0);
    c += uSunColor * (pow(sd, 700.0) * 30.0 + pow(sd, 50.0) * 0.35) * (0.35 + 0.65 * fine);
    float foam = 0.0;
    if (uWakeAmt > 0.0) {
      vec2 rel = vWorld.xz - uWake.xy;
      float s = -dot(rel, uWake.zw);
      float lat = abs(dot(rel, vec2(-uWake.w, uWake.z)));
      if (s > 0.0 && s < uWakeLen) {
        float u = s / max(uWakeLen, 1.0);
        float churn = noise(vWorld.xz * 0.3 + vec2(uTime * 0.21, 0.0)) * 0.6
          + noise(vWorld.xz * 1.1 - vec2(0.0, uTime * 0.37)) * 0.4;
        float w = 8.0 + s * 0.05;
        foam += smoothstep(w, w * 0.15, lat) * (1.0 - u) * (0.3 + 0.7 * churn);
        // The Kelvin wave's arms, 19.5° each side.
        float arm = s * 0.354;
        foam += exp(-pow((lat - arm) / (1.2 + s * 0.012), 2.0)) * (1.0 - u) * 0.35 * churn;
      }
      foam *= uWakeAmt;
    }
    c = mix(c, vec3(0.8, 0.86, 0.88), clamp(foam, 0.0, 0.8));
    gl_FragColor = vec4(c, uOpacity);
    #else
    vec3 c = mix(uDeep, refl, clamp(fres * 1.15 + 0.08, 0.0, 1.0));
    c += uFlash * vec3(0.05, 0.055, 0.06) * fres;
    gl_FragColor = vec4(c, uOpacity);
    #endif
    #include <fog_fragment>
  }
`;

interface SeaProps {
  runtime: SceneRuntime;
  quality: QualityTier;
  xray: boolean;
  /** The ship's scene: the afternoon's sea is sunlit, with her wake. */
  settings?: SceneSettings;
}

export default function Sea({ runtime, quality, xray, settings }: SeaProps) {
  const day = settings?.timeOfDay === "afternoon";
  const size = REFLECTION_SIZE[quality];
  const { gl, scene, camera } = useThree();

  const target = useMemo(() => {
    if (size === 0) return null;
    const t = new WebGLRenderTarget(size, size, {
      type: HalfFloatType,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    });
    return t;
  }, [size]);
  useEffect(() => () => target?.dispose(), [target]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: DoubleSide,
        fog: true,
        defines: day ? { DAY: "" } : {},
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uReflection: { value: null },
            uHasReflection: { value: 0 },
            uTextureMatrix: { value: new Matrix4() },
            uTime: { value: 0 },
            uOpacity: { value: 1 },
            uFlash: { value: 0 },
            uDeep: { value: new Color(0x010307) },
            uSkyLow: {
              value: new Color().setRGB(
                0.014,
                0.0195,
                0.032,
                LinearSRGBColorSpace
              ),
            },
            uSkyHigh: {
              value: new Color().setRGB(
                0.0012,
                0.0019,
                0.0048,
                LinearSRGBColorSpace
              ),
            },
            uUnder: { value: new Color(0x1d5a70) },
            uSunDir: { value: new Vector3(0, 1, 0) },
            uSunColor: { value: new Color().setRGB(1, 0.93, 0.82) },
            uScatter: { value: new Color() },
            uWake: { value: new Vector4(0, 0, 1, 0) },
            uWakeAmt: { value: 0 },
            uWakeLen: { value: 0 },
          },
        ]),
      }),
    [day]
  );
  // The afternoon's colours (linear): the haze at the horizon, the blue
  // overhead, the water and the light under it.
  useEffect(() => {
    if (!day || !settings) return;
    const u = material.uniforms;
    (u.uDeep.value as Color).setRGB(0.008, 0.036, 0.05, LinearSRGBColorSpace);
    (u.uScatter.value as Color).setRGB(0.012, 0.05, 0.05, LinearSRGBColorSpace);
    (u.uSkyLow.value as Color).set(settings.fog);
    (u.uSkyHigh.value as Color).setRGB(0.1, 0.25, 0.62, LinearSRGBColorSpace);
    (u.uUnder.value as Color).setRGB(0.22, 0.5, 0.44, LinearSRGBColorSpace);
    const d = settings.sun
      ? sunDirection(settings.sun, settings.headingDeg ?? 90)
      : [0, 1, 0];
    (u.uSunDir.value as Vector3).set(d[0], d[1], d[2]).normalize();
  }, [day, settings, material]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.uniforms.uReflection.value = target?.texture ?? null;
    material.uniforms.uHasReflection.value = target ? 1 : 0;
  }, [material, target]);

  useEffect(() => {
    material.transparent = xray;
    material.depthWrite = !xray;
    material.uniforms.uOpacity.value = xray ? 0.28 : 1;
    material.needsUpdate = true;
  }, [material, xray]);

  const geometry = useMemo(() => new PlaneGeometry(80000, 80000), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const mesh = useMemo(() => {
    const m = new Mesh(geometry, material);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea";
    m.renderOrder = -1;
    return m;
  }, [geometry, material]);

  const mirror = useMemo(
    () => ({
      camera: new PerspectiveCamera(),
      plane: new Plane(),
      clip: new Vector4(),
      q: new Vector4(),
      normal: new Vector3(0, 1, 0),
      eye: new Vector3(),
      look: new Vector3(),
      tmp: new Vector3(),
      bias: new Matrix4().set(
        0.5,
        0,
        0,
        0.5,
        0,
        0.5,
        0,
        0.5,
        0,
        0,
        0.5,
        0.5,
        0,
        0,
        0,
        1
      ),
    }),
    []
  );

  // After the camera rig has moved the camera (priority -1), before the
  // composer renders (priority 1).
  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = runtime.flash;
    if (day) {
      const w = runtime.wake;
      (u.uWake.value as Vector4).set(w.x, w.z, w.dx, w.dz);
      u.uWakeAmt.value = w.amount;
      u.uWakeLen.value = w.length;
    }
    // The sea follows the camera so its edge never shows.
    mesh.position.set(camera.position.x, 0, camera.position.z);
    if (!target || camera.position.y < 0.3) return;
    const cam = camera as PerspectiveCamera;
    const m = mirror;
    const v = m.camera;
    m.eye.copy(cam.position);
    m.eye.y = -m.eye.y;
    m.look.set(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
    m.look.y = -m.look.y;
    v.position.copy(m.eye);
    v.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    v.up.y = -v.up.y;
    v.lookAt(m.look);
    v.far = cam.far;
    v.updateMatrixWorld();
    v.projectionMatrix.copy(cam.projectionMatrix);
    u.uTextureMatrix.value
      .copy(m.bias)
      .multiply(v.projectionMatrix)
      .multiply(v.matrixWorldInverse);
    // Oblique near plane at the sea (Lengyel), so nothing under it reflects.
    m.plane.setFromNormalAndCoplanarPoint(m.normal, m.tmp.set(0, 0, 0));
    m.plane.applyMatrix4(v.matrixWorldInverse);
    m.clip.set(
      m.plane.normal.x,
      m.plane.normal.y,
      m.plane.normal.z,
      m.plane.constant
    );
    const pm = v.projectionMatrix.elements;
    m.q.set(
      (Math.sign(m.clip.x) + pm[8]) / pm[0],
      (Math.sign(m.clip.y) + pm[9]) / pm[5],
      -1,
      (1 + pm[10]) / pm[14]
    );
    m.clip.multiplyScalar(2 / m.clip.dot(m.q));
    pm[2] = m.clip.x;
    pm[6] = m.clip.y;
    pm[10] = m.clip.z + 1;
    pm[14] = m.clip.w;

    mesh.visible = false;
    runtime.reflecting = true;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, v);
    gl.setRenderTarget(prev);
    runtime.reflecting = false;
    mesh.visible = true;
  }, -0.5);

  return <primitive object={mesh} />;
}
