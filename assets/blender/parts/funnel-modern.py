"""A modern cruise-ship funnel: a fin or sail shell, built in three.js
coordinates (Y-up, un-raked, origin at the base centre; the game applies the
5 degree rake). Same envelope as the procedural modern funnel (about +-0.51
fore-aft, +-0.34 across, 3.2 tall) with what the reference funnels show: a
vertical aft edge, a long swept fore edge, flanks that narrow towards the top,
bands of louvre slats, a flat deflector plate on top and a row of exhaust
pipes raked aft.

Slots: `body` (the livery colour, carries the logo) and `grille` (louvres,
deflector plate and pipes, the livery's top colour)."""

import math

from lib.shapes import (
    box,
    cylinder,
    hex_linear,
    loft,
    make_object,
    merge,
)

TOP = 2.9  # top of the shell; the deflector plate sits on it
BASE_W = 0.34
TOP_W = 0.2
AFT_X = -0.5
FORE_BASE = 0.5
FORE_TOP = 0.2
SHOULDER = 0.09
CORNER_POINTS = 5

COLORS = {
    "body": hex_linear("#3b7cc4"),
    "grille": hex_linear("#2e3338"),
}
METALLIC = {"grille": 0.8}


def half_width(y: float) -> float:
    return BASE_W + (TOP_W - BASE_W) * min(max(y / TOP, 0.0), 1.0)


def fore_x(y: float) -> float:
    """The fore edge sweeps back along a gentle curve."""
    t = min(max(y / TOP, 0.0), 1.0)
    return FORE_BASE + (FORE_TOP - FORE_BASE) * t ** 1.1


def aft_x(y: float) -> float:
    return AFT_X + 0.1 * min(max(y / TOP, 0.0), 1.0)


def profile(y: float, inset: float = 0.0, fore_r: float = 0.2, aft_r: float = 0.07):
    """Rounded-rectangle outline at height y as (x, z) points, counter-
    clockwise, always the same point count."""
    xf, xa, w = fore_x(y) - inset, aft_x(y) + inset, half_width(y) - inset
    span = xf - xa
    rf = max(0.01, min(fore_r - inset * 0.5, w, span / 2))
    ra = max(0.01, min(aft_r - inset * 0.5, w, span / 2))
    corners = [
        (xf - rf, w - rf, rf, 0),
        (xa + ra, w - ra, ra, 90),
        (xa + ra, -w + ra, ra, 180),
        (xf - rf, -w + rf, rf, 270),
    ]
    pts = []
    for cx, cz, r, a0 in corners:
        for k in range(CORNER_POINTS):
            a = math.radians(a0 + 90 * k / (CORNER_POINTS - 1))
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def body_mesh():
    sections = [
        (0.0, profile(0.0)),
    ]
    for y in (0.7, 1.4, 2.1, TOP - SHOULDER):
        sections.append((y, profile(y)))
    for k in range(1, 5):
        a = math.pi / 2 * k / 4
        sections.append((
            TOP - SHOULDER + SHOULDER * math.sin(a),
            profile(TOP - SHOULDER, SHOULDER * (1 - math.cos(a))),
        ))
    return loft(sections, axis="y")


def louvres() -> list:
    """Thin slats standing proud of both flanks: a column on the aft part
    from base to top, and a full-width band under the top (the logo sits
    between them on the forward flank)."""
    parts = []
    y = 0.42
    while y < 2.78:
        x1 = -0.2 if y < 2.0 else min(fore_x(y) - 0.14, 0.1)
        x0 = aft_x(y) + 0.1
        for side in (1, -1):
            parts.append(box((x0 + x1) / 2, y, side * (half_width(y) + 0.004),
                             x1 - x0, 0.034, 0.03))
        y += 0.075
    return parts


def deflector() -> list:
    """A flat plate over the top, wider than the shell, with the pipes
    standing on it raked aft."""
    plate = loft(
        [
            (TOP - 0.02, profile(TOP - SHOULDER, SHOULDER * 0.15)),
            (TOP + 0.07, profile(TOP - SHOULDER, SHOULDER * 0.15)),
        ],
        axis="y",
    )
    parts = [plate]
    for i in range(4):
        x = -0.3 + 0.12 * i
        parts.append(cylinder(0.05, 0.056, 0.32, 10, TOP + 0.14,
                              tilt=0.22, shift_x=x))
    return parts


def build(dims: dict) -> dict:
    groups = {
        "body": [body_mesh()],
        "grille": louvres() + deflector(),
    }
    return {
        name: make_object(
            name,
            merge(parts),
            COLORS[name],
            metallic=METALLIC.get(name, 0.0),
            closed=False,
            sharp_degrees=40,
        )
        for name, parts in groups.items()
    }
