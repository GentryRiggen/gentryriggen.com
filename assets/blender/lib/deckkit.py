"""Extra mesh moves for the deck-fitting parts (all in three.js coordinates):
rotations about Z and X, and a round sweep whose radius changes along the
path (a cowl neck that flares into a mouth, a tapered post)."""

from __future__ import annotations

import math
from typing import Sequence

from lib.shapes import Mesh, Vec, _capped, _cross, _dot, _sub, _unit


def rot_z(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +Z (+X turns toward +Y)."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - y * s, x * s + y * c, z) for x, y, z in verts], faces


def rot_x(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +X (+Y turns toward +Z)."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x, y * c - z * s, y * s + z * c) for x, y, z in verts], faces


def sweep(
    points: Sequence[Vec],
    radii: Sequence[float],
    seg: int = 12,
    caps: bool = True,
) -> Mesh:
    """Like `tube`, with a radius per path point."""
    if len(points) != len(radii) or len(points) < 2:
        raise ValueError("sweep needs one radius per point, two points at least")
    dirs = [_unit(_sub(b, a)) for a, b in zip(points, points[1:])]
    tangents = (
        [dirs[0]]
        + [_unit([a + b for a, b in zip(d0, d1)]) for d0, d1 in zip(dirs, dirs[1:])]
        + [dirs[-1]]
    )
    helper = [0.0, 1.0, 0.0] if abs(tangents[0][1]) < 0.9 else [1.0, 0.0, 0.0]
    normal = _unit(_cross(tangents[0], helper))
    verts: list[Vec] = []
    for idx, (p, t, r) in enumerate(zip(points, tangents, radii)):
        if idx:
            normal = _unit(_sub(normal, [c * _dot(normal, t) for c in t]))
        binormal = _cross(t, normal)
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ca, sa = math.cos(a) * r, math.sin(a) * r
            verts.append(
                tuple(p[k] + normal[k] * ca + binormal[k] * sa for k in range(3))
            )
    faces = []
    for s in range(len(points) - 1):
        lo, hi = s * seg, (s + 1) * seg
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((lo + i, lo + j, hi + j, hi + i))
    return _capped((verts, faces), len(points), seg, caps)


def arc_points(
    cx: float, cy: float, radius: float, start: float, end: float, steps: int
) -> list[Vec]:
    """Points on a circle in the XY plane (z = 0), angles in radians."""
    return [
        (
            cx + radius * math.cos(start + (end - start) * k / steps),
            cy + radius * math.sin(start + (end - start) * k / steps),
            0.0,
        )
        for k in range(steps + 1)
    ]
