"""Liferaft canister: white fibreglass cylinder with domed ends, a seam band
at the joint, orange securing straps, standing in a white saddle cradle.
Lies along X at the rail, 0.18 inboard of the part origin (+Z outboard)."""
import math

from lib.boats import xf
from lib.shapes import box, hex_linear, lathe, make_object, merge, rounded_box, translate

R, HALF, Y0, Z0 = 0.125, 0.35, 0.15, -0.18


def body():
    prof = [(0.0, -HALF)]
    for i in range(1, 4):  # dome
        a = math.pi / 2 * i / 3
        prof.append((R * math.sin(a), -HALF + R * 0.7 * (1 - math.cos(a))))
    for i in range(2):
        prof.append((R, -HALF + R * 0.7 + (2 * HALF - 2 * R * 0.7) * i))
    for i in range(2, -1, -1):
        a = math.pi / 2 * i / 3
        prof.append((R * math.sin(a), HALF - R * 0.7 * (1 - math.cos(a))))
    prof.append((0.0, HALF))
    prof.sort(key=lambda p: p[1])
    return lathe(prof, 10)


def ring(radius, half_h, y):
    return lathe([(radius, y - half_h), (radius, y + half_h)], 10)


def to_x(mesh, **kw):
    return xf(mesh, rz=math.pi / 2, move=(0.0, Y0, Z0))


def build(dims):
    white = [to_x(body())]
    white.append(to_x(lathe([(R + 0.008, -0.025), (R + 0.008, 0.025)], 10)))  # seam band
    # Saddle cradle: two plates under the straps, plus a rail along the base.
    for x in (-0.2, 0.2):
        white.append(box(x, 0.05, Z0, 0.07, 0.07, 0.2))
    white.append(box(0.0, 0.032, Z0, 0.5, 0.032, 0.05))
    straps = [to_x(translate(ring(0.137, 0.025, 0), 0, -0.2, 0)),
              to_x(translate(ring(0.137, 0.025, 0), 0, 0.2, 0))]
    # to_x maps lathe y to -x, so offsets above are symmetric.
    return {
        "lifeboat": make_object("lifeboat", merge(white), hex_linear("#f7f7f2"), roughness=0.5),
        "paint-f08a24": make_object("paint-f08a24", merge(straps), hex_linear("#f08a24"), roughness=0.6),
    }
