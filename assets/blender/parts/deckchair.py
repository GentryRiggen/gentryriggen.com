"""A Titanic steamer chair, in three.js coordinates (Y-up, back at -X, the
long leg rest reaching toward +X, origin at the footprint centre on the
deck): a reclining back and seat of slats between side rails, a leg rest
on its own rails, curved arm rails, an X-ish set of legs, and a slim
cushion runner (the game's blue cushion) down the seat and back."""

import math

from lib.deckkit import rot_x, rot_z, sweep
from lib.shapes import cylinder, hex_linear, make_object, merge, rounded_box, translate, tube

RAIL_Z = 0.165
SLAT = 0.018  # slat thickness
SEAT_Y = 0.155
BACK_ANGLE = math.radians(62)  # back's angle up from the seat
BACK_BASE = (-0.09, SEAT_Y + 0.012)
BACK_LEN = 0.31
REST_TILT = 0.12


def slat_flat(x: float, y: float, along: float, width: float, tilt: float = 0.0):
    """A slat lying across the chair (z), `along` long in x, tilted about Z."""
    mesh = rounded_box((0, 0, 0), (along, SLAT, width), 0.006, 1)
    return translate(rot_z(mesh, tilt), x, y, 0.0)


def back_point(t: float):
    ux, uy = -math.cos(BACK_ANGLE), math.sin(BACK_ANGLE)
    return BACK_BASE[0] + ux * t, BACK_BASE[1] + uy * t, ux, uy


def frame():
    parts = []
    # Seat slats, four of them, with gaps.
    for i in range(4):
        parts.append(slat_flat(-0.065 + i * 0.058, SEAT_Y, 0.046, 0.3))
    # Leg rest slats, rising gently toward the foot.
    for i in range(6):
        x = 0.14 + 0.05 * i + 0.02
        parts.append(slat_flat(x, SEAT_Y + 0.012 + (x - 0.12) * math.tan(REST_TILT), 0.04, 0.3, REST_TILT))
    # Back slats: boxes standing along the back's slope.
    tilt = math.pi / 2 - BACK_ANGLE
    for i in range(6):
        px, py, _, _ = back_point(0.04 + i * 0.054)
        mesh = rounded_box((0, 0, 0), (SLAT, 0.042, 0.3), 0.006, 1)
        parts.append(translate(rot_z(mesh, tilt), px, py, 0.0))
    for s in (-1, 1):
        z = s * RAIL_Z
        top = back_point(BACK_LEN)
        # Back rail and seat rail meet at the hinge; the rail runs on to the foot.
        parts.append(tube([(BACK_BASE[0] - 0.01, SEAT_Y + 0.01, z), (top[0], top[1] + 0.01, z)], 0.015, 6))
        foot_y = SEAT_Y + 0.012 + (0.43 - 0.12) * math.tan(REST_TILT)
        parts.append(tube([(-0.1, SEAT_Y, z), (0.12, SEAT_Y + 0.012, z), (0.43, foot_y - 0.006, z)], 0.014, 6))
        # Arm rail: from the back, curved forward over a post to the seat.
        arm_start = back_point(0.2)
        parts.append(tube([
            (arm_start[0] - 0.01, arm_start[1] + 0.01, z + s * 0.012),
            (-0.08, arm_start[1] + 0.005, z + s * 0.014),
            (0.0, arm_start[1] - 0.04, z + s * 0.014),
            (0.075, arm_start[1] - 0.05, z + s * 0.014),
        ], 0.013, 6))
        parts.append(tube([(0.075, arm_start[1] - 0.05, z + s * 0.014), (0.075, SEAT_Y, z)], 0.012, 6))
    # Top rail of the back, thicker, across the chair.
    top = back_point(BACK_LEN + 0.015)
    bar = rot_x(cylinder(0.019, 0.019, 2 * RAIL_Z + 0.03, 8, 0.0), math.pi / 2)
    parts.append(translate(bar, top[0], top[1], 0.0))
    return parts


def legs():
    parts = []
    foot_y = SEAT_Y + 0.012 + (0.43 - 0.12) * math.tan(REST_TILT)
    for s in (-1, 1):
        z = s * (RAIL_Z + 0.005)
        parts.append(tube([(-0.06, SEAT_Y - 0.01, z), (-0.2, 0.012, z)], 0.015, 6))
        parts.append(tube([(0.1, SEAT_Y - 0.01, z), (0.14, 0.012, z)], 0.015, 6))
        parts.append(tube([(0.43, foot_y - 0.01, z), (0.44, 0.012, z)], 0.013, 6))
    # Cross bars tying the legs.
    for x0, y0, x1, y1 in ((-0.13, 0.085, -0.13, 0.085), (0.12, 0.085, 0.12, 0.085)):
        bar = rot_x(cylinder(0.011, 0.011, 2 * RAIL_Z, 6, 0.0), math.pi / 2)
        parts.append(translate(bar, x0, y0, 0.0))
    return parts


def cushion():
    seat = translate(rounded_box((0, 0, 0), (0.2, 0.026, 0.19), 0.011, 2), 0.01, SEAT_Y + 0.019, 0.0)
    tilt = math.pi / 2 - BACK_ANGLE
    px, py, ux, uy = back_point(0.17)
    nx, ny = uy, -ux  # the back face: toward +X and up
    back = rot_z(rounded_box((0, 0, 0), (0.026, 0.26, 0.19), 0.011, 2), tilt)
    back = translate(back, px + nx * 0.024, py + ny * 0.024, 0.0)
    return [seat, back]


COLORS = {"frame": "#e8e4d8", "legs": "#e8e4d8", "cushion": "#3f9ad6"}
METAL = {}


def build(dims: dict) -> dict:
    groups = {"frame": frame(), "legs": legs(), "cushion": cushion()}
    return {
        name: make_object(
            name, merge(parts), hex_linear(COLORS[name]),
            roughness=0.6, closed=True, sharp_degrees=40,
        )
        for name, parts in groups.items()
    }
