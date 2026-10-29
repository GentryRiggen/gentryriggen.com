"""Plane Builder fuselages, 1.44 long (x = +-0.72) and 0.22 in radius, as the
old capsule: the game stretches the length to the plane's body tier and the
girth to its look.

- fuselage-prop: a Piper Cub / Cessna body: rounded cowl with a trim lip,
  full cabin with side windows and a wrap-round windscreen, and a long taper
  to a small tail that rises a little (the tail wheel's side of a Cub).
- fuselage-sleek: a small jet / sailplane tube: pointed-ish nose, canopy,
  a row of cabin windows, a slim tail.
- fuselage-pod: the storm plane's egg-shaped pod: blunt both ends, big
  windscreen."""

import math

from lib.planekit import both_sides, finish, ring
from lib.shapes import loft, merge

N = 16

# (x, radius across (z), radius up (y), centre height)
STATIONS = {
    "fuselage-prop": [
        (-0.72, 0.04, 0.04, 0.075),
        (-0.65, 0.065, 0.07, 0.065),
        (-0.55, 0.105, 0.115, 0.05),
        (-0.45, 0.15, 0.165, 0.03),
        (-0.36, 0.19, 0.205, 0.015),
        (-0.2, 0.208, 0.225, 0.005),
        (-0.05, 0.215, 0.235, 0.0),
        (0.15, 0.215, 0.235, 0.0),
        (0.3, 0.208, 0.222, -0.003),
        (0.4, 0.195, 0.198, -0.008),
        (0.5, 0.195, 0.192, -0.01),
        (0.6, 0.19, 0.188, -0.008),
        (0.66, 0.17, 0.168, -0.005),
        (0.70, 0.13, 0.13, 0.0),
        (0.72, 0.09, 0.09, 0.0),
    ],
    "fuselage-sleek": [
        (-0.72, 0.075, 0.075, 0.045),
        (-0.65, 0.095, 0.1, 0.038),
        (-0.5, 0.135, 0.145, 0.02),
        (-0.3, 0.18, 0.19, 0.005),
        (-0.1, 0.2, 0.21, 0.0),
        (0.15, 0.2, 0.21, 0.0),
        (0.35, 0.185, 0.2, 0.0),
        (0.5, 0.15, 0.16, 0.0),
        (0.62, 0.105, 0.105, 0.0),
        (0.69, 0.06, 0.06, 0.0),
        (0.72, 0.025, 0.025, 0.0),
    ],
    "fuselage-pod": [
        (-0.72, 0.05, 0.05, 0.0),
        (-0.69, 0.1, 0.1, 0.0),
        (-0.6, 0.165, 0.17, 0.0),
        (-0.4, 0.21, 0.215, 0.0),
        (-0.1, 0.22, 0.22, 0.0),
        (0.2, 0.22, 0.22, 0.0),
        (0.42, 0.21, 0.21, 0.0),
        (0.58, 0.18, 0.18, 0.0),
        (0.68, 0.12, 0.12, 0.0),
        (0.72, 0.06, 0.06, 0.0),
    ],
}


def at(stations, x):
    """Radii and centre height at x, by straight lines between stations."""
    for (x0, *a), (x1, *b) in zip(stations, stations[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return [p + (q - p) * t for p, q in zip(a, b)]
    raise ValueError(x)


def hull(stations):
    return loft(
        [(x, ring(N, rz, ry, cy)) for x, rz, ry, cy in stations], axis="x"
    )


def band(stations, x0, x1, a0, a1, lift=0.006, steps=3, depth=0.02):
    """A dark glass patch hugging the hull between x0..x1 and the ellipse
    angles a0..a1 (degrees, 0 = side, 90 = top, +z side)."""
    xs = [x0 + (x1 - x0) * i / steps for i in range(steps + 1)]
    sections = []
    for x in xs:
        rz, ry, cy = at(stations, x)
        arc = [a0 + (a1 - a0) * k / 4 for k in range(5)]
        outer = [
            (( rz + lift) * math.cos(math.radians(a)),
             cy + (ry + lift) * math.sin(math.radians(a)))
            for a in arc
        ]
        inner = [
            ((rz - depth) * math.cos(math.radians(a)),
             cy + (ry - depth) * math.sin(math.radians(a)))
            for a in reversed(arc)
        ]
        sections.append((x, outer + inner))
    return loft(sections, axis="x")


def build(dims: dict) -> dict:
    unit = dims["unit"]
    st = STATIONS[unit]
    body = [hull(st)]
    trim = []
    dark = []
    if unit == "fuselage-prop":
        # cowl lip
        trim.append(
            loft(
                [(x, ring(N, r, r)) for x, r in ((0.485, 0.203), (0.52, 0.203))],
                axis="x",
            )
        )
        dark.append(both_sides(band(st, -0.22, 0.3, 4, 48, steps=5)))  # cabin windows
        dark.append(band(st, 0.3, 0.42, 44, 136, steps=3))  # windscreen
    elif unit == "fuselage-sleek":
        for x in (-0.28, -0.14, 0.0, 0.14):  # passenger windows
            dark.append(both_sides(band(st, x, x + 0.07, 12, 24, steps=1)))
        dark.append(both_sides(band(st, 0.33, 0.5, 8, 38, steps=3)))  # cockpit side
        dark.append(band(st, 0.36, 0.55, 40, 140, steps=3))  # windscreen
        trim.append(
            loft(
                [(x, ring(N, r, r + 0.01, c)) for x, r, c in ((-0.58, 0.115, 0.027), (-0.54, 0.123, 0.025))],
                axis="x",
            )
        )
    else:
        trim.append(
            loft(
                [(x, ring(N, r, r)) for x, r in ((0.52, 0.2), (0.57, 0.185))],
                axis="x",
            )
        )
        dark.append(band(st, 0.28, 0.56, 30, 150, steps=3))
        dark.append(both_sides(band(st, 0.22, 0.5, 5, 32, steps=3)))
    return finish({"body": body, "trim": trim, "dark": dark})
