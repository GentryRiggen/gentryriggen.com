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
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import type { QualityTier } from "@/lib/shipwreck/playback";
import type { SceneRuntime } from "./runtime";
import {
  dayLookOf,
  isDaylit,
  moonAt,
  sunDirection,
  sunDirectionInto,
  type LinearRGB,
  type SceneSettings,
} from "./settings";

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
  #ifdef WAKE_PATH
  uniform vec2 uPath[8];
  uniform float uPathN;
  #endif
  #ifdef DAY_RIPPLE
  #define RIPPLE DAY_RIPPLE
  #else
  #define RIPPLE 0.34
  #endif
  #else
  #ifdef NIGHT_RIPPLE
  #define RIPPLE NIGHT_RIPPLE
  #else
  #define RIPPLE 0.18
  #endif
  #endif
  #ifdef MOON
  uniform vec3 uMoonDir;
  uniform float uMoonUp;
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
    #ifdef CHOP_DIR
    // A ship's own wind chop (SceneSettings.chop): short waves running
    // downwind, broken up by the noise.
    float along = dot(p, CHOP_DIR);
    h += sin(along * 0.75 - t * 2.2 + noise(p * 0.05) * 6.0) * 0.18;
    h += sin(along * 1.6 + p.x * 0.3 - t * 3.1) * 0.06;
    #endif
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
      #ifdef SOFT_MIRROR
      // A ship's own night (the Concordia's harbour lights): four more
      // taps, stretched up and down the water as lights on a chop are,
      // so the small bright points do not show the mips' squares.
      vec2 so = vec2(0.0012, 0.0035) * (1.0 + bias);
      mirror = mirror * 0.28
        + texture2D(uReflection, uv + vec2(so.x, so.y), bias).rgb * 0.18
        + texture2D(uReflection, uv - vec2(so.x, so.y), bias).rgb * 0.18
        + texture2D(uReflection, uv + vec2(-so.x, so.y * 2.0), bias + 0.5).rgb * 0.18
        + texture2D(uReflection, uv + vec2(so.x, -so.y * 2.0), bias + 0.5).rgb * 0.18;
      #endif
      #ifdef DAY_MIRROR
      // A rougher sea (DaylightLook.mirror): the mirror image faint.
      refl = mix(sky, mirror + sky * 0.15, DAY_MIRROR);
      #else
      refl = mirror + sky * 0.15;
      #endif
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
      #ifdef WAKE_PATH
      // A turning ship: along her stern's path (nearest segment).
      if (uPathN > 1.5) {
        float acc = 0.0;
        float best = 1e9;
        s = -1.0;
        for (int k = 0; k < 7; k++) {
          if (float(k) >= uPathN - 1.0) break;
          vec2 a = uPath[k];
          vec2 ab = uPath[k + 1] - a;
          float l2 = max(dot(ab, ab), 1e-4);
          float u = clamp(dot(vWorld.xz - a, ab) / l2, 0.0, 1.0);
          float d = length(vWorld.xz - a - ab * u);
          if (d < best && (k > 0 || u > 0.0)) {
            best = d;
            s = acc + u * sqrt(l2);
          }
          acc += sqrt(l2);
        }
        lat = best;
      }
      #endif
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
    #ifdef WHITECAPS
    // Small whitecaps (a ship's own, DaylightLook.whitecaps): in cells of
    // 14 m a few break at any moment, each a ragged white crest across
    // the wind (it blows along x) that flares in a second, then spreads
    // downwind and thins over a few. Far off, where one would be a
    // flickering pixel, only their average whitening is left.
    // Past 700 m only the average is left: skip the per-cell work there.
    if (dist >= 700.0) {
      foam = max(foam, WHITECAPS * 1.2);
    } else {
      vec2 wp = vWorld.xz / 14.0;
      vec2 cell = floor(wp);
      vec2 f = fract(wp) - 0.5;
      float r1 = hash(cell + 17.0);
      float r2 = hash(cell + 41.0);
      float r3 = hash(cell + 73.0);
      float cyc = uTime / (7.0 + 5.0 * r2) + r1;
      float life = fract(cyc);
      // They break in groups, where the bigger waves of the sea are.
      float group = smoothstep(0.3, 0.8, noise(vWorld.xz / 140.0 + vec2(uTime * 0.02, 0.0)));
      float breaks = step(hash(cell + floor(cyc) * 1.7), WHITECAPS * 14.0 * group);
      vec2 o = (f - (vec2(r1, r2) - 0.5) * 0.4) / (0.5 + 0.7 * r3);
      o.x -= life * 0.3;
      float shape = length(o * vec2(5.0 - life * 2.5, 1.5));
      float tex = noise(vWorld.xz * 0.9 + r1 * 50.0) * 0.6
        + noise(vWorld.xz * 2.7 + r2 * 30.0) * 0.4;
      float flare = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.05, 0.6, life));
      float body = smoothstep(0.6, 0.22, shape + (tex - 0.5) * 0.55);
      float cap = breaks * body * flare * (0.45 + 0.55 * tex) * (0.6 + 0.4 * r3);
      float near = smoothstep(700.0, 120.0, dist);
      foam = max(foam, mix(WHITECAPS * 1.2, cap * 0.8, near));
    }
    #endif
    c = mix(c, vec3(0.8, 0.86, 0.88), clamp(foam, 0.0, 0.8));
    gl_FragColor = vec4(c, uOpacity);
    #else
    vec3 c = mix(uDeep, refl, clamp(fres * 1.15 + 0.08, 0.0, 1.0));
    c += uFlash * vec3(0.05, 0.055, 0.06) * fres;
    #ifdef MOON
    // The moon's path on the chop, toward the risen moon (east, away
    // from the island).
    float md = max(dot(r, uMoonDir), 0.0);
    c += vec3(0.85, 0.9, 1.0) * uMoonUp * (pow(md, 500.0) * 10.0 + pow(md, 40.0) * 0.05);
    #endif
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
  const day = settings ? isDaylit(settings) : false;
  const ripple = settings?.daylight?.ripple;
  const whitecaps = settings?.daylight?.whitecaps;
  const mirrorAmt = settings?.daylight?.mirror;
  // Her turn for Kea: the morning's wake follows her stern's path.
  const curved = settings?.wakePath === true;
  // A night with its own chop and moon (the Concordia's): defines only
  // for her, so the Titanic's sea program stays 1.0's.
  const chop = !day ? settings?.chop : undefined;
  const moon = !day ? settings?.moon : undefined;
  const heading = settings?.headingDeg ?? 90;
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
        // A ship's own ripple strength (`DaylightLook.ripple`) is a define:
        // the Lusitania's program stays 1.1's.
        defines: day
          ? {
              DAY: "",
              ...(ripple !== undefined
                ? { DAY_RIPPLE: ripple.toFixed(3) }
                : {}),
              ...(curved ? { WAKE_PATH: "" } : {}),
              ...(whitecaps !== undefined
                ? { WHITECAPS: whitecaps.toFixed(3) }
                : {}),
              ...(mirrorAmt !== undefined
                ? { DAY_MIRROR: mirrorAmt.toFixed(3) }
                : {}),
            }
          : {
              ...(chop !== undefined
                ? {
                    NIGHT_RIPPLE: chop.toFixed(3),
                    // Downwind: the north-east wind blows toward 225°.
                    CHOP_DIR: `vec2(${Math.cos(((225 - heading) * Math.PI) / 180).toFixed(4)}, ${Math.sin(((225 - heading) * Math.PI) / 180).toFixed(4)})`,
                  }
                : {}),
              ...(moon ? { MOON: "", SOFT_MIRROR: "" } : {}),
            },
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
            uPath: {
              value: Array.from({ length: 8 }, () => new Vector2()),
            },
            uPathN: { value: 0 },
            uMoonDir: { value: new Vector3(0, -1, 0) },
            uMoonUp: { value: 0 },
          },
        ]),
      }),
    [day, ripple, curved, whitecaps, mirrorAmt, chop, moon, heading]
  );
  // The afternoon's colours (linear): the haze at the horizon, the blue
  // overhead, the water and the light under it.
  useEffect(() => {
    if (!day || !settings) return;
    const u = material.uniforms;
    // (The afternoon's are 1.1's; the morning's a deeper Aegean blue; a
    // ship's own `daylight` over either.)
    const look = dayLookOf(settings);
    const own = settings.daylight;
    const lin = (c: Color, v: LinearRGB) =>
      c.setRGB(v[0], v[1], v[2], LinearSRGBColorSpace);
    lin(u.uDeep.value as Color, own?.seaDeep ?? look.seaDeep);
    lin(u.uScatter.value as Color, own?.seaScatter ?? look.seaScatter);
    (u.uSkyLow.value as Color).set(settings.fog);
    lin(u.uSkyHigh.value as Color, own?.zenith ?? look.zenith);
    lin(u.uUnder.value as Color, own?.seaUnder ?? look.seaUnder);
    (u.uSunColor.value as Color).setRGB(...look.skySun);
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

  const moonArr = useMemo(() => [0, 0, 0] as [number, number, number], []);
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
      if (curved) {
        const path = u.uPath.value as Vector2[];
        for (let k = 0; k < w.pathN && k < path.length; k += 1)
          path[k].set(w.path[k * 2], w.path[k * 2 + 1]);
        u.uPathN.value = w.pathN;
      }
    }
    if (moon) {
      const f = runtime.frame;
      const m = moonAt(moon, moon.utcMs + (f ? f.realT : 0) * 1000);
      sunDirectionInto(m, heading, moonArr);
      (u.uMoonDir.value as Vector3).set(moonArr[0], moonArr[1], moonArr[2]);
      u.uMoonUp.value =
        Math.min(1, Math.max(0, (m.elevationDeg + 0.5) / 3.5)) * m.lit;
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
