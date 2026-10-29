"""Plane Builder obstacle: a cloud, 28 x 14 x 28 m (typical), two kinds.

- puff: a fair-weather cumulus heap (islands): many round, smooth lobes, a
  bright billowing top and a barely shaded, flattish base.
- storm: a towering cumulonimbus (storm): wide dark-grey lobes low down, a
  tower of paler lobes stacked in the middle, brightest at the top.

Every lobe is a smooth dome standing on a common base plane, so the heap has a
flat, soft underside and no hard slab. Smooth shaded, no baked AO. Slots:
cloud_top, cloud_mid, cloud_base. The game colours them white for the puff
and greys for the storm."""

import math

from lib.obstaclekit import finish


def dome(cx, cz, r, top, seg=8, rings=3, turn=0.0, base=0.0):
    """A smooth dome of horizontal radius `r` whose crown is at height `top`,
    sitting on the plane y = base (its hem curls in a little). `rings` is the
    number of latitude rings below the pole (2 or 3)."""
    angles = {2: (-12, 42), 3: (-12, 28, 60)}[rings]
    height = top - base
    # The ellipsoid centre sits so the hem ring lands on the base plane.
    k = math.sin(math.radians(12))
    ry = height / (1 + k)
    yc = base + k * ry
    verts, rows = [], []
    for deg in angles:
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
            faces.append((lo[i], hi[i], hi[j], lo[j]))
    for i in range(seg):
        faces.append((rows[-1][i], pole, rows[-1][(i + 1) % seg]))
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
    return verts, fixed


def underside(points, y=0.0):
    """A flat fan facing down, through `points` (x, z) around their centre."""
    cx = sum(p[0] for p in points) / len(points)
    cz = sum(p[1] for p in points) / len(points)
    verts = [(cx, y, cz)] + [(x, y, z) for x, z in points]
    n = len(points)
    return verts, [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]


def ring(rx, rz, n=8, turn=0.0):
    return [(rx * math.cos(turn + 2 * math.pi * i / n), rz * math.sin(turn + 2 * math.pi * i / n))
            for i in range(n)]


# (x, z, radius, crown height, rings), grouped by slot.
PUFF_TOP = [(0, 0, 13, 14, 2), (-7, -4, 9, 12.5, 2), (7, -3, 9, 12, 2), (0, 7, 9, 11.5, 2)]
PUFF_MID = [(-14, 1, 8, 9, 2), (14, 2, 8, 9.5, 2), (-5, -12, 8, 8.5, 2),
            (8, -11, 7, 8, 2), (-8, 11, 7, 8, 2), (11, 10, 7, 7.5, 2)]
PUFF_BASE = [(-19, -6, 5.5, 5.5, 2), (19, -6, 5.5, 5, 2)]

STORM_BASE = [(0, 0, 15, 7.5, 2), (-12, 1, 10, 6.5, 2), (12, 0, 10, 6, 2),
              (1, 11, 9, 6, 2), (-2, -11, 9, 6, 2)]
STORM_MID = [(-4, 2, 10, 11, 2), (5, -2, 9, 11.5, 2), (0, -6, 8, 10, 2)]
STORM_TOP = [(0, 0, 7.5, 14, 2), (3, 3.5, 5.5, 12.5, 2), (-3, -2.5, 6, 13, 2)]

STORM_COLORS = {"cloud_top": "#dfe3ec", "cloud_mid": "#b8bfcc", "cloud_base": "#939bab"}


def lobes(specs, base=0.0, turn=0.0):
    return [dome(x, z, r, t, rings=n, turn=turn + 0.55 * i, base=base)
            for i, (x, z, r, t, n) in enumerate(specs)]


def build_puff():
    return {
        "cloud_top": lobes(PUFF_TOP),
        "cloud_mid": lobes(PUFF_MID, turn=0.2),
        "cloud_base": lobes(PUFF_BASE, turn=0.4) + [underside(ring(22, 18), 0.0)],
    }


def build_storm():
    return {
        "cloud_base": lobes(STORM_BASE) + [underside(ring(18, 14), 0.0)],
        "cloud_mid": lobes(STORM_MID, base=3.0, turn=0.3),
        "cloud_top": lobes(STORM_TOP, base=6.0, turn=0.6),
    }


def build(dims: dict) -> dict:
    puff = dims["variant"] == "puff"
    slots = build_puff() if puff else build_storm()
    colors = None if puff else STORM_COLORS
    return finish(slots, "storm", smooth=tuple(slots), open_slots=tuple(slots), colors=colors)
