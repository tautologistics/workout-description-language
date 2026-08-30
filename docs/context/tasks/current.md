# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

- **12 — The outline shows no row for a comment; they exist only in the Text
  tab.** *High priority (Chris, 2026-08-29).* Full write-up (cause confirmed in
  source) is the first entry under "## Outline" in
  [../topics/builder-ux.md](../topics/builder-ux.md).

  **The situation.** `renderOutline` walks `readLines(text())`
  (`apps/builder/builder.js:631`), and `readLines`
  (`packages/core/src/lines.ts`) strips every comment off its own line and
  folds it into the `comments: string[]` of the next real line — an own-line
  comment is never a node in the line tree, so the outline draws no row for it.
  `readLines` also emits a file-level trailing pseudo-node
  (`{ text: '', line: 0, comments }`, `lines.ts:170`) for comments with no
  following line. The `n.text.startsWith('//')` branch at
  `apps/builder/builder.js:256` is effectively dead for own-line comments.
  Consequences: a `//` line cannot be seen, added, edited or reordered in the
  GUI; the outline silently misrepresents a file that has them (rows present,
  comments gone); and it undercuts using `//` for an arbitrary-label visual
  grouping (item 11 covers why a `section:` only reads the fixed eight words).

  **The job.** Make comments first-class in the outline. Two approaches, pick
  with Chris:
  - **Synthesised comment rows (preferred — keeps "the outline *is* the
    file").** In the outline walk, emit a row for each entry in a line's
    `comments[]` *above* that line's row (own-line comments attach forward, per
    `lines.ts`), and a trailing block of rows for the file-level pseudo-node's
    comments. Style them with the existing `.node.comment` class
    (`apps/builder/builder.css` already has it, dim + italic). Editing a
    comment row writes back through `packages/core/src/edit.ts` — which today
    has no comment-aware splice, so this is the real work: a comment lives in
    `lines` as raw text on its own physical line (or trailing another), and
    `edit.ts`'s span model (`spans()`, `replaceLogical`, `insertAfter`,
    `remove`) needs to address it. Reordering/indenting a comment row moves the
    physical line. `+ comment` joins the `.add-row` buttons.
  - **Attached-comment affordance (smaller, weaker).** Surface each row's
    `comments[]` as an editable sub-line hanging off that row — no new node
    type, no `edit.ts` change beyond writing the comment text back onto the
    owning physical line. Leaves an own-line comment sitting *between* two
    blocks with no natural owner (it currently attaches forward to the next
    line, so it would appear on that block's row — acceptable but slightly
    surprising).

  **Watch for:** `readLines` distinguishes an own-line comment (attaches
  forward) from a trailing comment on a content line (`comments` also holds
  it — see `splitComment` / the `comments: [...pending, ...]` assembly in
  `lines.ts:134-148`); the outline should render a trailing comment *on* its
  line's row, not as a separate row. `DEC-005` ("the text is the document" —
  structural edits splice `lines` in place, never regenerate from the AST) is
  the constraint the write-back must honour. No grammar/spec change — this is
  builder + possibly `edit.ts`.

  **Verify by driving the builder:** a file with an own-line comment above a
  block, a trailing comment on a step, and a trailing comment at end of file —
  all three visible and editable in the Outline tab; adding a comment row,
  editing one, deleting one, and dragging one all write back and survive a
  switch to the Text tab; canonical round-trip (`Canonicalise`) unaffected.

  **Land it / docs:** fresh branch off `origin/main` (`git fetch origin`,
  `git checkout -b <name> origin/main`; `main` is checked out elsewhere).
  Push `git push origin <branch>:main`, confirm the SHA moved via
  `git ls-remote origin main`. Commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When it lands:
  move this item to [completed.md](completed.md); strike the builder-ux.md
  "## Outline" entry and mark it **Fixed <date>** with what shipped; update the
  **Apps** row in [../topics/what-exists.md](../topics/what-exists.md); dated
  line in [../current/recent-changes.md](../current/recent-changes.md). If
  `edit.ts` gained a comment-aware operation, note it there and in
  [../topics/what-exists.md](../topics/what-exists.md).

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

  **(c) Picking a laterality mode appends instead of replacing, and doubles on
  re-pick.** `applyModifier` with `position: 'title'` (`builder.js:390-413`)
  splices the chosen text in right after the movement title without checking
  for a laterality word already on the line. So picking `split` when `each
  side` is present yields `Around The Worlds (split) each side` (two
  contradictory modes), and picking `split` twice yields `(split) (split)`.
  Laterality modes are mutually exclusive: before inserting, detect and remove
  any existing laterality token — the parenthesised forms
  (`(both)` / `(split)` / `(per-side)` / `(total)`, matching
  `lateralityWord`) and the inline forms (`each|per arm|leg|side|hand`,
  matching `trailingQualifier`) — then insert the new one (or, if the same mode
  is picked again, treat it as a toggle-off / no-op). Check the measured-output
  picks (`, count cal` / `, count distance`) for the same double-append and fix
  them too if present. The `»` panel is meant to be an editor, so replace is
  the right default. Builder-only; no core change; verify by driving it against
  a split movement — apply `each side`, then `(split)`, confirm one replaces
  the other; apply the same twice, confirm no doubling; diagnostics pane clean
  after each.

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
