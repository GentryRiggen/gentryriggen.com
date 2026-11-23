import type { BufferAttribute, Group, Mesh, Texture } from "three";
import { BRITANNIC_PAINT } from "@/lib/shipwreck/ships/britannic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { britannicRecipe, type BritannicPaint } from "./britannicRecipe";
import type { QualitySettings } from "./buildShip";
import { GeoBuffer, box, rgb } from "./geoBuffer";
import type { HullPaint, ShipMaterials } from "./materials";
import { funnelGeometry } from "./partGeometry";
import { acquireShipTextures, releaseShipTextures } from "./textures";
import type { FunnelRecipe, ShipPaint, ShipRecipe } from "./titanicRecipe";

/**
 * The Britannic in either paint (R23), swapped on the built model with no
 * geometry rebuilt. Her two looks are the same ship (`britannicRecipe`
 * makes them from one recipe), so the model is built once from a recipe
 * that serves both, and a swap changes only:
 *
 * - the hull shader's uniforms (topsides, paint line, gold line, band and
 *   crosses: `mats.setHullPaint`);
 * - the funnels' vertex colours (each funnel is cut at both looks' black
 *   tops, so only the colour between the cuts changes);
 * - the hospital ship's painted boxes (the boat deck's crosses, "G.618"),
 *   their own mesh, shown or hidden;
 * - the name boards' texture (black painted letters or gilt).
 *
 * Draw calls and triangles are the same in both looks but for that one
 * small mesh of boxes.
 */

const LOOKS: readonly BritannicPaint[] = ["hospital", "liner"];

function isLook(look: string): look is BritannicPaint {
  return (LOOKS as readonly string[]).includes(look);
}

/** A paint's look: her own two, or a fun paint's (over the liner, 1.7). */
function lookOf(spec: ShipSpec, id: string): BritannicPaint | null {
  if (isLook(id)) return id;
  const from = spec.liveries?.find((l) => l.id === id)?.fun?.from ?? null;
  return from !== null && isLook(from) ? from : null;
}

/** The hull paint of a look's recipe (as `createTitanicModel` makes it). */
export function hullPaintOf(r: ShipRecipe, spec: ShipSpec): HullPaint {
  const p = r.paint;
  return {
    loadWaterline: r.layout.loadWaterline,
    bootTop: r.layout.bootTop,
    sheerLine: p?.sheerLine ?? null,
    topsides: p?.hull?.topsides,
    bottom: p?.hull?.bottom,
    relief: p?.hull?.relief,
    boot: p?.hull?.boot,
    ...(p?.band && { band: { ...p.band, sheer0: spec.sheerZ(0) } }),
  };
}

/**
 * A funnel cut at both looks' black tops: the liner's black top is a
 * stripe from its foot to the hospital ship's sooty lip, painted buff as
 * a hospital ship and black as a liner.
 */
function cutFunnel(
  hospital: FunnelRecipe,
  liner: FunnelRecipe,
  color: number
): FunnelRecipe {
  const H = hospital.topZ - hospital.baseZ;
  return {
    ...hospital,
    stripes: [
      ...(hospital.stripes ?? []),
      {
        from: (H - liner.blackTop) / H,
        to: (H - hospital.blackTop) / H,
        color,
      },
    ],
  };
}

/** The recipe the Britannic's model is built from: both looks' geometry. */
export function britannicModelRecipe(spec: ShipSpec): ShipRecipe {
  const hospital = britannicRecipe(spec, "hospital");
  const liner = britannicRecipe(spec, "liner");
  const paint = hospital.paint as ShipPaint;
  return {
    ...hospital,
    // The hospital ship's boxes are their own mesh (`attach`).
    boxes: [],
    funnels: hospital.funnels.map((f, i) =>
      cutFunnel(f, liner.funnels[i], paint.funnel)
    ),
  };
}

export interface LiveryTarget {
  spec: ShipSpec;
  /** Each paint's recipe (`recipeFor(spec, id)`): a look or a fun paint. */
  recipeOf(id: string): ShipRecipe;
  mats: ShipMaterials;
  q: QualitySettings;
  /** One group per funnel, its mesh named "funnel" inside. */
  funnels: Group[];
  /** The part group that holds ship-frame point x. */
  holderAt(x: number): Group;
  /** Adds a mesh of painted boxes to a group (owned and counted). */
  addMesh(group: Group, buf: GeoBuffer, name: string): Mesh | null;
}

export interface Livery {
  /** Wears paint `id`; false (and nothing changes) for one she lacks. */
  setPaint(id: string): boolean;
  /** The paint she wears now (a look, or a fun paint's id). */
  readonly wearing: string;
  /** The textures only another look shows (the liner's gilt names). */
  readonly textures: readonly Texture[];
  dispose(): void;
}

/** Fits the built Britannic for both paints; she wears `look` after. */
export function attachBritannicLivery(
  t: LiveryTarget,
  look: string = BRITANNIC_PAINT
): Livery {
  const { spec, mats } = t;
  const hospital = t.recipeOf("hospital");
  const liner = t.recipeOf("liner");

  // The hospital ship's boxes, grouped by the part each stands on.
  const marks: Mesh[] = [];
  const byPart = new Map<Group, GeoBuffer>();
  for (const b of hospital.boxes ?? []) {
    const g = t.holderAt(b.c[0]);
    let buf = byPart.get(g);
    if (!buf) {
      buf = new GeoBuffer({ color: true });
      byPart.set(g, buf);
    }
    box(buf, b.c, b.size, rgb(b.color), b.yaw ?? 0, b.pitch ?? 0);
  }
  byPart.forEach((buf, g) => {
    const m = t.addMesh(g, buf, "hospital-marks");
    if (m) marks.push(m);
  });

  // The funnels' colours in each look (the same cuts, so the same
  // vertices; only the stripe's colour and the top's differ).
  const funnelAttrs = t.funnels.map((fg) => {
    const mesh = fg?.getObjectByName("funnel") as Mesh | undefined;
    return mesh
      ? (mesh.geometry.getAttribute("color") as BufferAttribute)
      : null;
  });
  /** A liner-shaped paint's funnel colours (its recipe's paint). */
  function linerFunnels(r: ShipRecipe): (Float32Array | null)[] {
    return funnelAttrs.map((attr, i) => {
      if (!attr) return null;
      const geo = funnelGeometry(
        cutFunnel(
          hospital.funnels[i],
          liner.funnels[i],
          r.paint?.funnelTop as number
        ),
        t.q,
        r.paint
      );
      const colors = geo.getAttribute("color").array as Float32Array;
      geo.dispose();
      return colors.length === attr.array.length
        ? Float32Array.from(colors)
        : null;
    });
  }
  /** Each paint's funnel colours, made the first time she wears it. */
  const funnelsBy = new Map<string, (Float32Array | null)[]>([
    [
      "hospital",
      funnelAttrs.map((a) =>
        a ? Float32Array.from(a.array as Float32Array) : null
      ),
    ],
  ]);

  // The name boards: black painted letters, or her sisters' gilt.
  const hospitalBoard = mats.decal.map;
  const gilt = acquireShipTextures(liner.paint?.name);
  const boards = {
    hospital: {
      map: hospitalBoard,
      roughness: mats.decal.roughness,
      metalness: mats.decal.metalness,
    },
    liner: { map: gilt.names, roughness: 0.4, metalness: 0.6 },
  };
  const hulls = new Map<string, HullPaint>([
    ["hospital", hullPaintOf(hospital, spec)],
  ]);

  // Her own liner paint is ready from the start (fun paints are made the
  // first time she wears one).
  hulls.set("liner", hullPaintOf(liner, spec));
  funnelsBy.set("liner", linerFunnels(liner));

  let wearing: string = BRITANNIC_PAINT;
  let worn = false;
  function setPaint(next: string): boolean {
    const look = lookOf(spec, next);
    if (look === null) return false;
    if (worn && next === wearing) return true;
    if (!hulls.has(next)) {
      const r = t.recipeOf(next);
      hulls.set(next, hullPaintOf(r, spec));
      if (look === "liner") funnelsBy.set(next, linerFunnels(r));
    }
    worn = true;
    wearing = next;
    mats.setHullPaint(hulls.get(next)!);
    for (const m of marks) m.visible = look === "hospital";
    const colors = funnelsBy.get(next) ?? funnelsBy.get("hospital")!;
    funnelAttrs.forEach((attr, i) => {
      const c = colors[i];
      if (!attr || !c) return;
      (attr.array as Float32Array).set(c);
      attr.needsUpdate = true;
    });
    Object.assign(mats.decal, boards[look]);
    return true;
  }
  if (!setPaint(look)) setPaint(BRITANNIC_PAINT);

  return {
    setPaint,
    get wearing() {
      return wearing;
    },
    textures: gilt.names ? [gilt.names] : [],
    dispose() {
      releaseShipTextures(liner.paint?.name);
    },
  };
}
