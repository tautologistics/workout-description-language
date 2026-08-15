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

**0a. Wire the grammar up. This is the next one.** *Was half done 2026-08-15;
0c has since landed, so the reason it was deferred is spent.* The grammar runs
inside `packages/core/` over **every kind of line phase 2 reads**, checked against
the hand-written parser on every line the project has (see 0c below for the
numbers). `parse.ts` is deliberately untouched and both apps run the old path.

**The deferral is over.** It was deferred because steps and block headers share
their lexical layer, so landing steps alone would have meant reworking the step
semantics once headers forced those productions apart. Headers have now forced
them, the step numbers held through it, and the layer is shared in one place. The
swap is the next thing.

What is left of 0a:
- `parseOneStep` and `parseStep` delegate to the grammar; `splitOr`,
  `peelRx`, `peelTrailingQualifiers` and `applyQualifier` go. `parseHeader`,
  `applyBlockModifier`, `parseRest` and `parseScore` follow, and with them the
  `SECTIONS` set and `expandRuns`' second caller.
- **The swap fixes two known defects by itself** — the `@`-plus-digit family and a
  header target after a comma — because the grammar already reads both correctly.
  That is now an argument *for* doing it rather than a consequence of it.
- ~~The browser cannot resolve `ohm-js`.~~ **Done 2026-08-15**, ahead of 0c
  because 0c multiplies the import sites. `ohm-js` is vendored into
  `src/grammar/vendor/` and imported by relative path; the emitted module loads
  and parses in both apps. See [settled-decisions.md](settled-decisions.md).
- **The grammar source has to reach the core.** Still open, and the only piece of
  plumbing left before the swap. `src/` opens no files and knows no paths, so
  `makeParser` is handed the grammar text; a host must supply it (`node.ts`
  reads `spec/grammar-0.1.ohm`, the web app fetches it), most likely through the
  same `provide()` seam as the registry. Both halves are known to work — the
  suite reads the file, and a browser fetches it from `/spec/grammar-0.1.ohm`
  (`serve.mjs` now serves `.ohm` as text) — but nothing wires them together.
- **The 20 listed disagreements are the diff to expect in `vocabulary.json`**, and
  every one is pinned, so the diff should be read rather than feared. Nine are the
  swap *fixing* something — the `@`-plus-digit family, the comma-target pair, the
  five `rx`-plus-qualifier lines, the header target after a comma. Four are the
  parser's right-to-left application becoming left-to-right (`10 Deadlift unbroken
  building`, `10 Deadlift building @tiebreak`, `5 Squat (both) each leg`, `max Row
  until HR < Z1`). Two are the grammar being *wider* (`10-5 Squat`,
  `20calories Row`); if that is not wanted, it is a validation rule, not a grammar
  one.
*Touches: `packages/core/src/parse.ts`, `src/env.ts`, both apps.*

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

**0d. Give `unknown` somewhere to live.** The grammar holds unrecognized text as
a first-class production, but `Step` has no field for it and `format` does not
render it, so the known debt — unknown modifiers indistinguishable from authored
notes — is not closed end to end. Needs an AST field, formatter support, and the
board and builder leaving it inert. *It has a block-level twin as of 2026-08-15,
found while stating the header: an unrecognized header modifier lands in
`block.flags`, beside `unbroken` and `rounds`, so nothing afterwards can tell an
unknown token from a flag the language defines. Both halves belong to this item.*
*Touches: `packages/core/src/ast.ts`, `format.ts`, both apps.*

**0e. Five defects the grammar work turned up that need a decision, not a
transcription.** Each is written up in [known-debts.md](known-debts.md) with what
it costs and where the fix goes; each is pinned as a vocabulary form, so a fix
shows up as a diff. They are listed together because they were found together and
are individually small, not because they should land together.

- **Leading `sets x reps`.** `5x5 Back Squat @ 225lb` — *spec §1's own example* —
  parses to a movement named `5x5 Back Squat`. Reading it needs a new leading
  quantity form in the grammar and a decision about what it means (`sets: 5` plus
  `reps: 5`, presumably, matching the trailing `xN`). The biggest of the five, and
  the one a real user hits first.
- **`wdl fmt` drops `after last`** from every kind of rest but a plain duration.
  A formatter fix and small; do it first.
- **The nested `score:` block spec §9.5 documents is dropped entirely.** Either the
  prose goes or the parser learns it. The sibling-line spelling is what the
  formatter emits, so the cheap answer is to correct the spec.
- **A brace score with no `primary:`** makes the whole brace text the primary and
  emits the tiebreak twice.
- **A spelled-out duration word is a step quantity and not a rest.** One
  `units.ts` change and a matching grammar rule; both readings inherit it.
*Touches: `packages/core/src/units.ts`, `format.ts`, `parse.ts`,
`spec/grammar-0.1.ohm`, `spec/spec-0.1.md`.*

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
