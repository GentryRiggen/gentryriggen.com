"""Plane Builder prop: the hangar's ground, a disc of radius 14 m facing up on
y = 0: the level's ground colour, a grey tarmac apron (radius 9.5 m) with a
white ring and dashes, a yellow cross and edge lights. Slots: palette_ground,
tarmac, paint_white, paint_yellow."""

import math

from lib.obstaclekit import finish, quad_up
from lib.shapes import box, disc, merge

SEG = 48


def ring_band(r0, r1, y, seg=SEG):
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        verts += [(r0 * math.sin(a), y, r0 * math.cos(a)), (r1 * math.sin(a), y, r1 * math.cos(a))]
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j))
    return verts, faces


def build(dims: dict) -> dict:
    ground = [disc(14.0, 0.0, SEG)]
    tarmac = [disc(9.5, 0.02, SEG)]
    white = [ring_band(8.6, 8.9, 0.04)]
    for k in range(8):  # edge dashes
        a = 2 * math.pi * (k + 0.5) / 8
        x, z = 6.3 * math.sin(a), 6.3 * math.cos(a)
        dash = quad_up(-0.15, 0.15, -0.9, 0.9, 0.04)
        c, s = math.cos(a), math.sin(a)
        white.append(([(vx * c + vz * s + x, vy, -vx * s + vz * c + z) for vx, vy, vz in dash[0]], dash[1]))
    yellow = [quad_up(-0.18, 0.18, -3.6, 3.6, 0.045), quad_up(-3.6, 3.6, -0.18, 0.18, 0.045)]
    lights = []
    for k in range(12):  # little edge lights on the apron
        a = 2 * math.pi * k / 12
        lights.append(box(9.2 * math.sin(a), 0.1, 9.2 * math.cos(a), 0.26, 0.2, 0.26))
    return finish({"palette_ground": ground, "tarmac": tarmac + lights, "paint_white": white,
                   "paint_yellow": yellow}, "meadow", fit=False,
                  open_slots=("palette_ground", "tarmac", "paint_white", "paint_yellow"))
