"""A deck floodlight, in three.js coordinates (Y-up, origin at the pole's
foot, the beam toward +X): a cast plinth, a collared pole, a yoke that
holds a tipped lamp head with cooling fins, a visor over the front and a
bezel round the lens. The lens, the beam and the pool of light are drawn by
the game (they are lights), so the bezel leaves the lens opening free: it is
0.13 x 0.27, centred on the head's +X face."""

import math

from lib.deckkit import rot_x, rot_z
from lib.shapes import cylinder, hex_linear, lathe, make_object, merge, round_hoop, rounded_box, translate

POLE_H = 0.95
TILT = 0.95
PIVOT = (0.04, 0.04 + POLE_H)


def stand():
    plinth = lathe([
        (0.0, 0.0), (0.12, 0.0), (0.12, 0.03), (0.1, 0.05), (0.06, 0.075),
        (0.036, 0.1), (0.0, 0.1),
    ], 16)
    pole = lathe([(0.0, 0.1), (0.036, 0.1), (0.028, 0.4), (0.026, 0.96), (0.0, 0.96)], 12)
    collars = [lathe(round_hoop(0.03, 0.03, y - 0.012, y + 0.012, 0.012, 3), 12) for y in (0.3, 0.7)]
    return [plinth, pole] + collars


def head():
    """The lamp head, built facing +X about its own centre, then tipped."""
    parts = [translate(rounded_box((0, 0, 0), (0.2, 0.17, 0.32), 0.035, 2), -0.01, 0, 0)]
    # Bezel round the lens opening on the +X face.
    for y in (-0.075, 0.075):
        parts.append(translate(rounded_box((0, 0, 0), (0.03, 0.02, 0.3), 0.006, 1), 0.112, y, 0))
    for z in (-0.147, 0.147):
        parts.append(translate(rounded_box((0, 0, 0), (0.03, 0.15, 0.026), 0.006, 1), 0.112, 0, z))
    # Visor hood: a plate tipped out over the lens, with side cheeks.
    hood = rot_z(rounded_box((0, 0, 0), (0.12, 0.012, 0.32), 0.005, 1), 0.2)
    parts.append(translate(hood, 0.165, 0.098, 0))
    for z in (-0.158, 0.158):
        parts.append(translate(rounded_box((0.0, 0, 0), (0.11, 0.045, 0.012), 0.004, 1), 0.16, 0.078, z))
    # Cooling fins across the back.
    for k in range(5):
        parts.append(translate(rounded_box((0, 0, 0), (0.035, 0.14, 0.012), 0.004, 1), -0.12, 0, -0.12 + 0.06 * k))
    # Pivot knuckles through the yoke arms.
    for z in (-0.175, 0.175):
        knuckle = rot_x(cylinder(0.03, 0.03, 0.03, 10, 0.0), math.pi / 2)
        parts.append(translate(knuckle, 0.0, 0.0, z))
    tipped = [rot_z(p, -TILT) for p in parts]
    return [translate(p, PIVOT[0], PIVOT[1], 0.0) for p in tipped]


def yoke():
    parts = []
    # Pole cap and a crossbar with an arm either side, up to the pivot.
    parts.append(lathe([(0.0, 0.94), (0.04, 0.945), (0.04, 0.985), (0.0, 0.99)], 12))
    parts.append(translate(rot_x(cylinder(0.014, 0.014, 0.36, 8, 0.0), math.pi / 2), 0.0, 0.975, 0.0))
    for z in (-0.18, 0.18):
        arm = rounded_box((0, 0, 0), (0.07, 0.022, 0.02), 0.006, 1)
        parts.append(translate(arm, 0.02, 0.985, z))
        parts.append(translate(rounded_box((0, 0, 0), (0.025, 0.05, 0.02), 0.006, 1), 0.04, 0.99, z))
    return parts


def build(dims: dict) -> dict:
    parts = stand() + head() + yoke()
    return {
        "body": make_object(
            "body", merge(parts), hex_linear("#2f3338"), metallic=0.8,
            roughness=0.5, closed=False, sharp_degrees=45,
        )
    }
