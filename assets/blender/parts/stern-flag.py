"""A stern flagstaff: a tapered pole on a flared socket with a gilt ball
finial, a halyard truck under the ball, two hoist rings where the cloth
hinges (the cloth itself waves, so it stays procedural, registry subParts)
and a belaying cleat low on the pole. Origin at the foot, 1.5 high, cloth
hinges at x = 0 and streams toward -X."""

import math

from lib.shapes import box, cylinder, hex_linear, lathe, make_object, merge

COLORS = {
    "pole": hex_linear("#f3efe4"),
    "fittings": hex_linear("#d4a94a"),
}
TOP = 1.46


def sphere(r: float, y: float, seg: int = 10):
    pts = [(0.0, y - r)] + [
        (r * math.sin(a), y - r * math.cos(a))
        for a in [i * math.pi / 6 for i in range(1, 6)]
    ] + [(0.0, y + r)]
    return lathe(pts, seg)


def ring(y: float, r: float = 0.036):
    return lathe([(r - 0.012, y - 0.015), (r, y - 0.015), (r, y + 0.015),
                  (r - 0.012, y + 0.015)], 10)


def build(dims: dict) -> dict:
    pole = lathe([
        (0.0, 0.0), (0.05, 0.0), (0.05, 0.04), (0.036, 0.12), (0.03, 0.2),
        (0.02, TOP), (0.0, TOP),
    ], 10)
    fittings = [
        sphere(0.04, TOP + 0.01),
        # Truck: a short disc under the ball.
        cylinder(0.034, 0.034, 0.02, 10, TOP - 0.03),
        ring(1.06), ring(1.44 - 0.02),
        # Cleat low on the pole, on the side away from the cloth (+X).
        box(0.04, 0.5, 0.0, 0.03, 0.025, 0.1),
        # Socket collar.
        cylinder(0.06, 0.06, 0.03, 10, 0.2),
    ]
    return {
        "pole": make_object("pole", pole, COLORS["pole"], roughness=0.6),
        "fittings": make_object("fittings", merge(fittings), COLORS["fittings"],
                                metallic=0.8, roughness=0.35),
    }
