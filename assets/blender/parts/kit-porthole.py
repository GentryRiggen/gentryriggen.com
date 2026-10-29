"""A ship's porthole rim, in the kit frame (see kit_common): the hull's face
on x = 0, outward +X, centred on the glass. A brass ring round the glass
(opening radius 0.10) with a flat lip and a bevel; 12 segments, 96
triangles. Rivets and shading come from baked AO. The glass disc and its
night glow stay procedural."""

import math

from lib.deckkit import rot_z
from lib.shapes import hex_linear, lathe, make_object

OPENING = 0.10
RING_OUT = 0.138
DEPTH = 0.03
BACK = -0.006


def build(dims: dict) -> dict:
    # lathe about Y (r, y); y is depth until the piece is turned to +X
    ring = lathe([
        (OPENING, BACK),
        (OPENING, DEPTH),
        (RING_OUT, DEPTH - 0.012),
        (RING_OUT, BACK),
        (OPENING, BACK),
    ], 12)
    return {
        "rim": make_object(
            "rim", rot_z(ring, -math.pi / 2), hex_linear("#b08d57"),
            metallic=0.8, roughness=0.4, closed=True, sharp_degrees=40,
        )
    }
