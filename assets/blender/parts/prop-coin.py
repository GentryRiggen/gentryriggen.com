"""Plane Builder prop: a gold coin, radius 1.25 m, 0.25 m thick, standing with
its face toward the flight path (+X). A raised rim round a flat face, and a
star stamped on both sides. Slots: coin_gold (face), coin_rim (rim, star)."""

import math

from lib.obstaclekit import finish, rotate_z
from lib.shapes import extrude, lathe, translate

R = 1.25


def star(points=5, outer=0.72, inner=0.3):
    out = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        a = math.pi / points * i
        out.append((r * math.sin(a), r * math.cos(a)))
    return out[::-1]


def build(dims: dict) -> dict:
    face = lathe([(0.0, -0.09), (1.05, -0.09), (1.05, 0.09), (0.0, 0.09)], 12)
    rim = lathe([(1.0, -0.125), (R, -0.085), (R, 0.085), (1.0, 0.125)], 12)
    stamp_up = extrude(star(), 0.09, 0.115, axis="y")
    stamp_down = extrude(star(), -0.115, -0.09, axis="y")
    # The coin is built standing on its edge: axis along X, not Y.
    turn = lambda m: rotate_z(m, math.pi / 2)
    return finish(
        {"coin_gold": [turn(face)], "coin_rim": [turn(rim), turn(stamp_up), turn(stamp_down)]},
        "meadow",
        fit=False,
        open_slots=("coin_gold", "coin_rim"),
    )
