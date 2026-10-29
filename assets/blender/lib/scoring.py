"""Reference-image loading and per-reference scoring (numpy only)."""

import os

import numpy as np

from lib import metrics


def apply_crop(rgba: np.ndarray, crop: list[int] | None) -> np.ndarray:
    """Crop [x, y, w, h] in pixels, measured from the top-left."""
    if not crop:
        return rgba
    x, y, w, h = crop
    return rgba[y : y + h, x : x + w]


def ref_mask(rgba: np.ndarray, mask_cfg: dict) -> np.ndarray:
    return metrics.mask_from_rgba(
        rgba,
        mask_cfg.get("mode", "luma"),
        float(mask_cfg.get("threshold", 0.5)),
        bool(mask_cfg.get("invert", False)),
    )


def resize_nearest(mask: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    rows = (np.arange(shape[0]) * mask.shape[0]) // shape[0]
    cols = (np.arange(shape[1]) * mask.shape[1]) // shape[1]
    return mask[np.ix_(rows, cols)]


# Bump when a scoring change makes old scores incomparable with new ones.
# History from another version is archived and the rounds restart at 1.
SCORER_VERSION = 2

DETAIL_HEIGHT = 128


def area_resize(rgba: np.ndarray, height: int) -> np.ndarray:
    """Box-average resize to `height` rows, keeping the aspect ratio. Averaging
    (not sampling) smooths away film grain and JPEG noise."""
    h, w = rgba.shape[:2]
    width = max(1, round(w * height / h))
    rows = (np.arange(height) * h) // height
    cols = (np.arange(width) * w) // width
    summed = np.add.reduceat(np.add.reduceat(rgba, rows, axis=0), cols, axis=1)
    # Upscaling repeats an index; reduceat then returns that one element.
    row_n = np.maximum(np.diff(np.append(rows, h)), 1)
    col_n = np.maximum(np.diff(np.append(cols, w)), 1)
    return summed / (row_n[:, None] * col_n[None, :])[..., None]


DETAIL_ERODE = 2


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Fill background pockets the border can't reach (flood fill from the
    border, numpy only)."""
    outside = np.zeros_like(mask, dtype=bool)
    outside[0, :] = ~mask[0, :]
    outside[-1, :] |= ~mask[-1, :]
    outside[:, 0] |= ~mask[:, 0]
    outside[:, -1] |= ~mask[:, -1]
    free = ~mask
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= free
        if np.array_equal(grown, outside):
            return ~outside
        outside = grown


def erode(mask: np.ndarray, pixels: int) -> np.ndarray:
    """Min-filter: a pixel stays only if its whole (2n+1) square is set.
    Pixels beyond the array count as unset."""
    out = mask.copy()
    for _ in range(pixels):
        p = np.pad(out, 1, constant_values=False)
        h, w = out.shape
        nxt = out.copy()
        for dy in range(3):
            for dx in range(3):
                nxt &= p[dy : dy + h, dx : dx + w]
        out = nxt
    return out


def detail_density(rgba: np.ndarray, mask: np.ndarray) -> float:
    """Edge density on the mask's interior, measured on its bounding box
    scaled to DETAIL_HEIGHT rows, so a photo and a render compare at one
    scale. The mask is hole-filled then eroded by DETAIL_ERODE pixels so the
    part-versus-background step never counts, only surface detail."""
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return 0.0
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    box = area_resize(rgba[y0:y1, x0:x1], DETAIL_HEIGHT)
    box_mask = fill_holes(resize_nearest(mask[y0:y1, x0:x1], box.shape[:2]))
    inner = erode(box_mask, DETAIL_ERODE)
    return metrics.edge_density(box, inner if inner.any() else box_mask)


def score_ref(
    entry: dict,
    ref_rgba: np.ndarray,
    sil_mask: np.ndarray,
    look_rgba: np.ndarray,
) -> dict:
    """Score one reference against the render of its view.

    ref_rgba is the already-cropped reference; sil_mask and look_rgba come
    from the render of entry["view"].
    """
    mask = ref_mask(ref_rgba, entry["mask"])
    sil_mask = resize_nearest(sil_mask, look_rgba.shape[:2])
    # A photo may be from either side of the ship, which mirrors its lean, so
    # the reference scores as whichever way round fits.
    ref_norm = metrics.normalize_mask(mask)
    sil_norm = metrics.normalize_mask(sil_mask)
    sil = max(
        metrics.iou(ref_norm, sil_norm),
        metrics.iou(np.fliplr(ref_norm), sil_norm),
    )
    ref_density = detail_density(ref_rgba, mask)
    look_density = detail_density(look_rgba, sil_mask)
    return {
        "file": entry["file"],
        "view": entry["view"],
        "silhouette": sil,
        "detail": metrics.detail_score(look_density, ref_density),
        "renderDensity": look_density,
        "refDensity": ref_density,
    }


def mean_or_none(values: list[float]) -> float | None:
    return float(sum(values) / len(values)) if values else None


def ref_path(refs_dir: str, part: str, entry: dict) -> str:
    return os.path.join(refs_dir, part, entry["file"])


class SpecError(Exception):
    """A user-facing problem with the spec, manifest or a reference."""


def validate_crop(
    crop: list[int] | None, width: int, height: int, label: str
) -> None:
    if not crop:
        return
    if len(crop) != 4:
        raise SpecError(f"{label}: crop must be [x, y, w, h], got {crop}")
    x, y, w, h = crop
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
        raise SpecError(
            f"{label}: crop {crop} is out of bounds for a {width}x{height} image"
        )


def validate_manifest(part: str, entries: list[dict], spec: dict) -> None:
    views = {v["name"] for v in spec["views"]}
    variants = {v["name"] for v in spec["variants"]}
    if spec["scoreVariant"] not in variants:
        raise SpecError(
            f"scoreVariant '{spec['scoreVariant']}' matches no variant "
            f"(have: {sorted(variants)})"
        )
    for entry in entries:
        view = entry.get("view")
        if view is not None and view not in views:
            raise SpecError(
                f"manifest entry '{entry['file']}' for {part} uses view "
                f"'{view}', which is not in the spec (have: {sorted(views)})"
            )


def check_refs_exist(
    refs_dir: str, part: str, entries: list[dict]
) -> None:
    """Fail early, with the fix, if a scored reference isn't downloaded."""
    for entry in entries:
        if not entry.get("mask") or not entry.get("view"):
            continue
        if not os.path.exists(ref_path(refs_dir, part, entry)):
            raise SpecError(
                f"missing ref {entry['file']}: "
                f"run npm run assets:refs -- {part}"
            )
