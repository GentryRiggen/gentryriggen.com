"""A liner deck lamp post, in three.js coordinates (Y-up, origin at the
foot): a stepped cast-iron plinth, a tapering column with collars, a cup, a
six-bar lantern cage and a capped roof with a finial. The glass globe that
glows at night is drawn by the game (it is a light), so the cage here is
open around the globe's place (centre y 0.88, radius 0.1)."""

import math

from lib.shapes import array_circle, hex_linear, lathe, make_object, merge, round_hoop, tube

GLOBE_Y = 0.88
GLOBE_R = 0.1
BARS = 6


def column():
    return lathe([
        (0.0, 0.0), (0.12, 0.0), (0.12, 0.022), (0.105, 0.03), (0.105, 0.05),
        (0.075, 0.07), (0.05, 0.11), (0.04, 0.16),  # plinth, cove into the column
        (0.036, 0.2), (0.03, 0.4), (0.027, 0.7), (0.034, 0.73), (0.06, 0.755),
        (0.075, 0.775), (0.07, 0.79), (0.0, 0.79),  # up into the cup
    ], 16)


def collars():
    parts = []
    for y, r in ((0.2, 0.036), (0.45, 0.03), (0.68, 0.028)):
        parts.append(lathe(round_hoop(r, r, y - 0.014, y + 0.014, 0.014, 3), 16))
    return parts


def cage():
    parts = []
    for k in range(BARS):
        az = 2 * math.pi * k / BARS
        pts = []
        for step in range(9):
            phi = math.radians(-76 + 152 * step / 8)  # up the globe's side
            r = (GLOBE_R + 0.012) * math.cos(phi) + 0.0
            pts.append((r * math.cos(az), GLOBE_Y + (GLOBE_R + 0.012) * math.sin(phi), -r * math.sin(az)))
        parts.append(tube(pts, 0.0065, 6))
    return parts


def roof():
    top = GLOBE_Y + GLOBE_R + 0.005
    return [
        lathe([
            (0.0, top - 0.015), (0.075, top - 0.015), (0.088, top),
            (0.06, top + 0.014), (0.03, top + 0.028), (0.012, top + 0.034),
            (0.016, top + 0.042), (0.0, top + 0.054),  # roof, neck and finial
        ], 16)
    ]


def build(dims: dict) -> dict:
    parts = [column()] + collars() + cage() + roof()
    return {
        "post": make_object(
            "post", merge(parts), hex_linear("#2f3338"), metallic=0.8,
            roughness=0.5, closed=False, sharp_degrees=45,
        )
    }
