# Builder UX: caught by looking

Observations from driving the builder, captured in a pass on 2026-08-14. These
are separate from [tasks.md](../tasks.md) because they arrived
as a batch and would swamp that file's ordering; each is still meant to be
self-contained enough to dispatch on its own.

Nothing here has been acted on. Where a cause is confirmed in the source it says
so; where it is a reading that still needs a click to confirm, it says that too.

---

## Layout

**~~The Outline and Text panes sit side by side, each a full grid column, but a
user edits in only one at a time.~~ Fixed 2026-08-29** (queue item 10). `<main>`
went from a four-column grid (palette | Outline | Text | "What it reads as") to
three: the Outline and Text are now two tabs of one `.editor-pane` cell. A tab
strip (`.editor-tabs`, two `role="tab"` buttons) stands in for the two `<h2>`
bars; the inactive view is `display: none` so it reserves no height; `render()`
still repaints both every time, so a switch is show/hide only (`lines` is the
single source of truth both repaint from). The `#dirty` "edited" badge moved
onto the **Text** tab so it stays visible from the Outline tab when hand edits
have drifted the text from canonical; `renderReading()` drives its `.hidden`
unchanged. The `+ movement / + block / + rest` row stays with the Outline view.
The choice is persisted in `localStorage['wdl.editor-tab']`, read on load,
**default Outline** (the builder's pitch is a GUI, not a text editor).
`@media (max-width: 1180px)` now drops to 2 columns under a full-width palette;
the 900px single-column stack is unchanged.
*Touched: `apps/builder/index.html`, `apps/builder/builder.css`,
`apps/builder/builder.js`. No core or test change.*

---

The three entries below are from a **design-critique pass, 2026-08-30** (drove
the builder at 1440 and 1000px, light and dark, with a 35-cue five-section
workout, and read the computed styles). They are the low-hanging-fruit list —
each dispatchable on its own, none blocked on the others, and they slot beside
the numbered builder-UX chain (12 → 16 → 17 → 15 → 13 → 11) rather than into it.

**The "what it reads as" pane has no scroll container, so on a real workout the
body map and goal check fall off the bottom of the page.** Confirmed in source:
`.read-pane` is a `.pane` (`display:flex; flex-direction:column; min-height:0`)
and **nothing under it sets `overflow`** — computed `overflow-y: visible`. Its
children (`#summary`, `#diagnostics`, `#bodymap`, the goals block, `#findings`)
just stack and grow. Measured on a 35-cue workout at 1440×900: the pane's
content is **1692px tall**, `#bodymap` starts at y≈960 and *Against your goals*
at y≈1230 — both below the fold, and the only way to reach them is to scroll the
**whole document** (`documentElement.scrollHeight` 1748), which also scrolls the
header, palette and editor away. The `.outline` and `.palette` panes each have
their own `overflow:auto`; the read pane is the one that does not. **Fix:**
`min-height:0; overflow:auto` on `.read-pane` at minimum; better, split it into
bounded sub-panels — *Summary* always visible, *Body* and *Against your goals*
as collapsible sections each with their own scroll — so a long analysis never
pushes another part of it out of view. This is the single highest-value layout
fix and the one Chris named first. *Scope: `apps/builder/builder.css`
(`.read-pane` / a new `.analysis-panel` treatment), `apps/builder/index.html`
(wrap the three blocks if they become collapsible), `apps/builder/builder.js`
only if the collapse state wants persisting. No core change.*

**Movements is a permanent ~24% column with no way to dismiss it.** At 1440px
the three panes are 344 / 688 / 408px — the palette, which is *reference you dip
into*, holds a quarter of the width while you are heads-down in the editor, and
there is no toggle. The `@media (max-width:1180px)` rule already does the right
thing structurally — palette goes full-width across the top, capped at 11rem
with its own scroll, editor + reading share the row below — but it only fires by
width, never by choice. **Fix:** a header (hamburger / rail) toggle that
collapses Movements to a strip or an overlay drawer **at any width**, so editor
+ reading get the full canvas; reuse the existing collapsed-palette CSS as the
drawer's closed state. *Scope: `apps/builder/index.html` (a toggle control),
`apps/builder/builder.css` (a `body.palette-collapsed` / drawer state),
`apps/builder/builder.js` (toggle handler, persist in `localStorage` like
`wdl.editor-tab`). No core change.*

**The header is one undifferentiated control row.** Six controls after item 20 —
*My workouts*, *Open…*, *Canonicalise*, *Download .wdl*, *Open on the board ↗*,
identity — all the same button weight, right-aligned in `header .row`
(`flex-wrap: wrap`), with file I/O, a document transform, navigation and account
reading as peers. Two concrete moves: **(a)** group them — account far right;
*Open* / *Download* / a future *New* behind one file control; **(b)**
*Canonicalise* rewrites the editor buffer, so it belongs *with the editor* (near
the Outline/Text tab strip or the `+ movement` row), not in the top-level nav.
*Scope: `apps/builder/index.html`, `apps/builder/builder.css`. No JS logic
change beyond moving a listener. No core change.*

**~~The editor/margin split is fixed, and on a wide display the editor hoards
space the analysis could use.~~ Fixed 2026-08-31** (`83bfb78`, from Chris using
it). The post-redesign sheet was `minmax(0,1fr) 24rem` capped at 1120px — a
wide window just added dead margin either side, and the analysis (body map,
goals) was stuck at 24rem however much room there was. **Shipped:** the sheet
cap is 1600px and the margin width is a CSS var (`--right-col-w` on `.sheet`,
`grid-template-columns: minmax(22rem,1fr) 6px var(--right-col-w, 24rem)`) with
a **drag handle** — `<div class="col-resize">` between the columns. `builder.js`
tracks the drag on `window` (pointer + mouse, no capture), clamps so the editor
keeps a 22rem floor and the margin an 18rem one, and persists the *intent*
(unclamped) to `localStorage['wdl.right-col-w']`, re-clamping it to the sheet on
every resize so a narrow window doesn't lose a wide setting. Double-click
resets to the stylesheet default; ArrowLeft/Right nudge (Shift = bigger step).
Below 820px the sheet is one column and the handle is `display:none`. The
builder body map now **scales with the margin** — `#bodymap` overrides the
shared 78px so the two figures split the panel width, each capped at 190px — so
a wider margin buys a bigger diagram, which is what Chris asked for alongside
the drag. *Touched: `apps/builder/{index.html, builder.css, builder.js}`. No
core change; suite 2051 passing, 1 pending.* This partly answers the
"give the margin more room" thread above (the *Movements* drawer and the
collapsible sub-panels are still open).

---

## Outline

**~~The outline shows no row for a comment — they exist only in the Text tab.~~
Fixed 2026-08-30** (R2 / chain item 12, `973d80a`). `renderOutline` now
synthesises a `.node.comment` row for each own-line `//` comment, above the
line it attaches forward to and at that line's depth; a *trailing* comment on
a content line stays in that row's own input; trailing/orphan comments (the
file-level pseudo-node) render at the margin after everything. Edits, adds
(`+ comment` joins the add-row buttons), deletes, indents, reorders and drags
all write back through a **comment-aware splice added to
`packages/core/src/edit.ts`**: `spans()` gives every own-line comment its own
single-line span (so `replaceLogical` / `remove` / `insertAfter` / `moveTo`
reach it unchanged), while the following node's span still swallows the
comments above it — the two readings overlap by design, so `move` and `shift`
take a dedicated comment path rather than the generic sibling splice. Suite
2038 → 2051 passing (13 cases in `test/edit.test.ts`). *Touched:
`apps/builder/builder.js`, `apps/builder/index.html`,
`packages/core/src/edit.ts` + tests.*

**~~Indent is allowed on a line with nothing above it, producing an orphan.~~
Fixed 2026-08-24.** A top-level line that is first in the document could still be
indented, leaving a child with no parent and making the whole file invalid.
`shift` in `packages/core/src/edit.ts` now refuses to increase indent when the
line has no preceding sibling — `self.index === 0` from `spans()` — the same
test `previousSibling` in the builder already expressed. Fixed in core, so both
call sites are covered: the button (`apps/builder/builder.js:96`) and Tab at
end-of-line (`apps/builder/builder.js:153`), which call the same `shift`.
Verified by driving the builder, both by button and by Tab, on the first line
of a fresh document. `packages/core/test/edit.test.ts` covers a first-in-document
line and a first-child-of-a-block line, both refused.

**~~The caret on every outline row does nothing.~~ Fixed 2026-08-25.** Confirmed
by clicking: the native datalist filtered its options against the input's whole
value, and a row's value is the entire logical line (`21 Thruster 95lb`), which
matched no movement name, so the popup opened empty every time. Per-row movement
completion was wanted, so the native datalist is gone — `apps/builder/builder.js`
now strips the leading dash and quantity off a row's value to get the
movement-name fragment being typed, matches it against the curated registry
(prefix either direction, so both "Thr" while typing and the fully-typed name
with trailing load still match), and shows a custom dropdown that replaces just
that fragment, preserving quantity and any trailing modifiers. Arrow keys move
the highlight, Enter picks, Escape closes. Verified by driving the builder in
both themes: typing a partial name opens matching suggestions, picking one
splices in the full name and leaves the rest of the line alone, and Escape
closes without touching the text.
*Touched `apps/builder/builder.js`, `apps/builder/builder.css`,
`apps/builder/index.html` (removed the now-unused `<datalist>`).*

**Not an issue, checked:** indenting a parent such as an `amrap` carries its
children with it correctly.

**~~Nothing tells you what a line can take next.~~ Both halves fixed — per
movement 2026-08-25, per block 2026-08-28.** A design direction, and the
largest outline item. The outline is already a GUI rather than a text editor —
click to reorder, drag, button to indent, clone, delete — and this continues that
premise instead of fighting it. Wanted: the syntax and the spec driving an
affordance that says *what is available here*. A button on a line showing the
modifiers that line accepts, with a default offered to accept or edit. A new row
completing as you type, and then continuing to offer what can be added to what
you have. On a bare AMRAP: that it can take a duration. On an exercise row: that
it can be split left/right, take a load, be measured in calories or distance —
whichever that movement actually supports. The motivating problem is volume:
there are enough modifiers that knowing which ones apply *here* is the hard part.

It split in two, and the halves were not equally ready — both are done now:

- **~~Per-movement modifiers are answerable from data today.~~ Fixed
  2026-08-25.** A second caret on a step row (`»`, beside the existing movement
  caret) opens a panel of what the row's *current* movement actually supports —
  laterality modes (`(both)`, `(split)`, and the per-side form
  `(each <axis>)` — parenthesised per
  [DEC-019](settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised),
  the axis word taken from the registry's `lateralityAxis` (`arm` / `leg` /
  `side` / `hand` / `direction`) with a `side` fallback — marking which is the
  registry's `defaultLaterality`), measured output (`, count cal` /
  `, count distance` from `measures`), and whether it takes a load (`@ ` or,
  for a `per-implement` movement, `@ Nx` seeded from `implements`) — plus
  `equipment` shown for context, not inserted. The panel is built by
  `movementModifiers()` in `apps/builder/builder.js`, reading the exact
  curated-registry entry the row's parsed movement name resolves to
  (`movementOf`, already collected for the body-map hover); it is hidden
  entirely, not just empty, when the row names no curated movement or the entry
  has nothing to offer. Picking an item splices its default text into the line
  at the position the spec's inline ordering requires — laterality right after
  the movement name, load after any laterality and before comma modifiers
  (`10 Dumbbell Curl each arm @ 2x35lb`), measured output at the end since it
  is itself a comma modifier — the same seam the movement-name caret already
  splices into, so quantity, existing modifiers and the rest of the line
  survive untouched. **The laterality and measured-output picks *replace*, not
  append** (queue item 13c, `02d819d`, 2026-08-31): each is a mutually-exclusive
  class, so applying one first strips any existing token of that class off the
  line — the parenthesised laterality forms (`(both)` / `(split)` / `(per-side)`
  / `(total)`), the inline `each|per <limb>` forms, and the
  `, count cal|calories|distance|reps` comma modifier — and re-picking the mode
  already there clears it (toggle off). Load still just inserts. Verified
  driving the builder in both themes against a
  split-laterality movement (Dumbbell Curl), a calorie/distance-measured one
  (Bike) and a load-taking one (Back Squat, and Bulgarian Split Squat for
  per-implement), including applying laterality and load in either order and
  confirming both converge on spec order.

  **The per-side option is axis-aware** (queue item 13a, `1ffc8d0`,
  2026-08-31): `movementModifiers` builds it as
  `` `(each ${entry.lateralityAxis ?? 'side'})` `` — so `around-worlds`
  (`lateralityAxis: "direction"`) offers `(each direction)`, and a per-side
  movement with no curated axis falls back to `(each side)`. `LATERALITY_RE`
  (the exclusive-class strip) gained the parenthesised per-side form
  `(each <limb>)` and `direction`, so a previously-inserted `(each arm)` /
  `(each direction)` toggles / replaces like any other laterality token.
  ~~*Known pre-existing bug (from 13c `02d819d`, not 13a):* picking a laterality
  option on a row whose movement name is typed **plural** while the registry
  title is singular (`Dumbbell Snatches` → entry `Dumbbell Snatch`) strands the
  plural suffix after the inserted token — `Dumbbell Snatch (each side) es` —
  because `applyModifier`'s title-insert branch truncates the match to
  `entryTitle.length`.~~ **Fixed 2026-08-31 (`e27339a`):** the `entryTitle.length`
  seam calc in both the title- and load-insert branches is now
  `titleMatchLen(fragment, entryTitle)`, which — when `fragment` starts with
  `entryTitle` — extends the match through the trailing letters/apostrophe of
  that same word (`Snatches`, `Deadlift's`), so the token lands after the whole
  typed word. Names that don't start with the title (aliases like `DB Snatch`)
  keep the whole-fragment fallback. Bare `each side` fixed identically.

  **~~Open — the per-implement load token `@ Nx` reads as cryptic mid-edit.~~
  Fixed 2026-09-01 (`00f599c`).** *Was:* for a `load: "per-implement"`
  movement (Bulgarian Split Squat, `implements: 2`) the panel spliced a bare
  `@ 2x`, seeded from `implements`, caret after it for the weight → `@ 2x35lb`.
  Before the weight was typed the bare `@ 2x` was unclear — Chris, who designed
  the panel, had to stop and work out what it meant. The panel *label*
  ("takes a load, per implement (holds 2)") was clear; the inserted text was not.

  **The token itself stays `@ Nx`** — the call was to keep the seed and fix its
  *reading*, not swap it. Two reasons it stays: the `Nx` carries real
  information (how many implements — from the registry, `entry.implements`) that
  the author would otherwise have to know to type; and — checked by driving the
  parser, not assumed — a bare `@ 2x` with no weight round-trips clean through
  `parse` + `Canonicalise` (`wdl fmt` keeps it verbatim) + diagnostics
  (`wdl check` reports nothing), whereas the plain-load pick's bare `@ ` is
  actually an *unreadable step* until a weight follows. So dropping the seed
  would read *worse*, and `@ 2x⟨wt⟩` was rejected because a literal `⟨wt⟩` left
  on the line is held as target prose, not a placeholder. What changed, both in
  `movementModifiers()` / `applyModifier()` in `apps/builder/builder.js`, no
  buffer-format or grammar change:

  - **The pick's label names the finished shape.** The per-implement load entry
    now reads `` `@ 2x — load, per implement (2) — then type the weight: @ 2x35lb` ``
    (was `takes a load, per implement (holds 2)`), so the panel spells out what
    lands and what to do with it before you pick.
  - **A transient inline hint by the caret.** After the pick, a one-line
    `.mod-hint` under the row reads *"@ 2x is a load in each of 2 implements —
    now type the weight: @ 2x35lb"* in the `--accent` colour; it clears on the
    next keystroke, on blur, and on a row re-render. This is the piece that
    addresses the *mid-edit* confusion — it speaks at the moment `@ 2x` is on
    the line with no weight yet.
  - **Caret position unchanged** — it already sat at the end of `@ 2x`, which is
    correct: typing `35lb` there yields the valid `@ 2x35lb`.

  Verified by driving the builder both themes: panel label, hint appears +
  clears, `@ 2x35lb` and bare `@ 2x` both round-trip through Canonicalise with
  clean diagnostics, plain-load Back Squat still inserts `@ ` with no hint, and
  laterality picks still replace-not-append with load landing after laterality
  in spec order. `make test` unchanged — 2064/2064, 1 pending (nothing in the
  core suite covers `movementModifiers` / `applyModifier`).

  Two decisions Chris made before this was built: the affordance is a second
  caret opening a panel (reusing the existing movement-suggestion caret's
  interaction model), not always-visible chips or a merge into the one
  dropdown; and picking an item inserts editable default text into the line —
  an editor, not a reference-only panel — the same behaviour the
  movement-name caret already has.

  **Correction, same day.** "Resolves to" above overstated what the first cut
  did: `movementEntry()` matched the row's parsed movement text against a
  curated title by bare case-insensitive equality, so an alias (`DB Curl`) or
  a regular plural (`Dumbbell Curls`) found nothing and the caret silently
  hid — indistinguishable from "no modifier data for this movement," which is
  the common case, so it read as correct. Caught by Chris driving the
  builder and finding no affordance on a plain `Dumbbell Curl` line typed as
  a plural. Fixed by routing through `defaultRegistry().resolve()`
  (`packages/core/src/fold.ts`) instead — the same alias → plural →
  abbreviation → token-set pipeline `validate()` already uses
  (movement_registry_design.md §3) — so the caret now agrees with what the
  parser and the diagnostics pane already believe the movement is. This was
  the only movement-name lookup in either app that had its own ad hoc
  matching instead of going through `Registry`; swept `apps/builder/builder.js`,
  `apps/display/board.js` and `apps/shared/body-map.js` for others and found
  none — `musclesFor()` and `board.js`'s variant resolution were already
  routing through the shared registry. Verified against both `DB Curl` and
  `Dumbbell Curls` in the builder, each now showing and correctly applying
  the same modifier panel `Dumbbell Curl` does.
- **~~Per-block modifiers have nothing to derive from.~~ Fixed 2026-08-28.**
  Was: block headers were an if/else chain of regexes with no declarative table
  saying an AMRAP takes a duration or an EMOM an interval, and the prerequisite
  — a machine-readable grammar — was queue item 0. That prerequisite landed
  (`spec/grammar-0.1.ohm`, nine start rules including `blockHeader` with its
  `blockModifier` cases), so this half is now derived the same way the
  per-movement half is derived from the registry. A second caret on a
  block-header outline row (`»`, the same glyph and interaction model as the
  step row's) opens a panel of what *this* header can take next: a duration to
  finish a bare `AMRAP:` or `EMOM:` (or `every:`), and the comma modifiers the
  grammar's `blockModifier` rule allows — `cap`, `for time`, `as <label>`,
  `wearing …`, overrun behaviour, an inherited `@` target — each with an
  editable default spliced in at the grammatically-valid spot (a kind
  completion right after the kind word, a comma modifier before the `:` after
  any existing header content). Singular modifiers already written
  (`cap`, `for time`, a label) drop out of the list; a completion drops out
  once the kind has more than its bare keyword, which is also what keeps
  `for time:` from being offered `for`'s duration. Hidden entirely on step and
  rest rows, and on a header once it has nothing left to offer.

  The list is built by `blockModifierOptions()` / `blockKindCompletions()` in
  **`packages/core/src/block-affordances.ts`**, which reads the compiled grammar
  (`WdlParser.grammar`, newly exposed by `grammar/parser.ts`) — it enumerates
  the `blockModifier_*` case rules and reads which `blockKind_*` rules carry a
  `headerDuration`. The builder computes both lists once (`headerAffordances()`
  in `apps/builder/builder.js`) and the outline row wires a `blockCaret` +
  panel beside the movement `modCaret`, reusing its splice-into-the-line
  machinery. Verified by driving the builder in both themes against AMRAP,
  EMOM, every, `5 rounds`, `21-15-9` and `for time, cap 12min:` — right
  completions offered, valid text spliced, diagnostics pane accepts every
  result.

  **Correction/extension, 2026-08-28.** Driving the builder turned up rows the
  caret was *said* to reach but did not, and the diagnosis was wrong twice over:

  - **Inline `work:` / `min:` blocks already worked** — `work 20s: Pull-Up`,
    `min 1: 12cal Row` on one line parse to real `block` nodes whose `.line`
    equals the raw outline row, so `blockOf` maps them and the caret,
    the panel and the splice-before-the-inline-`:` were all correct from the
    parent cut. No change needed; the belief that "inline blocks get no caret"
    was only ever true of the two rows below.
  - **Dashed inline blocks did *not* — a parser bug, not an affordance gap.**
    `- work 20s: Pull-Up` / `- min 1: 12cal Row` / `- every 1min: 5 Burpee`
    (a leading dash on the inline-body form) were caught by `parseNode`'s
    `/^-\s+/` step branch *before* the `min`/`work`/`every` inline forms were
    tried, so the whole line became a movement name and the block — or, for
    `every`, the overlay — was dropped with no diagnostic. This is the
    inline-body twin of the closed `- AMRAP 3min:` debt
    ([known-debts.md](known-debts.md)), which only handled a line *ending* in
    `:`. Fixed in `packages/core/src/parse.ts`: `parseNode` now strips a
    leading `- ` from these three forms too, since `format` already writes all
    three back without the dash and `wdl fmt` was otherwise settling on the
    loss. With the fix the dashed rows resolve to `Block`s and the `»` caret
    reaches them — verified in both themes, splice valid, diagnostics clean.
    Tests: `packages/core/test/corpus2.test.ts` ("reads a dashed inline block
    as the block…", and a companion pinning the boundary below). 1809 → 1811.
  - **`AMRAP 3min: 10 Push-Up` stays a step — now with a diagnostic
    (landed 2026-08-28, follow-up).** A *general* `<blockHeader>: <inline body>`
    on one line (`AMRAP 3min: 10 Push-Up`, `for time: 50 Burpee`,
    `21-15-9: Thruster`, dashed or not) is not a WDL form — only
    `min`/`work`/`every` and the brace form carry a body after the colon.
    There is still no `Block` for the `»` caret to attach to, so the row shows
    only the movement-suggestion `▾` against an unresolvable name. What changed
    is the silence: `tryStep` used to swallow the whole line as a movement name
    with `quantity: open` and no error — an AMRAP scored as one open-ended
    movement, `wdl check` clean. `parseNode` now probes the text before the
    first colon and, if it parses as a recognized block *kind*, emits
    *"`AMRAP 3min:` opens a block — put its body on the next line, indented, or
    use the brace form"*; the diagnostics pane shows it (parse errors map
    straight to `severity: 'error'` there). **Supporting** the one-liner as a
    real block was weighed and declined — no corpus/spec/template file writes
    it, and it needs a grammar change plus a canonical-output decision for a
    form that only ever helps a one-movement AMRAP. Full reasoning in
    [settled-decisions.md](settled-decisions.md), "Extended again 2026-08-28".
  - **Interrupt overlay rows (`every 1min: 5 Burpee`) get no block caret yet.**
    *Was deliberate through 2026-08-28:* the overlay was parsed by a bespoke
    regex accepting only `every <dur>: <body>`, so a grammar-derived completion
    set would have offered bound tails (`for <dur>`, `until failure`, `x <n>`)
    the parser rejected — the drift the affordance exists to avoid. **That
    reason is gone as of 2026-08-29**: the overlay now reads its bound off the
    grammar's own `every` production and carries it on `Interrupt`
    ([known-debts.md](known-debts.md), closed), so a completion set derived
    from `every`'s cases would match what the parser accepts. What is still
    missing is the wiring: the caret attaches to a `Block`, and an overlay row
    is an `Interrupt`, so offering it there means a new node-type path in the
    caret logic and splice edits into a non-`Block` line — more than a
    one-liner, hence left undone. The row still exposes the movement `»`/`▾`
    for its inline body (a real step), and the *block* form `every 90s x 5:`
    with indented children already gets the caret via `blockKind_every`.

*Touches: `registry/movements.json` (first half), `packages/core/src/parse.ts:277-320`
and `spec/spec-0.1.md` (second half), `apps/builder/builder.js:93-100` (TOOLS),
`packages/core/src/block-affordances.ts` + `packages/core/src/grammar/parser.ts`
+ `apps/builder/builder.js` (second half); `packages/core/src/parse.ts` +
`packages/core/test/corpus2.test.ts` (2026-08-28 correction — dashed inline
blocks, and follow-up — the general one-liner is now diagnosed).*

**~~Third collision with a closed decision — flagged, not resolved.~~ Resolved
2026-08-28, in favour of deriving.**
[deliberately-not-done.md](deliberately-not-done.md) rejects *"A field per
property in the builder. It would always lag the grammar, and the grammar is the
interesting part."* Driving the affordance *from* the syntax is the direct answer
to that objection — derived, so it cannot lag — and it is only an answer while
the derivation is real. The per-block half is where the temptation to hand-write
a modifier table would have arrived, and it was declined: the *set* of block
modifiers and the *set* of kinds-that-need-a-quantity are both read out of
`spec/grammar-0.1.ohm` at runtime. What is hand-written is one label and one
default text per case, keyed by the grammar's own rule names — the wording of a
menu entry, not its existence. `packages/core/test/block-affordances.test.ts`
turns any drift into a red test: it fails if a `blockModifier_*` case is ever
unannotated, if an annotation names a rule the grammar dropped, or if a "already
present" probe uses a word the rule cannot match. So a modifier added to the
grammar shows up in the builder immediately (labelled generically until someone
writes its entry, which the test then requires), and one removed from the
grammar cannot linger in a stale table. That is the line: the grammar owns *what
exists*, the annotation owns *what to call it*.

---

From the **design-critique pass, 2026-08-30.** These three are a single
afternoon if done together — they are the same underlying problem (row-level
affordances that only exist on `:hover`, at sub-minimum size, on near-invisible
structure) seen three ways. They also touch the same CSS the numbered items
12 / 15 / 16 (line-kind markers) will touch, so pairing them is sensible.

**The per-row tools are 25.6px and invisible until you hover that exact row.**
`.node .tools` and `.node .caret` / `.modcaret` are `opacity: 0` except under
`.node:hover` / `.node:focus-within` (confirmed in `builder.css`). So the six
tools (`↑ ↓ ⇥ ⇤ ⧉ ✕`) and the two carets (`▾` movement suggestions, `»` what
this line takes) have **no discoverability** — you have to know they are there —
and on a touchscreen (the ≤900px single-column layout invites phone use) they
are unreachable: no hover, and `:focus-within` needs a focus a tap into a
text-less part of the row does not give. Measured target size **25.6 × 25.6px**,
below the 24px WCAG 2.2 / 44px iOS minimum, six of them clustered in a ~26px
row. **Fix:** larger targets (≥32px); reveal on row **focus** as well as hover;
and a persistent low-contrast handle (a `⋮` that opens the tool set, and a
dim-but-present caret) so the affordance is visible before you touch the row.
*Scope: `apps/builder/builder.css` (the `.tools` / `.caret` opacity + sizing
rules), possibly `apps/builder/builder.js` if a `⋮`-opens-a-menu pattern
replaces the always-rendered button strip. No core change.*

**The `»` "what this line can take" caret is the most useful thing in the
outline and it is `opacity: 0`.** Same rule as above, called out on its own
because it is a capability, not a nicety — it surfaces the registry's per-movement
modifiers and the grammar's per-header options (see the *Outline* item above;
the panel's contents were queue item 13, closed 2026-08-31). A first-time user
never learns it exists. **Fix:** render it at
a low but non-zero opacity always, brightening on hover/focus; consider a
one-time hint the first time a row resolves to a movement or a block.
*Scope: `apps/builder/builder.css`. No core change. Do this with the tools fix.*

**~~The nesting rails are ~1.05:1 contrast — the block structure is invisible.~~
Fixed 2026-08-31** (R3, `d8edde3`). New **`--rail`** token — `#a3a8b4` light
(~2.3:1 against both the `#fbfbfa` page and the `#ffffff` panel, up from the
~1.05:1 `--rule` gave), `#565c6a` dark (~2.3:1 against the `#1a1d22` panel) —
defined beside `--rule` in both theme blocks and pointed at by
`.node .rail`'s `border-left-color`; the rail also now stretches to the row's
full height (`.rails { align-self: stretch }`) so the levels read as continuous
lines. R3 also defined the shared **`--kind-*`** row-kind colour tokens on the
same pass (title / directive / section / header / step / rest / comment, both
themes) — R9's Text-tab highlighter consumes them.
*Touched: `apps/builder/builder.css`, `apps/builder/builder.js`.*

---

## Movements

**~~Movement sets cannot be composed by hand — a "set" is a saved search.~~
Fixed 2026-08-28.** Was: `set-save` snapshotted whatever the search text and
muscle filter matched, froze it as a list of ids, and a set could then be
consumed only as a palette *filter* — no way to add a single movement, remove
one, reorder, rename, or put a set into the outline. The "Movements" pane now
has a **Sets** section (`<details id="repertoire">`) beside the catalogue and
the `set-pick` filter, holding one editable card per set:

- **Compose by hand, two ways.** Drag a movement from the catalogue onto a set
  card (the card is a drop target for a new `text/wdl-movement-id` payload the
  palette items now carry alongside the existing `text/wdl-movement` line), or
  hit a card's **Compose** button and the palette turns into a checklist —
  every movement shows `+`/`✓`, a click toggles it in the set, `Esc` ends it.
  The button/checklist path is the touch- and no-drag answer.
- **Edit a set.** Per-movement `↑ ↓ ✕` in the card reorder and remove; `✎`
  renames (moving the `set-pick` selection and compose state with it); `✕`
  deletes.
- **Into the outline in one go.** A card's `↧` splices every movement in the
  set into the outline as its own line, in the set's order, at the same seam a
  single palette drop uses (`focused` → `spans().contentEnd`).
- **New set** makes an empty one and drops straight into Compose; **Save
  showing** keeps the old snapshot-a-query behaviour under a name.

The store is unchanged — still `{name: [ids]}` in `localStorage['wdl.sets']`,
still the live working copy. On top of it, **Export** downloads the whole
repertoire as `movement-sets.json` (`{format, version, sets}`) and **Import**
reads one back, **merging**: a name in the file overwrites the local set of
that name, new names are added, and local sets the file does not mention are
left alone. Import also accepts a bare `{name: [ids]}` object, and skips
malformed entries with a count in the summary. Unknown ids are kept, not
dropped — the catalogue may not have loaded yet, and `renderPalette` /
`renderSetCard` already tolerate an id they cannot resolve (shown as the raw
id, filtered out of the palette view).
*Touched `apps/builder/builder.js` (the whole palette-sets block —
`renderPalette`, `renderSets`, new `renderSetList`/`renderSetCard`/
`renameSet`/`addSetToOutline`/`setsChanged`/`saveSets`, and the
new/save/export/import handlers), `apps/builder/index.html` (the `#repertoire`
details and `#set-file` input, `set-drop` button removed), `apps/builder/builder.css`
(the repertoire and compose-checklist styles). Verified by driving the builder
in both themes: create, compose-add by click, drop-add by dispatched
`DragEvent`, reorder, remove, rename, delete, add-whole-set-to-outline, export
(captured blob), and import with the overwrite/add/keep/skip cases.
`npm --prefix packages/core test` — 1800/1800, 1 pending, unaffected.*

**The closed decision this reopened is now decided.**
[deliberately-not-done.md](deliberately-not-done.md) declined *a file format for
palette sets* — *"A working preference, not something a workout depends on.
`localStorage` until it earns more."* Chris's call: `localStorage` **stays**
the primary store for exactly that reason, but a repertoire you author *from* is
worth moving between machines and surviving a cleared browser, so a
plain-JSON export/import sits on top of it. That is a modest correction to the
old entry, not a reversal — recorded there under **Corrected 2026-08-28**, same
pattern as its other corrected entries.

Worth keeping in view: a curated set is also an input to *generation* — the
second of the two things the project is for — so a hand-composed repertoire is
closer to that pillar than to a palette convenience.

From the **design-critique pass, 2026-08-30.**

**The movement-row muscle tags fail contrast and are too small to scan.**
`.movement .meta` is **11.25px at `opacity: 0.5`** over the panel — the tag text
(`glutes quads`, `erectors glutes hamstrings`) computes to roughly **1.9:1**
against white, well under the 4.5:1 AA floor, and it is the thing you would
actually scan the list by. `.hint` (`129 of the core set`, the compose hints) is
**10.2px at `opacity: 0.6`** — same problem, smaller. This is a builder-wide
type-and-contrast issue that shows up worst here: **floor body text at ~12px and
bring `--dim`-on-panel to AA** (raise the token, or drop the `opacity`
multipliers and let the token carry the dimming). Same pass can catch the
outline rails above and any other `opacity`-dimmed text. *Scope:
`apps/builder/builder.css`. No core change.*

**Lower priority — the 129-row core list is one flat alphabetical scroll.** No
grouping by pattern (`squat` / `hinge` / `press` / `pull` / `carry`) or region,
so finding a movement without typing is a linear read. Search covers the "I know
what I want" case; this is the "show me what I've got" case. Only worth doing if
the palette becomes a drawer (Layout item above) and gets room to breathe —
noted so it is not re-discovered, not because it is next. *Scope:
`apps/builder/builder.js` (`renderPalette` grouping), `apps/builder/builder.css`.
No core change.*

---

## What it reads

**~~Every cycle rail is the same blue, so two repeating blocks in a row read as
one.~~ Fixed 2026-08-25.** The rail no longer draws from a single fixed
`--accent`; each cycle now gets a colour from a small cycling palette
(`--cycle-2`, `--cycle-3`, `--cycle-4`, alongside `--accent` for the first),
picked by `laid.cycles.indexOf(cycle) % 4` in `renderReading()` and applied as
a `cycle-hue-N` class that sets `--rail` for the row's rail to read
(`apps/builder/builder.js:321-334`, `apps/builder/builder.css:309-327`). The
palette is distinct from `--warn`/`--error`/`--ask`, which already carry their
own meaning. Verified by driving the builder with two `AMRAP 6min:` blocks
back to back: the two rails read as different colours, checked in both light
and dark themes via the computed `border-left-color` of each cycle's rail.

**~~The summary says title, cues and how long, but never the scoring.~~ Fixed
2026-08-25.** `renderReading()`'s `rows` array now includes a `score` row —
`workout.score`, described as `primary` plus `on cap: …` / `tiebreak: …` when
present (`apps/builder/builder.js`, `describeScore()` around the `rows` array).
No AST change was needed; `Score` already carried everything to show.

Two decisions were needed and Chris made both:
- **An implied score is shown the same as a written one.** The canonical
  formatter deliberately does not re-emit implied scores, because the header
  already states them — but the summary is a different surface asking "how is
  this scored?", and an implied score still answers that. No visual marking
  distinguishes implied from written.
- **Block-level scores are out of scope for this pass.** A workout can have
  more than one scoring rule (a block can carry its own `score` beside the
  workout's), and a single summary row cannot say that — left for a later item
  rather than guessed at here.

The second decision turned out to interact with the first in a way worth
recording: **most real workouts have no `workout.score` at all.** A bare
`for time:` or `AMRAP` states its score only as an *implied* score on the one
top-level block — `workout.score` is `undefined` for them, and reading only
`workout.score` would have left the row missing for the common case, not just
the multi-block one the second decision was actually about. The fix resolves
the same way `declaredScore()` already does in `packages/core/src/result.ts`
(what the board asks after a run, to know what it is allowed to claim it
measured): use `workout.score` if present, else the single top-level block's
score if there is exactly one block. More than one top-level block falls
through to no row — that is the "more than one scoring rule" case the second
decision declines to guess at, not a bug in the one-block case.

`onCap` was the sharpest case and is no longer missing: a capped for-time with
an explicit `on cap:` line now reads `cap  12:00 at most` above
`score  time, on cap: reps completed`. A cap with no `on cap:` line written
reads `score  time` alone — the row states what the AST actually records, not
a semantic default (`reps`) that exists only in consumers like `checkScore`,
which was not part of either decision above.

Verified driving the builder with a plain `for time:`, an `AMRAP 15min:`, and
a `for time, cap 12min:` with an explicit `score: time` / `on cap:` pair — all
three showed a sensible `score` row, checked in both light and dark themes.
`npm --prefix packages/core test` passed before and after (1800/1800, 1
pending), unaffected since this is builder app code, not core logic.

**~~A movement with an `rx` weight split shows no weight at all.~~ Fixed
2026-08-18** by queue item 1. A step with an unresolved split now reads as its
at-rest text in both apps — `30 Clean & Jerks (women 105lb / men 145lb)` — which
is the answer Chris gave to the question this entry raised: with no division
chosen, show what the file says. Verified by driving both: the builder's *what
it reads as* pane and the board's running headline.

**Correction, and it is the part worth keeping.** This entry predicted the fix
would be free — *"if `rx` lowered to a variant, the load would arrive through
`targets` and label itself with no change to `stepCue`"*. That is only true once
a division has been **chosen**, and neither app ever chooses one, which this same
entry says two paragraphs up. `stepCue` needed its own branch after all. The
resolver was still the right thing to build first, but it was not what closed
this.

**What was left of it belonged to the board, not to this pane, and landed there
2026-08-20** as queue item 1a. `divisions()` lists what a workout offers and
`resolve()` applies one; the **board** now calls both, from a picker in its
footer, and this pane still calls neither and still shows both sides. That is
**board-only** by decision and not by omission:
the builder is where a prescription is written, and a split is a statement that
both sides *are* the prescription, so a control that hides one of them here is a
way to write a split and never look at the other side. This pane showing both is
the finished behaviour, not a placeholder for a picker.
*Corrected 2026-08-19 — first written asking whether the builder wanted one too,
with "the goal report would change under a division" as the reason. Measured, it
does not: `volume` and `muscleLoad` are identical across unresolved, `women` and
`men`, because nothing in the analysis layer reads an absolute load.*

**Considered and declined:** indenting the text of cues inside a cycle, to break
the block out beyond what the rail already does. The rail is enough; the colour
is the part that is missing.

From the **design-critique pass, 2026-08-30.**

**~~The cue-by-cue expansion is the largest thing in the feedback column and it
sits above the body map and the goal check.~~ Fixed 2026-08-31** (R4, `f8cb0a8`).
The split R1 made — Analysis tab keeps a capped `#steps` list (*later removed
entirely*, see below); **Reads as** now carries `renderReadsAs()`, a
block-grouped reading off
`parse().workout.body`: one titled group per top-level block, header label = the
raw source line, steps + rests on one `·`-joined inline row, nested blocks
recursed — so a multi-section run reads in a screen instead of a flat scroll of
near-identical cue lines. A **"show every cue (N)"** toggle drops to the full,
uncapped per-cue list (`localStorage['wdl.reads-expanded']`, read fresh each
paint). The `title / cues / duration / cap / score` `<dl>` stays pinned in the
summary band. *Was: `renderReading` listed `laid.cues.slice(0, 24)` then
"…and N more", ~half the pane on a 35-cue workout.*

**~~The Analysis tab still carried a per-cue list at all — a capped duplicate
of "Reads as" → show every cue.~~ Removed 2026-08-31** (`8720a62` bounded it,
then `9537905` removed it — Chris's call, from driving it). R4 above left a
capped `#steps` list on the Analysis tab; it rendered `laid.cues.slice(0, 24)`
through the *same* `cueRow()` that the "Reads as" tab's **show every cue**
expansion renders uncapped, so it was a strictly-inferior copy — and it was
the thing pushing the body map and the goals block (the point of the tab) down
the panel. `8720a62` first bounded it (`.summary` and `#steps` each capped +
`overflow-y: auto`); then the `#steps` list was **deleted from the Analysis
tab entirely** — `#view-analysis` is now directives → diagnostics → body map →
goals, and the run is read only on "Reads as". The `.summary` band keeps its
`max-height: 9rem; overflow-y: auto` cap (a `cues N–M repeat` row per
repeating block, no natural ceiling). `cueRow` / the `.steps` CSS stay — the
"show every cue" list still uses them (`.steps.reads-cues`). *Touched:
`apps/builder/{builder.js, builder.css, index.html}`. No core change; suite
2051 passing, 1 pending. Verified light + dark, wide + narrow, and the
"show every cue" expansion still renders the full list with its cycle rails.*

**~~The "show every cue" toggle on the Reads-as tab is a hide switch for
nothing.~~ Removed 2026-08-31** (`c876691`, Chris, from using it). The per-cue
list sits at the bottom of that panel and pushes nothing out of view, so
there was nothing to gain by hiding it. `renderReadsAs()` now always renders
**two subsections**: the terse block-grouped reading, then — under an
`EVERY CUE (N)` label with a `border-top` rule — the full uncapped per-cue
list. The toggle button, the `expanded` branch and the
`localStorage['wdl.reads-expanded']` read/write are gone (the stale key is
left to rot harmlessly). *Touched: `apps/builder/{builder.js, builder.css}`.
No core change; suite 2051 passing, 1 pending. Verified light + dark.*
**Follow-up (`a8e5d6f`, same day):** a `.round-start` class on the first cue
of each new round (a `roundLabel()` change vs the previous cue) opens a
`margin-top: .5rem` half-line, so the every-cue list reads as N groups rather
than one column.

**Minor — the read pane stacks four `<h2>`s.** "What it reads as", "Body",
"Against your goals" (each with an inline `<select>`) repeat the uppercase
label treatment three times in a column that is already overfull. If that
column becomes collapsible sub-panels (Layout item), fold these into the panel
headers rather than carrying them as standalone `<h2>`s. Not worth doing on
its own. *Scope: `apps/builder/index.html`, `apps/builder/builder.css`.*

## The board

**~~A workout-level diagnostic renders as `line undefined:`.~~ Fixed 2026-08-20**
by queue item 1a, and it was fixed there because that item **added a fourth** such
diagnostic: `unknown-division` is a fact about the whole workout, so a division
named by a link and not by the file would have printed `line undefined: no
division \`mens\`` — a new way to hit an old defect, which is a reason to close it
rather than to file beside it.

The first of the two options this entry listed is what was taken: a `where()`
helper omits the prefix when the diagnostic carries no line. The second — giving
`Score` a line so the diagnostic can point at one — is **still the better answer**
if anything else ever wants to say where a score was written, and it is an AST
change rather than app code, so it stays available rather than foreclosed.
*Was: `apps/display/board.js:375`. The AST half, if it is ever wanted, is
`packages/core/src/ast.ts`.*

**~~The footer is wider than a phone.~~ Fixed 2026-08-20**, found while checking
the division picker at 375px and **pre-existing**: `Reset` was already clipped at
the right edge and `Edit` was past it, with `End section` shown. The picker made
it worse by a hundred pixels, which is what turned an ugly edge into a control
that did not exist on a phone at all. One line — `flex-wrap: wrap` on the footer —
so the row breaks when it stops fitting and is untouched when it does. No
breakpoint, because what fits depends on which buttons are showing: `End section`
appears only inside a section that repeats.
Recorded because the board's own stylesheet says it has to work "on a phone
propped against a water bottle", and nothing had checked.

**A division picker is the board's, and the builder's absence from this is
deliberate.** See the entry above under *the text pane*, and queue item 1a.

**~~A team qualifier never reached the cue.~~ Fixed 2026-08-28.** `- 40 Burpee
each` in a `team of 2:` block cued as `40 Burpees` on the board — `shared` /
`each` / `synchronized` round-tripped through parse and `format` but
`timeline.ts`'s `compileStep` never rendered `s.team` into the label. Spec
§5.11 requires the qualifier stated *always*, because "40 burpees" in a team
context is exactly what a reader guesses wrong about, and the board's cue is
the one place a reader sees it. The label now appends `s.team` after the
targets, matching `format`'s position. The bare `each` team word does not
double up with per-side `each <limb>` laterality — the grammar takes
`each arm` as laterality first, so `s.team` is set only by an explicit second
word. Same shape as the `rx`-split cue fix: `stepCue` was building from a
subset of the step. No corpus workout uses a team block, so it was driven
with a hand-written one, both a dark board (the board has no light theme) and
verified across all three qualifiers. See
[known-debts.md](known-debts.md).

**~~The board renders the `@`-directive preamble as body rows.~~ Fixed
2026-08-31** by queue item 15b (`9bbda82`). `draw()` built one row per raw
source line and special-cased only blank / `//` lines, so `@wdl` / `@id` /
`@date` / `@tags` sat at the top of what the athlete reads mid-set and `@id`
was never stripped. Now `preambleEnd()` finds the leading run of blank / `//` /
`@key` / `# title` lines and, within that run only, a zero-indent `@key` line
gets a `.preamble` class hidden in CSS — the row is still built so
`dataset.line` stays 1:1 with the source and `paint()`'s physical-line cue
matching is untouched. `@id` / `@tags` moved into a `#meta` strip under the bar
(id verbatim, tags as chips), shown only when the workout sets one. The
workout **body renders line-for-line, unchanged**; the `# title` stays the
first board row (a reversible default — open whether it moves into the strip
too). *Touched: `apps/display/board.js`, `board.css`, `index.html`.*
**That open question is now answered (Chris, 2026-09-01): the `# title` should
*not* be a body row — it moves into the `#meta` strip, with any `@id` shown
small in parentheses after it (`Fran (crossfit:fran)`). Queued as the
"board: the `#` title into the meta strip" standalone task in
[../tasks/current.md](../tasks/current.md).**

**~~The board's red parse-error / notification strip has no dismiss control.~~
Fixed 2026-09-01 (`<TASK-SHA>`).** *Was:* the `#problems` strip below the board
showed parse errors, resolve diagnostics and run warnings with no way to clear
them once read. Chris's stated preference (raised driving the board) was a
footer button, not a per-line `✕`. **Shipped:** a **Clear notifications**
`<button id="clear-notifs" hidden>` in `apps/display/index.html`'s footer, right
after Reset — the footer buttons are static markup wired by `el(id).onclick`, so
it follows that pattern. All strip show/hide now goes through one helper in
`board.js`, `setProblems(text = '')`: it sets `problems.textContent`,
`problems.hidden = !text` and `el('clear-notifs').hidden = !text` together, so
the button is present exactly when the strip has content. `recue()` (which runs
on every reparse / `?w=` load / division change), `loadShared()`'s not-found
catch, and `showEmpty()` were switched to call it. The button's click handler is
`() => setProblems()` — clears the text, hides both; because the hide is the
`hidden` attribute (`[hidden]{display:none!important}` in `board.css`) the strip
reserves no layout, matching how `#meta` and the footer's own conditional
buttons hide. It is **not** a permanent suppression: the next `recue()`
repopulates the strip if anything is still wrong. `apps/display/` only — no
`board.css` change was needed (generic `button` styling already covers it), no
core change. Verified dark (the board has no light theme): clean workout shows
neither strip nor button; a parse error (`AMRAP 3min: 10 Push-Up` via the
`#<source>` hash) shows both; Clear hides both with no gap; navigating to
another workout with an error brings both back; Start / Next / Back / Reset and
the footer layout are unaffected. `make test` unchanged — 2064/2064, 1 pending.

---

## Accounts, IDs and layout — raised 2026-08-30, thinking out loud, not scheduled

Chris, right after queue item 20 (Google sign-in / saved workouts / sharing)
went live. Captured verbatim-ish so the reasoning survives; none of it is on
the queue yet, and the item-20 verification + close comes first. Each bullet is
meant to be dispatchable on its own once the builder-UX chain (12 → 16 → 17 →
15 → 13 → 11) is clear.

A **companion design-critique pass the same day** distributed more, smaller,
already-diagnosed entries into the topic sections above — `## Layout` (read-pane
scroll container, dismissible Movements drawer, header grouping), `## Outline`
(hover-only / sub-minimum row affordances, invisible `»` caret, near-invisible
nesting rails), `## Movements` (tag contrast + size), `## What it reads`
(collapse the cue list by default). Those are the low-hanging fruit; the bullets
below are the larger rethinks.

**Update 2026-09-01 — most of the first three bullets are now the queued epic
*The workout library* (L0–L7)** in [../tasks/current.md](../tasks/current.md).
Chris scoped it: non-interactive **org accounts** (`crossfit`, `hyrox`,
`tabata`) owning public benchmark sets; **every account gets an editable
`handle`** that is the `@id` namespace prefix for the workouts it creates
(random `adjective-noun` default so onboarding never blocks; rename-strands-`@id`
is recorded debt); a **`workouts.wdlId`** column parsed from `@id` on save;
**search** over own + public by name / `@id` / record id; an
**"open on the board"** action. **Saving always forces the `@id` to
`<owner-handle>:<slug>`** (Chris: "users can't not set the ID namespace") — no
mismatch state to warn about. What is *left* here after that epic: the board's
**Edit** button round-tripping into the builder, and the deferred
handle-rename debt (stale already-saved ids — [known-debts.md](known-debts.md)).
The **Movement create/edit** bullet (below) already shipped as M5.

**Update 2026-09-01 — the epic is complete (L0–L7 in
[../tasks/completed.md](../tasks/completed.md)).** L7 (`2557177`) surfaced the
library: the builder's *My workouts* panel gained an **Examples** chip row under
the search box — one toggle per org account (`crossfit` / `hyrox` / `tabata`,
`listOrgWorkouts(ownerId)` against the L1 fixed ids) that replaces the plain list
with that org's whole public set, each row labelled `@<handle>` and click-to-open
through the existing detached read-only-copy path (`openFoundWorkout`); the
"open on the board" bullet below is answered by a per-row `↗` on every hit row
(search or Examples) opening `../display/?w=<wdlId>`, and the header's existing
*Open on the board ↗* covers the current buffer. The board's `#meta` strip shows
the namespaced `@id` (`crossfit:fran`) — that already names the owner, so no
separate "by @crossfit" line was added. Only the board **Edit** round-trip and
the handle-rename debt remain from this thread.

- **`@id` and the record id do not correlate, and probably should.** A workout
  can carry an `@id` directive in its text (spec preamble; `wdl result` already
  uses it as the record head). When that workout is saved to an account it also
  gets PocketBase's generated 15-char id, and the two are unrelated. There is a
  **confluence of data** here: the `@id`, the `title`, and the generated id —
  and `@id` is "almost a slugified version of the title". A scheme is wanted:
  probably the `@id` (or a slug derived from the title) is the human-readable
  handle and the generated id is the opaque one, with a **lookup that resolves
  either** to the same record. Open: does saving reconcile `@id` ↔ record, warn
  on a mismatch, or write `@id` back into the text on first save?

- **Account namespacing.** When a user creates an account they should claim a
  **username**, and that becomes a **workout-id prefix / namespace** — so a
  workout is `chris:fran`, not a bare slug that two users could both want. The
  `@id` namespace (`crossfit:fran`, spec §preamble) and the account namespace
  need a story about how they relate. A workout that is not found, or not owned
  by the viewer, resolves to "a new unsaved workout" that the viewer can then
  save **into their own namespace** (see the board-Edit bullet).

- **Board "Edit" should round-trip to the builder, not reset the board.**
  Today `el('edit')` → `showEmpty()` drops the hash/query and reloads the board
  to its own empty paste-box ("a default workout in this weird little editor —
  it's not builder"). Wanted: **Edit opens the builder with this workout
  loaded.** If the viewer owns it and it is found in the DB → open it as the
  saved record (attached, so Save updates it). If it is not found or not owned →
  open it as a **new unsaved workout** the viewer can edit and save to their
  own namespace. This is the natural completion of item 20's `?w=<id>` board
  link.

- **~~Saved workouts need an "open on the board" action, not just "Copy
  link".~~ Done — L7, 2026-09-01 (`2557177`).** Every hit row in the
  *My workouts* panel (a search result or an Examples-set row) carries a per-row
  `↗` that opens `../display/?w=<wdlId>` in a new tab. The builder header's
  *Open on the board ↗* still covers the current buffer via the `#<source>` hash.

- **Builder layout needs a rethink — the analysis panes fall off-screen.**
  Concretely: the **Movements** column should become a **pop-out sidebar behind
  a hamburger button**, not a permanent third of the width; the **Outline /
  Text editor** should be the central focus; and *What it reads as* / *Body* /
  *Against your goals* — all the workout-analysis output — should each have a
  **max width/height with `overflow: auto`** so a long workout's analysis
  scrolls within its box instead of pushing the rest of the page out of the
  viewport. The current three-column CSS grid (`main { grid-template-columns:
  … }` in `builder.css`, and the 1180px / 900px breakpoints) is what gets
  rethought. Chris's framing: "all that stuff needs to be rethought" — a
  layout pass, not a patch. He is separately exploring whether **Claude Design**
  can be handed the current layout to iterate a better one.

- **Movement create/edit belongs in the app, not a spreadsheet.** Raised
  2026-08-31, trying to run the first laterality curation pass through
  `curation-sheet.csv`: a 972-row × 32-column sheet is hard to look at, organise,
  or reason about, and the need to fix or add a movement arises *naturally while
  building a workout* — so it wants to be a GUI in the builder, reached as a step
  in that flow ("I'll run the things that need editing, or find ones that need
  creating"). Two scopes (Chris first said three, then corrected to two):

  1. **Global movements** — today's `registry/movements.json` set. Everyone
     views; only an **admin** may edit. Needs an **admin user / admin flag**
     established — nothing like it exists yet (PocketBase per-user flag, or a
     hardcoded allowlist to start). Creating a movement in-app offers the option
     to **make it global** (admin only).
  2. **User-scoped movements** — created by a user, living under their account
     the way workouts do: **viewable by anyone** when published/public,
     **editable only by the creator**. A **later phase**, after global editing
     works.

  Phasing Chris stated: **admin/global editing first**, user-scoped second. The
  CSV flow (`make curation:sheet` / `curation:check` / `curation:apply`) is
  **kept for bulk** — wide sweeps across many movements at once; the GUI is for
  one-at-a-time work. Open: where user-scoped movements live (a collection
  paralleling `workouts`?); how a workout referencing one resolves for a
  different viewer (namespaced id, cf. the account-namespacing bullet above);
  whether "make global" is a copy, a move, or a flag flip.

  **Fleshed out 2026-08-31** into *Movements in the database — Phase 1
  (M0–M7)*, a task section in
  [../tasks/current.md](../tasks/current.md): a PocketBase `movements`
  collection with `scope` + a nullable `user` field, an admin `bool` on
  `users`, ingestion (`registry/movements.json` → DB) and a reviewable dump
  back, the editor widget, a nightly VPS backup cron (a pre-existing gap — never
  set up), and a **mock `/api` for local `make serve`** (on by default, served
  from committed fixtures — `registry/movements.json` doubles as the movements
  fixture; sample `fixtures/` for users + workouts) so local dev works without
  PocketBase. Production always talks to real PocketBase; `packages/core` is
  untouched. Phase 2 (user-scoped) is in
  [../tasks/deferred.md](../tasks/deferred.md).

  **The in-app GUI this bullet called for now exists for create *and* edit
  (M5, 2026-09-01, `b2bd7b5`).** `apps/shared/movement-editor.js`
  (`createMovementEditor(...)`) is a reusable form over one curated movement's
  fields — enum `<select>`s restricted to the registry vocabularies, checkbox
  groups for `laterality` / `measures`, comma-separated inputs for the lists and
  `muscles.primary` / `.secondary` — that `POST`s / `PATCH`es a `scope:
  "global"` row over `/api` in the same shape `movements-to-db.mjs` writes.
  Hosted in the builder from three places, all reached *while building a
  workout*: `＋ new movement` beside the palette search, an `✎` on every palette
  card, and "Edit … its curated fields" in a step row's `»` panel (that caret
  now shows for any curated movement). A save folds the row into the in-memory
  registries so the palette / `»` panel update with no reload. Signed-out /
  non-admin sees the 403 in the form. The widget is deliberately host-agnostic
  (it takes the `/api` functions + starting record as params and scopes its DOM
  to a handed container) so a standalone admin page or the board can reuse it.
  Still open from this bullet: user-scoped movements (Phase 2), the account
  namespace ↔ `@id` namespace story, and whether "make global" is a copy / move
  / flag.

### The layout redesign — direction chosen 2026-08-30

Explored on a Claude Design canvas: three directions (A Focus + Inspector, B
Panels on demand, C Document + margin) beside the current layout. **Chris chose
**C — Document + margin**, with the refinements below.** This is the working
brief for the layout work; the chain items 12 / 16 / 17 / 15 / 13 / 11 fold into
it rather than landing on the old three-column grid.

- **The workout is a centred document**, not one column of an IDE. The Outline
  is the primary surface — kind-coloured left rails prominent (items 12 / 16 /
  15c), generous line-height, `#` title as a heading, `@`-directives as a dim
  metadata block at the top. The Text tab stays as the raw view — but **since
  R9 (2026-08-31) a usable one**: `#text` traps **Tab / Shift-Tab / Enter** for
  canonical two-space indent (Tab → two spaces at the caret; Shift-Tab → drop up
  to two leading spaces; a multi-line selection indents/dedents every touched
  line, selection preserved; Enter carries the leading indent, +2 when the line
  ends `:`), all through `execCommand('insertText')` so undo survives, and it
  paints a **syntax-highlight layer** (`<pre id="text-hl">`) behind the now
  transparent textarea — one colour per line kind from the same shared
  `--kind-*` palette the Outline rails use, so the two views read as one
  language. Completion in the textarea (a caret-tracking popup) is still out of
  scope — its own future item.
- **The right side is a TABBED column**, sticky summary band (cues / cap /
  score) across both tabs:
  - **Analysis (default tab).** The front/back **vector body map**
    (`apps/shared/body-map.js`) with its mode picker (Aggregate / Heat — how
    often / Heat — reps) and click-to-enlarge; per-block "adds" notes (what each
    section contributes, drawn from `exposures()`); then the **Goals** block.
  - **Reads as (second tab, not default).** The run, **compressed** — rounds
    shown as `×N` / `30-20-10 …` rather than every cue enumerated — with a
    "show every cue (N)" link to the current fully-expanded list for anyone who
    wants it. `renderReading`'s 24-cue dump becomes this compressed form plus
    the opt-in expansion.
- **Goals gets real rule-management UI** — **done R5, 2026-08-31 (`47fd26b`).**
  The goal-set **picker** (none / examples / yours / unsaved), **Edit rules**
  (the editable `.wdlg` textarea), **Open…**, **Save as…**, **Download .wdlg**
  and **Delete** all carried forward into a styled Goals block in the Analysis
  tab — DOM + CSS only, every handler unchanged. (The original gap: the first C
  sketch dropped these to findings-only.)
- **The movement palette is a modal**, opened by **⌘K** *and* contextually when
  you add / press Enter on a blank editor row — it inserts at the caret. It
  **must keep all three of today's filters**: text search, **muscle** filter
  (the chips, AND-combined — `chosenMuscles` / `worksAll`), and **saved-set**
  filter (`set-pick`). And it **must keep set creation** — New set, compose
  (from the current results, or the checklist toggle), rename, reorder, remove,
  export / import (`localStorage['wdl.sets']`, the repertoire feature from
  2026-08-28). The standalone Movements column and its `#repertoire` panel go
  away; that whole surface folds into the palette modal.
- **Directives are surfaced as first-class metadata** — **done R10, 2026-08-31
  (`5f79ea3`).** The Analysis tab carries a read-only `#directives` block
  (`renderDirectives()` off `parse().workout.directives`) listing every
  `@key value` preamble line a workout sets — `id` / `wdl` / `date` / `author`
  and any `@x-…` extension verbatim, `@tags` as chips — set apart from the cue
  list with the `--kind-directive` accent, hidden entirely when there are none.
  And a zero-indent `@` outline row (caret still in the key) gets a
  **directive-key type-ahead** (`@wdl` / `@id` / `@date` / `@tags` / `@author`
  / `@x-`, a hand-held convention list — the grammar accepts any `@key`) reusing
  the movement suggestion dropdown. This is item 15 parts (a) and (d); part (c)
  — the `@` row's dim marker in the outline — shipped with R3. **Part (b) —
  the board rendering `@` preamble lines as body rows — landed separately
  2026-08-31 (`9bbda82`): the board now hides the leading `@key` run and shows
  `@id` / `@tags` in a header strip, body untouched. Item 15 is fully closed.**
- The unchosen sketches (A, B) and the current-layout baseline are kept on a
  second page of the canvas for reference.

**Status: the R1–R10 chain is complete (landed 2026-08-31).** Every stage is
struck and the whole block, with the detail write-ups for the absorbed chain
items (12 / 15 / 16 / 17), lives as one section in
[../tasks/completed.md](../tasks/completed.md). What remains open is genuinely
independent of the layout — items **11**, **13**, **15b**, and the
"post-redesign rethinks" in "## Accounts, IDs and layout" above.
