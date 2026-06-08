---
name: check-contract
description: Verify the framework contract is intact — public API exports, GameInstance class signature, i18n key parity, client entry. Run before commits or after large refactors. Source of truth is docs/contract.md.
---

# Check Framework Contract

When invoked, run the verification script and report results.

## What to do

Run this single command from the project root:

```bash
bash scripts/harness/check-contract.sh
```

If the script exits 0, all contract checks pass. Report success briefly.

If the script exits non-zero, the output names which check failed. Report the failures verbatim and propose a fix path:

- **Missing public export** → check `game/core/source/index.ts` and re-export the missing name
- **GameInstance method missing** → the class must keep `start()`, `tick(): boolean`, `applyAction()`, `getState()`, `getResult()` regardless of internal refactor
- **i18n key mismatch** → list the diff and ask the user which side is canonical, then sync
- **Client entry mismatch** → restore the two-line `game/client/main.ts` to its locked form

Do not attempt to fix automatically without surfacing what's wrong first — the contract may be evolving and the user needs to decide.

## When to invoke

- After any refactor to `game/core/source/index.ts`, `GameInstance.ts`, `types.ts`, or `config.ts`
- Before each PR that touches `@minigame/core` public surface
- After deleting / renaming public exports
- When `pnpm build` fails with type errors mentioning missing imports

## Why this exists

The `preToolUse` hook (`scripts/harness/guard-contract.sh`) blocks modification of locked files but **cannot** detect when a public export disappears or a method signature changes. This skill fills that gap. See `docs/contract.md` section 二 for the full list of locked signatures.

For runtime behavior, also run:

```bash
pnpm --filter @minigame/core exec vitest run contract.test.ts
```
