# Ready to pick up

The queue. Each of these is self-contained enough for its own session, roughly
in the order I would take them. Load this when starting a session with no task
named; when one lands, take it off this list and say so in
[what-exists.md](what-exists.md).

**0. Explore expressing the grammar in a formal, implementation-agnostic
specification language.** Ordering not settled — raised as a candidate *first*
task, listed here as 0 rather than renumbering the rest. Exploration, not a
build: the deliverable is an answer about whether a formalism fits, not a
rewrite.

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
