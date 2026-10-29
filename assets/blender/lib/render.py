"""Camera framing and headless renders. Specs use three.js coordinates
(Y-up); Blender is Z-up, so three (x, y, z) is Blender (x, -z, y)."""

import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

MARGIN = 1.1
PERSPECTIVE_FOV_DEG = 30.0
ORTHO_DISTANCE_FACTOR = 4.0


def _norm(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)


def camera_for_view(view: dict, bounds_min, bounds_max) -> dict:
    """Pure view-framing rule, in three.js coordinates (Y-up, right-handed).

    centre  c = (min + max) / 2;  R = |max - min| / 2 (bounding-sphere radius)
    dir     d = (sin(az) cos(el), sin(el), cos(az) cos(el))   camera offset
              direction; az 0 looks from +Z, az 90 from +X
    up      u = (0, 1, 0);  right r = normalize(cross(-d, u))
    ortho:  project the 8 box corners on r and u; take the centre of their
            extents (pr, pu) and half-extents (hr, hu).
            target = c + r*pr + u*pu; halfHeight = MARGIN * max(hr, hu);
            position = target + d * ORTHO_DISTANCE_FACTOR * R
    persp:  fov = 30 deg vertical, square aspect; target = c;
            position = c + d * MARGIN * R / sin(fov / 2)
    MARGIN = 1.1 (10%). Images are square.
    """
    lo = np.array(bounds_min, dtype=float)
    hi = np.array(bounds_max, dtype=float)
    c = (lo + hi) / 2
    radius = float(np.linalg.norm(hi - lo) / 2)
    az = math.radians(view["azimuthDeg"])
    el = math.radians(view["elevationDeg"])
    d = np.array(
        [math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)]
    )
    up = np.array([0.0, 1.0, 0.0])
    right = _norm(np.cross(-d, up))
    if view["ortho"]:
        corners = np.array(
            [[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
        )
        pr = (corners - c) @ right
        pu = (corners - c) @ up
        cr, cu = (pr.max() + pr.min()) / 2, (pu.max() + pu.min()) / 2
        hr, hu = (pr.max() - pr.min()) / 2, (pu.max() - pu.min()) / 2
        target = c + right * cr + up * cu
        return {
            "ortho": True,
            "position": (target + d * ORTHO_DISTANCE_FACTOR * radius).tolist(),
            "target": target.tolist(),
            "up": up.tolist(),
            "orthoHalfHeight": float(MARGIN * max(hr, hu)),
        }
    fov = PERSPECTIVE_FOV_DEG
    dist = MARGIN * radius / math.sin(math.radians(fov) / 2)
    return {
        "ortho": False,
        "position": (c + d * dist).tolist(),
        "target": c.tolist(),
        "up": up.tolist(),
        "fovDeg": fov,
    }


def to_blender(v) -> Vector:
    return Vector((v[0], -v[2], v[1]))


def place_camera(view: dict, bounds_min, bounds_max) -> bpy.types.Object:
    cfg = camera_for_view(view, bounds_min, bounds_max)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.clip_start = 0.01
    cam_data.clip_end = 1000.0
    if cfg["ortho"]:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = cfg["orthoHalfHeight"] * 2
    else:
        cam_data.type = "PERSP"
        cam_data.sensor_fit = "VERTICAL"
        cam_data.angle_y = math.radians(cfg["fovDeg"])
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    pos, target = to_blender(cfg["position"]), to_blender(cfg["target"])
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def apply_rake(objs, rake_radians: float) -> None:
    """Tilt objects about three.js +Z through the origin, like the game's
    `<group rotation={[0, 0, rake]}>`. Three +Z is Blender -Y, so this is a
    rotation of -rake about Blender +Y."""
    if not rake_radians:
        return
    rot = Matrix.Rotation(-rake_radians, 4, "Y")
    for obj in objs:
        obj.matrix_world = rot @ obj.matrix_world
    bpy.context.view_layer.update()


def _setup(res: int, engine: str) -> bpy.types.Scene:
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    return scene


def render_silhouette(path: str, res: int = 256) -> None:
    """Workbench, flat, transparent film: alpha is the mask."""
    scene = _setup(res, "BLENDER_WORKBENCH")
    scene.render.film_transparent = True
    shading = scene.display.shading
    shading.light = "FLAT"
    shading.color_type = "SINGLE"
    shading.single_color = (1.0, 1.0, 1.0)
    shading.show_object_outline = False
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def _eevee_name() -> str:
    items = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    names = {i.identifier for i in items}
    return "BLENDER_EEVEE" if "BLENDER_EEVEE" in names else "BLENDER_EEVEE_NEXT"


def _add_light(
    name: str, kind: str, from_dir_cam, energy: float, cam: bpy.types.Object
) -> bpy.types.Object:
    """Sun placed relative to the camera. from_dir_cam is (azimuth, elevation)
    in degrees of the direction the light comes FROM, in the camera frame:
    azimuth 0 is the camera position, negative is camera-left, 180 is behind
    the subject; elevation is up from the camera's horizon."""
    az, el = (math.radians(a) for a in from_dir_cam)
    local = Vector(
        (math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el))
    )
    toward = cam.matrix_world.to_3x3() @ local  # camera looks down local -Z
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    obj = bpy.data.objects.new(name, data)
    obj.rotation_euler = (-toward).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(obj)
    return obj


# (azimuth, elevation) in the camera frame, energy
LIGHT_RIG = {
    "key": ((-35.0, 40.0), 1.6),
    "fill": ((60.0, 15.0), 0.5),
    "rim": ((165.0, 40.0), 0.8),
}


def render_look(path: str, res: int = 512) -> None:
    """EEVEE, camera-relative three-point sun rig, neutral grey world. The
    scene camera must already be placed."""
    scene = _setup(res, _eevee_name())
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("grey")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1.0)
    bg.inputs["Strength"].default_value = 0.4
    scene.world = world
    bpy.context.view_layer.update()
    cam = scene.camera
    lights = [
        _add_light(n, "SUN", direction, energy, cam)
        for n, (direction, energy) in LIGHT_RIG.items()
    ]
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for light in lights:
        bpy.data.objects.remove(light)


def load_rgba(path: str) -> np.ndarray:
    """Image as (h, w, 4) floats, raw (non-colour-managed), top row first."""
    img = bpy.data.images.load(path)
    try:
        img.colorspace_settings.name = "Non-Color"
        img.alpha_mode = "CHANNEL_PACKED"
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
    finally:
        bpy.data.images.remove(img)
    return np.flipud(px.reshape(h, w, 4))
