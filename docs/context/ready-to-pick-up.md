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

**0b. A container should adopt following lines that were never indented.**
Listed beside item 0 because it is the same family — forgiveness at the input
edge — and because the rule has to be *stated* in whatever item 0 produces.
Ordering not settled; lettered rather than renumbering.

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

**1. `rx` should desugar into `variants:`.** Step-level `(women 105lb / men
145lb)` and workout-level `variants:` are two mechanisms for one idea. `rx`
should lower to a variant so `--variant women` covers both and exporters need
know about only one.
*Touches: `packages/core/src/parse.ts`, wherever variants are resolved.*
Raised in priority by what driving the builder turned up: because `stepCue`
reads `targets` and never `rx`, an rx-split load is invisible in *both* apps
today. Settle what a step reads as when no division is chosen — see
[builder-ux.md](builder-ux.md).

**2. Results.** The largest piece, and the one that makes `progress` mean
something. The board already knows the position and has the clock; a result is
what it tracks, written down. Identity was settled long ago (§3.2.1: any unique
string, optional `namespace:` prefix, never derived from content).
*Touches: a new module, `apps/display/`, and `progress` in goals.ts.*

**3. A capped for-time reports `duration` where it means "at most".** `run()`
does not expose the cap separately from a computed total. Same class as the
AMRAP `duration`/`window` conflation, one step along.
*Touches: `packages/core/src/run.ts`, `apps/builder/builder.js`.*

**4. Curate the generation pool.** `mark-core` scored 178 movements in on source
agreement, which is a proxy for "commonly catalogued", not "worth putting in a
workout" — `Quad Stretch` made the cut. Bounded, and it makes generation
trustworthy.
*Touches: `registry/movements.json`, `scripts/mark-core.mjs`.*

**Nobody has run a session off the board.** Everything is verified by tests and
by driving the UI. Every defect Chris has caught by *looking* — `21 Thruster`,
the AMRAP clock, the run-on notes — was invisible to 1257 tests. A real session
will reorder this list.
