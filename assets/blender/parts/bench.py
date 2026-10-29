"""A slatted deck bench, in three.js coordinates (Y-up, back at -X, length
along Z, origin at the footprint centre on the deck): wooden seat and
backrest slats with gaps, between two iron end frames with a front leg, a
raked back post that carries the backrest, an arm rest and a foot bar."""

import math

from lib.deckkit import rot_x, rot_z
from lib.shapes import cylinder, hex_linear, make_object, merge, rounded_box, translate, tube

HALF = 0.40  # half the length
SEAT_Y = 0.22
FRAME_Z = 0.365  # centre of each end frame
BACK_TILT = 0.14  # radians the backrest leans back (toward -X)
BACK_X = -0.15


def wood():
    parts = []
    # Seat: five slats along Z, each a plank running the length.
    for i in range(5):
        x = -0.12 + i * 0.062
        parts.append(translate(rounded_box((0, 0, 0), (0.052, 0.028, 0.8), 0.008, 1), x, SEAT_Y, 0.0))
    # Backrest: three broad slats, leaning back.
    for i in range(3):
        y = 0.3 + i * 0.09
        slat = rot_z(rounded_box((0, 0, 0), (0.026, 0.076, 0.78), 0.008, 1), BACK_TILT)
        parts.append(translate(slat, BACK_X - (y - SEAT_Y) * math.tan(BACK_TILT) + 0.01, y, 0.0))
    return parts


def iron():
    parts = []
    for s in (-1, 1):
        z = s * FRAME_Z
        t = 0.034  # frame thickness across Z
        # Front leg, a slim slab with a flared foot.
        leg = rounded_box((0, 0, 0), (0.05, SEAT_Y - 0.014, t), 0.01, 1)
        parts.append(translate(leg, 0.12, (SEAT_Y - 0.014) / 2, z))
        foot = rounded_box((0, 0, 0), (0.11, 0.02, t * 1.3), 0.008, 1)
        parts.append(translate(foot, 0.12, 0.01, z))
        # Rear leg runs straight up into the raked backrest post.
        post_top = (BACK_X - (0.52 - SEAT_Y) * math.tan(BACK_TILT) - 0.02, 0.54, z)
        parts.append(tube([(-0.13, 0.0, z), (-0.14, 0.12, z), (-0.145, SEAT_Y, z), post_top], 0.022, 8))
        foot2 = rounded_box((0, 0, 0), (0.1, 0.02, t * 1.3), 0.008, 1)
        parts.append(translate(foot2, -0.13, 0.01, z))
        # Seat support rail tying the legs, and an arm rest curling forward.
        rail = rounded_box((0, 0, 0), (0.3, 0.03, t), 0.008, 1)
        parts.append(translate(rail, -0.01, SEAT_Y - 0.03, z))
        parts.append(tube([
            (post_top[0] + 0.05, 0.4, z),
            (-0.07, 0.4, z),
            (0.08, 0.385, z),
            (0.13, 0.35, z),
            (0.13, SEAT_Y + 0.01, z),
        ], 0.018, 8))
    # A foot bar between the front legs.
    bar = rot_x(cylinder(0.012, 0.012, 2 * FRAME_Z, 6, 0.0), math.pi / 2)
    parts.append(translate(bar, 0.12, 0.07, 0.0))
    return parts


COLORS = {"wood": "#a8764a", "iron": "#4a4e55"}
METAL = {"iron": 0.8}


def build(dims: dict) -> dict:
    groups = {"wood": wood(), "iron": iron()}
    return {
        name: make_object(
            name, merge(parts), hex_linear(COLORS[name]),
            metallic=METAL.get(name, 0.0), roughness=0.55, closed=True, sharp_degrees=40,
        )
        for name, parts in groups.items()
    }
