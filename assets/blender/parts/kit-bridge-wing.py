"""A bridge-wing cab end, for the roof corners of a bridge, in its own frame:
three.js coordinates (Y up), built for the starboard side, so outboard is +Z.
Origin: the middle of the wing's length (x = 0), the inner edge of its deck
(z = 0) and the deck's middle height (y = 0). The deck runs 1.0 along the
ship (the game stretches it to the bridge) and 0.19 out from the inner edge;
only the last 0.03 or so stands clear of the bridge wall. Out there: the
deck's edge, knee brackets under it, and a low dodger with a rail, kick plate
and posts. The game turns the piece half a circle for the port side."""

from lib.shapes import box, hex_linear, make_object, merge

LENGTH = 1.0
DEPTH = 0.19
DECK = 0.03
EDGE = DEPTH - 0.012
RAIL_Y = 0.078


def deck():
    return [
        box(0.0, 0.0, DEPTH / 2, LENGTH, DECK, DEPTH),
        # a raised lip along the outer edge
        box(0.0, DECK / 2 + 0.006, DEPTH - 0.006, LENGTH, 0.012, 0.012),
    ]


def dodger():
    parts = [box(0.0, 0.03, EDGE, LENGTH - 0.02, 0.05, 0.008)]  # kick plate
    for k in range(5):
        x = -LENGTH / 2 + 0.03 + k * (LENGTH - 0.06) / 4
        parts.append(box(x, 0.054, EDGE, 0.02, 0.08, 0.016))
    parts.append(box(0.0, RAIL_Y + 0.012, EDGE, LENGTH - 0.02, 0.016, 0.02))  # rail
    # the corner posts carry short return rails toward the wall
    for sign in (-1, 1):
        x = sign * (LENGTH / 2 - 0.01)
        parts.append(box(x, RAIL_Y + 0.012, EDGE - 0.025, 0.014, 0.014, 0.05))
    return parts


def knees():
    return [
        box(x, -DECK / 2 - 0.02, DEPTH - 0.03, 0.016, 0.04, 0.03)
        for x in (-LENGTH / 2 + 0.1, 0.0, LENGTH / 2 - 0.1)
    ]


def build(dims: dict) -> dict:
    parts = deck() + dodger() + knees()
    return {
        "frame": make_object(
            "frame", merge(parts), hex_linear("#ffffff"),
            roughness=0.5, closed=True, sharp_degrees=35,
        )
    }
