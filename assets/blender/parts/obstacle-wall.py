"""Plane Builder obstacle: a canyon rock wall, 30 x 90 x 12 m (typical).

Eroded sandstone, one skin of rounded rings: a talus slope at the foot, then
beds that bulge and recess (a hard bed overhangs the soft band under it), the
whole face fluted with vertical grooves and split by two cracks that run the
full height. The cross-section is a rounded rectangle, so edges are soft, and
the talus fills the box footprint. Smooth shaded (faceted only at the flutes).
Slots: hard (the beds), soft (talus and recessed bands)."""

from lib.obstaclekit import finish, noise, round_ring, skin

HX, HZ = 15.0, 6.0
N = 10

# (top y, size at the top as a share of the footprint, slot) bottom to top. A
# band whose top is smaller than the one below it leans in; larger, it leans
# out, which is an overhang when the bed is hard.
BANDS = [
    (7, 0.84, "soft"),    # talus slope
    (16, 0.88, "hard"),   # first bed swells
    (26, 0.78, "hard"),   # and narrows into its ledge
    (32, 0.50, "soft"),   # deeply undercut band
    (50, 0.80, "hard"),   # a tall bed that overhangs the band below
    (56, 0.60, "soft"),
    (69, 0.74, "hard"),
    (74, 0.50, "soft"),
    (90, 0.66, "hard"),   # the cap, rounded off
]
# How far each ring's centre sways off the axis (x, z), so the wall leans.
SWAY = [(0, 0), (0.8, 0.2), (-0.6, 0.3), (-1.4, -0.2), (-0.4, -0.3),
        (1.0, 0.2), (1.6, 0.4), (0.9, -0.1), (-0.5, 0.3), (-1.2, 0.0)]

# Per-point groove depth: two cracks (deep) and flutes between.
FLUTE = [0.0, -0.10, 0.04, -0.24, 0.0, -0.09, 0.05, -0.20, 0.02, -0.12]


def ring_at(i, scale, flare):
    """The i-th ring: a rounded rectangle at `scale` of the footprint, swayed,
    its points pushed in by the grooves (more in the recessed bands)."""
    sx, sz = SWAY[i]
    pts = round_ring(sx, sz, HX * scale, HZ * scale, n=N, squareness=2.6)
    out = []
    for j, (x, z) in enumerate(pts):
        k = 1 + FLUTE[j] * flare + 0.05 * noise(i + 3, j)
        out.append((sx + (x - sx) * k, sz + (z - sz) * k))
    return out


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    rings = [(0.0, ring_at(0, 1.0, 0.0))]
    names = []
    for i, (top, scale, name) in enumerate(BANDS, start=1):
        rings.append((float(top), ring_at(i, scale, 1.0 if name == "hard" else 1.6)))
        names.append(name)
    for i, name in enumerate(names):
        last = i == len(names) - 1
        slots[name].append(skin(rings[i:i + 2], cap_top=last))
    return finish(slots, "canyon", smooth=("hard", "soft"), open_slots=("hard", "soft"))
