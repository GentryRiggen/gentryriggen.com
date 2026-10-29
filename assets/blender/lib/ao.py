"""Baked ambient occlusion: every part gets it for free from score.py.

At game camera distance, fine geometry (plate seams, a guy ring) barely
shows, but the darkening it causes does. This bakes Cycles ambient occlusion
into a per-vertex colour attribute named `ao`, which the glTF export writes
as `COLOR_0`; the game multiplies each slot's paint by it (Surface's vertex
colour mode). Slots baked at strength 0 get no attribute and stay flat.

Configured per part in the spec (all optional):

    "ao": {"strength": 0.7, "distance": 0.4, "samples": 128,
           "ground": true, "slots": {"opening": 0}}

`strength` scales the darkening (0 off, 1 the raw bake), `slots` overrides
it per slot, `distance` is how far (metres) a surface looks for occluders
`samples` the Cycles samples per vertex, and `ground` adds a deck plane at
y = 0 while baking, so whatever stands on the deck darkens at its foot (turn
it off for parts that hang below the hull or off the side).
"""

from __future__ import annotations

import numpy as np

ATTRIBUTE = "ao"
DEFAULTS = {"strength": 0.7, "distance": 0.4, "samples": 128, "ground": True}
GROUND_SIZE = 50.0


def settings(spec: dict) -> dict:
    """The spec's `ao` block over the defaults."""
    cfg = dict(DEFAULTS)
    cfg.update({k: v for k, v in (spec.get("ao") or {}).items() if k != "slots"})
    cfg["slots"] = dict((spec.get("ao") or {}).get("slots", {}))
    return cfg


def strength_for(cfg: dict, slot: str) -> float:
    return float(cfg["slots"].get(slot, cfg["strength"]))


def soften(raw: np.ndarray, strength: float) -> np.ndarray:
    """Raw AO (1 open, 0 fully occluded) eased toward white by strength."""
    return 1.0 - strength * (1.0 - np.clip(raw, 0.0, 1.0))


def _use_in_material(obj) -> None:
    """Multiply the object's Base Color by the attribute, so the Blender look
    render shows what the game will draw."""
    mat = obj.data.materials[0] if obj.data.materials else None
    if mat is None or not mat.use_nodes:
        return
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    base = bsdf.inputs["Base Color"]
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = ATTRIBUTE
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = tuple(base.default_value)
    links.new(attr.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], base)


def bake(objs: dict, spec: dict) -> dict[str, float]:
    """Bake AO into each slot object's `ao` attribute (strength > 0 only).
    Every object occludes every other. Returns {slot: mean AO} for the
    baked slots. Restores the render engine afterwards."""
    import bpy

    cfg = settings(spec)
    targets = {n: o for n, o in objs.items() if strength_for(cfg, n) > 0}
    if not targets:
        return {}
    scene = bpy.context.scene
    engine = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = int(cfg["samples"])
    scene.cycles.use_denoising = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ao-bake")
    scene.world.light_settings.distance = float(cfg["distance"])

    ground = None
    if cfg["ground"]:
        bpy.ops.mesh.primitive_plane_add(size=GROUND_SIZE, location=(0, 0, 0))
        ground = bpy.context.active_object

    bpy.ops.object.select_all(action="DESELECT")
    for obj in targets.values():
        attrs = obj.data.color_attributes
        if ATTRIBUTE in attrs:
            attrs.remove(attrs[ATTRIBUTE])
        layer = attrs.new(ATTRIBUTE, "FLOAT_COLOR", "POINT")
        attrs.active_color = layer
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(targets.values()))
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    scene.render.engine = engine
    if ground is not None:
        mesh = ground.data
        bpy.data.objects.remove(ground)
        bpy.data.meshes.remove(mesh)

    means = {}
    for name, obj in targets.items():
        layer = obj.data.color_attributes[ATTRIBUTE]
        px = np.empty(len(layer.data) * 4, dtype=np.float32)
        layer.data.foreach_get("color", px)
        px = px.reshape(-1, 4)
        ao = soften(px[:, :3].mean(axis=1), strength_for(cfg, name))
        px[:, 0] = px[:, 1] = px[:, 2] = ao
        px[:, 3] = 1.0
        layer.data.foreach_set("color", px.ravel())
        _use_in_material(obj)
        means[name] = float(ao.mean())
    bpy.ops.object.select_all(action="DESELECT")
    return means
