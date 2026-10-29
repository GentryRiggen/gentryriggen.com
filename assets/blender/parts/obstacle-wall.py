"""Plane Builder obstacle: a canyon rock wall, 30 x 90 x 12 m (typical).

A cliff of uneven strata: a sloping talus foot, then eight layers of different
thickness, every one set back from the one below by a different amount, with
tall `hard` beds and recessed `soft` bands, and two vertical cracks (a step in
the face) that run up the long sides. The talus fills the box footprint, so
the box is what the wall's foot looks like. Slots: hard, soft."""

from lib.obstaclekit import finish, ledge_cap, noise
from lib.shapes import loft, merge

HX, HZ = 15.0, 6.0
CRACK_NEAR, CRACK_FAR = -4.5, 6.5  # x of the cracks on the -z / +z faces


def outline(inset_x, inset_z, seed, crack=0.0):
    """A closed (x, z) outline (8 points), set back from the box by the
    insets, its corners wobbling a little and a step where each crack runs."""
    hx, hz = HX - inset_x, HZ - inset_z
    j = [noise(seed, i) * 0.55 for i in range(8)]
    return [
        (-hx + j[0], -hz + j[1] * 0.4),
        (CRACK_NEAR + j[2], -hz + j[3] * 0.3),
        (CRACK_NEAR + 0.3, -hz + 1.0 + crack),
        (hx + j[4] * 0.5, -hz + 1.0 + crack + j[5] * 0.3),
        (hx + j[6] * 0.5, hz + j[7] * 0.4),
        (CRACK_FAR + 0.3, hz + j[1] * 0.3),
        (CRACK_FAR - 0.1, hz - 1.0 - crack),
        (-hx + j[3] * 0.5, hz - 1.0 - crack + j[5] * 0.3),
    ]


# (top y, set back at the top: x, z, ledge to the next layer: x, z) bottom to
# top. Thick `hard` beds alternate with thin recessed `soft` bands; ledges
# differ from layer to layer, and the 3rd layer overhangs a little.
LAYERS = [
    (12, 3.6, 2.0, 0.3, 0.2),
    (19, 4.8, 2.6, 1.9, 0.7),
    (36, 4.2, 2.1, 0.4, 0.2),
    (43, 6.0, 3.1, 2.2, 0.9),
    (62, 5.4, 2.7, 0.6, 0.3),
    (69, 7.1, 3.3, 1.4, 0.6),
    (90, 6.6, 3.2, 0.0, 0.0),
]


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    y0, prev = 0.0, outline(0.0, 0.0, 0)
    for i, (top, ix, iz, lx, lz) in enumerate(LAYERS):
        upper = outline(ix, iz, i + 1, crack=0.35 * (i % 3))
        layer = [loft([(y0, prev), (top, upper)], axis="y", caps=False)]
        layer.append(ledge_cap(upper, top))
        slots["soft" if i % 2 else "hard"].append(merge(layer))
        y0 = top
        prev = outline(ix + lx, iz + lz, i + 11, crack=0.35 * (i % 3))
    return finish(slots, "canyon", flat=("hard", "soft"), open_slots=("hard", "soft"))
