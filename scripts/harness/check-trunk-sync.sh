#!/usr/bin/env bash
# scripts/harness/check-trunk-sync.sh
#
# SessionStart hook: warn when the local branch is behind upstream.
# Shared by Claude Code and Cursor. Always exit 0 (warning-only).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

project_dir="$(harness_project_dir)"
if ! git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

cd "$project_dir" || exit 0

branch=$(git symbolic-ref --short -q HEAD 2>/dev/null || echo "")
[ -z "$branch" ] && exit 0

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)
if [ -z "${upstream:-}" ]; then
  default_branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || echo "")
  if [ -z "$default_branch" ]; then
    if git show-ref --verify --quiet refs/remotes/origin/master; then
      default_branch="master"
    elif git show-ref --verify --quiet refs/remotes/origin/main; then
      default_branch="main"
    else
      exit 0
    fi
  fi
  upstream="origin/${default_branch}"
fi

if command -v timeout >/dev/null 2>&1; then
  timeout 5 git fetch --quiet origin 2>/dev/null || exit 0
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout 5 git fetch --quiet origin 2>/dev/null || exit 0
else
  git fetch --quiet origin 2>/dev/null || exit 0
fi

ahead_behind=$(git rev-list --left-right --count "HEAD...${upstream}" 2>/dev/null || echo "")
[ -z "$ahead_behind" ] && exit 0

ahead=$(printf '%s' "$ahead_behind" | awk '{print $1}')
behind=$(printf '%s' "$ahead_behind" | awk '{print $2}')

[ "${behind:-0}" -eq 0 ] && exit 0

if [ -t 2 ]; then
  YELLOW=$'\033[1;33m'
  CYAN=$'\033[1;36m'
  DIM=$'\033[2m'
  RESET=$'\033[0m'
else
  YELLOW=""; CYAN=""; DIM=""; RESET=""
fi

{
  echo ""
  if [ "${ahead:-0}" -gt 0 ]; then
    printf "%s⚠️  Branch %s 与 %s 已分叉 (本地领先 %s / 落后 %s 个 commit)%s\n" \
      "$YELLOW" "$branch" "$upstream" "$ahead" "$behind" "$RESET"
  else
    printf "%s⚠️  Branch %s 落后 %s %s 个 commit%s\n" \
      "$YELLOW" "$branch" "$upstream" "$behind" "$RESET"
  fi
  echo ""
  printf "   %s建议在开始写代码前同步上游改动:%s\n" "$CYAN" "$RESET"
  printf "     %sgit fetch origin%s\n" "$CYAN" "$RESET"
  if [ "${ahead:-0}" -gt 0 ]; then
    printf "     %sgit pull --rebase%s\n" "$CYAN" "$RESET"
  else
    printf "     %sgit pull --ff-only%s  %s# 或 git pull --rebase%s\n" "$CYAN" "$RESET" "$DIM" "$RESET"
  fi
  echo ""
  printf "   %s否则可能在过期内容上改半天才发现冲突。%s\n" "$DIM" "$RESET"
  echo ""
} >&2

exit 0
