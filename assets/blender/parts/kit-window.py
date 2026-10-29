"""A rectangular window frame for a cabin or promenade wall, in the kit frame
(see kit_common): wall face on x = 0, outward +X, centred on the opening.
A chamfered frame with a rebate for the glass, a sloped sill that overhangs
the frame, a centre mullion and four corner studs. The opening is 0.20 wide
by 0.22 tall (the procedural cabin pane); the game scales a piece to other
pane sizes. The glass pane and its night glow stay procedural."""

from lib.shapes import box, extrude, hex_linear, make_object, merge

from parts.kit_common import BACK, FRONT, rect_frame  # noqa: F401

APERTURE_W = 0.2
APERTURE_H = 0.22
MARGIN = 0.03
SILL_H = 0.045
SILL_OVERHANG = 0.02
SILL_FRONT = 0.032


def sill():
    top = -(APERTURE_H / 2 + MARGIN)
    bottom = top - SILL_H
    # (x, y) wedge: a flat back, a sloped top that sheds water, a rounded nose
    profile = [
        (BACK, top),
        (BACK, bottom),
        (SILL_FRONT - 0.006, bottom),
        (SILL_FRONT, bottom + 0.008),
        (SILL_FRONT, bottom + 0.02),
        (FRONT - 0.002, top),
    ]
    half = APERTURE_W / 2 + MARGIN + SILL_OVERHANG
    return extrude(profile, -half, half, axis="z")


def mullion():
    return box(0.014, 0.0, 0.0, 0.012 + 0.0, APERTURE_H, 0.012)


def studs():
    xs = APERTURE_W / 2 + MARGIN / 2
    ys = APERTURE_H / 2 + MARGIN / 2
    return [
        box(FRONT + 0.0025, sy * ys, sz * xs, 0.005, 0.008, 0.008)
        for sy in (-1, 1)
        for sz in (-1, 1)
    ]


def build(dims: dict) -> dict:
    parts = rect_frame(APERTURE_W, APERTURE_H, MARGIN, FRONT)
    parts += [sill(), mullion()] + studs()
    return {
        "frame": make_object(
            "frame", merge(parts), hex_linear("#ffffff"),
            roughness=0.5, closed=True, sharp_degrees=35,
        )
    }
