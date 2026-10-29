"""Shared builders for the lifeboat family: a double-ended open boat with
sheer, a hollow clinker-look hull, gunwale caps, rubbing strakes, thwarts and
a canvas cover. Three.js coordinates (Y up, bow +X, starboard +Z), origin at
the boat's attach point (the rim amidships hangs at `rim_y` below it)."""

from __future__ import annotations

import math

from lib.shapes import box, extrude, loft, merge, tube, Mesh


def _sp(v: float, e: float) -> float:
    """Signed power."""
    return math.copysign(abs(v) ** e, v)


class OpenBoat:
    def __init__(self, length, half_beam, depth, rim_y, sheer, *, keel_end=0.2,
                 section=2.7, cap_w=0.016, wall=0.012, cover_h=0.08,
                 stations=17, cover_span=(-0.7, 0.68)):
        self.L, self.depth, self.rim_y, self.sheer = length, depth, rim_y, sheer
        self.keel_end, self.section = keel_end, section
        self.cap_w, self.wall, self.cover_h = cap_w, wall, cover_h
        self.W = half_beam - 0.01  # the cap and strake stand 0.01 proud
        self.n = stations
        self.cover_span = cover_span

    # --- plan, sheer and keel -------------------------------------------
    def x(self, s):
        return s * self.L / 2

    def half(self, s):
        return max(0.006, self.W * (1 - abs(s) ** 2.3) ** 0.8)

    def rim(self, s):
        return self.rim_y + self.sheer * s * s

    def keel(self, s):
        return self.depth * (1 - (1 - self.keel_end) * abs(s) ** 2)

    def thick(self, s):
        return min(self.wall, 0.4 * self.half(s))

    def _stations(self):
        return [-1 + 2 * i / (self.n - 1) for i in range(self.n)]

    # --- parts ----------------------------------------------------------
    def hull(self, k: int = 8) -> Mesh:
        secs = []
        for s in self._stations():
            w, r, d, th = self.half(s), self.rim(s), self.keel(s), self.thick(s)
            e = 2 / self.section
            outer = [(_sp(w * math.cos(math.pi - math.pi * i / k), 1) if False else
                      w * _sp(math.cos(math.pi - math.pi * i / k), e),
                      r - d * abs(math.sin(math.pi * i / k)) ** e)
                     for i in range(k + 1)]
            wi, di = max(0.002, w - th), max(0.05, d - th * 1.2)
            inner = [(wi * _sp(math.cos(math.pi * i / k), e),
                      r - di * abs(math.sin(math.pi * i / k)) ** e)
                     for i in range(k + 1)]
            secs.append((self.x(s), outer + inner))
        return loft(secs, "x")

    def caps(self) -> Mesh:
        """Wooden gunwale caps along both rims."""
        out = []
        for side in (-1, 1):
            secs = []
            for s in self._stations():
                w, r, th = self.half(s), self.rim(s), self.thick(s)
                c = side * (w - th / 2 + 0.002)
                hw = th / 2 + 0.008
                secs.append((self.x(s), [(c - hw, r - 0.004), (c + hw, r - 0.004),
                                         (c + hw, r + 0.012), (c - hw, r + 0.012)]))
            out.append(loft(secs, "x"))
        return merge(out)

    def strakes(self, frac=0.32) -> Mesh:
        """Rubbing strakes standing proud of the planking."""
        out = []
        e = 2 / self.section
        for side in (-1, 1):
            secs = []
            for s in self._stations():
                s = max(-0.93, min(0.93, s))
                w, r, d = self.half(s), self.rim(s), self.keel(s)
                lev = frac ** (1 / e)  # |sin| giving this depth fraction
                z = side * w * _sp(math.sqrt(max(0.0, 1 - lev * lev)), e)
                y = r - d * frac
                a, b = (z - side * 0.002, z + side * 0.011)
                secs.append((self.x(s), [(min(a, b), y - 0.008), (max(a, b), y - 0.008),
                                         (max(a, b), y + 0.008), (min(a, b), y + 0.008)]))
            out.append(loft(secs, "x"))
        return merge(out)

    def thwarts(self, positions) -> Mesh:
        out = []
        for s in positions:
            w, r, th = self.half(s), self.rim(s), self.thick(s)
            out.append(box(self.x(s), r - 0.055, 0.0, 0.04, 0.012, 2 * (w - th)))
        return merge(out)

    def cover_stations(self):
        a, b = self.cover_span
        return [a + (b - a) * i / 8 for i in range(9)]

    def _cover_amp(self, s):
        a, b = self.cover_span
        u = (s - a) / (b - a)  # 0..1
        return self.cover_h * (0.28 + 0.72 * math.sin(math.pi * u) ** 0.6)

    def cover(self, k: int = 8) -> Mesh:
        secs = []
        for s in self.cover_stations():
            w, r, amp = self.half(s), self.rim(s) + 0.008, self._cover_amp(s)
            cw = w * 0.9
            outer = [(cw * math.cos(math.pi - math.pi * i / k),
                      r + amp * math.sin(math.pi * i / k)) for i in range(k + 1)]
            inner = [(cw * math.cos(math.pi * i / k),
                      r + max(0.0, amp - 0.008) * math.sin(math.pi * i / k))
                     for i in range(k + 1)]
            secs.append((self.x(s), outer + inner))
        return loft(secs, "x")

    def ridge(self) -> Mesh:
        pts = [(self.x(s), self.rim(s) + 0.008 + self._cover_amp(s) + 0.004, 0.0)
               for s in self.cover_stations()]
        return tube(pts, 0.007, 6)


# --- small mesh transforms and sweeps used by the other boat parts ----------


def xf(mesh: Mesh, *, rz=0.0, scale=(1.0, 1.0, 1.0), move=(0.0, 0.0, 0.0)) -> Mesh:
    """Scale, then rotate about Z by rz, then move. Faces keep their winding
    (call outward() after a mirror)."""
    c, s = math.cos(rz), math.sin(rz)
    out = []
    for x, y, z in mesh[0]:
        x, y, z = x * scale[0], y * scale[1], z * scale[2]
        out.append((x * c - y * s + move[0], x * s + y * c + move[1], z + move[2]))
    return out, mesh[1]


def tapered_tube(points, radii, seg=10) -> Mesh:
    """Like shapes.tube but with a radius per point."""
    from lib.shapes import _capped, _cross, _dot, _sub, _unit

    dirs = [_unit(_sub(b, a)) for a, b in zip(points, points[1:])]
    tans = [dirs[0]] + [_unit([a + b for a, b in zip(d0, d1)])
                        for d0, d1 in zip(dirs, dirs[1:])] + [dirs[-1]]
    helper = [0.0, 1.0, 0.0] if abs(tans[0][1]) < 0.9 else [1.0, 0.0, 0.0]
    normal = _unit(_cross(tans[0], helper))
    verts, faces = [], []
    for idx, (p, t, r) in enumerate(zip(points, tans, radii)):
        if idx:
            normal = _unit(_sub(normal, [c * _dot(normal, t) for c in t]))
        bn = _cross(t, normal)
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ca, sa = math.cos(a) * r, math.sin(a) * r
            verts.append(tuple(p[k] + normal[k] * ca + bn[k] * sa for k in range(3)))
    for sidx in range(len(points) - 1):
        lo, hi = sidx * seg, (sidx + 1) * seg
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((lo + i, lo + j, hi + j, hi + i))
    return _capped((verts, faces), len(points), seg, True)
