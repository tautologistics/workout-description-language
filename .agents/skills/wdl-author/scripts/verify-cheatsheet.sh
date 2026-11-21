#!/usr/bin/env bash
# Extract every ```wdl block from the skill's references and run `wdl check` on
# each one, so the cheatsheet can't drift from the parser. Run it from the repo root.
#   bash .agents/skills/wdl-author/scripts/verify-cheatsheet.sh
set -u
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0
for md in "$here"/references/*.md; do
  awk -v dir="$tmp" -v base="$(basename "$md" .md)" '
    /^```wdl[[:space:]]*$/ { n++; f = sprintf("%s/%s-%02d.wdl", dir, base, n); inblk = 1; next }
    /^```/ && inblk { inblk = 0; close(f); next }
    inblk { print > f }
  ' "$md"
done
for f in "$tmp"/*.wdl; do
  [ -e "$f" ] || continue
  out="$(node packages/core/bin/wdl.ts check "$f" 2>&1)"
  if ! printf '%s' "$out" | grep -q ': ok$'; then
    echo "--- $(basename "$f")"; echo "$out"; fail=1
  fi
done
[ $fail -eq 0 ] && echo "all wdl examples check ok" || exit 1
