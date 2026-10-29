"""A North Atlantic berg like the one the Titanic struck: a pale, weathered
peak with sharp facets and a sloping shoulder above the waterline, and a
bluer, bulging keel below it (the game draws that slot see-through).

Two shapes: `iceberg` (the trial's berg and half of sailing's) and
`iceberg-b`, a lower, two-horned berg. Both keep today's footprint: a
waterline about 6 across, a keel 4 deep and a peak about 3 high, so the
trial's standoff from the hull still holds."""
import math
import random

from lib.envkit import harmonics, skin, smoothstep, tent
from lib.shapes import hex_linear, make_object

N = 32
# Ring fractions from the waterline rim (1) in to the apex (0).
RHO = [1.0, 0.93, 0.82, 0.68, 0.52, 0.36, 0.2]
# Keel rings: (depth, width factor) below the waterline, widest just under it.
KEEL = [(0.0, 1.0), (-0.55, 1.14), (-1.3, 1.27), (-2.1, 1.16), (-2.9, 0.86), (-3.6, 0.46)]
KEEL_TIP = (0.35, -4.0, 0.0)

SHAPES = {
    0: dict(
        seed=11, rx=3.0, rz=2.5, ox=0.2, apex=(0.9, 0.1),
        tents=[(0.9, 0.1, 3.4, 2.9, 3.05, 1.05), (-1.6, 0.4, 3.2, 2.6, 1.95, 0.8),
               (2.4, -0.9, 2.3, 1.9, 1.3, 0.8), (-0.3, -1.3, 2.4, 1.6, 1.4, 0.9)],
    ),
    1: dict(
        seed=29, rx=3.05, rz=2.45, ox=0.2, apex=(-0.6, -0.2),
        tents=[(-0.9, -0.3, 2.6, 2.3, 2.9, 1.0), (1.7, 0.6, 2.5, 2.2, 2.5, 1.0),
               (0.4, 0.2, 4.2, 3.0, 1.5, 0.7)],
    ),
}


def build(dims):
    shape = SHAPES[int(dims.get("shape", 0))]
    rng = random.Random(shape["seed"])
    wobble = harmonics(shape["seed"], 5)
    keel_wobble = harmonics(shape["seed"] + 3, 3)
    ax, az = shape["apex"]

    rim = []
    for j in range(N):
        a = 2 * math.pi * j / N
        w = 1 + 0.1 * wobble(a)
        rim.append((shape["ox"] + shape["rx"] * w * math.cos(a), shape["rz"] * w * math.sin(a)))

    def height(x, z, rho):
        shoulder = 0.6 * smoothstep(1.0, 0.66, rho)
        peak = max(tent(x, z, *t[:2], t[2], t[3], t[4], t[5]) for t in shape["tents"])
        return max(shoulder, peak)

    rings = []
    for rho in RHO:
        ring = []
        for j, (fx, fz) in enumerate(rim):
            x = ax + rho * (fx - ax)
            z = az + rho * (fz - az)
            if rho < 1.0:
                x += rng.uniform(-0.1, 0.1)
                z += rng.uniform(-0.1, 0.1)
            y = 0.0 if rho == 1.0 else height(x, z, rho) + rng.uniform(-0.1, 0.12)
            ring.append((x, max(y, 0.2 if rho < 1.0 else 0.0), z))
        rings.append(ring)
    apex = (ax, height(ax, az, 0.0) + 0.05, az)
    top = skin(rings, last_cap=apex)

    keel_rings = []
    for depth, wide in KEEL:
        ring = []
        for j, (fx, fz) in enumerate(rim):
            a = 2 * math.pi * j / N
            f = wide * (1 + (0.07 * keel_wobble(a) if depth else 0))
            x = shape["ox"] + (fx - shape["ox"]) * f
            z = fz * f
            if depth:
                x += rng.uniform(-0.08, 0.08)
                z += rng.uniform(-0.08, 0.08)
                depth_j = depth * (1 + 0.1 * keel_wobble(a + 1.0)) + rng.uniform(-0.1, 0.1)
            else:
                depth_j = 0.0
            ring.append((x, depth_j, z))
        keel_rings.append(ring)
    under = skin(keel_rings, down=True, last_cap=KEEL_TIP)

    return {
        "top": make_object("top", top, hex_linear("#f5fbff"), roughness=0.75, sharp_degrees=2),
        "under": make_object("under", under, hex_linear("#a9d8ee"), roughness=0.6, sharp_degrees=2),
    }
