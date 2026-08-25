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

**Nothing tells you what a line can take next.** A design direction, and the
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

It splits in two, and the halves are not equally ready:

- **Per-movement modifiers are answerable from data today.** The registry already
  carries `measures` (`distance`, `calories`), `load` (`total`,
  `per-implement`), `laterality` (`both`, `per-side`, `split`), plus
  `defaultLaterality`, `implements` and `equipment`. This half needs no new
  source of truth — start here.
- **Per-block modifiers have nothing to derive from.** Block headers are parsed
  by an if/else chain of regexes; there is no declarative table saying an AMRAP
  takes a duration or an EMOM an interval. The spec is prose in
  `spec/spec-0.1.md`. Deriving this half means first describing the grammar in a
  form something other than the parser can read — which is queue item 0 in
  [tasks/completed.md](../tasks/completed.md). These two are coupled: item 0 is
  the prerequisite, and this half is one of the two things that justifies it.

*Touches: `registry/movements.json` (first half), `packages/core/src/parse.ts:277-320`
and `spec/spec-0.1.md` (second half), `apps/builder/builder.js:93-100` (TOOLS).*

**Third collision with a closed decision — flagged, not resolved.**
[deliberately-not-done.md](deliberately-not-done.md) rejects *"A field per
property in the builder. It would always lag the grammar, and the grammar is the
interesting part."* Driving the affordance *from* the syntax is the direct answer
to that objection — derived, so it cannot lag. But it is only an answer while the
derivation is real. A hand-maintained modifier table in the builder is the
declined thing wearing a different hat, and the per-block half is exactly where
that temptation will arrive, because there is nothing to derive from yet.

---

## Movements

**Movement sets cannot be composed by hand — a "set" is a saved search.** Bigger
than a defect; this is a design direction. What exists: `set-save` snapshots
whatever the current search text and muscle filter match and freezes it as a list
of ids, and a set is then consumed only as a palette *filter*. There is no way to
add a single movement to a set, remove one, reorder, rename, or put a set into
the outline. Movements themselves already add to the outline by click and by
drag; it is the set that is inert.

Wanted instead — movements as their own section, with two things in it:

- **The catalogue**, picked from directly into the outline. Close to what exists.
- **A repertoire of movement sets** beside it: movements selected or dragged in
  to compose a set, sets added to, edited, and deleted, and a whole set added to
  the outline in one go.

The point of it is a catalogue of groupings *that go well together*, plucked and
recombined into different workouts — a building block for authoring rather than a
way to narrow a list.

Useful for whoever builds it: the storage shape is already `{name: [ids]}` in
`localStorage`, so hand-curated sets need no change to the data model. Only the
composing needs building — today the list can only be *derived* from a query,
never assembled.
*Touches: `apps/builder/builder.js:406` (store), `:486-492` (palette),
`:554-572` (save/delete), `apps/builder/index.html:36-48`.*

**This reopens a closed decision — not resolved, flagged.**
[deliberately-not-done.md](deliberately-not-done.md) declines a file format for
palette sets: *"A working preference, not something a workout depends on.
`localStorage` until it earns more."* That reasoning holds for sets-as-filters.
It does not obviously hold for sets as a repertoire you author *from*, which is a
thing worth keeping, naming, and sharing between machines. Whether that counts as
having earned more is Chris's call and has not been made. The decision stands as
written until it is.

Worth noting where this points: a curated set is also an input to *generation* —
the second of the two things the project is for. A repertoire of groupings that
work together is closer to that pillar than to a palette convenience.

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
