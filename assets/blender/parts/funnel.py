"""A liner funnel, built in three.js coordinates (Y-up, un-raked, origin at
the body base centre) and converted to Z-up. Same envelope as the procedural
funnel in components/ship-builder/scene/funnelGeometry.ts (radii, heights,
rim top and pipe reach), with the detail the game's primitives can't carry:
a base flange, riveted plate seams, rounded hoop bands, a hollow cap with a
rolled rim, and a bracketed steam pipe with a bell whistle."""

import math

import bpy
import bmesh

SEG = 32
BAND_FLARE = 0.012
RIM_TUBE = 0.03
PIPE_RADIUS = 0.028
PIPE_GAP = 0.045
WHISTLE_HEIGHT = 0.16
BANDS = [(0.3, 0.1), (0.52, 0.1)]
# Plate seams: fractions of the body height below the bands.
SEAMS = [0.16, 0.32, 0.48, 0.64]
SEAM_PROUD = 0.007
SEAM_HALF = 0.012
FLANGE = 0.008
FLANGE_HEIGHT = 0.07
OPENING_DEPTH = 0.32
SHARP_DEGREES = 40
GUY_RING = 0.945
GUY_EYES = 6

# The bell is wider than the pipe gap, so it stands this far further out.
WHISTLE_OUTSET = 0.015


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear(r: float, g: float, b: float) -> tuple[float, float, float, float]:
    """A palette (sRGB) colour as the linear Base Color Blender expects."""
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


COLORS = {
    "body": linear(0.827, 0.608, 0.271),
    "bands": linear(0.953, 0.937, 0.894),
    "cap": linear(0.08, 0.08, 0.08),
    "opening": linear(0.02, 0.02, 0.02),
    "pipe": linear(0.69, 0.553, 0.341),
}
METALLIC = {"pipe": 1.0}

Vec = tuple[float, float, float]
Mesh = tuple[list[Vec], list[tuple[int, ...]]]


def radius_at(dims: dict, height: float) -> float:
    return dims["topRadius"] + (dims["baseRadius"] - dims["topRadius"]) * (
        1 - height / dims["bodyHeight"]
    )


def lathe(profile: list[tuple[float, float]], seg: int = SEG) -> Mesh:
    """Revolve (radius, y) points about Y. The profile runs so that its
    outward side is on the right when walking it (bottom to top on an outer
    wall), which gives outward-facing quads."""
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
    faces = []
    for low, high in zip(rows, rows[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            quad = (low[i], low[j], high[j], high[i])
            unique = tuple(dict.fromkeys(quad))
            if len(unique) >= 3:
                faces.append(unique)
    return verts, faces


def round_hoop(r_bottom: float, r_top: float, y0: float, y1: float,
               proud: float, steps: int = 5) -> list[tuple[float, float]]:
    """A half-round hoop standing `proud` off a tapered wall from y0 to y1."""
    pts = []
    for s in range(steps + 1):
        t = s / steps
        y = y0 + (y1 - y0) * t
        wall = r_bottom + (r_top - r_bottom) * t
        pts.append((wall + proud * math.sin(math.pi * t), y))
    return pts


def body_profile(dims: dict) -> list[tuple[float, float]]:
    h = dims["bodyHeight"]
    r = lambda y: radius_at(dims, y)  # noqa: E731
    pts = [(0.0, 0.0), (r(0) + FLANGE, 0.0)]  # a closed base
    # A flange rolling into the wall at the deck.
    for s in range(1, 5):
        t = s / 4
        y = FLANGE_HEIGHT * t
        pts.append((r(y) + FLANGE * (1 - math.sin(t * math.pi / 2)), y))
    # Lapped plating: each strake's lower edge stands proud of the one below
    # and eases back into the wall over its height, so every seam is a crisp
    # downward-facing step that catches a shadow line.
    edges = [FLANGE_HEIGHT] + [h * f for f in SEAMS] + [h]
    for lower, upper in zip(edges, edges[1:]):
        if lower > FLANGE_HEIGHT:
            pts.append((r(lower) + SEAM_PROUD, lower))
        pts.append((r(lower + (upper - lower) * 0.5) + SEAM_PROUD * 0.3,
                    lower + (upper - lower) * 0.5))
        pts.append((r(upper - 0.002), upper - 0.002))
    pts.append((r(h), h))
    return pts


def cap_profile(dims: dict) -> list[tuple[float, float]]:
    """Outer wall up, over a rolled rim, down the inner wall to the soot."""
    h, cap_h = dims["bodyHeight"], dims["capHeight"]
    outer = dims["topRadius"] + 0.01
    top = h + cap_h
    # The old rim: a torus of tube RIM_TUBE centred just under the cap top.
    rc_r, rc_y = outer - 0.012, top - RIM_TUBE * 0.4
    pts = [(dims["topRadius"] - 0.002, h - 0.01), (outer, h - 0.01)]
    start = -math.pi / 3
    pts.append((outer, rc_y + RIM_TUBE * math.sin(start)))
    # The roll: from where it leaves the wall, over the top, to the inside.
    steps = 8
    for s in range(steps + 1):
        a = start + (math.pi - start) * s / steps
        pts.append((rc_r + RIM_TUBE * math.cos(a),
                    rc_y + RIM_TUBE * math.sin(a)))
    inner = rc_r - RIM_TUBE
    pts.append((inner, top - OPENING_DEPTH))
    return pts


def cylinder(r_top, r_bot, height, seg, centre_y, tilt=0.0, shift_x=0.0):
    """Capped cylinder about Y; tilt rotates about Z, then it moves to
    (shift_x, centre_y, 0)."""
    top = [(r_top * math.sin(2 * math.pi * i / seg), height / 2,
            r_top * math.cos(2 * math.pi * i / seg)) for i in range(seg)]
    bot = [(r_bot * math.sin(2 * math.pi * i / seg), -height / 2,
            r_bot * math.cos(2 * math.pi * i / seg)) for i in range(seg)]
    verts = top + bot + [(0, height / 2, 0), (0, -height / 2, 0)]
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((seg + i, seg + j, j, i))
        faces.append((2 * seg, i, j))
        faces.append((2 * seg + 1, seg + j, seg + i))
    c, s = math.cos(tilt), math.sin(tilt)
    out = [(x * c - y * s + shift_x, x * s + y * c + centre_y, z)
           for x, y, z in verts]
    return out, faces


def box(cx, cy, cz, sx, sy, sz) -> Mesh:
    verts = [(cx + dx * sx / 2, cy + dy * sy / 2, cz + dz * sz / 2)
             for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
             (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return verts, faces


def translate(mesh: Mesh, dx: float, dy: float) -> Mesh:
    verts, faces = mesh
    return [(x + dx, y + dy, z) for x, y, z in verts], faces


def merge(parts: list[Mesh]) -> Mesh:
    verts: list[Vec] = []
    faces: list[tuple[int, ...]] = []
    for pv, pf in parts:
        base = len(verts)
        verts += pv
        faces += [tuple(i + base for i in f) for f in pf]
    return verts, faces


def disc(radius: float, y: float, seg: int = SEG) -> Mesh:
    verts = [(0.0, y, 0.0)] + [
        (radius * math.sin(2 * math.pi * i / seg), y,
         radius * math.cos(2 * math.pi * i / seg)) for i in range(seg)
    ]
    faces = [(0, 1 + i, 1 + (i + 1) % seg) for i in range(seg)]
    return verts, faces


def steam_pipe(dims: dict) -> list[Mesh]:
    """A thin pipe up the aft (-X) side, clamped to the body, with a bell
    whistle on top."""
    bottom, top = 0.6, dims["bodyHeight"] * 0.9

    def x_at(h: float) -> float:
        return -(radius_at(dims, h) + PIPE_GAP)

    dx = x_at(top) - x_at(bottom)
    length = math.hypot(dx, top - bottom)
    tilt = -math.atan2(dx, top - bottom)
    parts = [cylinder(PIPE_RADIUS, PIPE_RADIUS, length, 8, (top + bottom) / 2,
                      tilt=tilt, shift_x=(x_at(top) + x_at(bottom)) / 2)]
    for frac in (0.15, 0.5, 0.85):
        h = bottom + (top - bottom) * frac
        wall = radius_at(dims, h)
        parts.append(box(-(wall + PIPE_GAP / 2), h, 0.0,
                         PIPE_GAP + 0.02, 0.025, 0.03))
    bell = [
        (PIPE_RADIUS * 1.0, 0.0),
        (PIPE_RADIUS * 1.9, 0.03),
        (PIPE_RADIUS * 1.9, WHISTLE_HEIGHT - 0.03),
        (PIPE_RADIUS * 1.5, WHISTLE_HEIGHT - 0.005),
        (PIPE_RADIUS * 1.2, WHISTLE_HEIGHT + 0.02),
        (0.0, WHISTLE_HEIGHT + 0.02),
    ]
    parts.append(translate(lathe(bell, 10), x_at(top) - WHISTLE_OUTSET, top - 0.02))
    return parts


def guy_ring(dims: dict) -> list[Mesh]:
    """The ring the funnel stays hook onto, just under the cap: a hoop with
    eye plates standing off it."""
    y = dims["bodyHeight"] * GUY_RING
    wall = radius_at(dims, y)
    parts = [lathe(round_hoop(radius_at(dims, y - 0.025), radius_at(dims, y + 0.025),
                              y - 0.025, y + 0.025, 0.01, 3))]
    for k in range(GUY_EYES):
        # Eyes at 0, 60, ... 300 degrees: none at -X, where the steam pipe runs.
        a = 2 * math.pi * k / GUY_EYES
        verts, faces = box(0.0, y, wall + 0.02, 0.025, 0.05, 0.03)
        c, s_ = math.cos(a), math.sin(a)
        parts.append(([(x * c + z * s_, yy, -x * s_ + z * c) for x, yy, z in verts], faces))
    return parts


def _make_object(name: str, mesh: Mesh) -> bpy.types.Object:
    verts, faces = mesh
    bm = bmesh.new()
    bverts = [bm.verts.new((x, -z, y)) for x, y, z in verts]  # three -> Blender
    for f in faces:
        bm.faces.new([bverts[i] for i in f])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    if name == "pipe":  # closed shapes only; the lathed walls are open
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    for poly in data.polygons:
        poly.use_smooth = True
    data.set_sharp_from_angle(angle=math.radians(SHARP_DEGREES))
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = COLORS[name]
    bsdf.inputs["Metallic"].default_value = METALLIC.get(name, 0.0)
    bsdf.inputs["Roughness"].default_value = 0.5
    obj.data.materials.append(mat)
    return obj


def build(dims: dict) -> dict[str, bpy.types.Object]:
    h = dims["bodyHeight"]
    bands = []
    for drop, height in BANDS:
        y0, y1 = h - drop - height / 2, h - drop + height / 2
        bands.append(lathe(round_hoop(
            radius_at(dims, y0), radius_at(dims, y1), y0, y1, BAND_FLARE)))
    cap_top = h + dims["capHeight"]
    inner = dims["topRadius"] + 0.01 - 0.012 - RIM_TUBE
    groups = {
        "body": [lathe(body_profile(dims))] + guy_ring(dims),
        "bands": bands,
        "cap": [lathe(cap_profile(dims))],
        "opening": [disc(inner + 0.002, cap_top - OPENING_DEPTH)],
        "pipe": steam_pipe(dims),
    }
    return {name: _make_object(name, merge(parts))
            for name, parts in groups.items()}
