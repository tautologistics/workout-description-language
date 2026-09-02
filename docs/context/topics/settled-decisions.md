# Design decisions that are settled

Closed questions, and what each answer buys. Read this before changing how
something is structured: reopening one of these needs a reason better than "it
would be tidier".

The twenty-one structurally significant decisions carry a `DEC-NNN` heading and
are indexed with a one-line summary in [../decisions.md](../decisions.md);
every decision below — headed or not — is equally settled, the heading only
marks the ones worth a top-level pointer.

### DEC-001 Intent lives outside the workout
*Status: active.*

- **Intent lives outside the workout.** Goals are a separate artifact. The same
  workout is good against one intent and bad against another, which is unsayable
  if the intent is inside the file.

### DEC-002 Two-phase parse
*Status: active.*

- **Two-phase parse.** `readLines` turns indentation into a tree and knows
  nothing about workouts; phase 2 is an ordinary line grammar over it. This has
  paid for itself three times: workouts, goals and programs are each a grammar
  over the same reader.

### DEC-003 `src/` is portable and is handed its data
*Status: active. Sharpened 2026-08-15.*

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
### DEC-004 The dependency rule binds the shipped core, not the repository
*Status: active. Recorded 2026-08-14.*

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
### DEC-005 The text is the document
*Status: active.*

- **The text is the document.** Structural edits splice lines in place rather
  than regenerating from the AST, so comments and spacing survive. Canonicalising
  is a button, never a side effect.
- **The board renders source text, line for line.** Not the parsed structure. If
  the format only works once a program has reformatted it, the format has failed.
- **Movement identity survives spelling.** `fold()` depluralizes, so `Pull-Up`
  and `Pull-Ups` resolve to one record. Pluralization is how a name *reads*.
- **An alias is another spelling of one movement — never a claim that two
  records are the same one.** Settled 2026-08-22, during the alias pass over the
  core. `Back Squat` does not fold into `Squat`: the registry holds both and they
  are different lifts, so a name that is a movement in its own right stays a
  record and never becomes an alias of another. Fourteen candidates in that pass
  were rejected on this rule alone — `Military Press`, `Barbell Row`,
  `Handstand`, `Upright Row`, `Bicycle Crunch` among them — and each would have
  redirected a real movement into a different record's muscles while `wdl check`
  said nothing.

  **The rule holds even when the two records really are the same movement**, and
  that is the part that is easy to get backwards. `shoulder-press` carries the
  alias `overhead press` and the merged corpus also holds `Overhead Press`; the
  alias is *right* about them being one lift and is still the wrong instrument.
  `Registry.lookup()` tries ids before aliases, so the claim is discarded in
  silence rather than honoured. Sameness needs a merge, which is a thing the
  registry cannot yet express — see [known-debts.md](known-debts.md). **The fix
  for such a pair is to merge the records, never to delete the alias**, which is
  the tempting reading of "no collisions" and would throw away a curator's answer
  to keep a checker quiet.

  What *is* an alias: an abbreviation (`t2b`, `rdl`, `hspu`), a regional or
  colloquial spelling (`tyre flip`, `australian pull-up`, `prowler push`), or a
  word order the token matcher does not reach. `node scripts/check-aliases.mjs`
  reports every alias that stops pointing somewhere unique.
### DEC-006 The grammar is written in PEG, notation carries no actions
*Status: active. Settled 2026-08-14.*

- **The grammar is written in PEG, and the notation carries no actions.** Settled
  2026-08-14 by the exploration in
  [../grammar-exploration.md](../../grammar-exploration.md). PEG rather than EBNF
  because WDL's rules are inherently *ordered* — `each arm` before bare `each`,
  `min` before a bare `m` — and EBNF's alternation is unordered, so every such
  rule would need a prose caveat beside it, which is prose beside an
  implementation again. In PEG the ordering *is* the specification. The grammar
  file holds no semantic actions, so it stays readable as a contract and
  portable; what each production contributes to the AST is a separate mapping.
### DEC-007 The grammar is an Ohm grammar, semantics in a separate file
*Status: active.*

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

### DEC-008 ohm-js is vendored, imported by relative path
*Status: active. Settled 2026-08-15.*

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

### DEC-009 The grammar is the parser, reaches the core like data
*Status: active. Settled 2026-08-15 by queue item 0a.*

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

### DEC-010 Unknown text is held, inert, and said out loud as a note
*Status: active. Settled 2026-08-15 by queue item 0d.*

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

  **Extended 2026-08-28 to the inline-body forms.** The 2026-08-15 fix only
  covered a line *ending* in `:`. `- work 20s: Pull-Up`, `- min 1: 12cal Row`
  and `- every 1min: 5 Burpee` — a dash on the one-line "header, then its single
  child after the colon" form — still hit the `/^-\s+/` step branch first and
  became movement-named steps with the block (or overlay) dropped, no
  diagnostic. `parseNode` now strips the dash from these three the same way,
  since `format` already emits them dashless and `wdl fmt` was settling on the
  loss. A *general* inline block body (`AMRAP 3min: 10 Push-Up`,
  `for time: 50 Burpee`, `21-15-9: Thruster`, dashed or not) is still a step:
  only `min`/`work`/`every` and the brace form carry a body on the header line,
  so there is no rule to read it as a block. Found by driving the builder
  — the per-block `»` affordance now reaches the dashed rows. Tests in
  `packages/core/test/corpus2.test.ts`.

  **Extended again 2026-08-28: that general one-liner is now *reported*, not
  silent.** It was the one remaining silent mis-parse in this family — `tryStep`
  took the whole string (`"AMRAP 3min: 10 Push-Up"`) as a movement name,
  `quantity: open`, no error, so an AMRAP scored as one open-ended movement and
  `wdl check` said nothing. `parseNode` now probes the text before the first
  colon: if it parses as a recognized block *kind* (not the catch-all
  `headerName`, so `- 1:30 Row` and a `note: "…"` modifier don't trip it) and
  there is text after the colon, it emits *"`AMRAP 3min:` opens a block — put
  its body on the next line, indented, or use the brace form"*. The line still
  parses as the held step (the text survives, as an unresolvable name always
  does) — only the silence is fixed. **Supporting the one-liner** (a real
  `amrap` block with one step) was the other option and was declined: no corpus,
  spec or template file writes it, and it needs a grammar change plus a
  canonical-output / round-trip decision, for a form that only ever helps a
  one-movement AMRAP — the same rarity that kept AMRAP out of the `min`/`work`
  inline special-case in the first place. *Until 2026-08-29 the probe also
  caught the bounded interrupt overlay (`every 1min until failure: 5 Burpee`),
  which the overlay regex could not read; the next entry closes that — a bounded
  overlay now parses, so it never reaches the probe.*

- **The one-line interrupt overlay states its bound the way a clock header
  does.** Settled 2026-08-29, closing the [known debt](known-debts.md) of the
  same name. `every 1min: 5 Burpee` (spec §5.8) already parsed as an `Interrupt`,
  but `parseNode` read it with a one-token regex (`/^every\s+(\S+):\s*(.+)$/i`)
  that stopped at the interval, so the `every` grammar rule's bound tails —
  `x <n>`, `for <dur>`, `until failure` (spec §5.5) — were unwritable on one
  line and fell into the "`<header>:` opens a block" diagnostic instead.

  **Two calls, both made toward one spelling.** (1) The bound lives on
  `Interrupt` in the **same field names `Block` uses for a clock** — `count?`,
  `duration?`, `untilFailure?` — not a parallel vocabulary. The overlay and the
  block header state the *same* bound; giving it two shapes is the mistake the
  project already refused for an rx split vs a `variants:` table and for
  `sets x reps` vs spelled-out sets. (2) `parseNode` reads the head before the
  colon by handing it to the grammar's own `every` production through
  `tryHeader` — the block path's exact reader — and copies the bound off the
  resulting block. No second hand-rolled bound parser: "the parser is the
  grammar" means a new form is a new grammar rule, not a new regex chain, and
  this form already had its rule. A colon with nothing after it stays the block
  form and still goes to the header branch.

  **Canonical spelling mirrors the clock header**, minus the `EMOM` sugar — the
  overlay keeps the `every …` prefix it is parsed by, so `every 90s for 20min:`
  does not normalise to `E…MOM`. `format` writes `until failure` before a
  window before a count, the precedence `headerText`'s `clock` branch uses;
  every form round-trips.

  **The bound reaches the timeline but not the estimate.** `group.interrupt`
  carries `count` / `window` / `untilFailure` and `outline` prints them, so a
  display and a round trip see the bound. `estimate()` still ignores the
  overlay: an overlay is bounded by the primary work beside it, and whether its
  own bound ends the group first is a per-execution question the ordered
  timeline does not answer — the block path leaves the same question open for a
  bare `AMRAP:` under a cap. No corpus workout writes a bounded overlay, so
  `interpretations.json` and `registry/workouts.canonical.json` did not move.
  Tests: overlay twins of the `block/clock` vocabulary group in
  `test/golden/vocabulary.ts`, an `Interrupt`-shape check in
  `test/corpus2.test.ts`, a group/outline/estimate check in
  `test/timeline.test.ts`.

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

### DEC-011 An rx split lowers into the variant resolver, not the variants: table
*Status: active. Settled 2026-08-18, closing queue item 1.*

- **An rx split lowers into the variant *resolver*, not into the `variants:`
  table.** Settled 2026-08-18, closing queue item 1 — and it is a deliberate
  departure from how that item was written ("`rx` should desugar into
  `variants:`"). The literal reading is a rewrite: `(women 105lb / men 145lb)`
  becomes two movement-keyed entries. That loses information, because **a
  `variants:` entry is keyed by movement and a split belongs to a step**. A
  workout with two Thruster steps at different splits collapses to whichever was
  written last, silently — the exact class of defect the split itself was written
  to avoid. So the split stays on the step, the table stays as it was authored,
  and `divisions()`/`resolve()` read both. What the item actually asked for —
  one namespace, `--variant` covering both, exporters knowing one mechanism — is
  bought without the loss.

- **With no division chosen, a step reads as its at-rest text: both magnitudes,
  labelled.** Settled 2026-08-18 with Chris, and the question was worth asking
  because *no division is ever chosen in either app* — nothing there offers the
  choice, so this is not a default, it is the only state. Four candidates: show
  nothing (what it did, and it is showing up to a session with no weights on
  screen), show both, show both labelled, or pick a base. **Picking a base is
  the one to refuse**: prescribing one athlete's weight to everyone *looks*
  right, which makes it worse than showing nothing. Showing both is what a
  whiteboard does. Rendering it through the formatter's own `formatRx` rather
  than a second spelling settled the order question for free — `(105/65)` is
  read by magnitude and normalized to the labelled form, so echoing it
  positionally would hand back the ambiguity the labels exist to remove.

- **A `variants:` value is read as a target first and a movement second.**
  Settled 2026-08-18. Both readings end in prose — `parseTarget` returns `raw`
  for anything it does not recognize, and a movement name *is* that — so
  whichever is asked second has to prove itself. A target proves itself from the
  text (`102kg` is a load, `9ft` a height); a movement cannot, so it is checked
  against the registry, and a value that is neither is **reported and not
  applied**. The registry consulted is the curated one *and* the canonical merge,
  because `Ring Row` — spec §10's own example of a movement swap — is only in the
  merge, and consulting the curated registry alone made the spec's example
  unreadable.

### DEC-012 A workout is a class; an execution is an instantiation
*Status: active. Settled 2026-08-19 with Chris.*

- **A workout is a class; an execution is an instantiation, and load lives on
  the instantiation.** Settled 2026-08-19 with Chris, prompted by noticing that
  *nothing* in the analysis layer reads an absolute load — `muscles.ts` never
  touches `targets`, `goals.ts`'s "targets" are muscle groups, and `volume.ts`
  reads a load in one place, `atOrAbove`, which filters on a percentage and is
  therefore blind to `@ 225lb` by construction. Measured: `volume` and
  `muscleLoad` are byte-identical across an unresolved rx split, `women` and
  `men`.

  That is **correct at this layer**, not a hole in it. The written workout is the
  class — what the session *is*, the thing on the whiteboard, the same for
  everyone who does it. What weight a particular person puts on the bar on a
  particular day is the instantiation, and it belongs to whatever leads or
  records a session, not to the definition. Reps, distance, calories and seconds
  are properties of the class and so they are what the class is analysed by.

  **The exception is a load the author wrote into the workout** — an rx split or
  a `variants:` entry. That is part of the class, because it was stated in the
  file, which is exactly why divisions resolve at the workout layer (§10.1) while
  a person's working weight does not.

  What follows: **"ramp the squat load week over week" is a statement about a
  series of executions, not about a series of workout files**, so the missing
  `load` dimension in `goals.ts` is not something to add to `Dimension` — it is
  something that becomes possible when results exist. Queue item 2 owns it.
  Meanwhile `measure: load` is *reported* rather than silently swapped for
  `reps`; see [known-debts.md](known-debts.md) for what that fixed.

- **Choosing a division changes the headline and never the board text, and the
  board's own picker is where that choice lives.** Settled 2026-08-20, closing
  queue item 1a. The obvious worry is that this contradicts *"the board renders
  source text, line for line"*: pick `women` and the bar says `@ 105lb` over a
  line that says `(women 105lb / men 145lb)`. It does not, and the reason is the
  class/instantiation split one layer down. **In both spellings the text already
  shows every division at once** — the split on the step, the whole `variants:`
  table further down the file — so the board is showing the class and the bar is
  showing the face of it you are doing. The headline is picking one of the two
  numbers the line is already offering, not disagreeing with it. Nothing has to
  rewrite a line to make a division visible, which is why no exception to the
  rendering rule was needed. The chosen division leads the sub-line under the
  headline so the reason for the difference sits beside the number.

  **The choice rides in the hash, beside the workout.** Not because session state
  survives a reload here — it does not, and the queue item's claim that it did
  was measured false — but because a division is not progress through a session.
  It is *which reading of the file is on the screen*, and the hash is already
  exactly that. The share link carries the reading with it, which is a coherent
  thing to send: "today's HYROX, women's". See
  [lessons-learned.md](lessons-learned.md) for the premise that nearly sent this
  the other way.

  **Switching does not restart anything.** Cursor, clocks and lap count are all
  held: a reader who says `women` three rounds in is answering a question about
  the weights, not asking to begin again.

- **A result names what it is a result *of*, and carries the workout text
  verbatim.** Settled 2026-08-23, closing queue item 2. The roadmap sketch
  (§3.2) wrote `result:` as a header with a `workout:` field under it; the head
  now carries the id directly — `result: crossfit:fran` — and `snapshot:` carries
  the text. Two reasons, and the deviation is a spelling rather than a model
  change. A result has no title worth writing, because the workout already has
  one and the fact you want at the top of a log entry is which workout it is. And
  `workout:` beside `snapshot:` would have been two names for the same thing one
  field apart, which is what queue item 1 spent a day unifying elsewhere.

  **The id is optional and the snapshot is the anchor.** A workout written this
  morning has no `@id` and was still done: the snapshot is what makes the record
  self-contained, the id is what makes it findable, and a record with neither is
  refused. The snapshot is sliced out of the **raw source** by line and column
  rather than read through the line tree and re-rendered — everything the tree
  does to a line (dropping blanks, lifting comments onto their owner) is a
  change, and a snapshot that has been changed is a copy of what the formatter
  thinks *today*, which is exactly the reference §3.2.1 rejected.

  **Fields read both flat and nested, and that is forced rather than generous.**
  `result:` with no id ends in a colon, so phase 1 opens a container and every
  line after it is its child (spec §2). Accepting one shape would have made the
  id optional in the type and unwritable in practice.

- **A result's loads are applied after its division, and a movement swap is not
  read at all.** Settled 2026-08-23. The division goes first because the author
  wrote both weights into the file — resolving it is *reading* the file, which is
  the 2026-08-19 exception. The recorded load goes over the top because the file
  says 145lb and you did 125lb, and the record of what you did is the one that is
  true of you. Matching is by movement through the registry, which is
  `variants.ts`'s machinery **shared rather than copied**: `movementLookup`,
  `sameMovement` and `withTargets` are now exported, because a table keyed by
  movement and applied to the steps it names is one operation and two copies of
  it would drift.

  A `variants:` value may name a **movement to swap in**; a result's may not, and
  the asymmetry is deliberate. What a division prescribes is part of the class,
  because it was written into the file. What somebody substituted on the day is a
  *modification*, and whether modifications want structure or free text is an
  open question in the roadmap (§3.2) — reading one here would have settled it by
  accident, so it goes in `notes:` and the question stays open.

- **`measure: load` is the heaviest, in kilograms, and never multiplied by
  rounds.** Settled 2026-08-23. Every other dimension is a total and this one
  cannot be: three sets at 100kg is not 300kg of anything. The heaviest is also
  what the language already means by a load — spec §9.1 reads `score: load` as
  "heaviest successful" — so the precedent was in the format rather than invented
  for the rule. Kilograms because two loads in different units cannot be
  compared, converted once at the edge, which is why `at least: 10lb` is read as
  4.54kg rather than compared against a number in another unit.

  **What stays unreadable is what the 2026-08-19 objection was actually about.**
  The goals spec said load needed "a 1RM and a model that turns percentages into
  comparable work". That is still true of a *percentage*, and `85% 1RM`
  contributes nothing; so does an unlabelled magnitude, since `(105/65)` is a
  real prescription on a whiteboard and not a quantity anywhere else. What is now
  read is the **absolute** load, which needs no model — it is a number of
  kilograms somebody lifted.

- **A `progress` rule that sees nothing says so.** Settled 2026-08-23. `now >=
  prev * 1.025` is satisfied by two zeroes, so a ramp asked of a series that
  records no load passed in silence, which is the worst answer available.
  **Across the whole series, not per slot** — the first version was per slot and
  re-created the exact noise the slot mechanism exists to prevent: "ramp the
  pull" finds no lats on leg day *because leg day was never supposed to have
  any*. The suite caught it; see [lessons-learned.md](lessons-learned.md).

- **Each CLI verb states what its file arguments are, by extension.** Settled
  2026-08-23. Four record types share one `wdl`, and `fmt`, `check`, `timeline`
  and `export` read anything handed to them as a workout — so `wdl fmt -w` on a
  `.wdlr` parsed a training log's fields as steps and wrote the mangling back
  over it. A workout can be retyped and a goals file rewritten; a log of what
  somebody did cannot. **The extension is the whole of the check**, deliberately:
  sniffing the contents would be a fifth grammar guessing at the other four, and
  a file with no extension or an unexpected one is left alone, because the guard
  exists to catch `wdl fmt -w *` and not to police what anybody names a file.
  A template, whose extension is honest `.wdl`, is exactly where it was — see
  [known-debts.md](known-debts.md).

- **The board writes the record, and records only what it observed.** Settled
  2026-08-23. It held the clock and the cursor — the two things the core
  deliberately does not have — so it is the only thing in this project that can
  say how a session went. It writes the time, the splits, and — where the workout
  is scored by rounds — how many closed. It does **not** write a load: what the file prescribes is
  not evidence of what anybody lifted, and an absent field is not a claim. Where
  it cannot compute the declared score it says so in a comment and leaves the
  line to be typed, keeping the elapsed time in the comment so nothing measured
  is thrown away. A plausible number invented there would be software making
  something up about somebody's training.

  What it writes is the **format's own text in an editable box**, not a form and
  not a download that appears without being read. The whiteboard constraint
  applies to a result for the same reason it applies to a workout, and one layer
  further: you should be able to see what is being claimed about you.

### DEC-013 The generation pool is a judgement, not a score
*Status: active. Settled 2026-08-23, closing queue item 4.*

- **The generation pool is a judgement, not a score.** Settled 2026-08-23,
  closing queue item 4. `core` — what `wdl generate` fills a `?` from, and what
  the builder's palette shows with an empty search box — is the union of the
  three `mark-core` signals that are somebody's judgement: a workout in our
  corpus writes it, the curator wrote a record for it in
  `registry/movements.json`, or a vendor tracks a 1RM for it. There is **no
  threshold**, and catalogue evidence — sources agreeing, heading a family,
  absorbing duplicates — cannot put a movement in the pool however much of it
  there is.

  **The thing to not re-derive is that this is not a tuning knob.** `commonality`
  measures how well *attested* a record is, which is what deduplication needs and
  what it was built for; the pool asks whether the movement is worth writing into
  a round. No cut along the first orders the second — at 5 the pool loses
  `Sumo Deadlift`, `Face Pull` and `Pistol` and keeps `Smith Machine Squat`. If
  the pool is wrong again, the fix is a record in the curated seed or a signal
  that is a judgement, **not a new number**.

  **What follows: curation is how the pool grows.** `registry/movements.json` is
  the only place a person's judgement enters the pipeline, so a movement that
  ought to be generated and is not gets a record written for it. Eight were
  written the day this landed. That also means the curated seed now says two
  things — this is the authoritative record, *and* this belongs in the pool — and
  the file's `$sources.curated` note says so.

  **And the pool is not the language.** A movement outside it still validates,
  still carries muscle data, still analyses, and the palette still finds it the
  moment you type. Keeping the pool tight is safe precisely because typing
  reaches past it; that is the builder's own rule, and it is what makes a cut
  from 178 to 129 a narrowing of what is *offered* rather than of what is
  *possible*.

- **A bound and a length are two fields, and what decides between them is what
  ends the work.** Settled 2026-08-23, closing queue item 3. The tempting
  simplification is the one that was already in the code: a cap bounds the
  workout, so report it as the duration and be done. It is wrong in the way that
  matters most here, because the number then appears on a whiteboard-adjacent
  screen under a word that means something else — `duration: 12:00` over a file
  that says *at most* twelve. So `Timeline.cap`/`Run.cap` carry the bound,
  `estimatedSeconds`/`totalSeconds` carry the length, and **neither is ever
  filled in with the other**. A surface that can only show one number must choose
  explicitly and say which it chose; `wdl export --to connect` does, because
  Connect has one field and nowhere to say "at most".

  **The test is not "is there a cap" but "does the work end when the work is
  done, or when the clock is".** A bare `AMRAP:` under a cap runs until the clock
  stops (§5.6), so it ends *at* the cap and the cap is genuinely its length —
  both fields are set for that shape and only that shape. Asked the first way the
  fix needs an exception list and breaks `77-tiff.wdl`; asked the second way the
  exception falls out of the rule. That is `fillsTheClock()` in `timeline.ts`.

  **A cap counts only on the spine**, which is the rule already settled for a
  window: an only child of an only child, up to the root. A capped section
  between two others caps that section and says nothing about how long the
  workout may take. Nothing about a cap justified a second rule for the same
  question.

  *The spine half of this was contested and is the one part not unanimous.* A
  second branch fixed the same defect at the same time and chose the other
  representation — one number plus a `capped` flag — and with it the opposite
  composition rule, on the argument that an at-most **aggregates** where a window
  and a loop do not. This entry is what the merged code does; that argument is
  open in [known-debts.md](known-debts.md) rather than lost, because the two
  branches agreed on everything except this and only one of them can be true.

### DEC-014 An explicit alias outranks a record's own id
*Status: active. Settled 2026-08-23, closing queue item 8.*

- **An explicit alias outranks a record's own id.** Settled 2026-08-23, closing
  queue item 8, and it is the *reverse* of the order
  [../movement_registry_design.md](../../movement_registry_design.md) §3 had stated
  since it was written. The two are not the same kind of statement: a record's
  id and title say what *that record* is called, while an alias is a curator
  answering the question actually being asked — when somebody writes this
  spelling, whom do they mean. Where both answer, only one of them was written
  about the contested name.

  **The old order made the answer an accident of upstream naming.** In a merged
  corpus, whether a record's id happens to be the contested spelling is a fact
  about what Garmin called a row, not about movement. `Squat` found an imported
  record whose id is `squat`, equipment `Barbell`, and threw away `air-squat`'s
  alias saying a bare squat is the bodyweight one. Fourteen names went that way,
  and **all fourteen id-holders were imported and all fourteen alias-holders
  curated** — the rule and the provenance agree on every case in the data.

  **It was decided on the rule, not on the provenance, and that was the
  choice.** "A curated record's alias beats an imported record's id" reads more
  cautious and is worse: `sources` is written by the merge pipeline and
  `registry/movements.json` carries none of it, so in the very registry
  `validate` consults every record would count as imported and the rule would
  invert itself silently. Provenance-blind behaves identically in both
  registries and needs no field that `MovementEntry` does not have.

  **Silence was the actual defect.** An id match is a hit, so the `ambiguous`
  branch §3 calls the whole point of the resolver could never be reached, and
  the curated registry and the merged corpus disagreed about `Squat` with
  nothing to say so. After the change the two agree on thirteen and the
  fourteenth is `ambiguous` on purpose — the merged corpus may now decline to
  answer where the curator has, but it may not contradict, and a test asserts
  that. `Registry.validate()` reports only what no rule can decide.

  **A record's own plural is not an alias, and finding that out was the cost.**
  Reversing the tiers first split `Squat` from `Squats`: the imported record
  carries `Squats` in its own `aliases`, so the plural hit the alias tier while
  the singular hit it on the other record. A regular self-plural is exactly what
  `depluralize` reconstructs, so it is not indexed at all and the plural now
  takes the same path as the singular. Caught by the pinned test that exists for
  precisely this — *never changes which movement a name resolves to* — which is
  the second time that test has earned its place.

### DEC-015 Two records are one movement only when a curator says so (sameAs)
*Status: active. Settled 2026-08-23, closing queue item 8's residue.*

- **Two records are one movement only when a curator says so, in a field that
  says nothing else.** Settled 2026-08-23, closing queue item 8's residue.
  `sameAs` on a curated record names ids in the merged corpus it is one movement
  with; `dedupe-movements.mjs` absorbs them and deletes the field, so no record
  in the canonical corpus carries one.

  **The tempting cheaper version is to read the alias that is already there**,
  and it is wrong. `Shoulder Press` carries `overhead press`, `Overhead Press`
  is a record, and merging on that would have been three lines and no new field.
  But an alias is a much weaker claim — it says a *name reaches this record* —
  and the standing rule that an alias must not be a movement in its own right
  exists precisely because reading one as a merge is how a real movement gets
  redirected into another record's muscles. The alias pass rejected **fourteen**
  candidates on that rule in one sitting, `Military Press` and `Barbell Row` and
  `Handstand` among them; had aliases merged, all fourteen would have merged and
  each would have been silent. The two claims have to be separable, so they are
  two fields.

  **It is an instruction, not a fact**, and that is why it does not survive into
  the corpus. What actually happened is in `mergedFrom` on the surviving record
  and in `asserted` in `registry/dedupe-audit.json`, so any merge can be read
  back or unpicked. A `sameAs` naming an id no source produced fails the build
  by name rather than doing nothing, because doing nothing leaves a collision
  that was supposed to be gone and no way to tell that from success.

- **A source's entry can be told which record it belongs to, and that is a
  separate mechanism from `sameAs`.** Settled 2026-08-23, by `Air Bike`.
  `sameAs` merges two records; nothing could *split* one, and one needed it.
  Three catalogues used the name "Air Bike" — Garmin for the fan bike,
  free-exercise-db and everkinetic for the bicycle crunch — so all three folded
  to one key and merged in `build-movements.mjs` before any dedup rule saw them.
  Every veto in the pipeline guards against *similar* names merging; an
  identical name was treated as proof, and for a name generic enough that two
  traditions reached for it, it is not.

  **The split is keyed on the entry, not the record**, as `source:upstream-id` —
  the pair `origin` already records — and valued by the title of the record the
  entry belongs to. Keying it on the name would be circular: the name is the
  thing that is wrong. Keying it on the *record* is what `sameAs` does, and a
  record that does not exist yet cannot be named.

  **It lives in the script, not in `registry/movements.json`.** Every other
  curated judgement hangs off a record, and this one has no record to hang off:
  it is a correction to a *source*, made at the moment the sources are read, and
  the file where curated movements live is not the place to say that
  free-exercise-db filed a crunch under the wrong name. `origin` keeps the name
  each source used, so the correction stays legible from the finished corpus
  rather than being tidied out of it — `bicycle-crunch` says
  `free-exercise-db: { id: Air_Bike, name: "Air Bike" }` in plain sight.

  **A directive that matches nothing fails the build**, for the same reason an
  unresolved `sameAs` does: the symptom of a dead directive is the defect still
  sitting there, which is indistinguishable from success.

- **A pair judged *not* the same movement has its alias withdrawn.** Same date,
  and it is the other half of the decision above — without it "no collisions"
  has two readings and the wrong one is easier. An alias naming a record the
  curator has just decided is a *different* movement is asserting something
  false; deleting it is correcting the claim, not quieting the checker. That is
  the opposite of deleting an alias for a pair that really is one movement,
  which throws away a curator's answer to keep a checker quiet and is what
  `sameAs` exists to prevent. `rack pull` came off `Block Deadlift` and
  `american swing` off `Kettlebell Swing`; `russian swing` stayed, because that
  one really is the same swing under another name.

  **A collision may also be correct and stay**, which is the third outcome and
  the one a rule would have missed. `assault bike` on `Bike` is true — that is
  what people call the machine — and `Bike` is a lump over several of them.
  Merging spreads one machine's muscles across all of them; withdrawing throws
  away a name people write. It is pinned in `fold.test.ts` with the reason,
  which is what a debt looks like when neither available move is an improvement.

  *Corrected 2026-08-23: `air bike` was pinned here beside it and is no longer.
  It looked like the same standoff and was not one — the `air-bike` record was a
  false merge, and once the split above took the crunch out, Garmin's fan bike
  claimed muscle-for-muscle what `Bike` already claimed. Nothing spread and
  nothing was thrown away, so it merged. Worth keeping because of what it says
  about the shape: a collision that looks like an unavoidable trade-off is worth
  checking for a bad record underneath before it is written down as a debt.*

- **A range does not carry a unit, and a range that has one says so rather than
  vanishing into the movement name.** Settled 2026-08-23, closing queue item 5.
  `8-12 Toes-to-Bar` is a first-class quantity because spec §3's unit table
  gives a range to reps and nothing else; `100-150ft Farmers Carry` matched no
  rule at all, so the whole token — digits, dash and unit together — fell into
  `movement`, the step matched no registry entry, `wdl check` said nothing, and
  `wdl fmt` pluralized text nobody meant as a noun into `Farmers Carries`.

  **The question was whether a range should generalise, and the answer is no —
  not here.** A carry written `100-150ft` says what `8-12` says (*somewhere in
  this band*), and `rest 60-90s` wants the same reading, which is a real
  argument for teaching `Quantity`'s `range` a unit. But that is a wider
  redesign — duration and distance ranges are different shapes, not one kind
  with a unit bolted on, and every consumer of `kind: 'range'` (`volume.ts`,
  `timeline.ts`, `format.ts`, both exporters) would need to stop assuming reps
  for a feature only ever asked for once. **What was not optional was the
  silence**, and that does not require settling the wider question: the grammar
  now matches `<int>-<int><letters>` as its own production, `unreadableRange`,
  ahead of `anyQuantity` — so it is *caught* rather than left for `movement` to
  absorb — and reads it the way an unrecognized comma modifier already reads
  (queue item 0d): quantity stays `open`, the raw text goes in `Step.unknown`,
  and `validate.ts`'s existing `unread()` reports it as a `note`. The movement
  name comes out right either way, so muscle attribution (name-keyed, not
  quantity-keyed) resolves normally; volume does not, honestly, because there
  genuinely is no single number to give it.

  A rest already closed this silence correctly before today: `rest 60-90s`
  fails `restLine` outright (no production accepts a dash there), so the
  existing fallback in `parseRest` reports `unreadable rest duration "60-90s"`.
  Only the step-line case needed the fix. Whether a range should generalise to
  a unit stays open — see [tasks/completed.md](../tasks/completed.md) (item 5)
  if it is raised again, with a real second caller wanting it.
  *Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/step-semantics.ts`,
  `spec/spec-0.1.md`, `packages/core/test/golden/vocabulary.ts`.*

- **A parenthetical the language does not read is held, inert, and noted —
  never swallowed into the movement name.** Settled 2026-08-29, closing queue
  item 14. This is item 5's `unreadableRange` decision one construct over, and
  it was taken the same way for the same reasons. `(both)` / `(split)` /
  `(per-side)` / `(total)` are laterality; `(women 105lb / men 145lb)` and
  `(105/145)` are an rx split. Anything else in parentheses after a movement —
  `(each direction)`, a bare `(wibble)` — matched no alternative, so PEG
  backtracked and the `(`, the `)` and the text between them fell into
  `movementName` one `nameChar` at a time. `12 Around The Worlds (each
  direction)` was a movement literally named `Around The Worlds (each
  direction)`: it resolved to no registry entry, dropped out of muscle and
  volume analysis, `wdl check` said nothing, and `wdl fmt` pluralized it to
  `... (each direction)s` — a stable round trip of a mangling.

  **The principle is Chris's, stated on the queue: putting anything in
  parentheses must not stop a movement being recognized.** The fix is the same
  as item 5's: a new production, `unreadableParen` (`"(" (~")" any)+ ")"`),
  added to `qualifiedPart` and `stepPart` *after* `laterality` and `rxSplit` so
  the recognised forms still win and this is strictly the fallback. Its
  semantics push the whole parenthetical — parens included — into
  `Step.unknown`, so `validate.ts`'s existing `unread()` reports it as a `note`
  and `format` writes it back after the modifiers it did read (`- 12 Around The
  Worlds, (each direction)`), which keeps `pluralize` away from it. Movement
  attribution (name-keyed) resolves normally once the name is clean.

  **Two edges drawn narrowly on purpose.** The match runs to the *first* `)`,
  so a nested `(a (b) c)` is not caught and stays in the name — unbalanced and
  nested parentheticals are rare enough on a whiteboard that the simple
  non-throwing rule wins. And ~15 of the ~970 registry titles (all from raw
  imports — `Front Squat (Clean Grip)`, `Box Jump (Multiple Response)`) carry a
  parenthetical themselves; these now have it peeled to a `note` and resolve
  against the base name. No corpus file writes either shape, so
  `interpretations.json` and `registry/workouts.canonical.json` did not move.
  *Touched: `spec/grammar-0.1.ohm`, `packages/core/src/grammar/step-semantics.ts`,
  `spec/spec-0.1.md` (§4, §11.1), `packages/core/test/golden/vocabulary.ts`,
  `packages/core/test/grammar.test.ts`.*

- **A qualitative load (`@ heavy`) is a `Load` kind, not raw text — and it stays
  exactly as unresolvable as the numeric loads that already have no kilogram
  answer.** Settled 2026-08-23, closing queue item 6. The two candidates were a
  real fork on paper — teach the language the vocabulary, or state in the spec
  that a carry prescribed by feel can never contribute to analysis — but reading
  what `loadKilograms` already does made it not one in practice. `85% 1RM` with
  no profile and `85% of a name nobody labelled` already return `undefined`
  rather than a guessed number; `heavy` joining them as a fifth `Load` kind costs
  nothing new and is the more honest reading, because `heavy` genuinely is not a
  number standing in disguise — it is a category, the same way `TM` or `FTP` are
  categories the language holds without resolving.

  **What actually moved is visibility, not resolution.** A raw target and a
  `Load` target look identical to a person reading the board — both round-trip,
  both display — but they are not identical to *code*: `heaviest()` in
  `muscles.ts`, and anything shaped like it, walks `targets` filtering on
  `t.kind === 'load'`, so a target sitting in `raw` was invisible to every
  load-aware check by construction, indistinguishable from a step that carries
  no load at all. Moving it into `Load` does not make it resolvable — it makes it
  *findable*, so a check built for loads can say "loaded, magnitude unknown"
  instead of silently skipping the step. Same shape as item 0d's `unknown` field:
  the fix was a place to be seen, not a way to be understood.

  **This did not reach item 5, and did not need to.** A carry with both a range
  quantity and a qualitative load (`100-150ft Farmers Carry @ heavy`) is
  upstream of `targets` entirely, in the quantity grammar, and closing item 6
  did nothing to it on its own — the two items were raised together because one
  workout hit both, and closing one was not evidence toward the other. *Correction,
  merge to `main`: item 5 closed independently the same day (see its entry
  above), so the combined case now reads correctly on `main` — `Farmers Carry`
  resolves, `@ heavy` is a `Load` target, and `100-150ft` is reported in
  `unknown` — but that is item 5's fix doing its own job, not anything this one
  reaches.*

- **The body map shows primary vs secondary as opacity, one colour per layer —
  not two colours, and not left unshown.** Settled 2026-08-23, closing queue
  item 7's one open design question. Two colours was the real alternative — a
  primary mover in one hue, a muscle a step only *assists* in another. Opacity
  won because every one of the map's four views already spends a
  colour on something else — the aggregate is one colour, a per-movement
  highlight is a second colour laid over it "against" the aggregate, the
  board's current-cue emphasis is a third context — and a two-colour
  primary/secondary axis on top would have meant naming a colour pair for
  *each* of those layers rather than one. Opacity composes with any of them
  for free: whatever colour a layer paints with, a primary mover gets it at
  full strength and a secondary one at about 40%, so the reader learns the
  vocabulary once ("faint means it only assists") and it holds everywhere
  rather than meaning something different pane to pane. Not shown at all was
  rejected outright — `muscles.ts` has carried the distinction since before this
  item, `goals.ts`'s `level: any` already keys off it, and a map that could not
  say a pull-up primarily hits lats rather than merely touching biceps would
  answer a shallower question than the data already answers.
  *Touched: `apps/shared/body-map.js` (`aggregateStates`, `highlightStates`),
  no core change.*

- **The heat map's scale is a choice per view, not one number, and a muscle
  worked by something the scale cannot read is hatched, never coloured cold.**
  Settled 2026-08-23, closing the second half of queue item 7. The item's own
  text named the trap: `volume.ts`'s reps are the honest number for loaded
  work and say nothing for a carry, a hold or a max effort, since `stepVolume`
  reads all three as zero reps by construction (see items 5 and 6 above) — a
  reps-only scale would paint every farmer's-carry-only muscle the coldest
  colour on the map, which reads as "not worked" and is a lie. **`frequency`**
  (`MuscleLoad.exposures` — how many steps touched a muscle, primary or
  secondary) is always defined, so it is the default; **`volume`** (reps) is
  offered beside it for the workouts where it says something a count cannot —
  which set moves the most iron — and a muscle with exposures but zero reps
  under it is marked `unmeasured` and drawn hatched, a third visual state
  distinct from both "not worked" (idle, uncoloured) and any real heat colour.
  Distance, calorie and duration work reads as `unmeasured` under `volume` too,
  for the same reason a carry does — reps is not a unit those quantities have,
  and inventing an exchange rate between metres and reps would be a guess
  wearing a number's clothes. *Touched: `apps/shared/body-map.js`
  (`heatStates`), no core change — the split is entirely a read of
  `MuscleLoad`'s existing fields, not a new one.*

### DEC-016 A hosted instance with PocketBase for auth and storage
*Status: active. Settled 2026-08-30, opening queue items 18–20.*

- **The apps get a public URL on Chris's DreamHost VPS, with PocketBase beside
  them for Google sign-in and saved/shared workouts.** Settled 2026-08-30. This
  reverses the *"Sharing, accounts, a platform"* Non-Goal, which
  [goals.md](../goals.md) had gated on "the goal itself changes" — it now has
  (see that file's "## Pivots"). The trigger was practical: the apps only run
  behind a dev server that changes under whoever is testing, so there is no way
  for Chris or a training partner to sit with the real UX and report back.
  *"That will help steer and discover things for this work."*

  **What is and is not changing.** The two project goals — whiteboard-readable
  text, check/generate against intent — are untouched, and *"not competing for
  adoption"* still holds: this is a handful of known users on one small
  instance, not a platform. Crucially **nothing here touches `packages/core`,
  the grammar or the spec**. A stored workout is its `.wdl` source text in a
  database column; PocketBase stores and returns a string, and every existing
  consumer (the apps, `wdl` CLI, the tests) is unaffected. The signed-out
  experience — build, `Download .wdl`, `Open…` a local file, share via the
  board's `#<source>` hash — keeps working unchanged; accounts are purely
  additive.

  **Why the DreamHost VPS.** Chris already pays for it, so the marginal cost is
  $0, and it is **always-on with no idle-pause and no cold-start** — the two
  things that ruled out the free tiers considered beside it. Supabase free
  pauses a project after 7 days idle; Render's free services spin down at 15
  min idle with a ~50s cold start; the old Heroku hobby dyno (the thing Chris
  remembered wanting) was killed in 2022 and its successors all sleep or meter.
  A box that is already running and already paid for beats all of them for a
  low-traffic instance that must just *be there* when someone opens the link.
  The price paid instead is that Chris runs the process and owns backups —
  which for PocketBase is one SQLite file.

  **Why PocketBase for the backend.** One Go binary: SQLite, built-in auth
  including Google OAuth2, an admin UI, and a plain REST API. It gives the
  whole "users + save + share" surface as configuration rather than code, with
  no SaaS account and no ORM. Rejected alternatives: **Supabase / Firebase** —
  managed, fastest to a prototype, but a SaaS dependency and (free tier) the
  idle-pause above; **a hand-rolled Express + Passport backend** — exactly the
  wheel Chris said he did not want to reinvent, and the maintenance surface
  (TLS, process, session store, patching) is all downside here; **hosted auth
  (Auth0 / Clerk / WorkOS)** — still needs a database behind it for the
  workouts, so it removes no step; **a standalone OAuth server (OpenAuth,
  Auth.js)** — Auth.js is framework-coupled and the apps are a plain static
  SPA, and a separate identity server is more moving parts than one binary.

  **Why Google OIDC and nothing else at first.** No passwords to store or
  reset, and it is one provider toggle in PocketBase. More providers, or
  email-link auth, only if someone actually needs them.

  **Constraints carried in from the existing architecture.** No bundler and no
  npm runtime dependency is added ([DEC-003](#dec-003-src-is-portable-and-is-handed-its-data),
  [DEC-008](#dec-008-ohm-js-is-vendored-imported-by-relative-path)): the
  PocketBase client is either a vendored ES module by relative path or — more
  likely, since only ~6 calls are needed — a hand-rolled `fetch` wrapper. The
  static apps already use only relative paths, so the deploy is `scripts/serve.mjs`'s
  behaviour reproduced by nginx over a copy of the served subtree; PocketBase
  is reverse-proxied **same-origin** under `/api/` so there is no CORS surface.
  *Touched (planned): a new `deploy/` directory (nginx vhost, process unit,
  runbook), a deploy script under `scripts/`, and an `apps/shared/` access
  module. Recorded here before the work so the next session does not re-litigate
  the host or the backend.*

  **Item-20 implementation choices (2026-08-30), consistent with the above:**
  - **The PocketBase client is hand-rolled `fetch`, not the SDK** —
    `apps/shared/pocketbase.js`, ~8 calls. DEC-003 / DEC-008: no npm runtime
    dep, no build step. Header comment pins the PocketBase **v0.40.x** route
    names it targets.
  - **Google OAuth2 is the redirect flow, not the SDK's popup + realtime
    dance.** `auth-methods` → full-page navigate to Google's `authURL` with our
    `redirect_uri` → `auth-with-oauth2` with `code` / `codeVerifier` /
    `redirectURL`. Simpler to hand-roll (no SSE), no popup-blocker failure
    mode, works on mobile. The cost is a second authorised redirect URI in the
    Google console — `https://wex.androidempathy.com/apps/builder/auth-callback.html`
    (`deploy/README.md` §8) — alongside PocketBase's own `/api/oauth2-redirect`.
  - **The share URL is `/apps/display/?w=<id>`, not a pretty `/w/<id>`.**
    Measured against the live instance: PocketBase serves `pb_public/` with an
    index fallback, so an unknown path returns the root `index.html` — `/w/<id>`
    can't route without a `pb_hooks` handler, which is an infra change for no
    gain over a query param on a file that exists. The board reads `?w=<id>`,
    fetches the record, and runs it; a `#<source>` hash is unchanged and wins
    when both are present.

### DEC-017 A root Makefile is the task surface, not a root `package.json`
*Status: active. Settled 2026-08-31, closing queue item 21.*

- **The routine dev-lifecycle actions get one memorable command each through a
  root `Makefile`** — `make test` / `make build` / `make serve` / `make
  registry` / `make goldens` / `make deploy` / … — each a thin wrapper over the
  `node scripts/*` (or `npm --prefix packages/core test`) command that already
  exists. The Makefile is discoverability and muscle memory, not new build
  logic; every underlying command still runs directly, and the situational ones
  that take arguments (`find-duplicates`, `import-movement-curation`, the `wdl`
  CLI) are deliberately left out of it. `make` with no target prints the list.

- **Why a Makefile and not a root `package.json` `scripts` block.** `make` is
  already present on every dev machine and adds nothing to install. A root
  `package.json` is the more idiomatic Node choice and was the obvious
  alternative, but this repo is **install-free on purpose**
  ([DEC-003](#dec-003-src-is-portable-and-is-handed-its-data),
  [DEC-008](#dec-008-ohm-js-is-vendored-imported-by-relative-path): no
  `node_modules`, no lockfile, `ohm-js` vendored) — a root `package.json`
  invites a future `npm install` and a `package-lock.json`, which is exactly
  the state the vendoring work removed. The Makefile has no such gravity. A
  `package.json` shim that only shells out to `make` was considered and skipped
  as unearned until someone actually wants `npm run`.

- **Invariant the targets protect:** no target may add a dependency or a
  package-manager step; the registry pipeline stays one atomic `registry`
  target (never a per-step target — a step run alone is erased by the next
  rebuild, see [lessons-learned.md](lessons-learned.md)).

- **`deploy` host default (2026-08-31):** the Makefile sets
  `export WDL_DEPLOY_SSH ?= dreamhost.ae.wex`, so a bare `make deploy` /
  `make deploy:dry` works on Chris's box. `?=` still defers to the environment
  when it is set, and the value is a `~/.ssh/config` alias — no host, user or
  secret — so it is safe checked in. The raw `node scripts/deploy-web.mjs`
  form does not inherit the default (pass `--ssh` or the env var).

- **`:` namespace separator + DB-side targets (2026-09-01, `2c1cdb0`):**
  multi-word targets use `:` not `-` — `curation:sheet` / `curation:check` /
  `curation:apply`, `movements:load` / `movements:dump`, `deploy:dry`,
  `deploy:db`, `backups:pull`; single-word targets unchanged. GNU Make needs
  the `:` backslash-escaped in the target definition (`curation\:sheet:`) and
  the `help` recipe's grep/awk parses the escaped form; verified on GNU Make
  3.81. Two new targets split the deploy surface by side: **`make deploy`**
  stays web-only (`--delete` rsync into `pb_public/`); **`make deploy:db`**
  rsyncs `deploy/pocketbase/pb_migrations/*.js` to `~/pb/pb_migrations/`
  (**no `--delete`** — the box also carries admin-UI snapshot migrations that
  are not in the repo) and restarts PocketBase so a new migration applies;
  **`make backups:pull`** is the M6 off-box backup copy (`rsync` of
  `~/pb/pb_backups/` to `$(WDL_BACKUP_DIR)`, no `--delete`). Still no dependency
  or package-manager step — all three are thin `rsync` / `ssh` wrappers.
  *(`WDL_BACKUP_DIR` default was `~/wdl-pb-backups` until 2026-09-02; now the
  repo-relative `db-backups/` — git-ignored contents, tracked README — so a
  `make` target never writes outside the repo unless told to.)*

### DEC-018 A bare-label block header is a section
*Status: active. Settled 2026-08-31, closing queue item 11.*

- **A header whose label is a bare phrase — everything before the first `,` or
  `@` is letters, spaces and hyphens, with no digit anywhere and not opening with
  a word that names a kind — parses as `type: 'section'`**, the inert labelled
  container the fixed eight `sectionWord` values already produce, now for any
  label. This makes spec §2's *"or any custom label"* true; before it, only the
  fixed eight were read and everything else fell through `headerName` to a
  `type: 'sequence'` carrying an `unrecognized block header` **error**. Execution
  was already identical to a section — `format.ts` writes the name back,
  `timeline.ts` defaults an unknown container to `sequence` — so only the
  diagnostic was wrong.

- **Read *and* said out loud, at the `note` severity.** `validate.ts` emits
  `custom-section` — *"read `Barbell movements` as a section label"* — beside
  `adopted-block`, the same place every other `note` lives. The fixed eight are
  silent because they are a closed vocabulary; a word the author just coined is
  one keystroke from a kind-word, so held-and-inert must not also be silent
  ([DEC-010](#dec-010-unknown-text-is-held-inert-and-said-out-loud-as-a-note)).
  Fully-silent (like the fixed eight) was the alternative and was declined.

- **Case preserved verbatim.** `blockKind_section` still folds the fixed
  vocabulary to lower case — those are canonical spellings — but a coined label
  keeps the capitals it was written with (`Barbell Movements:` stays).

- **Where the boundary falls, and the exclusion added mid-implementation.** A
  digit anywhere keeps the head an error (`3 rounds of madness:`). And a head
  that *opens* with a kind-word missing its parameter — `RFT:`, `rounds:`,
  `every:`, `build:` — stays the reported error, because the miss loses *how the
  block executes*, which is exactly the line
  [DEC-010](#dec-010-unknown-text-is-held-inert-and-said-out-loud-as-a-note)
  already drew between a modifier nobody taught the language (held) and a kind
  nobody taught it (error). The first `make test` surfaced the conflict —
  `RFT:` becoming a silent section contradicts spec §5.2's pinned reading — and
  Chris chose the narrow `kindLead` exclusion over rewriting §5.2. Bare phrases
  with no kind-word at all (`some shape nobody taught the parser:`) are sections.

- **A grammar production, not a `parse.ts` reclassification.** `customSection`
  (with a `kindLead` guard and an `emomWord` helper) is tried in `headerKind`
  after `blockKind` and before `headerName`, so the grammar still *owns what
  exists* ([DEC-006](#dec-006-the-grammar-is-written-in-peg-notation-carries-no-actions)
  / [DEC-007](#dec-007-the-grammar-is-an-ohm-grammar-semantics-in-a-separate-file)).
  `parse.ts`'s report condition (`block.name && block.type !== 'section'`) needed
  no change — the production sets the type, so a clean bare label is already
  gated out, while `Barbell movements, 3 rounds:` (a kind after the comma) turns
  the block into a real `repeat` and the leftover label is reported, the same
  "three rounds *and* an error" as `cap 12min, 3 rounds:`.

### DEC-019 The per-side laterality form is parenthesised: `(each arm)`
*Status: active. Settled 2026-08-31, closing queue item 13b.*

- **All four laterality modes are parenthesised.** `(split)` / `(both)` /
  `(total)` name *how* the count is performed; `(each <axis>)` names that plus
  the **axis** — `arm | leg | side | hand | direction`. Until 2026-08-31 the
  per-side form was written bare and without a comma (`14 DB Curl each arm`),
  which spec §4 had made deliberate — "it reads as part of the prescription
  rather than as a modifier of it". Chris reopened that: the asymmetry with
  `(split)` was the thing a reader tripped on.

- **`direction` is a new axis word** (`limbWord` in the grammar) — a rotation
  performed once each way. `12 Around The Worlds (each direction)` had **no
  reading at all** before: `(each direction)` fell to `unreadableParen` and was
  held as unknown text. The parser now *reads* the parenthesised per-side form,
  a `laterality = "(" lateralityWord ")" -- word | "(" eachWord ~wordChar spaces
  limbWord ~wordChar ")" -- perSide` split tried ahead of `unreadableParen`.

- **A registry field followed** (queue item 13a-curation, `71f9469`):
  `MovementEntry.lateralityAxis?: 'arm'|'leg'|'side'|'hand'|'direction'`, a
  curated root field (via `import-movement-curation.mjs`) naming the axis a
  per-side count runs across, so a tool renders `(each direction)` rather than a
  generic `(each side)`. Advisory; nothing in `packages/core` reads it. The
  builder's `»` panel **does** read it, as of queue item 13a (`1ffc8d0`) —
  `movementModifiers` builds the per-side option as
  `` `(each ${entry.lateralityAxis ?? 'side'})` ``, and `applyModifier`'s
  exclusive-class strip recognises the parenthesised per-side form so a re-pick
  toggles / replaces cleanly. `around-worlds` is the only entry carrying the
  field so far; a full curation sweep is unscheduled.

- **What did not change.** Bare `each arm` / `per leg` still parse (input
  tolerance); `total` still maps to `(split)` on output; `(both)` stays distinct
  from `(split)`. Side selectors (`first arm`, `trailingQualifier -- side`) and
  team words (`shared`, `synchronized`) stay **bare** — this is a
  laterality-only change. Canonical output writes the parenthesised form and
  keeps the axis word the author wrote.

- **Corpus cost, measured.** 9 `examples/corpus/*.wdl` files carried bare
  `each X` and were reformatted with `wdl fmt`. That moved **only the `text`
  field of those 9 records** in `registry/workouts.canonical.json` (plus its
  date stamp) — **0 AST changes, 0 summary changes**, so nothing about how any
  workout is *understood* moved; `interpretations.json` regenerated
  byte-identical. All 190 corpus files remain their own canonical fixpoint.
  *This is the norm the corpus is held to — every file equals `wdl fmt` of
  itself — which is why the 9 were reformatted rather than left as authored.*

### DEC-020 The curated movement layer lives in PocketBase; `registry/movements.json` is its committed dump
*Status: active. Settled 2026-08-31, opening the *Movements in the database —
Phase 1* epic (queue task M0).*

- **The curated movement layer is edited in a PocketBase `movements`
  collection, not by hand-editing JSON.** That layer is the ~972-entry set that
  carries `laterality` / `defaultLaterality` / `lateralityAxis` / `load` /
  `implements` / `measures` / `force` / `mechanic` / `equipment` / `aliases` /
  `muscles` / `pattern` on top of the raw imported records. The trigger was
  practical (see [builder-ux.md](builder-ux.md) "Accounts, IDs and layout"): the
  972-row × 32-column curation spreadsheet is unworkable to look at or reason
  about, and the need to fix or add a movement comes up *while building a
  workout* — so editing wants to be a GUI (M5), reached as a step in that flow.
  Phase 1 is **global (admin-edited) movements only**; user-scoped movements are
  Phase 2, deferred ([../tasks/deferred.md](../tasks/deferred.md)).

- **`registry/movements.json` stays in the repo as the reviewable dump of that
  collection.** `make movements:dump` (built in M4) reads `scope = "global"`
  from the live DB and rewrites the file in its current key order and
  formatting, so the git diff is a shape-for-shape review of what an admin
  changed. It remains the exact file `packages/core` reads
  (`packages/core/src/env.ts`), its tests read, and `scripts/build-canonical.ts`
  reads — **unchanged, offline, install-free**. This epic does not touch
  `packages/core`, the grammar or the spec ([DEC-003](#dec-003-src-is-portable-and-is-handed-its-data)).
  The canonical pipeline still merges `registry/movements.json` with the
  external sources; `registry/movements.canonical.json` is **built**, not
  ingested, and is untouched.

- **Production apps read movements from PocketBase; local `make serve` reads a
  mock.** Production goes through the same `/api/*` same-origin PocketBase the
  client already uses (`apps/shared/pocketbase.js`) —
  `/api/collections/movements/records`, wrapped in PocketBase's list/response
  envelope. Under `make serve` there is no PocketBase; M7 adds a mock `/api`
  (on by default, opt out with `WDL_MOCK_API=0`) and **`registry/movements.json`
  *is* the movements fixture** — the mock reads it and wraps the records in the
  same envelope. M4's dump keeps that file current from the live DB, so the
  fixture never drifts from production.

- **Why.** Editing wants to be a form with enum pickers, not a wall of CSV
  cells; `packages/core` must stay offline and install-free, so it cannot
  reach a database; the repo stays the durable, reviewable record of what the
  curated layer *is*; and user-scoped movements (Phase 2) drop into the same
  collection through the `scope` / `user` fields M1 adds — no second store.

- **Consequences / still open.** **Dump cadence is undecided** — a manual
  `make movements:dump` a curator runs, a git pre-commit hook, or a step in the
  deploy script; likewise whether an admin edit in prod is expected to be
  dumped + committed promptly or batched. Left for a later call once the
  round-trip is real. **The dump must round-trip:** dump → ingest (M3) → dump
  yields no diff; M3/M4 land with that check.

  *Closed 2026-09-01 (`e472cde`, queue task M4): `make movements:dump`
  (`scripts/movements-from-db.mjs`) reproduces `registry/movements.json`
  byte-for-byte from a fresh M3 ingest — `make movements:load` then
  `make movements:dump` leaves `git diff registry/movements.json` empty, and a
  one-field edit in the DB dumps back as exactly that one field. The
  dump → load → dump round-trip requirement is met. Dump **cadence** is still
  undecided — this ships no pre-commit hook, only a `--check` flag that a hook
  or the deploy step could call.*

### DEC-021 An account's handle is the `@id` namespace, forced onto every workout on save; `workouts.wdlId` mirrors it
*Status: active. Settled 2026-09-01, opening the *workout library* epic (queue
task L0). Absorbs and closes most of the deferred "account namespacing" /
"`@id` ↔ record-id" rethink ([builder-ux.md](builder-ux.md) "Accounts, IDs and
layout").*

- **Curated public workout sets are owned by flagged `users` rows, not a new
  collection.** A new `org` (bool) field on `users` marks an account that owns a
  curated set — `crossfit`, `hyrox`, `tabata`, room for more. An org row has a
  fixed id and is created by a migration (L1); it has **no OAuth identity and no
  password** — nobody signs in as it. Its workouts are owned through the
  **existing `owner` relation** at `visibility: "public"`, so every list/view
  rule (`owner = @request.auth.id || visibility != "private"`) and write rule
  (owner-only) on `workouts` already covers them unchanged. No new collection,
  no `workouts`-schema churn for ownership. The `org` flag itself only gates
  *who may write* the row (a later admin/loader concern) and lets a UI label
  "an org's set" — it is not read by `packages/core` or the grammar.

- **`users.handle` is the `@id` namespace for every account — orgs and people
  alike.** A new `handle` field on `users`: text, **unique** (unique index),
  `[a-z0-9-]+`, nullable at rest but never null for an account that has saved a
  workout. It is the username-style public identifier and the single source of
  the `@id` namespace prefix: everything the `crossfit` account owns is
  `@id crossfit:*`; everything a person whose handle is `chris` owns is
  `@id chris:*`. **The user picks and edits their own handle** — it is not
  derived from anything and not fixed. Org handles are just handles the L1
  migration sets.

- **Onboarding never blocks on the handle: a handle-less account is assigned a
  random `adjective-noun` one.** On first sign-in with no handle (or the first
  save, whichever the app reaches first), the app generates `brave-otter` /
  `quiet-harbor` from two committed word lists in `apps/shared/` (an adjectives
  list and a nouns list — plain data files, no dependency, the same way
  `fixtures/` is committed data), checks it is free against the collection,
  retries on collision, and persists it. The user can change it later in the
  builder header's account area to **any unused valid slug**; a taken slug, an
  empty one, a pure-numeric one, or a short reserved set (`api`, `admin`, `_`)
  is rejected client- and server-side. `apps/shared/pocketbase.js` grows
  `updateHandle(h)` and exposes `currentUser().handle` (L1).

- **Every save forces the workout's `@id` to `<owner-handle>:<slug>` — written
  or rewritten into the source text.** This is the load-bearing ruling. On every
  create and update of a `workouts` row by a signed-in user,
  `apps/shared/pocketbase.js` writes the `@id` directive line in `source` to
  `<owner-handle>:<slug>`:
  - **`<slug>`** is the slug portion of an existing `@id` in the text if there
    is one (`@id crossfit:fran` copied into a new buffer → slug `fran`); else a
    slug of the `# Title` (`Fight Gone Bad` → `fight-gone-bad`); else — no
    `@id`, no title — `untitled`, disambiguated by the suffix rule below.
  - **A collision inside the owner's namespace** — another workout of the *same
    owner* already carries that `wdlId` and it is not this record — appends a
    deterministic suffix (`-2`, `-3`, …). The suffix must be stable across
    re-saves of the same record (derive it once, keep it in the stored `@id`).
    Collisions *across* owners are impossible by construction — the handle
    prefix differs — so two accounts may both hold `…:fran`.
  - **The `@id` line is inserted** into the preamble if absent, **overwritten**
    if present with any other value. There is therefore **no un-namespaced
    saved workout, no "mismatch" state, and no warn-on-mismatch UX to design** —
    the question the deferred rethink held open ("does saving reconcile, warn,
    or write back?") is answered: it always writes back, silently, every time.
  - **Copying another user's workout re-namespaces it naturally.** Open
    `crossfit:fran`, edit, Save → your record is `@id yourhandle:fran`,
    `wdlId yourhandle:fran`. No copy dialog, no "fork" concept — the save rule
    does it.
  - **Org workouts get the identical treatment via the L6 loader**, not an
    interactive save: `workouts-to-db.mjs` sets `owner` to the org row and
    forces `@id` / `wdlId` to `<orghandle>:<slug>` from each authored `.wdl`'s
    own `@id`, under the same slug and suffix rules. The rule is "every saved
    workout is namespaced by its owner's handle", and the loader is just the
    non-interactive writer.

- **`workouts.wdlId` mirrors the `@id` — `<handle>:<slug>`, indexed, set on
  save from the same value.** L2 adds the column (text, nullable, plain index).
  The same save operation that writes the `@id` line into `source` sets
  `wdlId` to the identical string, so the column and the text never disagree.
  Existing rows are `wdlId: null` until re-saved or loaded — no backfill is
  required (L3 covers new saves, L6 the library). `wdlId` is the
  human-readable, searchable, shareable handle for a record; the 15-char
  PocketBase record id stays the opaque one.

- **A lookup resolves either the record id or the `wdlId` to the same record.**
  `apps/shared/pocketbase.js` gains `getByAnyId(x)`: **a value containing `:`
  is a `wdlId`** → `filter=wdlId="<x>"`; a value with no `:` is a 15-char
  record id → `GET …/records/<x>`, with a `wdlId` fallback on miss. The colon
  is the unambiguous discriminator — a `wdlId` always has one, a record id
  never does. The board's `?w=<id>` resolution (item 20) points at this, so
  `?w=crossfit:fran` works end to end and `?w=<recordid>` still does. This is
  the "correlate `@id` and record id" ask from the rethink, answered as "both
  address the same row through one resolver" rather than by making the ids
  equal.

- **The mock `/api` mirrors all of it.** `fixtures/users.json` rows gain
  `handle` (and `org` where relevant); `fixtures/workouts.json` rows gain
  `wdlId`; `scripts/mock-api.mjs` resolves `filter=wdlId="…"`, parses `@id`
  out of `source` to set `wdlId` on mock create/update, supports the
  random-handle assignment path, and (L4) grows the `~` operator and the
  parenthesised `(visibility="public" || owner="<uid>") && (title~"…" ||
  wdlId~"…")` OR shape that search needs. A fresh `make serve` shows the whole
  library with no PocketBase, `registry/movements.json`-as-fixture being the
  precedent.

- **The library loader is the twin of `scripts/movements-to-db.mjs`.**
  `scripts/workouts-to-db.mjs` / `make workouts:load` (L6): reads
  `examples/workouts/**/*.wdl`, upserts each as a `workouts` row owned by the
  matching org handle at `visibility: "public"`, `wdlId` from `@id`,
  **idempotent on `wdlId`** (`POST` the absent, `PATCH` the changed, re-run
  writes nothing; `--dry-run`). The same run regenerates `fixtures/workouts.json`
  (the library rows) and `fixtures/users.json` (the org rows). Prod writes need
  admin auth (`WDL_PB_ADMIN_*`, exactly as `movements:load`); against the mock
  it just works.

- **`packages/core`, the grammar and the spec semantics do not change.** `@id`
  is already a grammar-accepted directive whose value is uninterpreted (spec §2;
  "never derived from the file's contents", roadmap §3.2.1). The
  `<handle>:<slug>` rule is an **app / hosting convention** enforced by
  `apps/shared/pocketbase.js` and the loader — not a language rule, not a
  grammar production, not a parser change. A local `.wdl` file on disk may still
  use any namespace or none; nothing about `wdl fmt`, `wdl check` or the corpus
  moves. **One spec note is warranted and lands in this commit**: a sentence in
  spec §2 beside the `@id` bullet recording that when a file is saved to a
  hosted account the namespace is by convention that account's handle and the
  host rewrites `@id` to match on every save — explicitly flagged as a hosting
  convention, so the "never derived from contents" language rule is untouched.

- **Deferred on purpose — the handle-rename staleness.** When a user renames
  their handle, every already-saved `<oldhandle>:<slug>` `@id`, every `wdlId`
  built on it, and every share link goes stale. Phase 1 does **not** solve this
  (Chris: "we can revisit that"); it is recorded in
  [known-debts.md](known-debts.md) with the three options to weigh later —
  rename-time rewrite of `wdlId` + the `@id` text across all the user's
  workouts (the natural extension of "save forces the namespace"); keep old
  handles as resolvable aliases; forbid the rename once a workout exists under
  the handle. DEC-021 picks none of them.

- **Out of scope — anything that is a *platform*.** Public signup flows,
  discovery, profile pages, follower graphs, scale: off the roadmap per
  [goals.md](../goals.md) Non-Goals and [../tasks/deferred.md](../tasks/deferred.md).
  This epic is a fixed handful of org accounts, an editable handle per user, and
  search over one's own plus public workouts — for a small known set of users on
  one small instance. User-scoped *movements* (Phase 2) are a separate deferred
  item and unrelated.

- **What this closes.** After L0–L7, the only thing left in the "Accounts, IDs
  and layout" rethink is the board **Edit** button round-tripping into the
  builder (a separate, still-unscheduled item) and the deferred rename debt
  above. The `@id` ↔ record-id correlation, the account namespace, `users.handle`,
  `workouts.wdlId`, forcing the `@id` namespace on save, and "open on the board"
  for any public workout are all decided here or by the L-tasks this note opens.

### DEC-022 A unitless load magnitude is pounds; `wdl fmt` writes the unit in
*Status: active. Settled 2026-09-01 by Chris, closing the "what a target with no
unit means" holding answer in [known-debts.md](known-debts.md). Rule 1 of the
"unit defaults" standalone task (`6829052`).*

- **`@ <number>` with no unit reads as `<number>lb`.** `parseTarget` in
  `packages/core/src/units.ts` fills `unit: 'lb'` for a bare magnitude
  (`/^\d+(\.\d+)?$/`), so the AST carries a real `{kind: 'load', load: {kind:
  'absolute', unit: 'lb', value}}` rather than `{kind: 'raw'}`. It reaches
  `formatLoad`, volume, muscle analysis and every exporter unchanged — a
  unitless load is now a load everywhere, not text that means nothing.

- **This overrides the earlier holding answer**, which was deliberate: `@ 95` was
  held as `raw` from 2026-08-15 on the reasoning that "`@95` is 95lb in one gym
  and 95kg in another, so a default is an invention". Chris settled it the other
  way — pound is the **dominant convention** for a load that omits its unit, so
  by design rule 3 ("default to the common case; say what it is") it is a
  documented default, not a guess. Recorded as a correction in
  [known-debts.md](known-debts.md) rather than by rewriting that entry.

- **`wdl fmt` rewrites `@ 95` → `@ 95lb`.** The chosen implementation (option
  (a): default at the parse, so the AST never carries an absent unit) makes this
  automatic — canonical output states the reading, which is the format's job.
  The at-rest text `@ 95` still reads fine on a whiteboard; what changed is only
  what it *means* and what `fmt` writes back.

- **Distance is unchanged — it still requires its unit.** A distance is written
  in feet, metres or miles about equally and there is no dominant one to default
  to; a bare `400` after `@` is not a distance. Only the pound/kilogram load
  scale has a default.

- **Not affected: the unlabelled rx split.** `(105/65)` still carries two
  magnitudes and no unit — it never goes through `parseTarget` (`step-semantics`
  builds its `Load` directly), so `Load.unit` stays optional and the `ast.ts`
  comment stands.

- **Blast radius, measured.** No corpus file writes a unitless load, so
  `interpretations.json` regenerated byte-identical. `vocabulary.json` moved for
  the pinned `@95` / `@ 95` forms only (now under `was-wrong`, canonical
  `@ 95lb`). `grammar.test.ts` and `units.test.ts` assert the new reading
  directly. `make test` 2064/2064, 1 pending — unchanged.

- **A magnitude that is really calories on a load-less machine** (`15 Row`) is a
  separate question — rule 2 of the same task, landed 2026-09-01 (`952c80c`):
  a *builder-only* suggesting diagnostic (`calorieUnitHints()` in
  `apps/builder/builder.js`, feeding the Analysis-tab diagnostics), **no
  parse-level default**, the board stays agnostic and the reading is unchanged.
  Fires when the movement resolves to a registry entry with `measures` ⊇
  `{calories}` and no `load`. See spec §7.1 and [builder-ux.md](builder-ux.md).

### DEC-023 `measures` on a movement is a capability set, not a choice
*Status: active. Settled 2026-09-02 by Chris, withdrawing queue item V3 of the
Vocabularies & editor ergonomics epic after the implementation disproved its
premise (`77bff40`). No code shipped — the V3 attempt was reverted.*

- **A registry entry's `measures` is the set of output units that movement
  *can* be prescribed in, not the one it is.** All four subsets are meaningful:
  neither (a squat), `distance` (a run), `calories`, and **both** — which is the
  correct, curated state for the three ergometers, `bike` / `row` / `skierg`.
  A rower is written `500m Row` or `20cal Row` depending on the workout; the
  entry has to say it can be either.

- **So the movement editor keeps its two checkboxes.** V3 proposed replacing
  them with a 3-way single-select segmented control (None / Distance /
  Calories) on the reasoning that measured output is mutually exclusive,
  explicitly contrasted with counting modes, which "genuinely co-occur".
  `measures` genuinely co-occurs too. **A checkbox pair is the right control for
  a capability set**, and there is no meaningless state for a segmented control
  to prevent — the review mistook the set for a choice.

- **The spec said so already.** §9.3 / `spec-0.1.md:178` — "`1min Row` ends on
  duration and *measures* calories"; `:185` — a duration-completed step
  "defaults from the movement's registry `measures` where present"; `:1058` —
  `- 1min Row, count cal`. And `scripts/import-movement-curation.mjs:232`
  maintains the field as a **per-mode independent** set in as many words
  (`Measures: distance` and `Measures: calories` are two independent CSV
  columns, and all-false is called out as "a real, common state").

- **Two shipped consumers read it as a set, and single-select would have broken
  both.** `calorieUnitHints()` — rule 2 of
  [DEC-022](#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in),
  `952c80c` — fires only where `entry.measures` includes `calories`, and those
  three entries are its **entire** registry surface, so narrowing any of them
  switches the diagnostic off for that movement permanently. The `»` panel
  (`apps/builder/builder.js:329`) maps **one modifier pick per mode**, so a Row
  step offers both `, count distance` and `, count cal`; narrowing removes one.
  Verified live in the builder before the revert.

- **The failure mode was silent, which is why this is a decision and not a
  note.** The 3-way control seeded from the first known value, so `skierg`
  opened showing only *Distance* and a save would have written `["distance"]`
  with no warning — a curator editing a rower's *title* would have dropped
  `calories` and moved `registry/movements.json` under `make movements:dump`.
  Nothing in the form, and no test, would have said so.

- **What is still open from the same review.** The ergonomic complaint
  underneath V3 was real and survives it: the editor's grouped fields have a
  caption bug (a `<label>` labels only its first labelable descendant, so
  clicking a group's caption ticks its first checkbox) — recorded in
  [builder-ux.md](builder-ux.md), and **fixed by V5 on 2026-09-02
  (`10a2b8a`)**, as planned. The rest of the epic (V4→V5, Stage C V6→V8) was
  unaffected; V3 blocked nothing.

- **If this is ever revisited**, the thing to change first is the *data model*,
  not the widget: a per-movement "preferred" measure would be a new field, not a
  narrowing of this one. Re-curating the three ergs to a single measure each
  contradicts spec §9.3 and would need its own decision.

### DEC-024 The token input is one composition: chips + type-ahead + a filter/select picker
*Status: active. Settled 2026-09-02 with queue items V4 + V5 of the
Vocabularies & editor ergonomics epic (`10a2b8a`).*

- **A list-of-strings field is edited by one widget, `apps/shared/token-input.js`,
  which always renders the same three things**: removable chips for the current
  value; a text entry with type-ahead over the vocabulary; and, below the field,
  a filter box over a bounded, scrolling checklist of the whole vocabulary.
  Nothing about the *size* of a vocabulary selects a different layout.

- **The rejected alternative was a count threshold** — a "vocab tray" for short
  lists and a "show the first 15, then More" for long ones, which the design
  review proposed. It was dropped before V4 was written: a filterable picker
  with a `max-height` and `overflow: auto` already reads the same at 11 terms
  (movement patterns) and at 29 (equipment) and would at 1100, so the threshold
  buys nothing and costs a second layout every reader has to learn, plus a
  boundary where the control changes shape under someone mid-edit as a
  vocabulary grows. *One control that scales beats two controls that each fit.*

- **The only thing that varies is a vocabulary's absence, not its size.** With
  no vocabulary — `aliases`, whose whole point is a name nobody has written
  down yet — there is nothing to browse and nothing to complete, so the picker
  and the type-ahead are not rendered at all and the field is chips plus free
  text. That is a *degradation by missing data*, which is the kind this project
  already accepts everywhere (each registry fetch failing takes its own feature
  with it), not a size variant.

- **`allowCustom` is per field, and closed is the exception.** Equipment,
  patterns, aliases, related and same-as are open: a curator meeting a new
  implement writes it down rather than waiting for a vocabulary release, and the
  picker is a shortcut rather than a gate. **Muscles are closed** — the body-map
  SVG has one hand-drawn path per id and `scripts/build-movements.mjs` fails on
  anything not in `registry/muscles.json`, so an unrecognised muscle is a typo,
  not a new term. A closed field offers no `＋ Add "x"` row and refuses the
  token — but **leaves the typed text in the box**, because clearing it would
  make a refusal look exactly like a success.

- **Both popups sit in normal flow, not floating.** The type-ahead menu and the
  picker push the fields below them down instead of overlaying. It costs a
  little layout movement while typing and buys the guarantee that neither can be
  clipped by, or overflow, the scroll container of whatever modal is hosting the
  form — which is the failure this widget would otherwise hit at every narrow
  width. Verified at 768px inside the movement editor's `<dialog>`.

- **The vocabulary is `string[]` *or* a function returning one, possibly async.**
  That is what lets V8 swap equipment and patterns from
  `apps/shared/vocab.js`'s literals to a `/api` fetch with those literals as the
  offline fallback, and lets a *host* supply a vocabulary it already holds —
  which is how the builder feeds `related` / `sameAs` its movement-id lists
  without the editor ever reaching for a builder global.

- **Where the look lives.** The widget's CSS is in `apps/builder/builder.css` on
  the shared `--ink` / `--dim` / `--rule` / `--accent` / `--page` / `--panel`
  tokens only, with ≥2rem hit boxes and no text under `.75rem`, dimmed by colour
  rather than `opacity`. A second host restyles nothing; it inherits the tokens.

### DEC-025 Equipment & movement patterns are a DB-backed vocabulary layer; `registry/{equipment,patterns}.json` is the committed dump
*Status: active. Settled 2026-09-02 with queue item V6 of the Vocabularies &
editor ergonomics epic (`370b2d0`), opening its Stage C. The same move
[DEC-020](#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)
made for the curated movement layer, applied to the two open vocabularies the
movement editor offers.*

- **Equipment and movement patterns are rows in PocketBase `equipment` and
  `patterns` collections, with `registry/equipment.json` (29 terms) and
  `registry/patterns.json` (11) as the committed, reviewable dump.** One row per
  term: `termId` (the registry `id`), `name`, `synonyms`, plus `scope` and a
  nullable `user` relation carried over from `movements` unchanged. A term is
  added by a DB row, or by editing the file and running V8's `make vocab:load`.

- **The alternative was a hardcoded list edited in JS — which is literally what
  V5 shipped as the interim.** `apps/shared/vocab.js`'s `EQUIPMENT` and
  `MOVEMENT_PATTERNS` are the two lists as literals, deliberately static so V5's
  ergonomics could ship without waiting on the data work. That is fine for a
  fixed set and wrong for an open one: `allowCustom` is **true** for both fields
  ([DEC-024](#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker)),
  so a curator meeting a new implement types it in — and under a JS literal that
  term exists in the saved movement but never in the picker, so the next curator
  types it again, differently. A vocabulary that users can extend has to be
  storage, not source.

- **Where the boundary is: muscles stays a file.** `registry/muscles.json` is a
  **closed** 19-term set. The body-map SVG has one hand-drawn path per id and
  `scripts/build-movements.mjs` exits non-zero on a name it does not know, so a
  new muscle is a code change either way — the SVG is the real limit, not the
  storage. Making it runtime-editable would buy an admin the ability to add a
  term that renders as nothing and fails the next canonical build. `allowCustom`
  is false for muscles for the same reason. The rule is not "vocabularies go in
  the database"; it is **open vocabularies go in the database, closed ones stay
  files**.

- **The entry shape is `{ id, name, synonyms }`, matched to
  `registry/muscles.json`.** Not `{ id, label, ... }`, which is what the V6
  queue note asked for — the committed file it is modelled on uses `name`, and
  matching the file beats matching the note. `synonyms` is always present, empty
  where there is nothing to fold, because muscles.json is always-present and its
  reader (`scripts/lib/muscles.mjs`) iterates it without a guard. The collection
  column is named `name` to match. **A pure case variant is not a synonym**: the
  lookup folds case, spaces, hyphens and underscores, so listing `Barbell`
  beside `barbell` claims a distinction that does not exist. `patterns.json`
  carries no synonyms at all — `pattern` is a wdl-curated field with no upstream
  source, so there is nothing to fold, which is a finding rather than an
  omission.

- **The dump is the offline fallback, not just a review artefact.** V8 points
  `apps/shared/vocab.js` at `/api` with these two files behind it — the same
  fallback shape the apps already use for movements, and the reason `vocab.js`'s
  exports were written as `string[]`-or-function from the start. So a signed-out
  reader, a `make serve` with no PocketBase, and a failed fetch all still get a
  populated picker.

- **Two collections, not one table with a `kind` column.** They are independent
  vocabularies that happen to share a shape; the editor asks for one or the
  other and never both. A shared table would make every read carry a
  discriminating filter that a wrong or missing one silently widens — offering
  `hinge` as a piece of equipment. The cost is one migration describing the same
  five fields twice, which is why they are built from a single
  `vocabCollection(name)` helper rather than copy-pasted.

- **Consequences / still open.** Same open question DEC-020 left: **dump cadence
  is undecided** — whether an admin's edit in prod is expected to be dumped and
  committed promptly or batched, and whether a `make vocab:dump` twin is wanted
  at all (V8 lists it as optional). Until V8 lands there is **no loader**, so
  the collections are empty on the box and `vocab.js`'s literals are still what
  the editor reads; the migration ships the schema ahead of its data on purpose,
  the way M1 did.

What was *tried* and turned out wrong is in
[lessons-learned.md](lessons-learned.md); what is not built on purpose is in
[deliberately-not-done.md](deliberately-not-done.md).
