# Decisions

The structurally significant decisions, indexed here with a one-line summary
and a link to the full reasoning. **Every** settled decision — including
narrower ones not indexed below (data-modelling calls, resolver tie-breaks,
formatter spellings) — is recorded in full, with its rationale and
consequences, in [topics/settled-decisions.md](topics/settled-decisions.md);
read this file to find the one you need, then follow the link for the
argument behind it. Reopening any of them needs a reason better than "it
would be tidier".

What was *tried* and turned out wrong is in
[topics/lessons-learned.md](topics/lessons-learned.md); what is not built on
purpose is in [topics/deliberately-not-done.md](topics/deliberately-not-done.md).

## DEC-001 — Intent lives outside the workout
Status: active.
Goals are a separate artifact from the workout — the same workout is good
against one intent and bad against another.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-001-intent-lives-outside-the-workout)

## DEC-002 — Two-phase parse
Status: active.
`readLines` turns indentation into a tree with no WDL knowledge; phase 2 is an
ordinary line grammar over it — reused for workouts, goals and programs.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-002-two-phase-parse)

## DEC-003 — `src/` is portable and is handed its data
Status: active. Sharpened 2026-08-15.
`packages/core/src/` imports by relative path and no other way, enforced by a
test that reads every specifier in a file.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-003-src-is-portable-and-is-handed-its-data)

## DEC-004 — The dependency rule binds the shipped core, not the repository
Status: active. Recorded 2026-08-14.
"Zero dependencies" describes `packages/core/src/`, which ships into a
server, a browser and a mobile app at once — not the toolchain that builds it.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-004-the-dependency-rule-binds-the-shipped-core-not-the-repository)

## DEC-005 — The text is the document
Status: active.
Structural edits splice lines in place rather than regenerating from the AST,
so comments and spacing survive; canonicalising is a button, never a side
effect.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-005-the-text-is-the-document)

## DEC-006 — The grammar is written in PEG, notation carries no actions
Status: active. Settled 2026-08-14.
PEG rather than EBNF because WDL's rules are inherently ordered; the grammar
file holds no semantic actions, so it stays readable as a contract.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-006-the-grammar-is-written-in-peg-notation-carries-no-actions)

## DEC-007 — The grammar is an Ohm grammar, semantics in a separate file
Status: active.
Ohm *completely separates* grammars from semantic actions, so the grammar
file is the normative spec and the thing the parser runs, with nothing to
drift between them.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-007-the-grammar-is-an-ohm-grammar-semantics-in-a-separate-file)

## DEC-008 — `ohm-js` is vendored, imported by relative path
Status: active. Settled 2026-08-15.
Vendored into `packages/core/src/grammar/vendor/` rather than left as an npm
dependency, because a browser emit that resolves no modules cannot reach a
bare specifier.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-008-ohm-js-is-vendored-imported-by-relative-path)

## DEC-009 — The grammar is the parser, reaches the core like data
Status: active. Settled 2026-08-15 by queue item 0a.
`parse.ts` matches `spec/grammar-0.1.ohm` and walks it; the grammar text is a
`CoreData` key beside the movement registry, handed over by `provide()`.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-009-the-grammar-is-the-parser-reaches-the-core-like-data)

## DEC-010 — Unknown text is held, inert, and said out loud as a `note`
Status: active. Settled 2026-08-15 by queue item 0d.
A modifier no rule reads is kept verbatim, round-trips, reaches nothing that
derives meaning, and is reported at a fourth diagnostic severity that claims
nothing.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-010-unknown-text-is-held-inert-and-said-out-loud-as-a-note)

## DEC-011 — An rx split lowers into the variant resolver, not the `variants:` table
Status: active. Settled 2026-08-18, closing queue item 1.
A `variants:` entry is keyed by movement and a split belongs to a step, so
rewriting a split into a table entry would silently collapse two steps at
different splits.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-011-an-rx-split-lowers-into-the-variant-resolver-not-the-variants-table)

## DEC-012 — A workout is a class; an execution is an instantiation
Status: active. Settled 2026-08-19 with Chris.
Load lives on the instantiation, not the class — reps, distance, calories and
seconds are properties of the class; what weight went on the bar is a fact
about a particular session.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-012-a-workout-is-a-class-an-execution-is-an-instantiation)

## DEC-013 — The generation pool is a judgement, not a score
Status: active. Settled 2026-08-23, closing queue item 4.
`core` is the union of three signals that are somebody's judgement (corpus,
curator, vendor 1RM) rather than a threshold on catalogue agreement.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-013-the-generation-pool-is-a-judgement-not-a-score)

## DEC-014 — An explicit alias outranks a record's own id
Status: active. Settled 2026-08-23, closing queue item 8.
A curator's alias answers the exact question a contested name asks; an
imported record's id is only an accident of upstream naming.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-014-an-explicit-alias-outranks-a-records-own-id)

## DEC-015 — Two records are one movement only when a curator says so (`sameAs`)
Status: active. Settled 2026-08-23, closing queue item 8's residue.
`sameAs` on a curated record names the ids it is one movement with; reading an
existing alias as a merge signal was rejected because an alias is a much
weaker claim.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-015-two-records-are-one-movement-only-when-a-curator-says-so-sameas)

## DEC-016 — A hosted instance on the DreamHost VPS, with PocketBase for auth and storage
Status: active. Settled 2026-08-30, opening queue items 18-20; reverses the
"Sharing, accounts, a platform" Non-Goal (see [goals.md](goals.md) "## Pivots").
Deploy the static apps to a public URL on the VPS Chris already pays for; run
PocketBase (one Go binary: SQLite, built-in Google OAuth2, REST API) beside
them for accounts and saved/shared workouts. Managed backends (Supabase,
Firebase) rejected on idle-pause / cold-start and a SaaS dependency; a
hand-rolled Express + Passport backend rejected as the wheel not worth
reinventing; hosted auth (Auth0/Clerk) rejected because it still needs a
database behind it. No bundler and no npm runtime dep is added. `packages/core`,
the grammar and the spec are untouched -- a stored workout is its `.wdl` source
text in a column.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)

## DEC-017 — A root Makefile is the task surface, not a root `package.json`
Status: active. Settled 2026-08-31, closing queue item 21. The routine
dev-lifecycle actions (test, build, serve, registry rebuild, golden regen,
deploy, …) get one `make <target>` each — thin wrappers over the existing
`node scripts/*` commands, with `make` alone printing the list. A root
`package.json` `scripts` block was the idiomatic alternative but rejected: this
repo is install-free on purpose (DEC-003 / DEC-008 — no `node_modules`, no
lockfile, `ohm-js` vendored) and a root `package.json` invites `npm install`
and a `package-lock.json`. `make` adds nothing to install. Targets may not add
a dependency; the registry pipeline stays one atomic target.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson)
