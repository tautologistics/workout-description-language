# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

The deployment epic (items 18–20) **landed 2026-08-30** and the **builder
layout redesign** — direction **C (Document + margin)**, the ten-stage chain
**R1 → R10** — **landed 2026-08-31**. Both are in [completed.md](completed.md),
each grouped as one section. The redesign's absorbed chain items (12 ↔ R2,
16 ↔ R3, 17 ↔ R9, 15 a/c/d ↔ R3 + R10) closed with it.

**Item 21 (a root Makefile task surface) landed 2026-08-31** —
[DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson).
**Item 11 (a bare-word block header is an inert section) landed 2026-08-31**
(`70a1852`) — [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section).
**Item 13 (laterality in the builder's `»` panel) is closed entirely as of
2026-08-31** — 13c `02d819d` (append/double bug), 13b `cf3c47f`
([DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised),
the per-side form is parenthesised), 13a-curation `71f9469` (the
`lateralityAxis` registry field), 13a `1ffc8d0` (the `»` panel renders the
axis — `(each direction)`). See [completed.md](completed.md).

**Every earlier numbered item is closed** — the whole 0-series through 21, the
deployment epic (18–20) and the redesign chain (R1–R10). **The
*Movements in the database — Phase 1* epic is also complete as of 2026-09-01**:
M0–M7 all landed (M6, the nightly VPS DB backup, `97f236f`), and the whole
M-section moved to [completed.md](completed.md) as one grouped section, the way
the deployment epic and the redesign chain were closed.

**The *workout library* epic (L0–L7) is complete as of 2026-09-01** — all of
L0–L7 landed and the whole L-section moved to [completed.md](completed.md) as one
grouped section (the last link, **L7 (`<TASK-SHA>`)**, surfaced the library: an
**Examples** chip row in the builder's *My workouts* panel that browses each org
account's public set — `crossfit` 31 / `hyrox` 9 / `tabata` 3 — plus a per-row
`↗` "Open on the board" shortcut; app code only, `make test` unchanged). The
board resolves `?w=<handle>:<slug>` end to end and shows the namespaced id in the
`#meta` strip. This absorbed most of the deferred account-namespacing rethink;
what is left of it — the board **Edit** button round-tripping into the builder —
is a loose bullet below.

**No epic is in flight. Three standalone tasks are queued, all dispatchable now:**

- **unit defaults** — a unitless `@ 95` load target reads as `95lb` (pound is
  the default); a unitless magnitude on a machine/aerobic movement reads as
  calories.
- **board: dismissible notifications** — a "Clear notifications" footer button.
- **board: the `#` title moves into the meta strip** — not a body row; `@id`
  shown small in parentheses after it.

Recently closed (kept here briefly for the trail):

- **~~The `»` panel's per-implement load token (`@ 2x`) is unclear
  mid-edit~~ — landed 2026-09-01 (`00f599c`).** The seeded `@ Nx` token
  stays (it carries the implement count, and a bare `@ Nx` round-trips clean —
  unlike the plain-load `@ `); its *reading* was fixed instead — the pick's
  label now names the finished shape (`@ 2x — load, per implement (2) — then
  type the weight: @ 2x35lb`) and a transient inline hint appears by the caret
  after the pick. Full write-up in
  [../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.

---

## Standalone task — unit defaults: a unitless load target is pounds

*Raised 2026-09-01 by Chris, answering the open question from the `»`-panel
task's report. Settles the "what a target with no unit means" Open item in
[../topics/known-debts.md](../topics/known-debts.md). Two rules with very
different blast radii — rule 1 is a real parser/spec change, rule 2 is a
builder-only diagnostic — and they can land separately.*

Chris's call, verbatim intent: **"A unitless `@ 95` should just be 95 pounds.
Pound should be the default for any exercise that carries a load. Something like
rowing / machines / running — any aerobic work that carries no load — the safe
assumption is calories (that is what I have always seen). Distance is never
unitless in practice — it is always feet or metres (rarely miles) — so it keeps
requiring its unit."**

This **overrides** the current holding answer, which
[../topics/known-debts.md](../topics/known-debts.md) states deliberately: today
`@ 95` parses to `{kind: 'raw', text: '95'}` — held, meaning nothing — on the
reasoning that "`@95` is 95lb in one gym and 95kg in another, so a default is an
invention". Chris is settling it: **the default is `lb`**, stated once here
rather than left as raw.

Two rules, and the second is the bigger change:

1. **`@ <number>` with no unit → `<number>lb`** — a `Load` with `unit: 'lb'`,
   not `raw`. `Load.unit` is a required `'lb' | 'kg'` today, so this is either
   "default the parse to `lb`" (simplest — the AST never carries an absent
   unit) or "make `unit` optional and default at every read site". Prefer the
   former: `targetText` / the load rule fills `lb` when the magnitude has no
   unit suffix. Reaches `formatLoad` (canonical output becomes `@ 95lb` — decide
   whether `wdl fmt` *rewrites* `@ 95` to `@ 95lb` or leaves it; likely
   rewrites, since the format's job is to make the reading explicit), volume,
   muscle analysis, every exporter, and the golden files.
2. **A unitless magnitude on a non-load machine/aerobic movement — a
   *builder-only suggesting diagnostic*, not a parse-level default**
   (Chris, 2026-09-01). `15 Row` on a machine that measures calories: the
   **builder** shows a diagnostic suggesting the unit ("did you mean
   `15cal Row`?"), registry-derived (the row's movement resolves to an entry
   with `measures` including `calories` and no `load`). The **board stays
   agnostic** — it renders exactly what was written, no defaulting, no
   forced calories. So this rule is **not** a `parse.ts` / grammar / spec
   semantics change: the parser keeps the magnitude as-is; only
   `apps/builder/builder.js`'s diagnostics/findings gain the suggestion. A
   `spec` *note* that a bare magnitude on a calorie-measured machine is
   ambiguous is fine; the reading is not changed. Can land independently of
   rule 1 (and is much smaller).

Scope — **rule 1**: `spec/spec-0.1.md` §3/§7, `spec/grammar-0.1.ohm`,
`packages/core/src/parse.ts` + the load/target semantics, `packages/core/src/`
formatter and anything walking `targets` for `kind === 'load'`, the golden
files (`node packages/core/test/golden/generate.ts`, read the diff — load-by-
muscle moves), `test/grammar.test.ts` + `test/golden/vocabulary.ts` (six forms
are pinned there as `was-wrong`; `@ 95` joins them). No app change strictly
required. **Rule 2**: `apps/builder/builder.js` diagnostics/findings only —
registry-derived suggestion, no core/spec-semantics change; the board is
untouched.

---

## Standalone task — board: parse errors / notifications must be dismissible

*Raised 2026-09-01 by Chris, driving the board.*

The board shows parse errors (and other notifications) in a red strip at the
bottom. **Showing them is right; there is no way to dismiss them.** Wanted:
either a per-line `✕`, or — Chris's preference — a **"Clear notifications"
button in the footer control row, beside Start / Next / Back / Reset**. It
clears the strip until the next parse/notification event repopulates it.

Scope: `apps/display/board.js` (the footer control assembly and the
diagnostics/notifications render — find where the red strip is drawn and where
`el('reset')` etc. are wired), `apps/display/board.css` (button + a `.hidden`
or emptied state for the strip), `apps/display/index.html` if the footer
buttons are static markup rather than built in JS. The board has no light
theme — verify dark only. No core change. Small and self-contained.

---

## Standalone task — board: the `#` title belongs in the meta strip, not the body

*Raised 2026-09-01 by Chris, driving the board. Closes the "reversible default
— open whether it moves into the strip too" question left by item 15b (see
[../topics/builder-ux.md](../topics/builder-ux.md) "The board", and
[../topics/what-exists.md](../topics/what-exists.md) Apps row).*

Today the workout's `# Title` line renders as the **first board body row**,
sitting among the movements an athlete reads mid-set. It should not be a body
row. Wanted:

- The `# Title` moves **into the `#meta` strip under the bar** — the strip that
  currently shows only the `@id`. The **title shows there**, prominent.
- If the workout also has an `@id`, it shows **smaller, in parentheses after
  the title** — `Fran (crossfit:fran)`.
- The workout **body renders line-for-line from the first non-preamble line** —
  the `# title` line joins the preamble run that `preambleEnd()` already
  detects and is not drawn as a `.line` row (keep `dataset.line` 1:1 with the
  source so `paint()`'s physical-line cue matching stays correct, same
  technique item 15b used for `@key` lines).

Scope: `apps/display/board.js` (`preambleEnd()` / `draw()` — extend the
hidden-preamble run to the `# title` line; the `#meta` strip render — add the
title, parenthesise the id), `apps/display/board.css` (`#meta` title vs. id
sizing). Update [../topics/what-exists.md](../topics/what-exists.md) (the Apps
row currently says "the `# title` stays the first board row"). Dark only. No
core change.

---

## Loose bullets — unscheduled, need Chris to scope

- **A full laterality curation sweep** — not a numbered item. `around-worlds` is
  the only movement carrying `lateralityAxis`. The audit-CSV tooling is ready:
  `export-movement-curation.mjs` (`make curation:sheet`) emits the sheet with a
  `Laterality axis` column in both the CURRENT and CURATE blocks, and
  `import-movement-curation.mjs` lands it back. A sweep is run via that CSV per
  [../topics/running-it.md](../topics/running-it.md), not hand-edits — needs
  Chris to scope which movements. Note `around-worlds` itself looks mis-sourced
  (free-exercise-db's "Around The Worlds" is a lying dumbbell bench fly, not the
  kettlebell around-the-head movement its `lateralityAxis: "direction"` +
  `per-side` describe) — the sweep should resolve what that entry is. The CSV is
  now the **bulk** path; per the rethink below, one-at-a-time movement edits are
  headed into an in-app GUI.

- **Post-redesign rethinks** (not scheduled) — the board's **Edit** button
  round-tripping into the builder. *Everything else in that thread —
  `@id` ↔ record-id correlation, the account namespace, `users.handle`,
  `workouts.wdlId`, forcing the `@id` namespace on save, an "open on the board"
  action — is now in **The workout library (L0–L7)** above; the handle-rename
  debt is in [../topics/known-debts.md](../topics/known-debts.md).* In
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

