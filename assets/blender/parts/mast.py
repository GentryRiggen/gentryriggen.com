"""A liner's pole mast (the Titanic's foremast, simplified): a tapered wooden
spar with a canvas-and-leather collar at the deck, painted bands, a yard
cross-piece with lifts, a masthead cap and a truck ball. Origin at the foot
of the mast, 7.02 high like the procedural mast; the yard is the only part
wider than the old 0.2 envelope."""

import math

from lib.shapes import (
    box,
    cylinder,
    hex_linear,
    lathe,
    make_object,
    merge,
    translate,
)

HEIGHT = 7.0
BASE_R, TOP_R = 0.085, 0.04

COLORS = {
    "mast": hex_linear("#5b4632"),
    "rings": hex_linear("#d9cdb4"),
}
RINGS = [1.2, 3.6, 5.8]
YARD_Y = 5.1
YARD_HALF = 0.42


def radius_at(y: float) -> float:
    return TOP_R + (BASE_R - TOP_R) * (1 - y / HEIGHT)


def shaft() -> tuple:
    pts = [(0.0, 0.0), (BASE_R + 0.01, 0.0)]
    # A slight swell at the deck (the partners), then the taper.
    pts += [(radius_at(y) + 0.012 * max(0.0, 1 - y / 0.5), y)
            for y in (0.2, 0.5, 1.5, 3.0, 4.5, 6.0, 6.8)]
    pts.append((radius_at(HEIGHT - 0.12), HEIGHT - 0.12))
    pts.append((0.0, HEIGHT - 0.12))
    return lathe(pts, 12)


def band(y: float, h: float = 0.1, grow: float = 0.022):
    r = radius_at(y) + grow
    return lathe([(r - 0.012, y - h / 2), (r, y - h / 2 + 0.012),
                  (r, y + h / 2 - 0.012), (r - 0.012, y + h / 2)], 12)


def build(dims: dict) -> dict:
    wood = [shaft()]
    # Masthead cap: a short thick collar below the truck, in wood.
    wood.append(cylinder(radius_at(6.7) + 0.02, radius_at(6.7) + 0.02, 0.1, 12, 6.74))
    # The yard: a long slim spar across the ship (Z), tapering to its ends,
    # held to the mast by a parrel collar.
    yard = lathe([(0.0, -YARD_HALF), (0.02, -YARD_HALF + 0.03),
                  (0.035, -YARD_HALF * 0.5), (0.04, 0.0),
                  (0.035, YARD_HALF * 0.5), (0.02, YARD_HALF - 0.03),
                  (0.0, YARD_HALF)], 8)
    # Lathe stands on Y; lay it across Z, moving it to the yard height.
    verts, faces = yard
    wood.append(([(x, YARD_Y + z, y) for x, y, z in verts], faces))
    # The parrel: a block clamping the yard to the mast.
    wood.append(box(0, YARD_Y, 0, 0.12, 0.07, 0.12))
    rings = [band(y) for y in RINGS]
    # The truck: a ball on the very top, in the light colour.
    ball_r = TOP_R * 1.5
    ball = lathe([(0.0, HEIGHT - 2 * ball_r)] + [
        (ball_r * math.sin(a), HEIGHT - ball_r - ball_r * math.cos(a))
        for a in [i * math.pi / 8 for i in range(1, 8)]
    ] + [(0.0, HEIGHT)], 12)
    rings.append(ball)
    # Yard-arm bands.
    for z in (-YARD_HALF + 0.08, YARD_HALF - 0.08):
        rings.append(box(0, YARD_Y, z, 0.09, 0.09, 0.025))
    return {
        "mast": make_object("mast", merge(wood), COLORS["mast"], roughness=0.8),
        "rings": make_object("rings", merge(rings), COLORS["rings"],
                             metallic=0.6, roughness=0.4),
    }
