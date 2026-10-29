"""Olympic-class clinker lifeboat: double-ended white hull with strong sheer,
varnished gunwale, rubbing strake, thwarts and a taut canvas cover."""
from parts.lifeboat_common import build_open


def build(dims):
    return build_open(dims, "lifeboat", "#f7f7f2")
