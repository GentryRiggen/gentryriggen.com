"""Plane Builder obstacle: a natural rock arch, 12 x 40 x 16 m (typical).

An upside-down U of eroded sandstone: two legs that flare into a talus foot,
their inner faces curving together into the opening, under a thick lintel that
narrows to a rounded top. The opening runs side to side (along Z), so from the
flight line (along X) it is a solid wall the size of its collision box. Every
part is a skin of rounded rings (soft edges, swaying, grooved by cracks), the
legs and the lintel overlapping where they meet. Slots: hard, soft."""

import math

from lib.obstaclekit import finish, noise, round_ring, skin

HZ = 8.0
OPEN_Y = 23.0  # where the opening closes
OPEN_HALF = 3.4
N = 8


def opening_half(y):
    """Half width of the opening at height y: a pointed-round arch."""
    if y >= OPEN_Y:
        return 0.0
    return OPEN_HALF * math.sqrt(max(0.0, 1 - (y / OPEN_Y) ** 3.2))


# (y, outer edge, hz share): the leg's outline rings. The inner edge follows
# the opening; the ledge steps are the changes of the outer edge.
LEG = [(0.0, 6.6, 1.0), (8.0, 5.8, 0.92), (15.0, 5.2, 0.95), (20.0, 4.7, 0.86),
       (23.0, 4.4, 0.9), (24.6, 4.2, 0.94)]
# (y, half width, hz share) of the lintel, narrowing to a rounded top.
LINTEL = [(18.5, 4.8, 0.9), (29.0, 4.2, 1.0), (35.0, 3.6, 0.88), (40.0, 3.0, 0.78)]
FLUTE = [0.0, -0.12, 0.03, -0.2, 0.0, -0.1, 0.04, -0.16]


def ring(cx, hx, hz, seed, flare=1.0):
    pts = round_ring(cx, 0.0, hx, hz, n=N, squareness=2.6)
    return [(cx + (x - cx) * k, z * k)
            for j, (x, z) in enumerate(pts)
            for k in [1 + FLUTE[j] * flare + 0.05 * noise(seed, j)]]


def leg_rings(side):
    rings = []
    for i, (y, outer, share) in enumerate(LEG):
        inner = max(opening_half(y), 0.0) if y < OPEN_Y else -0.3
        inner = inner if y < 24 else -0.3
        hx = (outer - inner) / 2
        rings.append((y, ring(side * (outer + inner) / 2, hx, HZ * share, i + 5 * side)))
    return rings


def build(dims: dict) -> dict:
    slots = {"hard": [], "soft": []}
    for side in (-1, 1):
        rings = leg_rings(side)
        # The foot band is the talus (soft); the beds above are hard, and the
        # band under the crown is soft again.
        for i in range(len(rings) - 1):
            name = "soft" if i in (0, 3) else "hard"
            slots[name].append(skin(rings[i:i + 2]))
    lintel = [(y, ring(0.0, hx, HZ * share, 30 + i, 0.8))
              for i, (y, hx, share) in enumerate(LINTEL)]
    for i in range(len(lintel) - 1):
        slots["soft" if i == 1 else "hard"].append(skin(lintel[i:i + 2], cap_top=i == len(lintel) - 2))
    return finish(slots, "canyon", smooth=("hard", "soft"), open_slots=("hard", "soft"))
