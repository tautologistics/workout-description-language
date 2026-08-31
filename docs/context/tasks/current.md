# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

The deployment epic (items 18–20) **landed 2026-08-30 and is in
[completed.md](completed.md)**. What is open now is the **builder layout
redesign** — Chris chose direction **C (Document + margin)** off the Claude
Design canvas (visual brief:
[../topics/builder-ux.md](../topics/builder-ux.md) "### The layout redesign").
It is broken into ten ordered stages **R1 → R10** below, each a landable branch
sized for its own session. The old builder-UX chain items (12, 16, 17, 15) are
**absorbed** into the stages that touch the same code; **11**, **13** and
**15b** are genuinely independent of the layout and are listed separately after
the stages. All redesign work is app-level (`apps/builder/*`, `apps/display/*`,
and `packages/core/src/edit.ts` for R2) — no grammar or spec change.

### The builder layout redesign — stages R1–R10

**How each stage lands** (stated once): fresh branch off `origin/main`
(`git fetch origin`, `git checkout -b <name> origin/main`; `main` is checked out
elsewhere so `git checkout main` will not work). Push `git push origin
<branch>:main` and confirm the SHA moved with `git ls-remote origin main`.
Commit message body ends `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
When a stage lands, **strike it here with `Done <date>` and one line on what
shipped** (do not move it yet — the R-series closes together, like the
deployment epic did); a stage that maps to an old chain item also strikes that
item's detailed entry below. When R10 lands, move R1–R10 to
[completed.md](completed.md) and update
[../topics/what-exists.md](../topics/what-exists.md)'s **Apps** row +
[../current/recent-changes.md](../current/recent-changes.md). Verify every stage
by **driving the builder** in both themes with a multi-section workout, and run
`npm --prefix packages/core test` (only R2 can move it).

- ~~**R1 — Layout shell.**~~ **Done 2026-08-30** (`758dff1`). The direction-C
  frame landed with no behaviour change — every feature re-housed, verified by
  driving the builder light + dark at 1440/1280/1000/700px. Header: WDL mark ·
  `☰ Movements` toggle · centred document title (from `parse(text()).workout.title`,
  repainted in `renderReading`) · **Open…/Download/board grouped as a plain
  bordered button cluster** (`.file-cluster` — three items didn't warrant a
  popover) · item-20 identity + My workouts. `Canonicalise` moved onto the
  editor's tab strip. `.stage` (scrolls) → centred `.sheet` grid: `.doc-col`
  (Outline/Text tabs, unchanged) | `.right-col` = a **sticky `.band`** holding
  the `title / cues / duration / cap / score` `<dl>` (`renderReading` paints
  the `<dl>` into `#summary` and the cue list into a new `#steps` in the
  Analysis panel) + a `[Analysis][Reads as]` strip. **Analysis** (`#view-analysis`,
  default, `setAnalysisTab` ↔ `localStorage['wdl.analysis-tab']`) carries
  `#steps` + `#diagnostics` + body map + the goals block and has its own
  `overflow:auto` + bounded height — the read-pane scroll 🔴 is fixed.
  **Reads as** is an empty placeholder for R4. Movements is a transitional
  overlay `.drawer` + backdrop behind `☰` (`localStorage['wdl.palette-open']`,
  default closed), all its DOM unchanged inside. Replaced the three-column grid
  and the 1180/900 breakpoints (now 1100px narrowing, 820px stack). *Touched:*
  `apps/builder/index.html`, `builder.css` (wholesale), `builder.js` (small:
  doc-title, `#steps` split, `setAnalysisTab`, drawer toggle). No `packages/core`
  change — suite 2038 passing, 1 pending, untouched.

- ~~**R2 — Comment rows first-class in the Outline + `edit.ts`.**~~ **Done
  2026-08-30** (`973d80a`). `spans()` in `packages/core/src/edit.ts` now gives
  every own-line comment its own single-line span — `replaceLogical` / `remove` /
  `insertAfter` / `moveTo` reach it unchanged; `move` and `shift` took a
  dedicated comment path (the following node's span still swallows the comments
  above it, so the two readings overlap by design and a shared splice would
  double-cut). `move` on a comment steps it over the adjacent rendered row.
  `renderOutline` synthesises a `.node.comment` row per own-line comment, above
  the line it attaches forward to at that line's depth; trailing comments on a
  content line stay in that row's input; trailing/orphan comments render at the
  margin. `+ comment` joins the add-row buttons. Shared `attachRowDrag` for both
  row kinds. Also fixed the stray `data-line="0"` row a trailing-comment file
  drew. Suite 2038 → **2051 passing**, 1 pending (13 cases in `edit.test.ts`).
  *Touched:* `apps/builder/builder.js`, `apps/builder/index.html`,
  `packages/core/src/edit.ts` + `test/edit.test.ts`.

- ~~**R3 — Outline as a document + line-kind rails** *(= chain item 16 below,
  folding in item 15c).*~~ **Done 2026-08-31** (`d8edde3`). Outline row rhythm
  loosened; `#` title renders as a heading set apart with air beneath; zero-indent
  `@` directives render as a dim smaller preamble block a notch under the title
  and above the body (presentation only — every `input.line` / write-back path
  unchanged). New **`--rail`** token darker than `--rule` (light ~2.3:1 vs the
  ~1.05:1 critique measurement, dark ~2.3:1), and `.node .rail` now stretches to
  the row's full height so nesting levels read as continuous lines. New shared
  **`--kind-*`** tokens (`title`, `directive`, `section`, `header`, `step`,
  `rest`, `comment`) defined in both themes, named for the line kind (R9's
  highlighter consumes them), each driving a thin coloured left edge on
  `.node .line-wrap`. `renderOutline` builds a `kindOf` map off
  `parse().workout.body` (step / rest / `section` = block `type==='section'` /
  `header` = every other block type + `interrupt`); the walk classes `data-kind`
  from raw text for title + directive + the comment row, from `kindOf` otherwise,
  falling back to colon-terminated → `header` else `step` — so a broken step
  keeps the step marker under the `.bad` red border. No core change — suite
  2051 passing, 1 pending. *Touched:* `apps/builder/builder.js`, `builder.css`.

- **R4 — Reads-as tab: the compressed run view.** Replace `renderReading`'s
  24-cue enumeration. In the **Reads as** tab: the run grouped by block —
  `warmup — 3 rounds: Air Squat ×10 · Push-Up ×10 · 200m Run`, `30-20-10 for
  time: …`, `AMRAP 12:00: …`, rests inline — read off `laid.cues` /
  `laid.cycles` / the workout tree, **not** cue-by-cue; plus a **"show every cue
  (N)"** toggle to the current fully-expanded list. The `title / cues /
  duration / cap / score` `<dl>` stays in the summary band. *Depends on R1.*
  *Touches:* `apps/builder/builder.js` (a new `renderReadsAs`; `renderReading`
  keeps the `<dl>` + diagnostics), `builder.css`.

- **R5 — Goals rule-management UI in the Analysis tab.** Move `#goal-pick` /
  `#goal-edit` / `#goal-open` / `#goal-save` / `#goal-download` / `#goal-drop` /
  `#goal-text` and `#goal-errors` / `#goal-notes` / `#findings` into the
  Analysis tab's Goals block and restyle. The **logic is unchanged** (all in
  `builder.js` already) — this is a DOM move + CSS. The set picker (examples /
  yours / unsaved), Edit rules, Open…, Save as…, Download `.wdlg`, Delete must
  **all** be present — the first C sketch dropped them to findings only.
  *Depends on R1.* Low risk. *Touches:* `apps/builder/index.html`, `builder.css`,
  minor `builder.js`.

- **R6 — Analysis tab: per-block muscle "adds".** Below the body map, one short
  note per top-level section — *"warmup adds: quads, glutes, chest (light)"* —
  from `exposures()` scoped to that block's cue range (a small new derivation;
  filter the exposure list by cue index, or `muscleLoad` a sub-timeline). Shown
  only when the workout has named sections. *Depends on R1.* No core change.
  *Touches:* `apps/builder/builder.js`, `builder.css`.

- **R7 — Movement palette modal: filters + insert.** The modal that replaces the
  Movements column. Opens on **⌘K** and on **+ movement / Enter on a blank
  outline row**; inserts `lineFor(m)` at the caret / focused row. Carries all
  three current filters at once — **text** (`#search`), **muscle** chips
  (`chosenMuscles` / `worksAll`, AND-combined), **saved-set**
  (`sets` / `set-pick`). Absorbs `renderPalette` / `renderMuscleChips` and the
  palette half of the bootstrap. **Retires the R1 transitional drawer.**
  *Depends on R1.* *Touches:* `apps/builder/index.html` (a `<dialog>` / overlay),
  `builder.css`, `builder.js`. *Verify:* ⌘K and add-row both open it; each
  filter narrows; insert lands at the caret; Esc closes.

- **R8 — Palette modal: set creation / the repertoire.** Fold `#repertoire` into
  the modal — New set, compose (from the current results, or the checklist
  toggle), rename, reorder, remove, export / import (`localStorage['wdl.sets']`
  stays the store). `renderSets` / `renderSetList` / `renderSetCard` /
  `renameSet` / `addSetToOutline` / `setsChanged` move in; the standalone
  `#repertoire` / `#set-*` DOM is removed. *Depends on R7.* *Touches:*
  `apps/builder/builder.js`, `builder.css`, `index.html`. *Verify:* create /
  compose / rename / reorder / remove / add-set-to-outline / export / import.

- **R9 — Text tab: trap Tab + syntax highlighting** *(= chain item 17 below —
  its full write-up stands).* Needs R1 (the tab lives in the new editor cell)
  and R3's `--kind-*` tokens. (a) Tab / Shift-Tab / Enter indent behaviour on
  `#text`; (b) a highlight layer behind the transparent textarea, one colour per
  line kind from the shared palette. *Touches:* `apps/builder/index.html`,
  `builder.css`, `builder.js`.

- **R10 — Directive metadata block + `@`-key type-ahead** *(= chain item 15
  parts a/d below).* In the Analysis tab (or the summary band) a small metadata
  block listing set directives — `id`, `tags` (chips), `date`, `wdl`, any
  `@x-…` — off `workout.directives`, shown only when non-empty (15a). Plus
  type-ahead for directive keys on a zero-indent `@` row (15d), reusing the
  suggestion-dropdown machinery. **15b** (the *board* rendering preamble lines
  as body rows) is board-side — see "Independent" below. **15c** lands with R3.
  *Depends on R1.* *Touches:* `apps/builder/builder.js`, `builder.css`,
  `index.html`.

### Independent of the redesign — sequence separately

- **11 — A bare-word block header is an inert section, not an error.** Grammar +
  `packages/core`, **not** builder/layout: `spec/grammar-0.1.ohm`,
  `block-semantics.ts`, `parse.ts`, spec, goldens. Needs Chris decisions
  (diagnostic-or-silent, canonical case, where the boundary is). Full write-up
  below. Can land any time.

- **13 — Laterality in the builder's `»` panel.** Builder-only, `applyModifier`;
  the `»` panel survives into the new outline unchanged, so this is orthogonal
  to R1–R10. **13c** (picking a laterality mode appends instead of replacing,
  and doubles on re-pick) ships alone, no decision needed. **13a / 13b** need
  Chris (a curation gap; the parens-vs-bare spelling, which is a
  reopen-a-settled-decision). Full write-up below.

- **15b — The board renders every preamble line as a body row.**
  `apps/display/board.js` + `board.css` — board-side, nothing to do with the
  builder layout. See item 15's part (b) below.

- **Post-redesign rethinks** (not scheduled; after R10 or in parallel) —
  `@id` ↔ record-id correlation, account **namespacing** (a username as a
  workout-id prefix; touches the `workouts` collection schema), the board's
  **Edit** button round-tripping into the builder, an **"open on the board"**
  action for saved workouts. In [../topics/builder-ux.md](../topics/builder-ux.md)
  "Accounts, IDs and layout".

---

### Detailed write-ups (referenced by the stages above)

The four entries below predate the redesign and carry the full analysis each
stage needs — R2 ↔ 12, R3 ↔ 16, R9 ↔ 17, R10 ↔ 15(a/d), with 15(b) independent
and 15(c) folded into R3. **11** and **13** below are the independent items.

- **15 — Directives (`@id`, `@tags`, …) are first-class metadata: surface them,
  distinguish them, and complete them.** *High priority (Chris, 2026-08-29),
  from driving the builder + board.* `parse` already collects every `@key value`
  line into `workout.directives` (a `Record<string,string>` —
  `packages/core/src/parse.ts:401`; `ast.ts:244`), values never interpreted. But
  the builder does nothing with it: `renderReading`'s `rows` array
  (`apps/builder/builder.js:697`) shows only `title / cues / duration / cap /
  score`, so an `@id` the author adds is invisible in "what it reads as" — and
  the board's "no @id" message at the end (`apps/display/board.js:606`) is the
  first feedback that it was even read. Only `directives.id` is consumed
  anywhere (the board, for the result record's `result:` head); `@date`,
  `@tags`, `@wdl` are carried and unread.

  Four parts, all app-level (no core/grammar/spec change — directives already
  parse):

  **(a) A metadata section in "what it reads as".** Above or beside the
  `title / cues / …` rows, a small block listing the directives that are set —
  `id`, `tags` (split on comma into chips), `date`, `wdl` version, and any
  `@x-…` extension key verbatim. Only shown when at least one is present.
  Presented as structured metadata, visually apart from the cue list — it
  describes the workout, it is not part of it. Read straight off
  `workout.directives`.

  **(b) The board renders every preamble line as a body row — confirmed, fix
  it.** `draw()` (`apps/display/board.js:138`) builds one row per raw source
  line — `state.lines = source.split('\n')` — and gives special handling only
  to blank (`.blank`) and `//` (`.comment`) lines. So `@wdl 0.1`, `@id …`,
  `@date …`, `@tags …` and the `# title` all render as plain rows sitting at
  the top of what the athlete reads mid-workout; **`@id` is not stripped
  either.** This is the "the board renders the source text, line for line"
  principle (`board.js:9`) applied one step too literally — the preamble is
  *metadata about* the workout, not the workout. Fix: `draw()` skips preamble
  directive rows (a top-of-file run of `@key` lines — match `tryDirective` or
  a `/^@/` test on the pre-body lines) and lifts `@id` and `@tags` into the
  board's header chrome, where the title and division picker already live
  (`apps/display/index.html` header, `board.css`). The `#` title can stay a
  row or move to the header — Chris's call; the directives are the noise.
  Keep "source line for line" for the workout body itself — this narrows it,
  it does not reverse it.

  **(c) `@` lines are called out in the outline.** ~~Once item 12 has the outline
  rendering every line kind, a directive row gets its own class
  (`.node.directive`) and styling~~ **Shipped with R3 2026-08-31** (`d8edde3`):
  a zero-indent `@` row is classed `data-kind="directive"` and renders as a dim,
  smaller preamble block with its own `--kind-directive` left marker.

  **(d) Type-ahead for directive keys.** When an outline row's text starts with
  `@` at zero indentation and the caret is still in the key, offer the
  recognised keys — `@wdl`, `@id`, `@date`, `@tags`, `@author`, and `@x-` for
  an extension attribute (roadmap §11's `@x-gym:` form). **This list is a
  builder-held convention, not grammar-derived** — the grammar accepts any
  `@key` (`directiveKey = nameChar+`), so unlike the block-modifier affordance
  (item 13's cousin, derived from `blockModifier_*`) there is nothing to
  enumerate; hand-list them with a one-line description each, the same shape as
  the movement-suggestion dropdown. Picking one fills the key and leaves the
  caret after it for the value. `@tiebreak` is **not** in this list — it is a
  mid-line step marker (spec §9.6), not a preamble directive, and never starts
  a zero-indent line of its own.

  **Scope:** `apps/builder/builder.js` (`renderReading` metadata block;
  the `@`-key dropdown, reusing the suggestion-dropdown machinery),
  `apps/builder/builder.css` (metadata block + `.node.directive`),
  `apps/builder/index.html` if the metadata block needs a container;
  `apps/display/board.js` + `board.css` only if (b) finds a real leak.
  No `packages/core` change. Verify by driving both apps: a workout with
  `@wdl 0.1` / `@id crossfit:fran` / `@date …` / `@tags a, b` shows a metadata
  block in the builder with id and tag chips; typing `@` on a fresh top line
  opens the key list; the board shows the id (and no raw `@` lines in the cue
  list); canonical round-trip unaffected.

  **Land it / docs:** fresh branch off `origin/main` as the other items
  describe; push `git push origin <branch>:main`, confirm via
  `git ls-remote origin main`; commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When landed: move
  to [completed.md](completed.md); update the **Apps** row in
  [../topics/what-exists.md](../topics/what-exists.md); add a
  [../topics/builder-ux.md](../topics/builder-ux.md) entry; dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- ~~**16 — The outline should show what kind of line each row is.**~~ **Done
  2026-08-31 as R3** (`d8edde3`) — text kept for the reasoning. `renderOutline`
  now sets `data-kind` on every row (title / directive / section / header / step
  / rest / comment), driven off a `kindOf` map built from `parse().workout.body`
  with raw text only for the preamble kinds; each kind gets a thin coloured left
  edge from a shared `--kind-*` token set (defined in both themes for R9's Text
  highlighter to consume), and `.bad` keeps its kind marker under the red border.
  The `--rail` contrast fix rode along. *High
  priority (Chris, 2026-08-29), from driving the builder.* Today
  `renderOutline` (`apps/builder/builder.js:251`) marks a row `.block` (ends in
  `:` or has children), `.comment` (starts `//` — and per item 12 those rows
  are not even emitted), or `.bad` (a parse error on that line). Nothing tells
  a **title** (`#`), a **directive** (`@`), a **rest** (`rest …`), or a plain
  **step** apart, and there is no at-a-glance indicator of the kind — a reader
  scanning the outline cannot see the shape of the file the way the raw text
  shows it.

  **The job.** Give every row a visible kind marker — a coloured left border on
  the row's `.line-wrap` (or a small type badge), one colour/glyph per kind:
  title, directive, section/container header, step, rest, comment. Keep it
  legible in both themes and quiet enough not to fight the content (the rails
  already carry nesting; this is orthogonal). Drive the kind off the parsed
  node where possible (`n.node === 'step' | 'block' | 'rest'`, the
  `movementOf` / `blockOf` maps `renderOutline` already builds) and off the raw
  text only where the parse does not distinguish (title vs directive vs
  comment, which are preamble). Extend the same treatment to `.bad` so an
  error row reads as "step, and broken" rather than only "broken".

  Depends on **item 12** landing first (comment rows have to exist before they
  can be coloured) and dovetails with **item 15(c)** (the `@` directive class).
  Do 12, then 16, then 15 — or 12 + 16 together.

  **Scope:** `apps/builder/builder.js` (`renderOutline` classing),
  `apps/builder/builder.css` (the per-kind styles). No core change. Verify by
  driving the builder against a file with a title, two directives, a comment,
  a `3 rounds:` header, three steps and a `rest 90s`: every row visibly typed,
  both themes, and a broken step still readable as a step.

  **Share the palette with item 17** — the Text-tab syntax highlighter uses the
  same one colour per line kind, so the two views read as one visual language.
  Whichever lands first defines the tokens (CSS custom properties, e.g.
  `--kind-directive`); the other consumes them.

  **Land it / docs:** as the other items. When landed: move to
  [completed.md](completed.md); strike/update the relevant
  [../topics/builder-ux.md](../topics/builder-ux.md) entries; dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- **17 — The Text tab is a bare `<textarea>`: Tab escapes it, and nothing is
  highlighted.** *High priority (Chris, 2026-08-29), from driving the builder.*
  Two parts, both about making the raw editor usable; they share a branch.

  **(a) Trap Tab.** `#text` is a plain `<textarea>` (`apps/builder/index.html`),
  so pressing Tab moves focus out of it instead of indenting. It should insert
  **two spaces** (canonical indent, spec §2) at the caret; **Shift-Tab**
  removes up to two leading spaces from the line(s); with a multi-line
  selection, Tab / Shift-Tab indent / dedent every selected line and preserve
  the selection. Enter should carry the current line's leading indentation to
  the new line, plus two more spaces when the line being left ends in `:`
  (auto-indent into a block). All of this is `lines`-preserving — it edits the
  textarea value and lets the existing `input` handler re-split `lines`
  (`builder.js:855`); watch that programmatic `setRangeText` / value edits fire
  or manually dispatch `input`, and that undo (`document.execCommand` vs direct
  value set) still works acceptably.

  **(b) Syntax highlighting.** A highlight layer behind a transparent
  `<textarea>`: a `<pre>`/`<div>` positioned exactly under `#text`, same font,
  padding, line-height and wrapping, holding the same text re-tokenised on
  every `input`, with the textarea's own text set transparent
  (`color: transparent; caret-color: var(--ink)`) so the layer shows through.
  Colour one token per line kind — directive (`@…`), title (`#…`), comment
  (`//…`), block header (ends `:`), rest (`rest …`), step (`- …`) — plus,
  if cheap, the inline pieces (`@ load`, `, modifier`, `note: "…"`). **Use the
  same palette as item 16** (shared CSS custom properties) so the outline
  markers and the text colours are one language. Keep it a *layer*, not a
  contenteditable — paste, undo, spellcheck and IME all keep working because
  the real control is still a textarea. Re-tokenise is O(text) per keystroke;
  the file is small, so a full re-render is fine (no incremental parsing).
  This is the tractable half of "type hinting in the text editor"; **completion
  in the textarea** (caret-tracking via a mirror div, line tokenisation, a
  floating popup, key handling) is a bigger, separable piece — do **not** scope
  it here; if it is wanted it gets its own item.

  **Watch for:** the highlight layer and textarea must stay pixel-aligned under
  every wrap and at every scroll offset (sync `scrollTop`/`scrollLeft` on
  `scroll`); `tab-size: 2` is already set on `#text` (`builder.css:234`) —
  keep the layer's in sync; the `#dirty` "edited" badge and the tab-switch
  logic (item 10) are untouched.

  **Scope:** `apps/builder/index.html` (wrap `#text` + the highlight layer in
  a positioned container), `apps/builder/builder.css` (the layer, the
  transparent-text trick, the kind palette if 17 lands before 16),
  `apps/builder/builder.js` (the Tab/Enter key handler, the tokenise-and-paint
  on `input`/`scroll`). No core change. Verify by driving the builder: Tab and
  Shift-Tab indent/dedent a line and a selection; Enter auto-indents after a
  `:` line; every line kind is visibly coloured; the caret and selection sit
  exactly on the glyphs under wrapping and after scrolling; both themes;
  switching to the Outline tab and back leaves the text and highlighting
  correct.

  **Land it / docs:** as the other items. When landed: move to
  [completed.md](completed.md); add/adjust a
  [../topics/builder-ux.md](../topics/builder-ux.md) entry (the Text tab now
  traps Tab and highlights); update the **Apps** row in
  [../topics/what-exists.md](../topics/what-exists.md); dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- ~~**12 — The outline shows no row for a comment; they exist only in the Text
  tab.**~~ **Done 2026-08-30 as R2** (`973d80a`) — synthesised comment rows +
  comment-aware `spans()`/`move`/`shift` in `edit.ts`. Write-up kept below for
  the reasoning. *High priority (Chris, 2026-08-29).* Full write-up (cause
  confirmed in source) is the first entry under "## Outline" in
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
  8a, 9, 10, 14 and the deployment epic 18, 19, 20 — is closed; see
  [completed.md](completed.md).

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
