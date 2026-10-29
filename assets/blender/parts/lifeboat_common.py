"""Shared build for the three open lifeboats (standard, large, collapsible)."""

from lib.boats import OpenBoat
from lib.shapes import hex_linear, make_object, merge

SHARP = 40


def build_open(dims: dict, hull_slot: str, hull_hex: str, **kw):
    b = OpenBoat(dims["length"], dims["halfBeam"], dims["depth"], dims["rimY"],
                 dims["sheer"], cover_h=dims["coverHeight"], **kw)
    thw = [-0.86, 0.8] if dims["length"] < 1.2 else [-0.88, -0.8, 0.74, 0.82]
    groups = {
        hull_slot: ([b.hull()], hull_hex, 0.55),
        "boatCover": ([b.cover()], "#e4dcc4", 0.9),
        "gunwale": ([b.caps(), b.strakes(), b.thwarts(thw), b.ridge()], "#8a5a2b", 0.5),
    }
    return {
        name: make_object(name, merge(parts), hex_linear(hexc), roughness=rough,
                          sharp_degrees=SHARP)
        for name, (parts, hexc, rough) in groups.items()
    }
