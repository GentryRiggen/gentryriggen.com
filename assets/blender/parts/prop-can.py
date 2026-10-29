"""Plane Builder prop: a jerry can, 2 m tall (fits the pickup's 2 m cylinder),
broad face toward the flight path's left and right (its depth runs along X).
A rounded red body, a grip across the top, a spout with a yellow cap and a raised
X on both big faces. Slots: can_red, can_dark, can_cap."""

import math

from lib.obstaclekit import finish, rotate_x
from lib.shapes import box, cylinder, rounded_box, translate

W, D, H = 1.5, 0.9, 1.6


def build(dims: dict) -> dict:
    body = rounded_box((0.0, -0.2, 0.0), (D, H, W), 0.14, steps=1)
    grip = [box(0.0, 0.8, 0.0, 0.26, 0.12, 0.7), box(0.0, 0.66, 0.36, 0.26, 0.3, 0.12),
            box(0.0, 0.66, -0.36, 0.26, 0.3, 0.12)]
    spout = cylinder(0.17, 0.2, 0.34, 8, 0.78)
    spout = ([(x, y, z + 0.52) for x, y, z in spout[0]], spout[1])
    cap = cylinder(0.2, 0.2, 0.12, 8, 1.0)
    cap = ([(x, y, z + 0.52) for x, y, z in cap[0]], cap[1])
    brace = []
    for side in (-1, 1):
        for sign in (-1, 1):
            bar = rotate_x(box(0.0, 0.0, 0.0, 0.05, 1.05, 0.12), sign * 0.7)
            brace.append(translate(bar, side * (D / 2 + 0.01), -0.2, 0.0))
    return finish(
        {"can_red": [body] + grip, "can_dark": brace + [spout], "can_cap": [cap]},
        "meadow",
        fit=False,
    )
