"""A scarlet macaw on a short standing perch, in three.js coordinates (Y up,
origin on the deck at the foot of the pole, bird facing +X). A pole with a
crossbar along Z; the bird sits upright on it, a little leaning back: an egg
body, round head with a white face patch, a hooked beak, folded wings
(yellow covert band over blue flight feathers), a long red tail with blue
tips, feet on the bar and dark eyes."""

import math

from lib.deckkit import rot_z, sweep
from lib.shapes import box, cylinder, extrude, hex_linear, lathe, make_object, merge, translate

BAR_Y = 0.2
LEAN = 0.18  # radians the bird leans back (toward -X)


def ball(r, cx, cy, cz, sx=1.0, sy=1.0, sz=1.0, seg=10):
    pts = []
    n = 6
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((r * math.sin(a), -r * math.cos(a)))
    mesh = lathe([(rr, yy) for rr, yy in pts], seg)
    verts, faces = mesh
    return [(cx + x * sx, cy + y * sy, cz + z * sz) for x, y, z in verts], faces


def bird_xf(mesh):
    """Lean the bird back about the perch contact point (0, BAR_Y)."""
    verts, faces = mesh
    c, s = math.cos(LEAN), math.sin(LEAN)
    out = []
    for x, y, z in verts:
        dy = y - BAR_Y
        out.append((x * c + dy * s, -x * s + dy * c + BAR_Y, z))
    return out, faces


def perch():
    return [cylinder(0.014, 0.014, BAR_Y, 8, BAR_Y / 2),
            translate(_along_z(0.014, 0.24), 0, BAR_Y, 0),
            cylinder(0.04, 0.045, 0.02, 10, 0.01)]


def _along_z(r, length):
    from lib.deckkit import rot_x
    return rot_x(cylinder(r, r, length, 8, 0.0), math.pi / 2)


def body():
    return [bird_xf(ball(0.07, 0.0, 0.3, 0.0, 0.95, 1.4, 0.8, 12))]


def head():
    return [bird_xf(ball(0.047, 0.012, 0.395, 0.0, 1.0, 1.0, 0.9, 10))]


def white():
    return [bird_xf(ball(0.026, 0.026, 0.397, s * 0.03, 1.0, 1.15, 0.45, 8)) for s in (-1, 1)]


def eye():
    return [bird_xf(ball(0.011, 0.034, 0.405, s * 0.034, 1.0, 1.0, 1.0, 6)) for s in (-1, 1)]


def beak():
    pts = [(0.045, 0.403, 0.0), (0.075, 0.402, 0.0), (0.09, 0.382, 0.0)]
    m = sweep(pts, [0.024, 0.018, 0.005], 8)
    low = sweep([(0.045, 0.385, 0.0), (0.07, 0.382, 0.0)], [0.016, 0.01], 6)
    return [bird_xf(m), bird_xf(low)]


def wings(band):
    """One wing per side: a leaf shape lying on the body. `band` picks the
    yellow covert strip (True) or the blue flight feathers (False)."""
    out = []
    for s in (-1, 1):
        if band:
            prof = [(0.02, 0.36), (-0.03, 0.36), (-0.05, 0.28), (0.0, 0.26), (0.03, 0.31)]
        else:
            prof = [(0.0, 0.27), (-0.05, 0.285), (-0.075, 0.2), (-0.06, 0.12), (-0.03, 0.2), (0.02, 0.27)]
        z0 = s * 0.052
        out.append(bird_xf(extrude(prof, z0 - 0.008 if s > 0 else z0 - 0.008, z0 + 0.008, axis="z")))
    return out


def tail():
    red = bird_xf(sweep([(-0.03, 0.24, 0), (-0.07, 0.12, 0), (-0.095, 0.02, 0)], [0.034, 0.03, 0.02], 6))
    blue = bird_xf(sweep([(-0.085, 0.07, 0), (-0.098, 0.0, 0)], [0.026, 0.02], 6))
    return [red], [blue]


def build(dims):
    red_tail, blue_tail = tail()
    feet = [box(0.0, BAR_Y + 0.016, s * 0.022, 0.03, 0.012, 0.012) for s in (-1, 1)]
    mk = lambda n, parts, c, **kw: make_object(n, merge(parts), hex_linear(c), closed=True, roughness=0.55, **kw)
    return {
        "perch": mk("perch", perch() + feet, "#5a3a22"),
        "red": mk("red", body() + head() + red_tail, "#c8312b"),
        "yellow": mk("yellow", beak() + wings(True), "#f2c230"),
        "blue": mk("blue", wings(False) + blue_tail, "#2f7fc1"),
        "white": mk("white", white(), "#f1ede0"),
        "eye": mk("eye", eye(), "#1c1c1f"),
    }
