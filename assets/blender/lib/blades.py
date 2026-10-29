"""Propeller pieces shared by the propeller and the azipod: a skewed, twisted
blade, a conical boss, and helpers to turn a Y-axis lathe onto the X shaft.
Three.js coordinates (Y-up, shaft along X, bow toward +X)."""

from __future__ import annotations

import math

from lib.shapes import Mesh, lathe, loft, merge, translate

LENS_POINTS = 10
STATIONS = 12


def to_x(mesh: Mesh) -> Mesh:
    """Turn a mesh built about +Y onto +X (a proper rotation, so winding
    holds): the lathe's bottom end becomes the -X end."""
    verts, faces = mesh
    return [(y, -x, z) for x, y, z in verts], faces


def rot_x(mesh: Mesh, angle: float) -> Mesh:
    """Rotate about +X, carrying +Y toward +Z."""
    verts, faces = mesh
    c, s = math.cos(angle), math.sin(angle)
    return [(x, y * c - z * s, y * s + z * c) for x, y, z in verts], faces


def blade(
    root: float,
    tip: float,
    chord: float,
    thick: float,
    pitch_root: float = 0.95,
    pitch_tip: float = 0.4,
    skew: float = 0.35,
    rake: float = 0.08,
) -> Mesh:
    """One blade standing along +Y from `root` to `tip` radius. Width tapers
    in from the widest point (about 60% out) to a round tip, the section
    turns from steep at the root to shallow at the tip (the helical face),
    and the outline sweeps back (skew) and leans astern (rake)."""
    sections = []
    span = tip - root
    for i in range(STATIONS):
        t = i / (STATIONS - 1)
        r = root + span * t
        # Narrow at the root, widest near 60%, a quarter-ellipse to the tip.
        if t < 0.6:
            c = chord * (0.5 + 0.5 * math.sin(t / 0.6 * math.pi / 2))
        else:
            c = chord * math.sqrt(max(0.0, 1 - ((t - 0.6) / 0.4) ** 2 * 0.97))
        c = max(c, chord * 0.12)
        th = thick * (1 - 0.6 * t)
        phi = pitch_root + (pitch_tip - pitch_root) * t
        sk = skew * chord * t * t
        rk = -rake * t
        prof = []
        for k in range(LENS_POINTS):
            a = 2 * math.pi * k / LENS_POINTS
            u = 0.5 * c * math.cos(a)
            # The back (+X side) is fuller than the flat face.
            n = 0.5 * th * math.sin(a) * (1.0 if math.sin(a) > 0 else 0.5)
            x = u * math.sin(phi) + n * math.cos(phi) + rk
            z = u * math.cos(phi) - n * math.sin(phi) - sk
            prof.append((x, z))
        sections.append((r, prof))
    return loft(sections, axis="y")


def boss(radius: float, length: float, tip_radius: float = 0.0) -> Mesh:
    """A conical boss on the X shaft, centred on x=0, tapering to the -X end
    (astern) with a rounded cap, blunt toward the bow."""
    h = length / 2
    profile = [
        (0.0, -h),
        (radius * 0.28, -h * 0.97),
        (radius * 0.5 + tip_radius, -h * 0.75),
        (radius * 0.78, -h * 0.35),
        (radius * 0.98, 0.0),
        (radius, h * 0.45),
        (radius * 0.9, h * 0.85),
        (radius * 0.6, h),
        (0.0, h),
    ]
    return to_x(lathe(profile, 16))


def propeller(
    radius: float,
    blades: int,
    chord: float,
    hub_radius: float,
    hub_length: float,
    thick: float,
    x: float = 0.0,
    **kw,
) -> Mesh:
    """Boss plus `blades` blades around the X shaft, centred at x."""
    b = blade(hub_radius * 0.6, radius, chord, thick, **kw)
    parts = [boss(hub_radius, hub_length)]
    parts += [rot_x(b, 2 * math.pi * i / blades) for i in range(blades)]
    return translate(merge(parts), x, 0.0, 0.0)


def foil(xle: float, xte: float, thick: float, n: int = 14) -> list[tuple[float, float]]:
    """A closed streamlined section in (x, z): rounded nose at `xle`, thin
    tail at `xte`, `thick` at the fattest point (30% back). 2*n points."""
    chord = xle - xte
    pts = []
    for side in (1.0, -1.0):
        for k in range(n):
            f = k / n if side > 0 else 1 - (k + 1) / n  # nose -> tail -> nose
            yt = 5 * 0.12 * (0.2969 * math.sqrt(f) - 0.1260 * f - 0.3516 * f**2
                             + 0.2843 * f**3 - 0.1015 * f**4) * thick / 0.12
            pts.append((xle - f * chord, side * max(yt, 0.0035)))
    return pts
