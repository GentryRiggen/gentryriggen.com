"""A twin naval turret: faceted shield and two barrels (see turret_common)."""
from parts.turret_common import build_turret, objects


def build(dims):
    base, turret, gun = build_turret(
        base_r=0.62, hx=1.0, hy=0.42, hz=0.95, offsets=[-0.2, 0.2], barrel_len=1.3, barrel_r=0.065, bevel=0.13)
    return objects(base, turret, gun, ("#4b545b", "#8a949c"))
