"""Freefall lifeboat on its launch ramp: a torpedo hull sitting stern-high on
a tilted rail ramp (nose and low end toward -X, aft), with a raised bow
canopy and windscreen, a top hatch, a tall tail fin and steel trestle legs."""
import math

from lib.boats import xf
from lib.shapes import (box, cylinder, extrude, hex_linear, lathe, make_object,
                        merge, rounded_box)

TILT = 0.38
RL, RW = 2.6, 0.8
RC = RL / 2 * math.sin(TILT)


def ramp_frame(mesh):
    return xf(mesh, rz=TILT, move=(0.0, RC, 0.0))


def torpedo():
    """A lathe along Y (nose at +Y) turned so the nose points to -X."""
    pts = [(0.0, -0.9), (0.04, -0.88), (0.1, -0.7), (0.19, -0.4), (0.25, 0.0),
           (0.27, 0.25), (0.245, 0.55), (0.18, 0.78), (0.08, 0.9), (0.0, 0.93)]
    return xf(lathe(pts, 12), rz=math.pi / 2, move=(0.0, 0.31, 0.0))


def build(dims):
    slab = box(0, 0, 0, RL, 0.08, RW)
    rails = [box(0, 0.09, s * (RW / 2), RL, 0.1, 0.05) for s in (-1, 1)]
    ribs = [box(x, 0.05, 0, 0.05, 0.03, RW) for x in (-1.0, -0.4, 0.2, 0.8)]
    ramp = merge([ramp_frame(m) for m in [slab] + rails + ribs])
    legs = merge([box(0.7, RC / 2 + 0.2, s * (RW / 2), 0.06, RC + 0.4, 0.06)
                  for s in (-1, 1)] +
                 [box(-0.5, 0.125, s * (RW / 2), 0.05, 0.25, 0.05)
                  for s in (-1, 1)])
    canopy = xf(lathe([(0.0, -0.3), (0.16, -0.22), (0.24, 0.0), (0.2, 0.22),
                       (0.0, 0.3)], 12),
                rz=math.pi / 2, scale=(1.0, 1.0, 1.0), move=(-0.45, 0.46, 0.0))
    fin = extrude([(0.35, 0.3), (0.9, 0.3), (0.85, 0.47), (0.62, 0.5)],
                  -0.025, 0.025, "z")
    boat = merge([ramp_frame(m) for m in [torpedo(), canopy, fin]])
    windows = merge([ramp_frame(m) for m in [
        rounded_box((-0.7, 0.45, 0.0), (0.1, 0.09, 0.2), 0.02, 1),
        rounded_box((-0.45, 0.5, 0.225), (0.26, 0.08, 0.03), 0.01, 1),
        rounded_box((-0.45, 0.5, -0.225), (0.26, 0.08, 0.03), 0.01, 1)]])
    hatch = merge([ramp_frame(xf(cylinder(0.09, 0.1, 0.05, 12, 0.0), move=(0.3, 0.57, 0)))])
    return {
        "freefallRamp": make_object("freefallRamp", merge([ramp, legs]), hex_linear("#6b7580"), roughness=0.7),
        "freefallBoat": make_object("freefallBoat", boat, hex_linear("#e8661c"), roughness=0.4),
        "bridgeWindows": make_object("bridgeWindows", windows, hex_linear("#2c3e50"), roughness=0.1),
        "containerSteel": make_object("containerSteel", hatch, hex_linear("#5f666d"), metallic=1.0, roughness=0.4),
    }
