"""Plane Builder obstacle: a hot-air balloon, 5 x 6 x 5 m (typical).

A round envelope in alternating coloured gores (`soft` and white `trim`) with
a `hard` skirt, four ropes (`string`) down to a wicker `basket`. Slots: soft,
hard, trim, string, basket."""

import math

from lib.obstaclekit import finish
from lib.shapes import box, lathe, tube

SEG = 12


def split(mesh, parity):
    """The lathe faces of every other gore (faces come in rows of SEG)."""
    verts, faces = mesh
    keep = [f for k, f in enumerate(faces) if (k % SEG) % 2 == parity]
    used = sorted({i for f in keep for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return [verts[i] for i in used], [tuple(remap[i] for i in f) for f in keep]


def build(dims: dict) -> dict:
    # Envelope: a pear, widest above the middle, necked in to the skirt.
    prof = [(0.45, 2.1), (1.2, 2.3), (2.0, 3.0), (2.5, 4.0), (2.3, 5.0),
            (1.5, 5.8), (0.0, 6.2)]
    prof = [(r, y) for r, y in prof]
    envelope = lathe(prof, SEG)
    skirt = lathe([(0.55, 1.5), (0.65, 1.5), (0.5, 2.1), (0.45, 2.1)], SEG)
    ropes = [
        tube([(0.7 * sx, 2.0, 0.7 * sz), (0.4 * sx, 0.7, 0.4 * sz)], 0.04, 3)
        for sx in (-1, 1) for sz in (-1, 1)
    ]
    basket = box(0, 0.3, 0, 1.0, 0.8, 1.0)
    slots = {
        "soft": [split(envelope, 0)],
        "trim": [split(envelope, 1)],
        "hard": [skirt],
        "string": ropes,
        "basket": [basket],
    }
    return finish(slots, "meadow", open_slots=("soft", "trim"))
