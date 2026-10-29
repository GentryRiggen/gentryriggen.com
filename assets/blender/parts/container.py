"""An ISO shipping container, in three.js coordinates (Y up, origin at the
centre of its 2x1 footprint, the door end at -X). Corrugated side walls (a
trapezoid profile swept up), a flat roof and front wall, eight corner
castings, top and bottom side rails, and at the door end two door leaves
with four locking rods, cam handles and hinge pins. The body takes the
container's own colour; castings, rods and hinges are steel."""

import math

from lib.shapes import box, extrude, hex_linear, make_object, merge, translate

LENGTH = 1.92
HALF_L = LENGTH / 2
Y0, Y1 = 0.03, 0.97
RIDGE = 0.488  # outer face of a corrugation ridge, from the centre line
VALLEY = 0.462
PERIODS = 10


def plan_profile():
    """The closed plan outline (x, z) of the body: flat ends, corrugated sides."""
    p = LENGTH / PERIODS
    side = []
    for k in range(PERIODS):
        x0 = -HALF_L + k * p
        side += [(x0 + 0.05 * p, VALLEY), (x0 + 0.30 * p, VALLEY), (x0 + 0.5 * p, RIDGE), (x0 + 0.80 * p, RIDGE)]
        # (the profile rises over 0.3-0.5 and falls over 0.8-1.05)
    side = [(x, z) for x, z in side]
    # Walk the +Z side from the door end to the front, then the -Z side back.
    pos = [(-HALF_L, VALLEY)] + side + [(HALF_L, VALLEY)]
    neg = [(x, -z) for x, z in reversed(pos)]
    return pos + neg


def body():
    return [extrude(plan_profile(), Y0, Y1, axis="y")]


def steel():
    parts = []
    # Corner castings: a blocky housing at each of the eight corners.
    for sx in (-1, 1):
        for sz in (-1, 1):
            for y, sy in ((Y0 + 0.035, 1), (Y1 - 0.035, -1)):
                parts.append(box(sx * (HALF_L - 0.045), y, sz * (0.5 - 0.045 - 0.002), 0.11, 0.07, 0.09))
    # Top and bottom side rails between the castings.
    for sz in (-1, 1):
        parts.append(box(0, Y1 - 0.016, sz * (RIDGE - 0.005), LENGTH - 0.2, 0.03, 0.036))
        parts.append(box(0, Y0 + 0.016, sz * (RIDGE - 0.005), LENGTH - 0.2, 0.03, 0.036))
    # Door end, outside face at x = -HALF_L: header, sill, centre seam, rods.
    fx = -HALF_L - 0.008
    parts.append(box(fx, Y1 - 0.07, 0, 0.022, 0.05, 0.8))
    parts.append(box(fx, Y0 + 0.07, 0, 0.022, 0.05, 0.8))
    parts.append(box(fx, (Y0 + Y1) / 2, 0, 0.022, Y1 - Y0 - 0.2, 0.02))  # centre seam
    for z in (-0.355, -0.14, 0.14, 0.355):
        parts.append(box(fx - 0.008, (Y0 + Y1) / 2, z, 0.022, Y1 - Y0 - 0.16, 0.026))
        for y in (0.30, 0.70):  # cam keepers
            parts.append(box(fx - 0.012, y, z, 0.03, 0.05, 0.05))
    for z in (-0.22, 0.22):  # cam handles
        parts.append(box(fx - 0.03, 0.5, z, 0.014, 0.014, 0.12))
    for z in (-0.41, 0.41):  # hinge pins
        for y in (0.2, 0.5, 0.8):
            parts.append(box(fx + 0.002, y, z, 0.02, 0.07, 0.03))
    return parts


def build(dims):
    return {
        "body": make_object("body", merge(body()), hex_linear("#ee8a2c"), roughness=0.6, closed=True, sharp_degrees=35),
        "steel": make_object("steel", merge(steel()), hex_linear("#5f666d"), metallic=0.8, roughness=0.5, closed=True),
    }
