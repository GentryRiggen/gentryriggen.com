import importlib.util
import json
import math
import os
import tempfile
import unittest

import bpy
import numpy as np

from lib import render, scoring


def write_png(path: str, rgba: np.ndarray) -> None:
    """rgba is (h, w, 4), top row first."""
    h, w = rgba.shape[:2]
    img = bpy.data.images.new("synthetic", w, h, alpha=True)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "CHANNEL_PACKED"
    img.pixels.foreach_set(np.flipud(rgba).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


class CameraTest(unittest.TestCase):
    BMIN, BMAX = [-1.0, 0.0, -1.0], [1.0, 4.0, 1.0]

    def test_ortho_side_frames_height_with_margin(self) -> None:
        view = {"azimuthDeg": 90, "elevationDeg": 0, "ortho": True}
        cam = render.camera_for_view(view, self.BMIN, self.BMAX)
        self.assertAlmostEqual(cam["orthoHalfHeight"], 2.2)
        self.assertAlmostEqual(cam["target"][1], 2.0)
        self.assertGreater(cam["position"][0], 0)  # looks from +X

    def test_front_looks_from_plus_z(self) -> None:
        view = {"azimuthDeg": 0, "elevationDeg": 0, "ortho": True}
        cam = render.camera_for_view(view, self.BMIN, self.BMAX)
        self.assertGreater(cam["position"][2], 0)
        self.assertAlmostEqual(cam["position"][0], 0.0)

    def test_perspective_has_fov(self) -> None:
        view = {"azimuthDeg": 35, "elevationDeg": 20, "ortho": False}
        cam = render.camera_for_view(view, self.BMIN, self.BMAX)
        self.assertEqual(cam["fovDeg"], 30.0)
        self.assertGreater(cam["position"][1], 2.0)


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))


def _funnel_scene():
    spec = json.load(open(os.path.join(ROOT, "assets", "parts", "funnel.json")))
    path = os.path.join(ROOT, "assets", "blender", "parts", "funnel.py")
    mod_spec = importlib.util.spec_from_file_location("funnel_part", path)
    mod = importlib.util.module_from_spec(mod_spec)
    mod_spec.loader.exec_module(mod)
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials):
        for item in list(coll):
            coll.remove(item)
    variant = next(v for v in spec["variants"] if v["name"] == spec["scoreVariant"])
    return spec, variant, mod.build(variant["dims"])


class RakeTest(unittest.TestCase):
    def test_rake_tilts_the_top_toward_minus_x(self) -> None:
        # Like three's rotation=[0, 0, rake]: (0, 1, 0) -> (-sin, cos, 0).
        bpy.ops.mesh.primitive_cube_add(size=0.0)
        obj = bpy.context.active_object
        obj.location = (0.0, 0.0, 1.0)  # three (0, 1, 0)
        bpy.context.view_layer.update()
        rake = math.radians(5)
        render.apply_rake([obj], rake)
        p = obj.matrix_world.translation
        self.assertAlmostEqual(p.x, -math.sin(rake), places=5)
        self.assertAlmostEqual(p.z, math.cos(rake), places=5)
        self.assertAlmostEqual(p.y, 0.0, places=5)
        bpy.data.objects.remove(obj)

    def test_zero_rake_is_a_no_op(self) -> None:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(1.0, 2.0, 3.0))
        obj = bpy.context.active_object
        render.apply_rake([obj], 0.0)
        self.assertEqual(tuple(obj.location), (1.0, 2.0, 3.0))
        bpy.data.objects.remove(obj)


class LookExposureTest(unittest.TestCase):
    def test_body_is_not_blown_out(self) -> None:
        spec, variant, objs = _funnel_scene()
        view = next(v for v in spec["views"] if v["name"] == "three-quarter")
        eb = variant["expectedBounds"]
        render.apply_rake(objs.values(), spec.get("rakeRadians", 0.0))
        cam = render.place_camera(view, eb["min"], eb["max"])
        with tempfile.TemporaryDirectory() as tmp:
            sil_path = os.path.join(tmp, "sil.png")
            look_path = os.path.join(tmp, "look.png")
            render.render_silhouette(sil_path)
            render.render_look(look_path)
            sil = render.load_rgba(sil_path)[..., 3] > 0.5
            look = render.load_rgba(look_path)
            sil = scoring.resize_nearest(sil, look.shape[:2])
        bpy.data.objects.remove(cam)
        body = look[sil][:, :3]
        self.assertGreater(len(body), 1000)
        blown = float((body.max(axis=1) > 0.97).mean())
        self.assertLess(blown, 0.02)


class RefScoringTest(unittest.TestCase):
    def test_synthetic_ref_scores_end_to_end(self) -> None:
        # A dark 20x40 bar on white, inside a 100x80 image, cropped from a margin.
        ref = np.ones((80, 100, 4), dtype=np.float32)
        ref[20:60, 30:50, :3] = 0.1
        ref[38:42, 30:50, :3] = 0.4  # a band across the bar
        entry = {
            "file": "r.png",
            "view": "side",
            "crop": [10, 10, 80, 60],
            "mask": {"mode": "luma", "threshold": 0.5, "invert": False},
        }
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "part"))
            path = scoring.ref_path(tmp, "part", entry)
            write_png(path, ref)
            loaded = scoring.apply_crop(render.load_rgba(path), entry["crop"])
        self.assertEqual(loaded.shape, (60, 80, 4))
        # The same bar as a render silhouette, at another size.
        sil = np.zeros((64, 64), dtype=bool)
        sil[8:56, 20:44] = True
        look = np.ones((128, 128, 4), dtype=np.float32)
        look[16:112, 40:88, :3] = 0.1
        look[52:60, 40:88, :3] = 0.4
        out = scoring.score_ref(entry, loaded, sil, look)
        self.assertGreater(out["silhouette"], 0.95)
        self.assertGreater(out["detail"], 0.7)

    def test_wrong_shape_scores_lower(self) -> None:
        ref = np.ones((60, 60, 4), dtype=np.float32)
        for row in range(10, 50):  # a triangle
            ref[row, 10 : 10 + (row - 10), :3] = 0.1
        entry = {"file": "r", "view": "side", "mask": {"mode": "luma"}}
        sil = np.zeros((64, 64), dtype=bool)
        sil[8:56, 8:56] = True  # a full block
        look = np.ones((64, 64, 4), dtype=np.float32)
        out = scoring.score_ref(entry, ref, sil, look)
        self.assertLess(out["silhouette"], 0.6)

    def test_mirrored_ref_scores_like_the_original(self) -> None:
        # A photo from the other side of the ship leans the other way.
        ref = np.ones((60, 60, 4), dtype=np.float32)
        for row in range(10, 50):  # a right-angled triangle, leaning left
            ref[row, 10 : 10 + (row - 10), :3] = 0.1
        entry = {"file": "r", "view": "side", "mask": {"mode": "luma"}}
        sil = np.zeros((60, 60), dtype=bool)
        for row in range(10, 50):  # the same triangle, mirrored
            sil[row, 50 - (row - 10) : 50] = True
        look = np.ones((60, 60, 4), dtype=np.float32)
        out = scoring.score_ref(entry, ref, sil, look)
        self.assertGreater(out["silhouette"], 0.95)

    def test_detail_compares_at_one_scale(self) -> None:
        # The same striped funnel drawn at two sizes has the same detail.
        def striped(h: int, w: int, stripe: int) -> tuple[np.ndarray, np.ndarray]:
            rgba = np.ones((h, w, 4), dtype=np.float32)
            mask = np.zeros((h, w), dtype=bool)
            mask[h // 8 : h - h // 8, w // 4 : 3 * w // 4] = True
            rows = (np.arange(h) // stripe) % 2 == 0
            rgba[rows[:, None] & mask, :3] = 0.2
            rgba[~rows[:, None] & mask, :3] = 0.6
            return rgba, mask

        small, small_mask = striped(160, 80, 8)
        big, big_mask = striped(480, 240, 24)
        entry = {"file": "r", "view": "side", "mask": {"mode": "alpha"}}
        small[..., 3] = small_mask.astype(np.float32)
        out = scoring.score_ref(entry, small, big_mask, big)
        self.assertGreater(out["detail"], 0.8)

    def test_alpha_mask_mode(self) -> None:
        rgba = np.zeros((4, 4, 4), dtype=np.float32)
        rgba[1:3, 1:3, 3] = 1.0
        mask = scoring.ref_mask(rgba, {"mode": "alpha", "threshold": 0.5})
        self.assertEqual(int(mask.sum()), 4)

    def test_mean_or_none(self) -> None:
        self.assertIsNone(scoring.mean_or_none([]))
        self.assertAlmostEqual(scoring.mean_or_none([0.5, 1.0]), 0.75)


if __name__ == "__main__":
    unittest.main()
