#!/usr/bin/env bash
# Creates a git worktree for modelling one part (or family) in parallel with
# other checkouts: .claude/worktrees/<name> on a new branch assets/<name>,
# cut from the current HEAD. BRANCH_PREFIX picks another prefix (feat/...).
#
#   scripts/assets/worktree.sh <name>
#
# node_modules is an APFS clone of the main checkout's (instant, shares disk
# blocks), so Turbopack and the e2e build work; elsewhere it falls back to a
# symlink. The downloaded references are symlinked from the main checkout. Each worktree has its own .next, assets/out and public/asset-studio,
# so scoring and check-ins never collide. Remove one with:
#   git worktree remove --force .claude/worktrees/<name> && git branch -D assets/<name>
set -euo pipefail

name="${1:-}"
if [[ -z "$name" || "$name" == -* || "$name" == */* ]]; then
  echo "usage: scripts/assets/worktree.sh <name>" >&2
  exit 1
fi

# The main checkout, even when run from inside another worktree.
main="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
dir="$main/.claude/worktrees/$name"
branch="${BRANCH_PREFIX:-assets}/$name"

if [[ -e "$dir" ]]; then
  echo "$dir already exists" >&2
  exit 1
fi
if git -C "$main" show-ref --verify --quiet "refs/heads/$branch"; then
  echo "branch $branch already exists" >&2
  exit 1
fi

git -C "$main" worktree add -b "$branch" "$dir" HEAD
if ! cp -cR "$main/node_modules" "$dir/node_modules" 2>/dev/null; then
  rm -rf "$dir/node_modules"
  ln -s "$main/node_modules" "$dir/node_modules"
fi
# References are not committed; share the main checkout's downloads.
if [[ -d "$main/assets/refs" ]]; then
  mkdir -p "$dir/assets"
  for item in "$main"/assets/refs/*; do
    base="$(basename "$item")"
    [[ "$base" == "manifest.json" ]] && continue
    ln -s "$item" "$dir/assets/refs/$base" 2>/dev/null || true
  done
fi

cat <<MSG

Worktree ready: $dir  (branch $branch)

  cd "$dir"
  npm run assets:score -- <part>
  npm run assets:checkin -- <part> [<part> ...]
  npm run assets:measure -- <part>

Dev servers: set ASSETS_PORT=<port> to choose the port, else a free one is
picked. If node_modules fell back to a symlink, the scripts start Next with
--webpack (Turbopack refuses one). They stop only the server they started.
MSG
