"""A helicopter landing pad over a 2x2 of deck, in three.js coordinates (Y up,
origin at the centre on the deck): a slab with softly rounded edges, a white
landing circle and an H inside it, a white keep-clear band round the edge and
a small corner light at each corner. Slots: `pad` (takes paint), `marking`."""

import math

from lib.shapes import box, hex_linear, lathe, make_object, merge, rounded_box, translate

TOP = 0.15
MARK = 0.011


def ring(r_in, r_out, y):
    return lathe([(r_in, y), (r_out, y), (r_out, y + MARK), (r_in, y + MARK), (r_in, y)], 36)


def pad():
    parts = [rounded_box((0, TOP / 2, 0), (1.9, TOP, 1.9), 0.03, 1)]
    for sx in (-1, 1):
        for sz in (-1, 1):
            # Corner light housings, flush with the slab.
            parts.append(lathe([(0.0, TOP), (0.04, TOP), (0.04, TOP + 0.01), (0.0, TOP + 0.014)], 8))
            parts[-1] = translate(parts[-1], sx * 0.86, 0, sz * 0.86)
    return parts


def marking():
    y = TOP
    parts = [ring(0.78, 0.84, y)]
    for z in (-0.32, 0.32):
        parts.append(box(0, y + MARK / 2, z, 0.9, MARK, 0.12))
    parts.append(box(0, y + MARK / 2, 0, 0.12, MARK, 0.52))
    # Keep-clear band round the edge (four strips).
    for s in (-1, 1):
        parts.append(box(0, y + MARK / 2, s * 0.9, 1.78, MARK, 0.04))
        parts.append(box(s * 0.9, y + MARK / 2, 0, 0.04, MARK, 1.78))
    return parts


def build(dims):
    return {
        "pad": make_object("pad", merge(pad()), hex_linear("#5d666d"), roughness=0.8, sharp_degrees=35),
        "marking": make_object("marking", merge(marking()), hex_linear("#f3efe4"), roughness=0.7, sharp_degrees=35),
    }
