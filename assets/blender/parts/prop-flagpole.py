"""Plane Builder prop: a milestone flag pole, 14 m tall, with a base plinth, a
gold ball on top and a boom along -Z for the flag to hang from (the flag, with
its label, is procedural). Slots: pole_light, pole_cap."""

from lib.obstaclekit import finish
from lib.shapes import box, cylinder, lathe

HEIGHT = 14.0
FLAG_WIDTH = 8.0


def build(dims: dict) -> dict:
    pole = [lathe([(0.0, 0.0), (0.2, 0.0), (0.2, HEIGHT - 0.1), (0.0, HEIGHT - 0.1)], 8),
            box(0.0, 0.3, 0.0, 1.0, 0.6, 1.0), cylinder(0.3, 0.3, 0.12, 8, 1.4),
            box(0.0, HEIGHT - 0.12, -FLAG_WIDTH / 2, 0.12, 0.12, FLAG_WIDTH + 0.1)]
    ball = [lathe([(0.0, HEIGHT - 0.1), (0.28, HEIGHT + 0.05), (0.34, HEIGHT + 0.3), (0.2, HEIGHT + 0.55), (0.0, HEIGHT + 0.62)], 8)]
    return finish({"pole_light": pole, "pole_cap": ball}, "meadow", fit=False)
