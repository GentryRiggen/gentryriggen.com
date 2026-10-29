"""Plane Builder prop: the launch slingshot's frame, two variants (the band
and the powered glow stay procedural, they move or glow).

- wood: a plank base, two tapered posts with forked tops, a cross brace and
  rope lashings.
- metal: a plate base, tubular posts with collars and bolt heads.

Posts stand at z = +-1.4, 3 m tall (LAUNCH_HEIGHT), the band hooks to each
post's tip. Slots: frame (wood or steel in game), dark."""

import math

from lib.obstaclekit import finish, rotate_x
from lib.shapes import box, cylinder, lathe, translate

SPREAD = 1.4
HEIGHT = 3.0


def post(z, wood):
    shaft = lathe([(0.0, 0.0), (0.2, 0.0), (0.16, 0.2), (0.12, HEIGHT - 0.2), (0.15, HEIGHT - 0.05), (0.0, HEIGHT + 0.08)], 8)
    shaft = translate(shaft, 0.0, 0.0, z)
    fork = []
    if wood:
        # A short branch each side of the tip, like a Y.
        for s in (-1, 1):
            arm = rotate_x(cylinder(0.05, 0.08, 0.7, 6, 0.0), s * 0.55)
            fork.append(translate(arm, 0.0, HEIGHT - 0.25, z + s * 0.2))
    return shaft, fork


def build(dims: dict) -> dict:
    wood = dims["variant"] == "wood"
    frame, dark = [], []
    for z in (-SPREAD, SPREAD):
        shaft, fork = post(z, wood)
        frame += [shaft] + fork
        if wood:
            dark.append(translate(cylinder(0.19, 0.19, 0.12, 8, 0.0), 0.0, 2.1, z))  # a lashing
            dark.append(translate(cylinder(0.17, 0.17, 0.1, 8, 0.0), 0.0, 1.2, z))
        else:
            dark.append(translate(cylinder(0.22, 0.22, 0.14, 8, 0.0), 0.0, 1.0, z))  # a collar
            dark.append(translate(cylinder(0.2, 0.2, 0.14, 8, 0.0), 0.0, 2.2, z))
            for dz in (-0.28, 0.28):
                dark.append(box(0.0, 0.2, z + dz, 0.2, 0.1, 0.12))  # base bolts
    frame.append(box(0.0, 0.15, 0.0, 1.2, 0.3, SPREAD * 2 + 0.6))
    frame.append(box(0.0, 0.62, 0.0, 0.12, 0.12, SPREAD * 2 - 0.2))  # cross brace
    return finish({"frame": frame, "dark": dark}, "meadow", fit=False, open_slots=("frame", "dark"))
