#!/usr/bin/env bash
# scripts/harness/guard-contract.sh
#
# PreToolUse hook: blocks file-mutating tools on framework hard-contract files.
# Shared by Claude Code (.claude/hooks/) and Cursor (.cursor/hooks/).
#
# Source of truth: docs/contract.md (section 一: 锁定文件清单)
#
# To unlock: read docs/contract.md, get maintainer approval, then temporarily
# disable the guard-contract hook in .claude/settings.json or .cursor/hooks.json.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

input=$(cat)

[ -z "$HARNESS_PYTHON" ] && exit 0

parsed=$(printf '%s' "$input" | "$HARNESS_PYTHON" "$SCRIPT_DIR/lib/parse-tool-input.py" 2>/dev/null)

# Fail-open if parsing failed
[ -z "${parsed:-}" ] && exit 0

IFS=$'\t' read -r tool_name file_path <<< "$parsed"

# Claude Code: Edit|Write|MultiEdit — Cursor Agent: Write|StrReplace
case "$tool_name" in
  Edit|Write|MultiEdit|StrReplace) ;;
  *) exit 0 ;;
esac

[ -z "$file_path" ] && exit 0

project_dir="$(harness_project_dir)"

# Normalize Windows backslashes
file_path="${file_path//\\//}"
project_dir="${project_dir//\\//}"

rel="${file_path#"$project_dir"/}"
# If path was already relative, rel equals file_path
if [ "$rel" = "$file_path" ] && [[ "$file_path" != /* ]] && [[ "$file_path" != [A-Za-z]:/* ]]; then
  rel="$file_path"
fi
rel="${rel#./}"

# === LOCKED FILES ===
# Update ONLY together with docs/contract.md.
LOCKED_REGEX='^(index\.html|vite\.config\.ts|tsconfig\.json|pnpm-workspace\.yaml|package\.json|template\.yml|kubee\.json|game/core/package\.json|game/client/package\.json|packages/[^/]+/package\.json|packages/i18n/source/.*|packages/platform/source/.*|packages/render-adapter/source/.*|game/client/main\.ts)$'

if printf '%s' "$rel" | grep -Eq "$LOCKED_REGEX"; then
  cat >&2 <<EOF
🔒 [framework-contract] BLOCKED: $rel

This file is part of the framework HARD CONTRACT. Modifying it can break:
  • production build (vite / tsc)
  • KUBEE template deployment
  • workspace package resolution
  • game/client ↔ game/core entry path

If you really need to change it:
  1. Read docs/contract.md  →  section 一: 锁定文件清单
  2. Get maintainer approval (open an Issue with [CONTRACT] prefix)
  3. Temporarily disable guard-contract in .claude/settings.json or .cursor/hooks.json
  4. Make the change + update LOCKED_REGEX in scripts/harness/guard-contract.sh if rules changed
  5. Re-enable the hook before committing

Enforced by Claude Code PreToolUse hook and Cursor preToolUse hook.
EOF
  exit 2
fi

exit 0
