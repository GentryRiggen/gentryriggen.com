"""Plane Builder tail pieces.

- fin: the vertical fin and rudder, 0.4 long and 0.5 tall. Cub style: a
  sloping leading edge, a rounded top, a straight rudder edge, with a trim
  coloured tip.
- fin-swept: a jet's tall fin, swept back to a squared-off tip.
- stabilizer: the horizontal tail, 1 wide (the game stretches it), 0.3 deep,
  tapering to rounded tips."""

import math

from lib.planekit import _naca, finish, lens
from lib.shapes import loft

FIN_CUB = [
    (0.2, -0.25), (0.185, -0.05), (0.14, 0.09), (0.07, 0.19), (-0.02, 0.245),
    (-0.1, 0.25), (-0.16, 0.225), (-0.195, 0.16), (-0.2, 0.05), (-0.2, -0.25),
]
FIN_JET = [
    (0.2, -0.25), (0.14, -0.05), (0.07, 0.12), (0.0, 0.25), (-0.1, 0.25),
    (-0.15, 0.1), (-0.2, -0.05), (-0.2, -0.25),
]
HALF = 0.025
# z (thickness) steps: a rounded edge on both faces.
LAYERS = ((-HALF, 0.85), (-HALF * 0.55, 1.0), (HALF * 0.55, 1.0), (HALF, 0.85))


def fin_outline(poly, scale):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return [(cx + (x - cx) * scale, cy + (y - cy) * scale) for x, y in poly]


def clip_above(poly, y0):
    """The part of a closed outline at or above y = y0."""
    out = []
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        in1, in2 = y1 >= y0, y2 >= y0
        if in1:
            out.append((x1, y1))
        if in1 != in2:
            t = (y0 - y1) / (y2 - y1)
            out.append((x1 + (x2 - x1) * t, y0))
    return out


def fin(poly, tip_y):
    body = loft([(z, fin_outline(poly, s)) for z, s in LAYERS], axis="z")
    cap = clip_above(poly, tip_y)
    # The trim tip: the same outline's top, a hair thicker so it reads.
    return body, loft(
        [(z, cap) for z in (-HALF - 0.003, HALF + 0.003)], axis="z"
    )


def stabilizer():
    def sections(zs):
        out = []
        for z in zs:
            u = abs(z) / 0.5
            scale = max(0.28, math.sqrt(max(0.0, 1 - u**4)))
            out.append((z, lens(12, 0.15 * scale, 0.02 * (0.5 + 0.5 * scale))))
        return out

    mid = loft(sections((-0.42, -0.3, -0.15, 0.0, 0.15, 0.3, 0.42)), axis="z")
    tips = [
        loft(sections((0.42, 0.46, 0.49, 0.5)), axis="z"),
        loft(sections((-0.5, -0.49, -0.46, -0.42)), axis="z"),
    ]
    return mid, tips


def build(dims: dict) -> dict:
    unit = dims["unit"]
    if unit == "stabilizer":
        mid, tips = stabilizer()
        return finish({"body": [mid], "trim": tips, "dark": []})
    if unit == "fin":
        body, cap = fin(FIN_CUB, 0.15)
    else:
        body, cap = fin(FIN_JET, 0.12)
    return finish({"body": [body], "trim": [cap], "dark": []})
