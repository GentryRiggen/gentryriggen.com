"""The 1.3x large lifeboat: same clinker build as the standard, longer."""
from parts.lifeboat_common import build_open


def build(dims):
    return build_open(dims, "lifeboat", "#f7f7f2")
