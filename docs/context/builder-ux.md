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
*Touches: `apps/builder/builder.js:276-284`, `apps/builder/builder.css:300-314`.*

**The summary says title, cues and duration, but never the scoring.** A reader
cannot tell from the top of the pane how the workout is scored. `workout.score`
is parsed and available — `primary`, plus `tiebreak`, `onCap`, `aggregate`,
`perRound`, and an `implied` flag for scores derived from a `for time` or AMRAP
header rather than written. The summary's `rows` array reads none of it.

Two things to decide rather than guess at:
- Whether an *implied* score is shown the same as a written one. The formatter
  deliberately does not re-emit implied scores, on the grounds that the header
  already states them; the summary is a different surface and may want the
  opposite.
- Blocks carry their own `score` as well as the workout, so a workout can have
  more than one. A single summary row cannot say that.

*Touches: `apps/builder/builder.js:241-263`, `packages/core/src/ast.ts:164-181`.*

**A movement with an `rx` weight split shows no weight at all.** Not a rendering
gap in the pane — the load is dropped when the cue is built. `Step.rx` is a
division-keyed map of loads; `stepCue` composes its label from
`mergeTargets(s.targets, ctx.inherited)` and never reads `s.rx`. A step whose
only load is an `rx` split therefore produces a cue with no load in it.

**This is not confined to the builder.** The board reads the same cues out of
`run(compile(...))`, and neither app has any variant selection — `variant`
appears nowhere in either app's source. So rx loads are invisible across the
whole UI. That is the version worth caring about: with nobody having run a
session off the board yet, this is showing up to a session with no weights on
screen.

Held against queue item 1 (`rx` should desugar into `variants:`) rather than
fixed where it shows: if `rx` lowered to a variant, the load would arrive through
`targets` and label itself with no change to `stepCue`. Patching the label
directly is work that item 1 would throw away. But item 1 does not settle the
question this raises — **what a step reads as when no division is chosen**, which
is the state both apps are permanently in today. Showing both magnitudes
(`@ 105/145 lb`) is the obvious candidate and matches how it is written on a
whiteboard.
*Touches: `packages/core/src/timeline.ts:230`, `packages/core/src/ast.ts:86`,
and both `apps/builder/` and `apps/display/` once a division can be chosen.*

**Considered and declined:** indenting the text of cues inside a cycle, to break
the block out beyond what the rail already does. The rail is enough; the colour
is the part that is missing.
