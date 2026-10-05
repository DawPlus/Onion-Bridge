# Recovery

Use after interruption, stale context, repeated failure, or nonterminal/uncertain automation.

1. Read `acorn/state.json`.
2. Read `ticketBoardPath` from `acorn/config.json` and verify any active ticket against that project board.
3. Load the role named by the next executor.
4. Load only linked project context needed to continue.
5. Treat handoff and state as continuation caches, never project truth.
6. If handoff or state conflicts with the project ticket SSOT, trust the project SSOT and rebuild the cache.

Before any direct edits or Dispatch, reserve ownership for live/unverifiable workers; Economy fallback never bypasses this gate. Read-only inspection and settlement remain allowed. For an Orca automatic run, also load `acorn/orchestration/ORCHESTRATION.md` and its adapter. A saved `automation` record cannot authorize execution. Require explicit Human auto-resume after pause, cancellation, interruption, or a Human gate; inspect live Orca bindings before any new Dispatch. Preserve repair counts and reserve ownership while worker liveness is unknown. Never create a fresh Run to bypass retry limits or duplicate a possibly active worker.

For failures, isolate the first relevant cause. Do not repeat the same attempt beyond `workflow.maxAgentRetries`; return the evidence and smallest next recovery action to Human/Coordinator.
