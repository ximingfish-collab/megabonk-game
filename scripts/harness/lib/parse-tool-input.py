#!/usr/bin/env python3
"""Parse preToolUse hook JSON from Claude Code or Cursor Agent."""
import json
import sys


def extract(payload: dict) -> tuple[str, str]:
    tool_name = (
        payload.get("tool_name")
        or payload.get("toolName")
        or payload.get("tool")
        or ""
    )

    tool_input = payload.get("tool_input") or payload.get("toolInput") or payload.get("input") or {}
    file_path = ""
    if isinstance(tool_input, dict):
        file_path = (
            tool_input.get("file_path")
            or tool_input.get("filePath")
            or tool_input.get("path")
            or ""
        )

    if not file_path:
        file_path = (
            payload.get("file_path")
            or payload.get("filePath")
            or payload.get("path")
            or ""
        )

    return str(tool_name), str(file_path)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print("\t")
        return

    tool_name, file_path = extract(payload)
    print(f"{tool_name}\t{file_path}")


if __name__ == "__main__":
    main()
