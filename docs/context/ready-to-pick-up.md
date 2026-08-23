# Ready to pick up

The queue. Each of these is self-contained enough for its own session, roughly
in the order I would take them. Load this when starting a session with no task
named; when one lands, take it off this list and say so in
[what-exists.md](what-exists.md).

**0. ~~Explore expressing the grammar in a formal specification language.~~
ANSWERED 2026-08-14 — see [../grammar-exploration.md](../grammar-exploration.md).**
Yes, it fits. The step line is stated in `spec/grammar-0.1.ohm`, an Ohm grammar
carrying no semantic actions, and with a semantics file it reproduces the
hand-written parser's AST on **538/538** lines. Notation and engine are settled
in [settled-decisions.md](settled-decisions.md).

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

**It is slower, and the number is in [running-it.md](running-it.md).** Parsing
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
[known-debts.md](known-debts.md). Two are the grammar being right and `parse.ts`
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
[settled-decisions.md](settled-decisions.md).

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
[known-debts.md](known-debts.md) with what it used to do kept beside what it does
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
  [settled-decisions.md](settled-decisions.md); the silence it left — two field
  lines dropped without a word — is closed either way.
- **Leading `sets x reps`.** Closed. `3x10 Curl` is `10 Curl x3` and produces the
  same tree, so nothing downstream learned a concept; `sets` reaches only `format`
  and `timeline.ts`, which already expands it, so rep totals came out right for
  free. Written both ways, the trailing one wins, by the settled "later qualifier
  wins" reading.

**Two things left open on purpose, both written up in
[known-debts.md](known-debts.md).** Neither is a leftover — each is a question the
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
  that work has no source today. See [builder-ux.md](builder-ux.md).

**Do not justify this by adoption, and do not decline it by adoption either.**
Both were tried and both are wrong. The README's *"not competing for adoption"*
rules out decisions justified by popularity; it says nothing against rigour, and
was misread as licensing a loose spec — see the clarification there. A formal
grammar is owed to whoever maintains this in five years, which is the author.
Reimplementability by others is a side effect, not the case for it. Settled
2026-08-14; the corresponding entry in
[deliberately-not-done.md](deliberately-not-done.md) has been corrected.
*Touches: `packages/core/src/parse.ts`, `spec/spec-0.1.md`, and whatever the
parser would be generated from.*

**0b. ~~A container should adopt following lines that were never indented.~~
DONE 2026-08-15.** `readLines` adopts, `wdl fmt` writes the indentation back, and
the rule is stated in spec §2 as three sentences rather than one. Both open
questions were answered rather than deferred, and both answers are in
[settled-decisions.md](settled-decisions.md).

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
[lessons-learned.md](lessons-learned.md).

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
compounding one — see [known-debts.md](known-debts.md).

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
what each version cost, in [settled-decisions.md](settled-decisions.md).*

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
commit of their own — see [known-debts.md](known-debts.md). `wdl fmt` wrote two
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
Reasoning in [settled-decisions.md](settled-decisions.md).

**The display half was not free, which this item and
[builder-ux.md](builder-ux.md) both predicted it would be.** "The load would
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
  the `line undefined:` debt in [builder-ux.md](builder-ux.md), and adding a
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
  written up in [known-debts.md](known-debts.md).
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

**2. Results.** The largest piece, and the one that makes `progress` mean
something. The board already knows the position and has the clock; a result is
what it tracks, written down. Identity was settled long ago (§3.2.1: any unique
string, optional `namespace:` prefix, never derived from content).

**It is also what load progression is waiting on**, and that framing is worth
carrying into the design. A workout is a *class*; an execution with a person's
loads on it is an *instantiation*. Nothing in the analysis layer reads an
absolute load today and that is correct — reps, distance, calories and seconds
are properties of the class, and the weight on the bar is not one. A load a
reader would want ramped week over week is a fact about a **result**, so
`Dimension` gaining a `load` is part of this item rather than a gap in
`goals.ts`. The exception, already handled, is a load the author wrote into the
file: an rx split or a `variants:` entry is part of the class, which is why
divisions resolve at the workout layer (spec §10.1). Reasoning in
[settled-decisions.md](settled-decisions.md), settled 2026-08-19.
*Touches: a new module, `apps/display/`, and `progress` in goals.ts.*

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

**4. Curate the generation pool.** `mark-core` scored 178 movements in on source
agreement, which is a proxy for "commonly catalogued", not "worth putting in a
workout" — `Quad Stretch` made the cut. Bounded, and it makes generation
trustworthy.
*Touches: `registry/movements.json`, `scripts/mark-core.mjs`.*

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

**6. A load can be a word, and the language has no scale for it.** `@ heavy`
parses to a raw target: held, round-tripped, displayed, and inert — no volume, no
per-muscle load, nothing `progress` can ramp. Same holding answer as `@ 95`, and
better justified, since `heavy` is not a number at all. But `heavy` / `moderate`
/ `light` / `unloaded` are a small closed vocabulary coaches use constantly, and
a carry prescribed by feel is the *normal* way to write a carry rather than an
omission.

The decision is whether qualitative load is a **category the language knows** —
in which case it is a `Load` kind alongside absolute and relative, and a
sensible-but-unresolvable one that analysis can at least count as loaded — or
stays raw, in which case a carry can never contribute to volume and that should
be said in the spec rather than discovered. Note the interaction with item 5:
both showed up in the same workout, and a carry hit by both contributes *nothing*
to any analysis while validating clean. Raised 2026-08-15.
*Touches: `packages/core/src/ast.ts`, `units.ts`, `volume.ts`, `muscles.ts`,
`format.ts`, `spec/spec-0.1.md`.*

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

**8. A cap is a clock, and the board does not run it.** Open 25.2 on the board
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

*Ordering of 5, 6, 7 and 8 against 1–4 is not settled — they are appended rather
than placed, and 5, 6 and 7 were all raised by writing and sending one workout
rather than by a plan. **0f was lettered rather than numbered on purpose** —
grammar work, belonging with the 0-series — and both its halves are closed. The
one thing 0f left behind is `TABATA`, which is not an abbreviation to read but a
structure to define; it is written up under 0f rather than given a number,
because nobody has asked for it yet.*

*As of 2026-08-23, items 0–1a and 3 are closed here, which leaves **2 (Results)
at the head of the queue and 4 behind it**. A caveat rather than a fact: the
session that closed item 3 was briefed that item 2 was already done, and this
tree has no commit for it and no `results` module — so either the briefing was
wrong or Results landed somewhere this branch has not seen. Worth one look before
starting it rather than one discovery halfway through.*

**Nobody has run a session off the board.** Everything is verified by tests and
by driving the UI. Every defect Chris has caught by *looking* — `21 Thruster`,
the AMRAP clock, the run-on notes — was invisible to 1257 tests. A real session
will reorder this list.
