"""A rectangular window frame for a cabin or promenade wall, in the kit frame
(see kit_common): wall face on x = 0, outward +X, centred on the opening.
A frame with a rebate for the glass, a sloped sill that overhangs it and a
centre mullion; 52 triangles. The opening is 0.20 wide by 0.22 tall (the
procedural cabin pane); the game scales a piece to other pane sizes. The
glass pane and its night glow stay procedural."""

from lib.shapes import box, extrude, hex_linear, make_object, merge

from parts.kit_common import BACK, FRONT, frame_ring

APERTURE_W = 0.2
APERTURE_H = 0.22
MARGIN = 0.03
SILL_H = 0.045
SILL_OVERHANG = 0.02
SILL_FRONT = 0.032
LIP = 0.008


def frame():
    hw, hh = APERTURE_W / 2, APERTURE_H / 2
    return frame_ring(
        (-hw - MARGIN, hw + MARGIN, -hh - MARGIN, hh + MARGIN),
        (-hw, hw, -hh, hh),
        lambda y: FRONT,
        lambda y: FRONT - LIP,
    )


def sill():
    top = -(APERTURE_H / 2 + MARGIN)
    bottom = top - SILL_H
    profile = [
        (BACK, top),
        (BACK, bottom),
        (SILL_FRONT, bottom),
        (SILL_FRONT, bottom + 0.02),
        (FRONT - 0.002, top),
    ]
    half = APERTURE_W / 2 + MARGIN + SILL_OVERHANG
    return extrude(profile, -half, half, axis="z")


def build(dims: dict) -> dict:
    parts = [frame(), sill(), box(0.014, 0.0, 0.0, 0.012, APERTURE_H, 0.012)]
    return {
        "frame": make_object(
            "frame", merge(parts), hex_linear("#ffffff"),
            roughness=0.5, closed=False, sharp_degrees=35,
        )
    }
