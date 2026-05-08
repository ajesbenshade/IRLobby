#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${repo_root}"

scan_all=false
if [[ "${1:-}" == "--all" ]]; then
  scan_all=true
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [--all]"
  echo "  default: scan staged files"
  echo "  --all:   scan tracked files for CI/preflight use"
  exit 0
fi

if [[ "${scan_all}" == "true" ]]; then
  files_to_scan="$(git ls-files)"
else
  files_to_scan="$(git diff --cached --name-only --diff-filter=ACMRTUXB)"
fi

if [[ -z "${files_to_scan}" ]]; then
  exit 0
fi

blocked_path_regex='(^|/)(\.env$|\.env\.local$|\.env\.production$|\.env\..*\.local$|\.pem$|\.key$|\.p8$|\.p12$|\.jks$|\.keystore$|id_rsa$|id_ed25519$|irlobby_deploy$|service-account.*\.json$|play-service-account\.json$|credentials\.json$)'
# Allow CI workflow fake credentials (they are not real secrets)
secret_value_regex='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|BEGIN[[:space:]]+((OPENSSH|RSA|DSA|EC)[[:space:]]+)?PRIVATE[[:space:]]+KEY|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|STRIPE_(API_KEY|WEBHOOK_SECRET)\s*=\s*(sk|whsec)_[^[:space:]]+)'

# Skip .github/workflows/* when scanning for secrets (CI uses placeholder values)
if [[ "${scan_all}" == "true" ]]; then
  files_to_scan=$(echo "${files_to_scan}" | grep -v '^\.github/workflows/')
fi

blocked_files=()
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ "${file}" =~ ${blocked_path_regex} ]]; then
    blocked_files+=("${file}")
  fi
done <<< "${files_to_scan}"

if (( ${#blocked_files[@]} > 0 )); then
  if [[ "${scan_all}" == "true" ]]; then
    echo "Secret scan failed: tracked files include secret-bearing paths."
  else
    echo "Commit blocked: staged files include secret-bearing paths."
  fi
  printf ' - %s\n' "${blocked_files[@]}"
  echo "Move secrets to local env files or your cloud secret manager, then unstage these files."
  echo "Hint: git restore --staged <file>"
  exit 1
fi

matched_lines=""
match_file="$(mktemp -t irlobby_secret_scan_match.XXXXXX)"
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ ! -f "${file}" ]]; then
    continue
  fi

  staged_content="$(git show ":${file}" 2>/dev/null || true)"
  if [[ -z "${staged_content}" ]]; then
    continue
  fi

  if printf '%s\n' "${staged_content}" | rg --line-number --no-heading -E "${secret_value_regex}" >"${match_file}" 2>/dev/null; then
    while IFS= read -r line; do
      matched_lines+="${file}:${line%%:*}"$'
'
    done < "${match_file}"
  fi
done <<< "${files_to_scan}"

rm -f "${match_file}" || true

if [[ -n "${matched_lines}" ]]; then
  if [[ "${scan_all}" == "true" ]]; then
    echo "Secret scan failed: potential secrets detected in tracked content."
  else
    echo "Commit blocked: potential secrets detected in staged content."
  fi
  echo "Review these file/line locations and move sensitive values to env vars or secret manager:"
  printf '%s' "${matched_lines}"
  echo "If this is a false positive, update scripts/check-no-secrets.sh with a narrower pattern."
  exit 1
fi

exit 0