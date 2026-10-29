"""Plane Builder obstacle: a natural rock arch, 12 x 40 x 16 m (typical).

An upside-down U of stacked rock layers: two legs under a thick lintel, the
opening running side to side (along Z), so from the flight line (along X) it
is a solid wall the size of its collision box. Layers alternate `hard` and
`soft`. Slots: hard, soft."""

import math

from lib.obstaclekit import finish, prism_xz

HZ = 8.0
OPEN_Y = 23.0  # where the opening closes
OPEN_HALF = 3.4
LAYER_TOPS = [6, 12, 17, 21, 24, 28, 40]


def opening_half(y):
    """Half width of the opening at height y: a pointed-round arch."""
    if y >= OPEN_Y:
        return 0.0
    t = y / OPEN_Y
    return OPEN_HALF * math.sqrt(max(0.0, 1 - t**3.2))


def outer_half(y):
    return 6.0 - 1.2 * (y / 40) ** 1.5


def quad(x0, x1, tilt):
    return [(x0, -HZ), (x1, -HZ + tilt), (x1, HZ), (x0, HZ - tilt)]


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    y0 = 0.0
    for i, y1 in enumerate(LAYER_TOPS):
        slot = slots["hard" if i % 2 == 0 else "soft"]
        mid = (y0 + y1) / 2
        outer = outer_half(mid) + (0.25 if i % 2 else -0.15)
        tilt = 0.6 if i % 2 else 0.2
        inner = opening_half(y1 - 0.2)
        if inner <= 0.2:
            slot.append(prism_xz(quad(-outer, outer, tilt), y0, y1))
        else:
            slot.append(prism_xz(quad(-outer, -inner, tilt), y0, y1))
            slot.append(prism_xz(quad(inner, outer, tilt), y0, y1))
        y0 = y1
    return finish(slots, "canyon", flat=("hard", "soft"))
