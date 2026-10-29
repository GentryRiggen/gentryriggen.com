"""The hardware of a steamer's wireless T-aerial: a spreader bar across the
masthead on a ball cap, with a ceramic insulator stack hanging at each end
where a wire leaves. The wires to the other mast vary with the ship, so they
stay procedural (registry subParts). Origin at the masthead; wires leave at
z = +-0.1, y = 0."""

import math

from lib.shapes import cylinder, hex_linear, lathe, make_object, merge, tube

COLORS = {
    "spreader": hex_linear("#2a2a2a"),
    "insulator": hex_linear("#e6e0d2"),
}
END_Z = 0.1


def sphere(r: float, y: float, seg: int = 10):
    pts = [(0.0, y - r)] + [
        (r * math.sin(a), y - r * math.cos(a))
        for a in [i * math.pi / 6 for i in range(1, 6)]
    ] + [(0.0, y + r)]
    return lathe(pts, seg)


def build(dims: dict) -> dict:
    spreader = [
        sphere(0.04, 0.028),
        tube([(0, 0.05, -END_Z), (0, 0.05, END_Z)], 0.011, 6),
        cylinder(0.022, 0.022, 0.03, 8, 0.012),
    ]
    insulator = []
    for sz in (-1, 1):
        # A stack of three porcelain discs on a pin under the bar's end.
        for y, r in ((0.036, 0.016), (0.02, 0.022), (0.004, 0.016)):
            insulator.append(_at(cylinder(r, r, 0.012, 8, y), sz))
    return {
        "spreader": make_object("spreader", merge(spreader),
                                COLORS["spreader"], metallic=0.8,
                                roughness=0.4),
        "insulator": make_object("insulator", merge(insulator),
                                 COLORS["insulator"], roughness=0.25),
    }


def _at(mesh, sz):
    verts, faces = mesh
    return [(x, y, z + sz * END_Z) for x, y, z in verts], faces
