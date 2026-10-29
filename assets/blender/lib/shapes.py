"""Mesh helpers for part build scripts.

Everything here builds plain meshes, `(verts, faces)`, in three.js
coordinates (Y-up, right-handed, +X the ship's bow, +Z starboard). Only
`make_object` touches Blender: it converts to Blender's Z-up frame with
`three_to_blender` and links a painted object into the scene.

Face winding: faces are listed counter-clockwise seen from outside, so
normals point outward. Closed shapes can also ask `make_object` to
recalculate normals (`closed=True`).
"""

from __future__ import annotations

import math
from typing import Sequence

Vec = tuple[float, float, float]
Face = tuple[int, ...]
Mesh = tuple[list[Vec], list[Face]]
Profile = Sequence[tuple[float, float]]

SEG = 32


# --- colour and frames -------------------------------------------------------


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear(r: float, g: float, b: float) -> tuple[float, float, float, float]:
    """A palette (sRGB) colour as the linear Base Color Blender expects."""
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def hex_linear(hex_color: str) -> tuple[float, float, float, float]:
    """`#rrggbb` (sRGB) as a linear Base Color."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return linear(r, g, b)


def three_to_blender(x: float, y: float, z: float) -> Vec:
    """three (x, y, z), Y-up, is Blender (x, -z, y), Z-up."""
    return (x, -z, y)


# --- combining and moving ----------------------------------------------------


def merge(parts: Sequence[Mesh]) -> Mesh:
    verts: list[Vec] = []
    faces: list[Face] = []
    for pv, pf in parts:
        base = len(verts)
        verts += pv
        faces += [tuple(i + base for i in f) for f in pf]
    return verts, faces


def translate(mesh: Mesh, dx: float, dy: float, dz: float = 0.0) -> Mesh:
    verts, faces = mesh
    return [(x + dx, y + dy, z + dz) for x, y, z in verts], faces


def rotate_y(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +Y (three's convention: +X turns toward -Z)."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c + z * s, y, -x * s + z * c) for x, y, z in verts], faces


def array_line(mesh: Mesh, count: int, step: Vec) -> Mesh:
    """`count` copies, each moved one more `step` than the last."""
    return merge(
        [translate(mesh, step[0] * k, step[1] * k, step[2] * k) for k in range(count)]
    )


def array_circle(mesh: Mesh, count: int, start: float = 0.0) -> Mesh:
    """`count` copies spread evenly around +Y, the first turned `start`."""
    return merge(
        [rotate_y(mesh, start + 2 * math.pi * k / count) for k in range(count)]
    )


# --- revolved shapes ----------------------------------------------------------


def lathe(profile: Profile, seg: int = SEG) -> Mesh:
    """Revolve (radius, y) points about Y. The profile runs so that its
    outward side is on the right when walking it (bottom to top on an outer
    wall), which gives outward-facing quads. A radius of 0 is a single pole
    vertex."""
    verts: list[Vec] = []
    rows: list[list[int]] = []
    for r, y in profile:
        if r == 0:
            rows.append([len(verts)] * seg)
            verts.append((0.0, y, 0.0))
            continue
        rows.append(list(range(len(verts), len(verts) + seg)))
        for i in range(seg):
            a = 2 * math.pi * i / seg
            verts.append((r * math.sin(a), y, r * math.cos(a)))
    faces: list[Face] = []
    for low, high in zip(rows, rows[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            quad = (low[i], low[j], high[j], high[i])
            unique = tuple(dict.fromkeys(quad))
            if len(unique) >= 3:
                faces.append(unique)
    return verts, faces


def round_hoop(
    r_bottom: float,
    r_top: float,
    y0: float,
    y1: float,
    proud: float,
    steps: int = 5,
) -> list[tuple[float, float]]:
    """A lathe profile: a half-round hoop standing `proud` off a tapered wall
    from y0 to y1."""
    pts = []
    for s in range(steps + 1):
        t = s / steps
        y = y0 + (y1 - y0) * t
        wall = r_bottom + (r_top - r_bottom) * t
        pts.append((wall + proud * math.sin(math.pi * t), y))
    return pts


def cylinder(
    r_top: float,
    r_bot: float,
    height: float,
    seg: int,
    centre_y: float,
    tilt: float = 0.0,
    shift_x: float = 0.0,
) -> Mesh:
    """Capped cylinder about Y; tilt rotates about Z, then it moves to
    (shift_x, centre_y, 0)."""
    top = [
        (r_top * math.sin(2 * math.pi * i / seg), height / 2,
         r_top * math.cos(2 * math.pi * i / seg))
        for i in range(seg)
    ]
    bot = [
        (r_bot * math.sin(2 * math.pi * i / seg), -height / 2,
         r_bot * math.cos(2 * math.pi * i / seg))
        for i in range(seg)
    ]
    verts = top + bot + [(0, height / 2, 0), (0, -height / 2, 0)]
    faces: list[Face] = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((seg + i, seg + j, j, i))
        faces.append((2 * seg, i, j))
        faces.append((2 * seg + 1, seg + j, seg + i))
    c, s = math.cos(tilt), math.sin(tilt)
    out = [(x * c - y * s + shift_x, x * s + y * c + centre_y, z) for x, y, z in verts]
    return out, faces


def disc(radius: float, y: float, seg: int = SEG) -> Mesh:
    """A flat fan facing +Y at height y."""
    verts = [(0.0, y, 0.0)] + [
        (radius * math.sin(2 * math.pi * i / seg), y,
         radius * math.cos(2 * math.pi * i / seg))
        for i in range(seg)
    ]
    faces = [(0, 1 + i, 1 + (i + 1) % seg) for i in range(seg)]
    return verts, faces


# --- boxes --------------------------------------------------------------------


def box(cx: float, cy: float, cz: float, sx: float, sy: float, sz: float) -> Mesh:
    """An axis-aligned box centred on (cx, cy, cz), sizes sx, sy, sz."""
    verts = [
        (cx + dx * sx / 2, cy + dy * sy / 2, cz + dz * sz / 2)
        for dx in (-1, 1)
        for dy in (-1, 1)
        for dz in (-1, 1)
    ]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
             (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return verts, faces


def rounded_box(
    centre: Vec,
    size: Vec,
    radius: float,
    steps: int = 3,
) -> Mesh:
    """A box with every edge and corner rounded to `radius` (clamped to half
    the smallest side) over `steps` segments. Cabins, deckhouses, hatches.
    Vertex count is N^3 - (N-2)^3 with N = 2 * (steps + 1); faces are quads,
    6 * (N-1)^2 of them."""
    if steps < 1:
        raise ValueError("rounded_box needs steps >= 1")
    half = [s / 2 for s in size]
    r = max(0.0, min(radius, *half))
    inner = [h - r for h in half]
    vals = [
        [-h + r * k / steps for k in range(steps + 1)]
        + [e + r * k / steps for k in range(steps + 1)]
        for h, e in zip(half, inner)
    ]
    n = len(vals[0])
    index: dict[tuple[int, int, int], int] = {}
    verts: list[Vec] = []

    def vid(i: int, j: int, k: int) -> int:
        key = (i, j, k)
        if key not in index:
            p = (vals[0][i], vals[1][j], vals[2][k])
            q = [max(-e, min(e, c)) for c, e in zip(p, inner)]
            d = [c - qc for c, qc in zip(p, q)]
            length = math.sqrt(sum(c * c for c in d))
            if length > 1e-12:
                p = tuple(qc + dc / length * r for qc, dc in zip(q, d))
            index[key] = len(verts)
            verts.append((p[0] + centre[0], p[1] + centre[1], p[2] + centre[2]))
        return index[key]

    faces: list[Face] = []
    last = n - 1
    for axis in range(3):
        a, b = (axis + 1) % 3, (axis + 2) % 3
        for side in (0, last):
            for u in range(last):
                for v in range(last):
                    corners = []
                    for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                        ijk = [0, 0, 0]
                        ijk[axis], ijk[a], ijk[b] = side, u + du, v + dv
                        corners.append(vid(*ijk))
                    # (a, b, axis) is right-handed, so a->b is CCW from +axis.
                    faces.append(tuple(corners if side == last else corners[::-1]))
    return verts, faces


# --- profiles along an axis ----------------------------------------------------

AXES = ("x", "y", "z")


def _place(axis: str, t: float, across: float, up: float) -> Vec:
    """A profile point (across, up) at distance t along `axis`. Along x the
    profile is (z, y): a hull cross-section. Along z it is (x, y). Along y
    it is (x, z)."""
    if axis == "x":
        return (t, up, across)
    if axis == "z":
        return (across, up, t)
    if axis == "y":
        return (across, t, up)
    raise ValueError(f"axis must be one of {AXES}, not {axis!r}")


def signed_volume(mesh: Mesh) -> float:
    """Volume enclosed by a closed mesh: positive when its faces wind
    outward, negative when they all face in."""
    verts, faces = mesh
    total = 0.0
    for f in faces:
        a = verts[f[0]]
        for b, c in zip((verts[i] for i in f[1:-1]), (verts[i] for i in f[2:])):
            total += _dot(a, _cross(b, c))
    return total / 6


def outward(mesh: Mesh) -> Mesh:
    """A closed mesh with its faces flipped if they wind inward."""
    if signed_volume(mesh) >= 0:
        return mesh
    verts, faces = mesh
    return verts, [tuple(reversed(f)) for f in faces]


def _capped(sides: Mesh, rings: int, n: int, caps: bool) -> Mesh:
    """Close a skin of `rings` rings of `n` points with two n-gon caps, wind
    it outward, and drop the caps again when they were not asked for (the
    open skin keeps the outward winding)."""
    verts, faces = sides
    last = (rings - 1) * n
    closed = outward(
        (verts, faces + [tuple(range(n - 1, -1, -1)), tuple(range(last, last + n))])
    )
    return closed if caps else (closed[0], closed[1][:-2])


def loft(
    sections: Sequence[tuple[float, Profile]],
    axis: str = "x",
    caps: bool = True,
) -> Mesh:
    """Skin closed 2D profiles placed along `axis`: each section is
    (t, [(across, up), ...]) and every profile has the same point count. A
    hull is a loft of cross-sections from stern to bow. Caps are single
    n-gons (Blender triangulates them on export). Faces: (sections-1) * n
    side quads, plus 2 caps."""
    if len(sections) < 2:
        raise ValueError("loft needs at least two sections")
    n = len(sections[0][1])
    if any(len(p) != n for _, p in sections):
        raise ValueError("every loft profile needs the same point count")
    verts: list[Vec] = []
    for t, profile in sections:
        verts += [_place(axis, t, a, u) for a, u in profile]
    faces: list[Face] = []
    for s in range(len(sections) - 1):
        lo, hi = s * n, (s + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append((lo + i, lo + j, hi + j, hi + i))
    return _capped((verts, faces), len(sections), n, caps)


def extrude(
    profile: Profile,
    start: float,
    end: float,
    axis: str = "x",
    caps: bool = True,
) -> Mesh:
    """A closed 2D profile pushed straight along `axis` from start to end
    (see `loft` for the profile frame). A deckhouse side, a keel, a rudder
    blade."""
    return loft([(start, profile), (end, profile)], axis=axis, caps=caps)


# --- tubes ------------------------------------------------------------------------


def _sub(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _cross(a: Sequence[float], b: Sequence[float]) -> list[float]:
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _unit(v: Sequence[float]) -> list[float]:
    length = math.sqrt(sum(c * c for c in v))
    if length < 1e-12:
        raise ValueError("zero-length direction")
    return [c / length for c in v]


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def tube(
    points: Sequence[Vec],
    radius: float,
    seg: int = 8,
    caps: bool = True,
) -> Mesh:
    """A round tube through a polyline: rails, pipes, stays, wires. Rings use
    parallel-transported frames, so the tube never twists; each inner point
    gets a ring square to the average of its two segments. Verts:
    len(points) * seg; faces: (len(points) - 1) * seg quads plus 2 caps."""
    if len(points) < 2:
        raise ValueError("tube needs at least two points")
    dirs = [_unit(_sub(b, a)) for a, b in zip(points, points[1:])]
    tangents = [dirs[0]] + [
        _unit([a + b for a, b in zip(d0, d1)]) for d0, d1 in zip(dirs, dirs[1:])
    ] + [dirs[-1]]
    helper = [0.0, 1.0, 0.0] if abs(tangents[0][1]) < 0.9 else [1.0, 0.0, 0.0]
    normal = _unit(_cross(tangents[0], helper))
    verts: list[Vec] = []
    for idx, (p, t) in enumerate(zip(points, tangents)):
        if idx:
            # Parallel transport: drop the old normal's component along t.
            normal = _unit(_sub(normal, [c * _dot(normal, t) for c in t]))
        binormal = _cross(t, normal)
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ca, sa = math.cos(a) * radius, math.sin(a) * radius
            verts.append(tuple(p[k] + normal[k] * ca + binormal[k] * sa for k in range(3)))
    faces: list[Face] = []
    for s in range(len(points) - 1):
        lo, hi = s * seg, (s + 1) * seg
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((lo + i, lo + j, hi + j, hi + i))
    return _capped((verts, faces), len(points), seg, caps)


# --- Blender objects ---------------------------------------------------------------


def make_object(
    name: str,
    mesh: Mesh,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.5,
    closed: bool = False,
    sharp_degrees: float = 40.0,
):
    """Link a smooth-shaded object named `name` (its slot) into the scene,
    with one Principled material of the same name. `color` is linear (see
    `linear`). Duplicate vertices are welded. `closed=True` recalculates
    normals, which only works on closed shells (open lathed walls keep the
    winding they were built with). Edges sharper than `sharp_degrees` stay
    hard."""
    import bmesh
    import bpy

    verts, faces = mesh
    bm = bmesh.new()
    bverts = [bm.verts.new(three_to_blender(x, y, z)) for x, y, z in verts]
    for f in faces:
        bm.faces.new([bverts[i] for i in f])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    if closed:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    for poly in data.polygons:
        poly.use_smooth = True
    data.set_sharp_from_angle(angle=math.radians(sharp_degrees))
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    obj.data.materials.append(mat)
    return obj
