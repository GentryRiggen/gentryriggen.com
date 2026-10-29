"""A stack of three slatted wooden cargo crates, in three.js coordinates
(Y up, origin on the deck at the footprint centre): two crates side by side
with a third resting across them, each a little askew. Every crate is a dark
frame (corner posts, top and bottom battens, a diagonal brace on each long
face) round a core, clad with horizontal planks that leave dark gaps between
them, and a plank lid."""

import math

from lib.shapes import box, hex_linear, make_object, merge, rotate_y, translate

SIDE = 0.34
POST = 0.036  # corner post section
PLANK_T = 0.014  # how far the planks stand proud of the core
GAP = 0.012

# (x, y centre, z), yaw radians: the old stack's spots.
SPOTS = [((-0.10, 0.17, -0.20), 0.21), ((-0.10, 0.17, 0.20), -0.15), ((-0.10, 0.51, 0.0), 0.10)]


def crate():
    """(planks, frame) meshes for one crate centred on the origin."""
    h = SIDE / 2
    planks, frame = [], []
    frame.append(box(0, 0, 0, SIDE - 0.05, SIDE - 0.05, SIDE - 0.05))  # dark core
    # Corner posts, a touch proud of the planks.
    for sx in (-1, 1):
        for sz in (-1, 1):
            frame.append(box(sx * (h - POST / 2), 0, sz * (h - POST / 2), POST, SIDE, POST))
    # Top and bottom battens round the sides, 4 long ones each.
    for y in (-h + 0.02, h - 0.02):
        for s in (-1, 1):
            frame.append(box(0, y, s * (h - 0.006), SIDE, 0.04, 0.026))
            frame.append(box(s * (h - 0.006), y, 0, 0.026, 0.04, SIDE))
    # Planks on the four sides: three boards between the battens.
    board = (SIDE - 0.08 - 2 * GAP) / 3
    for k in range(3):
        y = -h + 0.04 + board / 2 + k * (board + GAP)
        for s in (-1, 1):
            planks.append(box(0, y, s * (h - 0.012), SIDE - 2 * POST, board, 0.026))
            planks.append(box(s * (h - 0.012), y, 0, 0.026, board, SIDE - 2 * POST))
    # Lid: five planks across the top.
    lid = (SIDE - 0.02 - 4 * GAP) / 5
    for k in range(5):
        x = -h + 0.01 + lid / 2 + k * (lid + GAP)
        planks.append(box(x, h + 0.005, 0, lid, 0.022, SIDE - 0.02))
    # A diagonal brace across each long face, standing proud of the planks.
    ang = math.atan2(SIDE - 0.1, SIDE - 0.1)
    for s in (-1, 1):
        brace = box(0, 0, 0, 0.032, (SIDE - 0.08) * math.sqrt(2) * 0.96, 0.012)
        verts, faces = brace
        c, sn = math.cos(ang), math.sin(ang)
        brace = ([(x * c - y * sn, x * sn + y * c, z) for x, y, z in verts], faces)
        frame.append(translate(brace, 0, 0, s * (h + 0.004)))
    return planks, frame


def build(dims):
    planks, frame = [], []
    for (x, y, z), yaw in SPOTS:
        p, f = crate()
        planks.append(translate(rotate_y(merge(p), yaw), x, y, z))
        frame.append(translate(rotate_y(merge(f), yaw), x, y, z))
    return {
        "wood": make_object("wood", merge(planks), hex_linear("#9a6b3f"), roughness=0.85, closed=True, sharp_degrees=30),
        "frame": make_object("frame", merge(frame), hex_linear("#5a3a22"), roughness=0.85, closed=True, sharp_degrees=30),
    }
