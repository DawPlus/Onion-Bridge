# Workflow

Canonical managed-work lifecycle:

`Request -> Coordinator Define -> Ticket -> Dispatch -> Worker -> Verify -> Completion Report -> Coordinator Review -> QA -> Done`

Quick work may use `Request -> Change -> Verify -> Report` with no ticket.

Automatic dispatch and repair supervision require a current explicit Human request scoped to named tickets. In Orca, load `acorn/orchestration/ORCHESTRATION.md` and its adapter; ordinary ticket picks and `transport.default` do not authorize automation. The conversation Agent coordinates the loop; no standalone Acorn CLI runner exists.

## Request / Ticket Decision

Classify by coordination value, not ceremony:
- `quick`: tiny, local, low-risk -> no ticket.
- `minor`: use a ticket when another role/shared asset is involved or acceptance is unclear; otherwise treat it like Quick.
- `feature` / `major`: managed work; ticket by default.

Escalation signals: cross-role ownership, dependency, schema/migration, config, shared/risky assets, broad file impact, or unclear acceptance.

## Coordinator Define

Coordinator owns scope, routing, dependencies, acceptance, and unresolved decisions.
- Select only the Worker roles required by the work.
- Write the ticket as a compact source-of-truth work record: `Goal / Do / Keep / Done / Role`; add `Depends` only when required.
- Keep fields short and omit repeated Harness rules or discoverable implementation detail.
- Give each shared asset/contract one responsible role.
- Ask Human only for ambiguous product/UX, destructive actions, breaking contracts/migrations, permissions, risky git, or external decisions.
- Do not design speculative implementation details.

## Dispatch / Worker

Dispatch one scoped ticket/session pick. The Human-carried prompt should normally contain only the ticket/session pick plus an optional one-line instruction; the Worker reads the referenced ticket as source of truth.
On dispatch, Coordinator sets Board `state=in_progress` and `Next=worker` (or the assigned worker role).
Worker:
- stays inside scope and ownership;
- for behavior-changing implementation, follows `RED -> GREEN -> REFACTOR`: add/update the smallest relevant test, observe the expected failure, implement the minimum passing change, then refactor only when useful;
- skips test-first only when it is not meaningfully applicable and records why;
- makes the smallest working change;
- routes cross-role/out-of-scope dependencies back to Coordinator;
- runs focused verification and relevant regression checks;
- returns a compact Completion Report with TDD evidence when applicable.

## Verify

Run the smallest useful checks for the changed scope. Never invent PASS.
A same-scope verification failure returns to Worker. `workflow.maxAgentRetries` counts additional repair attempts after the initial attempt (default 2). Share the budget across verification, review, and QA; preserve it through recovery. Stop when exhausted and report a blocker instead of looping.

## Coordinator Review

Coordinator reviews the Completion Report against scope, acceptance, contracts, ownership, and verification evidence. Worker does not change Board/state; Coordinator moves returned managed work to `review` with `Next=coordinator`.
- accepted + QA `off` -> `done`.
- accepted + QA `human` -> `ready_for_qa` with `Next=human`.
- accepted + QA `agent` -> `ready_for_qa` with `Next=qa`.
- same-scope defect -> repair on the same ticket and review again.
- separate/new work -> create or propose a follow-up ticket, then dispatch it through the same lifecycle.
- Human decision required -> block and ask only that decision.

## QA

The executor configured by `roles.qa.executor` (`human`, `agent`, or `off`) controls the QA gate. When enabled, QA validates acceptance and meaningful side effects.
- same-scope failure -> repair loop on the same ticket.
- separate issue -> new Request/ticket classification.

## Done

After required gates pass:
- mark managed work done;
- keep project truth/continuity artifacts consistent;
- report the result compactly.

Closeout is a separate explicit session-finalization intent. Load `acorn/workflow/CLOSEOUT.md` to reconcile Board/project truth, state, compact handoff, selective EOD, and docs consistency.
