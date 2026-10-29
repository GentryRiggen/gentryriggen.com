"""Plane Builder obstacle: an iceberg, 36 x 52 x 28 m (typical).

A broad, faceted tabular block of pale ice with a pinnacle and a smaller
horn rising from it, standing on a darker blue-ice foot. Slots: ice, ice_deep."""

import math

from lib.obstaclekit import finish
from lib.shapes import lathe, loft


def ring(cx, cz, rx, rz, seed, n=9, rough=0.16):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n + 0.2
        k = 1 + rough * math.sin(seed * 3.7 + i * 2.3)
        out.append((cx + rx * k * math.cos(a), cz + rz * k * math.sin(a)))
    return out


def build(dims: dict) -> dict:
    foot = loft([(0, ring(0, 0, 14, 11, 1)), (9, ring(0, 0, 18, 13.5, 1)), (17, ring(0, 0, 18, 14, 1.3))], axis="y")
    table = loft([(17, ring(0, 0, 18, 14, 1.3)), (31, ring(0, 0, 16, 12.5, 2)), (35, ring(-1, 0, 13, 10, 2.5))], axis="y")
    horn = lathe([(0.0, 33), (8.5, 33), (6.0, 41), (3.2, 47), (0.0, 52)], 5)
    horn = ([(x - 5, y, z + 1) for x, y, z in horn[0]], horn[1])
    spur = lathe([(0.0, 30), (5.5, 30), (3.5, 38), (0.0, 43)], 5)
    spur = ([(x + 9, y, z - 4) for x, y, z in spur[0]], spur[1])
    return finish({"ice_deep": [foot], "ice": [table, horn, spur]}, "glacier", flat=("ice", "ice_deep"))
