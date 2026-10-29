"""A podded drive (bow toward +X): a streamlined bulb pod with trim fins
hangs from a faired strut that rises to a round steering collar, with a
four-blade propeller and boss on the aft end, as the old procedural pod has.
Spins in the game as one group."""

import math

from lib.blades import foil, propeller, to_x
from lib.shapes import cylinder, hex_linear, loft, lathe, make_object, merge, box

POD = [
    (0.0, -0.4),
    (0.05, -0.385),
    (0.1, -0.33),
    (0.145, -0.2),
    (0.165, -0.04),
    (0.165, 0.1),
    (0.145, 0.26),
    (0.09, 0.36),
    (0.0, 0.4),
]


def build(dims: dict) -> dict:
    pod = [to_x(lathe(POD, 20))]
    strut = loft(
        [(0.1, foil(0.18, -0.08, 0.11)), (0.52, foil(0.17, -0.07, 0.1))],
        axis="y",
    )
    pod.append(strut)
    # Steering collar and its flange where the pod meets the hull.
    pod.append(cylinder(0.19, 0.19, 0.07, 24, 0.565, shift_x=0.05))
    pod.append(cylinder(0.14, 0.19, 0.06, 24, 0.5, shift_x=0.05))
    # Trim fins out each side of the aft pod.
    for sign in (1, -1):
        pod.append(box(-0.22, 0.0, sign * 0.2, 0.2, 0.025, 0.14))
    prop = propeller(
        radius=0.42, blades=4, chord=0.2, hub_radius=0.075, hub_length=0.12,
        thick=0.04, x=-0.46, rake=0.02,
    )
    return {
        "pod": make_object("pod", merge(pod), hex_linear("#8d98a5")),
        "propeller": make_object("propeller", prop, hex_linear("#b08d57")),
    }
