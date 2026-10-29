"""A small helicopter, nose to +X (three.js coordinates, Y up, origin on the
deck under the rotor mast). A bubble-canopy cabin over a smooth pod, a
tapered tail boom with a fin, stabiliser and tail rotor, an engine hump
behind the cabin, skids on cross tubes, a rotor mast and a two-blade main
rotor that the game turns (slot `rotor`, kept apart from the hub so only it
spins). Slots: `body` (takes paint), `glass`, `dark` (skids, mast, hub,
tail rotor) and `rotor`."""

import math

from lib.deckkit import rot_x, rot_z, sweep
from lib.shapes import box, cylinder, extrude, hex_linear, loft, make_object, merge, rounded_box, translate, tube

ROTOR_Y = 0.85


def ellipse(cy, rz, ry, n=14):
    return [(rz * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def pod():
    st = [(-0.52, 0.30, 0.07, 0.07), (-0.38, 0.36, 0.16, 0.17), (-0.12, 0.42, 0.25, 0.28),
          (0.22, 0.42, 0.27, 0.30), (0.46, 0.40, 0.21, 0.24), (0.62, 0.38, 0.09, 0.10)]
    return loft([(x, ellipse(cy, rz, ry)) for x, cy, rz, ry in st], axis="x")


def canopy():
    st = [(0.06, 0.58, 0.16, 0.16), (0.2, 0.55, 0.22, 0.20), (0.42, 0.50, 0.19, 0.19), (0.58, 0.44, 0.09, 0.10)]
    return loft([(x, ellipse(cy, rz, ry)) for x, cy, rz, ry in st], axis="x")


def tail():
    parts = []
    parts.append(sweep([(-0.45, 0.46, 0), (-0.85, 0.52, 0), (-1.28, 0.585, 0)], [0.085, 0.055, 0.03], 8))
    # Fin: a swept slab, tall at the tail rotor end.
    fin = [(-1.18, 0.55), (-1.36, 0.55), (-1.40, 0.80), (-1.30, 0.80)]
    parts.append(extrude(fin, -0.02, 0.02, axis="z"))
    # Horizontal stabiliser.
    parts.append(box(-1.12, 0.575, 0, 0.14, 0.02, 0.34))
    # Engine hump behind the cabin and its exhaust.
    parts.append(rounded_box((-0.2, 0.68, 0), (0.36, 0.14, 0.26), 0.04, 1))
    return parts


def dark():
    parts = []
    for z in (-0.22, 0.22):
        parts.append(tube([(-0.42, 0.04, z), (0.30, 0.04, z), (0.46, 0.10, z)], 0.02, 6))
        for x in (-0.22, 0.2):
            parts.append(tube([(x, 0.05, z), (x + 0.01, 0.16, z * 0.62), (x, 0.24, z * 0.38)], 0.018, 6))
    parts.append(cylinder(0.045, 0.05, 0.2, 8, 0.74))  # mast
    parts.append(cylinder(0.075, 0.075, 0.05, 10, ROTOR_Y - 0.0))  # hub
    # Tail rotor: two short blades on a hub, on the +Z side of the fin.
    for a in (0.0, math.pi / 2):
        blade = box(0, 0, 0, 0.02, 0.22, 0.012)
        verts, faces = blade
        c, s = math.cos(a + 0.6), math.sin(a + 0.6)
        parts.append(translate(([(x * c - y * s, x * s + y * c, z) for x, y, z in verts], faces), -1.36, 0.72, 0.045))
    return parts


def rotor():
    # Two blades along X (tapering to the tip), a little coned up.
    parts = []
    for s in (-1, 1):
        parts.append(translate(box(0, 0, 0, 0.88, 0.022, 0.1), s * 0.51, ROTOR_Y + 0.004, 0))
    return parts


def build(dims):
    return {
        "body": make_object("body", merge([pod(), *tail()]), hex_linear("#6f7b66"), roughness=0.6, closed=True, sharp_degrees=40),
        "glass": make_object("glass", canopy(), hex_linear("#1d2a33"), roughness=0.15, closed=True),
        "dark": make_object("dark", merge(dark()), hex_linear("#4b545b"), roughness=0.6, closed=True),
        "rotor": make_object("rotor", merge(rotor()), hex_linear("#2b3036"), roughness=0.6, closed=True),
    }
