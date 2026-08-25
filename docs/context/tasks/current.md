# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

Ordering across 5, 7 and 9 is not settled — they are appended in the order
they were raised rather than placed by priority.

---

**5. A range is only a rep range.** `8-12 Toes-to-Bar` is a first-class quantity;
`100-150ft Farmers Carry` is *not read at all* — the whole thing lands in the
movement name with the quantity left `open`, so the step matches no registry
entry, drops out of muscle and volume analysis, and `wdl fmt` pluralizes what it
was handed into `100-150 ft Farmers Carries`. `wdl check` says ok throughout.
That is the exact failure shape leading `5x5` had before item 0e, and it is
found the same way: by writing a real workout.

The question is not really "is this a bug" — spec §3's unit table genuinely
defines a range for reps only, so the parser matches the spec. It is **whether a
range should generalise**. A carry written `100-150ft` says what `8-12` says —
*somewhere in this band, you choose* — and so does `rest 60-90s`. If it
generalises, `Quantity` needs a range that carries a unit and every consumer of
`kind: 'range'` needs to stop assuming reps; if it does not, the parser must
**say** it cannot read the quantity instead of silently swallowing it into the
name. Either answer closes the silence, which is the part that is not optional.
Raised 2026-08-15 while encoding a partner carry circuit.
*Touches: `spec/grammar-0.1.ohm`, `packages/core/src/units.ts`, `ast.ts`,
`format.ts`, `volume.ts`, `timeline.ts`, `spec/spec-0.1.md`.*

**7. A body map in the builder and on the board.** Front and back of a body, with
the muscle groups the workout hits drawn on it. Not high priority — this is a
*view*, and every number it would draw already exists. Raised 2026-08-16.

**The data layer is done, which is why this is a rendering job and not a
project.** `registry/muscles.json` is a closed 19-muscle vocabulary
(`Chest, Shoulders, Biceps, Triceps, Forearms, Lats, Mid-back, Traps, Neck, Abs,
Obliques, Erectors, Hip flexors, Glutes, Quads, Hamstrings, Calves, Adductors,
Abductors`) grouped into three regions, every muscle carrying the synonyms five
upstream sources spell it by; `muscles.ts` attributes a workout's steps to it and
`volume.ts` gives per-muscle volume. **The missing piece is one artefact: an SVG
body with a path per muscle, id-matched to that vocabulary.** Because the
vocabulary is *closed* and a build script fails on anything outside it, the SVG
cannot silently drift out of step with the registry — which is what makes this
worth doing as a drawing rather than as a feature.

Four things to show, and they are not the same picture:

- **Aggregate, in the builder** — everything the whole workout hits, so the shape
  of a session is visible at a glance while writing it.
- **Per-movement highlight** — selecting or hovering a movement in the palette or
  the outline lights up what *it* hits. The interesting version is the one asked
  for: light it **against** the aggregate rather than on its own, so the question
  answered is "what does this add to what I already have" rather than "what does
  this movement do".
- **A heat map** — intensity by how much a group is worked, not merely whether it
  is. Decide what the scale is: `volume.ts` gives reps × load, which is the honest
  answer for loaded work and says nothing useful about a carry or a hang (see
  items 5 and 6 — a step with a range quantity and a qualitative load contributes
  *nothing*, so it would read as cold, which is worse than uncoloured). Frequency
  is cruder and always available. It probably needs both, and it needs to
  distinguish "not worked" from "cannot be measured".
- **On the board, while a session runs** — the whole workout's map as a constant,
  with the current movement emphasised on top of it. The board already knows the
  position, so this is the same two layers as the builder's, driven by the cue
  index instead of by a selection.

The one design question worth settling before drawing anything: **a movement hits
its muscles at different weights** (primary vs secondary — `muscles.ts` already
distinguishes them, and the goals file's `level: any` keys off it). Whether the
map shows that as opacity, as two colours, or not at all decides how much the
picture can say before it starts lying.
*Touches: a new asset (the SVG), `apps/builder/`, `apps/display/`, and reads from
`muscles.ts` / `volume.ts` — no core change expected.*

**9. A cap is a clock, and the board does not run it.** Open 25.2 on the board
counts *up* from zero with nothing to race, which is the wrong number on the
screen for the one workout shape where a clock is the entire point — a twelve
minute cap is what the athlete is looking at. Raised 2026-08-23 while closing
item 3, which is what makes it cheap: `Run.cap` exists now and is exactly what a
countdown reads.

**The reason it is not part of item 3 is the expiry, not the display.** A cap
creates no cycle, so the board's countdown — which comes from `cycle.window` via
`expired()` — never sees it. Wiring the number up is small. Deciding what happens
when it runs out is not: spec §5.6 says *the workout ends*, so the cursor should
presumably stop where it stands rather than advance, and §9.5 says the score
becomes reps completed, which is a statement about a result and therefore leans
on item 2. The honest middle is probably to show the countdown and stop at zero
without claiming anything about the score.

**Two things to settle while there.** A cap and a section window can both be
running (`for time, cap 25min:` around a bare `AMRAP:` — `77-tiff.wdl`), so the
board needs a rule for which is the nearer deadline, and it already has one for
the cue-versus-section case to copy. And `state.window` in `board.js` is
**assigned and never read** — dead since the cycle rewrite — so the cap should
not be plumbed in beside it without deleting it.
*Touches: `apps/display/board.js`, and `board.css` if the cap needs its own row.*

*Ordering of 5, 6, 7 and 9 against 1-4 is not settled - they are appended
rather than placed. 5, 6 and 7 were raised by writing and sending one workout
rather than by a plan, and 9 by closing item 3. **0f was lettered rather than
numbered on purpose** - grammar work, belonging with the 0-series - and both its
halves are closed. Closed so far: the whole 0-series, 1, 1a, 2, 3, 4, 6, 8 and
8a, so **the open numbered items are 5, 7 and 9**. Stated as a set rather than as
a name on purpose: a pointer naming one item goes stale the moment that item
lands, which is how an earlier one came to send readers at finished work. The
one thing 0f left behind is `TABATA`, which is not an abbreviation to read but a
structure to define; it is written up under 0f rather than given a number,
because nobody has asked for it yet.*

*Corrected 2026-08-23: this paragraph said "4, 5, 6, 7 and 9" while item 4 sat
above it already marked DONE — closed the same day this paragraph was last
touched, and never carried down into the set it names. A queue item can go
stale one paragraph at a time; this is that, caught while closing item 6 rather
than left for whoever reads it next.*

**Nobody has run a session off the board.** Everything is verified by tests and
by driving the UI. Every defect Chris has caught by *looking* — `21 Thruster`,
the AMRAP clock, the run-on notes — was invisible to 1257 tests. A real session
will reorder this list.
