"""Shared helpers for the grid-block detail kit (kit-window, kit-windscreen,
kit-porthole, kit-bridge-wing). Every wall piece is built in the same frame:
three.js coordinates (Y up), the wall's face on the plane x = 0, outward
along +X, the piece centred on the opening (y = 0 at its middle, z = 0 at
its middle across the wall). The game places a piece with one matrix (see
BlockKit in components/ship-builder/scene)."""

from lib.shapes import box, extrude, merge

# Frame and glass sizes the game's procedural code uses (blockDetailGeometry).
BACK = -0.01  # a frame reaches this far into the wall
FRONT = 0.02  # and this far off it


def bar_profile(thickness: float, front: float, lip: float = 0.008, step: float = 0.01):
    """Cross-section of one frame bar, across (u: 0 at the outer edge, to
    `thickness` at the opening) by depth x. A chamfered outer edge and a
    rebate at the opening, so the glass sits behind the frame's face."""
    c = 0.005
    return [
        (0.0, BACK),
        (0.0, front - c),
        (c, front),
        (thickness - step, front),
        (thickness - step, front - lip),
        (thickness, front - lip),
        (thickness, BACK),
    ]


def hbar(y_outer: float, y_inner: float, length: float, front: float, **kw):
    """A horizontal bar (along z) whose outer edge is at y_outer and inner
    edge (next to the opening) at y_inner."""
    t = abs(y_inner - y_outer)
    prof = [(y_outer + (u if y_inner > y_outer else -u), x) for u, x in bar_profile(t, front, **kw)]
    # extrude along z: profile is (x, y), so swap the pair order
    prof = [(x, y) for y, x in prof]
    return extrude(prof, -length / 2, length / 2, axis="z")


def vbar(z_outer: float, z_inner: float, height: float, cy: float, front: float, **kw):
    """A vertical bar (along y) from cy - height/2 to cy + height/2, outer
    edge at z_outer, inner edge at z_inner."""
    t = abs(z_inner - z_outer)
    sign = 1 if z_inner > z_outer else -1
    # profile for axis "y" is (x, z)
    prof = [(x, z_outer + sign * u) for u, x in bar_profile(t, front, **kw)]
    return extrude(prof, cy - height / 2, cy + height / 2, axis="y")


def rect_frame(aperture_w, aperture_h, margin, front, cy=0.0, **kw):
    """Head, sill-side bar and two jambs around an opening centred on
    (z=0, y=cy)."""
    hw, hh = aperture_w / 2, aperture_h / 2
    ow, oh = hw + margin, hh + margin
    parts = [
        hbar(cy + oh, cy + hh, 2 * ow, front, **kw),
        hbar(cy - oh, cy - hh, 2 * ow, front, **kw),
        vbar(-ow, -hw, aperture_h, cy, front, **kw),
        vbar(ow, hw, aperture_h, cy, front, **kw),
    ]
    return parts


__all__ = ["BACK", "FRONT", "bar_profile", "hbar", "vbar", "rect_frame", "box", "merge"]
