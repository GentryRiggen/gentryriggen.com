"""A radar mast like the Finnish patrol boat and the Bourbon tug in the
references: a tapering steel tube on a flared foot, a railed platform with a
white radome and braced legs, a yardarm with whip antennas and a rung ladder,
and a dark pedestal on the top for the scanner. The scanner bar itself spins,
so it stays procedural (registry subParts). Origin at the foot, bow toward
+X, the platform and yardarm spread across X (the yardarm) and Z."""

import math

from lib.shapes import (
    box,
    cylinder,
    hex_linear,
    lathe,
    make_object,
    merge,
    tube,
)

COLORS = {
    "mast": hex_linear("#8a949c"),
    "equipment": hex_linear("#4b545b"),
    "dome": hex_linear("#e4e8ea"),
}

PLATFORM_Y = 2.7
PEDESTAL_Y = 5.05


def tapered() -> tuple:
    return lathe([
        (0.0, 0.0), (0.15, 0.0), (0.15, 0.06), (0.095, 0.2),
        (0.08, 0.5), (0.06, 2.5), (0.05, 4.4), (0.045, 4.96),
        (0.0, 4.96),
    ], 10)


def platform() -> list:
    parts = [cylinder(0.31, 0.26, 0.05, 12, PLATFORM_Y)]
    # Railing posts and two rails around the edge.
    ring = [(0.3 * math.cos(a), 0.3 * math.sin(a))
            for a in [i * 2 * math.pi / 12 for i in range(13)]]
    for h in (0.12, 0.24):
        parts.append(tube([(x, PLATFORM_Y + h, z) for x, z in ring], 0.012,
                          4, caps=False))
    for x, z in ring[:-1]:
        parts.append(box(x, PLATFORM_Y + 0.13, z, 0.025, 0.26, 0.025))
    # Braced legs under the platform: lattice struts to the mast.
    for sz in (-1, 1):
        parts.append(tube([(0.0, 1.7, 0.05 * sz), (0.0, 2.4, 0.26 * sz)],
                          0.018, 5))
    for sx in (-1, 1):
        parts.append(tube([(0.05 * sx, 1.7, 0.0), (0.24 * sx, 2.45, 0.0)],
                          0.018, 5))
    return parts


def yardarm() -> list:
    parts = [box(0, 4.4, 0, 0.7, 0.05, 0.05)]
    for sx in (-1, 1):
        # Whip antenna and a small sensor box on each end.
        parts.append(tube([(0.33 * sx, 4.4, 0), (0.33 * sx, 4.9, 0)], 0.008, 4))
        parts.append(box(0.3 * sx, 4.33, 0, 0.06, 0.1, 0.06))
    # Gussets either side of the mast.
    parts.append(box(0, 4.3, 0, 0.18, 0.1, 0.05))
    return parts


def ladder() -> list:
    parts = [tube([(0.0, 0.2, 0.065), (0.0, 2.65, 0.065)], 0.01, 4),
             tube([(0.0, 0.2, 0.125), (0.0, 2.65, 0.125)], 0.01, 4)]
    for i in range(10):
        y = 0.3 + i * 0.24
        parts.append(box(0, y, 0.095, 0.02, 0.016, 0.07))
    return parts


def build(dims: dict) -> dict:
    mast = [tapered()] + platform() + yardarm() + ladder()
    dome = lathe([(0.0, 0.0)] + [
        (0.17 * math.sin(a), 0.17 - 0.17 * math.cos(a) * 0.95)
        for a in [i * math.pi / 8 for i in range(1, 9)]
    ] + [(0.0, 0.32)], 12)
    # The radome ball sits on the platform, a flat base under it.
    dome_verts = [(x, y + PLATFORM_Y + 0.03, z) for x, y, z in dome[0]]
    equipment = [
        cylinder(0.07, 0.07, 0.16, 10, PEDESTAL_Y),
        cylinder(0.11, 0.11, 0.05, 10, PLATFORM_Y + 0.05),
        box(0.0, PLATFORM_Y + 0.12, 0.2, 0.1, 0.14, 0.08),
    ]
    # Radome offset towards the stern-side of the platform (aft is -X).
    dome_mesh = ([(x - 0.0, y, z) for x, y, z in dome_verts], dome[1])
    return {
        "mast": make_object("mast", merge(mast), COLORS["mast"],
                            roughness=0.55),
        "equipment": make_object("equipment", merge(equipment),
                                 COLORS["equipment"], roughness=0.5),
        "dome": make_object("dome", dome_mesh, COLORS["dome"], roughness=0.3),
    }
