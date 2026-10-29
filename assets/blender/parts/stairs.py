"""A ship's companion ladder: five treads with rounded nosings climbing
toward +X, a sawtooth stringer plank down each side, and a handrail on posts
with a lower mid rail. Three.js coordinates (Y-up, origin at the footprint
centre on the floor). The top tread is level with the deck the stairs lead
to, and each tread's top matches the straight ramp people walk, so the
heights are the same as the old boxy flight."""

from lib.shapes import extrude, hex_linear, make_object, merge, rounded_box, translate, tube

STEPS = 5
LEVEL = 1.0  # one level's height (LEVEL_HEIGHT)
DEPTH = 0.9
WIDTH = 0.8
RUN = DEPTH / STEPS
RISE = LEVEL / STEPS
TREAD_T = 0.03
STRINGER_Z0, STRINGER_Z1 = 0.33, 0.385
POST_Z = 0.358
SLOPE = (LEVEL - RISE) / (DEPTH - RUN)  # rise per metre along the nosing line


def x_front(i: int) -> float:
    return -DEPTH / 2 + RUN * i


def nosing_y(x: float) -> float:
    return RISE + (x + DEPTH / 2) * SLOPE


def tread_top(x: float) -> float:
    i = min(STEPS - 1, max(0, int((x + DEPTH / 2) / RUN)))
    return RISE * (i + 1)


def steps():
    parts = []
    for i in range(STEPS):
        top = RISE * (i + 1)
        tread = rounded_box((0, 0, 0), (RUN + 0.025, TREAD_T, 2 * STRINGER_Z0 + 0.04), 0.01, 2)
        parts.append(translate(tread, x_front(i) + RUN / 2 - 0.0125, top - TREAD_T / 2, 0.0))
    # Stringer: a sloped plank below, stepped on top to carry the treads.
    left = -DEPTH / 2
    pts = [(left, 0.0), (left + 0.14, 0.0), (DEPTH / 2, LEVEL - 0.14), (DEPTH / 2, LEVEL - TREAD_T)]
    for i in reversed(range(STEPS)):
        top = RISE * (i + 1) - TREAD_T
        pts.append((x_front(i + 1), top))
        pts.append((x_front(i), top))
    pts = [p for k, p in enumerate(pts) if k == 0 or p != pts[k - 1]]
    for s in (-1, 1):
        z0, z1 = sorted((s * STRINGER_Z0, s * STRINGER_Z1))
        parts.append(extrude(pts, z0, z1, axis="z"))
    return parts


def railing():
    parts = []
    x0, x1 = -DEPTH / 2 + 0.05, DEPTH / 2 - 0.05
    for s in (-1, 1):
        z = s * POST_Z
        # The hand rail and a lower rail, parallel to the nosing line.
        for lift, radius in ((0.21, 0.018), (0.1, 0.01)):
            parts.append(tube([(x0, nosing_y(x0) + lift, z), (x1, nosing_y(x1) + lift, z)], radius, 8))
        for x in (x0, 0.0, x1):
            parts.append(tube([(x, tread_top(x) - 0.01, z), (x, nosing_y(x) + 0.21, z)], 0.013, 8))
        # Knobs on the rail's high end.
        parts.append(tube([(x1, nosing_y(x1) + 0.21, z), (x1 + 0.03, nosing_y(x1 + 0.03) + 0.21, z)], 0.022, 8))
    return parts


COLORS = {"steps": "#d9d2bf", "railing": "#f3efe4"}
METAL = {"railing": 0.6}


def build(dims: dict) -> dict:
    groups = {"steps": steps(), "railing": railing()}
    return {
        name: make_object(
            name, merge(parts), hex_linear(COLORS[name]),
            metallic=METAL.get(name, 0.0), roughness=0.55, closed=True, sharp_degrees=40,
        )
        for name, parts in groups.items()
    }
