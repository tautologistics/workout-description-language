# Design decisions that are settled

Closed questions, and what each answer buys. Read this before changing how
something is structured: reopening one of these needs a reason better than "it
would be tidier".

- **Intent lives outside the workout.** Goals are a separate artifact. The same
  workout is good against one intent and bad against another, which is unsayable
  if the intent is inside the file.
- **Two-phase parse.** `readLines` turns indentation into a tree and knows
  nothing about workouts; phase 2 is an ordinary line grammar over it. This has
  paid for itself three times: workouts, goals and programs are each a grammar
  over the same reader.
- **`src/` is portable and is handed its data.** Enforced by a test. It decays
  the moment one module adds one convenient import, and the Node suite would keep
  passing while the browser broke.

  *Sharpened 2026-08-15, because that is exactly what happened.* The rule is now
  stated as **`src/` imports by relative path and no other way**. The old test
  looked for `node:`, which is one way to be unportable and not the general one:
  `import * as ohm from 'ohm-js'` sat in `src/grammar/` through a green suite and
  reached `build/web/core/` intact, because a browser has no resolver — no
  `node_modules`, no import map unless a page writes one — and `node:fs` and
  `ohm-js` fail there in the same way. `portable.test.ts` and
  `scripts/build-web.mjs` now read every specifier in a file and fail on any that
  does not start with `.`, naming the file and the specifier.
- **The dependency rule binds the shipped core, not the repository.** The rule
  is: **`packages/core/src/` has no external dependencies**, because it ships
  into a server, a browser and eventually a mobile app, and a dependency there
  is a dependency in all three. That is the whole of the rule. It says nothing
  about the toolchains that *produce* those files — a `package.json` with as
  many dependencies as a job needs is fine for building, generating, testing or
  bundling, and always was. "This repo has no dependencies" is a
  misstatement of it: the repo is more than the library it ships.

  *Recorded 2026-08-14, after the loose phrasing was read as a repo-wide ban and
  nearly bought a hand-written PEG engine that a build-time generator already
  does. See [lessons-learned.md](lessons-learned.md).*
- **The text is the document.** Structural edits splice lines in place rather
  than regenerating from the AST, so comments and spacing survive. Canonicalising
  is a button, never a side effect.
- **The board renders source text, line for line.** Not the parsed structure. If
  the format only works once a program has reformatted it, the format has failed.
- **Movement identity survives spelling.** `fold()` depluralizes, so `Pull-Up`
  and `Pull-Ups` resolve to one record. Pluralization is how a name *reads*.
- **The grammar is written in PEG, and the notation carries no actions.** Settled
  2026-08-14 by the exploration in
  [../grammar-exploration.md](../grammar-exploration.md). PEG rather than EBNF
  because WDL's rules are inherently *ordered* — `each arm` before bare `each`,
  `min` before a bare `m` — and EBNF's alternation is unordered, so every such
  rule would need a prose caveat beside it, which is prose beside an
  implementation again. In PEG the ordering *is* the specification. The grammar
  file holds no semantic actions, so it stays readable as a contract and
  portable; what each production contributes to the AST is a separate mapping.
- **The grammar is an Ohm grammar, executed by `ohm-js`, with the semantics in
  a separate file.** Ohm's defining property is the one the spec needs: it
  *completely separates grammars from semantic actions*, so the grammar file is
  pure — it is the normative spec and the thing the parser runs, with no
  generation step between them and nothing to drift. What each production means
  is a sibling semantics file, and a second operation over the same grammar is
  how the builder's modifier affordance gets built later without a second
  derivation.

  `ohm-js` is MIT, has **zero dependencies of its own**, and ships as a single
  95K file. It is a runtime import inside `packages/core/src/`, which is a real
  crossing of the boundary above — accepted because it is one self-contained
  file, not a dependency tree, and because the escape hatch is cheap: if the
  no-imports line ever has to be absolute, `ohm.min.js` can be vendored into the
  core outright. That the decision is reversible in both directions is what
  makes it safe.

- **The escape hatch was taken: `ohm-js` is vendored into
  `packages/core/src/grammar/vendor/` and imported by relative path.** Settled
  2026-08-15. `ohm.min.js` is ohm-js **17.5.0** verbatim (95,683 bytes,
  `sha256 c1422e11…`), with its `LICENSE`, its `index.d.ts` as `ohm.d.ts` for the
  editor, and a twelve-line `ohm.js` beside them turning the UMD bundle into
  named ES exports. It is no longer a dependency in `package.json`, and the repo
  needs no `npm install` again.

  **Why, and it is not tidiness.** A dependency the shipped core is *allowed* is
  not automatically one the browser emit can *resolve*. `build-web.mjs` does no
  module resolution — deliberately, and its header says so — so the bare
  specifier reached `build/web/core/` and a browser answered *"Failed to resolve
  module specifier"*. Vendoring is the only one of the three fixes that needs
  nothing at the other end: a relative path resolves in Node, in a browser, and
  in whatever loads these files next, and it makes *"`src/` has no bare
  specifiers"* literally true, so the rule above is a rule a test can state
  rather than a list of ways to break it.

  The two rejected, with what they cost: an **import map** in each app's HTML is
  two places to maintain and one per future embedder, so the core stops being
  self-contained — the property `src/` exists to have. **Teaching build-web.mjs
  to resolve modules** fights that file's stated design (*"that the emit is this
  trivial is the point"*) and buys a resolver for one specifier.

  The costs, stated: 95K of someone else's minified code is in the source tree,
  and refreshing it is a manual copy (`vendor/README.md` has the recipe and the
  hash). `ohm.js` leaves `ohm` on `globalThis`, which is what the UMD does and
  what a `<script>` tag would do. It was settled while there was **one** import
  site, on purpose: item 0c adds modules under `src/grammar/`, and each would
  have been another one.

  *Settled on evidence: the step-line grammar reproduces the current parser's
  AST on 538/538 lines — every step line in the corpus, every step form in the
  spec, and the exotic forms neither exercises.*

  *Strengthened 2026-08-15. The semantics that produced that number lived
  outside the repo and are now `packages/core/src/grammar/step-semantics.ts`,
  with `test/grammar.test.ts` re-deriving the number on every run rather than
  asserting it: **746/746** over a wider set, plus seven lines listed as
  deliberate disagreements. One thing the decision did not anticipate: a
  dependency the shipped core is allowed is not automatically a dependency the
  browser emit can **resolve** — `build-web.mjs` does no module resolution, so
  a bare specifier survives into `build/` unusable. That is a debt, not a
  reopening; the vendoring escape hatch above is one of its two fixes.*

  *Closed 2026-08-15 by taking that escape hatch — see the entry below. The
  grammar module now loads and parses in a browser, confirmed by loading it.*

  *Corrected twice on 2026-08-14, the day it was settled. It first read "an
  in-repo PEG interpreter, not a generator", reasoning from "the repo has no
  dependencies" — which is not the rule, see the dependency entry above; that
  would have hand-written a PEG engine that libraries already provide. It then
  read "peggy, generated parser checked in", which is a sound option and was
  rejected only on comparison: peggy embeds semantic actions in the grammar, so
  the pure spec would have to be generated from it by stripping them, and it
  checks 128K of generated JS into the source path. Ohm needs neither.*

- **The grammar is the parser, and it reaches the core the way data does.**
  Settled 2026-08-15 by queue item 0a. There is one reading of a WDL line in the
  project: `parse.ts` matches `spec/grammar-0.1.ohm` and walks it. The grammar
  *text* is a `CoreData` key beside the movement registry — `node.ts` reads the
  file, a browser fetches it, `required('grammar')` throws by name if nobody
  hands it over — because the rule that `src/` opens no files does not bend for
  the file it needs most. `wdl()` compiles it once and keeps the result, keyed on
  the source text so a host that swaps the grammar gets a parser for the one it
  swapped in.

  **What stays hand-written is the assembly, and that is a boundary rather than
  a gap.** Which score an `on cap:` line qualifies, which variant a field belongs
  to, which block a child belongs to, and the `parseNode` dispatch that decides
  which *kind* of line this is. Those are questions about several lines, and this
  is a grammar over one — the same division that keeps `readLines` free of WDL
  knowledge. The eighteen regex literals left in `parse.ts` are all of that kind.

- **A compound score has two spellings, and a nested block is not one of them.**
  Settled 2026-08-15 by queue item 0e. `score: time` with `on cap:` and
  `tiebreak:` on the lines beside it, or `score: {primary: time, on cap: reps}`
  inline when it has to be one line — a few lines, or one line, which are the two
  cases that exist. Spec §9.5 and §9.6 illustrated a third for a while, a
  key-and-value block indented under a bare `score:`, and **no implementation ever
  read it**: the fields were dropped and `wdl check` said ok.

  **The prose was corrected rather than the parser**, and on the whiteboard
  constraint rather than on cost. An indented block is the same object the brace
  form is, in the notation the format exists to avoid; the project had already
  ruled that a canonical output which grew braces around a compound score was a
  *bug* rather than a formatting choice, and this fails that test identically. It
  buys no expressiveness — the same three fields — and since the formatter emits
  sibling lines it could only ever have been an input form rewritten away on the
  first pass. *Cheapness was not the argument; the expensive answer would have
  been right if the form said anything the other two cannot.*

  What did **not** survive the decision is the silence: a line indented under
  `score:` is now named in an error, at both call sites, and the bare `score:` it
  leaves is reported as `score-without-primary`. Declining a form is not a licence
  to drop what somebody wrote.

- **Unknown text is held, inert, and *said out loud* — as a `note`, a fourth
  diagnostic severity.** Settled 2026-08-15 by queue item 0d. A modifier no rule
  reads is kept verbatim in `Step.unknown` / `Block.unknown`, round-trips, and
  reaches nothing that derives meaning — not the timeline, so not a cue, not an
  export and not the analysis. And it is **reported**: `wdl check` says *note:
  `unbrokn` is not something the language reads*, and the builder shows it in the
  margin's dim colour.

  **The question the framing left open was whether anyone is told.** *"Not an
  error and not a guess"* settles what the tree does and says nothing about
  silence — and silent was the wrong answer: `10 Thruster, unbrokn` is one
  keystroke from a constraint that decides whether a set counts, and a person
  writing on a whiteboard is worse off being told nothing. The precedent is the
  nested `score:` decision three entries above: **declining to give a form
  meaning is not a licence to drop what somebody wrote**, and the same holds for
  declining to give it *any* meaning.

  **Why a fourth severity rather than one of the three.** Not `error` — the rest
  of the line executes exactly as written, and the board and `wdl check` both
  gate on errors, so a phrase in the margin would refuse a workout. Not
  `warning` — "probably wrong" is a claim, and four corpus workouts carry
  deliberate prose the language models nothing of (`45lb plate overhead`), which
  is *allowed*: holding unknown text exists so that writing it is not a mistake.
  Not `question` — there are no readings to choose between. `note` claims
  nothing; it reports what happened and stops.

  **Where the line falls, because it is not "everything unrecognized".** An
  unrecognized header *kind* (`3 rounds of madness:`) stays a reported **error**,
  which it already was: the kind decides how the block executes, and failing to
  read it silently loses the three rounds. A *modifier* nobody taught the
  language costs nothing that runs. The test is what the miss changes about
  execution, not how unfamiliar the text is.

  **A consequence that was forced rather than chosen: canonical output writes
  `note: "…"`.** Once a bare phrase after a comma means *unrecognized*, the two
  cannot both round-trip bare — and unknown text is verbatim by definition, so
  the bare spelling is the only one it can have. The note is therefore what wears
  the marker. The exception is the three spellings the grammar reads back as
  notes on their own — `alternating`, `ramp …`, `wearing …` — which keep the bare
  form, because they read the same either way and `10 DB Snatches (split),
  alternating` is what a whiteboard says. **The position of an unknown is
  normalised, not preserved**: it is written after the modifiers that were
  understood. Text survival is the requirement; where it sat on the line is a
  fact about the input, and the formatter already normalises where every other
  modifier goes.

- **A comma with nothing after it separates nothing.** Settled 2026-08-15, while
  swapping the parser over, because it had to be: the old chain split on commas
  and let an empty piece fall through, so `10 Thruster,` and `3 rounds,:` had
  always worked by accident. Required in the grammar, a modifier after a comma
  made one stray keystroke cost the whole line's reading — its movement, its
  amount, its kind. `commaModifier` and `headerModifier` take an optional
  modifier. This is forgiveness at the *input* edge, in the same family as queue
  item 0b, and `wdl fmt` canonicalises the comma away.

- **`partner rotation:` is a block kind, and a team `alternating` still is not.**
  Settled 2026-08-15. Two athletes, two pieces of work at the same time, then
  they swap — spec §5.11.1. It looks like it reopens §5.11's refusal of a team
  `alternating` and it does not, because **§5.11's stated reason is that
  alternation does not generalise**: *"alternation only means anything for a team
  of exactly two, and says nothing a larger team can use."* That is an argument
  against putting it on `team of N`, not against the thing itself, and a block
  that is two athletes by definition never has to answer "what about four". It
  carries no count for the same reason. `team of N` is untouched, and its three
  qualifiers are not used inside a rotation — both athletes do everything by
  definition, `shared` would say the opposite, and `synchronized` means every rep
  performed together, which is what a rotation is not.

  **The harder objection is roadmap §2.5 — "when athletes swap is execution
  strategy" — and the answer is that here it is not.** That line was written
  about a team splitting 100 wall balls, where how they carve it up genuinely is
  their business. In a rotation one athlete's work *bounds* the other's:
  `1 Dead Hang` has no length of its own, it lasts exactly as long as the partner
  takes to pull the sled down and back. Take the alternation away and what is
  left is not a simpler prescription, it is a meaningless one. **The test is
  whether removing it leaves the steps still meaning something** — for the wall
  balls it does, here it does not.

  **Exactly two, as an error rather than a warning.** Three is not a longer
  rotation: with two athletes the third piece of work has nobody to be
  simultaneous with, so the block's whole claim would be false. **Two
  consequences are stated rather than left to fall out**: the timeline *warns*
  instead of computing a duration, because it cannot express "bounded by the work
  beside it" and inventing a length would be worse than saying so; and the block
  is `freeOrder`, because the two athletes take opposite orders so "which comes
  first" has no single answer — the same conclusion a tally block reaches from
  the other direction.

- **A line that is both a step and a block header is a block header.** Settled
  2026-08-15 by queue item 0b. Spec §2 has always said two things — a line
  beginning `- ` is a step, a line ending in `:` opens a block — and `- AMRAP
  3min:` satisfies both. The colon wins, because **a step never ends in one**, so
  it is the more specific signal, and because phase 1 has already given the line
  children on the strength of it: phase 2 disagreeing was the bug, not the input.
  Read as a step it became a movement named `AMRAP 3min:` and everything indented
  under it was dropped in silence. The dash is decoration on a nested block, as
  it is on a step, and `format` writes it back without one.

- **A file that was never indented is read, and the four rules that read it.**
  Settled 2026-08-15 by queue item 0b; stated in spec §2, rules 1–3 in
  `readLines` and rule 4 in `parse`. **An empty block adopts whatever comes next,
  block or not**, because a block holds no work of its own and empty it is not a
  thing that can stand as anyone's sibling; this cascades through nesting.
  **Once it has content, a plain line cannot close it** — a step is not a
  container. **A block header closes it only if that header is flat too**, and
  when it closes it closes every enclosing block populated by adoption, landing
  where its own indentation puts it. **A `score:` line is not adopted at all.**

  **Rules 3 and 4 were both settled twice on the same day, and the corrections
  are the reusable part.** The first version had *every* block header terminate,
  and accepted absorption for *every* kind of line. Both were decided against
  invented examples and both were wrong on the first real workout typed into the
  builder — a `For time:` buy-in with a nested `AMRAP 20min:` and a trailing
  `score:`, written half-indented: the AMRAP indents its own body but was never
  indented under the for-time. That file came out as three top-level things
  rather than one, and the trailing score landed on the block. **Neither the
  suite nor the 190-workout corpus could see it, because no example file is
  written that way.**

  **Rule 3's signal is that a block which indents its own body was written the
  ordinary way**, and something written the ordinary way inside a flat run is in
  the run rather than beside it. That is what separates the half-indented file
  from flat `warmup:`/`conditioning:`/`cooldown:` sections, where nothing is
  indented at all and the sections are siblings. Its cost is stated rather than
  hidden: **in a half-indented file nothing returns to the outer level**, so a
  `cooldown:` with an indented body after a flat `conditioning:` lands inside it.
  Without indentation one of the two shapes is inexpressible either way, and that
  is correct — this is forgiveness, not a second syntax for nesting.

  **Rule 4 is not a special case for convenience; absorbing a score does
  damage.** `for time:` is stored as a sequence carrying an *implied* `time`
  score, so a `score: rounds` landing on it overwrites the header's own kind and
  the block comes back out of the formatter as `sequence:`. A score is a
  statement about the whole rather than work in the block, and in a flat file the
  only whole that can be reached is the workout.

  **A header that lands somewhere its indentation did not put it is reported**,
  as a `note` — the severity 0d created for held-and-inert, applied to a
  *structural* guess for the same reason. Only the header, not every adopted
  line: a note per line in a deliberately flat file is noise.

  **What does not move is a file that *did* indent** — a dedented line there is a
  deliberate one, which is the only reason `score: time` under Fran is still the
  workout's.

  **Phase 1 keys on the trailing `:` and nothing else.** That is syntax rather
  than semantics — true of every kind of block without naming any of them — which
  is what keeps `readLines` free of WDL knowledge and phase 2 an ordinary line
  grammar (roadmap §5.1). A list of block keywords in phase 1 would have bought
  the same behaviour and cost the property the two-phase split exists for.

- **A score with no primary is written in braces.** Settled 2026-08-15, and it is
  the one exception to *"canonical output never writes a compound score in
  braces"* — forced by the rule above rather than chosen. The sibling spelling
  needs a head line to hang the siblings off, and a score that named only a
  tiebreak has none: the head comes out as a bare `score:`, which *opens a
  block*, so the `tiebreak:` under it is read as the nested form the language
  declines and one `wdl fmt` loses it. A score with no primary is therefore a
  score that has to fit on one line, which is precisely what the brace spelling
  is for. `score: {tiebreak: reps at 5min}` is now its own fixpoint.

What was *tried* and turned out wrong is in
[lessons-learned.md](lessons-learned.md); what is not built on purpose is in
[deliberately-not-done.md](deliberately-not-done.md).
