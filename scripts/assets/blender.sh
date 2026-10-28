#!/usr/bin/env bash
# Run Blender headless. Blender exits 0 even when a Python script raises,
# so entry scripts must sys.exit(1) on failure.
exec "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup "$@"
