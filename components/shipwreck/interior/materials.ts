import {
  Color,
  FrontSide,
  NoBlending,
  ShaderMaterial,
  type IUniform,
  type Texture,
} from "three";
import type { Layer } from "./pieces";

/**
 * The rooms' one shader family (README.md "The look"): no three.js lights
 * (adding one recompiles every material in the scene), no fog.
 *
 * A fragment's colour is its vertex colour (the finish, tinted by the
 * detail texture on panelling, lino and carpet), times the room's lamps:
 * their light baked into each vertex at build time (`aLight`: pools under
 * the lamps, darker corners), scaled each frame by the room's power
 * (`uRoomPower[aRoom]`, read in the vertex shader) and the ship's flicker
 * (`uFlicker`); plus a faint blue night light, so a dark room is never
 * black; plus the torch, a warm cone from the eyes (`uTorchPos`,
 * `uTorchDir`, eased on by `uTorchOn`). Under the room's water level
 * (`uLevel[aRoom]`) it goes murky green, so a drowned room seen from above
 * reads as under water.
 *
 * Per layer (`#define`s): `shell` and `wood` sample the detail texture,
 * `wood` and `metal` catch a highlight from the lamps and the torch,
 * `glass` glows (lamps and the dome HDR so bloom catches them, a dark
 * glass when the power is off) and its portholes show the sky colour
 * (`uSky`) or, under the sea (earth y 0), dark sea green.
 *
 * Every pow/sqrt/division is guarded (`scene/__tests__/shaderGuards.test.ts`).
 */

/** Rooms per ship the uniform arrays allow (a fragment-uniform budget). */
export const MAX_ROOM_SLOTS = 64;

/** The uniforms the rooms share with the water (one source of truth). */
export interface SharedUniforms {
  uRoomPower: IUniform<Float32Array>;
  uLevel: IUniform<Float32Array>;
  uTorchOn: IUniform<number>;
  uTorchPos: IUniform<import("three").Vector3>;
  uTorchDir: IUniform<import("three").Vector3>;
  uTime: IUniform<number>;
}

const DEFINES: Record<Layer, string> = {
  shell: "#define DETAIL\n",
  wood: "#define DETAIL\n#define SHEEN 0.35\n#define SHINE 24.0\n",
  metal: "#define SHEEN 1.6\n#define SHINE 12.0\n#define METAL\n",
  glass: "#define GLASS\n",
};

/** The vertex and fragment shaders of one layer for `count` rooms. */
export function roomShaders(layer: Layer, count: number) {
  if (!(count >= 1 && count <= MAX_ROOM_SLOTS))
    throw new Error(`interior rooms: ${count} (1..${MAX_ROOM_SLOTS})`);
  const n = count;
  const vertex = /* glsl */ `
    ${DEFINES[layer]}
    attribute float aTile;
    attribute float aRoom;
    attribute float aGlow;
    attribute float aLight;
    uniform float uRoomPower[${n}];
    uniform float uLevel[${n}];
    varying vec3 vColor;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec4 vMask;
    varying float vTile;
    varying float vPower;
    varying float vLight;
    varying float vGlow;
    varying float vLevel;
    void main() {
      int k = int(aRoom + 0.5);
      vPower = clamp(uRoomPower[k], 0.0, 1.0);
      vLevel = uLevel[k];
      vColor = color;
      vUv = uv;
      vLight = aLight;
      vGlow = aGlow;
      vTile = aTile;
      // The detail channel: oak panels, grain, lino, carpet; white
      // panelling is the oak panel's relief, faint.
      vMask = vec4(
        (abs(aTile - 1.0) < 0.5 ? 1.0 : 0.0) + (abs(aTile - 5.0) < 0.5 ? 0.3 : 0.0),
        abs(aTile - 2.0) < 0.5 ? 1.0 : 0.0,
        abs(aTile - 3.0) < 0.5 ? 1.0 : 0.0,
        abs(aTile - 4.0) < 0.5 ? 1.0 : 0.0
      );
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vNormal = mat3(modelMatrix) * normal;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `;
  const fragment = /* glsl */ `
    ${DEFINES[layer]}
    uniform sampler2D uDetail;
    uniform float uFlicker;
    uniform float uTorchOn;
    uniform vec3 uTorchPos;
    uniform vec3 uTorchDir;
    uniform vec3 uSky;
    uniform float uTime;
    varying vec3 vColor;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec4 vMask;
    varying float vTile;
    varying float vPower;
    varying float vLight;
    varying float vGlow;
    varying float vLevel;
    // Warm lamp light, and the faint blue night light (never black).
    const vec3 LAMP = vec3(1.0, 0.8, 0.56);
    const vec3 NIGHT = vec3(0.05, 0.065, 0.11);
    const vec3 TORCH = vec3(1.0, 0.86, 0.64);

    // The torch on a point: its cone, a soft spill round it, falling off.
    float torchAt(vec3 n, vec3 world, out vec3 l) {
      vec3 tl = world - uTorchPos;
      float td = length(tl);
      l = tl / max(td, 0.001);
      float c = dot(l, uTorchDir);
      // A bright pool about 15° across, a soft ring round it.
      float cone = smoothstep(0.955, 0.99, c) + 0.1 * smoothstep(0.8, 0.96, c);
      float facing = 0.25 + 0.75 * clamp(-dot(n, l), 0.0, 1.0);
      return uTorchOn * cone * facing * 1.8 / max(1.0 + 0.06 * td * td, 1.0);
    }

    void main() {
      vec3 n = vNormal / max(length(vNormal), 0.0001);
      vec3 toEye = cameraPosition - vWorld;
      vec3 v = toEye / max(length(toEye), 0.001);
      float power = vPower * uFlicker;
      vec3 base = vColor;
      #ifdef DETAIL
        vec4 t = texture2D(uDetail, vUv);
        float m = clamp(vMask.x + vMask.y + vMask.z + vMask.w, 0.0, 1.0);
        vec3 f = vec3(1.0 - m)
          + vMask.x * mix(vec3(0.5, 0.46, 0.42), vec3(1.34, 1.28, 1.2), t.r)
          + vMask.y * mix(vec3(0.68, 0.64, 0.6), vec3(1.24, 1.2, 1.15), t.g)
          + vMask.z * mix(vec3(0.5, 0.2, 0.15), vec3(1.1, 1.08, 1.02), t.b)
          + vMask.w * mix(vec3(0.42, 0.34, 0.32), vec3(1.3, 1.18, 1.12), t.a);
        base *= f;
      #endif
      vec3 l;
      float torch = torchAt(n, vWorld, l);
      vec3 lit = base * (vLight * power * LAMP + NIGHT + torch * TORCH) + vec3(0.0015, 0.002, 0.0035);
      #ifdef SHEEN
        // A highlight: the lamps above (the reflected look turned up) and
        // the torch (straight back along its beam).
        vec3 r = reflect(-v, n);
        float up = pow(clamp(r.y * 0.5 + 0.5, 0.0, 1.0), SHINE);
        float back = pow(clamp(dot(r, -l), 0.0, 1.0), SHINE);
        #ifdef METAL
          vec3 tint = base * 1.6 + 0.04;
        #else
          vec3 tint = vec3(0.5, 0.42, 0.34);
        #endif
        lit += tint * SHEEN * (up * vLight * power * LAMP * 0.6 + back * torch * TORCH);
      #endif
      #ifdef GLASS
        if (vTile > 6.5) {
          // The dome: panes lit from above at night, in an iron lattice.
          float lu = fract(vUv.x);
          float lv = fract(vUv.y);
          float bar = max(
            1.0 - smoothstep(0.035, 0.075, min(lu, 1.0 - lu)),
            1.0 - smoothstep(0.05, 0.1, min(lv, 1.0 - lv))
          );
          // A finer diagonal tracery in each pane.
          float d = abs(fract(lu + lv) - 0.5);
          bar = max(bar, (1.0 - smoothstep(0.02, 0.05, d)) * 0.7);
          // Brighter toward the crown, warm; the night sky when out.
          float crown = clamp(vUv.y / 6.0, 0.0, 1.0);
          vec3 pane = vColor * vGlow * power * (0.75 + 0.45 * crown)
            + uSky * 0.35 + NIGHT * 0.4;
          vec3 iron = vec3(0.012, 0.012, 0.014) * (0.3 + vLight * power);
          lit = mix(pane, iron, bar) + torch * TORCH * 0.05;
        } else if (vTile > 5.5) {
          // A porthole: the sky, or the sea once it is over the glass, and
          // a little of the room's light on the glass.
          vec3 sky = uSky * 0.35 + vec3(0.004, 0.007, 0.02);
          vec3 sea = vec3(0.003, 0.022, 0.02);
          float under = smoothstep(0.03, -0.03, vWorld.y);
          lit = mix(sky, sea, under)
            + vec3(0.03, 0.026, 0.02) * vLight * power
            + TORCH * torch * 0.15;
        } else {
          // A lamp's glass: bright while lit, dull glass when out.
          lit = vColor * (vGlow * power + 0.03) + vColor * torch * 0.4;
        }
      #endif
      // Under the room's water: murky green, deeper the darker.
      float under = vLevel - vWorld.y;
      if (under > 0.0) {
        float murk = 1.0 - exp(-1.4 * under);
        vec3 water = vec3(0.006, 0.032, 0.03) * (0.35 + 0.65 * power)
          + vec3(0.02, 0.05, 0.045) * torch;
        lit = mix(lit, water, 0.3 + 0.62 * murk);
      }
      gl_FragColor = vec4(lit, 1.0);
    }
  `;
  return { vertex, fragment };
}

export type RoomMaterials = Record<Layer, ShaderMaterial> & {
  /** The ship's flicker (0..1), shared by every layer. */
  flicker: IUniform<number>;
  /** The sky the portholes and the dome show (linear). */
  sky: IUniform<Color>;
  dispose(): void;
};

/**
 * The four layers' materials for `count` rooms, sharing `shared` with the
 * water (room power, levels, the torch, time) and the detail texture.
 *
 * Drawn in the transparent pass (blending off, depth written, so it is
 * still opaque and Apple's hidden-surface removal still works): the depth
 * clear before them (`renderOrder` 9, also there) then comes after every
 * exterior see-through piece, which can no longer draw over a room.
 */
export function roomMaterials(
  count: number,
  shared: SharedUniforms,
  detail: Texture
): RoomMaterials {
  const flicker: IUniform<number> = { value: 1 };
  const sky: IUniform<Color> = { value: new Color(0x0a1020) };
  const det: IUniform<Texture> = { value: detail };
  const make = (layer: Layer) => {
    const sh = roomShaders(layer, count);
    const m = new ShaderMaterial({
      vertexShader: sh.vertex,
      fragmentShader: sh.fragment,
      uniforms: {
        ...shared,
        uDetail: det,
        uFlicker: flicker,
        uSky: sky,
      },
      vertexColors: true,
      fog: false,
      transparent: true,
      blending: NoBlending,
      depthWrite: true,
      depthTest: true,
      side: FrontSide,
    });
    m.name = `interior-${layer}`;
    return m;
  };
  const shell = make("shell");
  const wood = make("wood");
  const metal = make("metal");
  const glass = make("glass");
  return {
    shell,
    wood,
    metal,
    glass,
    flicker,
    sky,
    dispose() {
      for (const m of [shell, wood, metal, glass]) m.dispose();
    },
  };
}
