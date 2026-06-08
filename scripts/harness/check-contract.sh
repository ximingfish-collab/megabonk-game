#!/usr/bin/env bash
# scripts/harness/check-contract.sh
#
# Verifies the framework contract defined in docs/contract.md (section 二).
# Exit 0 = all checks pass. Exit 1 = one or more checks failed.
#
# Shared by Claude Code skill and Cursor skill.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_DIR="$(harness_project_dir)"
cd "$PROJECT_DIR" || { echo "❌ cannot cd to $PROJECT_DIR"; exit 1; }

if [ -z "$HARNESS_PYTHON" ]; then
  echo "❌ python3 or python is required for contract checks"
  exit 1
fi

FAIL=0
pass() { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; FAIL=1; }

echo ""
echo "▸ Check 1: @minigame/core public exports"
INDEX="game/core/source/index.ts"
if [ ! -f "$INDEX" ]; then
  fail "$INDEX not found"
else
  EXPORTED=$("$HARNESS_PYTHON" - "$INDEX" <<'PY'
import re, sys
content = open(sys.argv[1]).read()
names = set()
for m in re.finditer(r'export\s+(?:type\s+)?\{([^}]*)\}', content, re.DOTALL):
    for raw in m.group(1).split(','):
        n = raw.strip().split(' as ')[0].strip()
        if n: names.add(n)
print(' '.join(sorted(names)))
PY
)

  has() { printf ' %s ' "$EXPORTED" | grep -Fq " $1 "; }

  has "GameInstance"        && pass "GameInstance exported"        || fail "GameInstance not exported from $INDEX"

  for t in GameState GameConfig GameResult InputState; do
    has "$t" && pass "type ${t} exported" || fail "type ${t} not exported"
  done

  for c in TICK_INTERVAL_MS DEFAULT_GAME_CONFIG; do
    has "$c" && pass "const ${c} exported" || fail "const ${c} not exported"
  done
fi

echo ""
echo "▸ Check 2: GameInstance class signature"
GAME_INSTANCE="game/core/source/GameInstance.ts"
if [ ! -f "$GAME_INSTANCE" ]; then
  fail "$GAME_INSTANCE not found"
else
  grep -Eq "export\s+class\s+GameInstance\b" "$GAME_INSTANCE" \
    && pass "class GameInstance declared" \
    || fail "class GameInstance not declared"

  for method in "start" "tick" "applyAction" "getState" "getResult"; do
    if grep -Eq "(^|\s)${method}\s*\(" "$GAME_INSTANCE"; then
      pass "method ${method}() declared"
    else
      fail "method ${method}() missing"
    fi
  done
fi

echo ""
echo "▸ Check 3: i18n key parity (en.json ↔ zh.json)"
EN="i18n/en.json"
ZH="i18n/zh.json"
if [ ! -f "$EN" ] || [ ! -f "$ZH" ]; then
  fail "missing i18n file: en=$([ -f $EN ] && echo ✓ || echo ✗) zh=$([ -f $ZH ] && echo ✓ || echo ✗)"
else
  parity=$("$HARNESS_PYTHON" - "$EN" "$ZH" <<'PY'
import json, sys
def flatten(d, prefix=""):
    out = set()
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict): out |= flatten(v, key)
        else: out.add(key)
    return out
en = flatten(json.load(open(sys.argv[1])))
zh = flatten(json.load(open(sys.argv[2])))
only_en = en - zh
only_zh = zh - en
if not only_en and not only_zh:
    print("OK")
else:
    if only_en: print("EN_ONLY:" + ",".join(sorted(only_en)))
    if only_zh: print("ZH_ONLY:" + ",".join(sorted(only_zh)))
PY
)
  if [ "$parity" = "OK" ]; then
    pass "en.json and zh.json have identical key sets"
  else
    fail "key mismatch:"
    printf '%s\n' "$parity" | sed 's/^/      /'
  fi
fi

echo ""
echo "▸ Check 4: client entry (game/client/main.ts)"
ENTRY="game/client/main.ts"
if [ ! -f "$ENTRY" ]; then
  fail "$ENTRY not found"
else
  grep -Eq "from\s+['\"]@minigame/client['\"]" "$ENTRY" \
    && pass "imports from @minigame/client" \
    || fail "does not import from @minigame/client"

  grep -Eq "\bbootGameClient\s*\(" "$ENTRY" \
    && pass "calls bootGameClient()" \
    || fail "does not call bootGameClient()"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "✅ Framework contract intact."
  exit 0
else
  echo "❌ Contract violations detected. See docs/contract.md for the full rules."
  exit 1
fi
