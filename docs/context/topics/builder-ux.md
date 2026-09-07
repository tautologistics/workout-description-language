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

**~~The "what it reads as" pane has no scroll container, so on a real workout
the body map and goal check fall off the bottom of the page.~~** **Already
fixed by R1 of the builder layout redesign (`758dff1`, 2026-08-30) — confirmed
still fixed 2026-09-02, no new code shipped.** This entry was written the same
day the redesign's first stage landed and never updated. The `.read-pane` /
`.pane` it describes **no longer exists**: direction C ("Document + margin")
replaced it with the tabbed margin's `.rpanel` —
`flex: 1; min-height: 0; overflow: auto` with a bounded height — and the whole
flex-ancestor chain carries `min-height: 0` (`body` → `.stage`
[`flex:1; min-height:0; overflow:auto`] → `.sheet` [`height:100%; min-height:0`]
→ `.right-col` [`min-height:0; overflow:hidden`] → `.rpanel`). So the minimum
the entry predicted (`min-height:0; overflow:auto` on the pane) was **not
enough on its own** — the ancestor `min-height:0` chain is what actually bounds
it — but the redesign put all of it in place. `completed.md`'s R1 note says so
outright: *"has its own `overflow:auto` + bounded height — the read-pane scroll
🔴 is fixed."*

Re-verified 2026-09-02 by driving `make serve` in the browser at 1440×900,
light + dark, with a 56-cue six-section workout (58 lines): the **Analysis**
panel is `overflow-y: auto`, `scrollHeight` 1622 vs `clientHeight` 722, and
scrolling it to the bottom leaves the header, summary band and editor column
fixed; `documentElement.scrollHeight === innerHeight` (**document overflow 0**),
where the entry measured 1748 vs 900. The **Reads as** panel is the same
bounded `.rpanel` (`scrollHeight` 2083 vs `clientHeight` 660 with the every-cue
list expanded, document overflow still 0). Consistent at 1100px, at the 820px
single-column stack (`.rpanel { max-height: 78vh }`, `.stage` no longer
scrolls the pair off-screen), and on the 375px mobile emulation. No console
errors.

The entry's *"better"* half — split into *Summary* always-visible + *Body* /
*Against your goals* as collapsible sub-sections each with its own scroll — was
**not** built: it is optional polish on a pane that already scrolls correctly,
it clusters with the still-open palette-drawer redesign items below, and
inventing that scope was out of bounds for a fix whose premise no longer holds.
The related **Minor — the read pane stacks four `<h2>`s** entry in **## What it
reads** is left standing for the same reason (it was gated on this pane becoming
collapsible sub-panels, which did not happen).

**~~Movements is a permanent ~24% column with no way to dismiss it.~~**
**VOID — obsolete premise, confirmed by Chris 2026-09-02, nothing shipped.**
*Chris: "a holdover from when the palette was the full right sidebar or the full
top row depending on browser width — now it's an overlay/modal, so this doesn't
mean anything anymore."* This entry describes the pre-R1 four-/three-column
`<main>` grid. It was written in
the 2026-08-30 design-critique pass, the same day **R1 of the layout redesign
(`758dff1`)** replaced that grid with the direction-C centred sheet and turned
the palette into an overlay `.drawer` behind a `☰ Movements` header toggle
(`localStorage['wdl.palette-open']`); **R7 (`d1a89ce`, 2026-08-31)** then retired
the drawer, the `☰` toggle *and* its `wdl.palette-open` persistence in favour of
the summoned **`<dialog id="palette-modal">`** it is today — opened by ⌘K /
"＋ movement" / Enter on a blank row, closed by ✕ / Esc / backdrop, **zero
layout width when closed**. So:

- There is no ~24% column. `.sheet` is `minmax(22rem,1fr) 6px var(--right-col-w,
  24rem)` — editor · splitter · analysis margin, two tracks (`builder.css:161`).
- There is no collapsed-palette `@media` CSS to reuse. `max-width:1100px` only
  narrows the margin fallback; `max-width:820px` stacks editor-above-margin.
  `builder.css:661`: *"The palette modal is centred at every width, so nothing
  about it changes here."*
- N2-as-briefed (a `☰` toggle + `body.palette-collapsed` + `wdl.palette-*`
  `localStorage`) is **exactly what R7 deleted**. Scheduled 2026-09-02 as N2 in
  [../tasks/current.md](../tasks/current.md), now flagged **Open for Chris**
  there with the full source trace — the two follow-ons (**129-row flat list**,
  ## Movements; **four stacked `<h2>`s**, ## What it reads) were gated on a
  *drawer* that never happened, so their gate is now just Chris's say-so.
- Third entry from the 2026-08-30 pass to be found already-resolved by R1 — see
  the read-pane-scroll and header-control-row entries above/below, both struck
  for the same reason.

*Correction to this entry's own text: every measurement in it ("~24% column",
"344 / 688 / 408px", "`@media (max-width:1180px)` … palette full-width across
the top, capped at 11rem") is against a layout that has not existed since
2026-08-30.*

**~~The header is one undifferentiated control row.~~ Already resolved by R1
(`758dff1`) + V1 (`7429863`); verified 2026-09-02, no code shipped.** The entry
was written the day R1 landed and never updated. It described *"six controls …
all the same button weight, right-aligned in `header .row` (`flex-wrap: wrap`)"*
and proposed two concrete moves — **(a)** group them (account far right; Open /
Download / a future *New* behind one file control) and **(b)** move
*Canonicalise* onto the editor. **The redesign had already done both:**

- **`header .row` no longer exists.** `<header>` is a direct flex
  (`gap: .6rem`); the centred `#doc-title` (`flex: 1`) sits between the brand and
  the right-side controls, so the controls are not one right-aligned run.
- **(b) is done.** `#canon` ("Canonicalise") is a `.toolbar-btn` in
  `.editor-tabs` — the Outline/Text tab strip — not in the header (R1:
  *"Canonicalise moved onto the editor's tab strip"*).
- **(a) is done.** Driven at 1440 (signed in), the header reads as **five
  visually distinct zones**, not six peer buttons: `WDL` mark (left) · centred
  `#doc-title` · **`.file-cluster`** — a `1px solid` bordered, rounded box
  holding *Open… / Download .wdl / Open on the board ↗* · the **`#mine`
  `.menu`** — its own bordered, rounded `<summary>` pill with a `▾` caret,
  renamed *My workouts → Workouts* by V1 · **`#identity`** — name, `@handle`,
  `✎`, *Sign out* — far right. The bordered file cluster and the bordered menu
  pill are each a self-contained unit; account is far right as proposed.
- **The "future *New* behind one file control" popover sub-idea is unbuilt and
  unrequested**, and is a deliberately-closed call: R1's note says the file
  cluster is a *"plain bordered button cluster — three items didn't warrant a
  popover"*. Not invented here.

Verified light **and** dark at 1440 / 1000 / 760px: no wrap, no collision
between the cluster / menu / identity (≈9–10px gaps, each with its own border),
no console errors. `make test` 2064/2064, 1 pending — unchanged (no code
touched). *Correction to this entry's own text: it predicted grouping work and a
Canonicalise move that the layout redesign (direction C) had already shipped the
same day it was written.*

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
  [DEC-019](settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised-each-arm),
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

**~~The per-row tools are 25.6px and invisible until you hover that exact
row.~~ Fixed 2026-09-02 (`6adba47`).** *Was:* `.node .tools` and
`.node .caret` / `.modcaret` were `opacity: 0` except under `.node:hover` /
`.node:focus-within`, so the six tools (`↑ ↓ ⇥ ⇤ ⧉ ✕`) and the two carets
(`▾` movement suggestions, `»` what this line takes) had no discoverability and
were unreachable by touch (no hover; a tap into a text-less part of the row
gives no `:focus-within`). Tool buttons measured **25.6 × 25.6px** (`1.6rem`),
under the 24px WCAG 2.2 floor; the carets had no explicit box at all.

**Shipped, as one reveal rule + one sizing rule over the whole set**
(`.node .tools`, `.node .tools button`, `.node .caret`, `.node .caret.modcaret`
— and by extension the block `»` caret, which shares `.caret.modcaret`):

- **Persistent dim → full on hover/focus.** The resting `opacity: 0` became
  `opacity: .6` (effective glyph contrast ~2.2:1 light / ~2.9:1 dark against
  `--panel` — the same "low but present" band the `--rail` fix struck, brief
  `.12s` fade), brightening to `1` on `.node:hover` **and** `.node:focus-within`.
  Nothing is fully invisible now; a 30+-row outline still does not read as busy.
- **`:focus-within` sufficed for the touch case — no JS added.** A tap on any
  tool button or caret focuses that button (they take focus on click even at
  `tabindex -1`), so `.node:focus-within` fires and the row's controls come to
  full strength with no hover. A keyboard user tabbing the tool strip gets the
  same. The `⋮`-opens-a-menu pattern the critique floated was **declined** — the
  persistent-dim strip reads fine when driven in both themes, and a `⋮` menu is
  a real interaction-model fork (always-rendered strip vs a summoned menu) for
  no gain here.
- **Target size ≥ 32px.** `.node .tools button` → `2rem` (32 × 32px).
  `.node .caret` → a `2rem` inline-flex hit box (glyph stays `.65rem`); the two
  carets are offset by one box (`»`/block caret at `right: 2.1rem`, `▾` at
  `right: .1rem`) so the 32px targets do not overlap, and `.node input.line`
  right padding went `2.8rem → 4.4rem` to clear them.
- **Row height:** unchanged on desktop (the in-flow 32px tool buttons stay
  under the input's ~35px). On a phone (`@media (max-width: 560px)`) the
  six-button strip would crush the input to a few characters, so it **wraps to
  its own full-width row under the input** (`.node { flex-wrap: wrap }`,
  `.tools { flex-basis: 100% }`) — targets stay 32px, the input gets the whole
  width, the row roughly doubles in height (vertical space is the cheap axis on
  a phone).
- **Guardrail:** a global `[hidden] { display: none !important }` was added
  (`.caret` now sets `display`, and the per-row `modCaret` / `blockCaret` /
  movement-caret hide via the `hidden` attribute) — written as the rule, not a
  list of the selectors that currently collide, per
  [lessons-learned.md](lessons-learned.md).

*Touched: `apps/builder/builder.css` only. No JS, no core change.
`make test` unchanged — 2064/2064, 1 pending (app CSS). Verified driving the
builder against `make serve`, both themes, wide + narrow + a 375px mobile
viewport: every row shows its tools + both carets quietly at rest, hover/focus
brings them to full strength, the `»` / `▾` / block panels still open and splice,
and the Analysis / Reads-as / header panes are unmoved.*

**~~The `»` "what this line can take" caret is the most useful thing in the
outline and it is `opacity: 0`.~~ Fixed 2026-09-02 (`6adba47`), with the
tools fix above** — it is `.node .caret.modcaret`, so the one reveal rule
covers it: persistent at `opacity: .6`, full on `.node:hover` /
`.node:focus-within`, in a `2rem` (32px) hit box. A first-time user now sees it
on every step / block row before touching the row. The one-time hint the entry
floated was not added — the persistent dim presence is enough.

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

**A quiet "not in the movement database" marker on the palette card and the `»`
panel** *(X2 of the *Movement palette — static + DB layered* epic, `a3d1a68`,
Chris 2026-09-06).* A movement with no live DB row (`!inDb`, the flag X1 put on
every merged entry) shows a small dim glyph: **`●`** if the id is in
`curatedMovements` (`registry/movements.json`) — a curated-static movement worth
committing — or **`○`** (fainter, `opacity:.55`) if it is canonical-only (only
in the 5-source merge, e.g. `sandbag-bear-hug-squat`). On the palette card the
glyph sits right after the name with the words in the card `title`; the step `»`
panel shows the same as a `.modifier-info` line at the top. `.db-mark` is
`color: var(--dim)` at `.75rem`, `aria-hidden`, non-interactive — no new colour
token, no hit-target rule. The tier is a `Set` of `curatedMovements` ids built
once per `renderPalette`, not a new `source` field. `markStaticProvenance()`
(the `/api`-absent path) now ends with a `renderPalette()` so the
`WDL_MOCK_API=0` first paint shows the marker; the marker logic also treats a
falsy `inDb` (`undefined` *or* `false`) as "no row" so that first paint is not
wrong either way. Locally under mock `/api` every curated movement is
`inDb:true`, so only the 13 canonical-only core movements show `○` in the
default view — `curl -X DELETE` one from the mock to see a `●`. Glyph choice +
wording are the session's default, flagged for Chris. *`apps/builder/builder.js`
+ `builder.css` (and `movement-editor.js` for the editor-header line — see
"### The movement editor"); no core; `make test` 2064/2064.*

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

**The whole "sets" feature is queued for a model + UX rework (Chris,
2026-09-02) — captured in [../tasks/deferred.md](../tasks/deferred.md).** Where
sets are stored today: **only** `localStorage['wdl.sets']`, a flat
`{ "Set name": ["movement-id", …] }` blob (`apps/builder/builder.js` ~L2023;
`saveSets` the sole writer). No PocketBase collection, no server row, no
cross-device sync, no per-scope model — a cleared browser loses them; Export /
Import to `movement-sets.json` is the only carry-off. Chris's asks: a DB
collection with **namespaced `<handle>:<slug>` ids** and the **workouts flow**
(owner / visibility / ingest); **global vs org-library vs personal** scopes; and
a reworked create/edit dialog — **set on top, movement search below it**, and
the card column alignment / formatting fixed (it is badly broken today). Do the
model first; it drives the UX. This reopens the "file format for palette sets"
Non-Goal in
[deliberately-not-done.md](deliberately-not-done.md).

From the **design-critique pass, 2026-08-30.**

**~~The movement-row muscle tags fail contrast and are too small to scan.~~
Fixed 2026-09-02 (`547d986`).** *Was:* `.movement .meta` was **11.25px at
`opacity: 0.5`** over the panel — the tag text (`glutes quads`,
`erectors glutes hamstrings`), the thing you actually scan the list by, well
under the 4.5:1 AA floor. `.hint` (`129 of the core set`) was **10.2px at
`opacity: 0.6`** — same, smaller.

**Approach taken: drop the `opacity` multipliers, let `--dim` carry the
dimming** — not raise the `--dim` token. `--dim` (`#6b7180` light / `#939aa8`
dark) at **full opacity** already clears AA on both `--page` and `--panel` in
both themes (measured in-browser: `.movement .meta` **light 3.4:1 → 4.9:1**,
**dark 4.6:1 → 6.0:1**; every swept selector now ≥4.7:1), so raising the token
would only have over-darkened its ~40 other uses. `opacity` now dims **only
non-text**: the hover-reveal control strips (`.node .tools` / `.node .caret` —
their own open entry above), the drag ghost (`.node.dragging`), the cycle-rail
pseudo-elements, `.movement .tick` (a ＋/✓ state glyph), and `:disabled`.

**Written as a rule, not a two-selector patch** (a comment block by `:root`
states it): no `opacity` on body text, and **no text below `.75rem` (12px)**.
The pass swept every `opacity:` on a text element and every sub-12px
`font-size` in `builder.css` — beyond the two named: `.compose-hint`,
`.repertoire h2 span`, `.findings .ok`, `.muscles summary`(+` span`),
`.chip-region` (was `opacity: .45`), `.link`, `.suggestion.modifier-edit`
(contrast); `.right-col h2` / `.palette-modal h2` / `.editor-tab` / `.right-tab`
/ `.reads-cues-head` / `.toolbar-btn` / `.repertoire-tools button` /
`.set-card .set-n` / `.set-actions button` / `.set-movements button` / `.chip` /
`.handle.pending` / `.handle-error` / `.share-label` / `.mine-when` /
`.mine-label` / `.examples-label` / `.me-label` / `.me-hint` / `.movement-edit`
(size, `.72–.74rem` or fragile `em` → `.75rem`+). Hierarchy kept — secondary
text is still smaller, just not sub-12px.

**Outline rails (`--rail`) untouched and still fine** — the token is an
independent literal (`#a3a8b4` / `#565c6a`), not derived from `--dim`, so no
`--dim` change was made and nothing moved; it is a structural line, not text
(the ~2.3:1 it carries is the accepted state from its 2026-08-31 fix, not in
scope here).

*Touched: `apps/builder/builder.css` only. `make test` **2064/2064, 1 pending**
— app CSS, the suite does not move. Verified by driving the builder against
`make serve` in both themes, wide + narrow: palette muscle tags + `129 of the
core set` legible, Analysis / Reads-as / outline / header panes show no
regression, no console errors.*

**The core movement list is one flat alphabetical scroll — needs a dedicated UX
review, not a quick `renderPalette` grouping patch. Gated on the curation sweep
(Chris, 2026-09-02).** No grouping by pattern (`squat` / `hinge` / `press` /
`pull` / `carry`) or region, so finding a movement without typing is a linear
read. Search covers the "I know what I want" case; this is the "show me what
I've got" case.

*Chris, 2026-09-02:* the list "will substantially grow once I do a proper full
sweep and curation of all this stuff — there's a lot of things that got filtered
out." **So it is not a good idea to just immediately show the full set of all
exercises as the core set grows.** Before touching this, Chris wants "a full UX
review / analysis to think of what the best pattern is" — progressive
disclosure, faceted filters, a landing state that is not the whole list, etc.
— rather than shipping alphabetical-with-headers now and redoing it after the
sweep. **Not dispatchable as a coding task until (a) the curation sweep has run
and the real core-set size is known, and (b) that UX review has picked a
direction.** Recorded in [../tasks/deferred.md](../tasks/deferred.md)
("Reconsider when"). *Scope when it lands: likely `apps/builder/builder.js`
(`renderPalette`), `apps/builder/builder.css`; no core.*

### The movement editor

**Admin-only Delete button (D5, 2026-09-05 `b72b358`).** The editor now carries
a **Delete movement** button in its actions row, to the right of Save / Cancel,
`.me-delete` (red on hover). It renders only when the builder passes an
`onDelete` callback into `createMovementEditor` — done only for
`currentUser()?.admin` on an existing DB row. Click → `confirm()` → the D2
soft-delete path (`removeMovement(id)` = `PATCH { deleted: <ISO> }`, DEC-029) →
`dropMovement` splices the id out of the in-memory movement lists so the palette
loses it without a reload, then closes the modal. Movements were the last record
type with no delete control; that gap is closed. **All four delete confirms**
(movements / workouts / sets / goals) now read *"… It can be restored by an
admin."* — the epic ships no self-serve restore UI, so the copy no longer says
*"cannot be undone"* but does not promise a one-click undo either.

**Wanted — "Duplicate" a movement: open the editor pre-filled from an existing
record, as a new row.** Raised by Chris 2026-09-06, driving the editor. Today
the only way to base a new movement on an existing one is to open the existing
one (palette `✎`), read its fields, `Cancel`, open `＋ new movement`, and retype
them. A **Duplicate** (or **Copy**) action would open the editor in **create
mode** with every field copied from the source record *except* the **MOVEMENT
ID**, which is blank (or seeded from the title) and must be set fresh — the id
is fixed-on-create and unique-indexed (`movementId`), so a copy cannot share it.
`title` could seed as `"<title> (copy)"` or stay verbatim for the curator to
change; the id derives from the title on first save the way `＋ new movement`
already does.

The natural home is the editor's actions row, beside Save / Cancel / Delete (the
D5 pattern) — a `.me-copy` button shown whenever a `record` with a real
`movementId` is loaded, gated on `currentUser()?.admin` like the others (the
`@request.auth.admin = true` server rule is the real boundary for a `scope:
"global"` write). It hands `createMovementEditor` the source record but flips
`state.mode` to `'create'` and clears `movementId`; `onSaved` / `absorbMovement`
already fold a new row into the in-memory lists and re-render the palette. A
palette-card affordance (a second glyph beside `✎`) is the alternative, but the
actions-row button reuses the editor chrome that already exists.

Distinct from promoting a **merged-corpus** entry: `sandbag-bear-hug-squat` and
its ~3000 uncurated siblings in `registry/movements.canonical.json` already open
in create mode via the palette `✎` (no curated row → `openMovementEditor`
carries id/title only). This is the twin for a movement that *already has* a
curated row and you want a *second* record seeded from it.

*Scope: `apps/shared/movement-editor.js` (the button + a `mode: 'create'` path
that keeps the copied field values), `apps/builder/builder.js` (`openMovementEditor`
gains a "duplicate from this record" entry or flag), `apps/builder/builder.css`
(`.me-copy`). No `packages/core`. Verify by driving `make serve` signed in: open
a curated movement, Duplicate, confirm every field is copied and the id is
empty/required, set a new id + title, Save, confirm a new row `POST`s and the
original is untouched (`curl` both `movementId`s), and that saving without
changing the id is refused.*

**~~Clicking a grouped field's caption silently ticks its first checkbox.~~
Fixed 2026-09-02 (`10a2b8a`, carried by V5).** Found 2026-09-02 while building
V3; **pre-existing, and not caused by that attempt.**
`movement-editor.js`'s `field(label, control)` helper wrapped every field in a
`<label class="me-field">`, which is right for the single `<input>` /
`<select>` fields it was written for — but **a `<label>` labels only its first
labelable descendant**, so for the two checkbox *groups* the caption was bound
to whichever box happened to be first. Clicking the words **COUNTING MODES**
ticked `both`; clicking **MEASURED OUTPUT** ticked `distance`. Confirmed live on
`skierg` (all three counting modes unticked → one click on the caption →
`both=true`), and it was invisible in review because the caption looks like a
caption, not a control.

The fix is not per-field, and was not written that way: **a wrapper that
contains a group of inputs must be a `<div>`, not a `<label>`, and name the
group through `aria-label` / `aria-labelledby` instead** — stated as a rule,
because the next grouped field added to this form would inherit the bug
otherwise (the same shape of mistake as *A CSS rule with a `display` silently
overrules `hidden`* in [lessons-learned.md](lessons-learned.md), where the fix
written as a list of the elements that broke was missing the next one). V5 added
a **`group()` twin of `field()`** — `<div class="me-field" role="group"
aria-labelledby="…">` — and every control holding more than one input now uses
it: the two checkbox groups **and all seven token inputs**, which would each
have acquired the same bug the day they landed. Verified live: clicking either
caption changes nothing, and the DOM reads nine `DIV:group` fields beside eight
`LABEL` ones. *`apps/shared/movement-editor.js`; no core change.*

**~~The palette's `✎` hands the editor the *canonical* entry, not the curated
one~~ — Fixed 2026-09-02 (`a643824`).** Found 2026-09-02 while verifying V5;
was pre-existing since M5, unchanged by V5. `renderPalette()` passed the
movement object it drew the card from, which came from
`registry/movements.canonical.json` (the 5-source merge), not
`registry/movements.json` (the curated layer the editor is *for*). Three
consequences were visible once chips made the values legible, and a fourth
(a resolver-changing alias collision) turned up scheduling the fix — full
detail in [../tasks/current.md](../tasks/current.md)'s now-struck "The
movement editor edits the wrong record" section: opening `deadlift` showed
equipment **`Barbell`** though the curated entry had **no `equipment` field at
all**; `skierg` showed `aliases: ["ski"]` though the curated entry had
`["ski", "ski erg"]`; `muscles` carried canonical `support` / `sources`
sub-objects into the PATCH body; and six movements would have gained an alias
another curated record already held as its id or title, which — because an
alias outranks an id in `fold.ts`'s `lookup` — would have silently moved what
that name resolves to.

**Chris's call: always the API/database, never an in-memory object** — "even
when it's test, it's gonna be fetching from the fixture anyway." So the fix is
the fetch, not the file-lookup-with-fallback the write-up also offered.
`openMovementEditor()` now takes an **identity** (`null`, or `{ id, title }`)
rather than a display object, and always fills the form from
`getMovementByMovementId(id)` — the exact row a save `PATCH`es against —
awaited before the form mounts. A movement with no curated row yet opens in
create mode carrying only its id/title, inventing nothing. All **three** entry
points (`＋ new movement`, the palette `✎`, the `»` panel) route through the
one function; there is no second call site to have missed. Verified: `deadlift`
opens with equipment empty and both curated aliases correct on `skierg`; a
canonical-only movement opens blank; an unedited `deadlift` save round-trips
`make movements:dump` with 0 changes; `make aliases` still reports the pinned
baseline (curated — 972 records, 0 contended names). *`apps/builder/builder.js`
+ `builder.css`; no core change; `make test` 2064/2064, 1 pending, unchanged.*

**Correction 2026-09-06, partial — the "no curated row → open with id/title
only, inventing nothing" behaviour is being reversed for that one case.** Chris,
driving the editor to promote static-file movements into the DB, found that
retyping every field (muscles / equipment / pattern / force / mechanic / load /
laterality / aliases) is the whole cost of curating one. The **X3** stage of the
*Movement palette — static + DB layered* epic
([../tasks/current.md](../tasks/current.md)) changes `openMovementEditor`'s
`null` branch to pre-fill the form from the **full static record**
(`registry/movements.json` first, else `movements.canonical.json`), mapping only
the fields the editor owns. **a643824's core finding stands where a DB row
exists** — fetch that row, never overlay the file, so the editor never PATCHes
canonical `support` / `sources` sub-objects or alias collisions back into the
DB. What changes is only the fallback when there is nothing in the DB to fetch:
the static file is real curated data, not the "invention" a643824 was avoiding.

*X1 landed `096d72f`* — the palette + analysis now read the DB layered over the
static files (DB wins per id), and every merged movement carries `inDb: boolean`.
`openMovementEditor` is **unchanged by X1** — it still fetches the DB row and, on
no row, opens create mode with id/title only. X3 is the stage that changes that
`null` branch to pre-fill from the full static record; it consumes the `inDb`
flag X1 put on every entry.

*X2 landed `a3d1a68`* — the editor now shows a dim `.me-provenance` line under
the title when it was opened on a movement with no DB row, via a new
`provenance` opt on `createMovementEditor` (`{ notInDb, tier }`). Wording:
curated-static *"Not in the movement database yet — Saving commits it."*,
canonical-only *"Not in the movement database — only in the merged corpus.
Saving adds it."* Note the spec's guess that this is redundant with a "New
movement" title is **wrong** — a `!inDb` movement opened from the palette `✎` or
the `»` panel carries a `{id,title}` object, which `readRecord` maps to
`mode:'edit'` (`pbId:null`), so the header reads *"Edit <id>"*, never "New
movement" (that is only `＋ new movement`, `ref` null). If Chris wants the line
gone it is one opt to stop passing.

*X3 landed `<SHA-X3>`* — `openMovementEditor`'s `null` branch now pre-fills from
the full static record. On no DB row it uses
`curatedMovements.find(id)` (curated `registry/movements.json`) else
`catalogue.find(id)` (merged `registry/movements.canonical.json`), run through a
new exported `movementEntryToRecord(entry)` in `apps/shared/movement-editor.js`
— the inverse of `movementRecordToEntry`. That mapper carries only editor-owned
keys (`aliases` / `equipment` / `pattern` / `related` / `sameAs`, the `ENUMS`
`force` / `mechanic` / `load` / `defaultLaterality` / `lateralityAxis`, the
`MULTIS` `laterality` / `measures`, `implements`, `title`) and **rebuilds
`muscles` as `{primary, secondary}` only** — so the canonical file's nested
`muscles.support` / `muscles.sources`, and top-level `origin` / `sources` /
`muscleClaims` / `external` / `core` / …, cannot reach a later PATCH (the
a643824 failure mode, still guarded). a643824 stands wholly for the DB-row case:
when `getMovementByMovementId` returns a row it is used untouched. One extra
change to the `catch`: an `/api` read failure now falls through to the static
pre-fill **only when `movementDbState(id).inDb` is false** (no known row, or
`WDL_MOCK_API=0` where every id is stamped false) — if the X1 layer knows a live
row backs the id, the "Could not read …" dead-end is kept so a transient error
can't open a stale form over a real row. Verified by driving: canonical-only
(`sandbag-bear-hug-squat`) and curated-static (`air-squat`, DB row deleted) both
open fully pre-filled with the `»`/header provenance line; `air-squat` unchanged
→ Save → `make movements:dump` shows **0 diff**; `back-squat` (DB-backed) still
fetches its row, no provenance line; `＋ new movement` still blank create mode;
`WDL_MOCK_API=0` opens the editor pre-filled from the file with a console warn,
no crash. `apps/builder/builder.js` + `apps/shared/movement-editor.js`; no core;
`make test` 2064/2064.

**An admin can add a vocabulary term from the editor** *(2026-09-02, N1 / V9,
`2a534b6`).* The token-input picker for `equipment` / `pattern` — and only those
two — shows a **"＋ new term"** row while the filter box holds text that folds to
no known term. It is `createTokenInput`'s new `onCreateTerm` opt; the builder
passes it only when `currentUser()?.admin`, so a non-admin never sees the row and
the `@request.auth.admin = true` server rule (DEC-025) is the real boundary — a
forced write 403s and the widget rolls its optimistic add back with the message
inline. Clicking the row slugs the text
([DEC-026](settled-decisions.md#dec-026-the-inline--new-term-slugs-by-lowercase--trim--collapse-whitespace-keeping-typed-hyphens):
lowercase + trim + collapse whitespace, typed hyphens kept), `POST`s
`{ termId, name, synonyms: [], scope: "global" }` via `createEquipmentTerm` /
`createPatternTerm`, adds it to the live picker at once, and busts the
`dbVocab()` cache (`.reset()`) so the next editor open re-fetches. Muscles never
get the row (closed set). *`apps/shared/{token-input,vocab,pocketbase,movement-editor}.js`
+ `apps/builder/{builder.js,builder.css}`; no core; `make test` unchanged.*

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

**A bare count on a calorie machine gets a suggesting diagnostic — landed
2026-09-01 (`952c80c`).** Rule 2 of the "unit defaults" task (rule 1 was the
parser change — a unitless *load* is now pounds, DEC-022). `15 Row` on an erg
parses `15` as reps, but the thing a rower counts is calories. The reading is
**not** changed anywhere — the parser keeps the count and the board renders it
verbatim; only the **builder** flags it. `calorieUnitHints(workout)` in
`apps/builder/builder.js` walks the parsed tree and, for a step whose quantity
is bare `reps`, that carries no `@`-load and no `, count …` modifier, and whose
movement resolves (via the same `movementEntry()` / `Registry.resolve()` the
`»` panel uses) to an entry with `measures` including `calories` and **no
`load`**, pushes `{severity: 'warning', line, message: '… did you mean
"15cal Row"?'}` into `renderReading()`'s `diagnostics` array (right after
`validate(workout)`, gated on `has('movements')`). No new CSS — it reuses the
existing `.warning` diagnostic row. Distance-only machines (`Run`,
`measures: ['distance']`) are left alone; a load movement (`Back Squat`) never
matches because `entry.load` is truthy. Spec §7.1. Verified by driving the
builder: `15 Row` fires on line 2, `15cal Row` clears it, `15cal Bike` /
`95 Back Squat` / `500 Run` do not fire; light + dark; no console errors.
`make test` unchanged — this is app code, no suite coverage.

**~~Minor — the read pane stacks four `<h2>`s.~~ Declined by Chris, 2026-09-02.**
*"The Analysis tab is really just Body and Against your goals — two sections.
Reads-as is two items too. I don't think there's anything to be done there."*
The entry assumed the pane would become collapsible sub-panels (the N2 palette
drawer, now VOID); with only two sections per tab there is nothing to collapse
and the repeated `<h2>` treatment is not worth restructuring. No task.

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

**Fixed 2026-09-01 (`110ed2b`).** The `# title` now joins the hidden
preamble run and shows in the `#meta` strip, resolving the reversible default
above. `draw()`'s preamble test gained `|| text.trim().startsWith('#')` so a
`#`-line inside the leading run gets the same `.preamble` class the zero-indent
`@key` lines get — the row is still built, `dataset.line` stays 1:1 with the
source, and `paint()`'s physical-line cue matching + `scrollIntoView` are
untouched (the title's line number is "spent" bookkeeping-wise but the row is
`display: none`). `renderMeta()` now reads `state.workout.title` and renders it
as the strip's lead `<span class="title">` (reading weight, `--ink`); a bare
`@id` still shows verbatim, but with a title beside it it renders
`(crossfit:fran)` — `<span class="id">` restyled to `--dim` + monospace. The
strip still hides entirely when the workout sets none of title / `@id` /
`@tags`. `board.css` gained `.meta .title` (2.8vmin, 650) and dimmed `.meta
.id`. `apps/display/` only — no `packages/core` / grammar / spec change. Dark
verified (the board has no light theme) by driving the board: `?w=crossfit:fran`
→ strip reads `Fran (crossfit:fran)`, first visible row is `for time:`, Start /
Next land the cue marker on the right physical lines (line 7 for cue 3/6, no
off-by-one); a `#<source>` workout with a title and no `@id` → strip shows just
the title; `@id` + `@tags` and no title → id verbatim + chips as before; nothing
set → strip hidden. `make test` unchanged — **2064/2064, 1 pending**.
*Touched: `apps/display/board.js`, `board.css`, `index.html`.*

**~~The board's red parse-error / notification strip has no dismiss control.~~
Fixed 2026-09-01 (`01c0af3`).** *Was:* the `#problems` strip below the board
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

**The footer's *Edit* button now round-trips into the builder (N3,
`fecf6b3`, 2026-09-02).** It used to be `el('edit') → showEmpty()`: drop the
hash/query and reload the board to its empty paste-box. It now reads **"Edit in
builder ↗"** and opens `../builder/?w=<key>` in a new tab (`key` = the
workout's `wdlId` if it has one, else its record id — `openHitOnBoard`'s choice
in reverse). It is `hidden` unless the board is showing a workout resolved from
`?w=` (a module-local `editKey`, cleared by every `load()`, re-set by a
`loadShared` that got a record); a `#<source>` paste board shows no button.
`showEmpty()` was retired with its only caller. The builder side is in "##
Accounts, IDs and layout" below (the last loose bullet of that thread, now
struck).

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
**Edit** button round-tripping into the builder *(shipped as N3, `fecf6b3`,
2026-09-02)*, and the deferred handle-rename debt (stale already-saved ids —
[known-debts.md](known-debts.md)). The **Movement create/edit** bullet (below)
already shipped as M5.

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
separate "by @crossfit" line was added. **Update 2026-09-02 — the board
**Edit** round-trip shipped as N3 (`fecf6b3`).** Only the handle-rename debt
([known-debts.md](known-debts.md)) is now left open from this thread.

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

- **~~Board "Edit" should round-trip to the builder, not reset the board.~~
  Done — N3, 2026-09-02 (`fecf6b3`).** The footer button
  (`el('edit')`, now labelled **"Edit in builder ↗"**) no longer calls
  `showEmpty()` — it opens `../builder/?w=<key>` in a new tab (`key` = the
  workout's `wdlId` if it has one, else its record id). The builder reads
  `new URLSearchParams(location.search).get('w')` on load and, after
  `refreshAuth()` (so `currentUser()` is known), `await getByAnyId(w)` →
  a reusable `openRecord(rec, mine)` helper (factored out of `openFoundWorkout`)
  that attaches when `rec.owner === currentUser()?.id` (Save updates it) and
  otherwise opens a **detached editable copy** (first Save creates a new row
  re-namespaced to the viewer's handle — the DEC-021 copy flow). A failed fetch
  degrades to a `console.warn` + the default buffer; `?w=` stays clean in the
  address bar so a reload re-loads the same row. The board's `#edit` button is
  `hidden` unless it is showing a `?w=`-resolved workout. `showEmpty()` retired
  with its only caller. `apps/display/{index.html, board.js}` +
  `apps/builder/builder.js`; no core; `make test` unchanged (2064/2064, 1
  pending).

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
