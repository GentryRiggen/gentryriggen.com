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
    vec3 n = normalize(vec3(-grad.x * 0.18 * fine, 1.0, -grad.y * 0.18 * fine));

    if (!gl_FrontFacing) {
      // From under the water: the bright window overhead, dark beyond.
      float up = clamp(-v.y, 0.0, 1.0);
      vec3 c = mix(uUnder * 0.25, uUnder, pow(up, 3.0));
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
    vec3 c = mix(uDeep, refl, clamp(fres * 1.15 + 0.08, 0.0, 1.0));
    c += uFlash * vec3(0.05, 0.055, 0.06) * fres;
    gl_FragColor = vec4(c, uOpacity);
    #include <fog_fragment>
  }
`;

interface SeaProps {
  runtime: SceneRuntime;
  quality: QualityTier;
  xray: boolean;
}

export default function Sea({ runtime, quality, xray }: SeaProps) {
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
          },
        ]),
      }),
    []
  );
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
