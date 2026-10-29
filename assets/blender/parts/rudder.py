"""A balanced spade rudder in the Olympic style (bow toward +X): a streamlined
foil-section blade, wider at the top, hinge knuckles
down the leading edge and the round rudder stock rising from the top. Fits
the old 0.6 x 0.9 x 0.08 slab envelope."""

from lib.blades import foil
from lib.shapes import cylinder, linear, loft, make_object, merge, translate

COLOR = linear(0.69, 0.553, 0.341)

BOTTOM, TOP = -0.45, 0.3


def build(dims: dict) -> dict:
    thick = 0.075
    # A smooth foil blade: thickest about a third back from the nose, thin
    # trailing edge, narrowing and rounding off toward the bottom.
    blade = loft(
        [
            (BOTTOM, foil(0.14, -0.1, thick * 0.35, 14)),
            (BOTTOM + 0.06, foil(0.19, -0.19, thick * 0.6, 14)),
            (-0.25, foil(0.24, -0.26, thick * 0.9, 14)),
            (-0.05, foil(0.27, -0.29, thick, 14)),
            (TOP, foil(0.3, -0.32, thick, 14)),
        ],
        axis="y",
    )
    parts = [blade]
    # Hinge knuckles (pintles and gudgeons) down the leading edge.
    for y in (-0.12, 0.14, 0.27):
        parts.append(cylinder(0.04, 0.04, 0.07, 10, y, shift_x=0.265))
    # The stock: up from the top of the blade, with a collar.
    parts.append(cylinder(0.045, 0.045, 0.2, 14, 0.35, shift_x=0.15))
    parts.append(cylinder(0.05, 0.05, 0.04, 14, 0.31, shift_x=0.15))
    return {"rudder": make_object("rudder", merge(parts), COLOR)}
