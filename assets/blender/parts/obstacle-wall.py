"""Plane Builder obstacle: a canyon rock wall, 30 x 90 x 12 m (typical).

A cliff of alternating strata: tall, bulging `hard` beds and recessed `soft`
bands, every layer tapering a little so each ledge catches light. The lowest
bed fills the box footprint, so the slab silhouette is the collision box.
Slots: hard, soft."""

from lib.obstaclekit import finish
from lib.shapes import loft

HX, HZ = 15.0, 6.0


def outline(inset_x, inset_z, skew, seed):
    hx, hz = HX - inset_x, HZ - inset_z
    j = [((seed * 7 + i * 5) % 7 - 3) * 0.2 for i in range(8)]
    return [
        (-hx + skew, -hz + j[0]), (-hx * 0.35 + skew * 0.6, -hz * 0.92 + j[1]),
        (hx * 0.3 + skew * 0.4, -hz + j[2]), (hx + skew * 0.2, -hz * 0.9 + j[3]),
        (hx - j[4], hz * 0.2), (hx * 0.4, hz + j[5] * 0.4),
        (-hx * 0.3, hz * 0.9 + j[6]), (-hx - j[7], hz * 0.5),
    ]


# (top y, inset x, inset z, skew, taper) per layer, bottom to top; the odd
# layers are the recessed soft bands.
LAYERS = [
    (14, 0.0, 0.0, 0.0), (21, 1.8, 1.0, 0.6), (37, 0.5, 0.2, -0.8),
    (44, 2.6, 1.3, 0.4), (62, 1.6, 0.6, 1.0), (69, 3.4, 1.7, -0.6),
    (90, 3.6, 1.4, -1.0),
]


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    y0, prev = 0.0, outline(0.0, 0.0, 0.0, 0)
    for i, (top, ix, iz, skew) in enumerate(LAYERS):
        upper = outline(ix + 0.5, iz + 0.25, skew, i + 1)
        lower = prev if i == 0 else outline(*LAYERS[i - 1][1:], i)
        layer = loft([(y0, lower), (top, upper)], axis="y")
        slots["soft" if i % 2 else "hard"].append(layer)
        y0, prev = top, upper
    return finish(slots, "canyon", flat=("hard", "soft"))
