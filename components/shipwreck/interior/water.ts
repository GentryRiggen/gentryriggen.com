import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  roomFloorZ,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { V2 } from "@/lib/shipwreck/walk";
import {
  ceilingZ,
  edgeKinds,
  RAIL_M,
  refine,
  RISER_M,
  triangulate,
} from "./kit";

/**
 * The water inside her rooms (README.md "Water"), adapted from X-ray's
 * water: per zone one surface mesh and one body mesh, every vertex tagged
 * with its room's slot (`aRoom`) in the shared level uniform (`uLevel`,
 * earth z, which is three y; under −1e5 dry) that Interior fills each
 * frame with the eased levels.
 *
 * - **Surface**: each room's plan, triangulated as its floor is. The
 *   vertex shader climbs her frame's up axis from each plan point to the
 *   level (so the polygon lies exactly in the level plane, cut by the
 *   room's walls however she trims); the fragment keeps only what is over
 *   the floor and under the ceiling (the room's box in her frame). Dark
 *   greenish teal, murkier the deeper the water under it and the flatter
 *   the look, a soft wet edge where it meets a sloping floor, gentle
 *   ripples, a little of the lamps' sheen on a grazing look.
 * - **Body**: each wall's and balustrade's face (a seam is open), inset
 *   2 cm, from the floor's lowest line up, drawn only under the level:
 *   the walls go dark under the water, with a wet line at the surface.
 *
 * Lit by `uRoomPower[]` (the room's lamps, 0..1) and the torch
 * (`uTorchOn` eased 0..1, `uTorchPos`, `uTorchDir`, world), shared with
 * the rooms' shader (materials.ts) and driven by Interior. No three.js lights,
 * no fog (as the rooms). Every pow/sqrt/division is guarded
 * (`shaderGuards.test.ts`).
 */

/** The body draws after the rooms (10), the surface over it. */
export const WATER_BODY_ORDER = 11;
export const WATER_SURFACE_ORDER = 12;
/** How far the body stands in from the walls (m). */
const BODY_INSET_M = 0.02;
/** A level under this is dry (the uniform's sentinel). */
export const DRY_LEVEL = -1e6;

type Spec = Pick<ShipSpec, "decks" | "sheerZ">;

export interface InteriorWater {
  /** Per zone: its rooms' surfaces and bodies (three-local, her part). */
  zones: Map<string, { surface: BufferGeometry; body: BufferGeometry }>;
  /** Each room's slot in the level and power uniforms (its `aRoom`). */
  slot: Map<string, number>;
  /** Each zone's rooms, by slot. */
  zoneSlots: Map<string, number[]>;
  /** How many rooms (the uniform arrays' length). */
  count: number;
}

interface Arrays {
  surface: number[];
  surfaceRoom: number[];
  floor: number[];
  top: number[];
  body: number[];
  bodyRoom: number[];
}

/** The rooms' water geometry, one surface and one body per zone. */
export function interiorWater(
  interior: InteriorMap,
  spec: Spec
): InteriorWater {
  const kinds = edgeKinds(interior, spec);
  const slot = new Map<string, number>();
  const zoneSlots = new Map<string, number[]>();
  const arrays = new Map<string, Arrays>();
  interior.rooms.forEach((room, k) => {
    slot.set(room.id, k);
    let list = zoneSlots.get(room.zone);
    if (!list) {
      list = [];
      zoneSlots.set(room.zone, list);
    }
    list.push(k);
    let a = arrays.get(room.zone);
    if (!a) {
      a = {
        surface: [],
        surfaceRoom: [],
        floor: [],
        top: [],
        body: [],
        bodyRoom: [],
      };
      arrays.set(room.zone, a);
    }
    addRoom(a, room, k, kinds.get(room.id)!, spec);
  });
  const zones = new Map<
    string,
    { surface: BufferGeometry; body: BufferGeometry }
  >();
  for (const [zone, a] of arrays) {
    const surface = new BufferGeometry();
    surface.setAttribute("position", new Float32BufferAttribute(a.surface, 3));
    surface.setAttribute("aRoom", new Float32BufferAttribute(a.surfaceRoom, 1));
    surface.setAttribute("aFloor", new Float32BufferAttribute(a.floor, 1));
    surface.setAttribute("aTop", new Float32BufferAttribute(a.top, 1));
    const body = new BufferGeometry();
    body.setAttribute("position", new Float32BufferAttribute(a.body, 3));
    body.setAttribute("aRoom", new Float32BufferAttribute(a.bodyRoom, 1));
    zones.set(zone, { surface, body });
  }
  return { zones, slot, zoneSlots, count: interior.rooms.length };
}

function addRoom(
  a: Arrays,
  room: Room,
  k: number,
  edges: readonly { kind: "wall" | "rail" | "seam" }[],
  spec: Spec
): void {
  const ramp = room.ramp;
  const rise = ramp
    ? ramp.dropM / Math.max(1, Math.round(ramp.dropM / RISER_M))
    : 0;
  const fz = (x: number, y: number) => roomFloorZ(room, x, y, spec);
  /** The floor's lowest line (a flight's tread backs), as the kit's. */
  const low = (x: number, y: number) => fz(x, y) - rise - 0.01;

  // The surface: the room's plan as its floor is triangulated, so the
  // floor under it matches vertex for vertex.
  const fine = refine(room.outline);
  for (const tri of triangulate(fine))
    for (const i of tri) {
      const [x, y] = fine[i];
      a.surface.push(x, 0, -y);
      a.surfaceRoom.push(k);
      a.floor.push(low(x, y));
      a.top.push(ceilingZ(room, x, y, spec));
    }

  // The body: walls to the ceiling, balustrades to their rail.
  const poly = room.outline;
  for (let i = 0; i < poly.length; i += 1) {
    const kind = edges[i].kind;
    if (kind === "seam") continue;
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // Inward (left of a counter-clockwise edge), and a hair along it so
    // the faces at a corner never cross into the next wall.
    const nx = (-dy / len) * BODY_INSET_M;
    const ny = (dx / len) * BODY_INSET_M;
    const ux = (dx / len) * BODY_INSET_M;
    const uy = (dy / len) * BODY_INSET_M;
    const s: V2 = [p[0] + nx + ux, p[1] + ny + uy];
    const e: V2 = [q[0] + nx - ux, q[1] + ny - uy];
    const top = (v: V2) =>
      kind === "wall"
        ? ceilingZ(room, v[0], v[1], spec)
        : fz(v[0], v[1]) + RAIL_M;
    const sLo = low(s[0], s[1]);
    const eLo = low(e[0], e[1]);
    const sHi = top(s);
    const eHi = top(e);
    // As the kit's `inward`: a low, a high, b high, b low (facing in).
    const quad: [V2, number][] = [
      [s, sLo],
      [s, sHi],
      [e, eHi],
      [s, sLo],
      [e, eHi],
      [e, eLo],
    ];
    for (const [v, z] of quad) {
      a.body.push(v[0], z, -v[1]);
      a.bodyRoom.push(k);
    }
  }
}

/**
 * The shaders for `count` rooms (exported for the NaN guard test). The
 * torch (`uTorchOn`, eased 0..1) and the room power are the rooms'
 * (materials.ts shares these uniforms).
 */
export function waterShaders(count: number) {
  const n = Math.max(1, count);
  const lighting = /* glsl */ `
    uniform float uRoomPower[${n}];
    uniform float uTorchOn;
    uniform vec3 uTorchPos;
    uniform vec3 uTorchDir;
    // The room's lamps (0..1) and the torch's warm cone on a point.
    vec3 waterLight(vec3 c, vec3 sheen, float room, vec3 world) {
      float power = clamp(uRoomPower[int(room + 0.5)], 0.0, 1.0);
      // Never black: a faint blue night light.
      vec3 lit = (c + sheen) * (0.22 + 0.78 * power) + vec3(0.003, 0.008, 0.013);
      if (uTorchOn > 0.001) {
        vec3 tl = world - uTorchPos;
        float td = length(tl);
        float cone = smoothstep(0.86, 0.97, dot(tl / max(td, 0.001), uTorchDir));
        lit += uTorchOn * vec3(0.55, 0.45, 0.3) * cone * (c * 5.0 + 0.04) / max(1.0 + 0.08 * td * td, 1.0);
      }
      return lit;
    }
  `;
  const surfaceVertex = /* glsl */ `
    attribute float aRoom;
    attribute float aFloor;
    attribute float aTop;
    uniform float uLevel[${n}];
    varying vec3 vWorld;
    varying float vH;
    varying float vFloor;
    varying float vTop;
    varying float vRoom;
    void main() {
      float level = uLevel[int(aRoom + 0.5)];
      vRoom = aRoom;
      vFloor = aFloor;
      vTop = aTop;
      // Climb her up axis from the plan point to the level: the polygon
      // lies in the level plane, cut by the room's walls.
      vec4 base = modelMatrix * vec4(position.x, 0.0, position.z, 1.0);
      float h = (level - base.y) / max(modelMatrix[1][1], 0.2);
      vH = h;
      vec4 w = modelMatrix * vec4(position.x, h, position.z, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
      // Dry: off screen.
      if (level < -1e5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  `;
  const surfaceFragment = /* glsl */ `
    uniform float uTime;
    varying vec3 vWorld;
    varying float vH;
    varying float vFloor;
    varying float vTop;
    varying float vRoom;
    ${lighting}
    void main() {
      // Water over the floor here (her frame); only inside the room's box.
      float d = vH - vFloor;
      if (d <= 0.0 || vH > vTop) discard;
      vec3 toEye = cameraPosition - vWorld;
      vec3 v = toEye / max(length(toEye), 0.001);
      float cosv = clamp(abs(v.y), 0.12, 1.0);
      // The look's path down through the water to the floor.
      float murk = 1.0 - exp(-2.2 * d / max(cosv, 0.12));
      float s1 = sin(vWorld.x * 2.1 + uTime * 1.6);
      float s2 = sin(vWorld.z * 2.7 - uTime * 1.2);
      float s3 = sin((vWorld.x - vWorld.z) * 4.3 + uTime * 2.3);
      float ripple = 0.88 + 0.12 * s1 * s2 + 0.05 * s3;
      vec3 shallow = vec3(0.022, 0.115, 0.098);
      vec3 deep = vec3(0.005, 0.038, 0.034);
      vec3 c = mix(shallow, deep, murk) * ripple;
      // The leading edge on a sloping floor: a lighter wet line.
      float edge = 1.0 - smoothstep(0.0, 0.08, d);
      c += vec3(0.035, 0.07, 0.06) * edge;
      // A grazing look catches the lamps (a cheap Fresnel), rippled.
      float graze = (1.0 - cosv) * (1.0 - cosv);
      vec3 sheen = vec3(0.16, 0.14, 0.10) * graze * (0.75 + 0.25 * s1 * s2 + 0.15 * s3);
      vec3 lit = waterLight(c, sheen, vRoom, vWorld);
      float a = mix(0.52, 0.94, max(murk, graze)) * smoothstep(0.0, 0.04, d);
      gl_FragColor = vec4(lit, a);
    }
  `;
  const bodyVertex = /* glsl */ `
    attribute float aRoom;
    uniform float uLevel[${n}];
    varying vec3 vWorld;
    varying float vLevel;
    varying float vRoom;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vLevel = uLevel[int(aRoom + 0.5)];
      vRoom = aRoom;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `;
  const bodyFragment = /* glsl */ `
    uniform float uTime;
    varying vec3 vWorld;
    varying float vLevel;
    varying float vRoom;
    ${lighting}
    void main() {
      float dd = vLevel - vWorld.y;
      if (dd <= 0.0) discard;
      float murk = 1.0 - exp(-0.9 * dd);
      vec3 c = mix(vec3(0.02, 0.10, 0.088), vec3(0.004, 0.03, 0.027), murk);
      // The wet line where the surface meets the wall, bobbing a little.
      float bob = 0.012 * sin(vWorld.x * 1.7 + vWorld.z * 1.3 + uTime * 1.5);
      float line = 1.0 - smoothstep(0.0, 0.035, dd + bob);
      c += vec3(0.05, 0.09, 0.08) * line;
      vec3 lit = waterLight(c, vec3(0.0), vRoom, vWorld);
      gl_FragColor = vec4(lit, max(0.22 + 0.5 * murk, 0.6 * line));
    }
  `;
  return { surfaceVertex, surfaceFragment, bodyVertex, bodyFragment };
}

export interface WaterMaterials {
  surface: ShaderMaterial;
  body: ShaderMaterial;
  /** Each room's shown level (earth z), shared by both; dry: DRY_LEVEL. */
  levels: Float32Array;
  /** Each room's lamps (0..1), shared by both and the rooms. */
  power: Float32Array;
}

/** The surface and body materials, sharing the level and power arrays. */
export function waterMaterials(count: number): WaterMaterials {
  const n = Math.max(1, count);
  const levels = new Float32Array(n).fill(DRY_LEVEL);
  const power = new Float32Array(n).fill(1);
  const sh = waterShaders(n);
  const uniforms = () => ({
    uLevel: { value: levels },
    uRoomPower: { value: power },
    uTime: { value: 0 },
    uTorchOn: { value: 0 },
    uTorchPos: { value: new Vector3() },
    uTorchDir: { value: new Vector3(0, 0, -1) },
  });
  const surface = new ShaderMaterial({
    vertexShader: sh.surfaceVertex,
    fragmentShader: sh.surfaceFragment,
    uniforms: uniforms(),
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  surface.forceSinglePass = true;
  const body = new ShaderMaterial({
    vertexShader: sh.bodyVertex,
    fragmentShader: sh.bodyFragment,
    uniforms: uniforms(),
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    fog: false,
  });
  // The torch is one light: the body shares the surface's vectors.
  body.uniforms.uTorchOn = surface.uniforms.uTorchOn;
  body.uniforms.uTorchPos = surface.uniforms.uTorchPos;
  body.uniforms.uTorchDir = surface.uniforms.uTorchDir;
  body.uniforms.uTime = surface.uniforms.uTime;
  return { surface, body, levels, power };
}
