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
grouped section (the last link, **L7 (`2557177`)**, surfaced the library: an
**Examples** chip row in the builder's *My workouts* panel that browses each org
account's public set — `crossfit` 31 / `hyrox` 9 / `tabata` 3 — plus a per-row
`↗` "Open on the board" shortcut; app code only, `make test` unchanged). The
board resolves `?w=<handle>:<slug>` end to end and shows the namespaced id in the
`#meta` strip. This absorbed most of the deferred account-namespacing rethink;
what is left of it — the board **Edit** button round-tripping into the builder —
is a loose bullet below.

**No epic is in flight. One standalone task is queued, dispatchable now:**

- **unit defaults** — a unitless `@ 95` load target reads as `95lb` (pound is
  the default); a unitless magnitude on a machine/aerobic movement reads as
  calories.

Recently closed (kept here briefly for the trail):

- **~~board: the `#` title belongs in the meta strip, not the body~~ — landed
  2026-09-01 (`<TASK-SHA>`).** The `# Title` line now joins the hidden preamble
  run (`draw()`'s preamble test covers a `#`-line in the leading run) and shows
  in the `#meta` strip as the prominent lead element, with any `@id` small and
  dim in parentheses after it (`Fran (crossfit:fran)`); `dataset.line` stays 1:1
  so the cue marker still tracks the right physical lines, and the strip still
  hides when the workout sets none of title / `@id` / `@tags`. `apps/display/`
  only (`board.js` `draw()` + `renderMeta()`, `board.css` `.meta .title` / `.meta
  .id`, `index.html` comment); dark verified; `make test` unchanged (2064/2064,
  1 pending). Closes the "reversible default" question left by item 15b —
  write-up in [../topics/builder-ux.md](../topics/builder-ux.md) under "The
  board".
- **~~board: parse errors / notifications must be dismissible~~ — landed
  2026-09-01 (`01c0af3`).** A **Clear notifications** button now sits in the
  board's footer control row (static markup in `apps/display/index.html`, beside
  Reset), shown only while the red `#problems` strip has content and hidden with
  it. One `setProblems(text = '')` helper in `apps/display/board.js` is the
  single show/hide path — it sets the strip text, `problems.hidden`, and the
  button's `hidden` together; `recue()`, `loadShared()`'s catch and
  `showEmpty()` all route through it. Clicking the button calls `setProblems()`
  with no text, so the strip is genuinely `hidden` (`[hidden]{display:none}` — no
  reserved gap), not suppressed: the next `recue()` (a reparse, a `?w=` load, a
  division change) repopulates it if anything is still wrong. `apps/display/`
  only; dark verified; `make test` unchanged (2064/2064, 1 pending). Write-up in
  [../topics/builder-ux.md](../topics/builder-ux.md) under "The board".
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

