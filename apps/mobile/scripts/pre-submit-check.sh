#!/usr/bin/env bash
# Pre-submission sanity checks for the iOS production build.
# Run from repo root: bash apps/mobile/scripts/pre-submit-check.sh
set -uo pipefail

MOBILE=$(cd "$(dirname "$0")/.." && pwd)
cd "$MOBILE"
fail=0

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
bad()  { printf "\033[1;31m✗ %s\033[0m\n" "$*"; fail=1; }

step "Icon (1024x1024, no alpha)"
if command -v sips >/dev/null; then
  alpha=$(sips -g hasAlpha "$MOBILE/assets/icon.png" 2>/dev/null | awk '/hasAlpha/ {print $2}')
  size=$(sips -g pixelWidth -g pixelHeight "$MOBILE/assets/icon.png" 2>/dev/null | awk '/pixel/ {print $2}' | xargs)
  [ "$alpha" = "no" ] && ok "no alpha channel" || bad "icon has alpha — App Store will reject"
  [ "$size" = "1024 1024" ] && ok "1024x1024" || bad "icon dimensions: $size (need 1024 1024)"
else
  echo "  (skipping; sips not available)"
fi

step "Typecheck"
( cd "$MOBILE" && npm run --silent typecheck ) && ok "tsc clean" || bad "typecheck failed"

step "Tests"
( cd "$MOBILE" && npm test --silent -- --forceExit ) && ok "jest passed" || bad "tests failed"

step "Debug log scan (src/)"
hits=$(grep -rn --include='*.ts' --include='*.tsx' -E 'console\.(log|debug)|// *TODO|// *FIXME|debugger' "$MOBILE/src" 2>/dev/null | wc -l | xargs)
if [ "$hits" -gt 0 ]; then
  echo "  found $hits matches:"
  grep -rn --include='*.ts' --include='*.tsx' -E 'console\.(log|debug)|// *TODO|// *FIXME|debugger' "$MOBILE/src" | head -20
  bad "review the debug/TODO hits above"
else
  ok "no console.log / TODO / debugger in src"
fi

step "Required metadata files"
for f in app-name subtitle description keywords promotional-text release-notes; do
  if [ -s "$MOBILE/store/metadata/$f.txt" ]; then ok "$f.txt"; else bad "missing $f.txt"; fi
done

step "Keywords ≤ 100 chars"
kw=$(tr -d '\n' < "$MOBILE/store/metadata/keywords.txt" | wc -c | xargs)
[ "$kw" -le 100 ] && ok "$kw chars" || bad "$kw chars (limit 100)"

step "Subtitle ≤ 30 chars"
sub=$(tr -d '\n' < "$MOBILE/store/metadata/subtitle.txt" | wc -c | xargs)
[ "$sub" -le 30 ] && ok "$sub chars" || bad "$sub chars (limit 30)"

echo
if [ $fail -eq 0 ]; then
  printf "\033[1;32mAll pre-submission checks passed.\033[0m\n"
  exit 0
else
  printf "\033[1;31mPre-submission checks failed — fix issues above before submitting.\033[0m\n"
  exit 1
fi
