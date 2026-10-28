"""Pass/fail gates for remade assets."""

GateResult = dict  # {"name": str, "ok": bool, "detail": str}

AXES = "xyz"


def _result(name: str, ok: bool, detail: str) -> GateResult:
    return {"name": name, "ok": ok, "detail": detail}


def bounds_gate(
    actual_min: list[float],
    actual_max: list[float],
    expected_min: list[float],
    expected_max: list[float],
    tolerance: float,
) -> GateResult:
    problems = []
    for i, axis in enumerate(AXES):
        exp_extent = expected_max[i] - expected_min[i]
        act_extent = actual_max[i] - actual_min[i]
        exp_centre = (expected_max[i] + expected_min[i]) / 2
        act_centre = (actual_max[i] + actual_min[i]) / 2
        allowed = tolerance * abs(exp_extent)
        if abs(act_extent - exp_extent) > allowed:
            problems.append(f"{axis} extent {act_extent:.4g} vs {exp_extent:.4g}")
        if abs(act_centre - exp_centre) > allowed:
            problems.append(f"{axis} centre {act_centre:.4g} vs {exp_centre:.4g}")
    if problems:
        return _result("bounds", False, "; ".join(problems))
    return _result("bounds", True, "within tolerance")


def slots_gate(actual: set[str], required: list[str]) -> GateResult:
    missing = sorted(set(required) - actual)
    extra = sorted(actual - set(required))
    if not missing and not extra:
        return _result("slots", True, "all slots present")
    parts = []
    if missing:
        parts.append("missing: " + ", ".join(missing))
    if extra:
        parts.append("extra: " + ", ".join(extra))
    return _result("slots", False, "; ".join(parts))


def budget_gate(name: str, value: int, limit: int) -> GateResult:
    return _result(name, value <= limit, f"{value} / {limit}")
