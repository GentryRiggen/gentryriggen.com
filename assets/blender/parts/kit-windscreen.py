"""A raked wheelhouse windscreen unit for a bridge's front face, in the kit
frame (see kit_common): wall face on x = 0, outward +X, centred on the
opening. One unit is 0.40 wide and 0.26 tall inside its frame: a frame
whose front leans (the top stands further out than the foot), and a sun
visor over the head; 36 triangles. The game lays units edge to edge across
the band, so neighbouring posts read as one mullion. The glass band behind
stays procedural."""

from lib.shapes import extrude, hex_linear, make_object, merge

from parts.kit_common import BACK, frame_ring

UNIT_W = 0.4
POST = 0.022
HEAD = 0.03
SILL = 0.028
APERTURE_H = 0.26
FRONT_LOW = 0.016
FRONT_HIGH = 0.03
LIP = 0.006
Y_LOW = -APERTURE_H / 2 - SILL
Y_HIGH = APERTURE_H / 2 + HEAD


def rake(y):
    return FRONT_LOW + (FRONT_HIGH - FRONT_LOW) * (y - Y_LOW) / (Y_HIGH - Y_LOW)


def frame():
    return frame_ring(
        (-UNIT_W / 2, UNIT_W / 2, Y_LOW, Y_HIGH),
        (-UNIT_W / 2 + POST, UNIT_W / 2 - POST, -APERTURE_H / 2, APERTURE_H / 2),
        rake,
        lambda y: rake(y) - LIP,
    )


def visor():
    y = Y_HIGH
    profile = [(BACK, y), (0.044, y - 0.004), (0.044, y + 0.008), (0.03, y + 0.016), (BACK, y + 0.016)]
    return extrude(profile, -UNIT_W / 2, UNIT_W / 2, axis="z")


def build(dims: dict) -> dict:
    return {
        "frame": make_object(
            "frame", merge([frame(), visor()]), hex_linear("#ffffff"),
            roughness=0.5, closed=False, sharp_degrees=35,
        )
    }
