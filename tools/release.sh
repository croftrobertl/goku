#!/bin/zsh
# Usage: tools/release.sh 1.2.0
# Bumps the version in sw.js and js/version.js together, then checks that the
# release is safe to publish: every offline file exists, every app file is listed
# in the offline list, every script parses, and every theme color passes contrast. Exits non-zero on any problem.
set -eu
cd "$(dirname "$0")/.."
v="${1:-}"
[[ "$v" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "Give a version like 1.2.0"; exit 1; }

sed -i '' "s/^const CACHE_VERSION = '.*';/const CACHE_VERSION = '$v';/" sw.js
sed -i '' "s/^export const VERSION = '.*';/export const VERSION = '$v';/" js/version.js

fail=0
listed=$(grep -o "'\./[^']*'" sw.js | tr -d "'" | sed 's|^\./||' | grep -v '^$' || true)
for f in ${(f)listed}; do [[ -f "$f" ]] || { echo "Missing offline file: $f"; fail=1; }; done
for f in index.html manifest.webmanifest css/*.css js/*.js icons/*.png; do
  print -r -- "$listed" | grep -qx -- "$f" || { echo "Not in the offline list (sw.js FILES): $f"; fail=1; }
done
tmp=$(mktemp -d)
for f in js/*.js; do cp "$f" "$tmp/$(basename "$f" .js).mjs"; node --check "$tmp/$(basename "$f" .js).mjs" || { echo "Syntax error: $f"; fail=1; }; done
node --check sw.js || { echo "Syntax error: sw.js"; fail=1; }
node tools/check-themes.mjs >/dev/null 2>&1 || { node tools/check-themes.mjs; fail=1; }
rm -rf "$tmp"
grep -q "\"$v\"\|'$v'" js/version.js || fail=1
(( fail == 0 )) && echo "Release $v checks passed." || { echo "Release $v has problems. Fix them before publishing."; exit 1; }
