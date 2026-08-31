# Recent Material Changes

## Changes

- **2026-08-31 — The `»` panel splices laterality/load after the whole typed
  movement word** (`e27339a`, a one-off follow-up, not a queue item). `applyModifier`
  in `apps/builder/builder.js` derived the splice point from `entryTitle.length`
  whenever the typed name started with the registry title, so a plural or inflected
  name (`Dumbbell Snatches` for entry `Dumbbell Snatch`) spliced the token mid-word
  and stranded the suffix: `- 8 Dumbbell Snatch (each side) es`. Pre-existing since
  13c (`02d819d`), independent of 13a. The seam calc in both the title- and
  load-insert branches is now `titleMatchLen(fragment, entryTitle)`, which extends
  the match through the trailing letters/apostrophe of that same word when
  `fragment` starts with `entryTitle`, and keeps the whole-fragment fallback for
  names that don't (aliases like `DB Snatch`). Bare `each side` fixed identically.
  Builder-only; suite 2063/2063 (nothing in the core suite covers
  `movementModifiers`/`applyModifier`). Drove the builder both themes: the repro
  now yields `- 8 Dumbbell Snatches (each side)`; plural + load lands `@ ` after
  the whole name and before a comma modifier; singular, alias, and `around-worlds`
  (`each direction`) still splice cleanly and `Canonicalise` round-trips.

- **2026-08-31 — The builder `»` panel renders `lateralityAxis`** (`1ffc8d0`,
  queue item **13a** — **this closes item 13 entirely**). `movementModifiers()`
  in `apps/builder/builder.js` built the per-side laterality option as the
  pre-13b bare ` each side` and ignored `entry.lateralityAxis`. It now inserts
  `` `(each ${entry.lateralityAxis ?? 'side'})` `` — parenthesised per DEC-019,
  axis-aware with a `side` fallback — so `12 Around The Worlds` offers
  `(each direction)` and a per-side movement with no curated axis
  (`bulgarian-split-squat`) falls back to `(each side)`. `LATERALITY_RE` (the
  exclusive-class strip `applyModifier` runs before a laterality pick) gained
  the parenthesised per-side form and `direction`, so a previously-inserted
  `(each arm)` / `(each direction)` toggles off on re-pick and is replaced
  cleanly by a different mode — no doubling. Builder-only; no `packages/core`
  change; suite 2063/2063 (nothing in the core suite covers `movementModifiers`).
  Drove the builder both themes: insert, toggle, replace, round-trip through
  `Canonicalise` all verified. Uncovered but left alone — a pre-existing
  `applyModifier` bug (13c `02d819d`) that strands a plural suffix when the
  typed movement name is plural and the registry title singular; recorded in
  [../topics/builder-ux.md](../topics/builder-ux.md).

- **2026-08-31 — `lateralityAxis` — the axis a per-side count runs across**
  (`71f9469`, queue item **13a-curation**). A per-side count is "each
  *something*" — `side` usually, `arm` for a single-arm press, `direction` for
  a dumbbell circled around the head. A curated root field on a movement entry
  (`MovementEntry.lateralityAxis?: 'arm'|'leg'|'side'|'hand'|'direction'`,
  `fold.ts`), so a tool renders `(each direction)` instead of a generic
  `(each side)`. `import-movement-curation.mjs` gained a "Laterality axis"
  CURATE column; `build-movements.mjs`'s `handKept` now carries the laterality
  fields onto free-exercise-db-sourced records (they were silently dropped).
  `around-worlds` is the one vetting entry (`lateralityAxis: "direction"`, plus
  `laterality: ["per-side"]` it lacked); a full sweep is unscheduled. Nothing in
  `packages/core` reads the field yet — the builder `»` panel is the still-open
  **13a**. The panel now *appears* for Around The Worlds (was hidden) offering
  the generic `each side` until 13a. Suite 2063/2063.

- **2026-08-31 — The per-side laterality form is parenthesised: `(each arm)`**
  (`cf3c47f`, queue item **13b**,
  [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised)).
  `format.ts` wrote `(split)` / `(both)` parenthesised but `per-side` as a bare
  ` each side`; Chris wanted parity. Now all four modes are parenthesised —
  `(each <axis>)` names the count mode and the axis (`arm | leg | side | hand |
  direction`). **`direction` is a new axis word** — a rotation once each way —
  and the parser now *reads* the parenthesised per-side form, which it could
  not: `(each direction)` used to fall to `unreadableParen` and be held as
  unknown. `total` still maps to `(split)`, `(both)` stays distinct, bare
  `each arm` still parses. `spec/grammar-0.1.ohm` (`laterality` → `-- word` /
  `-- perSide`, `limbWord += direction`), `step-semantics.ts`, `format.ts`,
  `spec-0.1.md` §4/§7/§11.1, tests, and **9 corpus files reformatted
  `each X` → `(each X)`** — which moved only those 9 `text` fields in
  `workouts.canonical.json` (0 AST / 0 summary changes; `interpretations.json`
  byte-identical). Suite 2060 → 2063 passing. No app code — the builder `»`
  panel piece is the still-open 13a.

- **2026-08-31 — A bare-label block header is an inert section, not an
  "unrecognized header" error** (`70a1852`, queue item **11**,
  [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section)).
  A head that is entirely a bare label — letters, spaces and hyphens, no digit
  anywhere, and not opening with a kind-word — now parses as `type: 'section'`
  (the inert labelled container the fixed eight section words produce, spec §2's
  "any custom label") instead of a `type: 'sequence'` carrying an `unrecognized
  block header` error. `Barbell movements:` inside `3 rounds for time:` is a
  clean visual layer; the rounds still cycle every descendant. Four Chris calls:
  read it **and** emit a `note` (`validate.ts` `custom-section`, per DEC-010 —
  a coined heading could be a typo); preserve the label's case verbatim; a digit
  anywhere or a leading kind-word missing its parameter (`RFT:`, `every:`)
  stays the error (narrow `kindLead` exclusion, ruled on when the first
  `make test` showed the conflict with spec §5.2); a new grammar production
  (`customSection`), not a `parse.ts` reclassification (DEC-006 / DEC-007).
  Must-not-break preserved: `Barbell movements, 3 rounds:` still takes the kind
  after the comma and reports the leftover label. `spec/grammar-0.1.ohm`,
  `block-semantics.ts`, `parse.ts` (comments only), `validate.ts`,
  `spec-0.1.md` §2/§5.1/§5.2/§11.1, tests. Suite 2049 → 2060 passing (1
  pending); block-headers harvest 250 → 254; corpus unchanged
  (`interpretations.json` byte-identical, `workouts.canonical.json` date-only).
  Builder driven both themes.

- **2026-08-31 — Builder `»` panel: laterality and measured-output picks
  replace instead of appending** (`02d819d`, queue item **13c** — one strand of
  item 13, shipped alone; **13a / 13b stay open** and item 13 is not closed).
  `applyModifier` with `position: 'title'` spliced the chosen laterality text in
  after the movement title without checking the line, so `(split)` on top of
  `each side` gave `Dumbbell Snatch (split) each side` and picking a mode twice
  gave `(split) (split)`; the measured-output picks (`position: 'end'`) had the
  same double-append. Now each pick first strips every existing token of its
  mutually-exclusive class — parenthesised laterality (`(both)` / `(split)` /
  `(per-side)` / `(total)`), inline `each|per <limb>`, and
  `, count cal|calories|distance|reps` — then inserts, or clears it (toggle off)
  when the mode already on the line is re-picked. `apps/builder/builder.js`
  only, no core change; suite 2051 passing, 1 pending. Verified driving the
  builder against `Dumbbell Snatch` and `Row`: replace both directions, toggle
  off, diagnostics clean.

- **2026-08-31 — Reads-as tab: the "show every cue" toggle is gone; both
  subsections always show** (`c876691`, Chris, from using it). The per-cue list
  sits at the bottom of the panel and displaces nothing, so hiding it bought
  nothing. `renderReadsAs()` now always renders the terse block-grouped reading
  and then the full uncapped per-cue list under an `EVERY CUE (N)` label. The
  toggle, the `expanded` branch and `localStorage['wdl.reads-expanded']` are
  removed (stale key left harmless). `apps/builder/{builder.js, builder.css}`,
  no core change; suite 2051 passing, 1 pending. **Follow-up (`a8e5d6f`):** a
  `.round-start` class on the first cue of each new round opens a half-line
  (`margin-top: .5rem`), so the every-cue list reads as N groups.

- **2026-08-31 — Builder: the editor/analysis split is draggable, and the body
  map scales with the margin** (`83bfb78`, from Chris using it). The sheet was
  `minmax(0,1fr) 24rem` capped at 1120px, so a wide window added dead margin
  and the analysis column was stuck at 24rem. Now: sheet cap 1600px; the
  margin width is `--right-col-w` on `.sheet` with a `<div class="col-resize">`
  drag handle between the columns. `builder.js` tracks the drag on `window`
  (pointer + mouse, no capture), clamps to a 22rem editor floor / 18rem margin
  floor, persists the unclamped *intent* to `localStorage['wdl.right-col-w']`
  and re-clamps it to the sheet on resize. Double-click resets; arrows nudge.
  Hidden below 820px (single column). The builder body map overrides the
  shared 78px so its two figures split the panel width (each capped 190px) —
  a wider margin → a bigger diagram. `apps/builder/*` only, no core change;
  suite 2051 passing, 1 pending. Verified light + dark and at 1680 / 1024 /
  900 / 760px (drag, keyboard, reset, persist-across-reload, resize re-clamp).

- **2026-08-31 — `make deploy` defaults `WDL_DEPLOY_SSH` to `dreamhost.ae.wex`.**
  The Makefile now sets `export WDL_DEPLOY_SSH ?= dreamhost.ae.wex`, so a bare
  `make deploy` / `make deploy-dry` works on Chris's box without prefixing the
  env var. `?=` still defers to the environment when it is set (any other host
  wins), and the value is a `~/.ssh/config` alias — no host, user or secret —
  so it is safe in the repo. The raw `node scripts/deploy-web.mjs` form does
  **not** inherit the default. Verified with GNU Make 3.81: unset → the
  default reaches the recipe; env-set → the env value wins. *Touched:*
  `Makefile`, `docs/context/topics/running-it.md`, `settled-decisions.md`
  (DEC-017).

- **2026-08-31 — Builder Analysis tab: the per-cue list is gone; the summary
  band is height-capped** (`8720a62` then `9537905`, from driving the builder).
  A workout that unrolled into dozens of cues grew the Analysis tab's `#steps`
  list unbounded and pushed the body map + goals block off the bottom — the
  only scroll container was `#view-analysis` as a whole. `8720a62` first
  bounded `.summary` and `#steps` (each `max-height` + `overflow-y: auto`).
  Then, on Chris's call, the `#steps` list was **removed from the Analysis tab
  entirely**: it was a capped duplicate of the "Reads as" tab's *show every
  cue* expansion (same `cueRow()`), and it was in the way of the two sections
  that tab is for. `#view-analysis` is now directives → diagnostics → body map
  → goals; the run reads only on "Reads as". `.summary` keeps its
  `max-height: 9rem` cap. CSS + JS + HTML in `apps/builder/*`, no core change;
  suite 2051 passing, 1 pending. Verified light + dark, wide + narrow.

- **2026-08-31 — The board no longer renders the `@`-directive preamble as body
  rows; `@id` / `@tags` lifted into the header chrome — item 15 is now fully
  closed** (`9bbda82`, queue item 15b). `draw()` in `apps/display/board.js`
  built one row per raw source line and special-cased only blank / `//` lines,
  so `@wdl` / `@id` / `@date` / `@tags` sat at the top of what the athlete reads
  mid-set and `@id` was never stripped. Now `preambleEnd()` finds the leading
  run of blank / `//` / `@key` / `# title` lines and, within that run only, a
  zero-indent `@key` line (matched as core's `tryDirective` does) gets a
  `.preamble` class hidden in CSS. The row is still built, so `dataset.line`
  stays 1:1 with the source and `paint()`'s physical-line cue matching + scroll
  are untouched (the write-up's preferred shape). A new `#meta` strip under the
  bar shows `@id` verbatim and `@tags` as chips, only when the workout sets one
  of them. The workout **body renders byte-for-byte as before** — same rows,
  same blank/comment handling, same marker / `done` / scroll, division picker
  unaffected. The `# title` was kept as the first board row (a reversible
  default — an open question for Chris whether it moves into the strip too). No
  core change (suite 2051 passing, 1 pending). *Touched:*
  `apps/display/board.js`, `board.css`, `index.html`.

- **2026-08-31 — A root `Makefile` is now the single task surface for the dev
  lifecycle** (queue item 21, [DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson)).
  `make` (or `make help`) lists the targets: `test`, `build`, `serve`
  (`PORT=NNNN` overridable), `registry` (the whole `build-canonical.ts`
  pipeline), `goldens` (regenerate + `git diff --stat`), `aliases`, `corpora`,
  `deploy` / `deploy-dry`, `clean`, and `install` (which just says "nothing to
  install"). Every target is a thin wrapper over the `node scripts/*` /
  `npm --prefix` command that already existed — discoverability, not new build
  logic — and those raw forms still run directly. A root `package.json`
  `scripts` block was the alternative and was rejected: the repo is
  install-free on purpose (no `node_modules`, no lockfile, `ohm-js` vendored)
  and a `package.json` invites `npm install` + a lockfile; `make` adds nothing.
  The command list at the top of
  [../topics/running-it.md](../topics/running-it.md) now leads with the `make`
  targets. *Touched:* new `Makefile`; `docs/context/topics/running-it.md`,
  `settled-decisions.md`, `decisions.md`. No code change.

- **2026-08-31 — Builder layout redesign, R10 of 10: directive metadata block +
  `@`-key type-ahead — the R1–R10 chain is complete** (`5f79ea3`). **15a:** a
  read-only `#directives` block at the top of the Analysis tab, painted by a new
  `renderDirectives()` off the top of `renderReading()`, lists the `@key value`
  preamble read straight off `parse().workout.directives` — `wdl` / `id` /
  `date` / `author` and any `@x-…` extension as verbatim key/value rows, `tags`
  split on comma into chips. It repaints on every edit path, survives a compile
  failure below it (read off the parsed tree, not the run), and is hidden
  entirely when the workout sets no directives — no empty block, no heading.
  Bordered aside with the shared `--kind-directive` accent, both themes.
  **15d:** on a zero-indent `@` outline row with the caret still in the key, the
  movement suggestion dropdown offers a builder-held directive-key list instead
  (`@wdl` / `@id` / `@date` / `@tags` / `@author` / `@x-`, one description each)
  — a parallel branch in `openSuggestions()` plus `pickDirectiveKey()`, reusing
  the `.suggestions` widget and its Arrow/Enter/Escape handling; a pick fills
  the key (`@id `, caret past the space; `@x-`, caret past the dash). Guarded on
  raw-line indent so a `@ 40kg` load fragment never triggers it, and movement
  suggestions on step rows are unchanged. **15b** (the board rendering preamble
  lines as body rows) stays open as an independent item. With R10 the ten-stage
  builder layout redesign (direction C, "Document + margin") is **complete** —
  R1–R10 are grouped as one section in
  [../tasks/completed.md](../tasks/completed.md). No core change — suite **2051
  passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R9 of 10: the Text tab traps Tab and
  carries a syntax-highlight layer** (`05efea0`). `#text` is wrapped with a
  new `<pre id="text-hl">` in a positioned `.text-wrap`; the textarea paints
  `color: transparent; caret-color: var(--ink)` over the layer, which holds the
  same text re-tokenised on every `input` — one colour per line kind from the
  shared `--kind-*` palette (R3), lexically classified by a new `textLineKind()`
  mirroring the Outline's `data-kind` vocabulary (title / directive / comment /
  section / header / step / rest). Every text-metric property is shared between
  the two in one CSS rule and `scrollbar-gutter: stable` is set on both, so the
  caret sits on the layer's glyphs under wrapping and at every scroll offset (a
  `scroll` listener copies `scrollTop`/`scrollLeft`). The layer repaints from
  `render()` and the outline-row write-back paths via a new `paintText()` helper
  (`el('text').value = text()` → `paintText()`), and from the `input` handler
  via `paintTextHl()`. A new `keydown` handler on `#text` traps **Tab** (two
  spaces at the caret), **Shift-Tab** (drop up to two leading spaces),
  multi-line **Tab/Shift-Tab** (indent/dedent every touched line, selection
  preserved) and **Enter** (carry the line's leading indent, plus two more when
  it ends in `:`); every branch edits through `document.execCommand('insertText')`
  (with a `setRangeText` fallback) so native undo and the `#dirty` badge keep
  working and the existing `input` handler re-splits `lines`. No core change —
  suite **2051 passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R8 of 10: the set repertoire is a
  first-class Sets section of the palette modal** (`356e84f`). R7 physically
  moved `#repertoire` inside the modal but left it a tucked-away
  `<details><summary>Sets</summary>`. R8 makes it visible and titled:
  `<section id="repertoire">` with an `<h2>Sets <span
  id="repertoire-count"></span></h2>` bar in the same treatment as the
  "Movements" head, the New set / Save showing / Export / Import strip, then a
  scrolling (`max-height`) `#set-list`. Every id `builder.js` binds stays
  stable; the three now-meaningless `el('repertoire').open = true` lines
  (set-new / set-save / set-import) are gone. New `shownMovements()` factored
  out of `renderPalette`, and a new `addShowingToSet(name)` behind a per-card
  `⊕` button that folds the currently-shown palette list into that set — the
  "compose from the current results" half of the brief, next to the existing
  checklist toggle. `renderSets` / `renderSetList` / `renderSetCard` /
  `renameSet` / `addSetToOutline` / `setsChanged` unchanged in behaviour;
  `localStorage['wdl.sets']` and the `{format:'wdl-movement-sets', version:1,
  sets}` export/import envelope unchanged. No core change — suite **2051
  passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R7 of 10: the movement palette is a
  ⌘K / add-row modal; the transitional drawer is retired** (`d1a89ce`). The R1
  overlay drawer behind the header `☰ Movements` toggle is gone. The palette is
  now a summoned `<dialog id="palette-modal">` holding the same inner DOM —
  `#search`, `#set-pick`, `#muscle-filter` chips, `#palette`, and `#repertoire`
  (set management untouched; R8 folds it in). It opens on **⌘K / Ctrl-K**
  anywhere, on **+ movement**, and on **Enter on an outline row**; picking a
  movement inserts `lineFor(m)` at the focused row via the existing write-back
  (`replaceLogical` when that row is blank, else `insertAfter`) and closes.
  Esc (the `<dialog>` `cancel` event) and a backdrop click both close through a
  `closePalette` that hands focus back to the editor; Esc while composing a set
  exits compose mode first, as the drawer's Esc did. All three filters still
  combine inside the modal — text, muscle chips (AND), saved set — with every
  filter id stable, so `renderPalette` / `renderMuscleChips` needed no change;
  they now render on open and re-render on filter input, as before. ⌘K is scoped
  and only `preventDefault`s when it should open, and is a no-op mid-IME.
  Removed: `#drawer` / `#drawer-backdrop` / `.drawer*` CSS / `setDrawer` / the
  `#palette-toggle` header button and its handlers / `.ghost` CSS / the
  `wdl.palette-open` bootstrap (the modal has no persistent open state). No core
  change — suite still **2051 passing**, 1 pending. *Touched:*
  `apps/builder/index.html`, `apps/builder/builder.css`,
  `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R6 of 10: per-section muscle "adds"
  below the body map** (`895404a`). The Analysis tab shows one whole-workout
  body map; for a workout with named sections there was no read of what each
  section contributes. R6 adds, between `#body-hint` and the goals block, one
  terse `.adds-line` per top-level named section — *"warmup adds: glutes,
  quads, chest, triceps, …"* — naming the distinct muscles that section brings
  in (primary in workout order, then secondary marked "(light)", capped at 6
  with "…"; "—" when a section has no attributed movement). Derivation is
  entirely app-side, in a new `renderBlockAdds()` called from the top of
  `renderBody()` so it survives every re-render path: it re-parses/compiles,
  filters `workout.body` for `n.node === 'block' && n.type === 'section'` (the
  same test R3's `kindOf` and R4 use), and scopes `exposures(timeline).list` to
  each section by matching `e.path[0]` to the section's index in
  `timeline.root.items` — found by source line, not position, so a top-level
  `xN` step or `every` interrupt can't misalign it. Nothing renders for a
  sectionless workout (no container content, no heading); the adds lines don't
  change with the `#body-mode` picker. New `#block-adds` container;
  `.block-adds` / `.adds-line` / `.adds-label` use `--ink` / `--dim` / `--rule`
  only — no `--kind-*` / `--rail` touch. Verified light + dark with a
  multi-section workout, mode-switch, and a sectionless workout. No core change
  — suite still **2051 passing**, 1 pending. *Touched:*
  `apps/builder/builder.js`, `apps/builder/builder.css`,
  `apps/builder/index.html`.*

- **2026-08-31 — Builder layout redesign, R5 of 10: Goals restyled into a
  proper block in the Analysis tab** (`47fd26b`). The goals controls — an `<h2>`
  with an inline `<select>`, a loose button row, then three stacked `<ul>`s —
  are now a titled `<section class="goals-block">`: heading, a `.goals-bar`
  holding the set picker (`#goal-pick`, now a bordered control) beside the
  `.goal-tools` toolbar (Edit rules / Open… / Save as… / `.wdlg` / Delete), the
  `#goal-text` `.wdlg` editor revealing inline beneath it, and `#goal-errors` /
  `#goal-notes` / `#findings` grouped in a `.goals-out` output region. **DOM
  reorganise + CSS only** — every id is stable and every handler in `builder.js`
  is untouched (all bound by id, none container-scoped), so no `builder.js`
  change was needed. `.goal-tools` carries its own flex now the `.row.tight`
  wrapper is gone; the hidden `<input id="goal-file">` stays in the DOM. Both
  themes, existing `--ink` / `--dim` / `--rule` / `--panel` tokens only — no
  `--kind-*` / `--rail` touch. Verified light + dark: picker options, Edit rules
  reveal/hide + live re-check, Save as… → set appears in the picker, Delete
  shows for a saved set and removes it; the summary band `<dl>`, `#steps`,
  `#diagnostics`, the body map and the Reads-as tab are all unchanged. No core
  change — suite still **2051 passing**, 1 pending. *Touched:
  `apps/builder/index.html`, `apps/builder/builder.css`.*

- **2026-08-31 — Builder layout redesign, R4 of 10: Reads-as tab is a
  block-grouped run reading + a show-every-cue toggle** (`f8cb0a8`). The
  **Reads as** margin tab, an empty placeholder since R1, now carries
  `renderReadsAs()`: (a) the run grouped by block, read off
  `parse().workout.body` rather than cue-by-cue — one titled group per
  top-level block, header label taken from the raw source line as written (`:`
  and any inline body dropped, so rounds / scheme / window are stated once by
  the header, not repeated per rep), direct steps + rests collapsed onto one
  `·`-joined inline row (`Air Squat ×10 · 200m Run · rest 1min`), nested blocks
  and `every` overlays recursed with a left rule; synthesised label fallback
  when a header node has no physical line. (b) A **"show every cue (N)"** toggle
  to the full, uncapped per-cue list — the same rows `#steps` builds, factored
  into a shared `cueRow()` helper so the Analysis tab's capped list and this one
  cannot drift; state in `localStorage['wdl.reads-expanded']`, read fresh each
  paint so it survives a re-render, a tab switch and a reload. `renderReading`
  still owns `#summary` / `#diagnostics` / `#steps` untouched — the summary band
  `<dl>` and the Analysis cue list are unchanged. Compile failure degrades to a
  short message in `#view-reads`, no exception. Both themes; new CSS is existing
  `--ink` / `--dim` / `--rule` tokens only. No core change — suite still **2051
  passing**, 1 pending. Verified by driving the builder light + dark with a
  named `warmup:` section, a `21-15-9 for time:` ladder, an `AMRAP 12min:` with
  an inline `rest`, and a top-level `rest`. *Touched: `apps/builder/builder.js`,
  `apps/builder/builder.css`.*

- **2026-08-31 — Builder layout redesign, R3 of 10: Outline as a document +
  per-kind rails** (chain item 16, folding in 15c; `d8edde3`). The Outline row
  rhythm loosened; the `#` title renders as a heading set apart with air beneath;
  zero-indent `@` directives render as a dim, smaller preamble block a notch
  under the title and above the workout body — presentation only, every
  `input.line` / write-back path unchanged. New **`--rail`** token darker than
  the `--rule` hairline (light ~2.3:1 against page and panel, up from the
  design-critique's ~1.05:1; dark ~2.3:1), pointed at by `.node .rail`, which now
  stretches to the row's full height so nesting levels read as continuous lines.
  New shared **`--kind-*`** colour tokens (`title`, `directive`, `section`,
  `header`, `step`, `rest`, `comment`), defined in both themes and named for the
  line kind — **R9's Text-tab highlighter consumes these** — each driving a thin
  coloured left edge on `.node .line-wrap`. `renderOutline` builds a `kindOf` map
  off `parse().workout.body` (step / rest / `section` = block `type==='section'`
  / `header` = every other block type + `interrupt`); the walk classes
  `data-kind` from raw text for title + directive + the synthesised comment row,
  from `kindOf` otherwise, falling back to colon-terminated → `header` else
  `step` — so a broken step keeps the step marker under the `.bad` red border
  ("a step, and broken"). No core or grammar change — suite still **2051
  passing**, 1 pending. Verified by driving the builder light + dark with a
  titled, directive'd, commented, multi-section workout including a `rest 90s`
  and a deliberately broken step. *Touched: `apps/builder/builder.js`,
  `apps/builder/builder.css`.*

- **2026-08-30 — Builder layout redesign, R2 of 10: comment rows first-class in
  the Outline + a comment-aware splice in `edit.ts`** (chain item 12, `973d80a`).
  `spans()` now gives every own-line `//` comment its own single-line span, so
  `replaceLogical` / `remove` / `insertAfter` / `moveTo` address a comment line
  unchanged; `move` and `shift` took a dedicated comment path because the
  following node's span still swallows the comments written above it (moving a
  block keeps carrying `// the buy-in`) and a shared splice would double-cut.
  `move` on a comment steps it over the adjacent rendered row — another comment
  (a line swap) or a real node (past that node's whole subtree). `renderOutline`
  synthesises a `.node.comment` row per own-line comment, above the line it
  attaches forward to and at that line's depth; a trailing comment on a content
  line stays in that row's input; trailing/orphan comments render at the margin.
  `+ comment` joins the add-row buttons (inserts `// ` at the focused row). The
  move/reorder drag wiring is now a shared `attachRowDrag`. Also fixes the stray
  empty `data-line="0"` row a trailing-comment file used to draw. Verified by
  driving the builder light + dark (own-line comment above a block, trailing on
  a step, trailing at EOF — all visible and editable; add/edit/delete/indent/
  move/drag write back and survive a Text-tab switch; Canonicalise + diagnostics
  unaffected). Suite 2038 → **2051 passing**, 1 pending (13 cases in
  `test/edit.test.ts`). *Touched: `apps/builder/builder.js`,
  `apps/builder/index.html`, `packages/core/src/edit.ts` + `test/edit.test.ts`.*

- **2026-08-30 — Builder layout redesign, R1 of 10: the layout shell landed.**
  Direction **C (Document + margin)** — a fixed header (WDL mark · `☰ Movements`
  toggle · centred document title read off `parse(text()).workout.title` ·
  Open…/Download/board file cluster · item-20 identity + My workouts), a
  scrolling `.stage` holding a centred `.sheet` grid: the editor (Outline/Text
  tabs, unchanged) beside a right column = a **sticky summary band** (the
  `title / cues / duration / cap / score` `<dl>`, split out of `renderReading`)
  + an **[Analysis][Reads as]** tab strip. Analysis (default) carries the cue
  `#steps` list, `#diagnostics`, the body map, and the whole goals block, and
  **has its own `overflow:auto` + bounded height** — a long analysis scrolls
  inside it instead of pushing the page, the read-pane scroll bug the
  design-critique flagged 🔴. Reads-as is an empty placeholder for R4.
  `Canonicalise` moved from the header onto the editor's tab strip (it acts on
  the buffer). Movements is now a transitional overlay **`.drawer`** behind the
  `☰` toggle (`localStorage['wdl.palette-open']`, default closed) with all its
  `#palette` / `#search` / `#set-pick` / `#repertoire` / `#muscle-filter` DOM
  unchanged inside it — R7 retires it. The three-column `main` grid and the
  1180/900 breakpoints are replaced by the sheet layout (1100px narrowing,
  820px single-column stack). **No behaviour change** — every feature
  re-housed, verified by driving the builder light + dark at 1440/1280/1000/
  700px. `setAnalysisTab` persists to `localStorage['wdl.analysis-tab']`
  (default `analysis`). No `packages/core` change — suite still 2038 passing,
  1 pending. *Touched: `apps/builder/index.html`, `builder.css` (wholesale),
  `builder.js` (doc-title in `renderReading`, `#steps` split out of the
  summary, `setAnalysisTab`, the drawer toggle).* The R-series (R1–R10) closes
  together — see [../tasks/current.md](../tasks/current.md).

- **2026-08-30 — Accounts, saved workouts and sharing in the apps (queue item
  20 — live).** Final item of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage));
  the epic (18–20) is now closed in
  [../tasks/completed.md](../tasks/completed.md).
  Additive on the static apps — signed out, nothing changed (`Download .wdl` /
  `Open…` a local file untouched); `packages/core`, the grammar and the spec are
  not touched, a stored workout is its `.wdl` text in a column.
  - **`apps/shared/pocketbase.js`** — a **hand-rolled ~8-call `fetch` client**,
    no SDK (DEC-003 / DEC-008: no npm runtime dep, no build step, same rule that
    vendors `ohm-js`). Google OAuth2 by the **redirect flow**, not the SDK's
    popup+realtime dance: `GET auth-methods` → navigate to Google's `authURL`
    with our `redirect_uri` → `POST auth-with-oauth2` with
    `code`/`codeVerifier`/`redirectURL` → `{ token, record }` into
    `localStorage`; `refreshAuth()` revalidates on startup and clears a stale
    token on 401/403. Records: `create` / `listMine` / `getById` / `update` /
    `remove` against the `workouts` collection. Targeted at PocketBase
    **v0.40.x** route names (checked against the live `/api`); the header
    comment says which and why hand-rolled.
  - **`apps/builder/auth-callback.html`** — the fixed URL Google returns to
    (a redirect flow needs one). Runs `completeSignInFromRedirect()` and
    bounces back to the builder, hash and all. **This URL
    (`https://wex.androidempathy.com/apps/builder/auth-callback.html`) must be
    registered as a second authorised redirect URI in the Google Cloud
    Console** — see `deploy/README.md` §8; without it Google returns
    `redirect_uri_mismatch`.
  - **Builder** — a *Sign in with Google* control and the signed-in identity in
    the header; a **My workouts** dropdown: **Save** (create if new, update if
    opened from the server — explicit, never autosave), *Save as copy*, open a
    saved workout into the editor, rename, delete, and a **visibility** select
    (`private` / `unlisted` / `public`) + **Copy link**. The buffer is stashed
    to `localStorage` across the sign-in redirect so it survives the round trip.
  - **Board** — `/apps/display/?w=<id>` fetches the record and runs it; a
    `#<source>` hash behaves **exactly as before** and wins when both are
    present. A `private`/missing id 404s and the board shows a "not found" line
    (no crash). A `?w=` load leaves the clean id in the address bar rather than
    expanding the whole source into the hash — expanding it would leak the
    source past a later `unlisted → private`.
  - **Share URL is `/apps/display/?w=<id>`**, not a pretty `/w/<id>`: measured
    against the live instance, PocketBase serves `pb_public/` with an index
    fallback (an unknown path returns the root `index.html`), so `/w/<id>`
    can't route without a `pb_hooks` handler — an infra change for no gain over
    a query param on a file that exists. No `scripts/deploy-web.mjs` change:
    both new files ride the wholesale `apps/` copy.
  - **Verified headless** — against the live `auth-methods` endpoint and a
    faithful local fake of the `workouts` collection: sign-in URL construction
    (state + PKCE + `redirect_uri`), the callback token exchange, Save
    create-vs-update (one record, not two), Save as copy, open-into-editor,
    rename, delete, visibility changes, share links resolving for `unlisted`
    and 404ing for `private` to a stranger, the signed-out builder and the
    board's `#<source>` hash both unregressed, light + dark, zero console
    errors.
  - **Verified live** — Chris registered the second Google redirect URI,
    redeployed, signed in with a real Google account, created workouts, saw
    them persist and list, and inspected them in the SQLite DB. Epic 18–20
    closed to [../tasks/completed.md](../tasks/completed.md); the builder-UX
    chain (12 → 16 → 17 → 15 → 13 → 11) is next, held pending a decision on a
    builder layout redesign now being explored on a design canvas.

- **2026-08-30 — The builder + board are live at
  `https://wex.androidempathy.com/`.** Queue item 19 of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)).
  Item 19's original plan assumed an editable nginx vhost with its own `root`;
  item 18 voided that — the DreamHost managed VPS gives no root and the panel
  proxy sends the **whole domain** to PocketBase — so the static apps ship into
  **PocketBase's own `pb_public/`** (`~/pb/pb_public/` on the box), which
  `apis.Static` serves at `/` for any non-`/api/`, non-`/_/` path. New
  **`scripts/deploy-web.mjs`**: runs `npm --prefix packages/core test` (bails on
  red), runs `build-web.mjs`, assembles `build/deploy/pb_public/` **repo-shaped**
  (the apps fetch by relative path — `apps/`, `build/web/core/`,
  `spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
  `examples/goals/`, plus a generated `index.html`), then `rsync -az --delete`
  to the box. SSH target via `--ssh` / `WDL_DEPLOY_SSH`, never baked in. `/`
  redirects to `/apps/builder/` (generated, so `--delete` can't orphan a
  hand-placed file). **MIME:** PocketBase serves `.ohm` / `.wdlg` as
  `text/plain` (Go's content sniffer) and both apps `fetch().text()` them
  anyway, so no rename / `pb_hooks` / config was needed — `.js` is
  `text/javascript`, `.json` is `application/json`. **Cache:** `pb_public` gets
  `Last-Modified` only — no `Cache-Control`, no `ETag` (the `max-age` line in
  PocketBase is `/_/`-only). Accepted as-is: one `rsync` rewrites
  grammar + registry + core together so they can't drift, and nothing is
  content-hash-pinned; the escalation (a `pb_hooks` `Cache-Control` middleware)
  is documented in `deploy/README.md` "## 10. Static apps", not shipped.
  **Deployed and verified live** — drove both apps against
  `https://wex.androidempathy.com/`: builder (129-movement registry, grammar
  parse, body map, goal picker all load), board (`#<encoded-source>` share link
  resolves, Start advances the clock through the 21-15-9 tiers), both light and
  dark themes, zero console errors; `/api/health` and `/_/` unaffected. Items
  18–20 stay in [tasks/current.md](../tasks/current.md); 19 marked done inline.
  Next: **20** — frontend Google sign-in, saved workouts, sharing. Touches:
  new `scripts/deploy-web.mjs`; `deploy/README.md` "## 10"; this file;
  [what-exists.md](../topics/what-exists.md) **Hosting** row;
  [running-it.md](../topics/running-it.md) "Hosting / deployment";
  [layout.md](../topics/layout.md).
- **2026-08-30 — PocketBase is live on the VPS; the deployment epic (items
  18–20) has its backend.** Queue item 18, the first of the epic Chris made top
  priority the same day ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage),
  [goals.md](../goals.md) "## Pivots"). **PocketBase v0.40.1** runs on the
  DreamHost managed VPS at **`https://wex.androidempathy.com`** as a per-user
  systemd service — no root on that box, but `loginctl enable-linger` gives
  boot-start + crash-restart, verified across a real reboot. TLS + routing are
  the **DreamHost panel's Proxy Server** (whole domain → port 8090) and panel
  Let's Encrypt, not nginx (panel-owned) — so `deploy/nginx/wdl.conf` is
  reference-only and the committed process unit is `pocketbase.user.service`.
  **Google OAuth2** is wired (Cloud Console client + PocketBase provider) and a
  real sign-in was tested end to end — it creates a `users` record. One
  collection, **`workouts`**: `owner` (relation→users, required), `title`,
  `source` (the `.wdl` body), `visibility` (`private`|`unlisted`|`public`),
  auto `created`/`updated`; write is owner-only, read is
  `owner = @request.auth.id || visibility != "private"`. Applied as a
  `deploy/pocketbase/pb_migrations/` JS migration, clean on v0.40.1. **Nothing
  in `packages/core`, the grammar or the spec changed** — a stored workout is
  its source text in a column. **Known issue, documented:** the panel proxy
  connects over the VPS public IP, so PocketBase must bind `0.0.0.0` and port
  8090 is internet-reachable in plaintext past the TLS proxy; mitigated (auth on
  every route, collection rules, HTTPS `Application URL`), real fix is an open
  DreamHost support ticket to firewall the port. `deploy/` (runbook + templates,
  no secrets) is committed. Items 18–20 stay in
  [tasks/current.md](../tasks/current.md) — they close together; 18 is marked
  done inline. Next: **19** — deploy the static builder/board into
  `pb_public/`. Touches: new `deploy/` tree; [what-exists.md](../topics/what-exists.md)
  **Hosting** row; [running-it.md](../topics/running-it.md) "Hosting /
  deployment"; [layout.md](../topics/layout.md).
- **2026-08-29 — An unread parenthetical after a movement is held, not
  swallowed into the name.** Queue item 14 (top priority, Chris) — the only
  open item that corrupted output silently. `- 12 Around The Worlds (each
  direction)` parsed clean with the parenthetical folded into the movement
  name, so the movement resolved to no registry entry (muscle/volume analysis
  went blank) and `wdl fmt` emitted `... (each direction)s`. Fix is queue item
  5's `unreadableRange` pattern one construct over: a new `unreadableParen`
  production (`"(" (~")" any)+ ")"`) in `qualifiedPart` and `stepPart` **after**
  `laterality` and `rxSplit`, routing the whole parenthetical verbatim (parens
  included) into `Step.unknown`. `validate`'s `unread()` reports it as a
  `note`, `format` writes it back after the read modifiers, and the movement
  name is left clean. Edges: match runs to the first `)` (nested `(a (b) c)`
  not caught); ~15 raw-import registry titles that carry a parenthetical
  (`Front Squat (Clean Grip)`) now peel it to a `note` and resolve against the
  base name. No corpus file writes an unread parenthetical, so
  `interpretations.json` and `registry/workouts.canonical.json` regenerate
  unchanged. Suite **2027 → 2038** (+11 vocabulary/grammar cases), 1 pending
  unchanged. Verified by driving the builder in both themes: movement resolves
  (body map lights chest), diagnostics show the `note`, Canonicalise leaves the
  parenthetical intact. `spec/spec-0.1.md` §4 and §11.1 state the rule and the
  unbalanced-paren behaviour;
  [../topics/settled-decisions.md](../topics/settled-decisions.md) records it
  beside item 5's.
- **2026-08-29 — `pluralize` no longer takes the `s` on a leading modifier.**
  A self-contained defect Chris caught in the builder's "what it reads as"
  pane: `- 12 Bent Over Barbell Row` read as `12 Bents Over Barbell Row`.
  `pluralize` (`packages/core/src/fold.ts`) treats the word before a standalone
  preposition as the head noun — right for `Lateral Burpee over Dumbbell` /
  `Atlas Stone to Shoulder`, wrong when that word is the *first* in the name
  and so a participle, not a noun. Now requires a real word before the head
  (`at > 1`, not `at > 0`); the trailing noun takes the plural instead
  (`Bent Over Barbell Rows`). Every corpus name of the `[noun] [prep] [obj]`
  shape has a word before the noun, so nothing that read correctly moved —
  goldens and `registry/workouts.canonical.json` regenerate unchanged. Suite
  **2025 → 2027** (+2 `fold.test.ts` cases), 1 pending unchanged. Also filed
  from the same session: a `builder-ux.md` "## Outline" note that the outline
  shows no row for a `//` comment (they live only in the Text tab), and queue
  item 11 (a bare-word block header should read as an inert section, not an
  "unrecognized header" error).
- **2026-08-29 — `registry/duplicate-candidates.json` retired; `find-duplicates.mjs`
  is a run-on-demand report.** A defect task off
  [../topics/known-debts.md](../topics/known-debts.md), not a queue item (all
  numbered items are closed). The 694-row file was generated once on 2026-08-12
  and never touched: `find-duplicates.mjs` is not in `build-canonical.ts`,
  nothing reads the file, no test guards it — a stale artefact rotting in the
  tree, the shape the "every pipeline step must be in the pipeline" lesson
  exists to stop. **Option A of three:** deleted the committed file; the script
  now writes its summary to stderr and the candidate JSON to stdout, so `node
  scripts/find-duplicates.mjs > pairs.json` captures a fresh list when a curator
  wants one — the same treatment `check-aliases.mjs` already gets. Option B
  (wire it into the pipeline, pin it with a drift test) was rejected: no
  downstream consumer exists, and the script never merges. Pipeline still
  succeeds, `git status` clean apart from the two intended changes; **2025
  passing, 1 pending**, before and after (the suite does not touch either).
  See [../topics/known-debts.md](../topics/known-debts.md),
  [../topics/running-it.md](../topics/running-it.md),
  [../topics/layout.md](../topics/layout.md).
- **2026-08-29 — The builder's Outline and Text are one tabbed editor pane.**
  Queue item 10 (high priority, Chris). The `<main>` grid went 4 → 3 columns —
  the Outline (structural GUI) and the raw Text `<textarea>`, previously two
  side-by-side full columns a user only ever edits one of, are now two tabs of
  a single `.editor-pane` cell. A tab strip stands in for the two `<h2>` bars;
  the inactive view is `display: none`; `render()` still repaints both, so a
  switch is show/hide only (`lines` is the single source of truth both repaint
  from). The `#dirty` "edited" badge moved onto the Text tab so it stays
  visible from the Outline tab; the `+ movement / + block / + rest` row stays
  with the Outline. Choice persisted in `localStorage['wdl.editor-tab']`,
  default Outline. `@media (max-width: 1180px)` now drops to 2 columns under a
  full-width palette; the 900px stack is unchanged. **No core or test change**
  (the suite does not touch the builder DOM; 2025 passing, 1 pending, before
  and after); verified by driving the builder. See
  [../tasks/completed.md](../tasks/completed.md),
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Layout" and
  [../topics/what-exists.md](../topics/what-exists.md) Apps row.
- **2026-08-29 — The one-line interrupt overlay can state its bound.** A
  defect task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `every 1min: 5 Burpee` (spec §5.8) parsed as an `Interrupt`, but
  a one-token regex in `parseNode` could not see the `every` grammar rule's
  bound tails, so `every 90s x 5: …`, `every 90s for 12min: …` and
  `every 1min until failure: …` were unwritable on one line. `Interrupt` gains
  `count?` / `duration?` / `untilFailure?` — the field names `Block` already
  uses for a clock, one spelling — and `parseNode` reads the head via the
  grammar's own `every` production (`tryHeader`) rather than a second bound
  regex. `format` mirrors the clock header's spelling (no `EMOM` sugar);
  `timeline` carries the bound onto `group.interrupt` and into the outline,
  not into `estimate()`. Suite **2020 → 2025 passing** (+4 vocabulary overlay
  twins, +1 timeline case), 1 pending unchanged. `interpretations.json` and
  `registry/workouts.canonical.json` unchanged — no corpus file writes a
  bounded overlay. Design decision in
  [../topics/settled-decisions.md](../topics/settled-decisions.md); builder
  `»`-caret follow-on left unwired, noted in
  [../topics/builder-ux.md](../topics/builder-ux.md).
- **2026-08-29 — `registry/workouts.canonical.json` is guarded against drift.**
  A test task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `scripts/build-workouts.mjs` now exports `buildWorkoutsDoc()`,
  the pure core of its derivation (CLI byte-identical, behind a main guard);
  new `packages/core/test/workouts-canonical.test.ts` re-runs it in process
  and asserts equality against the committed file, one `it()` per corpus
  workout modulo the `generated` stamp — the guard `interpretations.json` and
  `vocabulary.json` had and this file did not. Suite **1817 → 2020 passing**
  (+202 workouts, +1 envelope), 1 pending unchanged. No registry file was
  rebuilt. See [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-29 — `Pec Deck` = `Butterfly` = `Machine chest fly`.** A curation
  task off [../topics/known-debts.md](../topics/known-debts.md), not a queue
  item. The three wger-only / wger-sharing records `find-duplicates.mjs`
  cannot compare by construction were checked against their source
  descriptions — all one seated chest-fly machine — and merged, along with
  everkinetic's `Butterfly Machine`, into one curated `pec-deck` record
  carrying `sameAs`. `cable-crossover` stays separate (standing, cable,
  `force: push`, four sources). **3112 → 3109 records; pool 128 → 129.** No
  corpus workout names any of them, so the golden snapshot did not move.
  `generate.test.ts`'s pool-size pin went 128 → 129. See
  [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-25 — The queue emptied out.** Items 5 (a distance/duration range
  is caught rather than silently swallowed into the movement name), 7 (a body
  map, front and back, in the builder and on the board), and 9 (the board
  runs a cap as a clock, stopping where the cursor stands rather than
  claiming the end) all closed, on separate branches merged the same day.
  Every numbered item raised so far — the whole 0-series, 1, 1a, 2, 3, 4, 5,
  6, 7, 8, 8a and 9 — is now closed; see
  [../tasks/completed.md](../tasks/completed.md). Also landed the same day:
  the builder's outline caret now does real per-row movement completion
  instead of an empty native datalist, an indent guard against orphaning a
  first-in-document line, distinct rail colours for back-to-back repeating
  blocks, the builder's summary showing a workout's scoring rule, and the
  body map's anatomical shapes were swapped in from a real reference source.
- **2026-08-23 — A load can be a word.** `heavy`, `moderate`, `light`,
  `unloaded` are a fifth `Load` kind, `qualitative`, so a target like `@ heavy`
  is visible to anything checking for a load instead of sitting inert in
  `raw`. Queue item 6, closed. See
  [../tasks/completed.md](../tasks/completed.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-23 — Results and `measure: load`.** A new `.wdlr` record type, the
  board writing one when a session ends, and a `progress` goal rule that can
  ask "did the load go up" across a series of them. The largest single piece
  of work in the queue's history; decisions and defects found while building
  it are split across
  [../topics/settled-decisions.md](../topics/settled-decisions.md) and
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-23 — The generation pool became a judgement, not a score.**
  `mark-core` no longer lets catalogue agreement alone put a movement in the
  pool `wdl generate` draws from; **178 → 129**. Queue item 4, closed.
- **2026-08-23 — Registry merge cleanup.** An explicit alias now outranks a
  record's own id (queue item 8a); `sameAs` lets a curator merge two records
  that are one movement, and a source's entry can be redirected to the right
  record without merging (the `Air Bike` split). `check-aliases.mjs` is down
  to one open collision (`assault bike` on `Bike`). See
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-16 — `3 RFT:` and free header ordering.** `3 RFT:` reads as
  `3 rounds for time:`, and a block's kind may now be stated in any comma
  position (`for time, 3 rounds:` no longer silently drops the count). Queue
  item 0f, closed.
- **2026-08-15 — The parser became the grammar.** `parse.ts` now matches and
  walks `spec/grammar-0.1.ohm` directly; the regex chain (83 operations) is
  gone. Nine defects closed with it. Queue items 0/0a–0e, closed; the decision
  history is in [../topics/settled-decisions.md](../topics/settled-decisions.md).

Fold an entry into the owning topic file once it stops being *recent* —
this file is for changes that would still change how someone reasons about
picking up new work today.
