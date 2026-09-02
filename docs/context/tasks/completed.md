# Completed and terminal tasks

The queue's closed history, numbered as it was worked — including the
occasional wrong turn caught and corrected in place, because a queue item is a
record of what actually happened, not a plan tidied after the fact. Read it to
see why something is built the way it is, or before re-proposing a fix that was
already tried. Still-open queue items are in [current.md](current.md); items
declined or postponed on purpose are in [deferred.md](deferred.md).

This file is long because the queue's own numbering is the most legible
organizing principle available and splitting it by date or domain would cut
across items that reference each other. If it keeps growing, split by item
range (e.g. `completed/0-series.md`, `completed/1-9.md`) and leave this file as
a short index — nothing below depends on staying in one file.

---

**0. ~~Explore expressing the grammar in a formal specification language.~~
ANSWERED 2026-08-14 — see [../grammar-exploration.md](../../grammar-exploration.md).**
Yes, it fits. The step line is stated in `spec/grammar-0.1.ohm`, an Ohm grammar
carrying no semantic actions, and with a semantics file it reproduces the
hand-written parser's AST on **538/538** lines. Notation and engine are settled
in [settled-decisions.md](../topics/settled-decisions.md).

**0a. ~~Wire the grammar up.~~ DONE 2026-08-15.** `packages/core/src/parse.ts`
matches `spec/grammar-0.1.ohm` and walks it with the semantics under
`src/grammar/`. `parseOneStep`, `splitOr`, `peelRx`, `peelTrailingQualifiers`,
`applyQualifier`, `applyBlockModifier`, the twenty-branch header chain, the
`SECTIONS` set, `parseScore`'s brace walk and the preamble regexes are all gone:
**548 lines and ~101 regex literals become 306 and 18**, and every one of the 18
is *dispatch* — which kind of line this is, which phase 1 hands over and the
grammar deliberately does not answer.

**The plumbing is the `provide()` seam.** `grammar` is a `CoreData` key like the
movement registry; `node.ts` reads the file, both apps fetch it and await it
before the first render, and `required('grammar')` throws by name if nobody hands
it over. `wdl()` in `grammar/parser.ts` compiles it once and keeps the result,
keyed on the source text so a replaced provider is honoured.

**Nine defects closed, and they are the payoff.** The `@`-plus-digit family (six
forms), the comma-target trio, the five rx-plus-qualifier lines and the header
target after a comma all read correctly now, so three families of silently-lost
loads come back. 14 pending vocabulary cases became correct and both exclusion
lists are empty; the suite is 1592 passing, 9 pending. The pending nine are queue
item 0e's five decisions and 0d.

**What moved, and it is what was pinned.** The old parser applied a step's parts
right to left; a grammar reads left to right, so flag order reverses on
`10 Deadlift unbroken building` and `10 Deadlift building @tiebreak`, and the
later qualifier wins on `5 Squat (both) each leg` and `max Row until HR < Z1`.
The grammar is *wider* on two: `20calories Row` is 20 calories, and `10-5 Squat`
is a descending range because `min < max` is a constraint on values and a PEG
states shapes. Nothing else moved — `interpretations.json` regenerated to no
change at all, and so did `registry/workouts.canonical.json`.

**Two behaviour changes the swap introduced, both pinned.** A step that is only a
threshold (`until HR > 160bpm`) has no movement, so it is reported and held
verbatim where the old chain made a step with an empty movement and said nothing;
and a malformed variant line is reported rather than registered as a variant with
no fields. A third was a regression and was fixed in the grammar rather than
worked around: a comma with nothing after it now separates nothing, because
requiring a modifier made one stray keystroke cost a whole line's reading.

**It is slower, and the number is in [running-it.md](../topics/running-it.md).** Parsing
the 190-file corpus goes from 3.1ms to 172ms — 55× — while `wdl check` on one
file goes from 0.16s to 0.22s, because a CLI invocation is mostly Node starting
up and a one-off 107ms grammar compile. Nobody is waiting on the 55×; if that
changes, a precompiled grammar is the known fix.
*Touched: `packages/core/src/parse.ts`, `src/env.ts`, `src/grammar/parser.ts`,
`node.ts`, both apps, `spec/grammar-0.1.ohm`, `test/grammar.test.ts`,
`test/golden/vocabulary.ts`.*

**0c. ~~Extend the grammar to the rest of phase 2.~~ DONE 2026-08-15.**
`spec/grammar-0.1.ohm` now states **every kind of line phase 2 reads** — the step
line, the block header with its ~20 kinds and its comma modifiers, rest, score,
`on cap:`/`tiebreak:`, directives, the title and both spellings of a variant — as
nine start rules over one shared lexical layer, with no semantic actions. The
semantics are one module per area under `packages/core/src/grammar/`, put on a
single semantics object by `parser.ts`, and `test/grammar.test.ts` compares six
separately-counted areas against the hand-written parser: **789/789 step lines,
195/195 block headers, 41/41 rest lines, 40/40 score lines, 11/11 directives,
204/204 titles**, with 20 listed disagreements and 3 listed shared rejects.

**The lexical layer is shared, which was the whole reason for the ordering.**
`cap 12min`, `every 90s`, `AMRAP 12min` and `12min Bike` are one production; an
inherited `@` on a header is the step's `targetGroup`. The step numbers stayed
green through it, and headers forced two rules into the open that the step line had
been getting by accident — `min` before `mi` before `m`, and *a qualifier is only a
qualifier if the part ends there* (`3x10 Curl`).

**What is deliberately still prose: the assembly.** Which score an `on cap:` line
qualifies, which variant a field line belongs to, which block a child belongs to.
Those are questions about *several* lines, and phase 2 is a grammar over one — the
same division that keeps `readLines` free of WDL knowledge. It is stated at the top
of the grammar file so it reads as a boundary rather than as a gap.

**Seven defects found and recorded, none fixed here** — see
[known-debts.md](../topics/known-debts.md). Two are the grammar being right and `parse.ts`
wrong (the `@`-plus-digit family, a header target after a comma), so the swap is
their fix. Five are shared or downstream and need a decision rather than a
transcription: leading `sets x reps` (`5x5 Back Squat`, spec §1's own example),
`wdl fmt` dropping `after last`, the nested `score:` block spec §9.5 documents
being dropped entirely, a brace score with no `primary:`, and spelled-out duration
words working in a step and not in a rest.
*Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/` (six modules),
`packages/core/src/units.ts`, `packages/core/test/grammar.test.ts`,
`test/golden/vocabulary.ts`, `spec/spec-0.1.md`.*

**0d. ~~Give `unknown` somewhere to live.~~ DONE 2026-08-15.** Both halves.
`Step.unknown` and `Block.unknown` hold what the language does not read, apart
from `notes` and apart from `flags`; `format` writes it back; `timeline.ts` does
not carry it, so no cue, no exporter and no analysis can act on it; and
`validate` reports it. **This closes the last piece of item 0's original
framing** — *"unrecognized tokens held in the tree as unrecognized, surviving
round-trip, carrying no meaning for execution on the board or anywhere else"* —
and it is worth saying that **the grammar needed no change at all**. The
`unknown` production has matched this text since the day it was written; the
defect was entirely in what the semantics then did with it.

**The decision, and it is the half that was not obvious: held-and-inert must not
also be silent.** `10 Thruster, unbrokn` is one keystroke from a constraint that
decides whether a set counts, and nobody saying anything is worse for a person
writing on a whiteboard than being told. So it is reported — as a **`note`**, a
fourth diagnostic severity that claims nothing: not `error`, because the rest of
the line executes exactly as written and four corpus workouts carry deliberate
prose the language models nothing of; not `warning`, for the same reason; not
`question`, because there are no readings to choose between. See
[settled-decisions.md](../topics/settled-decisions.md).

**What it cost that was not in the plan: the `note:` marker became
load-bearing.** Once a bare phrase after a comma means *unrecognized*, a note
emitted bare comes back an unknown — so one `wdl fmt` would have demoted
something written for the athlete into something nothing renders. That is forced
rather than chosen: unknown text is verbatim by definition, so the bare spelling
is the only one it can have, and the note is what must wear a marker. Canonical
output now writes `note: "…"`, except for the three spellings the grammar reads
back as notes on their own (`alternating`, `ramp …`, `wearing …`), which keep the
bare form the whiteboard wants.

**The diff is small and it is the point.** Four corpus workouts move — three
`45lb plate overhead` and one `accumulate across as many sets as needed`, all
`notes` becoming `unknown` with the text unchanged — and
`interpretations.json`, which digests structure, totals and pacing, regenerated
to **no change at all**: nothing about what any workout *does* moved. 14 new
vocabulary forms, and 1628 tests became 1653 with the same single pending case.
*Touched: `packages/core/src/ast.ts`, `format.ts`, `validate.ts`,
`grammar/step-semantics.ts`, `grammar/block-semantics.ts`, `spec/spec-0.1.md`,
`apps/builder/builder.css`, `test/golden/vocabulary.ts`, `test/grammar.test.ts`,
`test/semantics.test.ts`, `test/validate.test.ts`.*

**0e. ~~Six defects the grammar work turned up that need a decision, not a
transcription.~~ DONE 2026-08-15. All six closed; two smaller things found on the
way are open and written up.** Each is now marked closed in
[known-debts.md](../topics/known-debts.md) with what it used to do kept beside what it does
now. The suite went **1592 passing / 9 pending to 1628 / 1**, and the one pending
is a form nobody had pinned before this session.

*The item was corrected before it was worked, and the correction is the reusable
part: it was written before the swap and never re-read after it.* It said
**five**, because the sixth — the greedy header `@` — was expected to be fixed *by*
the swap and was not; and it filed the spelled-out rest duration under
`grammar.test.ts`'s `REST_REJECTS`, whose stated rationale was *"shared defects —
lines neither implementation reads"*, a framing that named nothing once there was
one implementation. Both were fixed as part of the work rather than left to
mislead. **A queue item written against a world that has since changed is stale in
ways its author cannot see; re-read it against the code before working it.**

- **`wdl fmt` drops `after last`.** Closed. Appended once, outside the branch on
  the bound, because it says *which* rest and not how long — written as a fifth
  early return it would have been the same bug waiting for a sixth kind of bound.
- **A target and a `for time` on one header lose both.** Closed by
  `targetGroup<stop>`: where a target's text stops is now a parameter, `never` in
  a step and `forTime` in a header. The comma spelling needed the same stop and,
  applied alone, made that header *unreadable* and *unsettled* — so
  `headerModifier` gained trailing extras, stating that whatever may qualify a
  header before a comma may qualify it after one.
- **A spelled-out duration word is a step quantity and not a rest.** Closed in
  `parseDuration`, which folds the spellings itself now; they used to sit in
  `parseQuantity`, anchored to one token, and the rest path never went through
  that caller.
- **A brace score with no `primary:`.** Closed, and **decided**: it has no
  primary. The written fields survive, and `validate` reports
  `score-without-primary` — a statement about a value, where `min < max` on a rep
  range already lives.
- **The nested `score:` block.** Closed by **correcting the spec**, decided on the
  whiteboard constraint rather than on cost. See
  [settled-decisions.md](../topics/settled-decisions.md); the silence it left — two field
  lines dropped without a word — is closed either way.
- **Leading `sets x reps`.** Closed. `3x10 Curl` is `10 Curl x3` and produces the
  same tree, so nothing downstream learned a concept; `sets` reaches only `format`
  and `timeline.ts`, which already expands it, so rep totals came out right for
  free. Written both ways, the trailing one wins, by the settled "later qualifier
  wins" reading.

**Two things left open on purpose, both written up in
[known-debts.md](../topics/known-debts.md).** Neither is a leftover — each is a question the
work surfaced and neither was in scope to answer:
- **`10x Curl` is not read**, though spec §3's unit table documents `10x` as a rep
  spelling. Same family, different form: reading it means deciding whether a bare
  `Nx` is reps everywhere or only leading. Pinned and pending.
- **Whether the leading `NxM` spelling should be *canonical*.** A question about
  `format`, not `parse`, and it applies to steps that already parsed. There is a
  recommendation with its exception stated; blast radius is measured and small.
*Touched: `packages/core/src/units.ts`, `format.ts`, `parse.ts`, `validate.ts`,
`grammar/step-semantics.ts`, `grammar/block-semantics.ts`,
`grammar/score-semantics.ts`, `spec/grammar-0.1.ohm`, `spec/spec-0.1.md`,
`test/golden/vocabulary.ts`, `test/grammar.test.ts`, `test/vocabulary.test.ts`,
`test/validate.test.ts`.*

*The original framing, kept because it is what the answer was measured against:
exploration, not a build — the deliverable is an answer about whether a
formalism fits, not a rewrite.*

Today the parser is 556 lines carrying 83 regex operations, and it *is* the
spec — `spec/spec-0.1.md` is prose beside it. The question is whether a grammar
or syntax-definition language exists that can state these rules once, agnostic of
implementation, and drive the parser from that.

**The shape wanted:** a spec that drives a parser producing a parse tree that
**fails open**. Unrecognized tokens are *held in the tree as unrecognized*,
survive round-trip and render back intact, and carry no meaning — implicit or
explicit — for execution on the board or anywhere else. Unknown is a first-class
state, not an error and not a guess.

That is close to how the parser behaves today, but not the same, and the
difference is the point. An unknown step modifier falls through to
`step.notes.push(t)` — the *same array* as an authored `note: "…"`, so afterwards
the two are indistinguishable, and notes are rendered. Today's fail-open quietly
promotes an unknown token to a note, which is a meaning. An unknown block header
does better: it becomes a named `sequence` and raises an error, so nothing is
lost, but it is reported rather than held. Neither is the "held, inert,
round-trips" behaviour wanted.

The constraint to test any candidate against first is therefore stronger than
error *recovery*: the formalism must let unrecognized input be **represented**,
not merely survived. A formalism that rejects what it cannot match is out; so is
one that can only skip.

*Closed 2026-08-15 by item 0d, and the paragraph above is kept because it is what
the answer was measured against. The formalism cleared the bar on the day it was
written — `unknown` is a named production in `spec/grammar-0.1.ohm` — and every
one of the three things this paragraph asks for was missing on the **semantic**
side rather than the notational one: a field to hold it in, a formatter that
writes it back, and everything downstream declining to read it. That split is
worth keeping in mind for anything else the grammar "already handles".*

**Do not expect a formalism to do more than the grammar.** §6 of the vision doc
already argues this and it is worth re-reading before scoping: generating parsers
*"solves less of the problem than it appears to"* — parsing is the small part,
and the bulk of `@wdl/core` is the semantic layer (rep-scheme desugaring, name
resolution through `fold()` and the registry, block inheritance, validation,
canonical emission, timeline compilation) that no grammar tool generates. Scope
item 0 to the grammar; the semantic layer stays hand-written either way.

**Two things already settled that this must honour.** The vision doc's layer 1 —
a normative EBNF grammar in the spec, "the human contract" — was never
deprioritised and stands as written; this item is completing it, not reopening
it. And its stated design consequence, *"worth honoring regardless"*: keep the
language line-oriented and two-phase — an indentation pass turning lines into a
tree, then a context-free grammar over line content. That isolates the
hard-to-generate part and is what the parser already does.

Why it earns its place:
- **Maintainability, and this is the whole of it.** 83 regexes in an if/else
  chain is not a canonical spec, and every rule lives in exactly one
  implementation. A clearly defined spec is what keeps this manageable as it
  matures and grows more complex.
- **It unblocks the builder's modifier affordance.** Showing what a line can take
  next needs something machine-readable to derive from; the per-block half of
  that work has no source today. See [builder-ux.md](../topics/builder-ux.md).
  *(Update 2026-08-28: it does now — the per-block affordance shipped, deriving
  its modifier set from this grammar's `blockModifier_*` cases. builder-ux.md,
  "## Outline".)*

**Do not justify this by adoption, and do not decline it by adoption either.**
Both were tried and both are wrong. The README's *"not competing for adoption"*
rules out decisions justified by popularity; it says nothing against rigour, and
was misread as licensing a loose spec — see the clarification there. A formal
grammar is owed to whoever maintains this in five years, which is the author.
Reimplementability by others is a side effect, not the case for it. Settled
2026-08-14; the corresponding entry in
[deliberately-not-done.md](../topics/deliberately-not-done.md) has been corrected.
*Touches: `packages/core/src/parse.ts`, `spec/spec-0.1.md`, and whatever the
parser would be generated from.*

**0b. ~~A container should adopt following lines that were never indented.~~
DONE 2026-08-15.** `readLines` adopts, `wdl fmt` writes the indentation back, and
the rule is stated in spec §2 as three sentences rather than one. Both open
questions were answered rather than deferred, and both answers are in
[settled-decisions.md](../topics/settled-decisions.md).

**Phase 1 still knows one character.** The trailing `:` is the whole of what
`readLines` learned — syntax rather than semantics, true of every kind of block
without naming any of them — so the property the two-phase split exists to buy
(roadmap §5.1) is intact. The four rules: an *empty* block adopts whatever comes
next, block or not, because empty it cannot stand as anyone's sibling; once it
has content a plain line cannot close it, since a step is not a container; a
**block header** closes it only if that header is flat too, and then closes the
whole adopted chain; and a `score:` line is never adopted. The fourth is phase
2's, because only phase 2 knows what a score is.

**Two of those four were settled twice, on the same day, and that is the part
worth carrying forward.** The first version had every block header terminate and
absorbed every kind of line, both decided against invented examples. The first
real workout typed into the builder broke both — a `For time:` buy-in with a
nested `AMRAP 20min:` and a trailing `score:`, written *half*-indented — and it
came out as three top-level things with the score overwriting the for-time's
kind. **Neither the suite nor the corpus could see it**: no example file is
written half-indented, so the shape existed nowhere the tests could reach. See
[lessons-learned.md](../topics/lessons-learned.md).

**The state it replaces was worse than "does not nest": it was unsettled.** A flat
`AMRAP 12min:` with three steps under it parsed to an **empty AMRAP followed by
three loose steps** — twelve minutes of nothing, athlete-paced steps outside any
clock — with `wdl check` reporting only `amrap block is empty` and `wdl fmt` then
indenting the steps under it, so the *second* read was a different workout from
the first. Verified on the board: the same text now runs a 12:00 countdown at
`1 / 3+` where it used to run three untimed cues.

**One defect found on the way, and it had been pinned as correct.** `- AMRAP
3min:` — a nested block with a leading dash — was read as a *step* named `AMRAP
3min:` with its contents dropped in silence, because `parseNode` tested for the
dash before anything looked at the colon. Four `structure` vocabulary forms were
written that way and so recorded the loss as the canonical form; `deep nesting`
had been sitting in the snapshot as `conditioning:\n  - 3 rounds:s`. It is fixed
here rather than filed, because adoption turned its stable loss into a
compounding one — see [known-debts.md](../topics/known-debts.md).

**The corpus did not move at all.** No example file has a container followed by a
line that is not indented deeper, so `interpretations.json` and
`registry/workouts.canonical.json` both regenerated to **no change**. Thirteen
new `adoption` forms pinned — including the half-indented file and the cost that
comes with reading it — six existing ones corrected, 1654 tests became 1672.
*Touched: `packages/core/src/lines.ts`, `parse.ts`, `format.ts`, `ast.ts`,
`validate.ts`, `spec/spec-0.1.md`, `test/lines.test.ts`,
`test/golden/vocabulary.ts`.*

*The original framing, kept because the two open questions below are what the
answers were measured against:*

The rule: when a block container opens (`AMRAP 12min:`, `for time:`) and the line
after it is not indented, everything following is taken as contained by it
anyway. The exception, and the terminator: **another container line ends the open
one and starts a new one**, at which point the same rule applies again — all
regardless of indentation.

A block header is recognizable by its trailing `:`, which matters more than it
looks. That is *syntax*, not semantics, so phase 1 can implement this by keying
on the colon without learning what an AMRAP is.

**The thing to get right, because the design deliberately avoids it.**
`readLines` is phase 1 and its contract is to be *"deliberately tiny and free of
any WDL knowledge — it only sees indentation, comments, and blank lines"*, which
is what keeps phase 2 an ordinary context-free grammar and what makes a port to
another language a weekend rather than a project (roadmap §5.1). Adoption needs
phase 1 to know which lines open a container. Keying on the trailing colon keeps
that to a syntactic rule and preserves the separation; encoding a list of block
keywords into phase 1 would not, and would quietly cost the property the two-phase
split exists to buy.

**The terminator only fires once the container has content.** An AMRAP holds no
movement of its own; empty, it is not a thing that can stand as anyone's sibling.
So a container arriving directly under an open container is necessarily a
*child*, not a terminator — and that cascades correctly through nesting, each
still-empty container adopting whatever comes next. Only once a container is
non-empty does a following container end it.

The validator agrees, with one exception to honour: `empty-block` is raised for
every block type *except* `tally`, so a tally block is legitimately childless and
the "cannot be empty, therefore adopts" reasoning does not hold for it. Note also
that `empty-block` is a warning rather than an error today; this rule would make
it load-bearing.

**What is still open, and it is narrower than it first looked.** Two cases the
"cannot be empty" argument does not reach:

- **A plain line after a *non-empty* block is still absorbed.** `400m run`
  written unindented under a populated AMRAP becomes part of it, because a step
  is not a container and cannot terminate one. That is the buy-in/buy-out
  distinction the summary already draws — a cycle covering the whole workout
  versus a section that repeats. Either absorption is accepted (indent it, or
  open a container, to say otherwise), or steps need some way to close a block.
- **Terminating a *nested* container is ambiguous.** Once `3 rounds:` sits inside
  an `AMRAP:` with neither indented, a following container ends `3 rounds:` — but
  nothing says whether it lands beside `3 rounds:` inside the AMRAP, or beside
  the AMRAP. Indentation is what normally carries that, and it is exactly what
  has been given up. This needs a stated answer in the spec, not an
  implementation accident.

Expected resolution for the at-rest format: this is forgiveness at *input*, and
`wdl fmt` should canonicalise it back to real indentation. The whiteboard
constraint governs what the file looks like at rest; being forgiving about what
was typed does not change that.
*Touches: `packages/core/src/lines.ts`, `packages/core/src/format.ts`,
`spec/spec-0.1.md`.*

*Both answered 2026-08-15, and both answered **twice** — the first pair was
decided against invented examples and corrected the same day against a real one.
Absorption is accepted for work but **not for a `score:` line**, which is not
work and does real damage when absorbed onto a `for time:`. And a block header
terminates the run **only if it is flat too**, which is what reads a
half-indented file — the shape the first answer had no example of. Reasoning, and
what each version cost, in [settled-decisions.md](../topics/settled-decisions.md).*

**0f. ~~`3 RFT:` is a header spelling nobody has stated, and `for time, 3 rounds:`
is one the spec already promises and silently loses.~~ DONE 2026-08-16, both
halves.** Two halves of the same question — *how many ways may a reader write
"three rounds for time"* — and the second was taken first, because it was quiet
where the first was loud. Raised 2026-08-16, both by the same workout going out to
a real person.

**`3 RFT:` is `3 rounds for time:`, confirmed by Chris and read as exactly that
block** — same type, same count, same `rounds` flag, same score, so nothing
downstream learned an abbreviation. It is one grammar production rather than a
spelling of `roundWord`, because the `for time` is *inside* the abbreviation and
there is nowhere else on the line for the score to come from. `AMRAP` and `EMOM`
were already in on the same grounds. Canonical output writes the **long** form:
unlike `rounds` vs `sets`, which are two different words for one structure, `RFT`
is the same words shortened, so there is nothing for the short spelling to say
that the long one does not. Reversible if the short form turns out to be what
belongs at rest.

**Two decisions the item asked for, and the second is not answered.**
- **A bare `RFT:` is declined, on purpose.** It names rounds without saying how
  many, and there is no unbounded repeat to read it as; one round or a quiet
  demotion to `for time:` would both invent something nobody wrote. So it stays an
  unrecognized header and is **reported** — loud, and one number away from a block
  that reads. The contrast is `AMRAP:` with no window, which *is* accepted,
  because an unbounded AMRAP is a real instruction where an unbounded RFT is a
  missing count. Spec §5.2.
- **`TABATA` is still open and was not taken.** It is not the same shape as `RFT`
  at all: `RFT` abbreviates a header this language already has, where Tabata names
  a whole structure (eight rounds of `work 20s` / `rest 10s`) that would have to
  desugar into a block, and §5.2 already turns on the interval rest firing on the
  last round for exactly that case. That is a form to define, not an abbreviation
  to read, and it wants its own item.
*Touched: `spec/grammar-0.1.ohm` (`blockKind`),
`packages/core/src/grammar/block-semantics.ts`, `spec/spec-0.1.md` §5.2,
`test/golden/vocabulary.ts`, `test/grammar.test.ts`.*

**The second half, done the same day.**
A block's kind may now be stated in any comma position, so `for time, 3 rounds:`
is three rounds, `for time, 21-15-9:` is the ladder, and each of the four pairs
spec §5.0 now lists is one reading with an identical tree. The fix is the general
rule and not `for time`: `blockKind` was split out of `headerKind` — leaving the
match-anything `headerName` behind, which is what keeps `unknown` reachable after
a comma — and `blockModifier` reaches it too. `for time` was only the head that
made the loss quiet, and special-casing it would have left the hole for the next
head that parses alone.

**Two things the work forced that this item did not foresee, both of them the
same shape as the defect being fixed** — a widening that reads more input can
*create* silence somewhere it did not exist:
- **A header states at most one kind.** Applying a later kind over an earlier one
  left `AMRAP 12min, 3 rounds:` a `repeat` still carrying the AMRAP's window,
  which no formatter writes — so a header that was *reported* would have become
  silently mangled. The first kind stands; a second is held verbatim and noted.
- **An unreadable head with a readable kind after it.** `cap 12min, 3 rounds:`
  now has a kind, so the old report condition (`type === 'sequence' && name`)
  stopped firing and `headerText` stopped writing the name — the header would have
  gone quiet *and* lost text. Both were widened: the report keys on `name`, and
  canonical output writes an unread head back in front of the kind.

*And a correction worth carrying, because it is the third time a queue item has
been read against a world that moved.* This item said `for time, 3 rounds:` was
**silent**. Since item 0d landed the day before, it was in fact reported — as a
`note`, the severity that claims nothing — where its `cap 12min` neighbour got an
`error`. The table's distinction was real and the fix stands; the word was wrong,
and the difference matters because "silent" and "reported at the weakest
severity" call for different urgency. **Re-run the measurements in a queue item
before working it, even one written the same week.**

*Two pre-existing formatter defects surfaced on the way, were kept out of this
change so that what moved stayed legible, and were then **closed 2026-08-16** in a
commit of their own — see [known-debts.md](../topics/known-debts.md). `wdl fmt` wrote two
clock headers no rule reads (`every 1min30s x undefined:` for a bare `every`, and
`every 2min for 20min:` for an E2MOM), each of which reparsed to a named sequence
with the clock gone and then formatted back to itself — a stable round trip of a
total loss. And a fused `for time` was dropped on every kind but `repeat` and
`sequence`, so `21-15-9 for time:` came back unscored. Both were found by
formatting each new form and re-parsing the result, which is the cheap check
worth running over any list of new cases.*
*Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/block-semantics.ts`,
`parse.ts`, `format.ts`, `spec/spec-0.1.md` §5.0 and §11.1,
`test/golden/vocabulary.ts`, `test/grammar.test.ts`.*

*The original framing of the `3 RFT:` half, kept because it is what the answer was
measured against:*

**`3 RFT:` is not read.** It becomes a named sequence called `3 RFT` and is
*reported* — `unrecognized block header "3 RFT"` — so the fail-open design is
working and nothing is lost quietly. But the rounds and the score both go: the
block is a plain sequence, so it runs once and is unscored. **This is how the
person it was sent to actually wrote it on a whiteboard**, which is the argument
for reading it: `AMRAP` and `EMOM` are already in the grammar as abbreviations
everyone writes, and `RFT` is the third one. Decide whether a bare `RFT:` (no
count) means anything, and whether the same treatment is owed to `AMRAP`'s
neighbours (`EMOM` is there; `E2MOM` is; `RFT` and `TABATA` are not).

*The framing the closed half was measured against, kept as written apart from the
`Now` column, which is the only thing added. The `silent` readings were the
measurement that was wrong — see the correction above.*

**`for time, 3 rounds:` drops the three rounds without a word.** It parses to a
*sequence* — no count, no error, and a stable fixpoint, so nothing anywhere says
the rounds went missing. Spec §5.0 says **"Order is free on input"** and lists
structure → scoring as the canonical order, so this spelling is promised and does
not work. It is the same family as the defect closed on 2026-08-15 (*"The spec
already said order is free on a header; now it is true"*), which fixed a **target**
beside a `for time`; this is **structure** after one.

The shape is precise and worth stating, because it says where the fix goes: a
block's *kind* must come first, and anything stating a kind after a comma is
dropped. Measured:

| Written | Read as | | Now |
|---|---|---|---|
| `3 rounds for time:` | repeat, count 3, scored time | correct | unchanged |
| `for time, 3 rounds:` | sequence, **no count** | silent | repeat, count 3, scored time |
| `for time, 21-15-9:` | sequence, **no scheme** | silent — a whole ladder | ladder 21-15-9 |
| `for time, AMRAP 12min:` | sequence, **no window** | silent | amrap, 12min |
| `for time, team of 2:` | sequence, **not a team** | silent | team of 2 |
| `cap 12min, 3 rounds:` | sequence | *reported* | repeat, count 3, still reported |
| `building, 3 rounds:` | sequence | *reported* | repeat, count 3, still reported |

The last two are reported only because their first segment is not a kind at all.
**`for time` is the one head that swallows what follows it in silence**, because
it parses successfully on its own — a sequence scored by time is a real block, so
nothing looks wrong. Fix the general rule (a kind may appear in any comma
position) rather than special-casing `for time`, or the next head that parses
alone inherits the same hole.
*Touches: `spec/grammar-0.1.ohm` (`headerKind`, `headerModifier`),
`packages/core/src/grammar/block-semantics.ts`, `spec/spec-0.1.md` §5.0,
`test/golden/vocabulary.ts`.*

**1. ~~`rx` should desugar into `variants:`.~~ DONE 2026-08-18.**
`packages/core/src/variants.ts` is the one place a division is read.
`divisions(w)` lists what a workout offers whichever way it was written;
`resolve(w, name)` returns the workout that division reads; `--variant <name>`
hooks into the CLI **once** and reaches `fmt`, `check`, `timeline` and `export`
together, which is what "exporters need know about only one" was asking for.
Spec §10.1.

**The lowering went into the resolver, not into the table, and that is a
correction to this item as written.** A `variants:` entry is keyed by *movement*
and a split belongs to a *step*, so rewriting one into the other collapses two
Thruster steps at different splits into whichever was written last — silently.
Reasoning in [settled-decisions.md](../topics/settled-decisions.md).

**The display half was not free, which this item and
[builder-ux.md](../topics/builder-ux.md) both predicted it would be.** "The load would
arrive through `targets`" is true only once a division is **chosen**, and neither
app ever chooses one. `stepCue` needed its own branch. With no division chosen a
step now reads as its at-rest text — `30 Clean & Jerks (women 105lb / men
145lb)`, both magnitudes, labelled, rendered through the formatter's own
`formatRx` so the two surfaces cannot drift. Decided with Chris; the candidate
that was refused is *picking a base*, since prescribing one athlete's weight to
everyone looks right and is therefore worse than showing nothing.

**Two defects found by doing it, both fixed here.** A variant key folds to
`wallball` where the step it targets is written `100 Wall Balls` and folds to
`wallballs`, so the one corpus file using `variants:` silently kept the men's
wall ball for the women — matching now goes through the registry, which knows
plurals and aliases. And **a block header's inherited target was never
validated**: `checkTargets` ran on a step's own targets only, so `3 rounds @
95/65:` — the block-level spelling of a split — went through in silence while the
step-level one asked which reading was meant, and `3 rounds @ 75%:` escaped the
missing-reference warning the same way.

**The corpus did not move.** `interpretations.json` regenerated byte-identical
and all three `registry/` files differ only in their `generated` date — expected,
since zero of the 190 corpus files use a split and one uses `variants:`. All the
evidence is in `vocabulary.ts` (+11 forms, a new `divisions` group) and the new
`test/variants.test.ts`, which compares a reparse **field by field**. 1703 → 1739
passing, 1 pending.
*Touched: `packages/core/src/variants.ts` (new), `units.ts`, `timeline.ts`,
`format.ts`, `ast.ts`, `validate.ts`, `index.ts`, `bin/wdl.ts`,
`spec/spec-0.1.md` §10.1, `test/variants.test.ts` (new),
`test/golden/vocabulary.ts`, `test/validate.test.ts`.*

**1a. ~~Let a division be chosen on the board.~~ DONE 2026-08-20.** A workout
that offers a division shows a picker in the board's footer, built from
`divisions()` in its stable order with *as written* first; a workout that offers
none shows no control at all. Choosing re-cues from `resolve()` **from where the
reader stands** — cursor, workout clock, section clock and lap count all survive,
because a reader who says "women" three rounds in is answering a question about
the weights, not asking to start over. The builder is untouched, and that is the
2026-08-19 decision, not an omission.

**The question the item left open is answered, and the premise it was answered
from was false.** *"Whether the choice survives a reload"*, argued by analogy:
*"the board already keeps position across one"*. **Measured 2026-08-20: it does
not.** `load` ends in `reset`, so a reload restarts the session at cue zero with
the clock at 0:00. What survives is the *workout*, because the hash is what
survives and the hash is the workout. So the analogy holds against a different
thing: a division is not progress through a session, it is which reading of the
file is on the screen — which is exactly what the hash already carries. It goes
in the hash, as `#<workout>&division=women`. `encodeURIComponent` escapes `&`, so
the separator is one no workout text can forge and every link written before
today reads unchanged. The share link now carries the reading too, which is a
coherent thing to send: "today's HYROX, women's".

**Nothing rewrites a line, and that is not a compromise with "the board renders
source text".** It is the same split one layer down. In *both* spellings the text
already shows every division at once — `(women 105lb / men 145lb)` on the step,
the whole `variants:` table further down the file — so the board shows the class
and the bar shows the face of it you are doing. The headline saying `@ 105lb`
over a line reading `(women 105lb / men 145lb)` is the runtime picking one of the
two the line is already offering, not contradicting it. The chosen division leads
the sub-line under the headline so the reason for the difference sits next to the
number rather than in the footer.

**Three things found by driving it, all fixed here, none of them the item.**
- **`unknown-division` carries no line**, so a division named by a link and not
  by the file would have printed `line undefined: no division \`mens\``. That is
  the `line undefined:` debt in [builder-ux.md](../topics/builder-ux.md), and adding a
  fourth way to hit it is a reason to close it rather than to file beside it.
  A bad division falls back to *as written*, says why, and is dropped from the
  URL — the board must not go on claiming to read something it is not.
- **The board had only the curated registry**, so `pull-up: Ring Row` — spec
  §10's own example of a movement swap — came back reported as *not a movement in
  the registry*. Not a missed swap but a **false statement on the screen**, and
  it only became reachable because something finally resolved in a browser. The
  canonical merge is now fetched lazily, on exactly one signal: the resolver said
  it could not read a value. A table of loads like the HYROX file never pays.
  **It is 1.7MB for a name lookup**, which is the crude half of the fix and is
  written up in [known-debts.md](../topics/known-debts.md).
- **The footer was already wider than a phone** — `Reset` clipped at 375px,
  `Edit` past the edge — and the picker made it worse by a hundred pixels, which
  turned an ugly edge into a control that did not exist on a phone. One line,
  `flex-wrap: wrap`, and the board's own stylesheet stops lying about working
  propped against a water bottle.

**No core change, so nothing regenerated and nothing moved.** Three app files;
1742 passing, 1 pending, unchanged. Verified by driving the board — both
spellings, mid-session switching with the clocks held, a reload, a link naming a
division that does not exist, a value the resolver cannot read, a workout with no
divisions, and 375px.
*Touched: `apps/display/board.js`, `apps/display/index.html`,
`apps/display/board.css`.*

**2. ~~Results.~~ DONE 2026-08-23.** A `.wdlr` record in the same line grammar
as a workout, a goals file and a program; the board writes one when a session
ends; and `measure: load` reads a series of them. The class/instantiation
framing the item asked to carry into the design carried the whole way: the head
of a result names what it is a result *of*, a `snapshot:` holds the workout text
verbatim, `instantiate()` applies the division and then the recorded loads, and
everything downstream reads an ordinary workout. Spec
[results-0.1.md](../../../spec/results-0.1.md); decisions in
[settled-decisions.md](../topics/settled-decisions.md); 1742 → 1773 passing, 1 pending.

**The one deviation from the roadmap sketch is a spelling.** §3.2 wrote
`result:` as a header with `workout:` under it; the head carries the id
directly, because a result has no title worth writing and `workout:` beside
`snapshot:` would be two names for one thing a field apart. The id is
**optional**: a workout you wrote this morning has no `@id` and was still done,
so the snapshot is the anchor and the id is the pointer.

**A movement swap is deliberately not read**, and that is the one part of the
hole left open on purpose. A `variants:` value may name a movement, because the
author wrote the swap into the class; what somebody substituted on the day is a
*modification*, and whether modifications want structure is an open roadmap
question — reading one here would have closed it by accident. It goes in
`notes:`, and [deferred.md](deferred.md) says so.

**`measure: load` needed one thing the item did not predict: a rule about
silence.** Two zeroes satisfy `now >= prev * 1.025`, so a ramp asked of results
that record no load passed without a word. Reporting it is right; reporting it
*per slot* was wrong, and re-created the exact noise slots exist to suppress —
"ramp the pull" finds no lats on leg day because leg day was never supposed to
have any. `program: slots`, a test pinning a past fix, is what caught it.

**Five things found by driving it, three of them not the item.**
- **The board recorded no splits for Fran** — the one workout the roadmap uses
  to illustrate splits. `Cue.rounds` is what it is called and is not what it
  means: `run` fills it only for a block that *repeats*, and a rep scheme is
  expanded into explicit tiers. A split is now **a line you have already been
  on**, which is a fact about the cue list and covers a ladder, a `5 sets:` and
  an AMRAP pass alike.
- **`hidden` did not hide.** `.division { display: flex }` is an author rule and
  `[hidden] { display: none }` is the user agent's, so the division picker had
  been showing on *every* workout since item 1a — including the ones that offer
  no division, which is precisely what that item claimed it did not do. The bar
  and the footer had it for longer: an empty board showed a 0:00 clock over
  "drop a file here". Fixed once and generally, `[hidden] { display: none
  !important }`, rather than as a list of the three that broke.
- **A HYROX finishes in `1:04:19` and the language could not read it.**
  `parseDuration` took two clock fields, which was enough for as long as nothing
  wrote down an elapsed hour — and no *workout file* ever does. The first real
  result did. Spec §3.
- **A `progress` message rounded its own rule away.** `at least: +2.5%` printed
  as `3% more required`, harmless while every dimension counted whole things and
  wrong the moment one counted kilos.
- **A `5 sets:` scored by rounds recorded zero of them.** The board counted
  rounds with `lap`, which counts passes of a *section that comes round again* —
  exact where there is one and simply zero where there is not. Where there is no
  such section the rounds are the boundaries the cursor crossed, which is what a
  split already is.

**One guard added rather than found.** Four record types now share one CLI, and
`wdl fmt -w` read anything as a workout — so pointed at a `.wdlr` it would parse
the fields as steps and write the mangling back. Every other file here is
recoverable and a training log is not, so each verb states what its arguments
are. The extension is the whole of the check; sniffing the contents would be a
fifth grammar guessing at the other four.

*Touched: `packages/core/src/result.ts` (new), `units.ts`, `muscles.ts`,
`goals.ts`, `variants.ts`, `index.ts`, `bin/wdl.ts`,
`packages/core/README.md`, `test/result.test.ts` (new), `test/goals.test.ts`,
`test/all.ts`, `apps/display/board.js`, `index.html`, `board.css`,
`apps/display/README.md`, `spec/results-0.1.md` (new), `spec/goals-0.1.md`,
`spec/spec-0.1.md` §3, `examples/results/` (new),
`examples/goals/ramp-the-squat.wdlg` (new).*

**3. ~~A capped for-time reports `duration` where it means "at most".~~
DONE 2026-08-23.** `Timeline.cap` and `Run.cap` carry the bound; `estimatedSeconds`
and `totalSeconds` carry the length; neither stands in for the other. The builder
and `wdl timeline` print two rows — `duration: athlete-paced` and `cap: 12:00 at
most` — because they answer two questions.

**The item as written was half the answer, and driving the corpus found the other
half.** "A cap is not a duration" is true of nine of the ten capped files and
*false* of `77-tiff.wdl`, which is a run and then a bare `AMRAP:`. That AMRAP
takes whatever is left of the cap (spec §5.6), so the block ends **at**
twenty-five minutes rather than merely by then, and twenty-five is its length.
So the rule is not about caps at all: it is about whether the work inside ends
when the *work* is done or when the *clock* is. `fillsTheClock()` in `timeline.ts`
is that one question, and it is the reason a blanket fix would have broken a file
the suite was already pinning correctly.

**A second defect, found by driving the builder and not by the suite.** `run()`
sums the cues itself when every one is timed, and that sum never knew about the
cap — so `for time, cap 5min:` over eight minutes of rowing and biking printed
`duration 8:00` beside `cap 5:00 at most`, two rows contradicting each other on
one screen. `estimate()` had clamped the same case correctly for as long as it
has existed; run's sum was a worse copy of it. Only visible once the cap had a
row of its own, which is the shape of every bug this pane has found.

**Where the number moved, and where it did not.** Nine corpus files lose an
`estimatedSeconds` and gain a `cap`; `77-tiff.wdl` keeps both; nothing else in
190 files moves. `wdl export --to connect` hands the cap over as
`estimatedDurationInSecs` where there is no length — Connect has one field and
nowhere to say "at most", so the choice is now explicit instead of inherited from
a timeline that blurred the two. The golden digest records `cap` beside `seconds`
so the distinction is pinned for every file, not only the ten. 1742 → 1749
passing, 1 pending.
*Touched: `packages/core/src/timeline.ts`, `run.ts`, `adapters/garmin-connect.ts`,
`bin/wdl.ts`, `apps/builder/builder.js`, `scripts/build-workouts.mjs`,
`spec/spec-0.1.md` §5.6, `test/timeline.test.ts`, `test/run.test.ts`,
`test/golden/generate.ts` + `interpretations.json`,
`registry/workouts.canonical.json`.*

**The gap this leaves is item 8**, and it is filed rather than folded in: the
board still shows no cap, because telling the two numbers apart and deciding what
a running clock does when one expires are different pieces of work.

**4. ~~Curate the generation pool.~~ DONE 2026-08-23.** `mark-core` scored 178
movements in on source agreement, which is a proxy for "commonly catalogued", not
"worth putting in a workout" — `Quad Stretch` made the cut. **178 → 129**, and the
palette and the generator both read it.

**It was never the threshold.** Moving the bar to 5 drops `Sumo Deadlift`,
`Face Pull`, `Dips` and `Pistol` and keeps `Smith Machine Squat`, because
"well attested" and "worth writing into a round" are not the same axis and no
cut along one orders the other. `commonality` answers the first, which is what
dedup needs and what it was built for. The pool asks the second.

**So the pool asks for a judgement, and three of the six signals are one:** a
workout in our corpus writes it, the curator wrote a record for it, or a vendor
tracks a 1RM for it. Sources agreeing, heading a family and absorbing duplicates
are facts about *catalogues and names*, and no quantity of them adds up to a
judgement. They still score, and the score still cuts dedup; they no longer put
a movement in front of a reader by themselves.

**The threshold went with them**, because it was the same inversion from the
other side. Curation is +3 against a bar of 4, so a hand-written record that no
corpus workout happens to use never reached the pool — fourteen did not, among
them `Bar-Facing Burpee`, `Hang Power Clean`, `Squat Snatch`, `Kettlebell
Snatch`, `Atlas Stone to Shoulder` and `Log Press`, every one of them carrying a
`pattern`. Meanwhile `Smith Machine Close-Grip Bench Press` was in.

**What the old rule admitted is the argument for the new one.** Of the 77 records
it let in on catalogue evidence alone, **every one had no `pattern`** — nothing
saying it is a squat, a hinge, a pull. `? squat` could not reach one of them.
They were reachable only through a bare `?`, which is to say only by being picked
blind, and that is what a bare `?` was doing: three seeds of `15 ? / 12 ? / 10 ?`
came back `Decline Dumbbell Bench Presses, Dumbbell Floor Presses, Bench Presses`
— three spellings of one movement in one round.

**Eight records were curated in**, because the cut left real holes and the way to
fill a hole in the pool is to *write the record*, which is what `registry/movements.json`
is for. `Barbell Row`, `Inverted Row` and `Ring Row` (horizontal pull had three
movements, one of which is the erg), `Romanian Deadlift` and `Sumo Deadlift`,
`Chin-Up`, `Step-up` (the pool had none) and `Russian Twist` (the pool had no
rotation at all). Five were promotions of records the seed already carried as
free-exercise-db imports; three are new. Nothing else in 3120 records moved —
the rebuild diff is those eight and the scores.

**Nothing was removed from the language.** A movement out of the pool is still in
the registry, still validates, still analyses, and the palette still finds it the
moment you type — the builder's own rule, that typing is how you reach past the
core, is what makes a tight pool safe. *Verified in the browser: the palette reads
`129 of the core set`, `Quad Stretch` is gone from it and still reachable by
search, and `Ring Row` adds and cues.*
*Touched: `registry/movements.json`, `scripts/mark-core.mjs`,
`packages/core/test/generate.test.ts`.*

**5. ~~A range is only a rep range.~~ DONE 2026-08-23.** `100-150ft Farmers
Carry` used to land whole in the movement name with the quantity left `open`,
so the step matched no registry entry and `wdl fmt` pluralized what it was
handed into `100-150 ft Farmers Carries`, with `wdl check` silent throughout —
the exact failure shape leading `5x5` had before item 0e.

**The range does not generalise — not on one caller's say-so.** A carry written
`100-150ft` says what `8-12` says, and so does `rest 60-90s`, which is a real
argument for teaching `Quantity`'s range a unit. But distance and duration
ranges are different shapes, not one kind with a unit bolted on, and every
consumer of `kind: 'range'` would need to stop assuming reps for a feature asked
for once. What was not optional was the silence, and closing it does not
require settling that: the grammar now matches `<int>-<int><letters>` as its own
production, `unreadableRange`, ahead of `anyQuantity`, and reads it the way an
unrecognized comma modifier already reads (item 0d) — quantity `open`, raw text
in `Step.unknown`, reported by `validate.ts`'s existing `unread()` as a `note`.
The movement name comes out right, so muscle attribution resolves; volume does
not, honestly, because there is no single number to give it. `rest 60-90s` was
already closed correctly before this — `restLine` fails outright on a dash, so
`parseRest`'s fallback reports `unreadable rest duration "60-90s"`; only the
step-line case needed the fix. Full decision in
[settled-decisions.md](../topics/settled-decisions.md).
*Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/step-semantics.ts`,
`spec/spec-0.1.md`, `packages/core/test/golden/vocabulary.ts`.*

**6. ~~A load can be a word, and the language has no scale for it.~~ DONE
2026-08-23.** Qualitative load is now a **category the language knows**: `Load`
gained a fifth kind, `qualitative`, holding `heavy` / `moderate` / `light` /
`unloaded` — a small closed vocabulary, read case-insensitively and canonicalised
to lowercase. `- 150ft Farmers Carry @ heavy` parses to `{kind: 'load', load:
{kind: 'qualitative', value: 'heavy'}}` instead of falling into `raw`, which is
the whole of the fix: `parseTarget` in `units.ts` gets one more branch, ahead of
the `raw` fallback.

**It stays a sensible-but-unresolvable value, on purpose — the option this item
framed as the alternative to "stays raw" turned out not to be a fork.**
`loadKilograms` returns `undefined` for `qualitative` exactly as it already does
for `percent` and `reference`, so volume, `measure: load` and export are
unchanged: nothing invents a kilogram figure a coach never wrote. What moved is
narrower and is the part worth stating precisely — everything that walks
`targets` looking for `t.kind === 'load'` (muscle-load's `heaviest()`, a future
"was this step loaded" check) now **sees** the target and can say "loaded, not
resolvable" instead of not seeing it at all, because it is no longer sitting in
`raw` beside stray commas and unrecognized phrases. Held-and-inert must not also
be invisible to a check built for loads — the same shape item 0d closed for
`unknown` text, one layer up.

**The interaction with item 5 this item flagged does not go away, and is worth
restating precisely: item 5 is still open.** A range with a unit
(`100-150ft Farmers Carry`) still lands whole in the movement name, so a carry
written with both a range quantity and a qualitative load still contributes
nothing to volume or muscle attribution — but it now validates *and* is visibly
unresolvable on the load side rather than silently wrong on both. Closing this
item does not close that one.

**No corpus file uses the vocabulary**, so `interpretations.json` regenerated to
no change. Five pinned forms under a new `target/qualitative` vocabulary group,
plus a test pinning that the step still resolves to muscles with `load`
`undefined` — the same reading a step with no load target at all gets,
deliberately, since that is the shape the "unresolvable is not absent"
distinction has to hold up against. 1791 → 1797 passing, 1 pending.
*Touched: `packages/core/src/ast.ts`, `units.ts`, `spec/spec-0.1.md` §3, §7,
`test/golden/vocabulary.ts`, `test/muscles.test.ts`.*

**7. ~~A body map in the builder and on the board.~~ DONE 2026-08-23.** Front and
back, one stylised SVG path per muscle in `apps/shared/body-map.js`, id-matched
to `registry/muscles.json`'s 19-muscle vocabulary — 10 muscles drawn on the front
view, 9 on the back, each exactly once. Pure rendering and pure state functions
(`aggregateStates`, `highlightStates`, `heatStates`) over what `exposures()`,
`musclesFor()` and `muscleLoad()` already report, so no core change was needed,
as scoped. All four views landed: the builder's **aggregate** (a "Body" panel
under "What it reads as"), **per-movement highlight** against it from hovering
either the palette or an outline row, a **heat map** toggling `frequency` vs
`volume` with a hatch pattern for "worked but this measure does not apply", and
the **board's header**, the same aggregate/highlight pair driven by the cue
cursor. The design question — opacity, two colours, or nothing for primary vs
secondary — is settled as opacity; see
[settled-decisions.md](../topics/settled-decisions.md), which also carries the
heat-scale decision the item asked for. One touch outside the stated scope: the
board's `canonicalMovements` fetch, previously lazy, is now eager (not awaited)
because the map wants an attribution for every cue; see
[known-debts.md](../topics/known-debts.md).
*Touched: `apps/shared/body-map.js` (new), `apps/shared/body-map.css` (new),
`apps/builder/index.html`, `apps/builder/builder.js`, `apps/builder/builder.css`,
`apps/display/index.html`, `apps/display/board.js`, `apps/display/board.css`.*

**8. ~~An alias pass over the core.~~ DONE 2026-08-22, with a residue.** The
registry held 278 aliases across 219 of 3120 movements, 117 of the 178 core.
It now holds **407 across 265, and 162 of the 177 core** — 131 written by hand
onto the core, against the two rules the measurement had already shown mattered:
an alias must fold to something no other entry claims, and an alias must not be
a movement in its own right. The second rule did most of the work and cost the
most judgement: **fourteen candidates were rejected because the registry already
held them as records** — `Military Press`, `Barbell Row`, `Handstand`,
`Squat Snatch`, `Hollow Rock`, `Ring Row`, `Upright Row`, `Calf Raise`,
`Bicycle Crunch` among them — and every one of those would have redirected a
real movement into a different record's muscles.

*Corrected 2026-08-22: this item was worked from a written brief but had never
been added to this file, so there was nothing here to take off. It is written up
after the fact, which is why it is a record rather than a plan.*

Three things came out of it that are not aliases, and they are the part worth
carrying forward. The first was closed, and doing it raised two more — five in
all, of which three have closed. **Two are open**, and they are the two that
need a mechanism nobody has designed yet:

- **~~A curated alias cannot merge a record, so an assertion of sameness lands as
  a collision.~~ DONE 2026-08-23.** `sameAs` on a curated record names the ids it
  is one movement with, `dedupe-movements.mjs` absorbs them and drops the field,
  and `check-aliases.mjs` goes from **13 problems to 2**. Eight of the twelve
  were one movement and are merged, two were not and the alias asserting
  otherwise was withdrawn, and two are correct aliases on `Bike` that cannot be
  merged or withdrawn without making something worse. Verdicts one per pair, and
  what the merges cost, are in [known-debts.md](../topics/known-debts.md); why the
  mechanism is a field rather than a reading of the alias already there is in
  [settled-decisions.md](../topics/settled-decisions.md).
  *Touched: `registry/movements.json`, `scripts/dedupe-movements.mjs`,
  `scripts/build-movements.mjs`, `packages/core/src/fold.ts`,
  `packages/core/test/fold.test.ts`.*
- **`find-duplicates.mjs` cannot find a duplicate inside our own registry.** Not
  a bug: it skips same-source pairs, vetoes on any distinguishing token, and
  never reads aliases. A within-registry pass needs different rules, and should
  start from the aliases, where the answer is already written down.
  *Touches: `scripts/find-duplicates.mjs` or a sibling.*
- **~~`Air Bike` is two exercises in one record~~ DONE 2026-08-23.** Two
  exercises merged on an identical title: Garmin's fan bike, and
  free-exercise-db's and everkinetic's bicycle crunch. Nothing guarded against a
  title match being wrong, so the record claimed `abs` and `quads` at once and
  scored `3-sources` for it. `NOT_WHAT_THE_NAME_MEANS` in
  `build-movements.mjs` is the fix: a table keyed on `source:upstream-id` naming
  the record an entry actually belongs to, checked at build time so a directive
  that matches nothing fails loudly. The crunch went to `Bicycle Crunch` (two
  sources to four); what was left of `Air Bike` was Garmin's fan bike claiming
  exactly what `Bike` claims, so `sameAs` absorbed it and the `airbike`
  collision closed — `check-aliases.mjs` goes from **2 contended names to 1**,
  and the pinned list in `fold.test.ts` with it.
  *Corrected 2026-08-23: this bullet said `Air Bike` was the oldest item here
  with a corpus consequence. It had none. An explicit alias had outranked a
  record's own id since earlier the same day, so `Air Bike` in a workout already
  resolved to `Bike` — and no corpus file writes the name anyway. The golden
  digest moved not a byte, which is the correct result. What was really wrong
  was a false agreement signal and a blocked merge, and neither is worth the
  top of a queue.*
  *Touched: `scripts/build-movements.mjs`, `registry/movements.json`,
  `packages/core/test/fold.test.ts`.*
- **`Bike` is a modality, not a movement, and the registry has no word for that.**
  Raised 2026-08-23 by declining two merges. `Bike` is one record standing for
  the erg, the fan bike and the road, with six aliases saying so on purpose.
  Absorbing `Assault Bike` into it put Garmin's `chest` claim onto six corpus
  workouts including a 40km ride, so it was declined — but the alias is correct
  English and stays, so the collision stays with it. What is missing is a way to
  say *these names are one modality and each keeps its own muscles*, which is a
  third relation beside `sameAs` and `variantOf`. `Row`, `Ski` and `Run` are the
  same shape and have not been looked at.
  *Corrected 2026-08-23: one of the two declined merges has since been accepted.
  `Air Bike`, once split, claimed muscle-for-muscle what `Bike` already claimed,
  so absorbing it leaked nothing and it was merged. This is now a finding about
  `Assault Bike` alone — and it is a thinner one than it looked, because it
  turns on Garmin giving the assault bike a `chest` claim and the air bike none.
  Two names for the same machine, and the lump is only visible where a source
  happens to disagree with it. A modality relation would say so out loud instead
  of waiting for a disagreement to reveal it.*
  *Touches: `registry/movements.json`, `scripts/dedupe-movements.mjs`,
  `packages/core/src/fold.ts`.*
- **~~The golden digest should cover muscle attribution, and does not.~~ DONE
  2026-08-23.** `muscles` is a field of the digest now: per muscle, how many
  exposures reached it and the same four amounts `movements` already carries,
  once for the steps it drives and once for the steps it assists. Primary and
  secondary are kept apart because **a merge can move a muscle between them
  without moving a number**, and one combined figure would hide exactly that.

  **It was verified against the change that raised it, not against reasoning.**
  `provide()` takes the corpus as a thunk, so a throwaway run digested all 190
  files twice — once against `registry/movements.canonical.json` and once
  against the file as it stood before the `sameAs` merges (`adfefe5`) — and the
  new digest differs in **exactly the eight files that merge moved, and in
  nothing but `muscles`**. Those eight are the ones every regenerator called
  clean on the day; `11-mary` gains a `hamstrings` entry that was not there at
  all, which is the shape of change nothing could previously see.

  **The diff is 22,710 added lines and not one removed**, across all 190 files
  — which is why this was kept off the back of a registry change. The suite is
  unchanged at 1790 passing / 1 pending, and so is the time it takes:
  `muscleLoad` over the corpus is a fraction of a second, and `muscles.test.ts`,
  `fold.test.ts` and `generate.test.ts` were already building the canonical
  registry, so the golden suite inherits it rather than paying for it.
  *Touched: `packages/core/test/golden/generate.ts`,
  `packages/core/test/golden/interpretations.json`.*

`node scripts/check-aliases.mjs` reports both failure shapes — a key two records
claim, and an alias whose plural shadows another record — across both registries.
The suite validates the canonical corpus for the first time; before this it only
ever validated the curated file, which is not the one analysis reads.
*Touched: `registry/movements.json`, `scripts/build-movements.mjs`,
`scripts/check-aliases.mjs`, `packages/core/test/fold.test.ts`.*

**8a. ~~A bare name two records answer to picks a winner by accident and says
nothing.~~ DONE 2026-08-23, the resolution half.** `Registry.lookup` tried
`byKey` before `byAlias`, so the record holding a contested spelling as its
**id** won and the other record's explicit alias on that spelling was discarded
— and because an id match is a hit, the `ambiguous` branch
[../movement_registry_design.md](../../movement_registry_design.md) §3 calls the
whole point of the resolver could never fire. Nobody was told. The two tiers are
now the other way round, an explicit alias outranks a record's own name, and the
reasoning is in [settled-decisions.md](../topics/settled-decisions.md).

**Fourteen contested names, not five, and that is the first thing to say.** The
item was written against merge work this branch did not have, so the nine pairs
it expected to be gone were still two records each when the ranking landed, and
the verdicts it said were in [known-debts.md](../topics/known-debts.md) were not yet in
that file. *Both arrived with item 8 above, which is why the count fell to two:
the ranking decided who answers all fourteen, and the curation half then merged
eight pairs and withdrew two aliases.* Nothing was merged on the ranking's
behalf — merging is a curation call and needed the curator.

**All fourteen id-holders are imported and all fourteen alias-holders curated**,
so the rule the item proposed — a curated record's alias beats an imported
record's id — and the simpler provenance-blind one agree on every case except
`dumbbellbicepscurl`, where both records hold the name only as an alias. The
provenance-blind rule was taken, and *not* because it is simpler:
`registry/movements.json` carries no `sources` field at all, so a provenance
rule would treat every record in the registry `validate` consults as imported
and quietly invert itself there. The one name it leaves `ambiguous` was
ambiguous before too, and is the honest answer — nothing distinguishes two
records that both merely mention a name.

**Measured before committing to it, and the corpus did not move.** Across every
id, title, alias and plural in both registries — 3629 names curated, 12016
canonical — **the curated registry does not move at all** and 72 canonical names
move, every one of them a spelling of the thirteen. Of the 135 distinct movement
names the corpus uses, exactly one changes: `Squat`, from the imported barbell
`squat` to `air-squat`. Muscle attribution is **identical** — the two records
carry the same primaries, secondaries and source count — so
`interpretations.json` regenerated to no change, the goldens to no change, and
`registry/` to nothing but its date stamp. What did change is what a bare
`Squat` *is*: bodyweight rather than `equipment: [Barbell]`, with a
`defaultLaterality` and a squat `pattern` the imported record never had.

**The cost, and it was caught by an existing pinned test rather than by
thinking.** Reversing the tiers split `Squat` from `Squats`: the imported record
carries its own plural in `aliases`, so the plural matched the alias tier on one
record while the singular matched it on the other. *never changes which movement
a name resolves to* went from 3 splits to 6 the moment the order flipped. A
regular self-plural is precisely what `depluralize` reconstructs, so it is no
longer indexed at all and the plural takes the singular's path; the count is
back to its pinned 3.

**`node scripts/check-aliases.mjs` is new and is the artefact to keep.** It
lists every contested name in both registries, how each record claims it (id,
title or alias), that record's sources, who wins and by which tier. It is a
**report and not a gate** — it always exits 0, because one name is ambiguous on
purpose and a check that fails every time is not a check. What stops a new
collision landing quietly is the pinned list, *has only the known alias
collisions in the canonical corpus* in `packages/core/test/fold.test.ts`, which
also asserts the property the defect broke: **where the curated registry has an
answer, the merged corpus never contradicts it.**

*Suite 1742 → 1743, 1 pending, unchanged. The house note said 1744; this branch
was at 1742 before the change, which is the same merge work being missing.*
*Touched: `packages/core/src/fold.ts`, `packages/core/test/fold.test.ts`,
`scripts/check-aliases.mjs`, `docs/movement_registry_design.md` §3.*

**9. ~~A cap is a clock, and the board does not run it.~~ DONE 2026-08-23.**
`tick()` now reads `state.cap` — set from `laid.cap` in `recue()` — the same way
it already read a section's `window`: `onClock` is whichever of a running
section's own clock and the cap is nearer, computed once and used everywhere the
old single-source value was. No new row. A twelve-minute cap now counts down in
the same place the cue and section clocks already do, because the athlete does
not care which field of the file produced the deadline, only which one is
closer.

**The expiry was the real half, and the answer is: stop where you stand, not at
the end.** `capOut()` is not `finish()` — it freezes the clock, disables
`start`/`next`/`prev`/`leave`, and opens the record panel, but leaves `state.at`
exactly where the cursor was. Spec §5.6 says the workout ends; it does not say
the athlete reached the last cue, and `finish()`'s "jump to the end" would have
claimed exactly that on a screen that is supposed to be honest about what it
measured. `measuredScore()` needed no change: it already reads the clock rather
than the cursor for a `for time` score, so a cap-out reports the same time
score `finish()` would have, and it still declines to invent a reps or rounds
number — that guess is item 2's business, on a *result*, not this one's.

**The nearer-deadline rule generalizes the one that already existed.** A cue's
own clock already outranked a section's; a cap is a third clock, checked in the
same order — cue, then the nearer of section-or-cap. `77-tiff.wdl`
(`for time, cap 25min:` around a bare `AMRAP:`) is the proof: the AMRAP has no
window of its own, so the cap is what the display and the expiry both use, and a
synthetic file nesting a *short* AMRAP window inside a *longer* cap (driven on
the board, not just read) confirmed the other direction — the section's own
clock expires it first, `leave()` drops the cursor back to the spine, and the
cap goes on counting down over what is left.

**`state.window` is gone**, per the debt that flagged it — it was dead since the
cycle rewrite and nothing reads it now that `state.cap` exists beside it instead
of plumbed in.
*Touched: `apps/display/board.js`. `board.css` untouched — the cap reads through
the clock and its `aside` that a section's window already used, so it needed no
row of its own.*

**10. ~~Collapse the builder's Outline and Text panes into one tabbed pane.~~
DONE 2026-08-29.** The builder's `<main>` was a four-column grid — palette |
Outline | Text | "What it reads as" — and the Outline (structural GUI) and
Text (raw `<textarea>`) each took a full column though a user only ever edits
in one mode at a time. They are now two tabs of a single `.editor-pane` cell:
a tab strip stands in for the two `<h2>` bars, the inactive view is
`display: none` so it reserves no height, and `render()` still repaints both
every time — a switch is show/hide only, because `lines` is the single source
of truth both views already repaint from, so an edit in either mode is in the
other the instant you switch.

**A pure display change — no data path moved.** No core change, no test change
(the suite does not touch the builder DOM; 2025 passing, 1 pending, before and
after). Verified by driving the builder in both themes: the two tabs switch
and only one shows; a Text edit appears in the Outline after switching and
vice versa; the layout holds at 1440, 1100 and 800px; the choice survives a
reload.

**What shipped:**
- **Tab control** — two buttons (`role="tab"`) in a `.editor-tabs` strip in
  the editor pane's header, `aria-selected` marking the active one, styled to
  the existing `--panel` / `--rule` / `--accent` header idiom (an accent
  underline on the active tab).
- **The `#dirty` "edited" badge moved onto the Text tab**, so a hand edit that
  has drifted the text from canonical stays visible while the Outline tab is
  active. `renderReading()` still drives `el('dirty').hidden` unchanged.
- **The `+ movement / + block / + rest` row stays with the Outline view.**
- **Default and persistence:** `localStorage['wdl.editor-tab']`, read on load,
  defaulting to **Outline** — the builder's pitch is that it is a GUI, not a
  text editor.
- **Grid:** `main` went 4 → 3 columns (palette | editor | reading). The
  `@media (max-width: 1180px)` rule drops to 2 columns under a full-width
  palette; the `900px` single-column stack is unchanged.
*Touched: `apps/builder/index.html`, `apps/builder/builder.css`,
`apps/builder/builder.js`.*

**14. ~~An unrecognized parenthetical after a movement is silently swallowed
into the movement name.~~ DONE 2026-08-29.** Top priority (Chris, 2026-08-29) —
the one open item that corrupted output silently rather than being UI polish.
`- 12 Around The Worlds (each direction)` parsed with no error, no `note`,
`validate` clean, and `step.movement === "Around The Worlds (each direction)"`:
the movement resolved to no registry entry (muscle attribution, body map,
generation-pool membership all went blank), and `format` ran `pluralize` over
the whole string and emitted `... (each direction)s` — an `s` on the closing
paren, a stable round trip of a mangling. `(both)` / `(split)` / `(per-side)` /
`(total)` and the rx-split shapes read fine; anything else in parentheses
matched no alternative, so PEG backtracked and the `(`, `)` and inner text fell
into `movementName` one `nameChar` at a time.

**The fix is queue item 5's `unreadableRange` pattern, one construct over.** A
new grammar production `unreadableParen = "(" (~")" any)+ ")"`, added to
`qualifiedPart` and `stepPart` **after** `laterality` and `rxSplit` so the
recognised forms still win and this is strictly the fallback. Its semantics
(`step-semantics.ts`) push the whole parenthetical — parens included — into
`Step.unknown`; `validate.ts`'s existing `unread()` reports it as a `note`, and
`format` writes it back after the modifiers it did read (`- 12 Around The
Worlds, (each direction)`), so `pluralize` never sees it and the `(…)s` is gone.

**Edges, stated in the spec.** The match runs to the *first* `)`, so a nested
`(a (b) c)` is not caught and stays in the name — the simple non-throwing rule
wins on a whiteboard format. And ~15 of ~970 registry titles (all raw imports —
`Front Squat (Clean Grip)`, `Box Jump (Multiple Response)`) carry a
parenthetical themselves; these now have it peeled to a `note` and resolve
against the base name. **Corpus did not move:** no example file writes an unread
parenthetical, so `node packages/core/test/golden/generate.ts` and `node
scripts/build-workouts.mjs` regenerated `interpretations.json` and
`registry/workouts.canonical.json` to no change at all. Suite **2027 → 2038**
passing (+11 vocabulary/grammar cases — new `unread-parenthetical` group), 1
pending unchanged. Verified by driving the builder in both themes: the movement
resolves (body map lights chest), the diagnostics pane shows the `note`, and
Canonicalise leaves the parenthetical intact.
*Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/step-semantics.ts`,
`spec/spec-0.1.md` (§4, §11.1), `packages/core/test/golden/vocabulary.ts` (+
`vocabulary.json`), `packages/core/test/grammar.test.ts`. No app code — the
builder and board read `Step.unknown` and the `note` through the paths they
already use for comma-modifier unknowns.*

---

**17. ~~The Text tab is a bare `<textarea>`: Tab escapes it, and nothing is
highlighted.~~ DONE 2026-08-31, as builder-redesign stage R9** (`05efea0`).
*Raised high-priority by Chris 2026-08-29 from driving the builder; folded into
the layout redesign as R9 — the R-series stage list in [current.md](current.md)
carries the one-line strike, this is the full close.* Both halves shipped.
**(a) Trap Tab.** A `keydown` handler on `#text`: **Tab** inserts two spaces at
the caret (canonical indent, spec §2), **Shift-Tab** removes up to two leading
spaces, a **multi-line selection** with Tab / Shift-Tab indents / dedents every
touched line and keeps the selection over the same text, and **Enter** carries
the current line's leading indent onto the new line plus two more spaces when the
line being left ends in `:`. A plain zero-indent Enter is left to the browser.
Every branch edits through `document.execCommand('insertText')` (a `setRangeText`
+ manual `input` dispatch fallback), so native undo survives and the existing
`#text` `input` handler re-splits `lines` — `lines`-preserving, no new state.
**(b) Syntax-highlight layer.** `#text` is wrapped with `<pre id="text-hl">` in a
positioned `.text-wrap`; the textarea is `color: transparent; caret-color:
var(--ink)` (with a `::selection` wash) over the layer, which holds the same text
re-tokenised on every `input`. One colour per line kind from the **shared
`--kind-*` palette** (R3 / former item 16), classified by a lexical
`textLineKind()` that mirrors `renderOutline`'s `data-kind` vocabulary — title
(`#`) / directive (`@`) at zero indent, comment (`//`), rest (`rest …`), a
recognised `section:` word, any other colon-terminated `header:`, else `step`.
The two elements share every text-metric property in one CSS rule with
`scrollbar-gutter: stable` on both, so the caret sits on the layer's glyphs under
wrapping and at every scroll offset; a `scroll` listener copies
`scrollTop`/`scrollLeft`. The layer repaints on the `render()` and outline-row
write-back paths via a new `paintText()` helper (each `el('text').value = text()`
became `paintText()`), and on user input via `paintTextHl()` in the `input`
handler. `setEditorView` (tab show/hide) and the `#dirty` badge are untouched.
Completion-in-the-textarea (a caret-tracking popup) was explicitly out of scope —
still is, its own future item if wanted. No `packages/core` change — suite
**2051 passing, 1 pending**. *Touched: `apps/builder/index.html`,
`apps/builder/builder.css`, `apps/builder/builder.js`.*

---

## The deployment epic — items 18–20

*Raised by Chris 2026-08-30, all three closed the same day. The apps only ran
behind a dev server changing under whoever was testing; Chris wanted a stable
public URL he and training partners could actually vet, plus accounts and saved
workouts. This reversed the standing "Sharing, accounts, a platform" Non-Goal —
[../goals.md](../goals.md) "## Pivots",
[DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage).
It is **not** a turn toward competing for adoption; the two project goals are
unchanged, and nothing here touched `packages/core`, the grammar or the spec — a
stored workout is its `.wdl` source text in a DB column. Kept together in
`current.md` on purpose while in flight; closed together here.*

**18. ~~Stand up PocketBase on the DreamHost VPS.~~ DONE 2026-08-30.**
PocketBase **v0.40.1** live at **`https://wex.androidempathy.com`**. The
DreamHost *managed* VPS gives SSH but **no root / no systemd (system)** — so it
runs as a **per-user** systemd service (`~/.config/systemd/user/pocketbase.service`),
`loginctl enable-linger` giving boot-start + crash-restart (verified across a
reboot). TLS + routing via the **DreamHost panel Proxy Server** + panel Let's
Encrypt — the panel owns nginx, so `deploy/nginx/wdl.conf` is reference only.
Google OAuth2 wired on the `users` collection; a real sign-in tested end to end.
`workouts` collection created by a `deploy/pocketbase/pb_migrations/` JS
migration: `owner` (relation→`users`, required, cascade), `title` (text,
optional), `source` (text, required — the `.wdl` body), `visibility` (select:
`private`|`unlisted`|`public`), `created`/`updated` (autodate). API rules —
List/View `owner = @request.auth.id || visibility != "private"`, Create
`@request.auth.id != "" && owner = @request.auth.id`, Update/Delete
`owner = @request.auth.id`. **Known issue carried forward:** the panel proxy
reaches the daemon over the VPS public IP, forcing a `0.0.0.0` bind, so port
8090 is internet-reachable in plaintext past the TLS proxy — mitigated (auth on
every route, strong superuser password, HTTPS `Application URL`); real fix is an
open DreamHost firewall ticket. Full runbook: `deploy/README.md`.
*Touched: a new `deploy/` directory (runbook, process units, the collection
migration, config templates — no secrets). No `packages/` change.*

**19. ~~Deploy the builder + board behind the stable URL (static).~~ DONE
2026-08-30.** `https://wex.androidempathy.com/` serves the builder (`/`
redirects to `/apps/builder/`) and `/apps/display/` the board, **with no Node
process** — the panel proxy sends the *whole domain* to PocketBase, so the
static apps ship into PocketBase's own **`pb_public/`** (`~/pb/pb_public/`),
which `apis.Static` serves at `/` for any non-`/api/`, non-`/_/` path. Repeatable
deploy is **`scripts/deploy-web.mjs`**: core suite → `build-web.mjs` → assemble a
repo-shaped `build/deploy/pb_public/` (`apps/`, `build/web/core/`,
`spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
`examples/goals/`, a generated `index.html`) → `rsync -az --delete` to the box;
SSH target via `--ssh` / `WDL_DEPLOY_SSH`, never baked in. **MIME:** PocketBase
serves `.ohm` / `.wdlg` as `text/plain` and the apps `fetch().text()` them, so
nothing was needed. **Cache:** `pb_public` sends `Last-Modified` only; accepted
as-is (one `rsync` rewrites grammar + registry + core together, nothing is
hash-pinned) — the `pb_hooks` `Cache-Control` escalation is documented, not
shipped. Verified live: both apps, `#<source>` share link, both themes, no
console errors; `/api/health` + `/_/` unaffected. *Touched:
`scripts/deploy-web.mjs`, `deploy/README.md` "## 10". No `packages/` change.*

**20. ~~Frontend: Google sign-in, saved workouts, sharing.~~ DONE 2026-08-30.**
Additive account layer on the static apps, talking to the co-located PocketBase
at `/api` (same origin, no CORS). Signed out, the builder is unchanged —
`Download .wdl` / `Open…` a local file untouched, none of the account UI shown.

- **`apps/shared/pocketbase.js`** — a **hand-rolled ~8-call `fetch` client**,
  no SDK ([DEC-003](../topics/settled-decisions.md#dec-003-src-is-portable-and-is-handed-its-data)
  / [DEC-008](../topics/settled-decisions.md#dec-008-ohm-js-is-vendored-imported-by-relative-path):
  no npm runtime dep, no build step — the rule that vendors `ohm-js`). Google
  OAuth2 by the **redirect flow**, not the SDK's popup+realtime dance: GET
  `auth-methods` → full-page navigate to Google's `authURL` with our
  `redirect_uri` → POST `auth-with-oauth2` with `code`/`codeVerifier`/`redirectURL`
  → `{ token, record }` into `localStorage`; `refreshAuth()` revalidates on
  startup, clears a stale token on 401/403. Records: `create` / `listMine` /
  `getById` / `update` / `remove` on the `workouts` collection. Header comment
  pins the PocketBase **v0.40.x** routes and says why hand-rolled.
- **`apps/builder/auth-callback.html`** — the fixed URL Google returns to (a
  redirect flow needs one); runs `completeSignInFromRedirect()` and bounces
  back to the builder. Registered as a **second** authorised redirect URI in the
  Google Cloud Console alongside PocketBase's own `/api/oauth2-redirect` —
  `deploy/README.md` §8.
- **Builder** — a *Sign in with Google* control + signed-in identity in the
  header; a **My workouts** dropdown: **Save** (create if new / update if
  opened-from-server — explicit, never autosave), *Save as copy*, open a saved
  workout into the editor, rename, delete, and a **visibility** select
  (`private`/`unlisted`/`public`) + **Copy link**. The buffer is stashed to
  `localStorage` across the sign-in redirect so it survives the round trip.
- **Board** — `/apps/display/?w=<id>` fetches the record and runs it; a
  `#<source>` hash behaves exactly as before and **wins when both are present**.
  A `private`/missing id 404s and the board shows a "not found" line, no crash.
  A `?w=` load leaves the clean id in the address bar rather than expanding the
  source into the hash (which would leak it past a later `unlisted → private`).
- **Share URL is `/apps/display/?w=<id>`**, not a pretty `/w/<id>`: measured
  against the live instance, PocketBase serves `pb_public/` with an index
  fallback (an unknown path returns the root `index.html`), so `/w/<id>` can't
  route without a `pb_hooks` handler — an infra change for no gain over a query
  param on a file that exists. Decisions recorded under
  [DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage).

**Verified.** Chris drove the **live** instance with a real Google sign-in:
signed in, created workouts, they persist, listed and reopened, inspected in the
SQLite DB. The rest was verified headless against the live `auth-methods`
endpoint and a faithful local fake of the `workouts` collection — the callback
token exchange, Save create-vs-update (one record, not two), Save as copy,
open-into-editor, rename, delete, visibility changes, share links resolving for
`unlisted` and 404ing for `private` to a stranger, the signed-out builder and
the board's `#<source>` hash both unregressed, both themes, clean console.
No `deploy-web.mjs` change was needed — both new files ride the wholesale
`apps/` copy.
*Touched: `apps/shared/pocketbase.js` (new), `apps/builder/auth-callback.html`
(new), `apps/builder/builder.js` / `builder.css` / `index.html`,
`apps/display/board.js`, `deploy/README.md` §8 + "## 10". No `packages/core`,
grammar or spec change.*

*Post-epic, Chris thinking out loud the same day (not scheduled): `@id` ↔
record-id correlation, account namespacing as a workout-id prefix, the board's
**Edit** button round-tripping into the builder instead of resetting the board,
an "open on the board" action for saved workouts, and a builder layout rethink.
Captured in [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs
and layout", with a companion design-critique pass the same day feeding the
smaller entries in that file's topic sections.*

---

## The builder layout redesign — stages R1–R10

*Chris chose direction **C (Document + margin)** off the Claude Design canvas
(visual brief: [../topics/builder-ux.md](../topics/builder-ux.md) "### The
layout redesign"). Broken into ten ordered stages **R1 → R10**, each a landable
branch sized for its own session, each spawning the next when it landed. All
app-level (`apps/builder/*`, plus `packages/core/src/edit.ts` for R2) — no
grammar or spec change. Kept together in `current.md` while in flight, struck
stage by stage; moved here as one section when R10 landed **2026-08-31**, the
way the deployment epic 18–20 is grouped. The old builder-UX chain items it
absorbed — 12 ↔ R2, 16 ↔ R3, 17 ↔ R9, 15(a/c/d) ↔ R3 + R10 — are closed with
it; the detailed write-ups for 12, 15 and 16 follow the stage list. **15b**
(the board rendering preamble lines as body rows) was always independent and
landed separately **2026-08-31** (`9bbda82`) — its write-up (part (b)) is kept
below. **Item 15 is now fully closed** (a/d ↔ R10, c ↔ R3, b ↔ `9bbda82`).*

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

- ~~**R4 — Reads-as tab: the compressed run view.**~~ **Done 2026-08-31**
  (`f8cb0a8`). New `renderReadsAs()` over `#view-reads`: (a) the run grouped by
  block, read off `parse().workout.body` (not cue-by-cue) — one titled group per
  top-level block, header label = the raw source line as written (`:` and any
  inline body dropped, so rounds / scheme / window are stated once by the
  header), direct steps + rests collapsed onto one `·`-joined inline row
  (`Air Squat ×10 · 200m Run · rest 1min`), nested blocks / `every` overlays
  recursed with a left rule; synthesised label fallback when a header has no
  physical line. (b) A **"show every cue (N)"** toggle to the full, uncapped
  per-cue list — the same rows `#steps` builds, now via a shared `cueRow()`
  helper; state in `localStorage['wdl.reads-expanded']`, read fresh each paint
  (survives re-render / tab switch / reload). `renderReading` still owns
  `#summary` / `#diagnostics` / `#steps` untouched; compile failure degrades to
  a short message in `#view-reads`. Both themes; CSS is existing tokens only. No
  core change — suite 2051 passing, 1 pending. *Touched:*
  `apps/builder/builder.js`, `builder.css`.

- ~~**R5 — Goals rule-management UI in the Analysis tab.**~~ **Done 2026-08-31**
  (`47fd26b`). The goals controls are now a titled
  `<section class="goals-block">`: heading, a `.goals-bar` holding `#goal-pick`
  (now a bordered control) beside the `.goal-tools` toolbar (Edit rules / Open… /
  Save as… / `.wdlg` / Delete), the `#goal-text` `.wdlg` editor revealing inline
  beneath, and `#goal-errors` / `#goal-notes` / `#findings` grouped in a
  `.goals-out` output region. **DOM move + CSS only** — every id stable, every
  `builder.js` handler untouched (all bound by id, none container-scoped);
  `.goal-tools` carries its own flex now the `.row.tight` wrapper is gone; hidden
  `<input id="goal-file">` stays in the DOM. Both themes, existing tokens only —
  no `--kind-*` / `--rail` touch. Verified light + dark: picker options, Edit
  rules reveal/hide + live re-check, Save as… → picker, Delete shows for a saved
  set and removes it; summary band / `#steps` / `#diagnostics` / body map /
  Reads-as unchanged. No core change — suite 2051 passing, 1 pending. *Touched:*
  `apps/builder/index.html`, `builder.css` (no `builder.js` needed).

- ~~**R6 — Analysis tab: per-block muscle "adds".**~~ **Done 2026-08-31**
  (`895404a`). Below the body map, one terse `.adds-line` per top-level named
  section — *"warmup adds: glutes, quads, chest, triceps, …"* — naming the
  distinct muscles that section brings in (primary first in workout order, then
  secondary marked "(light)", capped at 6 with "…", "—" when a section has no
  attributed movement). App-side derivation in a new `renderBlockAdds()` called
  from the top of `renderBody()`: filters `workout.body` for
  `n.node === 'block' && n.type === 'section'` and scopes
  `exposures(timeline).list` by `e.path[0]` matched to the section's index in
  `timeline.root.items` (found by source line, not position). Nothing renders
  for a sectionless workout. New `#block-adds` container between `#body-hint`
  and the goals block; `--ink` / `--dim` / `--rule` only, both themes. No core
  change — suite 2051 passing, 1 pending. *Touched:* `apps/builder/builder.js`,
  `builder.css`, `index.html`.

- ~~**R7 — Movement palette modal: filters + insert.**~~ **Done 2026-08-31**
  (`d1a89ce`). The palette is now a summoned `<dialog id="palette-modal">` —
  opened by **⌘K / Ctrl-K** anywhere, by **+ movement**, and by **Enter on an
  outline row** (replacing the row when it is blank, else inserting after it).
  Picking a movement lands `lineFor(m)` at the focused row via the existing
  write-back (`replaceLogical` when blank, else `insertAfter`) and closes;
  Esc (`<dialog>` `cancel`) and backdrop click close through a `closePalette`
  that hands focus back to the editor, and Esc while composing a set exits
  compose mode first (the drawer's old Esc). All three filters still combine
  inside it — text (`#search`), muscle chips (`chosenMuscles` / `worksAll`,
  AND), saved set (`#set-pick`) — every id stable, so `renderPalette` /
  `renderMuscleChips` were untouched. `#repertoire` set management still lives
  inside the modal, unchanged pending **R8**. Retired: `#drawer` /
  `#drawer-backdrop` / `.drawer*` CSS / `setDrawer` / the `#palette-toggle`
  header button + `.ghost` CSS / the `wdl.palette-open` bootstrap. ⌘K is scoped
  and only `preventDefault`s when it should open, and no-ops mid-IME. No core
  change — suite **2051 passing, 1 pending**. *Touched:*
  `apps/builder/index.html`, `builder.css`, `builder.js`.

- ~~**R8 — Palette modal: set creation / the repertoire.**~~ **Done 2026-08-31**
  (`356e84f`). The repertoire is folded into the palette modal as a first-class
  **Sets** section, not a buried `<details>`: `<details id="repertoire">` /
  `<summary>` retired for `<section id="repertoire"><h2>Sets …</h2>` — a
  full-bleed bar in the same treatment as the "Movements" head, the New set /
  Save showing / Export / Import strip, then a scrolling (`max-height`)
  `#set-list`. Every bound id stable (`#set-new` / `#set-save` / `#set-export`
  / `#set-import` / `#set-list` / `#set-pick` / `#set-file` /
  `#repertoire-count`); the three now-meaningless `el('repertoire').open = true`
  lines removed. New `shownMovements()` factored out of `renderPalette`; new
  `addShowingToSet(name)` + a per-card `⊕` affordance that folds the movements
  the palette is currently showing into that set — the "from the current
  results" half of composing, alongside the checklist toggle.
  `renderSets` / `renderSetList` / `renderSetCard` / `renameSet` /
  `addSetToOutline` / `setsChanged` unchanged in behaviour;
  `localStorage['wdl.sets']` store + the `{format:'wdl-movement-sets',
  version:1, sets}` export/import envelope unchanged. No core change — suite
  **2051 passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `builder.css`, `builder.js`.

- ~~**R9 — Text tab: trap Tab + syntax highlighting** *(= chain item 17).*~~
  **Done 2026-08-31** (`05efea0`). `#text` is wrapped with `<pre id="text-hl">`
  in a positioned `.text-wrap`; the textarea paints `color: transparent;
  caret-color: var(--ink)` over the layer, which holds the same text re-tokenised
  on every `input` — one `--kind-*` colour per line kind (R3's shared palette),
  classified lexically by a new `textLineKind()` mirroring the Outline's
  `data-kind` vocabulary (title / directive / comment / section / header / step /
  rest). Every text-metric property is shared between `#text` and `#text-hl` in
  one CSS rule with `scrollbar-gutter: stable` on both, so the caret sits on the
  layer's glyphs under wrapping and at every scroll offset (a `scroll` listener
  copies `scrollTop`/`scrollLeft`; verified `scrollHeight` parity with a forced
  scrollbar). The layer repaints on the `render()` / outline-row write-back paths
  via a new `paintText()` (each `el('text').value = text()` → `paintText()`) and
  on user input via `paintTextHl()` in the `input` handler. A new `keydown`
  handler on `#text` traps **Tab** (two spaces at caret), **Shift-Tab** (drop up
  to two leading spaces), multi-line **Tab/Shift-Tab** (indent/dedent every
  touched line, selection preserved) and **Enter** (carry leading indent, +2 when
  the line ends `:`); every branch edits through
  `document.execCommand('insertText')` (with a `setRangeText` fallback), so
  native undo and the `#dirty` badge are untouched and the existing `input`
  handler re-splits `lines`. `setEditorView` unchanged. No core change — suite
  **2051 passing, 1 pending**. Item 17 is shipped. *Touched:*
  `apps/builder/index.html`, `apps/builder/builder.css`, `apps/builder/builder.js`.

- ~~**R10 — Directive metadata block + `@`-key type-ahead** *(= chain item 15
  parts a/d).*~~ **Done 2026-08-31** (`5f79ea3`). **15a:** a read-only metadata
  block at the top of the Analysis tab (`#directives` in `index.html`, painted
  by a new `renderDirectives()` called from the top of `renderReading()`) lists
  the `@key value` preamble off `parse().workout.directives` — `wdl` / `id` /
  `date` / `author` and any `@x-…` extension as verbatim key/value rows, `tags`
  split on comma into chips. Repaints on every edit path and survives a compile
  failure below it (it is read off the parsed tree, not the run); hidden
  entirely when the workout sets no directives — no empty block, no heading.
  Bordered aside with the shared `--kind-directive` accent, both themes.
  **15d:** on a zero-indent `@` outline row with the caret still in the key, the
  movement suggestion dropdown offers the builder-held directive-key list
  instead (`@wdl` / `@id` / `@date` / `@tags` / `@author` / `@x-`, one
  description each) — a parallel branch in `openSuggestions()` +
  `pickDirectiveKey()`, reusing the `.suggestions` widget and its
  Arrow/Enter/Escape handling. Picking fills the key (`@id `, caret past the
  space; `@x-`, caret past the dash). Guarded on raw-line indent so a `@ 40kg`
  load fragment never triggers it; movement suggestions on step rows unchanged.
  **15b** stays open (board-side). No core change — suite **2051 passing, 1
  pending**. *Touched:* `apps/builder/index.html`, `builder.css`, `builder.js`.

### Redesign detail write-ups (12, 15, 16)

The full analysis behind the absorbed chain items, moved here with the stage
list. **12** ↔ R2, **16** ↔ R3, **15** parts a/d ↔ R10, part c ↔ R3, and
**part (b) ↔ `9bbda82` (2026-08-31)** — the board-side item, landed separately.
Its analysis is kept here beside the other parts so item 15 reads whole.

- ~~**12 — The outline shows no row for a comment; they exist only in the Text
  tab.**~~ **Done 2026-08-30 as R2** (`973d80a`) — synthesised comment rows +
  comment-aware `spans()`/`move`/`shift` in `edit.ts`. Write-up kept for the
  reasoning. *High priority (Chris, 2026-08-29).* `renderOutline` walks
  `readLines(text())`, and `readLines` (`packages/core/src/lines.ts`) strips
  every comment off its own line and folds it into the `comments: string[]` of
  the next real line — an own-line comment is never a node in the line tree, so
  the outline drew no row for it; `readLines` also emits a file-level trailing
  pseudo-node (`{ text: '', line: 0, comments }`) for comments with no following
  line. Consequences: a `//` line could not be seen, added, edited or reordered
  in the GUI; the outline silently misrepresented a file that had them.
  **Shipped:** synthesised comment rows (the preferred approach — keeps "the
  outline *is* the file"), a `.node.comment` row for each `comments[]` entry
  above its line's row and a trailing block for the pseudo-node, written back
  through a comment-aware span model in `edit.ts` (`spans()` gives each own-line
  comment its own single-line span; `move`/`shift` took a dedicated comment
  path). Trailing comments on a content line stay in that row's input.
  `DEC-005` ("the text is the document") honoured — structural edits splice
  `lines` in place.

- ~~**16 — The outline should show what kind of line each row is.**~~ **Done
  2026-08-31 as R3** (`d8edde3`) — text kept for the reasoning. *High priority
  (Chris, 2026-08-29), from driving the builder.* Before R3, `renderOutline`
  marked a row `.block` (ends in `:` or has children), `.comment` (starts `//`),
  or `.bad` (a parse error on that line) — nothing told a **title** (`#`), a
  **directive** (`@`), a **rest** (`rest …`), or a plain **step** apart, and
  there was no at-a-glance indicator of the kind. **Shipped:** every row gets a
  `data-kind` and a thin coloured left border on `.line-wrap`, one `--kind-*`
  colour per kind (title / directive / section / header / step / rest /
  comment). Kind is driven off the parsed node (`kindOf` map from
  `parse().workout.body`) where the parse distinguishes it, off raw text only
  for the preamble kinds (title vs directive vs comment). `.bad` keeps its kind
  marker under the red border, so a broken step reads as "step, and broken".
  The `--kind-*` tokens are defined in both themes and are shared with R9's
  Text-tab highlighter, so the two views read as one visual language.

- **15 — Directives (`@id`, `@tags`, …) are first-class metadata.** *High
  priority (Chris, 2026-08-29), from driving the builder + board.* `parse`
  collects every `@key value` line into `workout.directives` (a
  `Record<string,string>` — `packages/core/src/parse.ts`; values never
  interpreted). Four parts, all app-level:

  **(a) A metadata block in the builder** — ~~above or beside the `title / cues
  / …` rows, a small block listing the directives that are set — `id`, `tags`
  (chips), `date`, `wdl`, any `@x-…` verbatim; shown only when non-empty.~~
  **Shipped with R10 2026-08-31** (`5f79ea3`): `#directives` at the top of the
  Analysis tab, `renderDirectives()` off `parse().workout.directives`.

  **(b) ~~The board renders every preamble line as a body row.~~ Done
  2026-08-31** (`9bbda82`). Was: `draw()` built one row per raw source line and
  special-cased only blank / `//` lines, so `@wdl` / `@id` / `@date` / `@tags`
  and the `# title` all rendered as rows at the top of what the athlete reads
  mid-set, and `@id` was never stripped. **Shipped:** `preambleEnd()` finds the
  leading run of blank / `//` / `@key` / `# title` lines; within that run only,
  a zero-indent `@key` line (matched as core's `tryDirective` does,
  `/^@[A-Za-z][\w-]*(?:\s|$)/`) gets a `.preamble` class and is hidden in CSS
  (`display: none`). The **preferred shape from the write-up** — the row is
  still built, so `dataset.line` stays 1:1 with the source and `paint()`'s
  cue-line matching + scroll are untouched; a mid-body `@ 40kg` fragment is
  indented and past the preamble, so never in scope. `renderMeta()` lifts
  `@id` (verbatim) and `@tags` (comma-split → chips, lighter than the
  builder's block) into a new `#meta` strip under the bar, shown only when the
  workout sets one of them. The workout body renders byte-for-byte as before.
  *Touched:* `apps/display/board.js`, `board.css`, `index.html`. No core change
  (suite 2051 passing, 1 pending). **Open question for Chris:** the `# title`
  was kept as the first board row (readable whiteboard content, not metadata
  noise — the reversible default the write-up allowed). If Chris would rather
  it move into the `#meta` strip / bar too, that is a small follow-up on
  `apps/display/*`.

  **(c) `@` lines are called out in the outline.** **Shipped with R3
  2026-08-31** (`d8edde3`): a zero-indent `@` row is classed
  `data-kind="directive"` and renders as a dim, smaller preamble block with its
  own `--kind-directive` left marker.

  **(d) Type-ahead for directive keys.** ~~When an outline row's text starts
  with `@` at zero indentation and the caret is still in the key, offer the
  recognised keys — `@wdl`, `@id`, `@date`, `@tags`, `@author`, and `@x-` for
  an extension attribute; a builder-held convention, not grammar-derived.~~
  **Shipped with R10 2026-08-31** (`5f79ea3`): a parallel branch in
  `openSuggestions()` + `pickDirectiveKey()`, reusing the `.suggestions` widget.
  `@tiebreak` is deliberately absent — it is a mid-line step marker (spec §9.6).

---

**21. ~~One clean command surface for the dev lifecycle.~~ DONE 2026-08-31**
([DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson)).
*Raised by Chris the same day.* The routine actions worked but were scattered
across `npm --prefix packages/core test`, a dozen `node scripts/*`, a deploy
needing an env var, the golden regen and the canonical rebuild — documented in
[../topics/running-it.md](../topics/running-it.md) but with no memorable
entrypoint. **Shipped:** a root **`Makefile`**. `make` (or `make help`,
auto-listed from `##` comments) shows the targets — `test`, `build`, `serve`
(`PORT` overridable, depends on `build`), `registry` (the whole
`build-canonical.ts` pipeline — one atomic target, never a step alone),
`goldens` (regenerate + `git diff --stat`), `aliases`, `corpora`, `deploy` /
`deploy:dry`, `clean`, and `install` (prints "nothing to install"). Every
target is a thin wrapper over the command that already existed; the raw `node
scripts/*` forms still run directly, and the situational ones that take
arguments (`find-duplicates`, `import-movement-curation`, the `wdl` CLI) are
left out of it by design. **A root `package.json` `scripts` block was the
alternative and was rejected** — the repo is install-free on purpose
([DEC-003](../topics/settled-decisions.md#dec-003-src-is-portable-and-is-handed-its-data)
/ [DEC-008](../topics/settled-decisions.md#dec-008-ohm-js-is-vendored-imported-by-relative-path):
no `node_modules`, no lockfile, `ohm-js` vendored) and a root `package.json`
invites `npm install` + a `package-lock.json`; `make` adds nothing to install.
Verified every target from the worktree root with nothing installed. *Touched:*
new `Makefile`; `docs/context/topics/running-it.md` (command list now leads
with the `make` targets), `settled-decisions.md` (DEC-017), `decisions.md`.
No code change.

---

**13c. ~~The builder's `»` panel appends a laterality mode instead of replacing
one, and doubles it on re-pick.~~ DONE 2026-08-31** (`02d819d`). *One strand of
item 13, shipped alone — no decision needed. **13b** landed 2026-08-31
(`cf3c47f`, below); **13a-curation** landed 2026-08-31 (`71f9469`); **13a** (the
`»` panel rendering the axis) landed 2026-08-31 (`1ffc8d0`, above), which
**closed item 13 entirely**.* `applyModifier`
with `position: 'title'` spliced the chosen laterality text in after the
movement title without checking the line, so picking `(split)` when `each side`
was present produced `Dumbbell Snatch (split) each side` (two contradictory
modes) and picking a mode twice produced `(split) (split)`; the measured-output
picks (`position: 'end'`) had the same double-append. **Shipped:** laterality
modes and measured output are each mutually exclusive, so a pick now strips
every existing token of that class from the line first — the parenthesised
laterality forms (`(both)` / `(split)` / `(per-side)` / `(total)`, matching the
grammar's `lateralityWord`), the inline `each|per <limb>` forms (matching
`trailingQualifier -- limb`), and the `, count cal|calories|distance|reps` comma
modifier — then inserts the pick, or, when the mode already on the line is
re-picked, clears it (toggle off). A line left doubled by the old behaviour
cleans up in a single pick. Builder-only; no core change; suite 2051 passing, 1
pending. Verified by driving the builder against `Dumbbell Snatch`
(`laterality: ["split","per-side"]`) and `Row` (`measures`): replace in both
directions, re-pick toggles off, diagnostics clean after each. *Touched:
`apps/builder/builder.js` only.*

---

**11. ~~A bare-word block header is an inert section, not an "unrecognized
header" error.~~ DONE 2026-08-31** (`70a1852`). *High priority (Chris,
2026-08-29). Grammar + `packages/core`, not builder/layout.* Spec §2 always said
a section could be *"any custom label"*, but the grammar read only the fixed
eight in `sectionWord`; anything else — `Barbell movements:` — fell through
`headerName` to `headerKind_unknown`, a `type: 'sequence'` with a name, and
`parseHeader` pushed `unrecognized block header "…"`, an **error** in `wdl check`
and a red line in the builder. Execution was already identical to a section
(`format.ts` writes the name back, `timeline.ts` defaults to `sequence`); only
the diagnostic was wrong.

**Shipped:** a head that is entirely a bare label — letters, spaces and hyphens,
no digit anywhere, and not opening with a kind-word — parses as
`type: 'section'`, the inert labelled container the fixed eight already produce.
`Barbell movements:` inside `3 rounds for time:` is now a clean visual layer with
no complaint, and the rounds still cycle every descendant regardless of the
section.

*Four decisions Chris made (the fourth mid-implementation):*
- **Diagnostic, not silent.** Read as a section **and** emit a `note`
  (claims-nothing severity, [DEC-010](../topics/settled-decisions.md#dec-010-unknown-text-is-held-inert-and-said-out-loud-as-a-note))
  — *"read `Barbell movements` as a section label"*. A coined heading is one typo
  from a kind-word; the fixed eight are silent only because they are a closed
  vocabulary. Lives in `validate.ts` (`code: 'custom-section'`), beside
  `adopted-block` — the same place every other `note` lives — not in `parse.ts`,
  which has no note channel.
- **Case preserved verbatim.** `blockKind_section` still lower-cases the fixed
  vocabulary; `Barbell Movements:` keeps its capitals.
- **Digit anywhere keeps it an error** (`3 rounds of madness:` stays an error),
  **plus a narrow exclusion** ruled on when the first `make test` showed the
  conflict: a head that *opens* with a kind-word missing its parameter — `RFT:`,
  `rounds:`, `every:`, `build:` — stays the reported error spec §5.2 makes it.
  The miss loses how the block executes, which is the line DEC-010 already drew;
  the alternative was overriding spec §5.2 and its pinned `rft with no count`
  case, which Chris declined.
- **A new grammar production** (`customSection`, tried after `sectionWord` fails,
  with a `kindLead` guard), so the grammar still owns what exists
  ([DEC-006](../topics/settled-decisions.md#dec-006-the-grammar-is-written-in-peg-notation-carries-no-actions) /
  [DEC-007](../topics/settled-decisions.md#dec-007-the-grammar-is-an-ohm-grammar-semantics-in-a-separate-file)).
  `headerKind` gains a `-- section` case between `-- known` and `-- unknown`.

**Must-not-break, preserved:** `Barbell movements, 3 rounds:` still takes the
`3 rounds` after the comma and reports the leftover label — the same "three
rounds *and* an error" as `cap 12min, 3 rounds:` (spec §11.1). `headStatesKind`
is unchanged, so a `section` head leaves the kind slot open for a comma to fill;
once a kind fills it the block is a real `repeat` with `type !== 'section'`, and
`parse.ts`'s existing guard reports the name. No `&& !isBareLabel` needed — the
grammar production sets the type, so the guard already gates it.

*Touched:* `spec/grammar-0.1.ohm` (`customSection` + `kindLead` + `emomWord`,
`headerKind`), `packages/core/src/grammar/block-semantics.ts`
(`headerKind_section`), `packages/core/src/parse.ts` (comments only — no
condition change), `packages/core/src/validate.ts` (`custom-section` note,
`FIXED_SECTIONS` set), `spec/spec-0.1.md` §2 / §5.1 / §5.2 / §11.1,
`packages/core/test/{grammar,validate,errors}.test.ts`,
`packages/core/test/golden/vocabulary.{ts,json}`.

**Verification:** suite **2049 → 2060 passing** (1 pending, pre-existing `10x
Curl`). Delta: the two pinned cases that were failing on the widened reading now
pass; +2 grammar tests (a digit-bearing unread header, a kind-word-with-no-param
header), +2 validate tests (the note fires / is not an error), +5 vocabulary
cases (`block/section` custom-label forms + `block/other` kind-word-no-param).
`errors.test.ts` switched two `frobnicate:` cases to `frobnicate 5:` to keep
exercising the error path. Block-headers harvest **250 → 254**. Corpus
unchanged: `interpretations.json` regenerates byte-identical,
`workouts.canonical.json` only its date stamp (not committed — date-only).
Builder driven both themes: diagnostics pane shows only the note, the outline
nests the section with the section accent, "reads as" cycles every descendant
across both sections three times, `Canonicalise` round-trips the label verbatim.

---

**13b. ~~The per-side laterality form is bare (`each arm`) where `(split)` is
parenthesised — Chris wants parity.~~ DONE 2026-08-31** (`cf3c47f`,
[DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised)).
*One strand of item 13; **13a-curation** (the `lateralityAxis` field) landed
`71f9469` (below), and **13a** (the `»` panel rendering it) landed `1ffc8d0`
(above) — item 13 is now closed entirely.*
`format.ts` wrote `both`/`split` as ` (both)` / ` (split)` but
`per-side` as a bare ` each side` — the asymmetry was just the two grammar forms
(`laterality = "(" lateralityWord ")"` vs `trailingQualifier -- limb`), and spec
§4 had made the bare form deliberate ("reads as part of the prescription").

**Chris's call:** parenthesise the per-side form — `(each arm)` — and teach the
parser to *read* the parenthesised spelling, which it could not before
(`(each direction)` fell to `unreadableParen` and was held as unknown). Also
**`direction` joins the axis vocabulary** (`limbWord`) — a rotation performed
once each way, which is what `Around The Worlds (each direction)` means. `total`
still maps to `(split)` on output; `(both)` stays distinct; bare `each arm` /
`per leg` still parse (input tolerance), canonical output is the parens.

*Touched:* `spec/grammar-0.1.ohm` (`laterality` → `-- word` / `-- perSide`
cases, `limbWord += direction`), `packages/core/src/grammar/step-semantics.ts`
(`laterality` splits into `laterality_word` + `laterality_perSide`),
`packages/core/src/format.ts` (`per-side` → ` (each ${limb})`), `spec/spec-0.1.md`
§4 / §7 / §11.1, `packages/core/test/{grammar,corpus2}.test.ts`,
`packages/core/test/golden/vocabulary.{ts,json}`, and **9 corpus `.wdl` files
reformatted `each X` → `(each X)` via `wdl fmt`**.

**Verification:** suite **2060 → 2063 passing** (1 pending, pre-existing `10x
Curl`). The pinned `12 Around The Worlds (each direction)` grammar case flips
from held-unknown to `laterality: 'per-side', limb: 'direction'`. Corpus move
measured precisely: `workouts.canonical.json` changed **only the 9 `text`
fields** (+ its date stamp) — **0 AST changes, 0 summary changes**, so nothing
about how any workout is *understood* moved; `interpretations.json` regenerates
byte-identical; `movements.canonical.json` / `dedupe-audit.json` were date-only
churn and reverted. All 190 corpus files remain their own canonical fixpoint.
Builder not driven — no app code changed (that was 13a, `1ffc8d0`).

---

**13a-curation. ~~`around-worlds` and its neighbours have no laterality data, so
the `»` panel offers nothing.~~ `lateralityAxis` field + one vetting entry —
DONE 2026-08-31** (`71f9469`). *The last data/schema strand of item 13; the
builder `»` panel that renders it landed as **13a** (`1ffc8d0`), closing
item 13. A full laterality curation sweep is unscheduled — Chris will scope it.* Chris's calls, from the
conversation: the axis a per-side count runs across is **a curated
movement-registry field** at the root of an entry, named **`lateralityAxis`**
(camelCase, matching `defaultLaterality`), an enum over `arm | leg | side | hand
| direction` (the set `limbWord` carries since 13b), and it must be curatable
via `import-movement-curation.mjs`. For now, apply it to **`around-worlds` only**
— enough to vet the implementation; the sweep comes later.

*Shipped:*
- `packages/core/src/fold.ts` — `MovementEntry.lateralityAxis?`. Advisory,
  nothing in core consumes it (the builder does, as of 13a `1ffc8d0`).
- `scripts/import-movement-curation.mjs` — a "Laterality axis" CURATE column
  (position 31), validated against the enum and refused unless the row's
  laterality modes include `per-side`. An export from an older workbook now
  fails the header check, which is the script's intended fail-loud behaviour.
- `scripts/build-movements.mjs` — `handKept` (which already carried
  `aliases`/`sameAs` past the free-exercise-db classification re-read) now also
  carries `laterality` / `defaultLaterality` / `lateralityAxis`, so a curated
  laterality fact on a free-exercise-db-sourced record reaches the canonical
  corpus instead of being silently dropped — the same silent-drop the
  `handKept` comment was written to close. Field added to both allowlists.
- `registry/movements.json` — `around-worlds`: `laterality: ["per-side"]`,
  `defaultLaterality: "per-side"`, `lateralityAxis: "direction"`. Hand-applied
  (the audit workbook is not checked in), but verified against the script:
  running it on a synthetic CSV produced the identical edit.
- `registry/movements.canonical.json` — only `around-worlds` changes (gains the
  three fields). `workouts.canonical.json` / `dedupe-audit.json` were date-only
  churn, reverted.
- Docs: `movement_registry_design.md` §2.2 / §6, `running-it.md`.

*Verification:* suite **2063/2063** (1 pending, pre-existing). `fold.test.ts`'s
`canonicalRegistry().validate()` unaffected by the new field. Builder driven
once: `12 Around The Worlds` — the `»` caret now shows (it was hidden, no
laterality data), and `fetch('/registry/movements.json')` in the page carries
`lateralityAxis: "direction"` on the record, so 13a has the data to render.
**Interim effect:** the panel offers the generic bare ` each side` for Around
The Worlds until 13a wires `movementModifiers` to the axis — noted in
`current.md`.

---

**13a. ~~The builder's `»` panel renders `lateralityAxis`.~~ DONE 2026-08-31**
(`1ffc8d0`). *The last open strand of item 13 — builder-only, no decision
pending (the field name/shape landed with 13a-curation `71f9469`, the
parenthesised per-side form and its parser read with 13b `cf3c47f`). **This
closes item 13 entirely** — 13c `02d819d`, 13b `cf3c47f`, 13a-curation
`71f9469`, 13a `1ffc8d0`.* `movementModifiers(entry)` in
`apps/builder/builder.js` built the `»` panel's `per-side` option as the pre-13b
bare ` each side` and never looked at `entry.lateralityAxis`, so every per-side
movement showed a generic "each side" even where the axis is `arm` or
`direction`.

**Shipped:**
- `movementModifiers` — the `per-side` option's inserted text is now
  `` `(each ${entry.lateralityAxis ?? 'side'})` `` (parenthesised per DEC-019,
  axis-aware with a `side` fallback). Its label is `full count each <axis>` when
  the axis is curated, `full count per side` otherwise. `(split)` / `(both)`
  unchanged.
- `LATERALITY_RE` (the exclusive-class strip `applyModifier` runs before a
  laterality pick) gained the parenthesised per-side form
  `\((?:each|per)\s+(?:arm|leg|side|hand|direction)\)` and `direction` in its
  bare `each|per <limb>` branch — so a previously-inserted `(each arm)` /
  `(each direction)` is recognised as the same exclusive class and a re-pick
  toggles it off / a different pick replaces it cleanly, no doubling.
  `lateralityMode` already folded every `(each …)` spelling to `per-side`; only
  its doc comment changed.

Builder-only; no `packages/core` change; suite **2063/2063** (1 pending,
pre-existing `10x Curl`) — unchanged, nothing in the core suite covers
`movementModifiers`.

**Verification — drove the builder, both themes:** `12 Around The Worlds`
(`lateralityAxis: "direction"`) → `»` offers `(each direction) (default) — full
count each direction` + `Equipment: dumbbell`; clicking inserts
`12 Around The Worlds (each direction)`; diagnostics clean; `Canonicalise`
round-trips it verbatim (not pluralised into `(each direction)s`). Re-pick →
toggles off. Pick after `(split)` on a `split`+`per-side` movement
(`Dumbbell Snatch`) → replaces, no doubling. `bulgarian-split-squat` (per-side,
no axis) → panel falls back to `(each side)`, inserts cleanly on a singular
name. Both `prefers-color-scheme` themes checked.

*Noted, out of scope — pre-existing `applyModifier` plural bug (`02d819d`, 13c):*
picking a laterality option on a row whose movement name is typed **plural**
(`Dumbbell Snatches`) while the registry title is singular strands the plural
suffix after the inserted token — `Dumbbell Snatch (each side) es`. The
`matchLen` truncates to `entryTitle.length` in the title-insert branch. Affects
the bare form identically; independent of 13a. Recorded in
[../topics/builder-ux.md](../topics/builder-ux.md).

*Touched:* `apps/builder/builder.js` only; docs:
`docs/context/tasks/{completed,current}.md`,
`docs/context/topics/{builder-ux,settled-decisions}.md`,
`docs/context/current/recent-changes.md`.

---

## Movements in the database — Phase 1 (M0–M7)

*Raised 2026-08-31 (see [../topics/builder-ux.md](../topics/builder-ux.md)
"Accounts, IDs and layout"): Chris, trying to run the first laterality pass
through `curation-sheet.csv`, found the spreadsheet unworkable and realised
movement create/edit wants to be an in-app GUI hit **while building a workout**.
Direction: the curated `registry/movements.json` layer moves into a PocketBase
`movements` collection ([DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)),
edited through a reusable widget; ingestion loads the JSON in, a reviewable dump
writes it back to the repo, `build-canonical.ts` and `packages/core` stay
untouched (`registry/movements.json` remains the offline file they read).
**Phase 1 is global (admin-edited) movements only**; Phase 2 (user-scoped) is in
[deferred.md](deferred.md). Broken into eight tasks, each a landable branch
sized for its own session, each spawning the next — kept together in `current.md`
while in flight, moved here as one section when **M6 landed 2026-09-01** and
closed the epic. Execution order as worked: M0+M2 → M1 → M7 → M3 → M5 → M4 → M6.
All of M0–M7 landed; nothing in `packages/core`, the grammar or the spec was
touched by any of them, and the suite held at **2064/2064, 1 pending**
throughout.*

Grounding facts, kept because they are what the tasks were built against:

- The **curated layer** is `registry/movements.json` (~972 entries: `id`,
  `title`, `aliases`, `muscles`, `pattern`, `force`, `mechanic`, `equipment`,
  `laterality`, `defaultLaterality`, `lateralityAxis`, `measures`, `load`,
  `implements`). This is what moved into the DB.
- `registry/movements.canonical.json` is **built** from external sources by
  `scripts/build-canonical.ts` and is *not* ingested — that pipeline keeps
  running; the DB replaces the curated seed it merges in.
- `packages/core` reads `registry/movements.json` directly
  (`packages/core/src/env.ts`) and stays install-free and offline. The apps go
  through `apps/shared/pocketbase.js`, a hand-rolled client hitting `/api/*`
  same-origin: in production that is PocketBase (it serves the apps from
  `pb_public/`); under `make serve` M7's mock answers `/api`.
- PocketBase v0.40.1 on the DreamHost VPS, `~/pb/`, migrations in
  `deploy/pocketbase/pb_migrations/`, the `workouts` collection as the model.

**M0 — Design note: read path + dump cadence.** DONE 2026-08-31 (`ea2a64f`),
written up as
[DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump).
Production apps read movements from the PocketBase `movements` collection via the
same `/api/*` the client already uses; `packages/core`, its tests and
`build-canonical.ts` keep reading `registry/movements.json` untouched; local
`make serve` answers `/api` from a mock (M7), and `registry/movements.json` **is**
the movements fixture; M4's dump keeps that file current from the live DB. The
dump → load → dump round-trip requirement was left open in the DEC and closed by
M4.

**M1 — `movements` PocketBase collection + migration.** DONE 2026-08-31
(`00c29a5`). `deploy/pocketbase/pb_migrations/1756800000_create_movements.js`
creates a `base` collection `movements` via `new Collection({...})`: one column
per per-movement field — `movementId` (text, required — the registry `id`, not
`id`); `title` (text, required); `force`/`mechanic`/`load`/`lateralityAxis`/
`defaultLaterality` as `select` (single); every non-scalar field (`aliases`,
`muscles`, `pattern`, `laterality`, `measures`, `implements`, `equipment`,
`related`, `sameAs`) as `json`; `source` (text); plus `scope` (select
`global|user`, required) and `user` (relation → `users`, nullable, cascadeDelete,
unused in Phase 1) and `created`/`updated` autodates. Unique index on
`movementId` (M3's idempotency key), plain index on `scope`. Rules: list/view
`scope = "global"`; create/update/delete `@request.auth.admin = true` (the field
M2 added). `down` deletes the collection. Verified locally against a real
PocketBase v0.40.1 binary. **Still to do on deploy:** glance at the collection in
the admin UI on the box (`deploy/README.md` §7b).

**M2 — Admin designation.** DONE 2026-08-31 (`ea2a64f`).
`deploy/pocketbase/pb_migrations/1756700000_add_users_admin.js` adds a
`bool admin` field to the `users` collection, so M1's write rule can be
`@request.auth.admin = true`. Verified locally against a real PocketBase v0.40.1
binary (up + down clean). **Still to do on deploy:** set Chris's own `users` row
`admin: true` in the admin UI — the migration can't know his id
(`deploy/README.md` §7a).

**M3 — Ingestion: `registry/movements.json` → DB.** DONE 2026-09-01 (`0917705`).
`scripts/movements-to-db.mjs` (`make movements:load`) upserts every entry over
`/api/collections/movements/records`: bulk-fetches the collection once
(`perPage=500`), keys on `movementId`, `POST`s the absent and `PATCH`es only the
columns that differ — a field the entry lacks is omitted on create and cleared
(json→`null`, scalar→`""`) on update, so M4's dump round-trips. A re-run writes
nothing; prints a `created`/`updated`/`unchanged` tally; `--dry-run` reports
without writing. Every row `scope: "global"`, `user` unset. Target via `--api` /
`WDL_PB_URL` (default `http://localhost:8081`); **prod writes need admin auth** —
`WDL_PB_ADMIN_TOKEN`, or `WDL_PB_ADMIN_EMAIL`/`WDL_PB_ADMIN_PASSWORD`
(+ `WDL_PB_ADMIN_COLLECTION`, default `users`) exchanged at `auth-with-password`.
The M7 mock accepts authorized `movements` writes (any `Authorization` header
stands in for admin), persisting to git-ignored `fixtures/movements.local.json`.
Verified against `make serve`: first run creates 972 / re-run all-unchanged /
delete-one-then-load creates exactly 1 / mutate-one-then-load updates exactly 1.
**Still to do on deploy:** run it once against prod after M1/M2 are applied and
Chris's `users` row is `admin: true`.

**M4 — Egress: DB → `registry/movements.json`.** DONE 2026-09-01 (`e472cde`).
`scripts/movements-from-db.mjs` (`make movements:dump`, no deps) reads every
`scope = "global"` row over `/api` (no auth — the list/view rule is
`scope = "global"`) and rewrites `registry/movements.json` in its current
formatting (`JSON.stringify(obj, null, 1) + "\n"`, each entry's keys in the order
that entry already uses on disk, empty columns omitted — the exact inverse of M3
clearing an absent field), so a dump of an unmutated M3 ingest reproduces the
file byte-for-byte. `$comment` / `version` / `$sources` copied from disk
untouched; `scope` / `user` / record `id` / `created` / `updated` never written.
Prints a tally; `--dry-run` reports tally + `git diff --stat` and writes nothing;
`--check` writes then exits non-zero if the file moved (for the round-trip test
and a future pre-commit hook — DEC-020 leaves the cadence open, this ships no
hook). Verified against `make serve`: `make movements:load` then
`make movements:dump` leaves `git diff registry/movements.json` **empty**; a
one-field PATCH then a dump moves exactly that one entry's one field. **The
dump → load → dump round-trip closes DEC-020's "still open" round-trip
requirement.** **Still to do on deploy:** run it once against prod to pull any
admin edits back into the repo.

**M5 — Movement editor widget.** DONE 2026-09-01 (`b2bd7b5`).
`apps/shared/movement-editor.js` — `createMovementEditor({ container, record,
api, onSaved, onCancel })`, a host-agnostic form over one movement's curated
fields (enum fields as `<select>`s whose options are exactly the registry
vocabulary + "— unset —"; `laterality` / `measures` as checkbox groups;
string-list fields and `muscles.primary`/`.secondary` as comma-separated inputs;
`movementId` editable + kebab-validated on create, read-only on edit). It
`POST`s / `PATCH`es a `scope: "global"` row over `/api` in the same record shape
M3 writes (empties omitted on create / cleared on update; `source` / `user` /
timestamps never touched). Cross-field validation (an axis needs a per-side
mode; a default must be a ticked mode) and the id check run before any request;
an `/api` failure (403 for signed-out / non-admin) is shown in the form. The
movement `/api` calls (`listMovements` / `getMovementByMovementId` /
`createMovement` / `updateMovement`) live in `apps/shared/pocketbase.js`. First
host: the builder — `＋ new movement` in the palette modal, `✎` on every palette
card, "Edit … its curated fields" in a step row's `»` panel (whose caret now
shows for any curated movement); a save folds the row into the in-memory
`curatedMovements` / `catalogue` via `provide(...)` so it shows without a reload.
Verified by driving the builder against `make serve`, both themes. **Still to do
on deploy:** nothing collection-side — the editor just needs an admin `users` row
on the box to write against prod.

**M6 — Nightly DB backup cron on the VPS.** DONE 2026-09-01 (`97f236f`).
*Pre-existing gap, independent of M1–M5, raised higher-priority by Chris
2026-08-31 — the answer to "did we set this up?" was no; only the keepalive cron
existed.* VPS-side config + docs only (no app / core / migration change; suite
unchanged **2064/2064, 1 pending**). **Mechanism: a shell cron line**, not
PocketBase's built-in scheduler — the box already carries a per-user `crontab`
for the keepalive fallback, so one more greppable, version-controlled line beside
it (schedule, retention prune and path all visible in the repo) beats a setting
buried in PB's own DB that would still need a separate off-box cron anyway; the
"box down at the backup hour" risk is equal for either scheduler and small.
`deploy/pocketbase/crontab.fragment` gains, next to the keepalive:
`17 3 * * * sqlite3 "$HOME/pb/pb_data/data.db" ".backup '…/pb_backups/data-$(date -u +\%F).db'" … && find "$HOME/pb/pb_backups" -name 'data-*.db' -mtime +30 -delete`
— `\%F` escaped (cron turns an unescaped `%` into a newline), `.backup` is
SQLite's online hot-copy (safe against the live DB; captures `pb_data/data.db`
only — not `auxiliary.db` logs or `storage/`), 30-day prune on the box.
**Off-box copy: a pull** from Chris's machine over the same `~/.ssh/config` alias
`make deploy` uses (`rsync -av dreamhost.ae.wex:pb/pb_backups/ ~/wdl-pb-backups/`,
no `--delete` so local history outlives the VPS prune) — chosen over a VPS push
cron, which would need an outbound keypair minted on the managed box and Chris's
laptop reachable. *(Follow-up 2026-09-01, `2c1cdb0`: wrapped as
**`make backups:pull`**, alongside a new **`make deploy:db`** that rsyncs
`deploy/pocketbase/pb_migrations/*.js` to the box — no `--delete` — and restarts
PocketBase; and every multi-word `make` target moved to a `:` namespace
separator. See recent-changes.)* **Fallback documented:** PocketBase *Settings → Backups*
(Auto backups cron + Max keep) for a box without `sqlite3` or when a
whole-`pb_data/` zip is wanted. `deploy/README.md` §9 "Back up (SQLite)"
rewritten (the old "recommended, not done" note replaced with the cron lines +
off-box pull + PB alternative) and "Restore" aligned to the dated filename with
the "app data only" scope noted. **Still to install on the box by Chris:** paste
the backup line into `crontab -e` on the PocketBase account and verify the first
backup + first off-box `rsync` by hand on the VPS — the same "still to do on
deploy" caveat M1/M2/M3 carry. *Touched:*
`deploy/pocketbase/crontab.fragment`, `deploy/README.md`;
`docs/context/tasks/{completed,current}.md`,
`docs/context/current/{recent-changes,next-steps}.md`,
`docs/context/topics/{what-exists,running-it}.md`.

**M7 — Local dev mock `/api` + fixtures.** DONE 2026-08-31 (`4431683`).
`scripts/mock-api.mjs` (no deps) is wired into `scripts/serve.mjs` ahead of
static handling: on by default, `WDL_MOCK_API=0` opts out. Committed
`fixtures/users.json` (one admin fixture user — sign-in "just works" as it) and
`fixtures/workouts.json` (3 seed rows); runtime workout writes persist to
git-ignored `fixtures/workouts.local.json`. `registry/movements.json` doubles as
the movements fixture — mapped to the M1 collection shape and wrapped in the PB
list envelope; `/records/:id` resolves by synthetic id *or* `movementId`;
unauthenticated writes `403`. Minimal query support (`filter=field="value"` AND,
`sort`, `page`/`perPage`) only as far as the client needs. Verified by curl over
every endpoint and by driving the builder — Google sign-in completes the full
redirect flow as the fixture user and *My workouts* populates from the mock.

---

## The workout library (L0–L7)

*Raised 2026-09-01 by Chris (see [../topics/builder-ux.md](../topics/builder-ux.md)
"Accounts, IDs and layout"): non-interactive **org accounts** owning curated
public benchmark sets, an editable **`handle`** per account that is the `@id`
namespace prefix for the workouts it owns, a **`workouts.wdlId`** column, search
over own + public by name / `@id` / record id, an authored `.wdl` library, and a
`make workouts:load` ingest that also regenerates the committed fixtures. The
contract is [DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it).
Eight tasks (L0–L7), each a landable branch sized for its own session, each
spawning the next — kept together in `current.md` while in flight, moved here as
one section when **L7 landed 2026-09-01** and closed the epic. Execution order as
worked: L0 → L1 → L2 → L3 → L4 → L5 → L6 → L7. All of L0–L7 landed; nothing in
`packages/core`, the grammar or the spec semantics was touched by any of them
(only an L0 spec §2 hosting-convention note), the suite held at **2064/2064, 1
pending** throughout, and `examples/workouts/` was deliberately never wired into
`corpus.test.ts`. What is *left* after this epic: the board **Edit** button
round-tripping into the builder, and the deferred handle-rename staleness debt
([../topics/known-debts.md](known-debts.md)).*

*Raised 2026-09-01 by Chris: he wants **non-interactive "org" accounts** that
own curated, public sets of named workouts — a `crossfit` account owning the
official benchmarks (Fran, Fight Gone Bad, the Girls, the Heroes, …), a `hyrox`
account, a `tabata` account, room for more — plus **fixtures generated from
authored `.wdl`** so that from the first `make serve` (and on a fresh prod box)
anyone can pull down a whole org's set or open any single workout, plus
**search over one's own + any public workout by name or `@id`/record-id**.*

**Four calls Chris made when this was fleshed out (2026-09-01):**

1. **Org accounts are flagged `users` rows** — a new `org: true` (bool) on the
   `users` collection, no OAuth identity, rows created by a migration with fixed
   ids. Their workouts are owned by them with `visibility: "public"`. Reuses the
   existing `owner` relation and every existing list/view rule; no new
   collection, no `workouts`-schema churn for ownership.
2. **The account handle *is* the `@id` namespace prefix — for every account,
   not just orgs.** The `crossfit` account owns everything whose `@id` is
   `crossfit:*`; a person's handle namespaces the workouts *they* create the
   same way. **This epic is the forcing function for the deferred "account
   namespacing" rethink** and settles most of it:
   - `users.handle` (username), unique, is the `@id` namespace for that
     account's workouts.
   - **The user picks / edits their own handle** — it is not derived and not
     fixed. Needs a place in the UI to set it (account settings in the builder
     header, and/or a prompt the first time a signed-in user saves a workout).
   - **Onboarding must not block on it:** a new account gets a **random
     two-word handle** (`brave-otter`, `quiet-harbor` — an adjective+noun
     generator, collision-checked) so a save always has a namespace; the user
     can change it later.
   - **Saving always forces the `@id` namespace to the owner's handle**
     (Chris, 2026-09-01): a user *cannot not* set the namespace. On every
     save, the `@id` line is written/rewritten to `<owner-handle>:<slug>` — so
     there is no "mismatch" state and no warn-on-mismatch UX to design.
     Copying another user's workout (`crossfit:fran`) and saving it naturally
     re-namespaces it to `<yourhandle>:<slug>`. This **fully closes** the
     `@id`-write-back question the deferred rethink held open.
   - **Known debt, explicitly deferred (Chris: "we can revisit that"):** when a
     user changes their handle, every *already-saved* `<oldhandle>:<slug>` `@id`
     and every share link built on it goes stale. Phase 1 does **not** solve
     this — record it in [../topics/known-debts.md](../topics/known-debts.md)
     and move on. Options to weigh later: on rename, rewrite `wdlId` + the `@id`
     text across all the user's workouts (the natural extension of "save forces
     the namespace"); keep old handles as resolvable aliases; forbid rename once
     a workout exists.

   After this epic, **nothing about `@id` ↔ namespace is left in the deferred
   rethink** — only the handle-rename debt above, and it is deferred on purpose.
3. **Search-by-ID uses a new `workouts.wdlId` column**, parsed from the `@id`
   directive on every create/update and indexed. Search matches `title ~ q`,
   `wdlId = q` (or `~ q`), or the 15-char record id. This also advances the
   deferred "`@id` ↔ record-id correlation" rethink.
4. **A session drafts all the benchmark `.wdl` content**, Chris reviews the
   diff. One L-task is the authoring pass; the WOD list is canonical and
   public, but transcribing it into WDL accurately (and whiteboard-readably) is
   real work and the place errors get in.

Grounding facts (what the tasks are built against — cf. the M0–M7 section in
[completed.md](completed.md)):

- The `workouts` collection
  (`deploy/pocketbase/pb_migrations/1756600000_create_workouts.js`):
  `owner` (relation → `users`), `title`, `source` (the `.wdl` body, ≤200 000
  chars), `visibility` (select `private|unlisted|public`), autodates. Rules:
  list/view `owner = @request.auth.id || visibility != "private"`; write
  owner-only. Indexes on `owner`, `visibility`.
- `apps/shared/pocketbase.js` is the hand-rolled `/api/*` client — `listMine`,
  `getById`, `create` (always `private`), `update`, `remove`, `shareUrl`
  (`/apps/display/?w=<id>`). The board resolves `?w=<id>` through `getById`
  (item 20). There is **no search call and no `wdlId` anywhere** yet.
- Local `make serve` has no PocketBase: `scripts/mock-api.mjs` answers `/api`
  from `fixtures/users.json` (one row, `admin:true`) + `fixtures/workouts.json`
  (seed rows, `owner` = that user; runtime writes → git-ignored
  `fixtures/workouts.local.json`). The mock's query support is deliberately
  minimal (`filter=field="value"` AND, `sort`, `page`/`perPage`) — search adds
  `~` and an OR to it.
- `registry/`-style ingestion precedent: `scripts/movements-to-db.mjs`
  (`make movements:load`) — no-deps, idempotent upsert over `/api/collections/…`,
  keyed on a unique column, admin auth for prod, works against the mock. The
  library loader is its twin for `workouts`.
- `@id` is already a spec directive (`@id crossfit:fran`, spec preamble) and
  the existing Fran fixture already uses exactly that value.

**L0 — Design note / decision (DEC-021). DONE 2026-09-01 (`b9c52f1`).**
Written up as
[DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)
(+ the index entry in [../decisions.md](../decisions.md)) and a one-sentence
**hosting-convention note** beside spec §2's `@id` bullet (`spec/spec-0.1.md`)
— flagged explicitly as a convention, so the "never derived from contents"
language rule is untouched; no grammar / parser / `packages/core` change, suite
unchanged at 2064/2064. The DEC nails: `org: true` flagged `users` rows own the
curated sets; `users.handle` (unique, `[a-z0-9-]+`, user-editable, random
`adjective-noun` default from committed `apps/shared/` word lists) is the `@id`
namespace for every account; every save writes/rewrites `@id` to
`<owner-handle>:<slug>` (slug from an existing `@id` else the title; same-owner
collision → deterministic suffix; copy→save re-namespaces; L6 loader applies the
same rule to org workouts non-interactively); `workouts.wdlId` set from the same
value, indexed; `getByAnyId` resolves a `:`-bearing `wdlId` or a 15-char record
id to one row (the `:` is the discriminator) and the board's `?w=` uses it; the
mock `/api` + `fixtures/` mirror all of it; the handle-rename staleness and any
*platform* concern are out of scope. Original spec follows.

Write the contract the rest builds
against, the way M0 → DEC-020 did. It must state, at minimum:

- Org accounts are flagged `users` rows (`org: true`), no OAuth, fixed ids,
  workouts owned by them at `visibility: "public"`.
- `users.handle` (unique) is the `@id` namespace **for every account**. A new
  account with no handle is assigned a random `adjective-noun` handle
  (collision-checked); the user can edit it to any unused valid slug.
- **Saving a workout always forces its `@id` to `<owner-handle>:<slug>`** —
  written/rewritten into the text on every save. There is no un-namespaced
  saved workout and no mismatch state. `<slug>` derives from the existing
  `@id` slug if present, else the title; a collision within the owner's
  namespace gets a suffix. Copying another user's workout and saving
  re-namespaces it naturally.
- `workouts.wdlId` mirrors the `@id` (`<handle>:<slug>`), set from the text on
  save, indexed — the searchable/resolvable handle.
- A lookup resolves *either* a 15-char record id *or* a `<handle>:<slug>`
  `wdlId` to the same record.
- The **handle-rename debt** is deferred (stale already-saved ids /
  share-links) — recorded in [../topics/known-debts.md](../topics/known-debts.md),
  not solved here.
- What (if anything) `spec/spec-0.1.md` should say about the `@id` ↔ account
  namespace rule.

No code. `docs/context` (DEC-021 in `settled-decisions.md` + the index entry
in `decisions.md`) + the `spec` note. Spawns L1.

**L1 — `users` schema: `org` bool + `handle`, + a handle generator/editor.
DONE 2026-09-01 (`88ab8b6`).**
`deploy/pocketbase/pb_migrations/1756900000_add_users_handle_and_orgs.js` adds
`org` (bool, `required:false`) and `handle` (text, `required:false`, **unique**
— `CREATE UNIQUE INDEX idx_users_handle ON users (handle)`) to `users`, then
inserts the three org rows — `crossfit` / `hyrox` / `tabata`, fixed 15-char ids
(`org0crossfit001` / `org0hyrox000001` / `org0tabata00001`), `org: true`,
`verified: true`, an unusable random password (an auth-collection record needs
one even though nobody signs in as these), `handle` = the name. App side:
`apps/shared/handle.js` (pure — `validateHandle`, `randomHandle`, the reserved
set; a handle is 3–63 characters, Chris's call 2026-09-01 on the minimum)
reads two committed word lists in `apps/shared/handle-words.js` (~130
adjectives, ~120 nouns, plain `[a-z]+`). `apps/shared/pocketbase.js` grows
`ensureHandle()` — called from `refreshAuth()` and
`completeSignInFromRedirect()`, so onboarding never blocks: assigns a random
`adjective-noun` handle on first sign-in, retrying on collision and falling
back to a numeric-suffixed pair after 6 tries — `updateHandle(h)` (client-side
`validateHandle`, a best-effort free-check, then `PATCH`, with the server's
unique-index 400 as the authoritative "taken" reject — the `users` list/view
rule is `id = @request.auth.id`, so the pre-check can only ever confirm your
*own* handle against real PocketBase; it is fully accurate against the mock)
— and `currentHandle()`. The builder header's account area (`apps/builder/
builder.js` `renderIdentity`/`renderHandle`/`startEditHandle`,
`apps/builder/builder.css`) shows `@handle` beside the signed-in identity
("assigning a handle…" in the brief gap right after sign-in) with an inline
edit affordance — Enter/Escape, an error line for a rejected value. Mirrored in
`scripts/mock-api.mjs` (`GET`/`PATCH .../users/records`, filter=`handle="…"`
open there since the real self-only list rule doesn't apply) and
`fixtures/users.json` (the three org rows with the same fixed ids; the mock
signed-in user is committed **without** a `handle` on purpose, so a fresh
`make serve` exercises the random-assignment path — the assignment persists to
git-ignored `fixtures/users.local.json`, deleted to re-exercise it).
`deploy/README.md` §7c + `pb_migrations/README.md` entry.
**Verified:** `make test` unchanged 2064/2064, 1 pending (no `packages/core`
touch). Migration up/down/up against a real PocketBase v0.40.1 (darwin_arm64)
binary + throwaway `pb_data`: all four migrations apply cleanly, `org`+`handle`
land on `users` with the unique index, the three org rows exist with the right
fixed ids and `org: true`, a duplicate-`handle` insert is rejected
(`UNIQUE constraint failed: users.handle`), `migrate down 1` removes the rows +
index + both fields cleanly, a re-`up` reapplies cleanly. Drove the builder
against `make serve` (mock `/api`) in both themes: a fresh mock user is
assigned a random handle (`@grand-cairn` on this run) that survives reload;
edited to a free slug (`river-otter`) — succeeds; edited to `crossfit` (an org
handle) — rejected with "That handle is already taken."; edited to `123` —
rejected with "A handle can't be all digits." (the empty/mixed-case/reserved
paths run the identical pure `validateHandle`, checked directly). Signed-out
builder unchanged (`Download .wdl` / `Open…`, no handle UI). **Still to do on
deploy:** glance at the admin UI — the three org rows landed, `handle` shows
the unique-index badge (`deploy/README.md` §7c) — same caveat as M1/M2/M3.
Spawns L2.

**L2 — `workouts` schema: `wdlId` column. DONE 2026-09-01 (`fc72881`).**
`deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js` adds `wdlId`
(text, `max: 260`, `required: false`) to `workouts` plus a **plain** index
`CREATE INDEX idx_workouts_wdl_id ON workouts (wdlId)` (non-unique — two owners
can hold the same slug; same-owner collisions get L3's `-2`/`-3` suffix; a
plain index is all L3's lookup and L4's search need). Edits an existing
collection the same way `1756700000_add_users_admin.js` /
`1756900000_add_users_handle_and_orgs.js` do — `findCollectionByNameOrId` →
`fields.add(new Field(...))` / `indexes.push(...)` → `app.save`; `down`
reverses field + index together. **No rule change** — the item-18
`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` on `workouts` are
untouched. **No app/mock/fixture change** — L2 is pure DB schema; nothing sets
`wdlId` yet (L3 does, on save; L6's loader for the org rows), so existing rows
stay `wdlId: null` — no backfill, per DEC-021. `deploy/README.md` §7 table +
new §7d; `pb_migrations/README.md` entry. **Verified:** `make test` unchanged
2064/2064, 1 pending (no `packages/core` touch). Migration up/down/up against a
real PocketBase v0.40.1 (darwin_arm64) binary + throwaway `pb_data`, all five
migration files present: `migrate up` applies all five cleanly; `sqlite3`
against `_collections` shows `wdlId` (text, max 260, required false, system
false) and against `sqlite_master` shows `idx_workouts_wdl_id` beside the
existing `owner` / `visibility` indexes; `echo y | migrate down 1` reverts —
`wdlId` and `idx_workouts_wdl_id` both gone, owner/visibility indexes intact;
a re-`up` reapplies cleanly. **Still to do on deploy:** glance at the admin UI
after the migration applies — confirm the `wdlId` column + `idx_workouts_wdl_id`
landed on `workouts` (`deploy/README.md` §7d); nothing to backfill or grant,
same style as the M1/M2/M3/L1 "still to do on deploy" notes. Spawns L3.

**L3 — force `@id` on save + set `wdlId` + lookup resolver. DONE 2026-09-01
(`5be4a30`).** App + mock only, no schema/core/grammar/spec touch, `make
test` unchanged 2064/2064 (1 pending). `apps/shared/pocketbase.js` grew a
module-local `@id`/slug helper block (`slugify`, `readIdValue` / `readTitleLine`
— light regex on the zero-indent preamble line, `slugOfIdValue`, `baseSlug`,
`writeIdLine`, `requireHandle`, `namespacedId`, `forceNamespace`) and
`create` / `update` now run it: on every save `source`'s `@id` line is
written/rewritten to `<owner-handle>:<slug>` and `wdlId` is sent set to the same
string. `<slug>` = the slug portion of an existing `@id` in the text (`@id
crossfit:fran` → `fran`, re-namespaced to `<yourhandle>:fran`), else a slug of
the zero-indent `# title` line *in the source* (the passed `title` param is a
display fallback and is deliberately not used for the slug — it can be
`"Untitled workout"`), else `untitled`. A same-owner clash appends a
deterministic `-2` / `-3` … suffix, stable across re-saves (the scan skips only
*other* records' `wdlId`s and `base` is re-derived from the stored `@id`). A
patch without `source` leaves `wdlId` alone. New export `getByAnyId(x)`: a
value with `:` → `filter=wdlId="<x>"` (throws a 404-shaped `Error` on no hit);
no `:` → `getById`, with a `filter=wdlId="<x>"` fallback on a 404 — same
error/not-found shape as `getById` so `board.js`'s `loadShared` `catch` is
untouched. `apps/display/board.js` swapped the `?w=` import + call from
`getById` to `getByAnyId`; the id-is-the-share-link / clean-`?w=` behaviour
(`load(..., false)`) is unchanged. `scripts/mock-api.mjs` gained a JS port of
the helper (`forceWdlId` + `mSlugify` / `mReadId` / `mReadTitle` / `mSlugOfId` /
`mBaseSlug` / `mWriteId`) run on mock `workouts` create/update, resolving the
owner's handle from the `users` fixture; `wdlId` added to the record shape and
the PATCH field list; `filter=wdlId="<handle>:<slug>"` needed **no** parser
change — the generic `field="value"` matcher already spans the colon. **Verified**
(mock `/api`, driving `pocketbase.js`'s real `create`/`update`/`getByAnyId` and
one end-to-end builder "Save to my workouts" click): `# Fran` no `@id` → `@id
easy-beacon:fran`; copy of `@id crossfit:fran` on a clean namespace → `@id
easy-beacon:fran`; no `@id`/title ×2 → `easy-beacon:untitled` then
`easy-beacon:untitled-2`, and re-saving either keeps its slug (no bump / no
creep); body-edit re-save of a saved workout → `@id`/`wdlId` unchanged; builder
Save button → `@id easy-beacon:new-workout` inserted after the `# New workout`
title line + `wdlId` set. Board: `?w=easy-beacon:fran` resolves and renders with
`easy-beacon:fran` in the meta strip and the URL left clean; `?w=<15-char
recordid>` still resolves; `?w=nope:nope` shows the existing "could not be
found" line, no crash. Theme is not exercised — L3 is logic-only, no CSS/render
change, both `prefers-color-scheme` values run identical code. Spawns L4.

**L4 — Search: API + builder UI. DONE 2026-09-01 (`0de7f9a`).** App + mock +
one fixture row only, no schema/core/grammar/spec touch, `make test` unchanged
2064/2064 (1 pending). `apps/shared/pocketbase.js` grew **`searchWorkouts(q,
{page})`** — one `GET …/workouts/records` with
`filter=(visibility="public" || owner="<uid>") && (title~"<q>" || wdlId~"<q>")`
(signed out: no `owner` clause, no auth header), `sort=-updated`,
`perPage: 20`; `q` is trimmed and has `"` stripped (it sits inside `"…"` in the
filter — one-instance tool, not a query builder); empty `q` → `[]` with no
request; returns the `items` array (same row shape as `listMine`). Also
**`getHandle(uid)`** — best-effort uid→handle, session-memoised, for labelling a
public hit; against real PocketBase only *your own* uid resolves (the `users`
list rule is `id = @request.auth.id`) so a foreign owner degrades to the label
"public", against the mock every uid resolves. The record-id search DEC-021
lists is **left to the existing `Open…` path** — a bare 15-char id matches
neither `title~` nor `wdlId~`, and the board's `?w=` / `getByAnyId` already
resolve one; folding it into the box wasn't worth a second speculative request
per keystroke. Builder (`apps/builder/builder.js` + `builder.css`): a debounced
(220 ms) `<input type="search">` at the top of the **My workouts** panel; a
non-empty query replaces the plain list with `searchWorkouts` hits, each row
labelled **`mine`** (accent) or **`@ownerhandle`** / **`public`** (dim);
click-to-open runs `openFoundWorkout` — your own hit attaches like `openMine`
(Save updates it), someone else's public hit opens **detached** with a note
("Opened `crossfit:helen` — a read-only copy; Save makes it yours.") so the
first Save creates *your* re-namespaced copy (the DEC-021 copy flow). "No
matches." line for an empty result; clearing the box restores the plain list.
The search `<input>` is one persistent node re-appended (not rebuilt) across
panel re-renders, with focus/caret restored, so typing isn't interrupted when
results land. `scripts/mock-api.mjs`: `applyQuery`'s one-regex filter was
replaced by `matchesFilter` — `splitTop` (paren/quote-aware `&&` / `||` split) +
`matchesAtom` (`field="v"` exact / `field~"v"` case-insensitive substring); a
header comment states it is a matcher for the exact strings the client emits,
not a general engine. `fixtures/workouts.json` gained **one** row —
`crossfit:helen`, owned by `org0crossfit001`, `visibility: "public"`, `wdlId`
set — so a fresh `make serve` has something public to find (L6's loader will
regenerate this file). Spawns L5.

**L5 — Author the benchmark `.wdl` library. DONE 2026-09-01 (`6cb8df4`).**
**43 files** under `examples/workouts/<org>/<slug>.wdl`, each first line
`@id <org>:<slug>` (slug = filename stem), then `# Title`, then the body — every
file byte-identical to `wdl fmt` canonical output (diffed each against `fmt`), so
the at-rest text is already the whiteboard form. **crossfit/ (31)** — the 19
Girls (Fran, Cindy, Grace, Helen, Diane, Elizabeth, Isabel, Jackie, Karen,
Linda, Nancy, Angie, Barbara, Chelsea, Mary, Annie, Eva, Kelly, Nicole), 9 first
Heroes (Murph, DT, Chad, JT, Michael, Randy, Daniel, Josh, Nate), Fight Gone Bad
/ Filthy Fifty / the CrossFit Total. **hyrox/ (9)** — `hyrox:race` (the full
8×(1km run + station) race, spec §13.39 shape, loads at the current
standard-division numbers — Sled Push 152/102 kg, Sled Pull 103/78 kg, Farmers
Carry 2×24/2×16 kg, Sandbag Lunge 20/10 kg, Wall Balls 6 kg→10ft / 4 kg→9ft;
men's primary, women's in `variants: women:`) + its 8 stations as individual
single-movement files. **tabata/ (3)** — `tabata:protocol`, `tabata:this`,
`tabata:something-else`. Loads use corpus house style (single men's Rx
`@ 95lb`); the bare `(95/65)` split form was rejected because `wdl fmt` expands
it to the verbose `(women 95 / men 135)`. **Content only** — no schema / code /
grammar / spec / test touch; `make test` unchanged 2064/2064, 1 pending;
`examples/workouts/` deliberately **not** wired into `corpus.test.ts` (L6/L7's
call). All 43 pass `wdl check` (`<file>: ok`, exit 0); Fran / Murph / Fight Gone
Bad / `hyrox:race` / `tabata:this` spot-checked on the board (`<org>:<slug>` in
the `#meta` strip, no error strip; Murph's `any order:` shows the expected
tally-block timeline note; `hyrox:race` shows the Division selector). Spawns L6.

**L6 — Ingestion: library → DB + fixtures. DONE 2026-09-01 (`5cc9e0f`).**
`scripts/workouts-to-db.mjs` + a `make workouts:load` target (beside
`movements:load` in the root `Makefile`), the twin of `movements-to-db.mjs` —
no deps (`node:fs` + global `fetch`). Reads `examples/workouts/<org>/<slug>.wdl`
(43 files), resolves `<org>` → the org row's fixed id as `owner`
(`crossfit`→`org0crossfit001` etc.), forces `@id` / `wdlId` to
`<orghandle>:<slug>` via a port of `apps/shared/pocketbase.js`'s slug helper
(slug from the file's own `@id`; the authored files are already canonical so the
rewrite is a no-op on them), `title` from the `# Title` line, `source` = the
file body, `visibility: "public"`. **Idempotent on `wdlId`**: bulk-fetches the
collection (`perPage=500`, paged), `POST`s the absent, `PATCH`es only when
`title`/`source`/`visibility`/`owner` differ, re-run writes nothing (prints a
`created`/`updated`/`unchanged` tally). **`--dry-run`** (via `ARGS=--dry-run`)
reports the planned POSTs/PATCHes and writes **nothing** — no HTTP mutation, no
fixture rewrite. **The same run regenerates the committed fixtures** (unless
`--dry-run`): `fixtures/workouts.json` gets the 43 library rows (deterministic
15-char ids derived from `wdlId`) plus every pre-existing **non-org-owned** row
preserved (the mock signed-in user's 3 seed workouts, which populate the
builder's *My workouts* list from a fresh `make serve`) — the old hand-added
`crossfit:helen` row is replaced by the generated one (same `wdlId`);
`fixtures/users.json` gets the three `org: true` rows (same fixed
ids/handles/`org:true` L1 commits) plus the mock user row kept verbatim
(no `handle`, on purpose). Each fixture file is rewritten only when its content
changes, so a clean re-run leaves `git status` untouched. **Prod writes need
superuser auth** — the `workouts` write rule is owner-only, so unlike
`movements:load` (a `users` admin satisfies the movements rule) this needs
`WDL_PB_ADMIN_TOKEN` or `WDL_PB_ADMIN_EMAIL`/`_PASSWORD` with
`WDL_PB_ADMIN_COLLECTION` defaulting to `_superusers`; against the mock
(`make serve`) writes need no auth and it just works. **No `packages/core` /
grammar / spec / migration / authored-`.wdl` touch; `examples/workouts/` is
still not wired into `corpus.test.ts`.** **Verified:** `make test` unchanged
**2064/2064, 1 pending**. Against a fresh mock still carrying the pre-L6 seed:
`make workouts:load` → **42 created, 1 updated** (the seed already held
`crossfit:helen` — its source differs from the authored file, so it PATCHes);
re-run → **43 unchanged, nothing written**; bump `@ 95lb`→`@ 96lb` in
`examples/workouts/crossfit/fran.wdl`, re-run → **exactly 1 PATCH (source)**,
reverted. `--dry-run` → `git status` clean. End-to-end against the regenerated
fixtures (fresh `make serve`): board `?w=crossfit:fran` / `?w=hyrox:race` /
`?w=tabata:this` all resolve and render with `<org>:<slug>` in the `#meta`
strip, no error strip, `hyrox:race` shows the Division selector; builder *My
workouts* search — `fran` returns `Fran @crossfit` (public org hit) beside
`Fran mine`, `hyrox` returns all 9, `murph` returns `crossfit:murph`;
click-to-open the `@crossfit` hit loads a detached read-only copy
(`@id crossfit:fran`, the DEC-021 copy flow). Regenerated
`fixtures/workouts.json` has **46 rows** (43 library + the 3 preserved
mock-user seed rows); `fixtures/users.json` unchanged (already canonical from
L1). Spawns L7.

**L7 — Surface the library in the apps. DONE 2026-09-01 (`2557177`).**
App code only — `apps/shared/pocketbase.js` + `apps/builder/builder.js` +
`apps/builder/builder.css`; no schema / core / grammar / spec / mock / fixture /
board touch, `make test` unchanged **2064/2064, 1 pending**, `git status` clean
of fixtures. `apps/shared/pocketbase.js` grew **`listOrgWorkouts(ownerId)`** — one
`GET …/workouts/records` with `filter=owner="<id>" && visibility="public"`,
`sort=title`, `perPage=200`; `ownerId` is a fixed org-account id passed in, not
looked up (the real `users` list rule `id = @request.auth.id` resolves an org row
for nobody). The builder's **My workouts** panel gained an **Examples** chip row
under the search box — one toggle per org (`CrossFit` / `Hyrox` / `Tabata`, a
shipped `ORG_ACCOUNTS` constant carrying the L1 fixed ids + handles); the lit chip
replaces the plain list with that org's public set, each row labelled
`@<handle>`, click-to-open through the **existing** `openFoundWorkout` detached path
(a read-only copy the first Save re-namespaces — the DEC-021 copy flow),
re-picking the lit chip closes the set. `renderSearchResults` was refactored to a
shared **`renderHitList(hits, emptyMsg)`** that both the search results and the
Examples set use; every hit row now also carries a per-row **`↗` "Open on the
board"** shortcut (`openHitOnBoard` → a new tab at `../display/?w=<wdlId|id>`).
Searching and browsing share the one list slot — a query closes an open set and
vice versa; sign-out clears the browse state. The builder header's existing
*Open on the board ↗* already covers the current buffer via the `#<source>` hash
and works unchanged from a library-opened buffer. **Board:** `?w=crossfit:fran`
resolves end to end and the `#meta` strip shows `crossfit:fran` verbatim — the id
already names the owner handle, so **no "by @crossfit" source line was added**
(the id is enough; noted rather than built). **Verified** driving the builder
against a fresh `make serve` (mock `/api`, regenerated fixtures): the Examples
chips list **31 / 9 / 3** workouts for crossfit / hyrox / tabata, all labelled
`@<handle>`, title-sorted; toggling a chip off restores the plain list; opening
`Fran` from the crossfit set gives a detached read-only copy (buffer
`@id crossfit:fran`, note "Opened crossfit:fran — a read-only copy; Save makes it
yours.", Save button "Save to my workouts"); the per-row `↗` targets
`?w=crossfit:fran`; the board renders it with `crossfit:fran` in the `#meta`
strip, no error strip; `?w=hyrox:race` / `?w=tabata:this` resolve; the search box
is unchanged (`fran` → `Fran @crossfit` beside `Fran mine`, clearing restores the
plain list). **This task closes the epic** — the L0–L7 section moved here from
`current.md` as one grouped block.


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

*Corrected again 2026-08-23, at the merge to `main`: items 5 and 6 both closed
the same day, on two branches merged together — 5 as
`claude/confident-kalam-90bad5`, 6 as `claude/qualitative-load-item6` — so
neither branch's own paragraph saw the other land. Closed so far: the whole
0-series, 1, 1a, 2, 3, 4, 5, 6, 8 and 8a, so **the open numbered items are 7 and
9**.*

*Corrected a third time 2026-08-23, at the merge to `main`: items 7 and 9 both
closed the same day, on two branches merged together, so neither branch's own
paragraph saw the other land — the same shape as the 5/6 merge above. Closed
so far: the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8, 8a and 9 — **every
numbered item raised so far is closed.** The next task is whatever gets found
or raised next, not a number waiting here.*

**Nobody has run a session off the board.** Everything is verified by tests and
by driving the UI. Every defect Chris has caught by *looking* — `21 Thruster`,
the AMRAP clock, the run-on notes — was invisible to 1257 tests. A real session
will reorder this list.
