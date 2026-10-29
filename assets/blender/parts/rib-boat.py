"""Rigid inflatable: a fat grey tube collar tapering to a pointed bow, a
hard dark floor, a console with a windscreen, a seat and a fuel tank."""
import math

from lib.boats import tapered_tube, xf
from lib.shapes import box, extrude, hex_linear, make_object, merge, rounded_box

X_STERN, X_TIP, BC, Y = -0.5605, 0.5055, 0.1755, -0.08


def plan_z(t):
    return BC * max(0.0, 1 - t ** 2.4) ** 0.62


def build(dims):
    n = 9
    ts = [i / n for i in range(n + 1)]
    xs = [X_STERN + (X_TIP - X_STERN) * t for t in ts]
    rad = [0.09 if t < 0.45 else 0.09 - 0.035 * ((t - 0.45) / 0.55) ** 1.5 for t in ts]
    port = [(x, Y, -plan_z(t)) for x, t in zip(xs, ts)]
    stbd = [(x, Y, plan_z(t)) for x, t in zip(xs[-2::-1], ts[-2::-1])]
    collar = tapered_tube(port + stbd, rad + rad[-2::-1], 8)
    # Transom bar closing the collar across the stern.
    transom = box(X_STERN + 0.03, Y, 0.0, 0.06, 0.12, 2 * BC)
    # Hard floor, pointed in plan, sitting low inside the tubes.
    floor_plan = [(x, -plan_z(t) * 0.8) for x, t in zip(xs, ts)] + \
                 [(x, plan_z(t) * 0.8) for x, t in zip(xs[-2::-1], ts[-2::-1])]
    floor = extrude(floor_plan, -0.145, -0.115, "y")
    console = rounded_box((-0.12, -0.085, 0.0), (0.14, 0.1, 0.16), 0.02, 1)
    screen = xf(box(0, 0, 0, 0.012, 0.06, 0.15), rz=-0.5, move=(-0.06, -0.015, 0.0))
    seat = rounded_box((-0.32, -0.075, 0.0), (0.12, 0.05, 0.2), 0.015, 1)
    tank = rounded_box((-0.45, -0.085, 0.07), (0.1, 0.07, 0.09), 0.015, 1)
    bow_cleat = box(0.38, -0.115, 0.0, 0.05, 0.03, 0.04)
    tube_c = hex_linear("#69727a")
    dark = hex_linear("#4b545b")
    return {
        "paint-69727a": make_object("paint-69727a", merge([collar, transom]), tube_c, roughness=0.8),
        "paint-4b545b": make_object("paint-4b545b", merge([floor, console, screen, seat, tank, bow_cleat]), dark, roughness=0.6),
    }
