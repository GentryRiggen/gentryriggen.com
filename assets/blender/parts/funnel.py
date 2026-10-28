"""Round 0: a faithful port of components/ship-builder/scene/funnelGeometry.ts
plus the body cylinder in FunnelMesh.tsx. Built in three.js coordinates
(Y-up, un-raked, origin at the body base centre) and converted to Z-up."""

import math

import bpy
import bmesh

SEG = 32  # the TS uses 16; radii, heights and positions are what must match
BAND_FLARE = 0.012
RIM_TUBE = 0.03
PIPE_RADIUS = 0.028
PIPE_GAP = 0.045
WHISTLE_HEIGHT = 0.16
BANDS = [(0.3, 0.1), (0.52, 0.1)]

COLORS = {
    "body": (0.827, 0.608, 0.271, 1.0),
    "bands": (0.953, 0.937, 0.894, 1.0),
    "cap": (0.08, 0.08, 0.08, 1.0),
    "opening": (0.02, 0.02, 0.02, 1.0),
    "pipe": (0.69, 0.553, 0.341, 1.0),
}
METALLIC = {"pipe": 1.0}

Vec = tuple[float, float, float]


def radius_at(dims: dict, height: float) -> float:
    return dims["topRadius"] + (dims["baseRadius"] - dims["topRadius"]) * (
        1 - height / dims["bodyHeight"]
    )


def _ring(radius: float, y: float, seg: int) -> list[Vec]:
    return [
        (radius * math.sin(2 * math.pi * i / seg), y, radius * math.cos(2 * math.pi * i / seg))
        for i in range(seg)
    ]


def cylinder(r_top, r_bot, height, seg, centre_y, tilt=0.0, shift_x=0.0):
    """Capped cylinder: returns (verts, faces). Tilt rotates about Z (three's
    rotateZ), then the result moves to (shift_x, centre_y, 0)."""
    top = _ring(r_top, height / 2, seg)
    bot = _ring(r_bot, -height / 2, seg)
    verts = top + bot + [(0, height / 2, 0), (0, -height / 2, 0)]
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((i, j, seg + j, seg + i))
        faces.append((2 * seg, j, i))
        faces.append((2 * seg + 1, seg + i, seg + j))
    cos_t, sin_t = math.cos(tilt), math.sin(tilt)
    out = [
        (x * cos_t - y * sin_t + shift_x, x * sin_t + y * cos_t + centre_y, z)
        for x, y, z in verts
    ]
    return out, faces


def torus(radius, tube, rad_seg, tub_seg, centre_y):
    """Ring torus lying flat (axis Y), like three's TorusGeometry.rotateX."""
    verts, faces = [], []
    for j in range(rad_seg):
        v = 2 * math.pi * j / rad_seg
        for i in range(tub_seg):
            u = 2 * math.pi * i / tub_seg
            verts.append(
                (
                    (radius + tube * math.cos(v)) * math.cos(u),
                    tube * math.sin(v),
                    (radius + tube * math.cos(v)) * math.sin(u),
                )
            )
    for j in range(rad_seg):
        for i in range(tub_seg):
            a = j * tub_seg + i
            b = j * tub_seg + (i + 1) % tub_seg
            c = ((j + 1) % rad_seg) * tub_seg + (i + 1) % tub_seg
            d = ((j + 1) % rad_seg) * tub_seg + i
            faces.append((a, b, c, d))
    return [(x, y + centre_y, z) for x, y, z in verts], faces


def disc(radius, seg, y):
    verts = [(0, y, 0)] + _ring(radius, y, seg)
    faces = [(0, 1 + (i + 1) % seg, 1 + i) for i in range(seg)]
    return verts, faces


def merge(parts):
    verts, faces = [], []
    for pv, pf in parts:
        base = len(verts)
        verts += pv
        faces += [tuple(i + base for i in f) for f in pf]
    return verts, faces


def _make_object(name: str, verts, faces) -> bpy.types.Object:
    bm = bmesh.new()
    bverts = [bm.verts.new((x, -z, y)) for x, y, z in verts]  # three -> Blender
    for f in faces:
        bm.faces.new([bverts[i] for i in f])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = COLORS[name]
    bsdf.inputs["Metallic"].default_value = METALLIC.get(name, 0.0)
    bsdf.inputs["Roughness"].default_value = 0.5
    obj.data.materials.append(mat)
    return obj


def build(dims: dict) -> dict[str, bpy.types.Object]:
    base, top = dims["baseRadius"], dims["topRadius"]
    body_h, cap_h = dims["bodyHeight"], dims["capHeight"]
    body = [cylinder(top, base, body_h, SEG, body_h / 2)]

    bands = []
    for drop, height in BANDS:
        centre = body_h - drop
        bands.append(
            cylinder(
                radius_at(dims, centre + height / 2) + BAND_FLARE,
                radius_at(dims, centre - height / 2) + BAND_FLARE,
                height,
                SEG,
                centre,
            )
        )

    cap_r = top + 0.01
    cap_top = body_h + cap_h
    cap = [
        cylinder(cap_r, cap_r, cap_h, SEG, body_h + cap_h / 2),
        torus(cap_r - 0.012, RIM_TUBE, 6, SEG, cap_top - RIM_TUBE * 0.4),
    ]

    opening = [disc((top + 0.01) * 0.78, SEG, cap_top + 0.003)]

    p_bottom, p_top = 0.6, body_h * 0.9

    def x_at(h: float) -> float:
        return -(radius_at(dims, h) + PIPE_GAP)

    dx = x_at(p_top) - x_at(p_bottom)
    length = math.hypot(dx, p_top - p_bottom)
    tilt = -math.atan2(dx, p_top - p_bottom)
    pipe = [
        cylinder(
            PIPE_RADIUS, PIPE_RADIUS, length, 6, (p_top + p_bottom) / 2,
            tilt=tilt, shift_x=(x_at(p_top) + x_at(p_bottom)) / 2,
        ),
        cylinder(
            PIPE_RADIUS * 1.9, PIPE_RADIUS * 1.9, WHISTLE_HEIGHT, 8,
            p_top + WHISTLE_HEIGHT / 2 - 0.02, shift_x=x_at(p_top),
        ),
        cylinder(
            PIPE_RADIUS * 1.2, PIPE_RADIUS * 1.9, 0.04, 8,
            p_top + WHISTLE_HEIGHT, shift_x=x_at(p_top),
        ),
    ]

    groups = {
        "body": body,
        "bands": bands,
        "cap": cap,
        "opening": opening,
        "pipe": pipe,
    }
    return {name: _make_object(name, *merge(parts)) for name, parts in groups.items()}
