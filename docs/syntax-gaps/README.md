# Syntax gaps

These are workouts the language can't yet express tersely and clearly, each
written up so a later session can evolve the syntax to cover it. The
`wdl-author` skill ([.agents/skills/wdl-author/](../../.agents/skills/wdl-author/SKILL.md))
writes these reports when a request runs into one. Anyone can add one by hand
with [the template](../../.agents/skills/wdl-author/references/gap-report-template.md).

**Each report raised from a real workout also gets a queue entry** under
`## Syntax gaps raised from real workouts` in
[docs/context/tasks/current.md](../context/tasks/current.md), marked as such
(Chris's call, 2026-11-21). The queue entry is the handle and the report here
is the detail. A report from a hypothetical or a test has no queue entry until
a real workout hits the same shortfall.

**This folder holds proposals, not decisions.** A report proposes
candidate notations and decides nothing. When a syntax session takes a report
up:

- If the result is a spec change, the spec and grammar change, the decision
  goes to `docs/context/topics/settled-decisions.md`, and the report's
  **Status** becomes `resolved → <spec §, commit>`.
- If it's declined, record the reason in
  `docs/context/topics/deliberately-not-done.md`. The report's **Status**
  becomes `declined → <link>`.

Leave the report in place either way. The record of what was asked for and
why is the useful part.

One file per distinct shortfall, named `YYYY-MM-DD-<short-slug>.md`. When the
same shortfall shows up again, add the new case to that report's **Evidence**
list instead of opening a duplicate. Repeated evidence is how a gap earns
priority.
