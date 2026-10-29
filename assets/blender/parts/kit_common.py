"""Shared helpers for the grid-block detail kit (kit-window, kit-windscreen,
kit-porthole, kit-bridge-wing). Every wall piece is built in the same frame:
three.js coordinates (Y up), the wall's face on the plane x = 0, outward
along +X, the piece centred on the opening (y = 0 at its middle, z = 0 at
its middle across the wall). The game places a piece with one matrix (see
BlockKit in components/ship-builder/scene). The pieces are deliberately
low-poly: they read at game distance, and baked AO does the shading."""

from lib.shapes import box, merge

BACK = -0.01  # a frame reaches this far into the wall
FRONT = 0.02  # and this far off it


def frame_ring(outer, inner, front_outer, front_inner):
    """A picture frame around an opening: 12 quads (24 triangles), open at the
    back (hidden in the wall). `outer` and `inner` are (zmin, zmax, ymin, ymax);
    `front_outer(y)` and `front_inner(y)` give the depth of the outer and
    inner front edges at height y, so a frame can lean (a raked windscreen)
    and its inner edge sit behind its face (a rebate for the glass)."""

    def loop(rect, depth_fn, depth_const=None):
        z0, z1, y0, y1 = rect
        pts = [(z0, y0), (z0, y1), (z1, y1), (z1, y0)]
        return [
            (depth_const if depth_const is not None else depth_fn(y), y, z)
            for z, y in pts
        ]

    loops = [
        loop(outer, None, BACK),
        loop(outer, front_outer),
        loop(inner, front_inner),
        loop(inner, None, BACK),
    ]
    verts = [v for l in loops for v in l]
    faces = []
    for k in range(3):
        for i in range(4):
            j = (i + 1) % 4
            faces.append((4 * k + i, 4 * k + j, 4 * (k + 1) + j, 4 * (k + 1) + i))
    # Face normals must point outward (+x on the front ring): flip if not.
    a, b, c = (verts[faces[4][n]] for n in range(3))
    ux, uy, uz = (b[n] - a[n] for n in range(3))
    vx, vy, vz = (c[n] - b[n] for n in range(3))
    if ux * 0 + (uy * vz - uz * vy) < 0:
        faces = [tuple(reversed(f)) for f in faces]
    return verts, faces


__all__ = ["BACK", "FRONT", "frame_ring", "box", "merge"]
