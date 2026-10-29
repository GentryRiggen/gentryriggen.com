"""A navy-style searchlight on a swivel pedestal, in three.js coordinates
(Y-up, origin at the pedestal foot, the beam toward +X): a flared base and
column, a U yoke with trunnion bosses, a cylindrical drum with a domed back,
a bolted bezel ring round the front glass, a vent cap on top and a grab
handle at the back. The glass, its glow and the beam are drawn by the game
(the lens is a light), so the bezel leaves a 0.06 radius opening at x 0.14."""

import math

from lib.deckkit import rot_x, rot_z
from lib.shapes import cylinder, hex_linear, lathe, make_object, merge, round_hoop, rounded_box, translate, tube

DRUM_Y = 0.18
FRONT = 0.15


def pedestal():
    return [
        lathe([
            (0.0, 0.0), (0.05, 0.0), (0.05, 0.012), (0.038, 0.025), (0.024, 0.05),
            (0.02, 0.1), (0.026, 0.115), (0.0, 0.115),
        ], 16)
    ]


def yoke():
    parts = [translate(rounded_box((0, 0, 0), (0.05, 0.02, 0.22), 0.006, 1), 0.04, 0.115, 0.0)]
    for s in (-1, 1):
        parts.append(translate(rounded_box((0, 0, 0), (0.035, 0.1, 0.014), 0.005, 1), 0.04, 0.16, s * 0.1))
        boss = rot_x(cylinder(0.026, 0.026, 0.02, 10, 0.0), math.pi / 2)
        parts.append(translate(boss, 0.04, DRUM_Y, s * 0.104))
    return parts


def drum():
    # Profile (radius, along-the-axis) lathed about Y, then laid along +X.
    shell = lathe([
        (0.0, -0.075), (0.04, -0.073), (0.07, -0.06), (0.084, -0.04),  # domed back
        (0.09, -0.02), (0.088, 0.04), (0.084, 0.1),
        (0.092, 0.112), (0.092, 0.132),  # rolled front bezel
        (0.088, FRONT), (0.062, FRONT), (0.058, FRONT - 0.012),
        (0.058, FRONT - 0.03), (0.0, FRONT - 0.03),
    ], 24)
    parts = [shell]
    # Two clamp bands round the barrel.
    parts += [lathe(round_hoop(0.09, 0.09, y - 0.008, y + 0.008, 0.007, 3), 24) for y in (0.0, 0.085)]
    laid = [translate(rot_z(p, -math.pi / 2), 0.0, DRUM_Y, 0.0) for p in parts]
    vent = translate(cylinder(0.022, 0.026, 0.02, 10, 0.0), 0.0, DRUM_Y + 0.094, 0.0)
    handle = tube([(-0.07, 0.17, -0.04), (-0.1, 0.17, -0.04), (-0.112, 0.17, -0.022), (-0.112, 0.17, 0.022), (-0.1, 0.17, 0.04), (-0.07, 0.17, 0.04)], 0.008, 6)
    return laid + [vent, handle]


def build(dims: dict) -> dict:
    parts = pedestal() + yoke() + drum()
    return {
        "lampBody": make_object(
            "lampBody", merge(parts), hex_linear("#59616a"), metallic=0.8,
            roughness=0.5, closed=False, sharp_degrees=45,
        )
    }
