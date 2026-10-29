"""Plane Builder obstacle: a storm cloud, 28 x 14 x 28 m (typical).

A towering cumulus: a flat, dark base of squashed puffs under a heap of round
lumps, paler toward the top, tallest in the middle. Smooth shaded. Slots:
storm, storm_dark, storm_light."""

import math

from lib.obstaclekit import blob, finish
from lib.shapes import lathe


def lump(cx, cy, cz, rx, ry, rz):
    """A smooth ellipsoid puff (8 sides, 4 bands: 48 triangles)."""
    prof = [(0.0, -1.0)] + [
        (math.sin(a), -math.cos(a)) for a in (math.pi / 3, math.pi / 2 + 0.0, 2 * math.pi / 3)
    ] + [(0.0, 1.0)]
    verts, faces = lathe(prof, 8)
    return [(cx + x * rx, cy + y * ry, cz + z * rz) for x, y, z in verts], faces


BASE = [(0, 2.2, 0, 12.5, 2.4, 11.5), (0, 2.0, 0, 10, 2.2, 10)]
MID = [(0, 5.8, 0, 8.4, 5.0, 8.4), (-7.5, 5.2, 2.5, 6.2, 4.0, 6.2), (7, 5.0, -2.5, 6.4, 4.2, 6.2)]
TOP = [(-1.5, 9.8, 1, 5.4, 4.0, 5.2), (2.5, 8.6, -3, 4.2, 3.6, 4.2)]


def build(dims: dict) -> dict:
    base = [blob(*p, jitter=0.05, seed=i) for i, p in enumerate(BASE)]
    mid = [lump(*p) for p in MID]
    top = [lump(*p) for p in TOP]
    return finish(
        {"storm_dark": base, "storm": mid, "storm_light": top},
        "storm",
        smooth=("storm", "storm_dark", "storm_light"),
    )
