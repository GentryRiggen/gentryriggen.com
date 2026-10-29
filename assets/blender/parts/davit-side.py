"""Wall-mounted boat arm: a bolted plate, a deep arm on a pivot boss with a
gusset brace, and a sheave block with a short fall at the tip. +Z outboard."""
from lib.shapes import (box, cylinder, extrude, hex_linear, make_object, merge,
                        rounded_box, tube)


def build(dims):
    plate = rounded_box((0, 0.1, 0.04), (0.3, 0.3, 0.08), 0.015, 2)
    bolts = [box(sx * 0.11, 0.1 + sy * 0.11, 0.09, 0.03, 0.03, 0.02)
             for sx in (-1, 1) for sy in (-1, 1)]
    arm = rounded_box((0, 0.15, 0.17), (0.06, 0.07, 0.3), 0.01, 1)
    boss = rounded_box((0, 0.15, 0.1), (0.1, 0.1, 0.05), 0.015, 1)
    # Gusset: a triangle from the wall up to under the arm, x thin.
    gus = extrude([(0.08, 0.0), (0.08, 0.115), (0.26, 0.115)], -0.02, 0.02, "x")
    block = rounded_box((0, 0.09, 0.32), (0.09, 0.1, 0.09), 0.015, 2)
    fall = tube([(0, 0.04, 0.32), (0, -0.01, 0.32)], 0.007, 5)
    mesh = merge([plate, arm, boss, gus, block, fall] + bolts)
    return {"davit": make_object("davit", mesh, hex_linear("#e8e4d8"),
                                 metallic=1.0, roughness=0.4)}
