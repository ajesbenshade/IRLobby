#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${repo_root}"

staged_files="$(git diff --cached --name-only --diff-filter=ACMRTUXB)"
if [[ -z "${staged_files}" ]]; then
  exit 0
fi

blocked_path_regex='(^|/)(\.env(\..*)?$|\.env\.production$|\.pem$|\.key$|id_rsa$|id_ed25519$|service-account.*\.json$|credentials\.json$)'
secret_value_regex='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|BEGIN[[:space:]]+PRIVATE[[:space:]]+KEY|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|SECRET_KEY\s*=\s*[^[:space:]]+|EMAIL_HOST_PASSWORD\s*=\s*[^[:space:]]+|STRIPE_(API_KEY|WEBHOOK_SECRET)\s*=\s*[^[:space:]]+)'

blocked_files=()
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ "${file}" =~ ${blocked_path_regex} ]]; then
    blocked_files+=("${file}")
  fi
done <<< "${staged_files}"

if (( ${#blocked_files[@]} > 0 )); then
  echo "Commit blocked: staged files include secret-bearing paths."
  printf ' - %s\n' "${blocked_files[@]}"
  echo "Move secrets to local env files or your cloud secret manager, then unstage these files."
  echo "Hint: git restore --staged <file>"
  exit 1
fi

matched_lines=""
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ ! -f "${file}" ]]; then
    continue
  fi

  staged_content="$(git show ":${file}" 2>/dev/null || true)"
  if [[ -z "${staged_content}" ]]; then
    continue
  fi

  if printf '%s\n' "${staged_content}" | rg --line-number --no-heading -E "${secret_value_regex}" >/tmp/irlobby_secret_scan_match.$$ 2>/dev/null; then
    while IFS= read -r line; do
      matched_lines+="${file}:${line}"$'\n'
    done < /tmp/irlobby_secret_scan_match.$$
  fi
done <<< "${staged_files}"

rm -f /tmp/irlobby_secret_scan_match.$$ || true

if [[ -n "${matched_lines}" ]]; then
  echo "Commit blocked: potential secrets detected in staged content."
  echo "Review these matches and move sensitive values to env vars or secret manager:"
  printf '%s' "${matched_lines}"
  echo "If this is a false positive, update scripts/check-no-secrets.sh with a narrower pattern."
  exit 1
fi

exit 0