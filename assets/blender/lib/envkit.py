"""Shared builders for the sea-environment objects (iceberg, rocks, buoy, the
passing ship): faceted shells grown from rings of points around a vertical
axis. Three.js coordinates (Y up, bow +X, starboard +Z), meshes as
`(verts, faces)` like `lib.shapes`.

A shell is a list of rings, each with the same number of points, ordered by
increasing angle `a` (x = cos a, z = sin a). `skin` joins them into quads and
winds every face outward, so a part script never has to think about it.
"""

from __future__ import annotations

import math
import random
from typing import Callable, Sequence

from lib.shapes import Face, Mesh, Vec


def skin(
    rings: Sequence[Sequence[Vec]],
    *,
    down: bool = False,
    first_cap: Vec | None = None,
    last_cap: Vec | None = None,
) -> Mesh:
    """Quads between consecutive rings, wound outward.

    `down` says the rings run from high to low (an underwater keel), which
    flips the winding. `first_cap` / `last_cap` close the start / end with a
    fan to a pole vertex (the apex of a dome, the point of a keel).
    """
    n = len(rings[0])
    verts: list[Vec] = []
    for ring in rings:
        if len(ring) != n:
            raise ValueError("every ring needs the same point count")
        verts += list(ring)
    faces: list[Face] = []
    for r in range(len(rings) - 1):
        lo, hi = r * n, (r + 1) * n
        for i in range(n):
            j = (i + 1) % n
            if down:
                faces.append((lo + i, lo + j, hi + j, hi + i))
            else:
                faces.append((lo + i, hi + i, hi + j, lo + j))
    if last_cap is not None:
        base = (len(rings) - 1) * n
        pole = len(verts)
        verts.append(last_cap)
        for i in range(n):
            j = (i + 1) % n
            # Above the last ring when rising, below it when descending.
            faces.append(
                (base + i, base + j, pole) if down else (base + i, pole, base + j)
            )
    if first_cap is not None:
        pole = len(verts)
        verts.append(first_cap)
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, pole, j) if down else (i, j, pole))
    return verts, faces


def harmonics(seed: int, count: int = 4, gain: float = 0.7) -> Callable[[float], float]:
    """A smooth, repeatable wobble of an angle, roughly within +-1."""
    rng = random.Random(seed)
    terms = [(k, rng.uniform(0, 2 * math.pi), rng.uniform(0.6, 1.0)) for k in range(1, count + 1)]
    norm = sum(w / k**gain for k, _, w in terms)

    def f(a: float) -> float:
        return sum(w * math.cos(k * a + ph) / k**gain for k, ph, w in terms) / norm

    return f


def split_by_y(mesh: Mesh, cut: float) -> tuple[Mesh, Mesh]:
    """Faces whose centre is below `cut`, and the rest (each with its own
    vertex list, so a shell can be painted in two slots)."""
    verts, faces = mesh
    low: list[Face] = []
    high: list[Face] = []
    for f in faces:
        cy = sum(verts[i][1] for i in f) / len(f)
        (low if cy < cut else high).append(f)

    def pick(group: list[Face]) -> Mesh:
        used = sorted({i for f in group for i in f})
        index = {old: new for new, old in enumerate(used)}
        return [verts[i] for i in used], [tuple(index[i] for i in f) for f in group]

    return pick(low), pick(high)


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def tent(
    x: float, z: float, cx: float, cz: float, rx: float, rz: float, height: float, power: float = 1.0
) -> float:
    """A pyramid-like hill: `height` at (cx, cz), falling to 0 at the
    elliptical radius (rx, rz). `power` below 1 makes it a rounder shoulder."""
    d = math.hypot((x - cx) / rx, (z - cz) / rz)
    return height * max(0.0, 1.0 - d) ** power
