#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo "Usage: $0 <compose-file> [compose-file ...]" >&2
  exit 2
fi

status=0

for compose_file in "$@"; do
  if [[ ! -f "${compose_file}" ]]; then
    echo "Skipping missing compose file: ${compose_file}"
    continue
  fi

  awk -v file="${compose_file}" '
    function leading_spaces(value) {
      match(value, /[^ ]/)
      return RSTART ? RSTART - 1 : length(value)
    }

    function strip_comment(value) {
      sub(/[[:space:]]*#.*/, "", value)
      return value
    }

    BEGIN {
      found = 0
      in_redis = 0
      redis_indent = -1
      in_ports = 0
      ports_indent = -1
    }

    {
      raw = strip_comment($0)
      if (raw ~ /^[[:space:]]*$/) {
        next
      }

      indent = leading_spaces(raw)
      stripped = raw
      sub(/^[[:space:]]+/, "", stripped)

      if (in_redis && indent <= redis_indent && stripped !~ /^-/) {
        in_redis = 0
        in_ports = 0
      }

      if (stripped ~ /^redis[[:space:]]*:[[:space:]]*$/ || stripped ~ /^"redis"[[:space:]]*:[[:space:]]*$/) {
        in_redis = 1
        redis_indent = indent
        in_ports = 0
        next
      }

      if (!in_redis) {
        next
      }

      if (in_ports && indent <= ports_indent && stripped !~ /^-/) {
        in_ports = 0
      }

      if (stripped ~ /^ports[[:space:]]*:/) {
        printf "%s:%d: redis service must not publish host ports; use expose only\n", file, NR
        found = 1
        in_ports = 1
        ports_indent = indent
      }

      if (in_ports && stripped ~ /6379/) {
        printf "%s:%d: redis service publishes Redis port 6379: %s\n", file, NR, stripped
        found = 1
      }
    }

    END {
      exit found ? 1 : 0
    }
  ' "${compose_file}" || status=1
done

if [[ "${status}" -eq 0 ]]; then
  echo "Redis port exposure check passed."
fi

exit "${status}"