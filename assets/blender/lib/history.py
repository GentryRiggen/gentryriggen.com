"""History-line construction for the score log (pure, no bpy)."""

import re
from datetime import datetime

# Lines written before the scorer was versioned have no scorerVersion.
UNVERSIONED = 1


def line_version(line: dict) -> int:
    return int(line.get("scorerVersion", UNVERSIONED))


def archive_old_version(last_line: dict | None, current: int) -> int | None:
    """The old scorer version whose history must be archived, or None when
    the log is empty or already on the current version."""
    if last_line is None:
        return None
    old = line_version(last_line)
    return None if old == current else old


def archive_filename(old_version: int, timestamp: str) -> str:
    stamp = re.sub(r"[^0-9A-Za-z]+", "", timestamp)
    return f"history-v{old_version}-{stamp}.jsonl"


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
