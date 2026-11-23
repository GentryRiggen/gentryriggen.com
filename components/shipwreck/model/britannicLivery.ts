import type { BufferAttribute, Group, Mesh } from "three";
import { BRITANNIC_PAINT } from "@/lib/shipwreck/ships/britannic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { britannicRecipe, type BritannicPaint } from "./britannicRecipe";
import type { QualitySettings } from "./buildShip";
import { GeoBuffer, box, rgb } from "./geoBuffer";
import { setHullPaint, type HullPaint, type ShipMaterials } from "./materials";
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
 *   crosses: `setHullPaint`);
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
  /** Each look's recipe (`recipeFor(spec, look)`). */
  recipeOf(look: BritannicPaint): ShipRecipe;
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
  /** Wears `look`; false (and nothing changes) for a look she lacks. */
  setPaint(look: string): boolean;
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
  const funnelColors = t.funnels.map((fg, i) => {
    const mesh = fg?.getObjectByName("funnel") as Mesh | undefined;
    if (!mesh) return null;
    const attr = mesh.geometry.getAttribute("color") as BufferAttribute;
    const linerGeo = funnelGeometry(
      cutFunnel(
        hospital.funnels[i],
        liner.funnels[i],
        liner.paint?.funnelTop as number
      ),
      t.q,
      liner.paint
    );
    const linerColors = linerGeo.getAttribute("color").array as Float32Array;
    linerGeo.dispose();
    if (linerColors.length !== attr.array.length) return null;
    return {
      attr,
      hospital: Float32Array.from(attr.array as Float32Array),
      liner: Float32Array.from(linerColors),
    };
  });

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
  const hulls = {
    hospital: hullPaintOf(hospital, spec),
    liner: hullPaintOf(liner, spec),
  };

  let wearing: BritannicPaint | null = null;
  function setPaint(next: string): boolean {
    if (!isLook(next)) return false;
    if (next === wearing) return true;
    wearing = next;
    setHullPaint(mats.hull, hulls[next]);
    for (const m of marks) m.visible = next === "hospital";
    for (const f of funnelColors) {
      if (!f) continue;
      (f.attr.array as Float32Array).set(f[next]);
      f.attr.needsUpdate = true;
    }
    Object.assign(mats.decal, boards[next]);
    return true;
  }
  if (!setPaint(look)) setPaint(BRITANNIC_PAINT);

  return {
    setPaint,
    dispose() {
      releaseShipTextures(liner.paint?.name);
    },
  };
}
