"""Build a part in Blender, gate it, render it and score it against refs.

Run via: npm run assets:score -- <part> [--round-note "text"] [--spec path]
"""

import argparse
import importlib.util
import json
import os
import sys
import time
import traceback
from datetime import datetime

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import gates, history as hist, metrics, render, scoring  # noqa: E402


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="assets:score")
    ap.add_argument("part")
    ap.add_argument("--round-note", default="")
    ap.add_argument("--spec", default=None, help="override the spec path")
    ap.add_argument(
        "--blocker",
        action="append",
        default=[],
        help="something that slowed this round (repeatable)",
    )
    ap.add_argument("--refs-dir", default=os.path.join(ROOT, "assets", "refs"))
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "assets", "out"))
    return ap.parse_args(argv)


def clear_scene() -> None:
    for coll in (
        bpy.data.objects,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(coll):
            coll.remove(item)


def load_part_module(script: str):
    path = os.path.join(HERE, "parts", f"{script}.py")
    spec = importlib.util.spec_from_file_location(f"part_{script}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def measure(objs: dict) -> tuple[list[float], list[float], int]:
    """World bounds (three.js coords, Y-up) and triangle count."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = np.full(3, np.inf)
    hi = np.full(3, -np.inf)
    tris = 0
    for obj in objs.values():
        ev = obj.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        for v in mesh.vertices:
            w = ev.matrix_world @ v.co
            p = np.array([w.x, w.z, -w.y])  # Blender -> three
            lo = np.minimum(lo, p)
            hi = np.maximum(hi, p)
        ev.to_mesh_clear()
    return lo.tolist(), hi.tolist(), tris


def export_glb(objs: dict, path: str) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs.values():
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    return os.path.getsize(path)


def score_refs(part: str, manifest: dict, refs_dir: str, renders: dict):
    per_ref = []
    for entry in manifest.get(part, []):
        if not entry.get("mask") or not entry.get("view"):
            continue
        sil_rgba, look_rgba = renders[entry["view"]]
        full = render.load_rgba(scoring.ref_path(refs_dir, part, entry))
        scoring.validate_crop(
            entry.get("crop"), full.shape[1], full.shape[0], entry["file"]
        )
        ref = scoring.apply_crop(full, entry.get("crop"))
        per_ref.append(
            scoring.score_ref(entry, ref, sil_rgba[..., 3] > 0.5, look_rgba)
        )
    return per_ref


def read_history(path: str) -> tuple[int, str | None]:
    """Highest round so far and the last line's timestamp (if any)."""
    if not os.path.exists(path):
        return 0, None
    lines = [json.loads(line) for line in open(path) if line.strip()]
    last = lines[-1].get("timestamp") if lines else None
    return max((ln["round"] for ln in lines), default=0), last


def fmt(v: float | None) -> str:
    return "n/a" if v is None else f"{v:.3f}"


def run(args: argparse.Namespace) -> None:
    started = time.monotonic()
    spec_path = args.spec or os.path.join(ROOT, "assets", "parts", f"{args.part}.json")
    spec = json.load(open(spec_path))
    manifest = json.load(open(os.path.join(args.refs_dir, "manifest.json")))
    scoring.validate_manifest(args.part, manifest.get(args.part, []), spec)
    part_mod = load_part_module(spec["script"])
    out = os.path.join(args.out_dir, args.part)
    if args.spec:  # experiments never touch the real score log
        out = os.path.join(out, "override")
    os.makedirs(os.path.join(out, "renders"), exist_ok=True)

    all_gates, tri_counts, byte_counts = [], {}, {}
    renders: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for variant in spec["variants"]:
        name = variant["name"]
        clear_scene()
        objs = part_mod.build(variant["dims"])
        lo, hi, tris = measure(objs)
        size = export_glb(objs, os.path.join(out, f"{name}.glb"))
        tri_counts[name], byte_counts[name] = tris, size
        eb = variant["expectedBounds"]
        results = [
            gates.bounds_gate(lo, hi, eb["min"], eb["max"], spec["boundsTolerance"]),
            gates.slots_gate(set(objs), spec["slots"]),
            gates.budget_gate("triangles", tris, spec["budget"]["maxTriangles"]),
            gates.budget_gate("bytes", size, spec["budget"]["maxBytes"]),
        ]
        all_gates += [dict(r, variant=name) for r in results]
        if name == spec["scoreVariant"]:
            for view in spec["views"]:
                cam = render.place_camera(view, eb["min"], eb["max"])
                sil = os.path.join(out, "renders", f"{view['name']}-sil.png")
                look = os.path.join(out, "renders", f"{view['name']}-look.png")
                render.render_silhouette(sil)
                render.render_look(look)
                renders[view["name"]] = (render.load_rgba(sil), render.load_rgba(look))
                bpy.data.objects.remove(cam)

    per_ref = score_refs(args.part, manifest, args.refs_dir, renders)
    sil = scoring.mean_or_none([r["silhouette"] for r in per_ref])
    det = scoring.mean_or_none([r["detail"] for r in per_ref])
    failed = [g for g in all_gates if not g["ok"]]
    total = 0.0 if failed else metrics.composite(sil, det, spec["weights"])

    history = os.path.join(out, "history.jsonl")
    prev_round, prev_ts = read_history(history)
    rnd = prev_round + 1
    result = {
        "round": rnd,
        "total": total,
        "silhouette": sil,
        "detail": det,
        "gates": all_gates,
        "perRef": per_ref,
        "triangles": tri_counts,
        "bytes": byte_counts,
        "note": args.round_note,
    }
    line = hist.build_history_line(
        result,
        datetime.now().astimezone().isoformat(timespec="seconds"),
        time.monotonic() - started,
        prev_ts,
        args.blocker,
    )
    with open(os.path.join(out, "score.json"), "w") as f:
        json.dump(line, f, indent=2)
    with open(history, "a") as f:
        f.write(json.dumps(line) + "\n")

    if failed:
        status = "gates=FAIL " + " | ".join(
            f"{g['name']}[{g['variant']}]: {g['detail']}" for g in failed
        )
    else:
        worst = max(tri_counts.values())
        status = f"gates=OK (tris {worst}/{spec['budget']['maxTriangles']})"
    print(
        f"{args.part} r{rnd} total={total:.3f} sil={fmt(sil)} det={fmt(det)} {status}"
    )


if __name__ == "__main__":
    try:
        run(parse_args())
    except scoring.SpecError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
    except BaseException:
        traceback.print_exc()
        sys.exit(1)
