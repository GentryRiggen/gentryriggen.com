"""A water slide tower, in three.js coordinates (Y up, origin on the deck at
the tower's foot): a slim tower with a round landing platform and a
railing ring on top, and a fat tube coiling one and a half turns down round
it, held on struts, fanning out into a flared exit at the bottom. Slots:
`tower` (fixed grey) and `tube` (takes paint)."""

import math

from lib.deckkit import sweep
from lib.shapes import box, cylinder, hex_linear, lathe, make_object, merge, translate, tube

H = 2.4
R0 = 0.34
TURNS = 1.5
STEPS = 36


def path():
    pts, radii = [], []
    for i in range(STEPS + 1):
        t = i / STEPS
        a = t * TURNS * 2 * math.pi
        r = R0 + t * t * 0.12
        pts.append((math.cos(a) * r, H - 0.1 - t * (H - 0.2), math.sin(a) * r))
        radii.append(0.07 + 0.045 * max(0.0, (t - 0.88) / 0.12) ** 2)
    return pts, radii


def tower():
    parts = [
        cylinder(0.1, 0.12, H, 10, H / 2),
        cylinder(0.22, 0.22, 0.08, 14, H + 0.04),  # top platform
        lathe([(0.0, 0.0), (0.26, 0.0), (0.26, 0.05), (0.12, 0.08), (0.0, 0.08)], 14),  # foot
    ]
    # Railing ring round the platform: a thin torus-ish loop of posts and rail.
    ring = [(0.21 * math.cos(2 * math.pi * k / 12), H + 0.2, 0.21 * math.sin(2 * math.pi * k / 12)) for k in range(13)]
    parts.append(tube(ring, 0.012, 5, caps=False))
    for k in range(6):
        a = 2 * math.pi * k / 6
        parts.append(cylinder(0.012, 0.012, 0.16, 5, H + 0.12, shift_x=0.0))
        parts[-1] = translate(parts[-1], 0.21 * math.cos(a), 0, 0.21 * math.sin(a))
    # Struts from the tower to the tube, one every ~quarter turn.
    pts, radii = path()
    for k in range(3, STEPS, 6):
        x, y, z = pts[k]
        parts.append(tube([(0.0, y, 0.0), (x * 0.5, y, z * 0.5), (x, y, z)], 0.017, 5))
    return parts


def build(dims):
    pts, radii = path()
    return {
        "tower": make_object("tower", merge(tower()), hex_linear("#c9ced4"), roughness=0.6, closed=True, sharp_degrees=35),
        "tube": make_object("tube", sweep(pts, radii, 10), hex_linear("#e2552d"), roughness=0.4, closed=True, sharp_degrees=50),
    }
