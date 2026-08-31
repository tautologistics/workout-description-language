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
2026-08-31** (`70a1852`) — see [completed.md](completed.md) and
[DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section).

After 11, the only open items are **13a / 13b** (below) and the unscheduled
**post-redesign rethinks** — both of the former need Chris's input, the same way
11 did, so the chain does not self-spawn past here.

### Independent

- **13 — Laterality in the builder's `»` panel.** Builder-only, `applyModifier`;
  the `»` panel survived the redesign unchanged. **~~13c~~ (picking a laterality
  mode appends instead of replacing, and doubles on re-pick) — DONE 2026-08-31
  (`02d819d`), see [completed.md](completed.md).** **13a / 13b** stay open and
  need Chris (a curation gap; the parens-vs-bare spelling, a
  reopen-a-settled-decision). Item 13 as a whole stays open. Full write-up below.

- **Post-redesign rethinks** (not scheduled; after R10 or in parallel) —
  `@id` ↔ record-id correlation, account **namespacing** (a username as a
  workout-id prefix; touches the `workouts` collection schema), the board's
  **Edit** button round-tripping into the builder, an **"open on the board"**
  action for saved workouts. In [../topics/builder-ux.md](../topics/builder-ux.md)
  "Accounts, IDs and layout".

---

### Detailed write-ups (referenced by the items above)

The entry below carries the full analysis for the still-open independent item
**13** (strands **13a / 13b**; **13c** landed 2026-08-31 `02d819d`). **Item 11's
write-up moved to [completed.md](completed.md)** when it landed 2026-08-31
(`70a1852`). The redesign's own write-ups (12 ↔ R2, 15 ↔ R3 + R10, 16 ↔ R3,
17 ↔ R9) moved to [completed.md](completed.md) with the R1–R10 section; item 15
(including the board-side part (b), landed 2026-08-31 `9bbda82`) is fully closed
and its write-up lives there too.

- **13 — Laterality in the builder's `»` panel: no data for some movements, a
  parity question, and a replace-not-append bug.** *High priority (Chris,
  2026-08-29), from driving the builder.* Three strands, same panel
  (`movementModifiers` / `applyModifier` in `apps/builder/builder.js:195` and
  `:390`). The bug (c) can ship on its own; (a) and (b) want a decision.

  **(a) A movement with no curated `laterality` gets no laterality option at
  all.** `movementModifiers` builds the laterality list from
  `entry.laterality` (`builder.js:200`); `Around The Worlds` (`around-worlds`
  in `registry/movements.json`) has no `laterality` and no `defaultLaterality`,
  so the `»` panel offers nothing, where `Dumbbell Snatch`
  (`laterality: ["split","per-side"]`) offers `(split)` and `each side`. Two
  questions: (1) this is a **curation gap** — `around-worlds` (and its
  neighbours) need `laterality` filled in, which per
  [../topics/running-it.md](../topics/running-it.md) lands via
  `import-movement-curation.mjs` from the audit CSV, not by hand; decide
  whether to queue a curation pass or hand-write the one entry. (2) Chris
  described the wanted option as **"each direction"** (circle one way, then the
  other) — WDL's laterality vocabulary is `arm | leg | side | hand`
  (`spec/grammar-0.1.ohm:294-298`, `limbWord`), with no rotational sense. Is
  "each direction" just `per-side` spelled with a different limb noun (add
  `direction` to `limbWord`), or `(both)` meaning "both directions", or out of
  scope? Language call for Chris.

  **(b) `(split)` / `(both)` are parenthesised; `each side` is bare — Chris
  wants parity.** `format.ts:94-95`: `both`/`split` render as ` (both)` /
  ` (split)`, `per-side` renders as ` each side`. Spec §4 (line 148) makes the
  `each <limb>` form inline-without-a-comma deliberately — "it reads as part of
  the prescription rather than as a modifier of it" — but says nothing about
  parens vs bare; the asymmetry is just the two grammar forms
  (`laterality = "(" lateralityWord ")"` vs `trailingQualifier -- limb`). There
  is a defensible logic (parens annotate *how the count is performed*, `each
  side` states *what the count is of*), so this is a **reopen-a-settled-spelling
  decision**, not a clear bug. Put both directions to Chris: parenthesise the
  per-side form too (`(each side)` — needs a grammar tweak, and reads less like
  a whiteboard), or drop the parens from `split`/`both` (`14 DB Curl split`
  reads oddly). Whatever is chosen touches `spec/spec-0.1.md` §4,
  `spec/grammar-0.1.ohm`, `packages/core/src/format.ts`, `grammar` semantics,
  `test/golden/vocabulary.ts`, and regenerates goldens +
  `registry/workouts.canonical.json` (corpus files use `(split)` and
  `each arm` — this one *will* move the corpus, so measure it).

  **~~(c) Picking a laterality mode appends instead of replacing, and doubles on
  re-pick.~~ DONE 2026-08-31 (`02d819d`), see [completed.md](completed.md).**
  `applyModifier` now strips every existing token of the exclusive class from
  the line before inserting a pick — the parenthesised laterality forms
  (`(both)` / `(split)` / `(per-side)` / `(total)`, matching `lateralityWord`),
  the inline `each|per <limb>` forms (matching `trailingQualifier -- limb`), and
  the `, count cal|calories|distance|reps` comma modifier (`position: 'end'`,
  same double-append) — then inserts, or, when the mode already there is
  re-picked, clears it (toggle off). `apps/builder/builder.js` only, no core
  change.

  **Land it / docs:** fresh branch off `origin/main` as above; push
  `git push origin <branch>:main` and confirm. Commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. If (c) ships alone,
  keep (a)/(b) open as their own numbered item rather than closing 13. When
  landed: move to [completed.md](completed.md); update
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Outline" (the `»`
  panel replace behaviour) and, if (b) changed a spelling,
  [../topics/settled-decisions.md](../topics/settled-decisions.md) +
  [../topics/what-exists.md](../topics/what-exists.md) Format row; dated line in
  [../current/recent-changes.md](../current/recent-changes.md). If (a) queued a
  curation pass, add it here as a new item.

- Every other numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a, 9, 10, 11, 13c, 14, 15 (all parts — a/d ↔ R10, c ↔ R3, b ↔ `9bbda82`), 21,
  the deployment epic 18, 19, 20 and the builder layout redesign R1–R10 — is
  closed; see [completed.md](completed.md). Only 13a / 13b stay open.

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
