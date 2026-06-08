#!/usr/bin/env bash
# Shared helpers for harness scripts.

if command -v python3 >/dev/null 2>&1; then
  HARNESS_PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  HARNESS_PYTHON=python
else
  HARNESS_PYTHON=""
fi

harness_project_dir() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-$(pwd)}}"
}
