"""A pirate treasure chest, in three.js coordinates (Y up, origin on the deck
at the footprint centre, lock on the +Z face): a planked body, a vaulted lid
whose arch is a squashed half circle along X, two gold-iron straps that wrap
over the lid and down the body, corner brackets, a lock plate with a
keyhole , and an iron handle at each end."""

import math

from lib.deckkit import rot_x
from lib.shapes import box, extrude, hex_linear, make_object, merge, rounded_box, translate

LEN, WID = 0.50, 0.32
BODY_H = 0.24
LID_R = WID / 2  # arch half width
LID_H = 0.16  # arch rise above the body


def arch(width_scale=1.0, extra=0.0, steps=10):
    """Closed lid cross-section in (z, y): a half ellipse over a flat base."""
    hw = LID_R * width_scale + extra
    rise = LID_H + extra
    pts = []
    for i in range(steps + 1):
        a = math.pi * i / steps  # from +z side over the top to -z side
        pts.append((hw * math.cos(a), BODY_H + rise * math.sin(a)))
    return pts


def wood():
    parts = []
    parts.append(rounded_box((0, BODY_H / 2, 0), (LEN, BODY_H, WID), 0.02, 1))
    # Plank seams read through AO: two grooves are modelled as shallow ridges.
    for y in (0.08, 0.16):
        parts.append(box(0, y, WID / 2 + 0.001, LEN - 0.01, 0.008, 0.006))
    parts.append(extrude(arch(1.0), -LEN / 2, LEN / 2, axis="x"))
    return parts


def gold():
    parts = []
    for x in (-0.17, 0.17):
        parts.append(box(x, BODY_H / 2, 0, 0.044, BODY_H + 0.004, WID + 0.02))
        parts.append(extrude(arch(1.0, 0.012), x - 0.022, x + 0.022, axis="x"))
    # Lid edge band and body base band.
    parts.append(box(0, BODY_H - 0.005, WID / 2 + 0.006, LEN + 0.01, 0.026, 0.014))
    parts.append(box(0, 0.015, WID / 2 + 0.004, LEN + 0.01, 0.03, 0.01))
    parts.append(box(0, BODY_H - 0.005, -WID / 2 - 0.006, LEN + 0.01, 0.026, 0.014))
    # Corner brackets at the four lower corners.
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(box(sx * (LEN / 2 + 0.003), 0.03, sz * (WID / 2 - 0.02), 0.012, 0.07, 0.05))
            parts.append(box(sx * (LEN / 2 - 0.02), 0.03, sz * (WID / 2 + 0.003), 0.05, 0.07, 0.012))
    # Lock plate straddling the seam, and a studded top ridge.
    parts.append(box(0, BODY_H, WID / 2 + 0.012, 0.085, 0.13, 0.02))
    parts.append(box(0, BODY_H + 0.07, WID / 2 - 0.01, 0.05, 0.03, 0.02))
    # A handle loop on each end.
    for sx in (-1, 1):
        ex = sx * (LEN / 2)
        parts.append(box(ex + sx * 0.038, 0.16, 0, 0.014, 0.022, 0.11))
        for sz in (-1, 1):
            parts.append(box(ex + sx * 0.02, 0.16, sz * 0.055, 0.04, 0.022, 0.016))
    return parts


def dark():
    # A keyhole in the lock plate.
    return [box(0, BODY_H + 0.005, WID / 2 + 0.023, 0.014, 0.034, 0.004),
            box(0, BODY_H + 0.03, WID / 2 + 0.023, 0.024, 0.02, 0.004)]


def build(dims):
    return {
        "wood": make_object("wood", merge(wood()), hex_linear("#5a3a22"), roughness=0.85, sharp_degrees=35),
        "gold": make_object("gold", merge(gold()), hex_linear("#e8b923"), metallic=0.85, roughness=0.4, sharp_degrees=35),
        "keyhole": make_object("keyhole", merge(dark()), hex_linear("#1c1c1f"), roughness=0.9),
    }
