import { BufferAttribute, BufferGeometry } from "three";
import { COLORS, type QualitySettings } from "./buildShip";
import { GeoBuffer, box, cylinder, rgb, type RGB } from "./geoBuffer";
import type { BoatKind, FunnelRecipe, ShipPaint, V3 } from "./titanicRecipe";

/**
 * Geometry for the separately moving or instanced parts: funnels (each its
 * own group, so the first can fall), lifeboats, ventilators, benches, bitts,
 * railing posts and the window and porthole panes. All in their own local
 * frame (ship-frame axes, converted to three.js by `GeoBuffer`).
 */

/**
 * A funnel in its own frame: origin at the centre of its foot, raked aft.
 * Buff with a black top and thin black guy bands, steam and waste pipes up
 * the forward face, a whistle on the working funnels, dark inside.
 */
export function funnelGeometry(
  f: FunnelRecipe,
  q: QualitySettings,
  paint?: Pick<ShipPaint, "funnel" | "funnelTop">
): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const H = f.topZ - f.baseZ;
  const lean = Math.tan(f.rake);
  const seg = q.funnelSeg;
  // Buff and black unless the ship says otherwise.
  const buff = rgb(paint?.funnel ?? COLORS.buff);
  const black = rgb(paint?.funnelTop ?? COLORS.black);
  const ringAt = (z: number, grow = 0): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < seg; i += 1) {
      const t = (i / seg) * Math.PI * 2;
      out.push([
        -lean * z + (f.semiA + grow) * Math.cos(t),
        (f.semiB + grow) * Math.sin(t),
        z,
      ]);
    }
    return out;
  };
  // Colour bands bottom to top; each its own section so edges stay sharp.
  const blackFrom = H - f.blackTop;
  const cuts: [number, number, RGB][] = [];
  const bandH = 0.28;
  let z0 = -0.6;
  for (const b of f.bands) {
    const zb = H * b;
    cuts.push([z0, zb, buff]);
    cuts.push([zb, zb + bandH, black]);
    z0 = zb + bandH;
  }
  cuts.push([z0, blackFrom, buff]);
  cuts.push([blackFrom, H, black]);
  for (const [a, b, color] of cuts) {
    const ra = ringAt(a);
    const rb = ringAt(b, b >= H - 0.01 ? 0.06 : 0);
    const ia = ra.map((p) => buf.vertex(p, color));
    const ib = rb.map((p) => buf.vertex(p, color));
    for (let i = 0; i < seg; i += 1) {
      const j = (i + 1) % seg;
      buf.tri(ia[i], ia[j], ib[j]);
      buf.tri(ia[i], ib[j], ib[i]);
    }
  }
  // The rim and the sooty inside.
  const outer = ringAt(H, 0.06);
  const inner = ringAt(H, -0.18);
  const deep = ringAt(H - 3.5, -0.18);
  const soot = rgb(0x0b0b0b);
  const io = outer.map((p) => buf.vertex(p, black));
  const ii = inner.map((p) => buf.vertex(p, black));
  for (let i = 0; i < seg; i += 1) {
    const j = (i + 1) % seg;
    buf.tri(io[i], io[j], ii[j]);
    buf.tri(io[i], ii[j], ii[i]);
  }
  const ii2 = inner.map((p) => buf.vertex(p, soot));
  const id = deep.map((p) => buf.vertex(p, soot));
  for (let i = 0; i < seg; i += 1) {
    const j = (i + 1) % seg;
    buf.tri(ii2[i], ii2[j], id[j]);
    buf.tri(ii2[i], id[j], id[i]);
  }
  const floor = buf.vertex([-lean * (H - 3.5), 0, H - 3.5], soot);
  for (let i = 0; i < seg; i += 1) buf.tri(floor, id[i], id[(i + 1) % seg]);

  // Pipes up the forward face, above the rim.
  const pseg = Math.max(6, Math.round(seg / 4));
  for (const p of f.pipes) {
    const xAt = (z: number) =>
      -lean * z +
      f.semiA * Math.sqrt(Math.max(0, 1 - (p.y / f.semiB) ** 2)) +
      p.r +
      0.08;
    const top = H + (f.dummy ? 0.6 : 1.3);
    cylinder(
      buf,
      [xAt(0.6), p.y, 0.6],
      [xAt(blackFrom), p.y, blackFrom],
      p.r,
      p.r,
      pseg,
      buff,
      { start: true, end: false }
    );
    cylinder(
      buf,
      [xAt(blackFrom), p.y, blackFrom],
      [xAt(top), p.y, top],
      p.r,
      p.r,
      pseg,
      black,
      { start: false, end: true }
    );
  }
  if (f.hasWhistle) {
    const z = H * 0.76;
    const x = -lean * z + f.semiA + 0.75;
    const brass = rgb(COLORS.brass);
    cylinder(buf, [x, 0, z], [x, 0, z + 1.2], 0.26, 0.26, pseg, brass);
    cylinder(buf, [x - 0.4, 0, z + 0.4], [x, 0, z + 0.4], 0.08, 0.08, 5, brass);
  }
  return buf.toGeometry();
}

/**
 * A boat in its own frame: origin on the keel at its middle, bow +x. The
 * wooden lifeboats and cutters are white with a varnished gunwale and a
 * canvas cover; the collapsibles are low, wooden-bottomed with canvas sides.
 */
export function boatGeometry(
  kind: BoatKind,
  q: QualitySettings
): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const isCollapsible = kind === "collapsible";
  // Unit boat 1 long, 1 wide, 1 deep; instances scale it.
  const stations = q.hullSub >= 3 ? 14 : 9;
  const shape = isCollapsible
    ? [
        [1, 1],
        [0.97, 0.55],
        [0.8, 0.12],
        [0, 0],
      ]
    : [
        [1, 1],
        [0.95, 0.62],
        [0.75, 0.25],
        [0.38, 0.05],
        [0, 0],
      ];
  const hullColor = rgb(isCollapsible ? 0xd8d2c0 : 0xf1efe8);
  const gunwale = rgb(isCollapsible ? 0x7a6a52 : 0x7a5230);
  const keelColor = rgb(isCollapsible ? 0x6d5e48 : 0xf1efe8);
  const rows: { y: number; z: number; color: RGB }[] = [];
  // Port gunwale down to the keel and up to the starboard gunwale.
  rows.push({ y: 1, z: 1.08, color: gunwale });
  for (const [y, z] of shape)
    rows.push({ y, z, color: z < 0.15 ? keelColor : hullColor });
  for (let i = shape.length - 2; i >= 0; i -= 1)
    rows.push({
      y: -shape[i][0],
      z: shape[i][1],
      color: shape[i][1] < 0.15 ? keelColor : hullColor,
    });
  rows.push({ y: -1, z: 1.08, color: gunwale });
  // Starboard to port, so (row step) x (+x) faces outboard.
  rows.reverse();
  const ids: number[][] = [];
  for (let i = 0; i <= stations; i += 1) {
    const t = -1 + (2 * i) / stations;
    const w = 0.5 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.2)), 0.6);
    const sheer = 0.12 * t * t;
    ids.push(
      rows.map((r) =>
        buf.vertex(
          [t * 0.5, r.y * w, Math.min(1.08, r.z) + (r.z >= 1 ? sheer : 0)],
          r.color
        )
      )
    );
  }
  for (let i = 0; i < stations; i += 1)
    for (let k = 0; k < rows.length - 1; k += 1) {
      const a = ids[i][k];
      const b = ids[i + 1][k];
      const c = ids[i + 1][k + 1];
      const d = ids[i][k + 1];
      buf.tri(a, d, c);
      buf.tri(a, c, b);
    }
  // The top: a canvas cover with a ridge, or the open collapsible's floor.
  const cover = rgb(isCollapsible ? 0x8a7a60 : 0xd8d0bb);
  const top: number[][] = [];
  for (let i = 0; i <= stations; i += 1) {
    const t = -1 + (2 * i) / stations;
    const w = 0.5 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.2)), 0.6);
    const sheer = 0.12 * t * t;
    const ridge = isCollapsible ? 0.0 : 0.22 * (1 - t * t * 0.6);
    const zEdge = 1.08 + sheer;
    top.push([
      buf.vertex([t * 0.5, w, zEdge], cover),
      buf.vertex(
        [t * 0.5, 0, zEdge + ridge - (isCollapsible ? 0.3 : 0)],
        cover
      ),
      buf.vertex([t * 0.5, -w, zEdge], cover),
    ]);
  }
  for (let i = 0; i < stations; i += 1)
    for (let k = 0; k < 2; k += 1) {
      const a = top[i][k];
      const b = top[i + 1][k];
      const c = top[i + 1][k + 1];
      const d = top[i][k + 1];
      // Rows port to starboard across the top: faces up.
      buf.tri(a, d, c);
      buf.tri(a, c, b);
    }
  return buf.toGeometry();
}

/**
 * A cowl ventilator, about 3 m tall at scale 1, mouth facing +x; its
 * mouth lined `lining` (default near black, the Titanic's).
 */
export function ventGeometry(
  q: QualitySettings,
  lining = 0x2a1a14
): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const white = rgb(COLORS.white);
  const seg = Math.max(8, q.cylSeg);
  cylinder(buf, [0, 0, 0], [0, 0, 0.35], 0.55, 0.5, seg, white, {
    start: false,
    end: true,
  });
  cylinder(buf, [0, 0, 0.3], [0, 0, 2.0], 0.36, 0.36, seg, white, {
    start: false,
    end: false,
  });
  cylinder(buf, [-0.05, 0, 1.9], [0.25, 0, 2.55], 0.37, 0.48, seg, white, {
    start: false,
    end: false,
  });
  cylinder(buf, [0.25, 0, 2.55], [0.85, 0, 2.75], 0.48, 0.72, seg, white, {
    start: false,
    end: false,
  });
  // The mouth's dark inside.
  cylinder(buf, [0.8, 0, 2.74], [0.84, 0, 2.75], 0.66, 0.68, seg, rgb(lining), {
    start: false,
    end: true,
  });
  return buf.toGeometry();
}

/**
 * A drum ("oil-drum") ventilator, about 2.7 m tall at scale 1: a fat
 * cylinder under a flat cap, the air drawn in through the dark gap.
 */
export function drumVentGeometry(
  q: QualitySettings,
  lining = 0x2a1a14
): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const white = rgb(COLORS.white);
  const seg = Math.max(10, q.cylSeg + 2);
  cylinder(buf, [0, 0, 0], [0, 0, 0.3], 1.0, 0.95, seg, white, {
    start: false,
    end: true,
  });
  cylinder(buf, [0, 0, 0.3], [0, 0, 2.2], 0.82, 0.82, seg, white, {
    start: false,
    end: false,
  });
  cylinder(buf, [0, 0, 2.2], [0, 0, 2.45], 0.7, 0.7, seg, rgb(lining), {
    start: false,
    end: false,
  });
  cylinder(buf, [0, 0, 2.45], [0, 0, 2.7], 1.08, 1.0, seg, white, {
    start: true,
    end: true,
  });
  return buf.toGeometry();
}

/** A teak bench with iron ends, seat facing +y. */
export function benchGeometry(): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const teak = rgb(0x7b5234);
  const iron = rgb(0x26262a);
  box(buf, [0, 0, 0.45], [1.9, 0.48, 0.07], teak);
  box(buf, [0, -0.24, 0.72], [1.9, 0.06, 0.42], teak, 0);
  for (const x of [-0.85, 0.85]) box(buf, [x, 0, 0.3], [0.08, 0.5, 0.6], iron);
  return buf.toGeometry();
}

/** A pair of mooring bitts on a base plate. */
export function bollardGeometry(q: QualitySettings): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  const black = rgb(0x1c1c1e);
  box(buf, [0, 0, 0.05], [1.3, 0.55, 0.1], black);
  for (const x of [-0.38, 0.38])
    cylinder(
      buf,
      [x, 0, 0.1],
      [x, 0, 0.7],
      0.19,
      0.19,
      Math.max(8, q.cylSeg),
      black
    );
  return buf.toGeometry();
}

/** One railing post, 1.05 m. */
export function postGeometry(): BufferGeometry {
  const buf = new GeoBuffer({ color: true });
  box(buf, [0, 0, 0.525], [0.05, 0.05, 1.05], rgb(COLORS.rail), 0, 0, {
    bottom: false,
  });
  return buf.toGeometry();
}

/**
 * A pane facing +z in three.js, unit size, with a rim: `aGlass` is 1 on the
 * glass (the part that lights up) and 0 on the rim.
 */
function pane(
  glass: [number, number][],
  rim: [number, number][][],
  rimHex: number
): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const isGlass: number[] = [];
  const idx: number[] = [];
  const glassColor = rgb(0x1b242c);
  const rimColor = rgb(rimHex);
  const fan = (pts: [number, number][], color: RGB, g: number, z: number) => {
    const base = pos.length / 3;
    pos.push(0, 0, z);
    col.push(...color);
    isGlass.push(g);
    for (const [x, y] of pts) {
      pos.push(x, y, z);
      col.push(...color);
      isGlass.push(g);
    }
    for (let i = 0; i < pts.length; i += 1)
      idx.push(base, base + 1 + i, base + 1 + ((i + 1) % pts.length));
  };
  fan(glass, glassColor, 1, 0);
  for (const ring of rim) {
    const base = pos.length / 3;
    for (const [x, y] of ring) {
      pos.push(x, y, 0.004);
      col.push(...rimColor);
      isGlass.push(0);
    }
    const n = ring.length / 2;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      idx.push(base + i, base + n + i, base + n + j);
      idx.push(base + i, base + n + j, base + j);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute("aGlass", new BufferAttribute(new Float32Array(isGlass), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A round porthole (unit diameter): glass in a brass rim. */
export function portholePaneGeometry(): BufferGeometry {
  const seg = 10;
  const circle = (r: number): [number, number][] =>
    Array.from({ length: seg }, (_, i) => {
      const t = (i / seg) * Math.PI * 2;
      return [Math.cos(t) * r, Math.sin(t) * r];
    });
  return pane(circle(0.4), [[...circle(0.4), ...circle(0.5)]], 0x8c6c3e);
}

/** A window (unit square): glass in a white frame. */
export function windowPaneGeometry(): BufferGeometry {
  const sq = (h: number): [number, number][] => [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  return pane(sq(0.42), [[...sq(0.42), ...sq(0.5)]], 0xe8e4d8);
}
