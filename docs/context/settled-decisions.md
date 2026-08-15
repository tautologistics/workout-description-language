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

What was *tried* and turned out wrong is in
[lessons-learned.md](lessons-learned.md); what is not built on purpose is in
[deliberately-not-done.md](deliberately-not-done.md).
