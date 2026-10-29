"""Plane Builder obstacle: a natural rock arch, 12 x 40 x 16 m (typical).

An upside-down U of uneven rock strata: two legs that flare into a talus foot,
under a thick lintel, the opening running side to side (along Z), so from the
flight line (along X) it is a solid wall the size of its collision box. Layers
differ in thickness and ledge depth, and a crack steps the faces. Layers
alternate `hard` and `soft`. Slots: hard, soft."""

import math

from lib.obstaclekit import finish, ledge_cap, noise
from lib.shapes import loft, merge

HZ = 8.0
OPEN_Y = 23.0  # where the opening closes
OPEN_HALF = 3.4


def opening_half(y):
    """Half width of the opening at height y: a pointed-round arch."""
    if y >= OPEN_Y:
        return 0.0
    t = y / OPEN_Y
    return OPEN_HALF * math.sqrt(max(0.0, 1 - t**3.2))


def leg(side, outer, inner, seed):
    """One leg's outline (x, z), `side` is -1 or +1 (which leg); the ends are
    ragged and the outer face is stepped by a crack."""
    j = [noise(seed, i) for i in range(6)]
    pts = [
        (side * outer, -HZ + 0.5 + j[0] * 0.5),
        (side * (outer - 0.7 - 0.5 * abs(j[1])), -HZ + 0.3 * j[2]),
        (side * inner, -HZ + 0.4 + j[3] * 0.5),
        (side * inner, HZ - 0.4 - j[4] * 0.5),
        (side * (outer - 0.4), HZ + 0.0 * j[2]),
        (side * outer, HZ - 0.5 - j[5] * 0.5),
    ]
    return pts if side < 0 else pts[::-1]


def slab(outer, seed, step):
    """The lintel's outline: the whole width, a crack stepping each long face."""
    j = [noise(seed, i) for i in range(8)]
    return [
        (-outer, -HZ + 0.4 + j[0] * 0.4), (-1.5 + j[1], -HZ + j[2] * 0.3),
        (-1.2, -HZ + step), (outer, -HZ + step + 0.3 + j[3] * 0.3),
        (outer + j[4] * 0.3, HZ - 0.3), (2.0, HZ - j[5] * 0.3),
        (1.7, HZ - step), (-outer, HZ - step - 0.2 + j[6] * 0.3),
    ]


# (top y, outer half-width at the top, ledge to the next layer): thick and
# thin beds alternate, a talus flare at the foot.
LAYERS = [(7, 5.6, 0.2), (12, 5.4, 1.0), (19, 4.8, 0.3), (23, 4.4, 0.8),
          (28, 4.3, 0.6), (33, 3.8, 0.3), (40, 3.4, 0.0)]


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    y0, prev_outer = 0.0, 6.4
    for i, (y1, outer, ledge) in enumerate(LAYERS):
        parts = []
        inner_lo = opening_half(y0 + 0.2)
        inner_hi = opening_half(y1 - 0.2)
        if inner_hi <= 0.2:
            lo, hi = slab(prev_outer, i + 20, 0.5 + 0.3 * (i % 2)), slab(outer, i + 21, 0.9)
            parts += [loft([(y0, lo), (y1, hi)], axis="y", caps=False), ledge_cap(hi, y1)]
        else:
            for side in (-1, 1):
                lo = leg(side, prev_outer, inner_lo, i + 1 + side)
                hi = leg(side, outer, inner_hi, i + 7 + side)
                parts += [loft([(y0, lo), (y1, hi)], axis="y", caps=False), ledge_cap(hi, y1)]
        slots["soft" if i % 2 else "hard"].append(merge(parts))
        y0, prev_outer = y1, outer - ledge
    return finish(slots, "canyon", flat=("hard", "soft"), open_slots=("hard", "soft"))
