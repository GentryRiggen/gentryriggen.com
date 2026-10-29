"""Plane Builder prop: the finish gate's banner, 0.6 m deep, 6 m tall and
about 100 m wide (the game stretches it to the corridor): a red slab with a
white frame; the game draws the FINISH label inside the frame. Slots:
banner_red, banner_trim."""

from lib.obstaclekit import finish
from lib.shapes import box

W, H, D = 100.0, 6.0, 0.6


def build(dims: dict) -> dict:
    red = [box(0, 0, 0, D, H, W)]
    trim = [box(0, H / 2 - 0.15, 0, D + 0.08, 0.3, W), box(0, -H / 2 + 0.15, 0, D + 0.08, 0.3, W),
            box(0, 0, W / 2 - 1.2, D + 0.08, H, 2.4), box(0, 0, -W / 2 + 1.2, D + 0.08, H, 2.4)]
    return finish({"banner_red": red, "banner_trim": trim}, "meadow")
