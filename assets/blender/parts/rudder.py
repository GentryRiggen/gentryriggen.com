"""A balanced spade rudder in the Olympic style (bow toward +X): a streamlined
plate blade, wider at the top, with raised horizontal ribs, hinge knuckles
down the leading edge and the round rudder stock rising from the top. Fits
the old 0.6 x 0.9 x 0.08 slab envelope."""

from lib.blades import foil
from lib.shapes import box, cylinder, linear, loft, make_object, merge, translate

COLOR = linear(0.69, 0.553, 0.341)

BOTTOM, TOP = -0.45, 0.3
RIBS = (-0.3, -0.12, 0.06)


def build(dims: dict) -> dict:
    thick = 0.07
    blade = loft(
        [
            (BOTTOM, foil(0.2, -0.2, thick * 0.8)),
            (-0.1, foil(0.26, -0.27, thick)),
            (TOP, foil(0.3, -0.3, thick)),
        ],
        axis="y",
    )
    parts = [blade]
    for y in RIBS:
        parts.append(box(-0.04, y, 0.0, 0.46, 0.03, 0.085))
    for y in (-0.12, 0.14, 0.27):
        parts.append(cylinder(0.04, 0.04, 0.07, 10, y, shift_x=0.265))
    # The stock: up from the top of the blade, with a collar.
    parts.append(cylinder(0.045, 0.045, 0.2, 14, 0.35, shift_x=0.15))
    parts.append(cylinder(0.05, 0.05, 0.04, 14, 0.31, shift_x=0.15))
    return {"rudder": make_object("rudder", merge(parts), COLOR)}
