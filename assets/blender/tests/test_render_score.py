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


class RefScoringTest(unittest.TestCase):
    def test_synthetic_ref_scores_end_to_end(self) -> None:
        # A dark 20x40 bar on white, inside a 100x80 image, cropped from a margin.
        ref = np.ones((80, 100, 4), dtype=np.float32)
        ref[20:60, 30:50, :3] = 0.1
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
        out = scoring.score_ref(entry, loaded, sil, look)
        self.assertGreater(out["silhouette"], 0.95)
        self.assertGreater(out["detail"], 0.0)

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
