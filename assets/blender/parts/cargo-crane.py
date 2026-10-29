"""A ship's pedestal deck crane, in three.js coordinates (Y up, origin on the
deck under the pedestal). Static: a round base plate and a tapered pedestal
with flanges. The slewing top, drawn at angle 0 with its jib along +X (the
game turns it about the vertical through the origin): a cab with side
windows and a roof, a steel counterweight behind it, a tapered box jib raised
on a hydraulic luffing ram, a sheave head, a hoist cable and a hook block
with a hook. Slots: `base`, `pedestal` (paint), `slew` (paint, swings),
`slewSteel` (swings, metal) and `slewWindow` (swings)."""

import math

from lib.deckkit import rot_z, sweep
from lib.shapes import box, cylinder, hex_linear, lathe, loft, make_object, merge, rounded_box, translate, tube

PED_H = 1.1
JIB_LEN = 2.3
JIB_TILT = 0.45
PIVOT = (0.0, PED_H + 0.35, 0.0)  # where the jib hinges, on the cab's front top


def on_jib(t, up, z=0.0):
    """A point `t` along the jib and `up` above its axis, in model space."""
    c, s = math.cos(JIB_TILT), math.sin(JIB_TILT)
    return (PIVOT[0] + t * c - up * s, PIVOT[1] + t * s + up * c, z)


def static():
    base = [
        lathe([(0.0, 0.0), (0.38, 0.0), (0.38, 0.05), (0.34, 0.08), (0.0, 0.08)], 20),
    ]
    ped = [
        lathe([(0.0, 0.08), (0.30, 0.08), (0.30, 0.13), (0.24, 0.15), (0.26, 0.2), (0.2, PED_H - 0.12),
               (0.2, PED_H - 0.05), (0.26, PED_H - 0.04), (0.26, PED_H), (0.0, PED_H)], 20),
        # Access ladder rungs up the front of the pedestal.
        *[box(-0.215 + 0.0 * k, 0.28 + k * 0.14, 0.0, 0.03, 0.02, 0.16) for k in range(5)],
    ]
    return base, ped


def jib():
    secs = []
    for t, w, h in ((0.0, 0.16, 0.17), (1.1, 0.12, 0.13), (JIB_LEN - 0.06, 0.085, 0.09)):
        secs.append((t, [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]))
    mesh = loft(secs, axis="x")
    mesh = rot_z(mesh, JIB_TILT)
    return translate(mesh, *PIVOT)


def slew():
    parts = []
    y0 = PED_H
    parts.append(rounded_box((0.0, y0 + 0.22, 0.0), (0.5, 0.44, 0.44), 0.06, 1))  # cab
    parts.append(rounded_box((-0.05, y0 + 0.47, 0.0), (0.4, 0.06, 0.4), 0.02, 1))  # roof
    parts.append(cylinder(0.27, 0.27, 0.05, 20, y0 + 0.025))  # slewing ring
    parts.append(jib())
    # Pivot housing the jib hinges on.
    parts.append(box(0.1, y0 + 0.31, 0.0, 0.14, 0.2, 0.34))
    # Sheave head at the tip.
    tip = on_jib(JIB_LEN, 0.0)
    parts.append(box(tip[0], tip[1], 0.0, 0.1, 0.12, 0.14))
    return parts


def steel():
    parts = []
    parts.append(rounded_box((-0.42, PED_H + 0.2, 0.0), (0.4, 0.3, 0.38), 0.05, 1))  # counterweight
    # Luffing ram from the cab roof front to the jib's underside.
    a = (0.2, PED_H + 0.4, 0.0)
    b = on_jib(1.05, -0.09)
    parts.append(tube([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.0), b], 0.032, 8))
    # Hoist cable and hook block.
    tip = on_jib(JIB_LEN, -0.06)
    cable = 0.9
    parts.append(tube([(tip[0], tip[1], 0.0), (tip[0], tip[1] - cable, 0.0)], 0.016, 6))
    hx, hy = tip[0], tip[1] - cable
    parts.append(rounded_box((hx, hy - 0.05, 0.0), (0.14, 0.1, 0.14), 0.02, 1))
    parts.append(tube([(hx, hy - 0.1, 0.0), (hx, hy - 0.16, 0.0), (hx + 0.045, hy - 0.2, 0.0),
                       (hx + 0.045, hy - 0.25, 0.0), (hx, hy - 0.28, 0.0), (hx - 0.04, hy - 0.25, 0.0)], 0.014, 6))
    return parts


def windows():
    parts = []
    for s in (-1, 1):
        parts.append(box(0.1, PED_H + 0.28, s * 0.226, 0.2, 0.14, 0.012))
    parts.append(box(0.246, PED_H + 0.3, -0.0, 0.012, 0.1, 0.2))
    return parts


def build(dims):
    base, ped = static()
    return {
        "base": make_object("base", merge(base), hex_linear("#7c8791"), roughness=0.7, closed=True),
        "pedestal": make_object("pedestal", merge(ped), hex_linear("#e0b02c"), roughness=0.55, closed=True, sharp_degrees=35),
        "slew": make_object("slew", merge(slew()), hex_linear("#e0b02c"), roughness=0.55, closed=True, sharp_degrees=35),
        "slewSteel": make_object("slewSteel", merge(steel()), hex_linear("#5f666d"), metallic=0.8, roughness=0.45, closed=True),
        "slewWindow": make_object("slewWindow", merge(windows()), hex_linear("#2c3e50"), roughness=0.2),
    }
