import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  LatheGeometry,
  TorusGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const SEGMENTS = 16;
const BAND_FLARE = 0.012;
/** Tube radius of the rolled rim; its top stands this far proud of the cap. */
export const RIM_TUBE = 0.03;
const RIM_RISE = RIM_TUBE * 0.6;

export interface FunnelDims {
  baseRadius: number;
  topRadius: number;
  bodyHeight: number;
  capHeight: number;
}

/** The body's radius at a height above its base. */
export function funnelRadiusAt(
  { baseRadius, topRadius, bodyHeight }: FunnelDims,
  height: number
): number {
  return topRadius + (baseRadius - topRadius) * (1 - height / bodyHeight);
}

function mergeAndDispose(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/**
 * The black top: the old cap cylinder with a rolled rim around its lip. The
 * rim rises 0.018 above the old top; everything else is the old outer size.
 */
export function buildFunnelCap(dims: FunnelDims): BufferGeometry {
  const { topRadius, bodyHeight, capHeight } = dims;
  const radius = topRadius + 0.01;
  const capTop = bodyHeight + capHeight;
  const cap = new CylinderGeometry(radius, radius, capHeight, SEGMENTS);
  cap.translate(0, bodyHeight + capHeight / 2, 0);
  const rim = new TorusGeometry(radius - 0.012, RIM_TUBE, 6, SEGMENTS);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, capTop - RIM_TUBE * 0.4, 0);
  return mergeAndDispose([cap, rim]);
}

/** The dark smoke opening, a disc just inside the rim. */
export function buildFunnelOpening(dims: FunnelDims): BufferGeometry {
  const { topRadius, bodyHeight, capHeight } = dims;
  const opening = new CircleGeometry((topRadius + 0.01) * 0.78, SEGMENTS);
  opening.rotateX(-Math.PI / 2);
  opening.translate(0, bodyHeight + capHeight + 0.003, 0);
  return opening;
}

const BANDS: { drop: number; height: number }[] = [
  { drop: 0.3, height: 0.1 },
  { drop: 0.52, height: 0.1 },
];

/** Two bands just under the cap, following the body's taper. */
export function buildFunnelBands(dims: FunnelDims): BufferGeometry {
  const parts = BANDS.map(({ drop, height }) => {
    const centre = dims.bodyHeight - drop;
    const band = new CylinderGeometry(
      funnelRadiusAt(dims, centre + height / 2) + BAND_FLARE,
      funnelRadiusAt(dims, centre - height / 2) + BAND_FLARE,
      height,
      SEGMENTS
    );
    band.translate(0, centre, 0);
    return band;
  });
  return mergeAndDispose(parts);
}

const PIPE_RADIUS = 0.028;
const PIPE_GAP = 0.045;
const WHISTLE_HEIGHT = 0.16;

/**
 * A thin steam pipe up the aft (-X) side, hugging the taper, with a whistle
 * on top. It stays below the cap.
 */
export function buildSteamPipe(dims: FunnelDims): BufferGeometry {
  const bottom = 0.6;
  const top = dims.bodyHeight * 0.9;
  const xAt = (height: number) => -(funnelRadiusAt(dims, height) + PIPE_GAP);
  const dx = xAt(top) - xAt(bottom);
  const length = Math.hypot(dx, top - bottom);
  const pipe = new CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, length, 6);
  pipe.rotateZ(-Math.atan2(dx, top - bottom));
  pipe.translate((xAt(top) + xAt(bottom)) / 2, (top + bottom) / 2, 0);
  const whistle = new CylinderGeometry(
    PIPE_RADIUS * 1.9,
    PIPE_RADIUS * 1.9,
    WHISTLE_HEIGHT,
    8
  );
  whistle.translate(xAt(top), top + WHISTLE_HEIGHT / 2 - 0.02, 0);
  const lid = new CylinderGeometry(
    PIPE_RADIUS * 1.2,
    PIPE_RADIUS * 1.9,
    0.04,
    8
  );
  lid.translate(xAt(top), top + WHISTLE_HEIGHT, 0);
  return mergeAndDispose([pipe, whistle, lid]);
}

export const MODERN_FUNNEL_HEIGHT = 3.2;
export const MODERN_FUNNEL_STRETCH = 1.5;
const MODERN_BASE = 0.34;
const MODERN_TOP = 0.2;
const SHOULDER = 0.14;

/**
 * The modern funnel's body: the old taper (0.34 to 0.2, 3.2 tall) with its top
 * edge rolled over into a rounded dome, stretched fore-aft like the old one.
 */
export function buildModernFunnelBody(): BufferGeometry {
  const points: Vector2[] = [new Vector2(0, 0), new Vector2(MODERN_BASE, 0)];
  const straightTop = MODERN_FUNNEL_HEIGHT - SHOULDER;
  const radiusAtShoulder =
    MODERN_TOP + (MODERN_BASE - MODERN_TOP) * (SHOULDER / MODERN_FUNNEL_HEIGHT);
  points.push(new Vector2(radiusAtShoulder, straightTop));
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const angle = (i / steps) * (Math.PI / 2);
    points.push(
      new Vector2(
        radiusAtShoulder * Math.cos(angle),
        straightTop + SHOULDER * Math.sin(angle)
      )
    );
  }
  const lathe = new LatheGeometry(points, 20);
  lathe.scale(MODERN_FUNNEL_STRETCH, 1, 1);
  return lathe;
}

const GRILLE_SLATS = [2.35, 2.47, 2.59, 2.71];

/** A band of dark louvres around the upper body, following the taper. */
export function buildModernFunnelGrille(): BufferGeometry {
  const slats = GRILLE_SLATS.map((height) => {
    const radius =
      MODERN_TOP +
      (MODERN_BASE - MODERN_TOP) * (1 - height / MODERN_FUNNEL_HEIGHT) +
      0.012;
    const slat = new CylinderGeometry(radius, radius, 0.05, 20);
    slat.translate(0, height, 0);
    slat.scale(MODERN_FUNNEL_STRETCH, 1, 1);
    return slat;
  });
  return mergeAndDispose(slats);
}
