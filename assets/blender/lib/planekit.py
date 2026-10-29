"""Helpers shared by the Plane Builder piece scripts (plane-*.py). Three.js
coordinates: the nose points along +X, +Y is up, +Z is the right wing. Every
piece is built at the unit size the game scales it from (see
components/plane-builder/scene/PlaneModel.tsx), and names its objects by the
plane's paints: body, trim, dark (the game's PlaneMaterials)."""

from __future__ import annotations

import math
from typing import Sequence

from lib.shapes import Mesh, hex_linear, loft, make_object, merge

# The canyon plane's palette, so a Blender render reads like the studio's.
BODY = hex_linear("#3b82c4")
TRIM = hex_linear("#f5d76e")
DARK = hex_linear("#2f3a4a")
PAINTS = {
    "body": (BODY, 0.1, 0.6),
    "trim": (TRIM, 0.0, 0.6),
    "dark": (DARK, 0.0, 0.5),
}


def ring(n: int, rz: float, ry: float, cy: float = 0.0, cz: float = 0.0):
    """n points of an ellipse (z, y) seen down the X axis, going round once."""
    return [
        (cz + rz * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n))
        for i in range(n)
    ]


def smooth(t: float) -> float:
    return t * t * (3 - 2 * t)


def rotate_z(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +Z (+X turns toward +Y)."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - y * s, x * s + y * c, z) for x, y, z in verts], faces


def rotate_x(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +X (+Y turns toward +Z)."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x, y * c - z * s, y * s + z * c) for x, y, z in verts], faces


def scaled(mesh: Mesh, sx: float, sy: float, sz: float) -> Mesh:
    verts, faces = mesh
    flips = (sx < 0) ^ (sy < 0) ^ (sz < 0)
    out = [(x * sx, y * sy, z * sz) for x, y, z in verts]
    return out, [tuple(reversed(f)) for f in faces] if flips else faces


def mirror_z(mesh: Mesh) -> Mesh:
    return scaled(mesh, 1, 1, -1)


def both_sides(mesh: Mesh) -> Mesh:
    return merge([mesh, mirror_z(mesh)])


def slab(poly: Sequence[tuple[float, float]], z0: float, z1: float) -> Mesh:
    """A closed (x, y) outline pushed along Z from z0 to z1."""
    from lib.shapes import extrude

    return extrude(poly, z0, z1, axis="z")


def finish(slots: dict[str, list[Mesh]]) -> dict:
    """One Blender object per slot that has geometry."""
    objects = {}
    for name, meshes in slots.items():
        if not meshes:
            continue
        color, metallic, roughness = PAINTS[name]
        objects[name] = make_object(
            name,
            merge(meshes),
            color,
            metallic=metallic,
            roughness=roughness,
            closed=True,
        )
    return objects


def _naca(v: float) -> float:
    """NACA half-thickness shape (0 at the nose, v = 1 at the tail), scaled so
    its peak is 1."""
    g = 0.2969 * math.sqrt(v) - 0.126 * v - 0.3516 * v**2 + 0.2843 * v**3 - 0.1015 * v**4
    return g / 0.0894


def lens(n: int, half_chord: float, half_thick: float, camber: float = 0.0):
    """A closed (x, y) airfoil outline of n points (even): rounded nose at
    +x, sharp tail at -x, `half_thick` the largest half-thickness. `camber`
    lifts the middle by that share of the half thickness."""
    m = n // 2
    vs = [(1 - math.cos(math.pi * i / m)) / 2 for i in range(m + 1)]
    upper = []
    lower = []
    for v in vs:
        x = half_chord - 2 * half_chord * v
        th = half_thick * max(_naca(v), 0.0)
        lift = camber * half_thick * math.sin(math.pi * v)
        upper.append((x, th + lift))
        lower.append((x, -th * 0.8 + lift))
    return upper + list(reversed(lower))[1:-1]


def loft_sections(sections, axis):
    return loft(sections, axis=axis)
