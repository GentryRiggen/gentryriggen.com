"""Plane Builder obstacle: a snow-capped mountain, 44 x 120 x 44 m (typical).

A faceted rock cone with ridges running down it and a smaller shoulder peak,
capped with a jagged snow line. Slots: rock, snow."""

import math

from lib.obstaclekit import finish
from lib.shapes import lathe

SEG = 8


def cone(rings, seg=SEG, phase=0.0, drop=0.0):
    """Rings of (height, radius, ridge) from the base up; ridge makes every
    other vertex stick out, which gives the cone its faceted ridges."""
    verts, faces, rows = [], [], []
    for y, r, ridge in rings:
        if r == 0:
            rows.append([len(verts)] * seg)
            verts.append((0.0, y, 0.0))
            continue
        row = []
        for i in range(seg):
            a = 2 * math.pi * i / seg + phase
            k = 1 + (ridge if i % 2 == 0 else -ridge)
            row.append(len(verts))
            verts.append((r * k * math.sin(a), y - (drop if i % 2 else 0.0), r * k * math.cos(a)))
        rows.append(row)
    for lo, hi in zip(rows, rows[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            quad = tuple(dict.fromkeys((lo[i], lo[j], hi[j], hi[i])))
            faces.append(quad)
    base = rows[0]
    faces.append(tuple(reversed(base)))
    return verts, faces


def radius_at(y):
    pts = [(0, 22), (30, 17.2), (60, 11.4), (90, 5.6), (120, 0)]
    for (y0, r0), (y1, r1) in zip(pts, pts[1:]):
        if y <= y1:
            return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return 0.0


def build(dims: dict) -> dict:
    ys = [0, 30, 60, 90, 120]
    rock = cone([(y, radius_at(y), 0.12 if 0 < y < 120 else 0.0) for y in ys])
    shoulder = cone([(0, 11, 0.1), (22, 8.5, 0.15), (46, 4.4, 0.18), (60, 0, 0)], phase=0.3)
    shoulder = ([(x + 13, y, z - 4) for x, y, z in shoulder[0]], shoulder[1])
    # Snow: from the snow line up, a shade proud of the rock, hem ragged.
    snow_ys = [34, 60, 90, 120]
    snow = cone([(y, radius_at(y) * 1.1 + 0.3, 0.12 if y < 120 else 0.0) for y in snow_ys], drop=9.0)
    return finish({"rock": [rock, shoulder], "snow": [snow]}, "mountains", flat=("rock", "snow"))
