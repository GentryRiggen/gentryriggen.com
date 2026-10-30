"""Helpers for the Plane Builder obstacle scripts (obstacle-*.py).

Each obstacle is modelled in metres at its typical size, then `finish` fits
its joint bounding box exactly into the unit box (-0.5..0.5 on every axis). The game stretches the unit box to each obstacle's half-extents,
so the model survives the stretch at the typical aspect, and the box the
collision test uses is the box the model fills.

Meshes are named by colour role (`soft` and `hard` come from the level
palette in game; the rest are fixed colours, see FIXED_SLOT_COLORS in
components/plane-builder/scene/obstacleModels.ts)."""

from __future__ import annotations

import math

from lib.shapes import Mesh, extrude, hex_linear, make_object, merge, outward

# Stand-in colours for the Blender renders. `soft` and `hard` are replaced by
# the level palette in game; each script picks a stand-in level's pair.
ROLE_COLORS = {
    "trunk": "#7a4e2d",
    "rock": "#8a8680",
    "rock_dark": "#6f6a64",
    "snow": "#f5f8ff",
    "bird": "#3a3a46",
    "bird_light": "#eef0f4",
    "string": "#e8e8e8",
    "coconut": "#5b3a1e",
    "windows": "#9bd3f7",
    "roof": "#6d747c",
    "ice": "#e6f6ff",
    "ice_deep": "#b4d8ee",
    "coin_gold": "#fbbf24",
    "coin_rim": "#d99a0b",
    "ring_blue": "#38bdf8",
    "ring_white": "#f4fbff",
    "can_red": "#ef4444",
    "can_dark": "#3f3f46",
    "can_cap": "#fbbf24",
    "check_black": "#111827",
    "check_white": "#f9fafb",
    "banner_red": "#dc2626",
    "banner_trim": "#f9fafb",
    "frame_wood": "#8b5a2b",
    "frame_metal": "#9aa4b2",
    "frame": "#8b5a2b",
    "dark": "#3f3f46",
    "glow": "#22d3ee",
    "pole_light": "#e5e7eb",
    "pole_cap": "#f59e0b",
    "sign_frame": "#334155",
    "wall_blue": "#38bdf8",
    "tarmac": "#4b5563",
    "paint_white": "#f3f4f6",
    "paint_yellow": "#facc15",
    "palette_trim": "#f59e0b",
    "palette_ground": "#5f8f3f",
    "cloud_top": "#fbfcff",
    "cloud_mid": "#eef2f9",
    "cloud_base": "#dde5f0",
    "trim": "#f6f3ea",
    "basket": "#9a6b3a",
    "beak": "#f2b632",
}

# Palettes the studio draws with: (soft, hard).
LEVEL_PAIRS = {
    "meadow": ("#2f7a32", "#b5342b"),
    "canyon": ("#5b4636", "#9c4a2a"),
    "mountains": ("#3a4656", "#6d7889"),
    "beach": ("#2f9e5b", "#8a7a6a"),
    "jungle": ("#1d5a2a", "#6b5b3e"),
    "city": ("#d9534f", "#4a5560"),
    "glacier": ("#5a7d92", "#8cc8e0"),
    "storm": ("#2a303c", "#5a6270"),
}


def fit_unit_box(slots: dict[str, list[Mesh]]) -> dict[str, list[Mesh]]:
    """Scale and move every slot's meshes together so their joint bounding box
    is exactly the unit box (-0.5..0.5 on each axis)."""
    pts = [p for meshes in slots.values() for v, _ in meshes for p in v]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    mid = [(lo[i] + hi[i]) / 2 for i in range(3)]
    span = [hi[i] - lo[i] for i in range(3)]
    return {
        name: [
            ([tuple((p[i] - mid[i]) / span[i] for i in range(3)) for p in v], f)
            for v, f in meshes
        ]
        for name, meshes in slots.items()
    }


def finish(
    slots: dict[str, list[Mesh]],
    level: str,
    flat: tuple[str, ...] = (),
    smooth: tuple[str, ...] = (),
    open_slots: tuple[str, ...] = (),
    colors: dict[str, str] | None = None,
    fit: bool = True,
) -> dict:
    """Fit the slots' meshes (metres) into the unit box and make one Blender
    object per slot that has geometry. Slots named in `flat` are shaded
    faceted (rocks, ice), those in `smooth` fully rounded (clouds); those in
    `open_slots` are not closed shells, so their normals are kept as built.
    `colors` overrides stand-in colours for this variant's renders. `fit=False`
    keeps the metres as built (course props, which the game places at real size)."""
    soft, hard = LEVEL_PAIRS[level]
    colors = dict(ROLE_COLORS, soft=soft, hard=hard, **(colors or {}))
    objects = {}
    for name, meshes in (fit_unit_box(slots) if fit else slots).items():
        if not meshes:
            continue
        objects[name] = make_object(
            name,
            merge(meshes),
            hex_linear(colors[name]),
            roughness=0.85,
            closed=name not in open_slots,
            sharp_degrees=1.0 if name in flat else 85.0 if name in smooth else 35.0,
        )
    return objects


# --- shapes ------------------------------------------------------------------


def _icosahedron() -> Mesh:
    t = (1 + 5**0.5) / 2
    raw = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t),
           (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    verts = [tuple(c / math.sqrt(1 + t * t) for c in v) for v in raw]
    faces = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9),
             (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2),
             (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
             (8, 6, 7), (9, 8, 1)]
    return verts, faces


def blob(cx, cy, cz, rx, ry, rz, jitter=0.0, seed=0, subdiv=0) -> Mesh:
    """A rounded lump: an icosahedron (20 faces, or 80 with subdiv=1), each
    vertex pushed in or out by up to `jitter` (a share of the radius)."""
    verts, faces = _icosahedron()
    if subdiv:
        cache: dict[tuple[int, int], int] = {}
        verts = list(verts)

        def mid(a: int, b: int) -> int:
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = [(verts[a][i] + verts[b][i]) / 2 for i in range(3)]
                n = math.sqrt(sum(c * c for c in m))
                verts.append(tuple(c / n for c in m))
                cache[key] = len(verts) - 1
            return cache[key]

        nf = []
        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    out = []
    for i, (x, y, z) in enumerate(verts):
        k = 1 + jitter * math.sin(seed * 12.9898 + i * 78.233 + x * 3.1 + y * 5.7) * 0.9
        out.append((cx + x * rx * k, cy + y * ry * k, cz + z * rz * k))
    return out, faces


def gable_roof(x0, x1, z0, z1, y_eave, y_ridge, overhang=0.0) -> Mesh:
    """A roof prism along X: eaves at z0 and z1 at y_eave, ridge at mid z."""
    zm = (z0 + z1) / 2
    z0, z1 = z0 - overhang, z1 + overhang
    verts = [(x0, y_eave, z0), (x0, y_eave, z1), (x0, y_ridge, zm),
             (x1, y_eave, z0), (x1, y_eave, z1), (x1, y_ridge, zm)]
    faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (1, 2, 5, 4), (0, 1, 4, 3)]
    return verts, faces


def sweep(points, radii, seg=6, cap_bottom=True) -> Mesh:
    """A tapered tube along a mostly upright polyline: a ring of `seg` points
    in the horizontal plane at each point, with that point's radius."""
    verts = []
    for (px, py, pz), r in zip(points, radii):
        for i in range(seg):
            a = 2 * math.pi * i / seg
            verts.append((px + r * math.sin(a), py, pz + r * math.cos(a)))
    faces = []
    for k in range(len(points) - 1):
        lo, hi = k * seg, (k + 1) * seg
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((lo + i, lo + j, hi + j, hi + i))
    last = (len(points) - 1) * seg
    faces.append(tuple(range(last + seg - 1, last - 1, -1)))
    if cap_bottom:
        faces.append(tuple(range(seg)))
    return verts, faces


def ribbon(spine, widths, thick) -> Mesh:
    """A closed leaf-like strip along `spine` (3D points): at each point a
    diamond cross-section `widths[i]` wide (sideways, Z) and `thick` deep,
    ending in a point. Fronds, feathers."""
    verts = []
    for i, ((x, y, z), w) in enumerate(zip(spine, widths)):
        verts += [(x, y + thick, z), (x, y, z + w / 2), (x, y - thick, z), (x, y, z - w / 2)]
    faces = []
    for k in range(len(spine) - 1):
        lo, hi = 4 * k, 4 * (k + 1)
        for i in range(4):
            j = (i + 1) % 4
            faces.append((lo + i, hi + i, hi + j, lo + j))
    n = len(verts)
    faces.append((0, 1, 2, 3))
    faces.append((n - 1, n - 2, n - 3, n - 4))
    return outward((verts, faces))


def prism_xz(poly, y0, y1) -> Mesh:
    """A closed (x, z) outline pushed up from y0 to y1 (rock layers, tiers)."""
    return extrude(poly, y0, y1, axis="y")


# --- rock strata ---------------------------------------------------------------


def noise(seed: int, i: int) -> float:
    """A repeatable pseudo-random number in -1..1."""
    return math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1.0 * 2 - 1


def ledge_cap(outline, y, up=True) -> Mesh:
    """A flat fan over a closed (x, z) outline at height y, facing up (or
    down). The top of a rock layer is the ledge the next layer sits back from."""
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    verts = [(cx, y, cz)] + [(x, y, z) for x, z in outline]
    n = len(outline)
    faces = []
    for i in range(n):
        a, b = 1 + i, 1 + (i + 1) % n
        # Counter-clockwise from above (looking down -Y) faces up.
        area = (outline[i][0] - cx) * (outline[(i + 1) % n][1] - cz) - (
            outline[(i + 1) % n][0] - cx
        ) * (outline[i][1] - cz)
        faces.append((0, a, b) if (area > 0) != up else (0, b, a))
    return verts, faces


# --- props -----------------------------------------------------------------------


def rotate_x(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +X."""
    c, s = math.cos(angle), math.sin(angle)
    return [(x, y * c - z * s, y * s + z * c) for x, y, z in mesh[0]], mesh[1]


def rotate_z(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +Z."""
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - y * s, x * s + y * c, z) for x, y, z in mesh[0]], mesh[1]


def quad_up(x0, x1, z0, z1, y) -> Mesh:
    """A flat rectangle facing +Y (paint on a pad)."""
    return [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 3, 2, 1)]


def quad_x(x, y0, y1, z0, z1, facing) -> Mesh:
    """A flat rectangle in the plane x, facing +X (facing=1) or -X."""
    verts = [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)]
    return verts, [(0, 1, 2, 3)] if facing > 0 else [(0, 3, 2, 1)]


def quad_z(z, x0, x1, y0, y1, facing) -> Mesh:
    """A flat rectangle in the plane z, facing +Z (facing=1) or -Z."""
    verts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    return verts, [(0, 1, 2, 3)] if facing > 0 else [(0, 3, 2, 1)]


# --- skinned rock and cloud ------------------------------------------------------


def round_ring(cx, cz, hx, hz, n=10, squareness=3.5, turn=0.5):
    """`n` (x, z) points round a rounded rectangle (a superellipse) of half
    sizes hx, hz about (cx, cz). `turn` is the first angle in steps, so the
    long faces hold points and the corners are rounded, not sharp."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * (k + turn) / n
        c, s = math.cos(a), math.sin(a)
        e = 2.0 / squareness
        pts.append((cx + hx * math.copysign(abs(c) ** e, c),
                    cz + hz * math.copysign(abs(s) ** e, s)))
    return pts


def skin(rings, cap_top=False, cap_bottom=False) -> Mesh:
    """Skin a stack of rings, [(y, [(x, z), ...]), ...] bottom to top, all the
    same point count, into quads facing outward. Optional fan caps close the
    ends. Unlike `loft`, rings may differ freely in size and shape."""
    n = len(rings[0][1])
    verts = [(x, y, z) for y, pts in rings for x, z in pts]
    faces = []
    for r in range(len(rings) - 1):
        lo = r * n
        hi = lo + n
        cx = sum(p[0] for p in rings[r][1]) / n
        cz = sum(p[1] for p in rings[r][1]) / n
        for i in range(n):
            j = (i + 1) % n
            quad = (lo + i, lo + j, hi + j, hi + i)
            pts = [verts[k] for k in quad]
            # Newell normal against the ring centre decides the winding.
            nx = nz = 0.0
            for p, q in zip(pts, pts[1:] + pts[:1]):
                nx += (p[1] - q[1]) * (p[2] + q[2])
                nz += (p[0] - q[0]) * (p[1] + q[1])
            mx = sum(p[0] for p in pts) / 4 - cx
            mz = sum(p[2] for p in pts) / 4 - cz
            faces.append(quad if nx * mx + nz * mz >= 0 else quad[::-1])

    def cap(ring_index, up):
        pts = rings[ring_index][1]
        y = rings[ring_index][0]
        mid = len(verts)
        verts.append((sum(p[0] for p in pts) / n, y, sum(p[1] for p in pts) / n))
        base = ring_index * n
        for i in range(n):
            a, b = base + i, base + (i + 1) % n
            ax, az = verts[a][0] - verts[mid][0], verts[a][2] - verts[mid][2]
            bx, bz = verts[b][0] - verts[mid][0], verts[b][2] - verts[mid][2]
            # Counter-clockwise seen from above faces up.
            ccw = ax * bz - az * bx < 0
            faces.append((mid, a, b) if ccw == up else (mid, b, a))

    if cap_top:
        cap(len(rings) - 1, True)
    if cap_bottom:
        cap(0, False)
    return verts, faces


def paint_gradient(obj, values_by_height) -> None:
    """Write per-vertex brightness (the game multiplies a slot's paint by the
    glb's COLOR_0, never below 0.75) as the `ao` attribute, and show it in the
    Blender materials. `values_by_height(h)` takes a vertex's height in the unit
    box (0 bottom, 1 top) and returns its brightness 0..1."""
    from lib import ao

    mesh = obj.data
    layer = mesh.color_attributes.new(ao.ATTRIBUTE, "FLOAT_COLOR", "POINT")
    for v, item in zip(mesh.vertices, layer.data):
        value = values_by_height(v.co.z + 0.5)  # Blender Z is up
        item.color = (value, value, value, 1.0)
    ao._use_in_material(obj)
