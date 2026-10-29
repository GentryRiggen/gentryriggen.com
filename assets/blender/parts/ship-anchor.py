"""An Admiralty anchor lying flat on the deck, in three.js coordinates
(Y-up, shank along X with the ring at +X, origin on the deck at the
footprint centre): a tapered shank rising a little toward the ring, a
rounded crown, two curved arms ending in flat pointed flukes, a ring, and
a wooden stock across the shank near the ring (as the game draws it)."""

import math

from lib.deckkit import arc_points, rot_x, sweep
from lib.shapes import extrude, hex_linear, lathe, make_object, merge, rounded_box, translate, tube

CROWN_X = -0.285
RING_X = 0.255
ARM_Y = 0.03


def shank_y(x: float) -> float:
    t = (x - CROWN_X) / (RING_X - CROWN_X)
    return ARM_Y + 0.045 * t


def iron():
    parts = []
    xs = [CROWN_X + (RING_X - CROWN_X) * k / 8 for k in range(9)]
    radii = [0.03 - 0.011 * k / 8 for k in range(9)]
    parts.append(sweep([(x, shank_y(x), 0.0) for x in xs], radii, 10))
    # Crown: a rounded block where shank and arms meet.
    crown = lathe([(0.0, -0.05), (0.036, -0.04), (0.048, 0.0), (0.036, 0.04), (0.0, 0.05)], 12)
    parts.append(translate(rot_x(crown, math.pi / 2), CROWN_X, ARM_Y, 0.0))
    for s in (-1, 1):
        path = [
            (CROWN_X, ARM_Y, 0.0),
            (CROWN_X - 0.008, ARM_Y, s * 0.07),
            (CROWN_X + 0.015, ARM_Y, s * 0.14),
            (CROWN_X + 0.06, ARM_Y, s * 0.2),
        ]
        parts.append(sweep(path, [0.028, 0.024, 0.02, 0.018], 8))
        # The fluke: a flat leaf, pointed at the tip.
        palm = [(CROWN_X + 0.018, 0.165), (CROWN_X + 0.075, 0.185), (CROWN_X + 0.15, 0.232),
                (CROWN_X + 0.2, 0.282), (CROWN_X + 0.09, 0.268), (CROWN_X + 0.035, 0.225)]
        if s < 0:
            palm = [(x, -z) for x, z in reversed(palm)]
        parts.append(extrude(palm, 0.003, 0.043, axis="y"))
    # The ring, a loop standing in the XY plane at the end of the shank.
    cx, cy = RING_X + 0.035, shank_y(RING_X) + 0.03
    loop = arc_points(cx, cy, 0.042, math.radians(215), math.radians(215 + 340), 18)
    parts.append(tube(loop, 0.009, 6))
    return parts


def stock():
    x = RING_X - 0.07
    y = shank_y(x) + 0.05
    return [translate(rounded_box((0, 0, 0), (0.048, 0.044, 0.5), 0.012, 2), x, y, 0.0)]


COLORS = {"iron": "#33383d", "stock": "#5a3a22"}
METAL = {"iron": 0.8}


def build(dims: dict) -> dict:
    groups = {"iron": iron(), "stock": stock()}
    return {
        name: make_object(
            name, merge(parts), hex_linear(COLORS[name]),
            metallic=METAL.get(name, 0.0), roughness=0.6, closed=True, sharp_degrees=40,
        )
        for name, parts in groups.items()
    }
