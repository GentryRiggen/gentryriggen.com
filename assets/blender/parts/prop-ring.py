"""Plane Builder prop: a ring gate, radius 1 m (the game scales it to each
ring's radius), tube 0.085 m, in the XY plane (it faces +Z; the game turns it
to face the flight path). Eight arcs alternate blue and white like a hoop of
bunting, with four small cleats on the cardinal points. Slots: ring_blue,
ring_white."""

import math

from lib.obstaclekit import finish
from lib.shapes import box, merge, tube

TUBE = 0.085
ARCS = 8
STEPS = 2


def arc(k):
    a0 = 2 * math.pi * k / ARCS
    pts = []
    for s in range(STEPS + 1):
        a = a0 + 2 * math.pi / ARCS * s / STEPS
        pts.append((math.cos(a), math.sin(a), 0.0))
    return tube(pts, TUBE, seg=6, caps=True)


def build(dims: dict) -> dict:
    blue = [arc(k) for k in range(0, ARCS, 2)]
    white = [arc(k) for k in range(1, ARCS, 2)]
    cleats = [box(0.0, 1.0, 0.0, 0.22, 0.2, 0.2), box(0.0, -1.0, 0.0, 0.22, 0.2, 0.2),
              box(1.0, 0.0, 0.0, 0.2, 0.22, 0.2), box(-1.0, 0.0, 0.0, 0.2, 0.22, 0.2)]
    return finish({"ring_blue": blue + cleats, "ring_white": white}, "meadow", fit=False)
