"""Plane Builder prop: a distance-sign post, 5 m to the board's centre, with a
base plate and a slate frame round where the board hangs (the board, with its
label, is procedural: 6 m wide, 1.5 m tall, centred on the post's top).
Slots: pole_light, sign_frame."""

from lib.obstaclekit import finish
from lib.shapes import box, lathe

HEIGHT = 5.0
W, H = 6.0, 1.5
T = 0.14


def build(dims: dict) -> dict:
    post = [lathe([(0.0, 0.0), (0.2, 0.0), (0.2, HEIGHT - H / 2), (0.0, HEIGHT - H / 2)], 8),
            box(0.0, 0.12, 0.0, 0.8, 0.24, 0.8)]
    frame = [box(0.0, HEIGHT + H / 2, 0.0, 0.14, T, W + 0.3), box(0.0, HEIGHT - H / 2, 0.0, 0.14, T, W + 0.3),
             box(0.0, HEIGHT, W / 2 + 0.08, 0.14, H, T), box(0.0, HEIGHT, -W / 2 - 0.08, 0.14, H, T)]
    return finish({"pole_light": post, "sign_frame": frame}, "meadow", fit=False)
