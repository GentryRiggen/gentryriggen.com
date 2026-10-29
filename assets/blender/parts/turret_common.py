"""Shared builder for the two gun turrets (three.js coordinates, Y up, guns
toward +X at rest, origin on the deck centre). A fixed round barbette ring,
and a turning part: a faceted shield (a loft along X: low sloped front, tall
flat middle, rounded back, chamfered sides), a mantlet round each gun, a
recoil sleeve and long barrel with a muzzle ring, sight hoods and a roof
hatch. Slots: `base` (fixed ring), `turret` (the shield, takes paint) and
`gun` (barrels, metal); the last two turn together in the game."""

import math

from lib.shapes import box, hex_linear, lathe, loft, make_object, merge, translate
from lib.deckkit import rot_z


def barrel(x0, x1, y, z, r, brake=True):
    """A gun barrel along +X: a thick breech sleeve tapering to the barrel,
    and a muzzle ring."""
    length = x1 - x0
    prof = [(0.0, 0.0), (r * 1.4, 0.0), (r * 1.4, length * 0.22), (r * 1.1, length * 0.28),
            (r, length * 0.36), (r * 0.92, length * 0.96), (r * 1.3, length * 0.96),
            (r * 1.3, length), (0.0, length)]
    mesh = lathe(prof, 12)
    # lathe runs along +Y: tip it to +X, then place.
    mesh = rot_z(mesh, -math.pi / 2)
    return translate(mesh, x0, y, z)


def build_turret(*, base_r, hx, hy, hz, offsets, barrel_len, barrel_r, bevel):
    deck = 0.12
    base = [
        lathe([(0.0, 0.0), (base_r, 0.0), (base_r, deck * 0.7), (base_r - 0.03, deck), (0.0, deck)], 24),
        # roller path ring, standing proud of the barbette
        lathe([(base_r * 0.97, deck - 0.01), (base_r * 0.97 + 0.012, deck + 0.0), (base_r * 0.97, deck + 0.01)], 24),
    ]
    h = hy
    wb, wt = hz / 2, hz / 2 - bevel
    hs = h * 0.62

    def section(hfrac, wfrac):
        return [(-wb * wfrac, 0.0), (wb * wfrac, 0.0), (wb * wfrac, hs * hfrac),
                (wt * wfrac, h * hfrac), (-wt * wfrac, h * hfrac), (-wb * wfrac, hs * hfrac)]

    half = hx / 2
    stations = [
        (-half, 0.72, 0.86), (-half + 0.07 * hx, 0.96, 0.98), (-half + 0.16 * hx, 1.0, 1.0),
        (half * 0.40, 1.0, 1.0), (half, 0.58, 0.9),
    ]
    shield = loft([(x, section(hf, wf)) for x, hf, wf in stations], axis="x")
    shield = translate(shield, 0.0, deck, 0.0)
    gun_y = deck + hy * 0.56
    turret = [shield]
    gun = []
    for z in offsets:
        # Mantlet: a squat block round the gun where it leaves the face.
        # Gun port: a short fat sleeve bulging out of the sloped face.
        mant = rot_z(lathe([(0.0, 0.0), (barrel_r * 2.5, 0.0), (barrel_r * 2.2, 0.1), (0.0, 0.1)], 12), -math.pi / 2)
        turret.append(translate(mant, half - 0.07, gun_y, z))
        gun.append(barrel(half - 0.05, half - 0.05 + barrel_len, gun_y, z, barrel_r))
    # Roof hatch and sight hoods.
    turret.append(box(-half * 0.35, deck + h + 0.002, 0.0, hx * 0.22, 0.02, hz * 0.26))
    for s in (-1, 1):
        turret.append(box(half * 0.1, deck + h * 0.84, s * (wt * 0.97 + 0.012), hx * 0.2, h * 0.18, 0.03))
    return base, turret, gun


def objects(base, turret, gun, colors):
    return {
        "base": make_object("base", merge(base), hex_linear(colors[0]), roughness=0.7, closed=True),
        "turret": make_object("turret", merge(turret), hex_linear(colors[1]), roughness=0.65, closed=True, sharp_degrees=30),
        "gun": make_object("gun", merge(gun), hex_linear(colors[0]), metallic=0.8, roughness=0.45, closed=True),
    }
