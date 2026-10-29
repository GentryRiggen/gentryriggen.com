"""Plane Builder prop: one chequered finish-gate post, 2 m square and 28 m
tall, standing on y = 0: a white column with 1 m black squares stamped on every
face (a chequer), a plinth and a cap. Slots: check_white, check_black."""

from lib.obstaclekit import finish, quad_x, quad_z
from lib.shapes import box

POST = 2.0
HEIGHT = 28.0
EPS = 0.03


def build(dims: dict) -> dict:
    white = [box(0, HEIGHT / 2, 0, POST, HEIGHT, POST), box(0, 0.25, 0, POST + 0.4, 0.5, POST + 0.4),
             box(0, HEIGHT + 0.25, 0, POST + 0.4, 0.5, POST + 0.4)]
    black = []
    h = POST / 2 + EPS
    for row in range(int(HEIGHT)):
        for col in range(2):
            if (row + col) % 2 == 0:
                continue
            a, b = -1.0 + col, col
            y0, y1 = float(row), float(row + 1)
            black += [quad_x(h, y0, y1, a, b, 1), quad_x(-h, y0, y1, a, b, -1),
                      quad_z(h, a, b, y0, y1, 1), quad_z(-h, a, b, y0, y1, -1)]
    return finish({"check_white": white, "check_black": black}, "meadow", fit=False,
                  open_slots=("check_black",))
