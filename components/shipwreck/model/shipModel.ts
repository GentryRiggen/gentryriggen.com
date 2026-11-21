import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Material,
} from "three";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { ShipPart } from "./breakCut";
import {
  QUALITY,
  buildShipPart,
  guyLines,
  type LineList,
  type ModelQuality,
  type ShipPartData,
} from "./buildShip";
import {
  createShipMaterials,
  type LightUniforms,
  type ShipMaterials,
} from "./materials";
import { lusitaniaRecipe } from "./lusitaniaRecipe";
import {
  benchGeometry,
  boatGeometry,
  bollardGeometry,
  drumVentGeometry,
  funnelGeometry,
  portholePaneGeometry,
  postGeometry,
  ventGeometry,
  windowPaneGeometry,
} from "./partGeometry";
import { acquireShipTextures, releaseShipTextures } from "./textures";
import {
  titanicRecipe,
  type BoatRecipe,
  type LightSpot,
  type Placement,
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * A ship (the Titanic or the Lusitania) as a three.js object tree, plus the
 * handles the scene drives each frame without React. See README.md for the
 * handle API.
 */

export interface BoatControls {
  readonly count: number;
  /** The boat's data (kind, side, stowed place). */
  info(index: number): BoatRecipe;
  /** The part (whole, bow or stern group) the boat rides on while aboard. */
  holderOf(index: number): Group;
  /** Back in its chocks. */
  stow(index: number): void;
  /**
   * Swung out (`swing` 0..1) and lowered `dropM` metres down the side,
   * riding with its part.
   */
  lower(index: number, dropM: number, swing?: number): void;
  /** Free of the ship: `matrix` in the model root's space (keel centre). */
  float(index: number, matrix: Matrix4): void;
  /**
   * Aboard, its middle at `position` turned by `quaternion`, both in its
   * part's own three.js axes (a boat hanging from its falls, plumb while
   * the ship lists).
   */
  hang(index: number, position: Vector3, quaternion: Quaternion): void;
  hide(index: number): void;
}

export interface TitanicHandles {
  /** Parent of everything; leave it at the scene origin. */
  root: Group;
  /** Ship-frame groups to pose with `applyBodyPose` (empty ones are fine). */
  whole: Group;
  bow: Group;
  stern: Group;
  breakX: number | null;
  /** One group per funnel, origin at the centre of its foot. */
  funnels: Group[];
  /** Each funnel's guy wires (hide them when it falls). */
  funnelGuys: (LineSegments | null)[];
  light: LightUniforms;
  setPower(power: number): void;
  setDeckPower(deck: number, power: number): void;
  setFlicker(amount: number): void;
  /** Seconds, for the flicker pattern (the component sets it each frame). */
  setTime(seconds: number): void;
  boats: BoatControls;
  recipe: ShipRecipe;
  quality: ModelQuality;
  /** Triangles in the model (instances counted) and the build time. */
  stats: { triangles: number; buildMs: number };
}

export interface TitanicModel {
  handles: TitanicHandles;
  /** Triangles in the model (instances counted), for the budget. */
  triangles: number;
  dispose(): void;
}

const recipes = new WeakMap<ShipSpec, ShipRecipe>();
export function recipeFor(spec: ShipSpec): ShipRecipe {
  let r = recipes.get(spec);
  if (!r) {
    r = spec.id === "lusitania" ? lusitaniaRecipe(spec) : titanicRecipe(spec);
    recipes.set(spec, r);
  }
  return r;
}

const m4 = new Matrix4();
const q4 = new Quaternion();
const v3a = new Vector3();
const v3b = new Vector3();
const yAxis = new Vector3(0, 1, 0);

/** Ship-frame point to three.js. */
export function toThree(p: V3, out = new Vector3()): Vector3 {
  return out.set(p[0], p[2], -p[1]);
}

function placementMatrix(p: Placement): Matrix4 {
  toThree(p.p, v3a);
  q4.setFromAxisAngle(yAxis, p.yaw);
  v3b.set(p.scale, p.scale, p.scale);
  return new Matrix4().compose(v3a, q4, v3b);
}

function paneMatrix(l: LightSpot, out: Matrix4): Matrix4 {
  const z = new Vector3(l.n[0], l.n[2], -l.n[1]).normalize();
  const x = new Vector3().crossVectors(yAxis, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new Vector3().crossVectors(z, x);
  out.makeBasis(x.multiplyScalar(l.w), y.multiplyScalar(l.h), z);
  toThree(l.p, v3a);
  out.setPosition(v3a);
  return out;
}

function instanced(
  geometry: BufferGeometry,
  material: Material,
  matrices: Matrix4[]
): InstancedMesh | null {
  if (matrices.length === 0) return null;
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function paneMesh(
  base: BufferGeometry,
  material: Material,
  spots: LightSpot[]
): InstancedMesh | null {
  if (spots.length === 0) return null;
  const g = base.clone();
  g.setAttribute(
    "aDeck",
    new InstancedBufferAttribute(
      Float32Array.from(spots, (s) => s.deck),
      1
    )
  );
  g.setAttribute(
    "aSeed",
    new InstancedBufferAttribute(
      Float32Array.from(spots, (s) => s.seed),
      1
    )
  );
  const mesh = new InstancedMesh(g, material, spots.length);
  spots.forEach((s, i) => mesh.setMatrixAt(i, paneMatrix(s, m4)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function lineMesh(list: LineList, material: Material): LineSegments | null {
  if (list.pos.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(list.pos), 3)
  );
  g.setAttribute("color", new BufferAttribute(new Float32Array(list.col), 3));
  g.computeBoundingSphere();
  return new LineSegments(g, material);
}

function triCount(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute("position").count) / 3;
}

export function createTitanicModel(
  spec: ShipSpec,
  options: { quality: ModelQuality; breakX: number | null }
): TitanicModel {
  const { quality, breakX } = options;
  const started = performance.now();
  const recipe = recipeFor(spec);
  const q = QUALITY[quality];
  const shipName = recipe.paint?.name ?? "TITANIC";
  const textures = acquireShipTextures(shipName);
  const mats: ShipMaterials = createShipMaterials(textures, {
    rivets: q.rivets,
    hull: recipe.paint && {
      loadWaterline: recipe.layout.loadWaterline,
      bootTop: recipe.layout.bootTop,
      sheerLine: recipe.paint.sheerLine,
    },
  });
  const geometries: BufferGeometry[] = [];
  // Instanced meshes hold their instance buffers on the mesh, not the
  // geometry: three frees those only on the mesh's own dispose.
  const instancedMeshes: InstancedMesh[] = [];
  const own = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  let triangles = 0;

  const root = new Group();
  root.name = spec.id;
  const whole = new Group();
  whole.name = "whole";
  const bow = new Group();
  bow.name = "bow";
  const stern = new Group();
  stern.name = "stern";
  root.add(whole, bow, stern);
  const holders: Record<ShipPart, Group> = { whole, bow, stern };

  // Shared fitting geometry.
  const shared = {
    vent: own(ventGeometry(q, recipe.paint?.ventLining)),
    drum: own(drumVentGeometry(q, recipe.paint?.ventLining)),
    bench: own(benchGeometry()),
    bollard: own(bollardGeometry(q)),
    post: own(postGeometry()),
    porthole: own(portholePaneGeometry()),
    window: own(windowPaneGeometry()),
    lifeboat: own(boatGeometry("lifeboat", q)),
    collapsible: own(boatGeometry("collapsible", q)),
  };

  const parts: ShipPart[] = breakX === null ? ["whole"] : ["bow", "stern"];
  const partData: ShipPartData[] = parts.map((p) =>
    buildShipPart(recipe, p, breakX, quality)
  );

  const funnels: Group[] = [];
  const funnelGuys: (LineSegments | null)[] = [];
  const boatHolder: Group[] = [];

  function addMesh(group: Group, g: BufferGeometry, m: Material, name: string) {
    if (g.getAttribute("position").count === 0) return;
    const mesh = new Mesh(own(g), m);
    mesh.name = name;
    group.add(mesh);
    triangles += triCount(g);
  }
  function addInstanced(
    group: Group,
    mesh: InstancedMesh | null,
    name: string
  ) {
    if (!mesh) return;
    mesh.name = name;
    instancedMeshes.push(mesh);
    group.add(mesh);
    triangles += triCount(mesh.geometry) * mesh.count;
  }

  // Boats: per part, one instanced mesh per boat type (stowed or lowered
  // boats ride with their part); two more in the root for boats afloat.
  type BoatSlot = { mesh: InstancedMesh; slot: number };
  const aboard = new Map<number, BoatSlot>();
  const afloat = new Map<number, BoatSlot>();
  const zero = new Matrix4().makeScale(0, 0, 0);

  function stowedMatrix(
    b: BoatRecipe,
    dropM = 0,
    swing = 0,
    out = new Matrix4()
  ): Matrix4 {
    const s = b.side === "port" ? 1 : -1;
    const outY = s * (Math.abs(b.edgeY) + 0.35 + b.beam / 2 + 0.7);
    const y = b.y + (outY - b.y) * swing;
    v3a.set(b.x, b.z - dropM, -y);
    q4.identity();
    v3b.set(b.length, b.depth, b.beam);
    return out.compose(v3a, q4, v3b);
  }

  function boatMeshes(
    group: Group,
    indices: number[],
    into: Map<number, BoatSlot>,
    visible: boolean,
    name: string
  ) {
    for (const kind of ["lifeboat", "collapsible"] as const) {
      const list = indices.filter((i) =>
        kind === "collapsible"
          ? recipe.boats[i].kind === "collapsible"
          : recipe.boats[i].kind !== "collapsible"
      );
      if (list.length === 0) continue;
      const mesh = new InstancedMesh(
        kind === "lifeboat" ? shared.lifeboat : shared.collapsible,
        mats.paint,
        list.length
      );
      mesh.name = `${name}-${kind}`;
      mesh.frustumCulled = false;
      instancedMeshes.push(mesh);
      list.forEach((i, slot) => {
        mesh.setMatrixAt(slot, visible ? stowedMatrix(recipe.boats[i]) : zero);
        into.set(i, { mesh, slot });
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      triangles += visible ? triCount(mesh.geometry) * list.length : 0;
    }
  }

  partData.forEach((d) => {
    const group = holders[d.part];
    addMesh(group, d.hull.toGeometry(), mats.hull, "hull");
    addMesh(group, d.paint.toGeometry(), mats.paint, "paint");
    addMesh(group, d.deck.toGeometry(), mats.deck, "decks");
    addMesh(group, d.bronze.toGeometry(), mats.bronze, "propellers");
    addMesh(group, d.decal.toGeometry(), mats.decal, "names");
    const portholes = paneMesh(shared.porthole, mats.pane, d.portholes);
    const windows = paneMesh(shared.window, mats.pane, d.windows);
    if (portholes) own(portholes.geometry);
    if (windows) own(windows.geometry);
    addInstanced(group, portholes, "portholes");
    addInstanced(group, windows, "windows");
    addInstanced(
      group,
      instanced(shared.vent, mats.paint, d.vents.map(placementMatrix)),
      "vents"
    );
    addInstanced(
      group,
      instanced(shared.drum, mats.paint, d.drums.map(placementMatrix)),
      "drum-vents"
    );
    addInstanced(
      group,
      instanced(shared.bench, mats.paint, d.benches.map(placementMatrix)),
      "benches"
    );
    addInstanced(
      group,
      instanced(shared.bollard, mats.paint, d.bollards.map(placementMatrix)),
      "bitts"
    );
    addInstanced(
      group,
      instanced(
        shared.post,
        mats.paint,
        d.posts.map((p) => new Matrix4().setPosition(toThree(p)))
      ),
      "rail-posts"
    );
    const lines = lineMesh(d.lines, mats.lines);
    if (lines) {
      own(lines.geometry);
      lines.name = "rails-and-rigging";
      group.add(lines);
    }
    for (const i of d.funnels) {
      const f = recipe.funnels[i];
      const fg = new Group();
      fg.name = `funnel-${i}`;
      toThree([f.x, 0, f.baseZ], fg.position);
      addMesh(fg, funnelGeometry(f, q, recipe.paint), mats.paint, "funnel");
      group.add(fg);
      funnels[i] = fg;
      const guys = q.rigging
        ? lineMesh(guyLines(recipe.funnelGuys[i]), mats.lines)
        : null;
      if (guys) {
        own(guys.geometry);
        guys.name = `funnel-guys-${i}`;
        group.add(guys);
      }
      funnelGuys[i] = guys;
    }
    for (const i of d.boats) boatHolder[i] = group;
    boatMeshes(group, d.boats, aboard, true, "boats");
  });
  const free = new Group();
  free.name = "boats-afloat";
  root.add(free);
  boatMeshes(
    free,
    recipe.boats.map((b) => b.index),
    afloat,
    false,
    "boats-afloat"
  );

  function put(map: Map<number, BoatSlot>, i: number, m: Matrix4) {
    const s = map.get(i);
    if (!s) return;
    s.mesh.setMatrixAt(s.slot, m);
    s.mesh.instanceMatrix.needsUpdate = true;
  }

  const boats: BoatControls = {
    count: recipe.boats.length,
    info: (i) => recipe.boats[i],
    holderOf: (i) => boatHolder[i],
    stow(i) {
      put(aboard, i, stowedMatrix(recipe.boats[i], 0, 0, m4));
      put(afloat, i, zero);
    },
    lower(i, dropM, swing = 1) {
      put(aboard, i, stowedMatrix(recipe.boats[i], dropM, swing, m4));
      put(afloat, i, zero);
    },
    float(i, matrix) {
      put(aboard, i, zero);
      const b = recipe.boats[i];
      v3b.set(b.length, b.depth, b.beam);
      m4.compose(
        v3a.setFromMatrixPosition(matrix),
        q4.setFromRotationMatrix(matrix),
        v3b
      );
      put(afloat, i, m4);
    },
    hang(i, position, quaternion) {
      const b = recipe.boats[i];
      v3b.set(b.length, b.depth, b.beam);
      put(aboard, i, m4.compose(position, quaternion, v3b));
      put(afloat, i, zero);
    },
    hide(i) {
      put(aboard, i, zero);
      put(afloat, i, zero);
    },
  };

  const light = mats.light;
  const handles: TitanicHandles = {
    root,
    whole,
    bow,
    stern,
    breakX,
    funnels,
    funnelGuys,
    light,
    setPower: (p) => {
      light.uPower.value = p;
    },
    setDeckPower: (deck, p) => {
      if (deck < 0 || deck >= light.uDeckPower.value.length) return;
      light.uDeckPower.value[deck] = p;
    },
    setFlicker: (a) => {
      light.uFlicker.value = a;
    },
    setTime: (t) => {
      light.uTime.value = t;
    },
    boats,
    recipe,
    quality,
    stats: { triangles, buildMs: performance.now() - started },
  };

  return {
    handles,
    triangles,
    dispose() {
      for (const m of instancedMeshes) m.dispose();
      for (const g of geometries) g.dispose();
      mats.dispose();
      releaseShipTextures(shipName);
    },
  };
}
