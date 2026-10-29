"""A riveted ship's porthole rim, in the kit frame (see kit_common): the
hull's face on x = 0, outward +X, centred on the glass. A thick brass ring
round the glass (opening radius 0.10), a bevelled front, eight rivet heads
on the ring and a hinge lug at the top for the deadlight. The glass disc and
its night glow stay procedural."""

import math

from lib.deckkit import rot_z
from lib.shapes import array_circle, hex_linear, lathe, make_object, merge, translate

OPENING = 0.10
RING_OUT = 0.138
DEPTH = 0.03
RIVETS = 8


def ring():
    # lathe about Y (r, y); y is depth until the whole piece is turned to +X
    return lathe([
        (OPENING, -0.006),
        (OPENING, DEPTH - 0.01),
        (OPENING + 0.006, DEPTH - 0.004),
        (OPENING + 0.014, DEPTH),
        (RING_OUT - 0.014, DEPTH),
        (RING_OUT - 0.004, DEPTH - 0.008),
        (RING_OUT, DEPTH - 0.016),
        (RING_OUT, -0.006),
        (OPENING, -0.006),
    ], 20)


def rivet():
    dome = lathe([(0.0, 0.0), (0.0075, 0.0), (0.0065, 0.004), (0.0035, 0.0075), (0.0, 0.008)], 6)
    return translate(dome, (OPENING + RING_OUT) / 2 + 0.0, DEPTH - 0.0005, 0.0)


def lug():
    # a hinge boss at the top (+Z in the lathe frame becomes +Y after turning)
    boss = lathe([(0.0, 0.0), (0.012, 0.0), (0.012, 0.012), (0.0, 0.012)], 8)
    return translate(boss, 0.0, DEPTH - 0.004, 0.0)


def build(dims: dict) -> dict:
    rivets = array_circle(rivet(), RIVETS, math.pi / RIVETS)
    top = translate(lug(), -(RING_OUT + 0.004), 0.0, 0.0)
    mesh = merge([ring(), rivets, top])
    # y (depth) -> +x; the lathe's z -> -z stays; the lug at -z needs to be +y:
    mesh = rot_z(mesh, -math.pi / 2)
    return {
        "rim": make_object(
            "rim", mesh, hex_linear("#b08d57"),
            metallic=0.8, roughness=0.4, closed=True, sharp_degrees=40,
        )
    }
