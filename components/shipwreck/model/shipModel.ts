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
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";
import { defaultLivery, type ShipSpec } from "@/lib/shipwreck/ships/types";
import type { ShipPart } from "./breakCut";
import {
  QUALITY,
  buildShipPart,
  guyLines,
  mastGeometry,
  splitAtHinge,
  type LineList,
  type ModelQuality,
  type ShipPartData,
} from "./buildShip";
import type { GeoBuffer } from "./geoBuffer";
import {
  createShipMaterials,
  TITANIC_HULL_PAINT,
  type HullPaint,
  type LightUniforms,
  type ShipMaterials,
} from "./materials";
import { carpathiaRecipe } from "./carpathiaRecipe";
import {
  attachBritannicLivery,
  britannicModelRecipe,
  type Livery,
} from "./britannicLivery";
import { britannicRecipe, type BritannicPaint } from "./britannicRecipe";
import { fitzgeraldRecipe } from "./fitzgeraldRecipe";
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
import {
  acquireDazzleTexture,
  acquireShipTextures,
  releaseDazzleTexture,
  releaseShipTextures,
  type DazzleFrame,
  type NameStyle,
} from "./textures";
import {
  swungOutY,
  titanicRecipe,
  type BoatRecipe,
  type LightSpot,
  type MastRecipe,
  type Placement,
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * A ship (the Titanic, the Lusitania, the Edmund Fitzgerald or the
 * Carpathia) as a three.js object tree, plus the
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
  /**
   * The bow forward of the recipe's hinge (R12), a child of `whole`, or
   * null (no hinge, or built broken): pose it with `applyBowBend`.
   */
  bend?: Group | null;
  breakX: number | null;
  /** One group per funnel, origin at the centre of its foot. */
  funnels: Group[];
  /** Each funnel's guy wires (hide them when it falls). */
  funnelGuys: (LineSegments | null)[];
  /**
   * The foremast as its own part (the Britannic's, which lies on the floor
   * by her wreck [WP]): its group, origin at the centre of its foot and its
   * length up local +y, and its recipe. Missing where it is merged into
   * the paint mesh (every other ship).
   */
  foremast?: { group: Group; mast: MastRecipe } | null;
  /** Shows or hides that foremast's wires (stays, shrouds, the aerial). */
  showForemastWires?(show: boolean): void;
  light: LightUniforms;
  setPower(power: number): void;
  setDeckPower(deck: number, power: number): void;
  setFlicker(amount: number): void;
  /** Seconds, for the flicker pattern (the component sets it each frame). */
  setTime(seconds: number): void;
  boats: BoatControls;
  recipe: ShipRecipe;
  quality: ModelQuality;
  /**
   * Repaints her in livery `id` (one of `liveries`; others are ignored):
   * swaps vertex colours, the hull's uniforms and which small paint-only
   * parts show (a funnel's bands, the name boards). Never builds or frees
   * geometry, so it is safe mid-run (README, "Liveries").
   */
  setLivery(id: string): void;
  /** The livery shown (null: a ship with one paint). */
  readonly livery: string | null;
  /** The liveries she can show (empty: one paint). */
  liveries: readonly string[];
  /**
   * Runs `compile` (e.g. `gl.compile(scene, camera)`) with every livery's
   * parts shown, then hands each of their textures to `upload` (e.g.
   * `gl.initTexture`), so a first swap neither compiles a shader nor
   * uploads a texture (the Carpathia's name boards are drawn in 1912
   * only).
   */
  warmLiveries(compile: () => void, upload?: (texture: Texture) => void): void;
  /**
   * Triangles in the model (instances counted), the build time, and the
   * last livery swap's time (ms, main thread).
   */
  stats: { triangles: number; buildMs: number; liveryMs: number };
}

export interface TitanicModel {
  handles: TitanicHandles;
  /** Triangles in the model (instances counted), for the budget. */
  triangles: number;
  dispose(): void;
}

const recipes = new WeakMap<ShipSpec, Map<string, ShipRecipe>>();
/**
 * The ship's detail recipe in livery `livery` (default her default
 * livery; a ship with one paint ignores it), built once per spec and
 * livery. The Carpathia's recipe also knows `grey-1918`, which the game
 * does not offer; the Britannic's livery is her paint (`BritannicPaint`).
 */
export function recipeFor(spec: ShipSpec, livery?: string | null): ShipRecipe {
  let byLivery = recipes.get(spec);
  if (!byLivery) {
    byLivery = new Map();
    recipes.set(spec, byLivery);
  }
  const own = defaultLivery(spec);
  const key = own === null ? "" : (livery ?? own);
  let r = byLivery.get(key);
  if (!r) {
    const id = key || undefined;
    r =
      spec.id === "lusitania"
        ? lusitaniaRecipe(spec, id)
        : spec.id === "fitzgerald"
          ? fitzgeraldRecipe(spec)
          : spec.id === "carpathia"
            ? carpathiaRecipe(spec, id)
            : spec.id === "britannic"
              ? britannicRecipe(spec, id as BritannicPaint)
              : titanicRecipe(spec);
    byLivery.set(key, r);
  }
  return r;
}

/** The Britannic's model recipe (both liveries' geometry), per spec. */
const liveryRecipes = new WeakMap<ShipSpec, ShipRecipe>();
function modelRecipeFor(spec: ShipSpec, livery?: string | null): ShipRecipe {
  if (spec.id !== "britannic") return recipeFor(spec, livery);
  let r = liveryRecipes.get(spec);
  if (!r) {
    r = britannicModelRecipe(spec);
    liveryRecipes.set(spec, r);
  }
  return r;
}

/** The dazzle's frame: the whole hull, keel to above the boat deck houses. */
export function dazzleFrame(r: ShipRecipe): DazzleFrame {
  const x0 = Math.round(r.hull.xMin * 100) / 100;
  const length = Math.round((r.hull.xMax - r.hull.xMin) * 100) / 100;
  return { x0, length, height: 28 };
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

/** The merged triangle lists of a part, each its own mesh. */
const MERGED = [
  "hull",
  "paint",
  "deck",
  "bronze",
  "decal",
  "dazzle",
  "variant",
] as const;
type MergedKey = (typeof MERGED)[number];
/** Their meshes' names. */
const MERGED_NAME: Record<MergedKey, string> = {
  hull: "hull",
  paint: "paint",
  deck: "decks",
  bronze: "propellers",
  decal: "names",
  dazzle: "dazzle",
  variant: "livery-parts",
};

function sameNumbers(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Whether two lists are the same triangles (their colours aside). */
function sameShape(a: GeoBuffer, b: GeoBuffer): boolean {
  return (
    sameNumbers(a.pos, b.pos) &&
    sameNumbers(a.idx, b.idx) &&
    sameNumbers(a.uv, b.uv) &&
    sameNumbers(a.uv1, b.uv1) &&
    sameNumbers(a.extra, b.extra)
  );
}

/** Whether two geometries are the same triangles (colours aside). */
function sameGeometry(a: BufferGeometry, b: BufferGeometry): boolean {
  const ia = a.index;
  const ib = b.index;
  if ((ia === null) !== (ib === null)) return false;
  return (
    sameNumbers(
      a.getAttribute("position").array,
      b.getAttribute("position").array
    ) &&
    (ia === null || sameNumbers(ia.array, ib!.array))
  );
}

/** Thrown when a livery moves something only a rebuild could move. */
function liveryShapeError(id: string, what: string): Error {
  return new Error(
    `livery ${id} changes the ${what}'s shape: a livery is paint only (README, "Liveries")`
  );
}

interface ModelOptions {
  quality: ModelQuality;
  breakX: number | null;
  /**
   * The livery to show first (default hers). Any id her recipe knows
   * (the Carpathia's `grey-1918` too); others ignore it.
   */
  livery?: string | null;
}

/**
 * Builds a ship's model. If the build throws (a livery that moves a shape,
 * say), everything it had already taken (shared textures, the dazzle
 * texture, materials, geometries) is released before the error goes on.
 */
export function createTitanicModel(
  spec: ShipSpec,
  options: ModelOptions
): TitanicModel {
  const undo: Array<() => void> = [];
  try {
    return buildModel(spec, options, undo);
  } catch (err) {
    for (const u of undo.reverse()) u();
    throw err;
  }
}

function buildModel(
  spec: ShipSpec,
  options: ModelOptions,
  undo: Array<() => void>
): TitanicModel {
  const { quality, breakX } = options;
  const started = performance.now();
  // Her liveries: the default is built as always; each other one is built
  // too (its recipe and its triangle lists) to take its colours, so a
  // swap is a copy of numbers, never a rebuild. (The Britannic swaps her
  // two paints her own way: britannicLivery.ts.)
  const listed =
    spec.id !== "britannic" && spec.liveries && spec.liveries.length >= 2
      ? spec.liveries.map((l) => l.id)
      : [];
  const base = listed.length > 0 ? defaultLivery(spec) : null;
  const liveryIds = [...listed];
  if (base !== null && options.livery && !liveryIds.includes(options.livery))
    liveryIds.push(options.livery);
  const recipe = modelRecipeFor(spec, base);
  const alts = liveryIds
    .filter((id) => id !== base)
    .map((id) => ({ id, r: recipeFor(spec, id) }));
  const q = QUALITY[quality];
  const shipName = recipe.paint?.name ?? "TITANIC";
  const letters = recipe.paint?.letters;
  const nameStyle: NameStyle | undefined = letters && {
    ...letters,
    port: recipe.paint?.port ?? "LIVERPOOL",
  };
  // Every livery shares the name boards' texture (only whether they show
  // changes).
  for (const a of alts) {
    const p = a.r.paint;
    if (
      (p?.name ?? "TITANIC") !== shipName ||
      JSON.stringify(p?.letters ?? null) !== JSON.stringify(letters ?? null) ||
      (p?.port ?? "LIVERPOOL") !== (recipe.paint?.port ?? "LIVERPOOL")
    )
      throw liveryShapeError(a.id, "name");
  }
  const textures = acquireShipTextures(shipName, nameStyle);
  undo.push(() => releaseShipTextures(shipName, nameStyle));
  // Dazzle: one texture along the hull, from the keel to the houses' tops,
  // when any of her liveries has it (switched off in the others).
  const dazzled = [recipe, ...alts.map((a) => a.r)].some(
    (r) => r.paint?.dazzle
  );
  const dazzleTexture = dazzled
    ? acquireDazzleTexture(dazzleFrame(recipe))
    : null;
  if (dazzleTexture) undo.push(() => releaseDazzleTexture(dazzleTexture));
  const hullPaintOf = (r: ShipRecipe): HullPaint | undefined =>
    r.paint && {
      loadWaterline: r.layout.loadWaterline,
      bootTop: r.layout.bootTop,
      sheerLine: r.paint.sheerLine,
      topsides: r.paint.hull?.topsides,
      bottom: r.paint.hull?.bottom,
      relief: r.paint.hull?.relief,
      boot: r.paint.hull?.boot,
      ...(r.paint.band && {
        band: { ...r.paint.band, sheer0: spec.sheerZ(0) },
      }),
      ...(dazzleTexture
        ? {
            dazzle: { texture: dazzleTexture, frame: dazzleFrame(recipe) },
            dazzleOn: r.paint.dazzle === true,
          }
        : {}),
    };
  const mats = createShipMaterials(textures, {
    rivets: q.rivets,
    hull: hullPaintOf(recipe),
    paintedNames: letters !== undefined,
  });
  undo.push(() => mats.dispose());
  const geometries: BufferGeometry[] = [];
  // Instanced meshes hold their instance buffers on the mesh, not the
  // geometry: three frees those only on the mesh's own dispose.
  const instancedMeshes: InstancedMesh[] = [];
  undo.push(() => {
    for (const m of instancedMeshes) m.dispose();
    for (const g of geometries) g.dispose();
  });
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
  const sharedOf = (r: ShipRecipe) => ({
    vent: ventGeometry(q, r.paint?.ventLining, r.paint?.vent),
    drum: drumVentGeometry(q, r.paint?.ventLining, r.paint?.vent),
    lifeboat: boatGeometry("lifeboat", q, r.paint?.boat),
  });
  const painted = sharedOf(recipe);
  const shared = {
    vent: own(painted.vent),
    drum: own(painted.drum),
    bench: own(benchGeometry()),
    bollard: own(bollardGeometry(q)),
    post: own(postGeometry()),
    porthole: own(portholePaneGeometry()),
    window: own(windowPaneGeometry()),
    lifeboat: own(painted.lifeboat),
    collapsible: own(boatGeometry("collapsible", q)),
  };

  const parts: ShipPart[] = breakX === null ? ["whole"] : ["bow", "stern"];
  // The Britannic's foremast is its own part, to lie on the floor by her
  // wreck [WP] (scene/mastWreck.ts).
  const apartMasts: MastRecipe["id"][] =
    spec.id === "britannic" ? ["fore"] : [];
  const built: ShipPartData[] = parts.map((p) =>
    buildShipPart(recipe, p, breakX, quality, apartMasts)
  );
  // A ship whose bow bends (R12): the bow forward of the hinge in its own
  // group inside the whole ship's, so everything else still sees "whole".
  let bend: Group | null = null;
  const partData: { d: ShipPartData; group: Group }[] = [];
  if (breakX === null && recipe.hinge) {
    const { aft, fwd } = splitAtHinge(built[0], recipe.hinge.x);
    bend = new Group();
    bend.name = "bow-bend";
    whole.add(bend);
    partData.push({ d: aft, group: whole }, { d: fwd, group: bend });
  } else for (const d of built) partData.push({ d, group: holders[d.part] });

  const funnels: Group[] = [];
  const funnelGuys: (LineSegments | null)[] = [];
  const boatHolder: Group[] = [];
  // Each part's meshes and lines, and each funnel's mesh (for liveries).
  const partMeshes: Partial<Record<MergedKey, Mesh>>[] = [];
  const partLines: (LineSegments | null)[] = [];
  const funnelMeshes: (Mesh | null)[] = [];
  let foremast: { group: Group; mast: MastRecipe } | null = null;
  /** Line meshes holding the foremast's wires after their first `keep`. */
  const mastWires: { lines: LineSegments; keep: number }[] = [];
  /** Each mast built apart's mesh (for liveries). */
  const mastMeshes: (Mesh | null)[] = [];

  function addMesh(
    group: Group,
    g: BufferGeometry,
    m: Material,
    name: string
  ): Mesh | null {
    if (g.getAttribute("position").count === 0) return null;
    const mesh = new Mesh(own(g), m);
    mesh.name = name;
    group.add(mesh);
    triangles += triCount(g);
    return mesh;
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
    const outY = swungOutY(b);
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

  /** A merged list's material (the variant parts are painted). */
  function materialOf(key: MergedKey): Material | undefined {
    return key === "variant" ? mats.paint : mats[key];
  }

  partData.forEach(({ d, group }, pi) => {
    const meshes: Partial<Record<MergedKey, Mesh>> = {};
    const put = (key: MergedKey, mesh: Mesh | null) => {
      if (mesh) meshes[key] = mesh;
    };
    for (const key of MERGED) {
      const material = materialOf(key);
      // The dazzle list only for a ship with a dazzle livery; the variant
      // parts only for a ship with some.
      if (
        !material ||
        ((key === "dazzle" || key === "variant") && d[key].vertexCount === 0)
      )
        continue;
      put(key, addMesh(group, d[key].toGeometry(), material, MERGED_NAME[key]));
    }
    partMeshes[pi] = meshes;
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
    const keep = d.lines.pos.length / 3;
    const lines = lineMesh(
      d.mastLines.pos.length === 0
        ? d.lines
        : {
            pos: [...d.lines.pos, ...d.mastLines.pos],
            col: [...d.lines.col, ...d.mastLines.col],
          },
      mats.lines
    );
    if (lines) {
      own(lines.geometry);
      lines.name = "rails-and-rigging";
      group.add(lines);
      if (d.mastLines.pos.length > 0) mastWires.push({ lines, keep });
    }
    for (const i of d.masts) {
      const m = recipe.masts[i];
      const mg = new Group();
      mg.name = `mast-${m.id}`;
      toThree([m.x, 0, m.baseZ], mg.position);
      // The paint material and her mast paint, as the merged mast's.
      mastMeshes[i] = addMesh(
        mg,
        mastGeometry(recipe, i, quality),
        mats.paint,
        "mast"
      );
      group.add(mg);
      if (m.id === "fore") foremast = { group: mg, mast: m };
    }
    partLines[pi] = lines;
    for (const i of d.funnels) {
      const f = recipe.funnels[i];
      const fg = new Group();
      fg.name = `funnel-${i}`;
      toThree([f.x, 0, f.baseZ], fg.position);
      funnelMeshes[i] = addMesh(
        fg,
        funnelGeometry(f, q, recipe.paint),
        mats.paint,
        "funnel"
      );
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

  // ---------------------------------------------------------------------
  // Liveries: each other livery's colours for every list of the same
  // shape, and its own (hidden) mesh where the shape differs (a funnel's
  // bands, the name boards). Instances, lines and boats must not move.
  /** A colour attribute and its numbers in each livery that differs. */
  const swaps: { attr: BufferAttribute; by: Map<string, Float32Array> }[] = [];
  /** A mesh shown in some liveries only. */
  const variants: { obj: Object3D; ids: Set<string> }[] = [];
  const hullPaints = new Map<string, HullPaint | undefined>();
  if (base !== null) hullPaints.set(base, hullPaintOf(recipe));

  /** Takes `id`'s colours for `attr` when they differ from the base's. */
  function swapColors(
    attr: BufferAttribute | undefined,
    id: string,
    colors: ArrayLike<number>
  ) {
    if (!attr) return;
    const next = Float32Array.from(colors);
    if (sameNumbers(attr.array, next)) return;
    let s = swaps.find((w) => w.attr === attr);
    if (!s) {
      s = { attr, by: new Map([[base!, Float32Array.from(attr.array)]]) };
      swaps.push(s);
    }
    s.by.set(id, next);
  }
  function colorOf(obj: Mesh | LineSegments): BufferAttribute | undefined {
    return obj.geometry.getAttribute("color") as BufferAttribute | undefined;
  }
  /** Shows `obj` in every livery but `id` (it differs there). */
  function notIn(obj: Object3D, id: string) {
    let v = variants.find((w) => w.obj === obj);
    if (!v) {
      v = { obj, ids: new Set(liveryIds) };
      variants.push(v);
    }
    v.ids.delete(id);
  }
  function onlyIn(obj: Object3D, id: string) {
    obj.visible = false;
    variants.push({ obj, ids: new Set([id]) });
  }

  for (const a of alts) {
    hullPaints.set(a.id, hullPaintOf(a.r));
    if (JSON.stringify(a.r.boats) !== JSON.stringify(recipe.boats))
      throw liveryShapeError(a.id, "boats");
    const altShared = sharedOf(a.r);
    for (const key of ["vent", "drum", "lifeboat"] as const) {
      const g = altShared[key];
      if (!sameGeometry(shared[key], g)) throw liveryShapeError(a.id, key);
      swapColors(
        shared[key].getAttribute("color") as BufferAttribute,
        a.id,
        g.getAttribute("color").array
      );
      g.dispose();
    }
    parts.forEach((part, pi) => {
      const { d, group } = partData[pi];
      const ad = buildShipPart(a.r, part, breakX, quality);
      for (const list of [
        "portholes",
        "windows",
        "vents",
        "drums",
        "benches",
        "bollards",
        "posts",
      ] as const)
        if (d[list].length !== ad[list].length)
          throw liveryShapeError(a.id, list);
      for (const key of MERGED) {
        const mesh = partMeshes[pi][key];
        if (sameShape(d[key], ad[key])) {
          if (mesh && d[key].opts.color)
            swapColors(colorOf(mesh), a.id, ad[key].col);
          continue;
        }
        // Another shape in this livery: its own mesh, shown only in it.
        if (mesh) notIn(mesh, a.id);
        if (ad[key].vertexCount === 0) continue;
        const material = materialOf(key);
        if (!material) continue;
        const alt = new Mesh(own(ad[key].toGeometry()), material);
        alt.name = `${MERGED_NAME[key]}-${a.id}`;
        group.add(alt);
        onlyIn(alt, a.id);
      }
      const lines = partLines[pi];
      if (!sameNumbers(d.lines.pos, ad.lines.pos))
        throw liveryShapeError(a.id, "rails");
      if (lines) swapColors(colorOf(lines), a.id, ad.lines.col);
      for (const i of d.funnels) {
        const fm = funnelMeshes[i];
        const g = funnelGeometry(a.r.funnels[i], q, a.r.paint);
        if (
          JSON.stringify(a.r.funnelGuys[i]) !==
          JSON.stringify(recipe.funnelGuys[i])
        )
          throw liveryShapeError(a.id, "funnel guys");
        if (fm && sameGeometry(fm.geometry, g)) {
          swapColors(colorOf(fm), a.id, g.getAttribute("color").array);
          g.dispose();
          continue;
        }
        if (fm) notIn(fm, a.id);
        const alt = new Mesh(own(g), mats.paint);
        alt.name = `funnel-${a.id}`;
        funnels[i].add(alt);
        onlyIn(alt, a.id);
      }
      // A mast built apart (the Britannic's foremast) takes the livery's
      // mast paint as the merged masts do.
      for (const i of d.masts) {
        const mm = mastMeshes[i];
        const g = mastGeometry(a.r, i, quality);
        if (!mm || !sameGeometry(mm.geometry, g))
          throw liveryShapeError(a.id, "mast");
        swapColors(colorOf(mm), a.id, g.getAttribute("color").array);
        g.dispose();
      }
    });
  }
  // Variants first shown only in another livery start hidden; the base's
  // own show (they are in every livery but those that differ).
  let livery = base;
  let liveryMs = 0;
  function setLivery(id: string) {
    if (livery === null || id === livery || !liveryIds.includes(id)) return;
    const t0 = performance.now();
    for (const s of swaps) {
      const next = s.by.get(id) ?? s.by.get(base!)!;
      (s.attr.array as Float32Array).set(next);
      s.attr.needsUpdate = true;
    }
    for (const v of variants) v.obj.visible = v.ids.has(id);
    mats.setHullPaint(hullPaints.get(id) ?? TITANIC_HULL_PAINT);
    livery = id;
    liveryMs = performance.now() - t0;
    handles.stats.liveryMs = liveryMs;
  }

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

  // The Britannic swaps her two paints her own way (britannicLivery.ts:
  // the look-only parts, the hull's band, the funnels' tops, the names)
  // behind the same handles as every ship's livery.
  let britLivery: Livery | null = null;
  const britIds =
    spec.id === "britannic" ? (spec.liveries ?? []).map((l) => l.id) : [];
  if (spec.id === "britannic")
    britLivery = attachBritannicLivery(
      {
        spec,
        recipeOf: (look) => recipeFor(spec, look),
        mats,
        q,
        funnels,
        holderAt: (x) =>
          breakX !== null
            ? x > breakX
              ? bow
              : stern
            : bend && recipe.hinge && x > recipe.hinge.x
              ? bend
              : whole,
        addMesh(group, buf, name) {
          if (buf.vertexCount === 0) return null;
          const g = buf.toGeometry();
          addMesh(group, g, mats.paint, name);
          return group.children[group.children.length - 1] as Mesh;
        },
      },
      options.livery ?? undefined
    );
  /** Any ship's livery swap (the Britannic's through her own). */
  function wear(id: string) {
    if (!britLivery) return setLivery(id);
    if (id === britLivery.wearing || !britIds.includes(id)) return;
    const t0 = performance.now();
    if (!britLivery.setPaint(id)) return;
    handles.recipe = recipeFor(spec, id);
    handles.stats.liveryMs = performance.now() - t0;
  }

  const light = mats.light;
  const handles: TitanicHandles = {
    root,
    whole,
    bow,
    stern,
    bend,
    breakX,
    funnels,
    funnelGuys,
    foremast,
    showForemastWires(show) {
      for (const w of mastWires)
        w.lines.geometry.setDrawRange(0, show ? Infinity : w.keep);
    },
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
    recipe: britLivery ? recipeFor(spec, britLivery.wearing) : recipe,
    quality,
    setLivery: wear,
    warmLiveries(compile, upload) {
      if (britLivery) {
        // Her look-only parts share the painted material; the liner's gilt
        // name board is the one texture a first swap would upload.
        compile();
        if (upload) for (const t of britLivery.textures) upload(t);
        return;
      }
      if (variants.length === 0) return;
      for (const v of variants) v.obj.visible = true;
      try {
        compile();
        if (upload)
          for (const v of variants) {
            const map = ((v.obj as Mesh).material as MeshStandardMaterial)?.map;
            if (map) upload(map);
          }
      } finally {
        for (const v of variants)
          v.obj.visible = livery !== null && v.ids.has(livery);
      }
    },
    get livery() {
      return britLivery ? britLivery.wearing : livery;
    },
    liveries: britLivery ? britIds : base === null ? [] : liveryIds,
    stats: { triangles, buildMs: performance.now() - started, liveryMs },
  };
  if (options.livery) setLivery(options.livery);

  return {
    handles,
    triangles,
    dispose() {
      for (const m of instancedMeshes) m.dispose();
      for (const g of geometries) g.dispose();
      mats.dispose();
      releaseShipTextures(shipName, nameStyle);
      if (dazzleTexture) releaseDazzleTexture(dazzleTexture);
      britLivery?.dispose();
    },
  };
}
