"""Three oak barrels standing on the deck, in three.js coordinates (Y up,
origin at the footprint centre): a bulging cask of staves, the end heads set
in a little behind a raised chime, and iron hoops (a pair near each end and
a pair round the belly) that follow the bulge."""

import math

from lib.shapes import hex_linear, lathe, make_object, merge, translate

H = 0.34
R_END = 0.138
R_BELLY = 0.155
SEG = 12
SPOTS = [(-0.12, -0.17), (-0.12, 0.17), (0.17, 0.0)]


def belly(y: float) -> float:
    """Outer stave radius at height y: a parabola from the ends to the belly."""
    t = (y - H / 2) / (H / 2)
    return R_END + (R_BELLY - R_END) * (1 - t * t)


def staves():
    ys = [0.0, 0.012, 0.05, 0.10, 0.17, 0.24, 0.29, 0.328, H]
    prof = [(0.0, 0.018), (R_END - 0.02, 0.018), (R_END - 0.012, 0.0)]  # head set in
    prof += [(belly(y) if 0.012 <= y else R_END, y) for y in ys[1:]]
    # top: chime, then the head set in
    prof += [(R_END - 0.012, H), (R_END - 0.02, H - 0.018), (0.0, H - 0.018)]
    # the first points run inward->outward bottom: keep the order bottom to top outer wall
    prof = [(0.0, 0.018), (R_END - 0.02, 0.018), (R_END - 0.012, 0.0)] + [
        (belly(y), y) for y in ys[1:-1]
    ] + [(R_END - 0.012, H), (R_END - 0.02, H - 0.018), (0.0, H - 0.018)]
    return lathe(prof, SEG)


def hoops():
    out = []
    for y in (0.045, 0.085, 0.255, 0.295):
        r = belly(y) + 0.006
        out.append(lathe([(r, y - 0.016), (r + 0.008, y - 0.008), (r + 0.008, y + 0.008), (r, y + 0.016)], SEG))
    return out


def build(dims):
    wood, iron = [], []
    for x, z in SPOTS:
        wood.append(translate(staves(), x, 0.0, z))
        iron.extend(translate(h, x, 0.0, z) for h in hoops())
    return {
        "wood": make_object("wood", merge(wood), hex_linear("#9a6b3f"), roughness=0.8, sharp_degrees=50),
        "iron": make_object("iron", merge(iron), hex_linear("#33383d"), metallic=0.8, roughness=0.5, sharp_degrees=50),
    }
