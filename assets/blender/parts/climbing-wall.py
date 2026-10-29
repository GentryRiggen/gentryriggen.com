"""A climbing wall, in three.js coordinates (Y up, origin at the wall's
footprint centre on the deck, the climbing face toward +X): a thick panel
in a raised frame with a base plinth, and nine coloured holds shaped like
knobby blobs, each on a bolt. Slots: `wall` (takes paint, the panel and
frame), and four hold colours used in turn (`holdRed`, `holdYellow`,
`holdBlue`, `holdGreen`)."""

import math

from lib.shapes import box, hex_linear, lathe, make_object, merge, rounded_box, translate
from lib.deckkit import rot_z

H = 1.8
SPOTS = [(-0.25, 0.2), (0.1, 0.35), (0.28, 0.6), (-0.15, 0.75), (0.05, 1.0), (-0.3, 1.15), (0.25, 1.3),
         (-0.05, 1.5), (0.2, 1.65)]  # (across z, up y)
NAMES = ["holdRed", "holdYellow", "holdBlue", "holdGreen"]
COLORS = ["#e2552d", "#f2c230", "#3f9ad6", "#58b368"]


def wall():
    parts = [box(0, H / 2, 0, 0.1, H, 0.8)]
    # Frame: stiles and a top rail standing a little proud of the face.
    for s in (-1, 1):
        parts.append(box(0.012, H / 2, s * 0.385, 0.124, H, 0.05))
    parts.append(box(0.012, H - 0.025, 0, 0.124, 0.05, 0.8))
    parts.append(box(0.0, 0.06, 0, 0.17, 0.12, 0.86))  # plinth
    return parts


def hold(i, z, y):
    # A knobby blob: a squashed dome whose lean differs per hold, on a bolt.
    r = 0.045 + 0.008 * (i % 3)
    prof = [(0.0, 0.0), (r, 0.0), (r * 1.05, 0.015), (r * 0.8, 0.04), (r * 0.4, 0.06), (0.0, 0.065)]
    mesh = lathe(prof, 8)
    mesh = rot_z(mesh, -math.pi / 2)  # dome toward +X
    mesh = translate(mesh, 0.05, y, z)
    return mesh


def build(dims):
    groups = [[] for _ in NAMES]
    for i, (z, y) in enumerate(SPOTS):
        groups[i % 4].append(hold(i, z, y))
    out = {"wall": make_object("wall", merge(wall()), hex_linear("#8f98a3"), roughness=0.8, closed=True, sharp_degrees=35)}
    for n, c, g in zip(NAMES, COLORS, groups):
        out[n] = make_object(n, merge(g), hex_linear(c), roughness=0.6, sharp_degrees=50)
    return out
