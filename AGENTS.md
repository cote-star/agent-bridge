# Agent Instructions For This Repo

> **Naming convention**: The context pack directory is `.agent-context/`, but npm
> scripts use the `context-pack:*` prefix (e.g. `npm run context-pack:build`).

## End-to-End Understanding Shortcut
When asked to understand this repository end-to-end:
1. Read `.agent-context/current/00_START_HERE.md` first.
2. Use `.agent-context/current/manifest.json` + `20_CODE_MAP.md` to target only relevant source files.
3. Open additional files only when the current task requires deeper proof.

## If Context Pack Is Missing Or Stale
Run:

```bash
npm run context-pack:build
```

## Main Push Context Sync
Install hook once:

```bash
npm run context-pack:install-hooks
```

The pre-push hook updates the context pack only when a push targets `main` and changes context-relevant files.
