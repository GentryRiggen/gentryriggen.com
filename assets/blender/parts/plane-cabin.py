"""Plane Builder cabin (the ski plane's, Cessna style): a roofed box 1 long
and 1 wide (the game scales both) and 0.34 high, with a sloping windscreen at
the front (+x), a roof that falls away behind, rounded sides, dark side
windows and a dark windscreen."""

import math

from lib.planekit import finish, rotate_z
from lib.shapes import box, loft, merge, extrude

H = 0.17


def top(x: float) -> float:
    """Roof height at x: flat in the middle, sloping down fore and aft."""
    if x > 0.3:
        return 0.17 - (x - 0.3) * 0.92
    if x < -0.3:
        return 0.17 - (-0.3 - x) * 0.55
    return 0.17


def profile(x: float):
    t = top(x)
    w = 0.5
    return [
        (-w * 0.82, -H), (w * 0.82, -H), (w, -H + 0.05), (w * 0.97, t - 0.07),
        (w * 0.82, t), (-w * 0.82, t), (-w * 0.97, t - 0.07), (-w, -H + 0.05),
    ]


def build(dims: dict) -> dict:
    xs = (-0.5, -0.45, -0.3, -0.1, 0.1, 0.3, 0.4, 0.5)
    body = loft([(x, profile(x)) for x in xs], axis="x")
    windows = []
    for z0, z1 in ((0.488, 0.53), (-0.53, -0.488)):
        for outline in (
            [(-0.02, 0.0), (0.4, 0.0), (0.4, 0.06), (0.3, 0.135), (-0.02, 0.135)],
            [(-0.4, 0.0), (-0.1, 0.0), (-0.1, 0.135), (-0.4, 0.07)],
        ):
            windows.append(extrude(outline, z0, z1, axis="z"))
    slope = math.atan2(-0.92, 1.0)
    length = math.hypot(0.2, 0.184)
    mid_x, mid_y = 0.4, (0.17 + (0.17 - 0.2 * 0.92)) / 2
    screen = rotate_z(box(0, 0, 0, length, 0.016, 0.78), slope)
    verts, faces = screen
    screen = [(x + mid_x, y + mid_y + 0.008, z) for x, y, z in verts], faces
    return finish({"body": [body], "dark": windows + [screen], "trim": []})
