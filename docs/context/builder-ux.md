# Builder UX: caught by looking

Observations from driving the builder, captured in a pass on 2026-08-14. These
are separate from [ready-to-pick-up.md](ready-to-pick-up.md) because they arrived
as a batch and would swamp that file's ordering; each is still meant to be
self-contained enough to dispatch on its own.

Nothing here has been acted on. Where a cause is confirmed in the source it says
so; where it is a reading that still needs a click to confirm, it says that too.

---

## Outline

**Indent is allowed on a line with nothing above it, producing an orphan.** A
top-level line that is first in the document can still be indented, which leaves
a child with no parent and makes the whole file invalid. `shift` guards only
against negative indent — `indentOf(lines[line - 1]) + by < 0` — and never checks
that a preceding sibling exists to become the parent. The guard belongs in core,
not in the button: Tab at end-of-line calls the same `shift(n.line, 2)`, so
disabling the button would leave the bug reachable by keyboard. `previousSibling`
in the builder and `spans().siblings` already express the test needed.
*Touches: `packages/core/src/edit.ts:176`, `apps/builder/builder.js:96` (button),
`apps/builder/builder.js:153` (Tab).*

**The caret on every outline row does nothing.** Intent unknown — it is not in
the builder's markup or CSS. Every row's input carries `list="movements"`, so the
caret is the browser's native datalist affordance. *Likely* cause, not yet
confirmed by clicking: the datalist filters its options against the input's whole
value, and a row's value is the entire logical line (`21 Thruster 95lb`), which
matches no movement name — so the popup opens empty every time. Decide whether
per-row movement completion is wanted at all: if yes it needs to match against
the movement-name part of the line rather than the whole of it; if no, the
`list` attribute should come off so the affordance stops advertising something
that will not happen.
*Touches: `apps/builder/builder.js:139`, `apps/builder/index.html:92`.*

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
  [ready-to-pick-up.md](ready-to-pick-up.md). These two are coupled: item 0 is
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

**Every cycle rail is the same blue, so two repeating blocks in a row read as
one.** The rail is a single fixed colour — `border-left: 2px solid var(--accent)`
— applied through one `looping` class. Distinct cycles need distinct colours, or
back-to-back repeating blocks cannot be told apart. The identity needed is
already in hand at render time: `cycleOf` finds the specific cycle and then
throws that away in favour of a bare class. Passing the cycle's index through
(a `data-cycle` attribute, or `looping-1`/`looping-2`) is enough for CSS to
colour them apart. Rails must stay legible in both themes.
*Touches: `apps/builder/builder.js:298-306`, `apps/builder/builder.css:305-319`.*

**The summary says title, cues and how long, but never the scoring.** A reader
cannot tell from the top of the pane how the workout is scored. `workout.score`
is parsed and available — `primary`, plus `tiebreak`, `onCap`, `aggregate`,
`perRound`, and an `implied` flag for scores derived from a `for time` or AMRAP
header rather than written. The summary's `rows` array reads none of it.

*`onCap` is the sharpest case as of 2026-08-22, and it is now visibly missing.*
The summary distinguishes `clock`, `duration` and `cap` — so a capped for-time
says **`cap  at most 12:00`** on screen and still says nothing about what is
scored when the cap is reached, which is the whole reason `on cap:` exists. The
one row that made the question invisible is the row that now raises it.

Two things to decide rather than guess at:
- Whether an *implied* score is shown the same as a written one. The formatter
  deliberately does not re-emit implied scores, on the grounds that the header
  already states them; the summary is a different surface and may want the
  opposite.
- Blocks carry their own `score` as well as the workout, so a workout can have
  more than one. A single summary row cannot say that.

*Touches: `apps/builder/builder.js:256-285`, `packages/core/src/ast.ts:164-181`.*

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
