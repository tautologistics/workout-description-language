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
16 ↔ R3, 17 ↔ R9, 15 a/c/d ↔ R3 + R10) closed with it; their detail write-ups
moved there too.

What is left open is genuinely independent of the layout — sequence it
separately.

**Item 21 (a root Makefile task surface) landed 2026-08-31** — see
[completed.md](completed.md) and
[DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson).

**Item 11 (a bare-word block header is an inert section, not an error) landed
2026-08-31** (`70a1852`) — [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section).
**Item 13b (the per-side laterality form is parenthesised, `(each arm)`) landed
2026-08-31** (`cf3c47f`) — [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised).
**Item 13a-curation (the `lateralityAxis` registry field + one vetting entry on
`around-worlds`) landed 2026-08-31** (`71f9469`) — see [completed.md](completed.md).

The only open items are **13a** (the builder `»` panel *renders* the
`lateralityAxis` — `movementModifiers` reads it to show `(each direction)` and
inserts the 13b parenthesised form; the field and one movement now exist for it
to read), a full **laterality curation sweep** (not yet queued as a numbered
item — `around-worlds` is the only movement with `lateralityAxis` so far), and
the unscheduled **post-redesign rethinks**. 13a needs Chris on nothing further —
the field name (`lateralityAxis`) and shape are settled — but a full sweep needs
him to scope it. The chain does not self-spawn past here.

### Independent

- **13 — Laterality in the builder's `»` panel.** Builder-only, `applyModifier`;
  the `»` panel survived the redesign unchanged. **~~13c~~** (append/double bug)
  landed 2026-08-31 (`02d819d`); **~~13b~~** (parenthesise the per-side form,
  `(each arm)`, and read `(each direction)`) landed 2026-08-31 (`cf3c47f`,
  [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised));
  **~~13a-curation~~** (the `lateralityAxis` field + `around-worlds`) landed
  2026-08-31 (`71f9469`, see [completed.md](completed.md)).
  **Still open:**
  - **13a — the `»` panel renders `lateralityAxis`.** `movementModifiers`
    (`apps/builder/builder.js` ~`:297`) still emits the pre-13b bare ` each side`
    for every per-side movement, and ignores `entry.lateralityAxis`. Make it emit
    ` (each ${entry.lateralityAxis ?? 'side'})` and `applyModifier` insert that
    (the exclusive-class strip from 13c and the grammar read from 13b are both in
    place). Test against `around-worlds` (`lateralityAxis: "direction"` → panel
    shows `(each direction)`) and any `per-side` movement without the field
    (falls back to `(each side)`). Full write-up below. **No Chris input needed.**
  - **A full laterality curation sweep** — not yet a numbered item.
    `around-worlds` is the only movement carrying `lateralityAxis`; the audit
    workbook now has a "Laterality axis" CURATE column
    (`import-movement-curation.mjs`) ready for a pass. Needs Chris to scope it.

- **Post-redesign rethinks** (not scheduled; after R10 or in parallel) —
  `@id` ↔ record-id correlation, account **namespacing** (a username as a
  workout-id prefix; touches the `workouts` collection schema), the board's
  **Edit** button round-tripping into the builder, an **"open on the board"**
  action for saved workouts. In [../topics/builder-ux.md](../topics/builder-ux.md)
  "Accounts, IDs and layout".

---

### Detailed write-ups (referenced by the items above)

The entry below carries the full analysis for the still-open independent item
**13** (strand **13a**; **13b** landed 2026-08-31 `cf3c47f`, **13a-curation**
`71f9469`, **13c** `02d819d`). **Item 11's write-up moved to
[completed.md](completed.md)** when it landed 2026-08-31 (`70a1852`). The redesign's own write-ups (12 ↔ R2, 15 ↔ R3 + R10, 16 ↔ R3,
17 ↔ R9) moved to [completed.md](completed.md) with the R1–R10 section; item 15
(including the board-side part (b), landed 2026-08-31 `9bbda82`) is fully closed
and its write-up lives there too.

- **13 — Laterality in the builder's `»` panel.** *High priority (Chris,
  2026-08-29), from driving the builder.* Started as three strands in one panel
  (`movementModifiers` / `applyModifier` in `apps/builder/builder.js`). **(c)**
  (append/double bug) landed 2026-08-31 `02d819d`. **(b)** (parenthesise the
  per-side form) landed 2026-08-31 `cf3c47f` — see [completed.md](completed.md)
  and [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised).
  **(a)** splits into the two follow-ups below.

  **13a — the `»` panel renders `lateralityAxis`.** The field, its schema
  (`MovementEntry.lateralityAxis?: 'arm'|'leg'|'side'|'hand'|'direction'` in
  `packages/core/src/fold.ts`), its curation column, and one populated movement
  (`around-worlds`, `lateralityAxis: "direction"`) all landed with 13a-curation
  (`71f9469`). What remains is builder-only:
  - `movementModifiers` (`apps/builder/builder.js` ~`:297`) still hard-codes the
    per-side option's text as the pre-13b bare ` each side` and never looks at
    `entry.lateralityAxis`. Change it to ` (each ${entry.lateralityAxis ?? 'side'})`
    (parenthesised, per DEC-019; axis-aware).
  - `applyModifier` inserts it — the exclusive-class strip (13c) and the grammar
    read of `(each …)` (13b) are already in place, so a pick replaces cleanly.
  - Verify: `around-worlds` → panel shows `(each direction)`; a `per-side`
    movement with no axis (e.g. `bulgarian-split-squat`) → `(each side)`. Both
    builder themes.

  *Interim state since `71f9469`:* the `»` panel now **appears** for Around The
  Worlds (it was hidden — no `laterality` data) and offers the stale bare
  ` each side` until this lands. Not broken — bare still parses (13b kept input
  tolerance) — just not yet axis-aware.

  **A full laterality curation sweep** stays unscheduled. The curation path is
  ready (`import-movement-curation.mjs` gained a "Laterality axis" CURATE
  column); `around-worlds` is the only entry populated so far. A sweep is run
  via the audit CSV per [../topics/running-it.md](../topics/running-it.md), not
  hand-edits — needs Chris to scope which movements.

- Every other numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a, 9, 10, 11, 13a-curation, 13b, 13c, 14, 15 (all parts — a/d ↔ R10, c ↔ R3,
  b ↔ `9bbda82`), 21, the deployment epic 18, 19, 20 and the builder layout
  redesign R1–R10 — is closed; see [completed.md](completed.md). Only **13a**
  (builder-only, no decision pending) stays open.

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
