"""A crow's nest: a round lookout barrel that rings the mast, flared toward
the top like the Titanic drawing in the references. Staves with iron hoops, a
solid floor underneath with a bottom cone, a raised hatch coaming on the
floor, a rolled wooden rim, and a step-in door panel on the bow side. Fits
the old 0.55 wide, 0.29 high envelope, origin at the floor's underside."""

import math

from lib.shapes import (
    array_circle,
    box,
    cylinder,
    hex_linear,
    lathe,
    make_object,
    merge,
)

COLORS = {
    "nestBasket": hex_linear("#7a5a3a"),
    "mast": hex_linear("#5b4632"),
}

BOTTOM_R = 0.17
WALL_BOTTOM_R, WALL_TOP_R = 0.215, 0.26
FLOOR_Y = 0.03
WALL_TOP = 0.28
WALL_T = 0.025


def barrel() -> tuple:
    outer = [(0.0, 0.0), (BOTTOM_R, 0.0), (WALL_BOTTOM_R, FLOOR_Y),
             (WALL_BOTTOM_R, FLOOR_Y + 0.001)]
    n = 4
    for i in range(n + 1):
        t = i / n
        y = FLOOR_Y + (WALL_TOP - FLOOR_Y) * t
        r = WALL_BOTTOM_R + (WALL_TOP_R - WALL_BOTTOM_R) * t
        outer.append((r, y))
    top = (WALL_TOP_R - WALL_T, WALL_TOP)
    inner = [top, (WALL_BOTTOM_R - WALL_T, FLOOR_Y + 0.02),
             (0.0, FLOOR_Y + 0.02)]
    return lathe(outer + inner, 16)


def hoop(y: float):
    t = (y - FLOOR_Y) / (WALL_TOP - FLOOR_Y)
    r = WALL_BOTTOM_R + (WALL_TOP_R - WALL_BOTTOM_R) * t + 0.008
    return lathe([(r - 0.004, y - 0.012), (r, y - 0.008), (r, y + 0.008),
                  (r - 0.004, y + 0.012)], 16)


def build(dims: dict) -> dict:
    basket = [barrel()]
    # Vertical stave ribs standing proud of the flared wall.
    rib = box(0.243, (FLOOR_Y + WALL_TOP) / 2, 0.0,
              0.012, WALL_TOP - FLOOR_Y - 0.02, 0.026)
    basket.append(array_circle(rib, 12, 0.13))
    # Hatch coaming on the floor: a low frame with a lid, behind the mast.
    basket.append(box(-0.13, FLOOR_Y + 0.03, 0.0, 0.09, 0.03, 0.12))
    iron = [hoop(0.095), hoop(0.19)]
    # The door: a panel on the wall facing +X (the bow).
    door = box(WALL_TOP_R - 0.045, 0.17, 0.0, 0.02, 0.15, 0.09)
    # A rolled rim on top, in the mast's dark wood.
    rim = lathe([(WALL_TOP_R - 0.03, WALL_TOP - 0.004),
                 (WALL_TOP_R - 0.016, WALL_TOP + 0.01),
                 (WALL_TOP_R, WALL_TOP + 0.016),
                 (WALL_TOP_R + 0.012, WALL_TOP + 0.004),
                 (WALL_TOP_R + 0.012, WALL_TOP - 0.012),
                 (WALL_TOP_R - 0.002, WALL_TOP - 0.016)], 16)
    rim = merge([rim])
    return {
        "nestBasket": make_object("nestBasket", merge(basket + [door]),
                                  COLORS["nestBasket"], roughness=0.85),
        "mast": make_object("mast", merge(iron + [rim]), COLORS["mast"],
                            roughness=0.6, metallic=0.3),
    }
