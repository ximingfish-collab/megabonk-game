#!/usr/bin/env bash
# Thin wrapper — logic lives in scripts/harness/guard-contract.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/harness/guard-contract.sh"
