"""Plane Builder obstacle: a cloud, 28 x 14 x 28 m (typical), two kinds.

- puff: a fair-weather cumulus heap (islands): a crowd of round lobes of
  different sizes, a big one in the middle, a bright billowing top.
- storm: a towering cumulonimbus (storm): a tall cauliflower tower in the
  middle on a wide, lower skirt of dark lobes.

The cloud is one smooth skin: a polar grid whose height is a soft union of
spherical lobes, so the lobes blend into soft billows with no hard seams, over
a flat belly and a rounded hem. Smooth shaded. The slots are three height
bands (top, mid, base); a vertex-colour gradient (the game's COLOR_0) bridges
them, so the brightness falls smoothly from a bright crown to a softer belly.
Slots: cloud_top, cloud_mid, cloud_base. The game colours them white for the
puff and greys for the storm."""

import math

from lib.obstaclekit import finish, noise, paint_gradient

# (x, z, radius, crown height, segments, base height) for every lobe, in
# metres. A lobe is a dome standing on the plane y = base, so small lobes can
# sit on the shoulders of big ones, the way a cumulus heaps up in billows.
PUFF = [
    # the low mass, wide and squat
    (0, 0, 10, 9.5, 10, 0), (-10, -3, 7.5, 7.5, 10, 0), (10, -2.5, 7.5, 8, 10, 0),
    (-2, 10, 6.5, 7, 8, 0), (3, -11, 6, 6.5, 8, 0),
    # the shoulders
    (-5, -2, 6.2, 13, 8, 4), (5, 2, 6.5, 14, 8, 4), (0, -7, 5.2, 11.5, 8, 4),
    (-9, 5, 4.4, 10.5, 7, 3.5), (10, 8, 4.2, 10, 7, 3.5),
    # the crown
    (0.5, -0.5, 4, 15.5, 6, 10), (-4, 2.5, 3.2, 14.5, 6, 10),
]
STORM = [
    # the wide dark skirt
    (0, 0, 10, 6, 10, 0), (-11, 1, 7.5, 5.2, 10, 0), (11, -1, 7.5, 5.2, 10, 0),
    (1, 11, 6.5, 4.6, 8, 0), (-2, -11, 6.5, 4.6, 8, 0),
    # the body
    (-3.5, 2, 6.6, 12, 8, 3), (4, -2, 6.4, 12.5, 8, 3), (0, -7, 5, 9.5, 6, 3),
    # the tower
    (0, 0, 6.6, 17, 8, 6), (3.6, 3.4, 5, 15, 7, 6.5), (-3.4, -3, 5.2, 15.5, 7, 6.5),
    (0.4, 0.3, 4.6, 20, 6, 11.5),
]

STORM_COLORS = {"cloud_top": "#dfe3ec", "cloud_mid": "#b8bfcc", "cloud_base": "#939bab"}
PUFF_COLORS = {"cloud_top": "#fbfcff", "cloud_mid": "#eef2f9", "cloud_base": "#dde5f0"}
# A lobe's slot depends on how high its middle sits, as a share of the tallest crown.
BAND_LOW, BAND_HIGH = 0.3, 0.6
HEM = math.radians(-6)  # the latitude where a dome meets the belly plane
SKY_LEAN = 0.25  # how far shading normals tilt toward straight up
RINGS = (-6, 42)  # latitudes (degrees) of a dome's two rings, below its pole


def dome(cx, cz, r, top, seg, turn, base=0.0):
    """A dome of horizontal radius `r` whose crown is `top` high, cut by the
    plane y = base. Returns (verts, faces, ellipsoid) where the ellipsoid
    (cx, yc, cz, r, ry) lets the caller shade the dome as a perfect ellipsoid."""
    k = math.sin(-HEM)
    ry = (top - base) / (1 + k)
    yc = base + k * ry
    verts, rows = [], []
    for deg in RINGS:
        a = math.radians(deg)
        row = []
        for i in range(seg):
            t = turn + 2 * math.pi * i / seg
            row.append(len(verts))
            verts.append((cx + r * math.cos(a) * math.cos(t), yc + ry * math.sin(a),
                          cz + r * math.cos(a) * math.sin(t)))
        rows.append(row)
    pole = len(verts)
    verts.append((cx, yc + ry, cz))
    faces = []
    for lo, hi in zip(rows, rows[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((lo[i], lo[j], hi[j], hi[i]))
    for i in range(seg):
        faces.append((rows[-1][i], rows[-1][(i + 1) % seg], pole))
    # Wind every face outward from the dome's centre.
    fixed = []
    for f in faces:
        pts = [verts[i] for i in f]
        n = [0.0, 0.0, 0.0]
        for p, q in zip(pts, pts[1:] + pts[:1]):
            n[0] += (p[1] - q[1]) * (p[2] + q[2])
            n[1] += (p[2] - q[2]) * (p[0] + q[0])
            n[2] += (p[0] - q[0]) * (p[1] + q[1])
        mid = [sum(p[i] for p in pts) / len(pts) for i in range(3)]
        out = sum(n[i] * (mid[i] - (cx, yc, cz)[i]) for i in range(3))
        fixed.append(f if out >= 0 else tuple(reversed(f)))
    return verts, fixed, (cx, yc, cz, r, ry)


def belly(points, y=0.0):
    """A flat fan facing down through `points` (x, z) around their centre."""
    cx = sum(p[0] for p in points) / len(points)
    cz = sum(p[1] for p in points) / len(points)
    verts = [(cx, y, cz)] + [(x, y, z) for x, z in points]
    n = len(points)
    return verts, [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]


def hull(lobes, n=8):
    """The belly's outline: the furthest dome edge along each of `n` bearings."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        c, s = math.cos(a), math.sin(a)
        reach = max(x * c + z * s + r * math.sqrt(max(0.0, 1 - ((x * s - z * c) / r) ** 2))
                    for x, z, r, _, _, base in lobes if base == 0)
        pts.append((reach * 0.97 * c, reach * 0.97 * s))
    return pts


def lum(hex_colour):
    """The brightness the game draws a slot colour at (paint lifted by a power
    of 0.7, then multiplied by the slot's gain)."""
    c = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return sum(w * v**0.7 for w, v in zip((0.3, 0.55, 0.15), c))


GAIN = {"cloud_top": 2.6, "cloud_mid": 2.4, "cloud_base": 2.1}


def gradient(colors):
    """Brightness by height (0 belly, 1 crown) for a variant's slot colours:
    each slot's paint is its band's brightest point, and the multiplier eases
    the cloud from the band below's brightness up to its own, so lobes of
    different slots join without a step. The game never darkens past 0.75, and
    the ratios here stay inside that."""
    e = {s: lum(colors[s]) * GAIN[s] for s in GAIN}
    stops = [(0.0, 0.86 * e["cloud_base"]), (0.3, e["cloud_base"]),
             (0.62, e["cloud_mid"]), (1.0, e["cloud_top"])]

    def value(h):
        for (h0, v0), (h1, v1) in zip(stops, stops[1:]):
            if h <= h1:
                t = (h - h0) / (h1 - h0)
                return v0 + (v1 - v0) * t * t * (3 - 2 * t)
        return stops[-1][1]

    def brightness(slot):
        return lambda h: max(0.75, min(1.0, value(h) / e[slot]))

    return brightness


def shade_as_ellipsoids(obj, ellipsoids, lo, span):
    """Give every vertex the normal of the ellipsoid it lies on, so each dome
    shades as a perfectly round lobe however few triangles it has. `lo`/`span`
    are the unit-box fit (three.js axes) the vertices were put through."""
    mesh = obj.data
    normals = []
    for v in mesh.vertices:
        # Blender (x, y, z) -> three (x, z, -y), then undo the unit-box fit.
        px = (v.co.x + 0.5) * span[0] + lo[0]
        py = (v.co.z + 0.5) * span[1] + lo[1]
        pz = (-v.co.y + 0.5) * span[2] + lo[2]
        best, bestd = None, 1e9
        for cx, yc, cz, r, ry in ellipsoids:
            q = ((px - cx) / r, (py - yc) / ry, (pz - cz) / r)
            d = abs(math.sqrt(sum(c * c for c in q)) - 1)
            if d < bestd:
                best, bestd = (cx, yc, cz, r, ry), d
        cx, yc, cz, r, ry = best
        nx, ny, nz = (px - cx) / r**2, (py - yc) / ry**2, (pz - cz) / r**2
        # A normal moves through the unit-box fit with the inverse scale.
        nx, ny, nz = nx * span[0], ny * span[1], nz * span[2]
        length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        # Lean every normal toward the sky: a cloud scatters light, so its
        # flanks and belly stay soft instead of going dark like rock.
        nx, ny, nz = nx / length * (1 - SKY_LEAN), ny / length * (1 - SKY_LEAN) + SKY_LEAN, nz / length * (1 - SKY_LEAN)
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        normals.append((nx / length, -nz / length, ny / length))  # to Blender
    mesh.normals_split_custom_set_from_vertices(normals)


def build(dims: dict) -> dict:
    storm = dims["variant"] == "storm"
    lobes = STORM if storm else PUFF
    colors = STORM_COLORS if storm else PUFF_COLORS
    tallest = max(lobe[3] for lobe in lobes)
    slots = {"cloud_top": [], "cloud_mid": [], "cloud_base": []}
    ellipsoids = {name: [] for name in slots}
    for i, (x, z, r, top, seg, base) in enumerate(lobes):
        verts, faces, ellipsoid = dome(x, z, r, top, seg, 0.55 * i, base)
        share = (top + base) / 2 / tallest
        name = "cloud_base" if share < BAND_LOW else "cloud_mid" if share < BAND_HIGH else "cloud_top"
        slots[name].append((verts, faces))
        ellipsoids[name].append(ellipsoid)
    slots["cloud_base"].append(belly(hull(lobes)))
    pts = [p for meshes in slots.values() for v, _ in meshes for p in v]
    lo = [min(p[i] for p in pts) for i in range(3)]
    span = [max(p[i] for p in pts) - lo[i] for i in range(3)]
    objs = finish(slots, "storm", smooth=tuple(slots), open_slots=tuple(slots), colors=colors)
    brightness = gradient(colors)
    for name, obj in objs.items():
        shade_as_ellipsoids(obj, ellipsoids[name] or [(0, 0, 0, 1, 1)], lo, span)
        paint_gradient(obj, brightness(name))
    return objs
