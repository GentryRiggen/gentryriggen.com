"""Engelhardt collapsible: a shallow flat-bottomed hull with low canvas
sides, tan canvas colour, and the same cover and gunwale."""
from parts.lifeboat_common import build_open


def build(dims):
    return build_open(dims, "collapsible", "#c8b78e", section=3.8, keel_end=0.5)
