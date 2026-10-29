"""A single deck gun mount: faceted shield and one barrel (see turret_common)."""
from parts.turret_common import build_turret, objects


def build(dims):
    base, turret, gun = build_turret(
        base_r=0.32, hx=0.52, hy=0.26, hz=0.5, offsets=[0.0], barrel_len=0.70, barrel_r=0.045, bevel=0.07)
    return objects(base, turret, gun, ("#4b545b", "#8a949c"))
