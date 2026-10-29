"""Totally-enclosed lifeboat: a bulbous orange GRP hull with a rubbing strake,
a rounded white canopy, a row of curved-looking side windows, a top hatch,
a bow hatch and a single lifting hook amidships."""
import math

from lib.boats import _sp
from lib.shapes import (box, cylinder, hex_linear, loft, make_object, merge,
                        rounded_box)

L, W, RIM, KEEL = 1.1, 0.2091, -0.24, -0.4393
CANOPY_H = 0.17


def half(s):
    return max(0.012, W * (1 - abs(s) ** 3.0) ** 0.55)


def rim(s):
    return RIM + 0.03 * s * s


def keel_d(s):
    return (RIM - KEEL) * (1 - 0.55 * abs(s) ** 2.2)


STATIONS = [-1 + 2 * i / 8 for i in range(9)]


def hull():
    secs = []
    k = 5
    for s in STATIONS:
        w, r, d = half(s), rim(s), keel_d(s)
        prof = [(w * _sp(math.cos(math.pi - math.pi * i / k), 0.8),
                 r - d * abs(math.sin(math.pi * i / k)) ** 0.8) for i in range(k + 1)]
        secs.append((s * L / 2, prof))
    return loft(secs, "x")


def strake():
    out = []
    for side in (-1, 1):
        secs = []
        for s in STATIONS:
            s = max(-0.9, min(0.9, s))
            w, r, d = half(s), rim(s), keel_d(s)
            lev = 0.38
            z = side * w * _sp(math.sqrt(1 - lev ** 2), 0.8) * 0.995
            y = r - d * lev ** 1.25
            a, b = z - side * 0.002, z + side * 0.012
            secs.append((s * L / 2, [(min(a, b), y - 0.01), (max(a, b), y - 0.01),
                                     (max(a, b), y + 0.01), (min(a, b), y + 0.01)]))
        out.append(loft(secs, "x"))
    return merge(out)


CS = [-0.78 + 1.42 * i / 5 for i in range(6)]


def c_half(s):
    return half(s) * 0.86


def c_height(s):
    u = (s - CS[0]) / (CS[-1] - CS[0])
    return CANOPY_H * (0.35 + 0.65 * math.sin(math.pi * min(1, max(0, u))) ** 0.5)


def canopy():
    secs = []
    k = 5
    for s in CS:
        w, h, r = c_half(s), c_height(s), rim(s) - 0.004
        prof = [(w * _sp(math.cos(math.pi - math.pi * i / k), 0.7),
                 r + h * abs(math.sin(math.pi * i / k)) ** 0.7) for i in range(k + 1)]
        secs.append((s * L / 2, prof))
    return loft(secs, "x")


def windows():
    out = []
    for side in (-1, 1):
        for s in (-0.45, -0.2, 0.05, 0.3):
            h = c_height(s)
            wy = rim(s) + h * 0.5
            # canopy wall z at that height
            frac = 0.5
            z = side * (c_half(s) * (1 - frac ** (2 / 0.7)) ** (0.7 / 2) + 0.004)
            out.append(box(s * L / 2, wy, z, 0.09, 0.05, 0.02))
    return merge(out)


def build(dims):
    top_y = rim(0.0) + c_height(0.0) * 1.0
    # Hatch ring and lid on top, bow hatch, lifting hook.
    hatch = cylinder(0.065, 0.075, 0.03, 8, rim(-0.35) + c_height(-0.35) + 0.0)
    bow_hatch = box(0.38, rim(0.69) + 0.01, 0.0, 0.1, 0.025, 0.12)
    hook = rounded_box((0.0, top_y + 0.015, 0.0), (0.05, 0.05, 0.05), 0.012, 1)
    canopy_parts = [canopy(), hatch, bow_hatch, hook]
    return {
        "paint-f08a24": make_object("paint-f08a24", merge([hull(), strake()]),
                                    hex_linear("#f08a24"), roughness=0.4),
        "lifeboat": make_object("lifeboat", merge(canopy_parts), hex_linear("#f7f7f2"), roughness=0.4),
        "bridgeWindows": make_object("bridgeWindows", windows(), hex_linear("#2c3e50"),
                                     roughness=0.1),
    }
