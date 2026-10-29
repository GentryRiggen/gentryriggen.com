"""An IALA lateral buoy, a red can: a squat float, a can-shaped body with a
white band, a dark steel cage holding a lamp (the game adds the glowing lamp
itself, so it can pulse), and a red can topmark above. Floats with its
waterline at y = 0.1 above the float's belly."""
import math

from lib.shapes import cylinder, hex_linear, lathe, make_object, merge, tube

SEG = 12
LAMP_Y = 1.22


def build(dims):
    float_hull = lathe(
        [(0.0, -0.4), (0.46, -0.38), (0.76, -0.18), (0.8, 0.1), (0.7, 0.34),
         (0.42, 0.44), (0.0, 0.46)],
        SEG,
    )
    body = cylinder(0.3, 0.36, 0.6, SEG, 0.74)  # y 0.44 .. 1.04
    topmark = cylinder(0.17, 0.2, 0.3, SEG, 1.55)  # y 1.4 .. 1.7
    band = cylinder(0.335, 0.335, 0.2, SEG, 0.72)  # y 0.62 .. 0.82

    legs = []
    for sx, sz in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        legs.append(tube([(sx * 0.24, 1.04, sz * 0.24), (sx * 0.14, 1.42, sz * 0.14)], 0.03, 4))
    ring = cylinder(0.3, 0.3, 0.05, SEG, 1.045)
    lamp_post = cylinder(0.07, 0.09, 0.14, 8, 1.11)
    fender = cylinder(0.82, 0.82, 0.1, SEG, 0.03)

    return {
        "body": make_object("body", merge([float_hull, body, topmark]), hex_linear("#d9342b"),
                            roughness=0.55, sharp_degrees=30),
        "band": make_object("band", band, hex_linear("#f4f1ea"), roughness=0.55, sharp_degrees=30),
        "frame": make_object("frame", merge(legs + [ring, lamp_post, fender]), hex_linear("#3a3f45"),
                             metallic=0.4, roughness=0.5, sharp_degrees=30),
    }
