#!/bin/sh
# Print the path of a WDL checkout the skill can read and run: the spec, the
# `wdl` CLI and the registry. Tried in order:
#
#   1. $WDL_HOME
#   2. the working directory or any directory above it
#   3. a cached clone of the public GitHub mirror, made on first use and
#      refreshed when it's more than a day old
#
# stdout: the path, and nothing else. stderr: one line saying which source was
# used. Exit 1 when none is available (no checkout and no git or network).
#
# The cached clone is a read-only reference. Don't write reports or queue
# entries into it, because they'd never reach the repo.
#
#   WDL=$(sh <skill>/scripts/wdl-home.sh) || echo "no WDL checkout"

REPO_URL="${WDL_REPO_URL:-https://github.com/tautologistics/workout-description-language.git}"
CACHE_ROOT="${WDL_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/wdl-author}"
CACHE="$CACHE_ROOT/workout-description-language"

is_checkout() { [ -f "$1/spec/spec-0.1.md" ] && [ -f "$1/packages/core/bin/wdl.ts" ]; }

if [ -n "${WDL_HOME:-}" ] && is_checkout "$WDL_HOME"; then
  echo "wdl-home: \$WDL_HOME" >&2
  (cd "$WDL_HOME" && pwd)
  exit 0
fi

dir="$(pwd)"
while :; do
  if is_checkout "$dir"; then
    echo "wdl-home: local checkout" >&2
    echo "$dir"
    exit 0
  fi
  [ "$dir" = "/" ] && break
  dir="$(dirname "$dir")"
done

command -v git >/dev/null 2>&1 || { echo "wdl-home: no checkout found and git is not installed" >&2; exit 1; }

if is_checkout "$CACHE"; then
  # Refresh at most once a day; a failed refresh (offline) keeps the old copy.
  if [ -n "$(find "$CACHE/.git/wdl-author-fetched" -mmin +1440 2>/dev/null)" ] || [ ! -f "$CACHE/.git/wdl-author-fetched" ]; then
    if git -C "$CACHE" fetch --quiet --depth 1 origin main 2>/dev/null &&
       git -C "$CACHE" reset --quiet --hard FETCH_HEAD 2>/dev/null; then
      touch "$CACHE/.git/wdl-author-fetched"
    fi
  fi
  echo "wdl-home: cached clone of $REPO_URL (read-only)" >&2
  echo "$CACHE"
  exit 0
fi

mkdir -p "$CACHE_ROOT" || exit 1
rm -rf "$CACHE"
if git clone --quiet --depth 1 --filter=blob:none --sparse "$REPO_URL" "$CACHE" 2>/dev/null &&
   git -C "$CACHE" sparse-checkout set spec packages/core registry examples/goals docs/syntax-gaps docs/context 2>/dev/null &&
   is_checkout "$CACHE"; then
  touch "$CACHE/.git/wdl-author-fetched"
  echo "wdl-home: cloned $REPO_URL into $CACHE (read-only)" >&2
  echo "$CACHE"
  exit 0
fi
rm -rf "$CACHE"
echo "wdl-home: no checkout found and could not clone $REPO_URL" >&2
exit 1
