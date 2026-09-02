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

**No epic is in flight, and the standalone queue is empty.** Every numbered
queue item is closed and all three post-library standalone tasks have landed.
What remains is the two loose bullets below, which need Chris to scope.

Recently closed (kept here briefly for the trail):

- **~~unit defaults: a unitless load target is pounds~~ — landed 2026-09-01
  (rule 1 `<RULE1-SHA>`, rule 2 `<RULE2-SHA>`).** Rule 1: `@ <number>` with no
  unit now parses to a real `load` (`{kind:'absolute', unit:'lb', value}`) and
  `wdl fmt` rewrites `@ 95` → `@ 95lb` — pound is the documented default for a
  load that omits its unit (design rule 3), overriding the "a default is an
  invention" holding answer. `parseTarget` in `packages/core/src/units.ts`, spec
  §3/§7, grammar comment; no corpus movement, `interpretations.json` unmoved,
  `vocabulary.json` moved for the pinned `@95` / `@ 95` forms only. Rule 2: a
  *builder-only* suggesting diagnostic (`calorieUnitHints()` in
  `apps/builder/builder.js`) for a bare count on a load-less calorie machine
  (`15 Row` → "did you mean `15cal Row`?"); the board stays agnostic, no parser
  change. [DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in);
  resolves the "what a target with no unit means" entry in
  [../topics/known-debts.md](../topics/known-debts.md). `make test` 2064/2064,
  1 pending throughout. Write-ups in
  [../topics/what-exists.md](../topics/what-exists.md) (Format / load rows) and
  [../topics/builder-ux.md](../topics/builder-ux.md) ("What it reads").
- **~~board: the `#` title belongs in the meta strip, not the body~~ — landed
  2026-09-01 (`110ed2b`).** The `# Title` line now joins the hidden preamble
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

