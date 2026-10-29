"""Plane Builder obstacle: a storm cloud, 28 x 14 x 28 m (typical).

A towering cumulus: a flat, dark base of squashed puffs under a heap of
lighter lumps, tallest in the middle. Smooth shaded. Slots: storm, storm_dark."""

from lib.obstaclekit import blob, finish

BASE = [(0, 2.2, 0, 12, 2.4, 11), (0, 2.0, 0, 10, 2.2, 10)]
TOP = [(0, 6.4, 0, 8.6, 6.2, 8.6), (-7, 5.0, 2.5, 6.5, 4.2, 6.5), (6.5, 5.0, -2, 6.8, 4.4, 6.5)]


def build(dims: dict) -> dict:
    base = [blob(*p, jitter=0.05, seed=i) for i, p in enumerate(BASE)]
    top = [blob(*p, jitter=0.07, seed=i + 9, subdiv=1) for i, p in enumerate(TOP)]
    return finish({"storm_dark": base, "storm": top}, "storm", smooth=("storm", "storm_dark"))
