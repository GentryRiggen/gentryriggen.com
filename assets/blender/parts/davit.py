"""Welin-style quadrant davit: foot plate and collar, twin toothed quadrant
cheeks, a candy-cane arm curving out over the boat (+Z), a sheave block at
the tip with a short fall and hook. One metal slot."""
import math

from lib.shapes import (box, cylinder, extrude, hex_linear, make_object, merge,
                        rounded_box, translate, tube)

CTRL = [(0, 0), (0.45, 0), (0.75, 0.06), (0.88, 0.25), (0.86, 0.48), (0.8, 0.6)]


def catmull(pts, per=5):
    """Uniform Catmull-Rom through (y, z) control points."""
    p = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        for k in range(per):
            t = k / per
            out.append(tuple(
                0.5 * ((2 * p[i][j]) + (-p[i - 1][j] + p[i + 1][j]) * t
                       + (2 * p[i - 1][j] - 5 * p[i][j] + 4 * p[i + 1][j] - p[i + 2][j]) * t * t
                       + (-p[i - 1][j] + 3 * p[i][j] - 3 * p[i + 1][j] + p[i + 2][j]) * t ** 3)
                for j in range(2)))
    out.append(pts[-1])
    return out


def quadrant(x0, x1):
    """A toothed fan plate in (z, y), pivot at (0, 0.5)."""
    cz, cy, r = 0.0, 0.5, 0.42
    prof = [(cz, cy)]
    n = 9
    for i in range(n + 1):
        a = math.radians(5 + 55 * i / n)  # swings from straight down toward +z
        rr = r if i % 2 == 0 else r - 0.035
        prof.append((cz + rr * math.sin(a), cy - rr * math.cos(a)))
    return extrude(prof, x0, x1, "x")


def build(dims):
    base = cylinder(0.1, 0.12, 0.06, 10, 0.03)
    collar = cylinder(0.075, 0.075, 0.07, 10, 0.1)
    arm_pts = [(0.0, y, z) for y, z in catmull(CTRL)]
    arm = tube(arm_pts, 0.05, 10)
    cheeks = [quadrant(-0.075, -0.045), quadrant(0.045, 0.075)]
    pin = box(0, 0.5, 0, 0.17, 0.05, 0.05)
    block = rounded_box((0, 0.74, 0.6), (0.1, 0.12, 0.1), 0.02, 2)
    fall = tube([(0, 0.68, 0.6), (0, 0.5, 0.6)], 0.008, 5)
    hook = rounded_box((0, 0.48, 0.6), (0.04, 0.05, 0.04), 0.01, 1)
    mesh = merge([base, collar, arm, pin, block, fall, hook] + cheeks)
    return {"davit": make_object("davit", mesh, hex_linear("#e8e4d8"),
                                 metallic=1.0, roughness=0.4)}
