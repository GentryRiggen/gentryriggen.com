"""A liner funnel, built in three.js coordinates (Y-up, un-raked, origin at
the body base centre) and converted to Z-up. Same envelope as the procedural
funnel in components/ship-builder/scene/funnelGeometry.ts (radii, heights,
rim top and pipe reach), with the detail the game's primitives can't carry:
a base flange, riveted plate seams, rounded hoop bands, a hollow cap with a
rolled rim, and a bracketed steam pipe with a bell whistle."""

import math

from lib.shapes import (
    Mesh,
    array_circle,
    box,
    cylinder,
    disc,
    lathe,
    linear,
    make_object,
    merge,
    round_hoop,
    translate,
)

BAND_FLARE = 0.012
RIM_TUBE = 0.03
PIPE_RADIUS = 0.028
PIPE_GAP = 0.045
WHISTLE_HEIGHT = 0.16
BANDS = [(0.3, 0.1), (0.52, 0.1)]
# Plate seams: fractions of the body height below the bands.
SEAMS = [0.16, 0.32, 0.48, 0.64]
SEAM_PROUD = 0.007
SEAM_HALF = 0.012
FLANGE = 0.008
FLANGE_HEIGHT = 0.07
OPENING_DEPTH = 0.32
SHARP_DEGREES = 40
GUY_RING = 0.945
GUY_EYES = 6

# The bell is wider than the pipe gap, so it stands this far further out.
WHISTLE_OUTSET = 0.015


COLORS = {
    "body": linear(0.827, 0.608, 0.271),
    "bands": linear(0.953, 0.937, 0.894),
    "cap": linear(0.08, 0.08, 0.08),
    "opening": linear(0.02, 0.02, 0.02),
    "pipe": linear(0.69, 0.553, 0.341),
}
METALLIC = {"pipe": 1.0}

def radius_at(dims: dict, height: float) -> float:
    return dims["topRadius"] + (dims["baseRadius"] - dims["topRadius"]) * (
        1 - height / dims["bodyHeight"]
    )


def body_profile(dims: dict) -> list[tuple[float, float]]:
    h = dims["bodyHeight"]
    r = lambda y: radius_at(dims, y)  # noqa: E731
    pts = [(0.0, 0.0), (r(0) + FLANGE, 0.0)]  # a closed base
    # A flange rolling into the wall at the deck.
    for s in range(1, 5):
        t = s / 4
        y = FLANGE_HEIGHT * t
        pts.append((r(y) + FLANGE * (1 - math.sin(t * math.pi / 2)), y))
    # Lapped plating: each strake's lower edge stands proud of the one below
    # and eases back into the wall over its height, so every seam is a crisp
    # downward-facing step that catches a shadow line.
    edges = [FLANGE_HEIGHT] + [h * f for f in SEAMS] + [h]
    for lower, upper in zip(edges, edges[1:]):
        if lower > FLANGE_HEIGHT:
            pts.append((r(lower) + SEAM_PROUD, lower))
        pts.append((r(lower + (upper - lower) * 0.5) + SEAM_PROUD * 0.3,
                    lower + (upper - lower) * 0.5))
        pts.append((r(upper - 0.002), upper - 0.002))
    pts.append((r(h), h))
    return pts


def cap_profile(dims: dict) -> list[tuple[float, float]]:
    """Outer wall up, over a rolled rim, down the inner wall to the soot."""
    h, cap_h = dims["bodyHeight"], dims["capHeight"]
    outer = dims["topRadius"] + 0.01
    top = h + cap_h
    # The old rim: a torus of tube RIM_TUBE centred just under the cap top.
    rc_r, rc_y = outer - 0.012, top - RIM_TUBE * 0.4
    pts = [(dims["topRadius"] - 0.002, h - 0.01), (outer, h - 0.01)]
    start = -math.pi / 3
    pts.append((outer, rc_y + RIM_TUBE * math.sin(start)))
    # The roll: from where it leaves the wall, over the top, to the inside.
    steps = 8
    for s in range(steps + 1):
        a = start + (math.pi - start) * s / steps
        pts.append((rc_r + RIM_TUBE * math.cos(a),
                    rc_y + RIM_TUBE * math.sin(a)))
    inner = rc_r - RIM_TUBE
    pts.append((inner, top - OPENING_DEPTH))
    return pts


def steam_pipe(dims: dict) -> list[Mesh]:
    """A thin pipe up the aft (-X) side, clamped to the body, with a bell
    whistle on top."""
    bottom, top = 0.6, dims["bodyHeight"] * 0.9

    def x_at(h: float) -> float:
        return -(radius_at(dims, h) + PIPE_GAP)

    dx = x_at(top) - x_at(bottom)
    length = math.hypot(dx, top - bottom)
    tilt = -math.atan2(dx, top - bottom)
    parts = [cylinder(PIPE_RADIUS, PIPE_RADIUS, length, 8, (top + bottom) / 2,
                      tilt=tilt, shift_x=(x_at(top) + x_at(bottom)) / 2)]
    for frac in (0.15, 0.5, 0.85):
        h = bottom + (top - bottom) * frac
        wall = radius_at(dims, h)
        parts.append(box(-(wall + PIPE_GAP / 2), h, 0.0,
                         PIPE_GAP + 0.02, 0.025, 0.03))
    bell = [
        (PIPE_RADIUS * 1.0, 0.0),
        (PIPE_RADIUS * 1.9, 0.03),
        (PIPE_RADIUS * 1.9, WHISTLE_HEIGHT - 0.03),
        (PIPE_RADIUS * 1.5, WHISTLE_HEIGHT - 0.005),
        (PIPE_RADIUS * 1.2, WHISTLE_HEIGHT + 0.02),
        (0.0, WHISTLE_HEIGHT + 0.02),
    ]
    parts.append(translate(lathe(bell, 10), x_at(top) - WHISTLE_OUTSET, top - 0.02))
    return parts


def guy_ring(dims: dict) -> list[Mesh]:
    """The ring the funnel stays hook onto, just under the cap: a hoop with
    eye plates standing off it."""
    y = dims["bodyHeight"] * GUY_RING
    wall = radius_at(dims, y)
    parts = [lathe(round_hoop(radius_at(dims, y - 0.025), radius_at(dims, y + 0.025),
                              y - 0.025, y + 0.025, 0.01, 3))]
    # Eyes at 0, 60, ... 300 degrees: none at -X, where the steam pipe runs.
    eye = box(0.0, y, wall + 0.02, 0.025, 0.05, 0.03)
    parts.append(array_circle(eye, GUY_EYES))
    return parts


def build(dims: dict) -> dict:
    h = dims["bodyHeight"]
    bands = []
    for drop, height in BANDS:
        y0, y1 = h - drop - height / 2, h - drop + height / 2
        bands.append(lathe(round_hoop(
            radius_at(dims, y0), radius_at(dims, y1), y0, y1, BAND_FLARE)))
    cap_top = h + dims["capHeight"]
    inner = dims["topRadius"] + 0.01 - 0.012 - RIM_TUBE
    groups = {
        "body": [lathe(body_profile(dims))] + guy_ring(dims),
        "bands": bands,
        "cap": [lathe(cap_profile(dims))],
        "opening": [disc(inner + 0.002, cap_top - OPENING_DEPTH)],
        "pipe": steam_pipe(dims),
    }
    return {
        name: make_object(
            name,
            merge(parts),
            COLORS[name],
            metallic=METALLIC.get(name, 0.0),
            closed=name == "pipe",  # closed shapes only; lathed walls are open
            sharp_degrees=SHARP_DEGREES,
        )
        for name, parts in groups.items()
    }
