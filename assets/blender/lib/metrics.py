"""Pure-numpy scoring metrics for comparing renders against references."""

import math

import numpy as np

LUMA = np.array([0.2126, 0.7152, 0.0722])


def normalize_mask(mask: np.ndarray, size: int = 128) -> np.ndarray:
    """Crop to the bounding box, then nearest-resize (stretching) to size x size."""
    ys, xs = np.nonzero(mask)
    if ys.size == 0:
        return np.zeros((size, size), dtype=bool)
    crop = mask[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    h, w = crop.shape
    rows = np.minimum((np.arange(size) * h) // size, h - 1)
    cols = np.minimum((np.arange(size) * w) // size, w - 1)
    return crop[np.ix_(rows, cols)].astype(bool)


def iou(a: np.ndarray, b: np.ndarray) -> float:
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 0.0
    return float(np.logical_and(a, b).sum() / union)


def _luma(rgba: np.ndarray) -> np.ndarray:
    return rgba[..., :3] @ LUMA


def mask_from_rgba(
    rgba: np.ndarray, mode: str, threshold: float, invert: bool
) -> np.ndarray:
    if mode == "alpha":
        return rgba[..., 3] > threshold
    if mode == "luma":
        mask = _luma(rgba) < threshold
        return ~mask if invert else mask
    raise ValueError(f"unknown mask mode: {mode}")


def edge_density(rgba: np.ndarray, mask: np.ndarray) -> float:
    """Mean Sobel gradient magnitude of luminance inside the mask."""
    if not mask.any():
        return 0.0
    p = np.pad(_luma(rgba), 1, mode="edge")
    gx = (
        (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:])
        - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    )
    gy = (
        (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:])
        - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    )
    return float(np.hypot(gx, gy)[mask].mean())


def detail_score(render_density: float, ref_density: float) -> float:
    if render_density <= 0 or ref_density <= 0:
        return 0.0
    return math.exp(-abs(math.log(render_density / ref_density)))


def composite(
    silhouette: float | None, detail: float | None, weights: dict[str, float]
) -> float:
    terms = [
        (silhouette, weights["silhouette"]),
        (detail, weights["detail"]),
    ]
    used = [(v, w) for v, w in terms if v is not None]
    total = sum(w for _, w in used)
    if total == 0:
        return 0.0
    return sum(v * w for v, w in used) / total
