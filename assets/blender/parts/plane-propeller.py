"""Plane Builder propeller pieces.

- propeller-blades: a two-blade propeller of radius 1 on the X shaft (the game
  scales it to the engine and spins it): twisted tapered blades with rounded
  tips, painted trim at the tips as on real props, and a small hub plate.
- propeller-spinner: the nose spinner behind it, 0.3 long and 0.2 across at
  the back plate: a flat back and an ogive nose, with a trim ring."""

import math

from lib.planekit import finish, ring, rotate_x
from lib.shapes import Mesh, loft, merge

ROOT = 0.09
TIP = 1.0
TIP_PAINT = 0.8


def section(y: float):
    """(chord, thickness, pitch) of the blade at radius y."""
    t = (y - ROOT) / (TIP - ROOT)
    if t < 0.25:
        chord = 0.1 + 0.07 * (t / 0.25)
    elif t < 0.85:
        chord = 0.17 - 0.05 * ((t - 0.25) / 0.6)
    else:
        e = (t - 0.85) / 0.15
        chord = 0.12 * math.sqrt(max(0.05, 1 - e * e))
    thick = 0.03 * (1 - 0.5 * t)
    pitch = math.radians(38 - 24 * t)
    return chord, thick, pitch


def blade_sections(y0: float, y1: float, steps: int):
    out = []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        chord, thick, pitch = section(y)
        # a flat lens in (x, z): thin in x, `chord` wide in z, then turned by
        # the pitch about the blade's own axis
        pts = []
        for k in range(8):
            a = 2 * math.pi * k / 8
            px, pz = thick * 0.5 * math.cos(a), chord * 0.5 * math.sin(a)
            pts.append(
                (px * math.cos(pitch) - pz * math.sin(pitch),
                 px * math.sin(pitch) + pz * math.cos(pitch))
            )
        out.append((y, pts))
    return out


def blades() -> tuple[Mesh, Mesh]:
    body = loft(blade_sections(ROOT, TIP_PAINT, 6), axis="y")
    tip = loft(blade_sections(TIP_PAINT, TIP, 4), axis="y")
    other_body = rotate_x(body, math.pi)
    other_tip = rotate_x(tip, math.pi)
    return merge([body, other_body]), merge([tip, other_tip])


def blade_hub() -> Mesh:
    return loft(
        [(x, ring(14, r, r)) for x, r in ((-0.05, 0.075), (-0.03, 0.115), (0.04, 0.115), (0.07, 0.07))],
        axis="x",
    )


def spinner() -> tuple[Mesh, Mesh]:
    back, length, r0 = -0.15, 0.3, 0.2
    stations = [(back, r0 * 0.98), (back + 0.015, r0)]
    n = 8
    for i in range(1, n + 1):
        t = i / n
        stations.append((back + 0.04 + (length - 0.04) * t, max(0.004, r0 * (1 - t**1.9) ** 0.62)))
    body = loft([(x, ring(14, r, r)) for x, r in stations], axis="x")
    ringm = loft([(x, ring(14, 0.206, 0.206)) for x in (-0.115, -0.085)], axis="x")
    return body, ringm


def build(dims: dict) -> dict:
    if dims["unit"] == "propeller-blades":
        body, tip = blades()
        return finish({"dark": [body, blade_hub()], "trim": [tip], "body": []})
    body, ringm = spinner()
    return finish({"dark": [body], "trim": [ringm], "body": []})
