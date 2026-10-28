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
    sil = metrics.iou(metrics.normalize_mask(mask), metrics.normalize_mask(sil_mask))
    ref_density = metrics.edge_density(ref_rgba, mask)
    look_density = metrics.edge_density(look_rgba, sil_mask)
    return {
        "file": entry["file"],
        "view": entry["view"],
        "silhouette": sil,
        "detail": metrics.detail_score(look_density, ref_density),
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
