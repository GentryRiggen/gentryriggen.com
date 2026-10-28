"""History-line construction for the score log (pure, no bpy)."""

from datetime import datetime


def build_history_line(
    result: dict,
    timestamp: str,
    run_seconds: float,
    previous_timestamp: str | None,
    blockers: list[str] | None = None,
) -> dict:
    """Result plus process-log fields. Timestamps are ISO 8601."""
    since = None
    if previous_timestamp:
        delta = datetime.fromisoformat(timestamp) - datetime.fromisoformat(
            previous_timestamp
        )
        since = round(delta.total_seconds(), 1)
    return dict(
        result,
        timestamp=timestamp,
        runSeconds=round(run_seconds, 1),
        sinceLastSeconds=since,
        blockers=list(blockers or []),
    )
