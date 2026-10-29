"""Plane Builder obstacle: a coconut palm, 6 x 18 x 6 m (typical).

A slender trunk that leans and tapers, banded by rings, a crown of seven
drooping fronds (`soft`) and a pair of coconuts. Slots: trunk, soft, coconut."""

import math

from lib.obstaclekit import blob, finish, ribbon, sweep


def frond(angle, length, rise):
    """An arching blade: it climbs a little, then droops past the horizontal."""
    spine = []
    for k in range(4):
        t = k / 3
        r = length * t
        spine.append((r, rise * math.sin(t * 1.9) - 0.9 * t * t * length * 0.45, 0.0))
    widths = [0.9, 1.7, 1.4, 0.5]
    c, s = math.cos(angle), math.sin(angle)
    verts, faces = ribbon(spine, widths, 0.06)
    return [(x * c + z * s, y, -x * s + z * c) for x, y, z in verts], faces


def build(dims: dict) -> dict:
    pts = [(0.0, 0.0, 0.0), (0.15, 4.2, 0.0), (0.4, 8.4, 0.0), (0.75, 12.2, 0.0), (1.1, 14.6, 0.0)]
    trunk = sweep(pts, [0.7, 0.5, 0.42, 0.36, 0.3], 6)
    cx, cy = pts[-1][0], pts[-1][1]
    fronds = []
    for i in range(7):
        f = frond(i * 2 * math.pi / 7 + 0.2, 3.8, 1.5)
        fronds.append(([(x + cx, y + cy, z) for x, y, z in f[0]], f[1]))
    nuts = [blob(cx + 0.25, cy - 0.35, 0.3, 0.32, 0.32, 0.32), blob(cx - 0.2, cy - 0.35, -0.3, 0.3, 0.3, 0.3)]
    return finish({"trunk": [trunk], "soft": fronds, "coconut": nuts}, "beach", open_slots=())
