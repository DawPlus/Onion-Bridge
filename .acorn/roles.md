# Project Role Overrides

Optional project-only role map. Keep only differences from Acorn defaults.

Rules:
- project override wins over Acorn default;
- read only the matching role entry for current work;
- each role owns only its listed paths/area;
- do not cross into another role's owned area;
- cross-role work returns to Coordinator for a separate ticket or explicit handoff;
- shared files/contracts need one explicit owner before edits.

Example:

```text
frontend -> executor: antigravity | owns: src/**
backend  -> executor: grok        | owns: server/**
tester   -> executor: codex       | owns: test/**
shared   -> coordinator decides owner
```

Delete the example and define only roles this project actually uses.
