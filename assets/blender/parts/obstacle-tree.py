"""Plane Builder obstacle: a tree, 4 x 10 x 4 m (typical), two variants.

- pine: a Scots/stone pine: a bare trunk under a layered, flat-topped crown.
- broadleaf: a round-crowned leafy tree on a short trunk.

The crown fills the box's width, so a graze on the box is a graze on the
leaves. Slots: soft (leaves), trunk."""

import math

from lib.obstaclekit import blob, finish
from lib.shapes import cylinder, lathe, merge, translate


def pine():
    trunk = lathe([(0.0, 0.0), (0.42, 0.0), (0.3, 3.0), (0.16, 6.2), (0.0, 6.2)], 6)
    tiers = []
    # Flat, spreading boughs: wide at the bottom, narrower and higher up.
    for i, (y, r, h) in enumerate([(3.2, 2.0, 1.5), (5.0, 1.75, 1.5), (6.7, 1.3, 1.4), (8.0, 0.8, 1.9)]):
        tiers.append(lathe([(0.0, y), (r, y + 0.0), (r * 0.78, y + h * 0.5), (0.0, y + h)], 8))
    return {"trunk": [trunk], "soft": tiers}


def broadleaf():
    trunk = lathe([(0.0, 0.0), (0.5, 0.0), (0.34, 2.0), (0.26, 4.6), (0.0, 4.6)], 6)
    crown = [
        blob(0.0, 6.0, 0.0, 2.0, 2.3, 2.0, jitter=0.08, seed=1, subdiv=1),
        blob(-0.8, 5.2, 0.3, 1.3, 1.5, 1.3, jitter=0.1, seed=2),
        blob(0.9, 5.4, -0.3, 1.2, 1.4, 1.2, jitter=0.1, seed=3),
        blob(0.0, 7.6, 0.0, 1.4, 1.2, 1.4, jitter=0.1, seed=4),
    ]
    return {"trunk": [trunk], "soft": crown}


def build(dims: dict) -> dict:
    slots = pine() if dims["variant"] == "pine" else broadleaf()
    return finish(slots, "jungle")
