"""Plane Builder prop: the powered launch slingshot's frame: a steel plate base,
tubular posts with collars and a glowing channel along the base. The glow caps
on the post tips and the band stay procedural. Slots: frame, dark, glow."""

from lib.obstaclekit import finish
from lib.shapes import box, cylinder, lathe, translate

SPREAD = 1.4
HEIGHT = 3.0


def build(dims: dict) -> dict:
    frame, dark, glow = [], [], []
    for z in (-SPREAD, SPREAD):
        shaft = lathe([(0.0, 0.0), (0.22, 0.0), (0.17, 0.25), (0.13, HEIGHT - 0.3), (0.16, HEIGHT - 0.1), (0.0, HEIGHT - 0.1)], 8)
        frame.append(translate(shaft, 0.0, 0.0, z))
        dark.append(translate(cylinder(0.23, 0.23, 0.16, 8, 0.0), 0.0, 0.9, z))
        dark.append(translate(cylinder(0.2, 0.2, 0.16, 8, 0.0), 0.0, 2.0, z))
        glow.append(box(0.0, 1.45, z, 0.08, 0.7, 0.08))  # a lit conduit up the post
    frame.append(box(0.0, 0.15, 0.0, 1.2, 0.3, SPREAD * 2 + 0.6))
    glow.append(box(0.6, 0.24, 0.0, 0.06, 0.06, SPREAD * 2))  # glow strip along the base
    return finish({"frame": frame, "dark": dark, "glow": glow}, "meadow", fit=False,
                  open_slots=("frame", "dark", "glow"))
