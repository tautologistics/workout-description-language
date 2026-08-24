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

**2. ~~Results.~~ DONE 2026-08-23.** A `.wdlr` record in the same line grammar
as a workout, a goals file and a program; the board writes one when a session
ends; and `measure: load` reads a series of them. The class/instantiation
framing the item asked to carry into the design carried the whole way: the head
of a result names what it is a result *of*, a `snapshot:` holds the workout text
verbatim, `instantiate()` applies the division and then the recorded loads, and
everything downstream reads an ordinary workout. Spec
[results-0.1.md](../../spec/results-0.1.md); decisions in
[settled-decisions.md](settled-decisions.md); 1742 → 1773 passing, 1 pending.

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
`notes:`, and [not-built.md](not-built.md) says so.

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
[settled-decisions.md](settled-decisions.md).
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
[settled-decisions.md](settled-decisions.md), which also carries the heat-scale
decision the item asked for. One touch outside the stated scope: the board's
`canonicalMovements` fetch, previously lazy, is now eager (not awaited) because
the map wants an attribution for every cue; see
[known-debts.md](known-debts.md).
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
  what the merges cost, are in [known-debts.md](known-debts.md); why the
  mechanism is a field rather than a reading of the alias already there is in
  [settled-decisions.md](settled-decisions.md).
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
[../movement_registry_design.md](../movement_registry_design.md) §3 calls the
whole point of the resolver could never fire. Nobody was told. The two tiers are
now the other way round, an explicit alias outranks a record's own name, and the
reasoning is in [settled-decisions.md](settled-decisions.md).

**Fourteen contested names, not five, and that is the first thing to say.** The
item was written against merge work this branch did not have, so the nine pairs
it expected to be gone were still two records each when the ranking landed, and
the verdicts it said were in [known-debts.md](known-debts.md) were not yet in
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
