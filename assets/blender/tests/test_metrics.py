import unittest

import numpy as np

from lib import metrics


def rect(h: int, w: int, y: int, x: int, rh: int, rw: int) -> np.ndarray:
    m = np.zeros((h, w), dtype=bool)
    m[y : y + rh, x : x + rw] = True
    return m


class MetricsTest(unittest.TestCase):
    def test_normalize_mask_is_offset_and_scale_invariant(self) -> None:
        a = metrics.normalize_mask(rect(64, 64, 5, 5, 10, 20))
        b = metrics.normalize_mask(rect(100, 100, 0, 2, 30, 60))
        self.assertEqual(a.shape, (128, 128))
        self.assertTrue(np.array_equal(a, b))

    def test_normalize_empty_mask(self) -> None:
        out = metrics.normalize_mask(np.zeros((10, 10), dtype=bool))
        self.assertEqual(out.shape, (128, 128))
        self.assertFalse(out.any())

    def test_iou(self) -> None:
        a = rect(10, 10, 0, 0, 10, 10)
        self.assertEqual(metrics.iou(a, a), 1.0)
        self.assertEqual(metrics.iou(rect(10, 10, 0, 0, 5, 5), rect(10, 10, 5, 5, 5, 5)), 0.0)
        left = rect(10, 10, 0, 0, 10, 6)
        right = rect(10, 10, 0, 3, 10, 6)  # overlap 3 cols, union 9
        self.assertAlmostEqual(metrics.iou(left, right), 1 / 3)
        empty = np.zeros((10, 10), dtype=bool)
        self.assertEqual(metrics.iou(empty, empty), 0.0)

    def test_mask_from_rgba_luma_invert(self) -> None:
        img = np.ones((10, 10, 4), dtype=float)
        img[2:6, 2:6, :3] = 0.0
        shape = np.zeros((10, 10), dtype=bool)
        shape[2:6, 2:6] = True
        m = metrics.mask_from_rgba(img, "luma", 0.5, False)
        self.assertTrue(np.array_equal(m, shape))
        m = metrics.mask_from_rgba(img, "luma", 0.5, True)
        self.assertTrue(np.array_equal(m, ~shape))

    def test_mask_from_rgba_alpha(self) -> None:
        img = np.zeros((4, 4, 4), dtype=float)
        img[1:3, 1:3, 3] = 1.0
        m = metrics.mask_from_rgba(img, "alpha", 0.5, False)
        self.assertEqual(int(m.sum()), 4)

    def test_edge_density_flat_is_zero(self) -> None:
        mask = np.ones((16, 16), dtype=bool)
        flat = np.full((16, 16, 4), 0.5)
        self.assertEqual(metrics.edge_density(flat, mask), 0.0)
        checker = np.zeros((16, 16, 4))
        checker[..., 3] = 1.0
        # 4px blocks: a 1px checker cancels out in the Sobel kernel.
        yy, xx = np.indices((16, 16))
        checker[..., :3] = (((yy // 4) + (xx // 4)) % 2)[..., None]
        self.assertGreater(metrics.edge_density(checker, mask), 0.1)

    def test_detail_score(self) -> None:
        self.assertEqual(metrics.detail_score(0.3, 0.3), 1.0)
        self.assertAlmostEqual(metrics.detail_score(0.2, 0.1), 0.5)
        self.assertAlmostEqual(metrics.detail_score(0.1, 0.2), 0.5)
        self.assertEqual(metrics.detail_score(0.0, 0.2), 0.0)
        self.assertEqual(metrics.detail_score(0.2, 0.0), 0.0)

    def test_composite_skips_none(self) -> None:
        w = {"silhouette": 0.6, "detail": 0.4}
        self.assertAlmostEqual(metrics.composite(0.8, None, w), 0.8)
        self.assertEqual(metrics.composite(None, None, w), 0.0)
        self.assertAlmostEqual(metrics.composite(1.0, 0.5, w), 0.8)


if __name__ == "__main__":
    unittest.main()
