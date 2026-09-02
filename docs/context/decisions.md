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

## DEC-018 — A bare-label block header is a section, not an error
Status: active. Settled 2026-08-31, closing queue item 11; makes spec §2's "or
any custom label" true. A header whose label (before the first `,` or `@`) is
all letters, spaces and hyphens, with no digit and not opening with a kind-word,
parses as `type: 'section'` — the inert labelled container the fixed eight
section words produce — for any label. It is read **and** reported at the `note`
severity (`validate.ts` `custom-section`, per DEC-010): a coined heading could be
a typo, where the fixed eight are silent because they are a closed vocabulary.
Case is preserved verbatim (the fixed eight stay lower-cased). A digit anywhere,
or a leading kind-word missing its parameter (`RFT:`, `every:`, `build:`), keeps
it the reported error spec §5.2 / §11.1 make it — the miss loses how the block
executes, which is the line DEC-010 draws. Implemented as a grammar production
(`customSection` + `kindLead`), not a `parse.ts` reclassification, so the grammar
still owns what exists (DEC-006 / DEC-007).
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section)

## DEC-019 — The per-side laterality form is parenthesised: `(each arm)`
Status: active. Settled 2026-08-31, closing queue item 13b; reverses spec §4's
bare `each arm` spelling. All four laterality modes are now parenthesised —
`(split)` / `(both)` / `(total)` name how the count is performed, `(each <axis>)`
names that plus the axis it is performed across. `axis` is `arm | leg | side |
hand | direction`; `direction` is new (a rotation performed once each way, e.g.
`Around The Worlds (each direction)`). The parser also *reads* the parenthesised
per-side form now — before, `(each direction)` fell to `unreadableParen` and was
held as unknown text. Bare `each arm` / `per leg` still parse (input tolerance),
`total` still maps to `(split)`, `(both)` stays distinct; canonical output is the
parens. Cost: 9 corpus `.wdl` files reformatted, moving only the `text` field of
those 9 in `workouts.canonical.json` — no AST or summary changed. Side selectors
(`first arm`) and team words (`shared`) stay bare — a laterality-only change.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised-each-arm)

## DEC-020 — The curated movement layer lives in PocketBase; `registry/movements.json` is its committed dump
Status: active. Settled 2026-08-31, opening the *Movements in the database —
Phase 1* epic (M0).
The ~972-entry curated movement layer (`laterality` / `defaultLaterality` /
`lateralityAxis` / `load` / `implements` / `measures` / `force` / `mechanic` /
`equipment` / `aliases` / `muscles` / `pattern`) is edited in a PocketBase
`movements` collection, not by hand-editing JSON. `registry/movements.json`
stays in the repo as the reviewable dump of that collection (`make
movements:dump`, M4) and remains the unchanged, offline, install-free file
`packages/core`, its tests and `build-canonical.ts` read. Production apps read
movements via `/api/collections/movements/records` (same-origin PocketBase);
local `make serve` answers `/api` from a mock (M7) with `registry/movements.json`
as the movements fixture. `packages/core`, the grammar and the spec are
untouched.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)

## DEC-021 — An account's handle is the `@id` namespace, forced onto every workout on save; `workouts.wdlId` mirrors it
Status: active. Recorded 2026-09-01, opening the *workout library* epic (L0).
Curated public sets are owned by flagged `users` rows (`org: true`, fixed ids
from a migration, no OAuth, workouts `visibility: "public"`) — no new
collection. A new unique `users.handle` (`[a-z0-9-]+`, user-editable, random
`adjective-noun` default from committed `apps/shared/` word lists) is the `@id`
namespace prefix for **every** account. Every save writes/rewrites the workout's
`@id` line to `<owner-handle>:<slug>` (slug from an existing `@id`, else the
title; same-owner collision → deterministic suffix) — so there is no
un-namespaced saved workout and no mismatch state; copy→save re-namespaces
naturally; the L6 loader applies the same rule non-interactively to org
workouts. `workouts.wdlId` is set from the same value, indexed; `getByAnyId`
resolves a `:`-bearing `wdlId` or a 15-char record id to the same row, and the
board's `?w=` uses it. `packages/core`, the grammar and spec *semantics* are
untouched — the namespace rule is a hosting convention, with one flagged note
added beside spec §2's `@id` bullet. Deferred: handle-rename strands saved
`@id`s / share links ([topics/known-debts.md](topics/known-debts.md)); a
*platform* stays a Non-Goal.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)

## DEC-022 — A unitless load magnitude is pounds; `wdl fmt` writes the unit in
Status: active. Settled 2026-09-01 (`6829052`), closing the "what a target
with no unit means" holding answer.
`@ <number>` with no unit reads as `<number>lb` — `parseTarget` fills `unit:
'lb'` for a bare magnitude, so the AST carries a real `load` and `wdl fmt`
rewrites `@ 95` → `@ 95lb`. Pound is the dominant convention for a load that
omits its unit, so it is a documented default (design rule 3), not a guess —
this overrides the earlier "a default is an invention" holding answer, recorded
as a correction in [topics/known-debts.md](topics/known-debts.md). Distance
still requires its unit; the unlabelled rx split is unaffected. No corpus file
uses a unitless load, so `interpretations.json` is unmoved. A unitless magnitude
on a load-less calorie machine (`15 Row`) is rule 2 — a builder-only diagnostic,
not a parse default (spec §7.1).
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in)

## DEC-023 — `measures` on a movement is a capability set, not a choice
Status: active. Settled 2026-09-02 (`77bff40`), withdrawing queue item V3 after
the implementation disproved its premise. No code shipped.
A registry entry's `measures` is the set of output units the movement *can* be
prescribed in, not the one it is — all four subsets are meaningful, and **both**
is correct for the three ergometers (`bike` / `row` / `skierg`). So the movement
editor **keeps its two checkboxes**; the proposed 3-way segmented control had no
meaningless state to prevent. The spec agrees (§9.3) and
`import-movement-curation.mjs` maintains the field as a per-mode independent set.
Single-select would have silently narrowed those three rows on save, switching
off `calorieUnitHints()` (rule 2 of
[DEC-022](topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in))
and dropping a `»` modifier pick. The rest of the epic is unaffected.
-> [topics/settled-decisions.md](topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)
