# Ticket Board

This board is the status source of truth.

| Ticket | Title | State | Next | Role | Mode | Read Budget | Links | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-261003-01 | Web Onion control MVP | in_progress | worker | worker | implementation | 1+2 | - | Human QA expanded scope: per-project controls, folder picker, setup settings, UI polish. |
| T-261003-02 | Web dashboard and settings UI | superseded | - | worker | implementation | 1+2 | T-261003-01 | Merged into T-261003-01. |

Allowed states: `draft`, `ready`, `in_progress`, `review`, `ready_for_qa`, `blocked`, `done`, `superseded`.

Lifecycle:

```text
draft -> ready -> in_progress -> review -> ready_for_qa -> done
                                      \-> done (QA off)
```

Rules:
- This header and column order are a Core contract; do not rename or reorder them.
- Quick work does not need a board row.
- Create a ticket when coordination/risk justifies the overhead. Ticket IDs use `T-YYMMDD-NN`; reset `NN` to `01` each day. Keep ticket content compact: `Goal / Do / Keep / Done / Role`, plus optional `Read` and `Depends`; extra detail only when safety or ambiguity requires it. `Read` names only the best 1-2 starting files or a Code Map area. The ticket is source of truth; dispatch prompts should reference it instead of copying it.
- Human-facing role names may be capitalized; persisted `Role`/`Next` values use lowercase configured role/executor names. Defaults are `coordinator`, `worker`, `qa`, `human`, or `-`; projects may add or remap role names in project-owned configuration/docs when needed.
- Worker does not change Board/state. When Coordinator receives the Completion Report, Coordinator moves managed work to `review` with `Next=coordinator`.
- `draft`: scope/acceptance/ownership still unresolved.
- `ready`: enough information exists to dispatch safely.
- `review`: Worker verification/report is ready for Coordinator Review.
- `ready_for_qa`: Coordinator Review passed and configured QA remains.
- `blocked`: a real dependency or Human decision prevents progress.
- Same-scope defects reuse the ticket; separate work is classified as a new request.
- Do not guess ownership or silently cross role boundaries.
- Keep `done` tickets on Board for 5 days, then move them to `docs/tickets/archive/YYYY-MM.md`. Never archive unfinished tickets. Archive is history and must not be preloaded.
- Board reset/deletion is destructive and requires explicit authorization.

Mode:
- `confirm-only`: clarify contract/impact/prompts; no implementation by default.
- `implementation`: implementation/docs changes allowed; focused verification required.

Read Budget:
- `1+2`: ticket/board row plus at most two directly related files by default.
- Expand only when needed and state why.

Keep detail in ticket/project docs. Keep this board compact.
