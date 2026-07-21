#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${repo_root}"

if [[ ! -f ".githooks/pre-commit" ]]; then
  echo "Missing .githooks/pre-commit"
  exit 1
fi

chmod +x scripts/check-no-secrets.sh .githooks/pre-commit
git config core.hooksPath .githooks

echo "Secret guard installed."
echo "Git hooks path: $(git config --get core.hooksPath)"