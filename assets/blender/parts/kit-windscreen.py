"""A raked wheelhouse windscreen unit for a bridge's front face, in the kit
frame (see kit_common): wall face on x = 0, outward +X, centred on the
opening. One unit is 0.40 wide and 0.26 tall inside its frame: two
raked posts (the front leans back toward the foot, so the top stands
further out), a head bar under a sun visor, and a sill ledge. The game
lays units edge to edge across the band, so neighbouring posts read as one
mullion. The glass band behind stays procedural."""

from lib.shapes import box, extrude, hex_linear, loft, make_object, merge

from parts.kit_common import BACK, bar_profile, hbar

UNIT_W = 0.4
POST = 0.022
HEAD = 0.03
SILL = 0.028
APERTURE_H = 0.26
FRONT_LOW = 0.016
FRONT_HIGH = 0.03
APERTURE_W = UNIT_W - 2 * POST


def post(sign):
    """A jamb leaning back at the foot: a loft of two bar sections."""
    z_outer = sign * UNIT_W / 2
    z_inner = sign * (UNIT_W / 2 - POST)
    lo = APERTURE_H / 2 + HEAD
    sections = []
    for y, front in ((-APERTURE_H / 2 - SILL, FRONT_LOW), (APERTURE_H / 2 + HEAD, FRONT_HIGH)):
        prof = [(z_outer + sign * -u, x) for u, x in bar_profile(POST, front, lip=0.006, step=0.008)]
        sections.append((y, [(x, z) for z, x in prof]))
    return loft(sections, axis="y")


def head():
    return hbar(APERTURE_H / 2 + HEAD, APERTURE_H / 2, UNIT_W, FRONT_HIGH, lip=0.006, step=0.008)


def sill():
    y = -APERTURE_H / 2
    profile = [
        (BACK, y), (BACK, y - SILL), (FRONT_LOW + 0.008, y - SILL),
        (FRONT_LOW + 0.014, y - SILL + 0.01), (FRONT_LOW + 0.014, y - 0.004),
        (FRONT_LOW - 0.002, y),
    ]
    return extrude(profile, -UNIT_W / 2, UNIT_W / 2, axis="z")


def visor():
    y = APERTURE_H / 2 + HEAD
    profile = [
        (BACK, y), (0.044, y - 0.004), (0.044, y + 0.008),
        (0.03, y + 0.016), (BACK, y + 0.016),
    ]
    return extrude(profile, -UNIT_W / 2, UNIT_W / 2, axis="z")


def build(dims: dict) -> dict:
    parts = [post(-1), post(1), head(), sill(), visor()]
    return {
        "frame": make_object(
            "frame", merge(parts), hex_linear("#ffffff"),
            roughness=0.5, closed=True, sharp_degrees=35,
        )
    }
