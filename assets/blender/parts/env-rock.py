"""A sea stack or skerry: layered rock in stepped strata, with a wet dark
band where the swell washes it. Three shapes, picked in game by the
obstacle's id: a tall stack, a low tilted skerry with a sister boulder, and
a pair of stacks. All stand on the waterline (y = 0) and reach 0.5 below it,
inside the radius-1 footprint the collision circle is scaled from."""
import math
import random

from lib.envkit import harmonics, skin
from lib.shapes import hex_linear, make_object, merge

N = 14
WET_TOP = 0.14


def stack(cx, cz, rx, rz, tiers, seed, *, tilt=0.0, peak=0.06, lean=(0.0, 0.0)):
    """One stack as {slot: mesh}. `tiers` is [(y, scale, slot of the band that
    ends at this ring)]; two rings at one height make a ledge. Cliffs are
    straight (one wobble per angle for every tier); strata dip by `tilt`."""
    rng = random.Random(seed)
    wob = harmonics(seed, 4)
    angle_noise = [rng.uniform(-0.1, 0.1) for _ in range(N)]
    top_y = tiers[-1][0]
    rings = []
    for y, scale, _ in tiers:
        lift = (y + 0.5) / (tiers[-1][0] + 0.5)
        ring = []
        twist = rng.uniform(-0.12, 0.12) if y > -0.4 else 0.0
        for j in range(N):
            a = 2 * math.pi * j / N
            r = scale * (1 + 0.22 * wob(a) + angle_noise[j] + rng.uniform(-0.09, 0.09))
            x = cx + lean[0] * lift + rx * r * math.cos(a + twist)
            z = cz + lean[1] * lift + rz * r * math.sin(a + twist)
            dy = rng.uniform(-0.05, 0.05) if -0.4 < y < top_y else 0.0
            ring.append((x, y + dy + tilt * (x - cx) if y > -0.4 else y, z))
        rings.append(ring)
    bands: dict[str, list] = {}
    for k in range(1, len(tiers)):
        bands.setdefault(tiers[k][2], []).append(skin(rings[k - 1 : k + 1]))
    top = tiers[-1]
    cap = skin(rings[-1:] + rings[-1:], last_cap=(cx + lean[0], top[0] + peak, cz + lean[1]))
    # The two identical rings make a zero-height band; keep only the cap fan.
    verts, faces = cap
    fan = [f for f in faces if len(f) == 3]
    bands.setdefault(top[2], []).append((verts, fan))
    return bands


def combine(*stacks):
    out: dict[str, list] = {}
    for s in stacks:
        for slot, meshes in s.items():
            out.setdefault(slot, []).extend(meshes)
    return out


TALL = [(-0.5, 1.0, None), (-0.1, 1.02, "wet"), (WET_TOP, 0.98, "wet"), (WET_TOP, 0.92, "rock"),
        (0.4, 0.9, "rock"), (0.4, 0.82, "layer"), (0.66, 0.8, "layer"), (0.66, 0.72, "rock"),
        (0.95, 0.6, "rock")]
LOW = [(-0.5, 1.0, None), (-0.1, 1.04, "wet"), (WET_TOP, 1.0, "wet"), (WET_TOP, 0.94, "rock"),
       (0.3, 0.9, "rock"), (0.3, 0.8, "layer"), (0.5, 0.66, "layer")]
SMALL = [(-0.5, 1.0, None), (-0.1, 1.04, "wet"), (WET_TOP, 1.0, "wet"), (WET_TOP, 0.9, "layer"),
         (0.3, 0.7, "layer")]
PAIR_HI = [(-0.5, 1.0, None), (-0.1, 1.02, "wet"), (WET_TOP, 0.98, "wet"), (WET_TOP, 0.9, "rock"),
           (0.45, 0.84, "rock"), (0.45, 0.74, "layer"), (0.9, 0.52, "layer")]
PAIR_LO = [(-0.5, 1.0, None), (-0.1, 1.04, "wet"), (WET_TOP, 1.0, "wet"), (WET_TOP, 0.9, "layer"),
           (0.34, 0.84, "layer"), (0.34, 0.7, "rock"), (0.6, 0.5, "rock")]


def build(dims):
    shape = int(dims.get("shape", 0))
    if shape == 0:
        parts = stack(0.05, -0.02, 0.8, 0.72, TALL, 5, lean=(0.05, 0.0))
    elif shape == 1:
        parts = combine(
            stack(-0.1, -0.1, 0.9, 0.78, LOW, 8, tilt=0.14),
            stack(0.58, 0.5, 0.36, 0.34, SMALL, 9, tilt=-0.1),
        )
    else:
        parts = combine(
            stack(-0.32, -0.12, 0.6, 0.55, PAIR_HI, 13, lean=(-0.06, 0.0)),
            stack(0.42, 0.28, 0.5, 0.46, PAIR_LO, 14, lean=(0.04, 0.02)),
        )
    colors = {"rock": "#7b7f86", "layer": "#5d6168", "wet": "#34383e"}
    return {
        slot: make_object(slot, merge(parts[slot]), hex_linear(colors[slot]),
                          roughness=0.9, sharp_degrees=2)
        for slot in ("rock", "layer", "wet")
        if slot in parts
    }
