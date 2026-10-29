"""A liner's cowl ventilator, in three.js coordinates (Y-up, origin at the
trunk's foot, mouth facing +X): a coaming base with a collar, a trunk, a
swan-neck bend and a wide bell mouth with a rolled lip. Outside is the
cowl paint; the mouth's dish is the dark inside."""

import math

from lib.deckkit import arc_points, sweep
from lib.shapes import hex_linear, lathe, make_object, merge, round_hoop

TRUNK = 0.105
BEND_R = 0.15
BEND_Y = 0.45
MOUTH_R = 0.2
LIP_X = 0.31  # the mouth plane


def trunk_and_cowl():
    """One swept skin: trunk up, a 90 degree bend toward +X, then the bell."""
    pts = [(0.0, 0.05, 0.0), (0.0, BEND_Y, 0.0)]
    radii = [TRUNK, TRUNK]
    # The bend: centre (BEND_R, BEND_Y), sweeping from 180 to 90 degrees.
    for x, y, z in arc_points(BEND_R, BEND_Y, BEND_R, math.pi, math.pi / 2, 6)[1:]:
        pts.append((x, y, z))
        radii.append(TRUNK * 1.02)
    # Bell: flares out over the last stretch, then rolls its lip back in.
    top = BEND_Y + BEND_R
    flare = [
        (BEND_R + 0.04, 1.04),
        (BEND_R + 0.08, 1.35),
        (BEND_R + 0.12, 1.7),
        (LIP_X - 0.02, 1.9),
        (LIP_X, 1.84),
    ]
    for x, scale in flare:
        pts.append((x, top, 0.0))
        radii.append(TRUNK * scale)
    pts[-1] = (LIP_X - 0.012, top, 0.0)
    radii[-1] = MOUTH_R * 0.9
    return sweep(pts, radii, 20)


def base_and_collars():
    coaming = lathe([
        (0.0, 0.0), (0.185, 0.0), (0.185, 0.03), (0.155, 0.06), (0.125, 0.09),
        (TRUNK, 0.11), (0.0, 0.11),
    ], 20)
    collars = [
        lathe(round_hoop(TRUNK, TRUNK, y - 0.016, y + 0.016, 0.014, 3), 20)
        for y in (0.2, 0.33)
    ]
    return [coaming] + collars


def inside():
    """The dark dish seen looking into the mouth."""
    cx = LIP_X - 0.012
    # Revolved about Y, then laid down so its axis points +X.
    from lib.deckkit import rot_z
    dish = lathe([(0.0, -0.05), (MOUTH_R * 0.55, -0.03), (MOUTH_R * 0.86, 0.0)], 20)
    dish = rot_z(dish, -math.pi / 2)
    verts, faces = dish
    # lathe y -> -x after rotation about Z by -90: y maps to +x? check below.
    x_shift = cx + 0.006
    return [(x + x_shift, y + BEND_Y + BEND_R, z) for x, y, z in verts], [
        tuple(reversed(f)) for f in faces
    ]


def build(dims: dict) -> dict:
    groups = {
        "cowl": ([trunk_and_cowl()] + base_and_collars(), "#c9ced4", 0.8),
        "inside": ([inside()], "#2c3e50", 0.0),
    }
    return {
        name: make_object(
            name, merge(parts), hex_linear(color), metallic=metal,
            roughness=0.45, closed=(name == "cowl"), sharp_degrees=45,
        )
        for name, (parts, color, metal) in groups.items()
    }
