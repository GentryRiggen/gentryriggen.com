"""Plane Builder obstacle: a skyscraper, 20 x 140 x 20 m (typical), two kinds.

- deco: an Art Deco tower: a wide base, two setbacks, a stepped crown and a
  spire; the stone `hard` body is wrapped in light window bands.
- glass: a slim glass tower with chamfered corners, many window bands and a
  rooftop plant.

The base fills the footprint and the top reaches the box's top. Slots: hard,
windows, roof."""

from lib.obstaclekit import finish
from lib.shapes import box, extrude, lathe


def octagon(r, cut):
    return [(-r + cut, -r), (r - cut, -r), (r, -r + cut), (r, r - cut),
            (r - cut, r), (-r + cut, r), (-r, r - cut), (-r, -r + cut)]


def deco():
    hard = [box(0, 36, 0, 20, 72, 20), box(0, 92, 0, 14.4, 40, 14.4),
            box(0, 120, 0, 9.0, 16, 9.0)]
    bands = [box(0, y, 0, 20.5, 4.2, 20.5) for y in (10, 25, 40, 55, 68)]
    bands += [box(0, y, 0, 14.9, 4.2, 14.9) for y in (80, 94, 106)]
    bands += [box(0, 118, 0, 9.5, 4.0, 9.5)]
    roof = [box(0, 129, 0, 6.0, 2.0, 6.0), box(0, 131.5, 0, 3.2, 3.0, 3.2),
            lathe([(0.0, 133), (0.7, 133), (0.1, 140), (0.0, 140)], 4)]
    return {"hard": hard, "windows": bands, "roof": roof}


def glass():
    body = extrude(octagon(8.0, 2.0), 0, 124, axis="y")
    bands = [extrude(octagon(8.35, 2.1), y, y + 5.0, axis="y") for y in (14, 30, 46, 62, 78, 94, 110)]
    podium = box(0, 5, 0, 20, 10, 20)
    roof = [box(0, 126, 0, 9, 4, 9), box(0, 131, 0, 4, 6, 4),
            lathe([(0.0, 134), (0.5, 134), (0.12, 140), (0.0, 140)], 4)]
    return {"hard": [body, podium], "windows": bands, "roof": roof}


def build(dims: dict) -> dict:
    slots = deco() if dims["variant"] == "deco" else glass()
    return finish(slots, "city")
