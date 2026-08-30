# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

- **11 — A bare-word block header is an inert section, not an "unrecognized
  header" error.** *High priority (Chris, 2026-08-29).* Spec §2 says a section
  *"group[s] blocks: `warmup:`, `strength:`, `conditioning:`, `accessory:`,
  `cool-down:`, **or any custom label**"* — but the grammar only reads the
  fixed eight in `sectionWord` (`spec/grammar-0.1.ohm:474-477`:
  `warm-up`/`warmup`, `strength`, `skill`, `conditioning`, `accessory`,
  `cool-down`/`cooldown`). Any other bare label — `Barbell movements:`,
  `Dumbbell movements:` — falls through `headerName`
  (`spec/grammar-0.1.ohm:483`) to `headerKind_unknown`
  (`packages/core/src/grammar/block-semantics.ts:182`), which makes a
  `type: 'sequence'` with `block.name` set, and then `parseHeader`
  (`packages/core/src/parse.ts:119-123`) pushes
  `unrecognized block header "Barbell movements"` — an **error** in `wdl check`
  and a red line in the builder's diagnostics pane. It still runs its children
  in order and round-trips (`format.ts:256` writes the name back as the head,
  `timeline.ts:497` default → `sequence`), so execution is already identical
  to a section; only the diagnostic is wrong.

  **The ask:** a header that is *entirely* a bare label — letters, spaces and
  hyphens, **no digits, no comma modifiers, no `@`, and not a recognised
  kind** — parses as `type: 'section'` (the inert labelled container that
  `conditioning:` already produces), so a custom grouping inside e.g.
  `3 rounds for time:` is a clean visual layer with no complaint. The rounds
  still cycle every descendant step regardless of the section layer.

  **Decisions the session must make (put them to Chris):**
  - **Diagnostic or silent?** The eight known section words are silent. A
    brand-new bare word could still be a *typo* rather than a deliberate label.
    Recommendation: read it as a section **and** emit a `note` (the
    claims-nothing severity, per [DEC-010](../topics/settled-decisions.md) /
    spec §11.1) — *"read `Barbell movements` as a section label"* — so
    held-and-inert is never fully silent. Alternative: fully silent, exactly
    like the fixed eight. Chris's call.
  - **Canonical case.** `blockKind_section` lowercases the known words
    (`block-semantics.ts:175`). Lowercasing `Barbell Movements` → `barbell
    movements` may surprise. Recommendation: preserve a custom label's case
    verbatim; keep lowercasing only the fixed vocabulary. Chris's call.
  - **Where the boundary is drawn.** A digit anywhere keeps it an error, so
    `3 rounds of madness:` (spec §11.1's example of a kind that must not be
    misread) stays an error. But `rounds of madness:` (no digit) would become
    a section — acceptable, or does a leading recognised kind-word need its own
    exclusion? Recommendation: no extra exclusion — "unknown is a place"
    (spec §11.1) and a labelled sequence that runs in order is a safe reading
    of any bare phrase. Chris's call.
  - **Grammar or `parse.ts`.** Cleanest is a new grammar production (a
    `customSection` case after `sectionWord` fails, structured like it) so the
    grammar still *owns what exists* ([DEC-006](../topics/settled-decisions.md),
    [DEC-007](../topics/settled-decisions.md)); the alternative is leaving
    `headerName` alone and having `parseHeader` reclassify. Prefer the grammar
    production unless it fights the `blockModifier` / `headerKind` split
    (the comment at `grammar-0.1.ohm:370-376` explains why `headerName` is kept
    out of the kinds proper).

  **Must not break:** the error path at `parse.ts:119` also deliberately
  catches a *real* repeat carrying an unreadable head stated after a comma
  (`cap 12min, 3 rounds:` is three rounds **and** an error — spec §11.1). The
  reclassification must fire only when the header is a bare label with **no
  kind anywhere on it**, so `block.name && block.type !== 'section'` becomes
  `… && !isBareLabel`.

  **Scope:**
  - `spec/grammar-0.1.ohm` — the `customSection` production (or equivalent),
    ordered after `sectionWord`.
  - `packages/core/src/grammar/block-semantics.ts` — a handler setting
    `type: 'section'` + `name` (case per the decision above).
  - `packages/core/src/parse.ts` — the `parseHeader` report condition
    (`:119`), so a bare-label section is not reported as an unrecognised
    header; add the `note` here if that decision goes that way (an error is
    not part of the AST — same reason `headerKind_unknown` does not raise one).
  - `packages/core/src/format.ts` — check `case 'section'` (`:256`) and the
    `unread` computation (`:287`) still round-trip a custom label; adjust if
    case handling changed.
  - `spec/spec-0.1.md` — §2 (the "any custom label" line is now true), §5.1
    (sequence vs section), and a cross-reference from §11.1 (a bare-word head
    is a section; a head with a *kind* it cannot read is still an error).
  - Tests: `packages/core/test/grammar.test.ts` — the pinned case at `:388-392`
    (`'some shape nobody taught the parser'`) changes from `sequence` to
    `section`; the separately-counted **block headers** total
    (`:269`, currently 250) shifts. `test/golden/vocabulary.ts` — new forms
    under a `section` / `label` group, pinning canonical text and the tree.
    `test/semantics.test.ts`, `test/validate.test.ts` as needed.
  - **Corpus:** no example file uses a custom-label header, so
    `interpretations.json` and `registry/workouts.canonical.json` should
    regenerate to nothing but their date stamp — **confirm** with
    `node packages/core/test/golden/generate.ts` and
    `node scripts/build-canonical.ts`, don't assume.
  - No app code expected. Drive the builder once anyway: type
    `Barbell movements:` with steps under it inside a `3 rounds for time:` and
    confirm the diagnostics pane is clean (or shows only the `note`), the
    outline nests it, and "what it reads as" cycles the steps three times.
  - Check [deferred.md](deferred.md) and
    [../topics/settled-decisions.md](../topics/settled-decisions.md) first —
    this reading is not currently declined anywhere, but confirm.

  **Land it / docs:** fresh branch off `origin/main`
  (`git fetch origin`, `git checkout -b <name> origin/main`; `main` is checked
  out elsewhere so you cannot `git checkout main`); push with
  `git push origin <branch>:main` and confirm the SHA moved via
  `git ls-remote origin main`. Commit message body ends with
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When it lands:
  move this item to [completed.md](completed.md) in that file's style; restore
  "## Open" to "None" with the "every numbered item is closed" line extended to
  include 11; record the decisions made in
  [../topics/settled-decisions.md](../topics/settled-decisions.md) (and a
  `DEC-0xx` line in [../decisions.md](../decisions.md) if it rises to that);
  update the **Format** row (or add a row) in
  [../topics/what-exists.md](../topics/what-exists.md); add a dated entry to
  [../current/recent-changes.md](../current/recent-changes.md);
  `grep -rn "custom label\|sectionWord\|unrecognized block header" docs/` and
  fix any now-stale mention.

- Every earlier numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a, 9 and 10 — is closed; see [completed.md](completed.md).

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
