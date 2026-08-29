# Builder UX: caught by looking

Observations from driving the builder, captured in a pass on 2026-08-14. These
are separate from [tasks.md](../tasks.md) because they arrived
as a batch and would swamp that file's ordering; each is still meant to be
self-contained enough to dispatch on its own.

Nothing here has been acted on. Where a cause is confirmed in the source it says
so; where it is a reading that still needs a click to confirm, it says that too.

---

## Outline

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
  laterality modes (`(both)`, `(split)`, `each side`, marking which is the
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
  survive untouched. Verified driving the builder in both themes against a
  split-laterality movement (Dumbbell Curl), a calorie/distance-measured one
  (Bike) and a load-taking one (Back Squat, and Bulgarian Split Squat for
  per-implement), including applying laterality and load in either order and
  confirming both converge on spec order.

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
  - **Interrupt overlay rows (`every 1min: 5 Burpee`) get no block caret,
    deliberately.** The overlay is parsed by a bespoke regex in `parseNode`
    that accepts only `every <dur>: <body>` — none of the `every` grammar
    rule's bound tails (`for <dur>`, `until failure`, `x <n>`) are readable
    there, so a grammar-derived completion set would offer text the parser
    rejects, which is exactly the drift the affordance exists to avoid. The
    row still exposes the movement `»`/`▾` for its inline body (a real step).
    The *block* form `every 90s x 5:` with indented children already gets the
    caret via `blockKind_every`. *Follow-up 2026-08-28: a bounded one-liner like
    `every 1min until failure: 5 Burpee` no longer falls through to a garbage
    step — the general "`<header>:` opens a block" diagnostic now catches it —
    but it still cannot be expressed on one line. That is a
    [known debt](known-debts.md), not part of the caret.*

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
