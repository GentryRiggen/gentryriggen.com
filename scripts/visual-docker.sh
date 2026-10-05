#!/usr/bin/env bash
# Runs the Ship Builder visual tests inside the official Playwright image, the
# same Linux rendering CI uses, so the committed baselines match CI.
#
#   scripts/visual-docker.sh          compare against the committed baselines
#   scripts/visual-docker.sh update   regenerate the Linux baselines
#
# The repo is copied into the container (node_modules is installed there with
# `npm ci`, so the host's macOS node_modules is never touched). Update mode
# copies the *-linux.png baselines back; a failing check copies the diff
# images back to ./test-results.
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION="$(node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"
MODE="${1:-check}"
SNAPSHOTS="e2e/ship-builder-visual.spec.ts-snapshots"

# VISUAL_GREP=capsizing runs just the matching tests (no spaces in it).
PLAYWRIGHT_ARGS="e2e/ship-builder-visual.spec.ts ${VISUAL_GREP:+--grep=$VISUAL_GREP} --project=chromium --workers=1 --retries=0 --reporter=line"
if [ "$MODE" = "update" ]; then
  PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --update-snapshots=all"
fi

# CI renders on x86-64. Software GL gives faint per-pixel differences on other
# CPUs (an Apple Silicon Docker is arm64), so render as amd64 too. This is
# emulated, and so slow, on Apple Silicon; set VISUAL_PLATFORM=native to skip.
PLATFORM="${VISUAL_PLATFORM:-linux/amd64}"
PLATFORM_ARGS=()
if [ "$PLATFORM" != "native" ]; then PLATFORM_ARGS=(--platform "$PLATFORM"); fi

# VISUAL_CPUS=0.5 throttles the container, to mimic a slow shared runner.
docker run --rm --ipc=host ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} ${VISUAL_CPUS:+--cpus=$VISUAL_CPUS} \
  -v "$PWD":/repo \
  -v ship-builder-visual-npm-cache:/root/.npm \
  -e MODE="$MODE" \
  -e PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" \
  -e SNAPSHOTS="$SNAPSHOTS" \
  -e VISUAL_TOLERANCE="${VISUAL_TOLERANCE:-}" \
  -e VISUAL_TRIAL_TOLERANCE="${VISUAL_TRIAL_TOLERANCE:-}" \
  -w /work \
  "$IMAGE" \
  bash -c '
    set -euo pipefail
    mkdir -p /work
    tar -C /repo --exclude=./node_modules --exclude=./.next --exclude=./.git \
      --exclude=./test-results --exclude=./playwright-report --exclude=./.claude \
      -cf - . | tar -C /work -xf -
    npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
    status=0
    npx playwright test $PLAYWRIGHT_ARGS || status=$?
    if [ "$MODE" = "update" ]; then
      mkdir -p "/repo/$SNAPSHOTS"
      cp "/work/$SNAPSHOTS"/*-linux.png "/repo/$SNAPSHOTS/"
      chown -R --reference=/repo/package.json "/repo/$SNAPSHOTS"
    elif [ "$status" -ne 0 ]; then
      mkdir -p /repo/test-results
      cp -r /work/test-results/. /repo/test-results/ 2>/dev/null || true
    fi
    exit $status
  '
