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

The only open items are **13a** (the builder `»` panel offers the parenthesised
per-side option, via a new laterality-axis registry field), **13a-curation** (a
laterality curation pass for `around-worlds` and neighbours), and the unscheduled
**post-redesign rethinks**. 13a and 13a-curation both need Chris's input — the
chain does not self-spawn past here.

### Independent

- **13 — Laterality in the builder's `»` panel.** Builder-only, `applyModifier`;
  the `»` panel survived the redesign unchanged. **~~13c~~** (append/double bug)
  landed 2026-08-31 (`02d819d`); **~~13b~~** (parenthesise the per-side form,
  `(each arm)`, and read `(each direction)`) landed 2026-08-31 (`cf3c47f`,
  [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised)).
  **Still open — two follow-ups, both need Chris:**
  - **13a — the `»` panel offers the parenthesised per-side option.** Builder +
    a **new movement-registry field naming the laterality axis** (arm | leg |
    side | hand | direction) that the panel reads to label `(each <axis>)`
    contextually. Full write-up below.
  - **13a-curation — a laterality curation pass.** `around-worlds` and
    neighbours have no `laterality` at all, so the panel offers nothing. Fill it
    (and the axis field) via the audit CSV + `import-movement-curation.mjs`
    (`running-it.md`), not by hand. Sized as its own pass.

- **Post-redesign rethinks** (not scheduled; after R10 or in parallel) —
  `@id` ↔ record-id correlation, account **namespacing** (a username as a
  workout-id prefix; touches the `workouts` collection schema), the board's
  **Edit** button round-tripping into the builder, an **"open on the board"**
  action for saved workouts. In [../topics/builder-ux.md](../topics/builder-ux.md)
  "Accounts, IDs and layout".

---

### Detailed write-ups (referenced by the items above)

The entry below carries the full analysis for the still-open independent item
**13** (strands **13a** and **13a-curation**; **13b** landed 2026-08-31
`cf3c47f`, **13c** 2026-08-31 `02d819d`). **Item 11's write-up moved to
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

  **13a — the `»` panel offers the parenthesised per-side option.** Today
  `movementModifiers` builds the laterality list from `entry.laterality`
  (`builder.js` ~`:200`); a movement with `laterality: ["split","per-side"]`
  offers `(split)` and — since 13b — needs to offer `(each <axis>)` with the
  right axis word. Chris's call: **the axis comes from a new movement-registry
  field** (an enum over `arm | leg | side | hand | direction`, the same set
  `limbWord` now carries), curated, that the panel reads to label the option
  `(each arm)` / `(each direction)` / … *contextually on the movement*; absent,
  the panel falls back to `(each side)`. Scope: the field's name and shape
  (touches the movement schema and `import-movement-curation.mjs` if it is
  curated the usual way), `apps/builder/builder.js` (`movementModifiers` reads
  it, `applyModifier` inserts the parenthesised form — `applyModifier` already
  strips the exclusive class per 13c, and 13b's grammar reads `(each …)` back),
  and a builder-driven check both themes. Needs Chris on the field name/shape.

  **13a-curation — a laterality curation pass.** `around-worlds` (and its
  neighbours) carry no `laterality` and no default, so the `»` panel offers
  nothing for them — the gap 13a's code lands *against*. Filling it (and the new
  axis field) is a curation pass, run via the audit CSV +
  `import-movement-curation.mjs` per [../topics/running-it.md](../topics/running-it.md),
  not hand-edits to `registry/movements.json`. Sized on its own because a
  laterality sweep is more than one entry. Needs Chris to scope which movements.

- Every other numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a, 9, 10, 11, 13b, 13c, 14, 15 (all parts — a/d ↔ R10, c ↔ R3, b ↔ `9bbda82`),
  21, the deployment epic 18, 19, 20 and the builder layout redesign R1–R10 — is
  closed; see [completed.md](completed.md). Only **13a** and **13a-curation**
  stay open.

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
