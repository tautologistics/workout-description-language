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

  *Settled on evidence: the step-line grammar reproduces the current parser's
  AST on 538/538 lines — every step line in the corpus, every step form in the
  spec, and the exotic forms neither exercises.*

  *Corrected twice on 2026-08-14, the day it was settled. It first read "an
  in-repo PEG interpreter, not a generator", reasoning from "the repo has no
  dependencies" — which is not the rule, see the dependency entry above; that
  would have hand-written a PEG engine that libraries already provide. It then
  read "peggy, generated parser checked in", which is a sound option and was
  rejected only on comparison: peggy embeds semantic actions in the grammar, so
  the pure spec would have to be generated from it by stripping them, and it
  checks 128K of generated JS into the source path. Ohm needs neither.*

What was *tried* and turned out wrong is in
[lessons-learned.md](lessons-learned.md); what is not built on purpose is in
[deliberately-not-done.md](deliberately-not-done.md).
