"""A small coaster passing by, bow toward +X like ours: a blue hull with a
raked bow and a red boot-topping, an aft deckhouse with a wheelhouse above
it, a red funnel with a dark cap, two hatch coamings and a mast. Built at
the size the game draws it at radius 4 (about 9 long, 2.4 wide), with the
waterline at y = 0."""
from lib.envkit import smoothstep, split_by_y
from lib.shapes import box, cylinder, hex_linear, loft, make_object, merge, rounded_box, tube

STATIONS = [-3.6, -3.1, -2.4, -1.2, 0.0, 1.2, 2.4, 3.2, 3.9, 4.5, 5.0, 5.52]
BOOT_TOP = 0.2


def half_beam(x: float) -> float:
    if x < -2.4:
        return 1.0 + 0.2 * smoothstep(-3.6, -2.4, x)
    if x < 2.6:
        return 1.2
    t = (x - 2.6) / (5.52 - 2.6)
    return max(0.03, 1.2 * (1 - t**1.8) ** 0.7)


def deck_y(x: float) -> float:
    return 0.9 + 0.25 * smoothstep(3.0, 5.52, x)


def keel_y(x: float) -> float:
    return -0.5 + 0.95 * smoothstep(2.4, 5.52, x) ** 1.4


def section(x: float):
    hb, top, keel = half_beam(x), deck_y(x), keel_y(x)
    bilge = keel + 0.15
    waterline = max(BOOT_TOP - 0.05, bilge + 0.02)
    return [
        (-hb, top), (-hb, waterline), (-hb * 0.88, bilge), (-hb * 0.55, keel),
        (hb * 0.55, keel), (hb * 0.88, bilge), (hb, waterline), (hb, top),
    ]


def build(dims):
    hull_mesh = loft([(x, section(x)) for x in STATIONS], axis="x")
    boot_mesh, topsides = split_by_y(hull_mesh, BOOT_TOP)

    house = rounded_box((-2.2, 1.225, 0.0), (2.0, 0.65, 1.9), 0.05, 1)
    wheelhouse = rounded_box((-1.85, 1.78, 0.0), (1.0, 0.5, 1.7), 0.05, 1)
    mast = tube([(-1.85, 2.0, 0.0), (-1.85, 2.38, 0.0)], 0.035, 6)

    funnel = cylinder(0.2, 0.27, 0.75, 12, 1.925, tilt=0.0, shift_x=-2.75)
    funnel_cap = cylinder(0.215, 0.215, 0.13, 12, 2.24, shift_x=-2.75)
    coamings = [rounded_box((0.9, 1.0, 0.0), (1.5, 0.22, 1.5), 0.03, 1),
                rounded_box((2.6, 1.0, 0.0), (1.3, 0.22, 1.4), 0.03, 1)]
    hatch_tops = [box(0.9, 1.115, 0.0, 1.3, 0.02, 1.3), box(2.6, 1.115, 0.0, 1.1, 0.02, 1.2)]

    windows = [
        box(-1.345, 1.82, 0.0, 0.04, 0.2, 1.5),
        box(-1.85, 1.82, 0.86, 0.8, 0.2, 0.04), box(-1.85, 1.82, -0.86, 0.8, 0.2, 0.04),
        box(-1.2, 1.22, 0.0, 0.04, 0.22, 1.5),
        box(-2.2, 1.25, 0.96, 1.6, 0.16, 0.04), box(-2.2, 1.25, -0.96, 1.6, 0.16, 0.04),
    ]

    return {
        "hull": make_object("hull", topsides, hex_linear("#35506a"), roughness=0.6, sharp_degrees=30),
        "boot": make_object("boot", merge([boot_mesh, funnel] + coamings), hex_linear("#8e2a22"),
                            roughness=0.6, sharp_degrees=30),
        "cabin": make_object("cabin", merge([house, wheelhouse, mast]), hex_linear("#f1eee4"),
                             roughness=0.6, sharp_degrees=30),
        "windows": make_object("windows", merge(windows + [funnel_cap] + hatch_tops),
                               hex_linear("#2c3e50"), roughness=0.4, sharp_degrees=30),
    }
