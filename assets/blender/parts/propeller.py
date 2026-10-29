"""A bronze ship's propeller on the X shaft (bow toward +X): four broad,
skewed, twisted blades with round tips and a conical boss, as on the real
fixed-pitch screws. Fits the old procedural envelope (radius about 0.55,
boss 0.4 long). Spins in the game as one group."""

from lib.blades import propeller
from lib.shapes import linear, make_object

COLOR = linear(0.69, 0.553, 0.341)


def build(dims: dict) -> dict:
    mesh = propeller(
        radius=0.55,
        blades=4,
        chord=0.34,
        hub_radius=0.14,
        hub_length=0.4,
        thick=0.06,
    )
    return {"propeller": make_object("propeller", mesh, COLOR, metallic=0.0)}
