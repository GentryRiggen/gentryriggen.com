"""Plane Builder obstacle: a red gambrel barn, 16 x 12 x 20 m (typical).

Red walls (`hard`), a two-slope gambrel roof of grey metal (`roof`) with
overhanging eaves, and white trim (`trim`): corner boards, a double door with
a cross-brace and a hayloft door at each gable end. Ridge along Z. Slots:
hard, roof, trim."""

from lib.obstaclekit import finish
from lib.shapes import box, extrude, merge

HX, HZ = 8.0, 10.0
EAVE, KNEE, RIDGE = 5.0, 8.6, 12.0
KX = 5.4  # the knee's half width


def walls():
    outline = [(-HX, 0), (HX, 0), (HX, EAVE), (KX, KNEE), (0, RIDGE), (-KX, KNEE), (-HX, EAVE)]
    return extrude(outline, -HZ, HZ, axis="z")


def roof():
    t = 0.45  # slab thickness, and a little overhang past the gables
    top = [(-HX - 0.6, EAVE - 0.5), (-KX - 0.2, KNEE), (0, RIDGE + t), (KX + 0.2, KNEE), (HX + 0.6, EAVE - 0.5)]
    under = [(x, y - t) for x, y in reversed(top)]
    return extrude(top + under, -HZ - 0.8, HZ + 0.8, axis="z")


def bar(x0, y0, x1, y1, z, w=0.3, depth=0.25):
    """A diagonal brace from (x0, y0) to (x1, y1) on the face at z."""
    poly = [(x0 - w, y0), (x0 + w, y0), (x1 + w, y1), (x1 - w, y1)]
    return extrude(poly, z - depth, z + depth, axis="z")


def trim():
    parts = []
    for side in (-1, 1):
        zf = side * HZ
        # Double door with a frame and cross-braces.
        parts += [box(-2.3, 2.6, zf, 0.35, 5.2, 0.5), box(2.3, 2.6, zf, 0.35, 5.2, 0.5),
                  box(0, 5.2, zf, 4.95, 0.35, 0.5), box(0, 2.6, zf, 0.25, 5.2, 0.5)]
        parts += [bar(-2.2, 0.2, 0.0, 5.0, zf), bar(0.0, 0.2, -2.2, 5.0, zf),
                  bar(2.2, 0.2, 0.0, 5.0, zf), bar(0.0, 0.2, 2.2, 5.0, zf)]
        # Hayloft door above.
        parts += [box(0, 8.3, zf, 2.6, 2.4, 0.45)]
        # Corner boards.
        parts += [box(-HX, EAVE / 2, zf, 0.5, EAVE, 0.55), box(HX, EAVE / 2, zf, 0.5, EAVE, 0.55)]
    return merge(parts)


def build(dims: dict) -> dict:
    return finish({"hard": [walls()], "roof": [roof()], "trim": [trim()]}, "meadow")
