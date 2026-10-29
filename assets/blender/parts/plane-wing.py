"""Plane Builder wings, one half wing from the root at z = 0 to the tip at
z = 1 (the game scales the chord and the span, and mirrors the left wing).
A straight Cub-style wing: constant chord, rounded nose, thin tail, a
rounded tip. The glider's is slimmer and tapers to a narrower tip."""

import math

from lib.planekit import _naca, finish, lens
from lib.shapes import box, loft

CHORD = 0.35  # half chord: the old wing is 0.7 deep
THICK = 0.03


def build(dims: dict) -> dict:
    glider = dims["unit"] == "wing-glider"
    taper = 0.55 if glider else 1.0
    thick = 0.026 if glider else THICK
    sections = []
    # Root to tip; the last stations curl the tip round.
    for z in (0.0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 0.98, 1.0):
        along = z
        chord = CHORD * (1 - (1 - taper) * along)
        scale = 1.0
        if z >= 0.9:
            # quarter-ellipse round-off over the last 10%
            e = (z - 0.9) / 0.1
            scale = math.sqrt(max(0.05, 1 - e * e))
        pts = lens(16, chord * scale, thick * max(scale, 0.3))
        # keep the wing's leading edge line (x = +CHORD*...) steady
        sections.append((z, pts))
    wing = loft(sections, axis="z")
    # Aileron hinge lines: thin dark strips along the outer trailing edge, on
    # the top surface (the strip sits just proud of the skin).
    hinge = []
    for x_edge in (-0.17,):
        v = (CHORD - x_edge) / (2 * CHORD)
        top = thick * _naca(v)
        span0, span1 = (0.45, 0.9) if not glider else (0.5, 0.88)
        hinge.append(box(x_edge, top, (span0 + span1) / 2, 0.012, 0.006, span1 - span0))
        for z in (span0, span1):
            hinge.append(box(x_edge + 0.07, top + 0.002, z, 0.15, 0.006, 0.012))
    return finish({"body": [wing], "trim": [], "dark": hinge})
