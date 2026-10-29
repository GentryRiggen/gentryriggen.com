"""Plane Builder landing gear, one of each side.

- float: a seaplane float, 1 long (the game stretches it), a flat deck with
  two pump hatches, a rounded V bottom, and a bow and stern that sweep up.
- tyre: a big soft bush-plane tyre, 0.26 in radius and 0.18 wide, with tread
  rings and a hub cap on its outer (+z) side.
- ski: a ski plank 1 long (stretched by the game) with an upturned toe and a
  binding plate for the strut."""

import math

from lib.planekit import finish, ring
from lib.shapes import box, loft, merge

FLOAT_PROFILE = [
    (-0.085, 0.1), (0.085, 0.1), (0.118, 0.06), (0.12, -0.01), (0.095, -0.07),
    (0.045, -0.1), (-0.045, -0.1), (-0.095, -0.07), (-0.12, -0.01), (-0.118, 0.06),
]


def float_unit():
    sections = []
    for x, s, lift in (
        (-0.5, 0.3, 0.07), (-0.46, 0.55, 0.05), (-0.38, 0.85, 0.02),
        (-0.25, 1.0, 0.0), (0.2, 1.0, 0.0), (0.32, 0.93, 0.004),
        (0.4, 0.75, 0.025), (0.46, 0.5, 0.05), (0.5, 0.22, 0.075),
    ):
        sections.append(
            (x, [(z * s, y * s + lift - (1 - s) * 0.0) for z, y in FLOAT_PROFILE])
        )
    hatches = [box(x, 0.103, 0, 0.1, 0.012, 0.11) for x in (-0.12, 0.16)]
    return loft(sections, axis="x"), merge(hatches)


def tyre_unit():
    radii = []
    # barrel with rounded shoulders; z runs across the tyre
    prof = [(-0.09, 0.2), (-0.078, 0.243), (-0.05, 0.26), (0.05, 0.26), (0.078, 0.243), (0.09, 0.2)]
    tyre = loft([(z, ring(20, r, r)) for z, r in prof], axis="z")
    treads = [
        loft([(z, ring(20, 0.268, 0.268)) for z in (c - 0.012, c + 0.012)], axis="z")
        for c in (-0.05, 0.0, 0.05)
    ]
    hub = loft(
        [(z, ring(14, r, r)) for z, r in ((0.085, 0.14), (0.098, 0.14), (0.108, 0.1), (0.112, 0.04))],
        axis="z",
    )
    return merge([tyre] + treads), hub


def ski_unit():
    sections = []
    # (x, half width, half thickness, lift of the centre line)
    for x, w, t, lift in (
        (-0.5, 0.04, 0.02, 0.02), (-0.47, 0.056, 0.025, 0.0), (-0.3, 0.06, 0.025, 0.0),
        (0.3, 0.06, 0.025, 0.0), (0.5, 0.06, 0.025, 0.0), (0.56, 0.058, 0.023, 0.014),
        (0.62, 0.053, 0.02, 0.05), (0.67, 0.048, 0.017, 0.095), (0.7, 0.042, 0.014, 0.135),
    ):
        sections.append((x, [(w * math.cos(a), lift + t * math.sin(a)) for a in [2 * math.pi * k / 10 for k in range(10)]]))
    plank = loft(sections, axis="x")
    plate = box(0.0, 0.034, 0, 0.3, 0.02, 0.09)
    return plank, plate


def build(dims: dict) -> dict:
    unit = dims["unit"]
    if unit == "float":
        body, hatches = float_unit()
        return finish({"trim": [body], "dark": [hatches], "body": []})
    if unit == "tyre":
        tyre, hub = tyre_unit()
        return finish({"dark": [tyre], "trim": [hub], "body": []})
    plank, plate = ski_unit()
    return finish({"trim": [plank], "dark": [plate], "body": []})
