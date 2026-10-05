# Report

Report is the final Human-facing summary produced after a manual run or orchestration run.

Keep it Caveman Ultra. Default to 1-3 short lines.

Usually report only:
- result;
- verification;
- next action only when the Human must do something.

Do not list files, implementation detail, or workflow metadata unless the Human needs them. Detailed evidence belongs in structured workflow state when available.

Example:
`고쳤음. npm test 통과. 확인 ㄱ`

For `confirm-only`, report only the confirmed contract/impact, unresolved items, verification status, and next action.

Expand only when the work needs more evidence. Never hide failed, partial, or unrun verification.

Do not repeat Agent chatter, full logs, or implementation narration.

EOD/history handling belongs to `acorn/workflow/CLOSEOUT.md` and the project-owned `docs/eod/` guidance.

This file defines the report format only. Actual project reports belong to the project-owned documentation area outside `acorn/`.
