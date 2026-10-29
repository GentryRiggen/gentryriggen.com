"""Plane Builder obstacle: a gull in flight, 3 x 2 x 3 m (typical).

Nose along +X, wings along Z held in a shallow V with dark tips, a white
body, head and a yellow beak. The wingspan fills the box's Z width and the
tips reach its top. Slots: bird (dark wings), bird_light (body), beak."""

from lib.obstaclekit import blob, finish
from lib.shapes import extrude, merge


def wing(side):
    """A swept wing: root at the body, tip up and back. (z, y) rise, x sweep."""
    pts = [(0.45, 0.02, 0.2), (-0.7, 0.0, 0.3), (-0.75, 0.3, 1.5), (-0.3, 0.3, 1.5), (0.35, 0.12, 0.8)]
    # A thin slab: top and bottom copies of the outline, `side` picks the wing.
    top = [(x, y + 0.05, z * side) for x, y, z in pts]
    bottom = [(x, y - 0.05, z * side) for x, y, z in pts]
    n = len(pts)
    verts = top + bottom
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    from lib.shapes import outward

    return outward((verts, faces))


def build(dims: dict) -> dict:
    body = blob(0, 0, 0, 0.95, 0.35, 0.38, subdiv=0)
    head = blob(0.95, 0.12, 0, 0.3, 0.26, 0.26, subdiv=0)
    beak = ([(1.18, 0.14, 0.07), (1.18, 0.14, -0.07), (1.18, 0.02, 0.0), (1.5, 0.08, 0.0)], [(0, 1, 2), (0, 3, 1), (1, 3, 2), (2, 3, 0)])
    slots = {
        "bird_light": [body, head],
        "bird": [wing(1), wing(-1)],
        "beak": [beak],
    }
    return finish(slots, "beach")
