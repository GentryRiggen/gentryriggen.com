"""The fixed hardware of the navigation lights: the white masthead light's
post, with a bolted base plate, two angle braces, the lamp housing and an
open guard cage with a rain cap around where the (procedural, glowing) lens
sits. The red and green sidelights stand at the bridge's wings, so their
position depends on the bridge and they stay procedural (registry subParts),
as do all the glow lenses. Origin at the roof under the attach point; the
post stands 0.3 aft of it."""

import math

from lib.shapes import box, cylinder, hex_linear, lathe, make_object, merge, tube

COLORS = {
    "housing": hex_linear("#59616a"),
    "pole": hex_linear("#5b4632"),
}
X = -0.3
LENS_Y = 0.53


def build(dims: dict) -> dict:
    pole = [
        cylinder(0.1, 0.1, 0.02, 12, 0.01, shift_x=X),
        cylinder(0.02, 0.025, 0.42, 8, 0.23, shift_x=X),
        cylinder(0.034, 0.034, 0.03, 8, 0.12, shift_x=X),
    ]
    for sz in (-1, 1):
        pole.append(tube([(X, 0.3, 0.02 * sz), (X, 0.04, 0.085 * sz)], 0.01, 4))
    for sx in (-1, 1):
        pole.append(tube([(X + 0.02 * sx, 0.3, 0), (X + 0.085 * sx, 0.04, 0)],
                         0.01, 4))
    housing = [
        box(X, 0.44, 0.0, 0.13, 0.08, 0.13),
        box(X, 0.485, 0.0, 0.1, 0.01, 0.1),
        # Rain cap over the lens.
        cylinder(0.02, 0.1, 0.05, 12, 0.645, shift_x=X),
    ]
    post = box(X + 0.09, 0.565, 0.0, 0.016, 0.16, 0.016)
    housing.append(_ring(post))
    return {
        "housing": make_object("housing", merge(housing), COLORS["housing"],
                               roughness=0.5),
        "pole": make_object("pole", merge(pole), COLORS["pole"], roughness=0.75),
    }


def _ring(mesh):
    """Four copies of `mesh` (built at +X offset from the post) around the
    post axis at X."""
    out = []
    verts, faces = mesh
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        c, s = math.cos(a), math.sin(a)
        local = [(x - X, y, z) for x, y, z in verts]
        out.append(([(X + x * c + z * s, y, -x * s + z * c) for x, y, z in local],
                    faces))
    return merge(out)
