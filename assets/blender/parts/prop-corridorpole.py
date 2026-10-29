"""Plane Builder prop: a corridor marker pole, 6 m tall and 0.5 m across,
centred on y = 0, banded in the level's trim colour and cream, with a cap.
Slots: palette_trim, trim."""

from lib.obstaclekit import finish
from lib.shapes import lathe

H = 6.0
R = 0.25


def band(y0, y1, r=R):
    return lathe([(r, y0), (r, y1)], 6)


def build(dims: dict) -> dict:
    trim = [band(-3.0, -1.0), band(0.0, 1.0), band(2.0, 3.0), lathe([(0.0, 3.0), (0.27, 3.0), (0.27, 3.1), (0.0, 3.3)], 6)]
    cream = [band(-1.0, 0.0), band(1.0, 2.0)]
    return finish({"palette_trim": trim, "trim": cream}, "meadow", fit=False, open_slots=("palette_trim", "trim"))
