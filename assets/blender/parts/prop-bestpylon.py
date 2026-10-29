"""Plane Builder prop: a pylon for the best-distance wall, 3 m square at the
foot and 130 m tall (the game stretches it to the wall's height), tapering to a
point with blue and white bands. Slots: wall_blue, trim."""

from lib.obstaclekit import finish
from lib.shapes import box, loft

H = 130.0


def square(r):
    return [(-r, -r), (r, -r), (r, r), (-r, r)]


def build(dims: dict) -> dict:
    rungs = [(0.0, 1.5), (30.0, 1.2), (60.0, 0.95), (95.0, 0.75), (H - 8, 0.55)]
    blue, white = [], []
    for i, ((y0, r0), (y1, r1)) in enumerate(zip(rungs, rungs[1:])):
        layer = loft([(y0, square(r0)), (y1, square(r1))], axis="y", caps=False)
        (blue if i % 2 == 0 else white).append(layer)
    cap = loft([(H - 8, square(0.55)), (H, [(0.0, 0.0)] * 4)], axis="y", caps=False)
    blue.append(cap)
    white.append(box(0.0, 0.5, 0.0, 3.6, 1.0, 3.6))
    return finish({"wall_blue": blue, "trim": white}, "meadow", fit=False, open_slots=("wall_blue", "trim"))
