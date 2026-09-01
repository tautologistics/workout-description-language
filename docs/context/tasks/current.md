# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

The deployment epic (items 18–20) **landed 2026-08-30** and the **builder
layout redesign** — direction **C (Document + margin)**, the ten-stage chain
**R1 → R10** — **landed 2026-08-31**. Both are in [completed.md](completed.md),
each grouped as one section. The redesign's absorbed chain items (12 ↔ R2,
16 ↔ R3, 17 ↔ R9, 15 a/c/d ↔ R3 + R10) closed with it.

**Item 21 (a root Makefile task surface) landed 2026-08-31** —
[DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson).
**Item 11 (a bare-word block header is an inert section) landed 2026-08-31**
(`70a1852`) — [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section).
**Item 13 (laterality in the builder's `»` panel) is closed entirely as of
2026-08-31** — 13c `02d819d` (append/double bug), 13b `cf3c47f`
([DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised),
the per-side form is parenthesised), 13a-curation `71f9469` (the
`lateralityAxis` registry field), 13a `1ffc8d0` (the `»` panel renders the
axis — `(each direction)`). See [completed.md](completed.md).

**Every earlier numbered item is closed** — the whole 0-series through 21, the
deployment epic (18–20) and the redesign chain (R1–R10). **The
*Movements in the database — Phase 1* epic is also complete as of 2026-09-01**:
M0–M7 all landed (M6, the nightly VPS DB backup, `97f236f`), and the whole
M-section moved to [completed.md](completed.md) as one grouped section, the way
the deployment epic and the redesign chain were closed.

**One epic is now queued — *The workout library* (L0–L7)**, fleshed out
2026-09-01 from Chris's ask and the calls he made on it; the section is below,
sized like M0–M7 for sequential sessions. Three standalone tasks are also
queued, all dispatchable now:

- **unit defaults** — a unitless `@ 95` load target reads as `95lb` (pound is
  the default); a unitless magnitude on a machine/aerobic movement reads as
  calories.
- **board: dismissible notifications** — a "Clear notifications" footer button.
- **board: the `#` title moves into the meta strip** — not a body row; `@id`
  shown small in parentheses after it.

Recently closed (kept here briefly for the trail):

- **~~The `»` panel's per-implement load token (`@ 2x`) is unclear
  mid-edit~~ — landed 2026-09-01 (`00f599c`).** The seeded `@ Nx` token
  stays (it carries the implement count, and a bare `@ Nx` round-trips clean —
  unlike the plain-load `@ `); its *reading* was fixed instead — the pick's
  label now names the finished shape (`@ 2x — load, per implement (2) — then
  type the weight: @ 2x35lb`) and a transient inline hint appears by the caret
  after the pick. Full write-up in
  [../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.

---

## Standalone task — unit defaults: a unitless load target is pounds

*Raised 2026-09-01 by Chris, answering the open question from the `»`-panel
task's report. Closes two "Open" items in
[../topics/known-debts.md](../topics/known-debts.md) ("what a target with no
unit means", and the calorie half of the `Nx`/unit family).*

Chris's call, verbatim intent: **"A unitless `@ 95` should just be 95 pounds.
Pound should be the default for any exercise that carries a load. Something like
rowing / machines / running — any aerobic work that carries no load — the safe
assumption is calories (that is what I have always seen). Distance is never
unitless in practice — it is always feet or metres (rarely miles) — so it keeps
requiring its unit."**

This **overrides** the current holding answer, which
[../topics/known-debts.md](../topics/known-debts.md) states deliberately: today
`@ 95` parses to `{kind: 'raw', text: '95'}` — held, meaning nothing — on the
reasoning that "`@95` is 95lb in one gym and 95kg in another, so a default is an
invention". Chris is settling it: **the default is `lb`**, stated once here
rather than left as raw.

Two rules, and the second is the bigger change:

1. **`@ <number>` with no unit → `<number>lb`** — a `Load` with `unit: 'lb'`,
   not `raw`. `Load.unit` is a required `'lb' | 'kg'` today, so this is either
   "default the parse to `lb`" (simplest — the AST never carries an absent
   unit) or "make `unit` optional and default at every read site". Prefer the
   former: `targetText` / the load rule fills `lb` when the magnitude has no
   unit suffix. Reaches `formatLoad` (canonical output becomes `@ 95lb` — decide
   whether `wdl fmt` *rewrites* `@ 95` to `@ 95lb` or leaves it; likely
   rewrites, since the format's job is to make the reading explicit), volume,
   muscle analysis, every exporter, and the golden files.
2. **A unitless magnitude on a non-load machine/aerobic movement → calories** —
   `15 Row` reads as `15cal Row`. This one is registry-derived: it applies only
   when the row's movement resolves to an entry with `measures` including
   `calories` and `load` null/absent (Row, Bike, Ski, Assault Bike, Run only if
   it also measures calories — Run is usually distance, so tread carefully).
   Bigger blast radius than rule 1 — it changes what `quantity` means on a whole
   class of steps — and it needs the movement resolved at parse time, which the
   parser does not do today (resolution is a later pass). May need to land as
   its own step after rule 1, or be scoped to "diagnose, suggest the unit" (a
   `note`) rather than silently defaulting. **Open for Chris:** silent default
   vs. a suggesting diagnostic for rule 2.

Scope: `spec/spec-0.1.md` §3/§7, `spec/grammar-0.1.ohm`,
`packages/core/src/parse.ts` + the load/target semantics, `packages/core/src/`
formatter and anything walking `targets` for `kind === 'load'`, the golden
files (`node packages/core/test/golden/generate.ts`, read the diff — load-by-
muscle moves), `test/grammar.test.ts` + `test/golden/vocabulary.ts` (six forms
are pinned there as `was-wrong`; `@ 95` joins them). No app change strictly
required, but the builder's `»`-panel plain-load pick could then seed `@ ` →
still fine, and its diagnostics will show the rewrite.

---

## Standalone task — board: parse errors / notifications must be dismissible

*Raised 2026-09-01 by Chris, driving the board.*

The board shows parse errors (and other notifications) in a red strip at the
bottom. **Showing them is right; there is no way to dismiss them.** Wanted:
either a per-line `✕`, or — Chris's preference — a **"Clear notifications"
button in the footer control row, beside Start / Next / Back / Reset**. It
clears the strip until the next parse/notification event repopulates it.

Scope: `apps/display/board.js` (the footer control assembly and the
diagnostics/notifications render — find where the red strip is drawn and where
`el('reset')` etc. are wired), `apps/display/board.css` (button + a `.hidden`
or emptied state for the strip), `apps/display/index.html` if the footer
buttons are static markup rather than built in JS. The board has no light
theme — verify dark only. No core change. Small and self-contained.

---

## Standalone task — board: the `#` title belongs in the meta strip, not the body

*Raised 2026-09-01 by Chris, driving the board. Closes the "reversible default
— open whether it moves into the strip too" question left by item 15b (see
[../topics/builder-ux.md](../topics/builder-ux.md) "The board", and
[../topics/what-exists.md](../topics/what-exists.md) Apps row).*

Today the workout's `# Title` line renders as the **first board body row**,
sitting among the movements an athlete reads mid-set. It should not be a body
row. Wanted:

- The `# Title` moves **into the `#meta` strip under the bar** — the strip that
  currently shows only the `@id`. The **title shows there**, prominent.
- If the workout also has an `@id`, it shows **smaller, in parentheses after
  the title** — `Fran (crossfit:fran)`.
- The workout **body renders line-for-line from the first non-preamble line** —
  the `# title` line joins the preamble run that `preambleEnd()` already
  detects and is not drawn as a `.line` row (keep `dataset.line` 1:1 with the
  source so `paint()`'s physical-line cue matching stays correct, same
  technique item 15b used for `@key` lines).

Scope: `apps/display/board.js` (`preambleEnd()` / `draw()` — extend the
hidden-preamble run to the `# title` line; the `#meta` strip render — add the
title, parenthesise the id), `apps/display/board.css` (`#meta` title vs. id
sizing). Update [../topics/what-exists.md](../topics/what-exists.md) (the Apps
row currently says "the `# title` stays the first board row"). Dark only. No
core change.

---

## The workout library (L0–L7)

*Raised 2026-09-01 by Chris: he wants **non-interactive "org" accounts** that
own curated, public sets of named workouts — a `crossfit` account owning the
official benchmarks (Fran, Fight Gone Bad, the Girls, the Heroes, …), a `hyrox`
account, a `tabata` account, room for more — plus **fixtures generated from
authored `.wdl`** so that from the first `make serve` (and on a fresh prod box)
anyone can pull down a whole org's set or open any single workout, plus
**search over one's own + any public workout by name or `@id`/record-id**.*

**Four calls Chris made when this was fleshed out (2026-09-01):**

1. **Org accounts are flagged `users` rows** — a new `org: true` (bool) on the
   `users` collection, no OAuth identity, rows created by a migration with fixed
   ids. Their workouts are owned by them with `visibility: "public"`. Reuses the
   existing `owner` relation and every existing list/view rule; no new
   collection, no `workouts`-schema churn for ownership.
2. **The account handle *is* the `@id` namespace prefix — for every account,
   not just orgs.** The `crossfit` account owns everything whose `@id` is
   `crossfit:*`; a person's handle namespaces the workouts *they* create the
   same way. **This epic is the forcing function for the deferred "account
   namespacing" rethink** and settles most of it:
   - `users.handle` (username), unique, is the `@id` namespace for that
     account's workouts.
   - **The user picks / edits their own handle** — it is not derived and not
     fixed. Needs a place in the UI to set it (account settings in the builder
     header, and/or a prompt the first time a signed-in user saves a workout).
   - **Onboarding must not block on it:** a new account gets a **random
     two-word handle** (`brave-otter`, `quiet-harbor` — an adjective+noun
     generator, collision-checked) so a save always has a namespace; the user
     can change it later.
   - **Known debt, explicitly deferred (Chris: "we can revisit that"):** when a
     user changes their handle, every existing `<oldhandle>:<slug>` `@id` and
     every share link built on it goes stale. Phase 1 does **not** solve this —
     record it in [../topics/known-debts.md](../topics/known-debts.md) and move
     on. Options to weigh later: rewrite `wdlId` + the `@id` text on all their
     workouts on rename; keep old handles as aliases; forbid rename once a
     workout exists.

   The only thing left in the deferred rethink after this epic: whether saving
   *rewrites* the `@id` line in a person's workout text to match their handle,
   and warn-on-mismatch UX. Org workouts sidestep it (loaded, not hand-saved).
3. **Search-by-ID uses a new `workouts.wdlId` column**, parsed from the `@id`
   directive on every create/update and indexed. Search matches `title ~ q`,
   `wdlId = q` (or `~ q`), or the 15-char record id. This also advances the
   deferred "`@id` ↔ record-id correlation" rethink.
4. **A session drafts all the benchmark `.wdl` content**, Chris reviews the
   diff. One L-task is the authoring pass; the WOD list is canonical and
   public, but transcribing it into WDL accurately (and whiteboard-readably) is
   real work and the place errors get in.

Grounding facts (what the tasks are built against — cf. the M0–M7 section in
[completed.md](completed.md)):

- The `workouts` collection
  (`deploy/pocketbase/pb_migrations/1756600000_create_workouts.js`):
  `owner` (relation → `users`), `title`, `source` (the `.wdl` body, ≤200 000
  chars), `visibility` (select `private|unlisted|public`), autodates. Rules:
  list/view `owner = @request.auth.id || visibility != "private"`; write
  owner-only. Indexes on `owner`, `visibility`.
- `apps/shared/pocketbase.js` is the hand-rolled `/api/*` client — `listMine`,
  `getById`, `create` (always `private`), `update`, `remove`, `shareUrl`
  (`/apps/display/?w=<id>`). The board resolves `?w=<id>` through `getById`
  (item 20). There is **no search call and no `wdlId` anywhere** yet.
- Local `make serve` has no PocketBase: `scripts/mock-api.mjs` answers `/api`
  from `fixtures/users.json` (one row, `admin:true`) + `fixtures/workouts.json`
  (seed rows, `owner` = that user; runtime writes → git-ignored
  `fixtures/workouts.local.json`). The mock's query support is deliberately
  minimal (`filter=field="value"` AND, `sort`, `page`/`perPage`) — search adds
  `~` and an OR to it.
- `registry/`-style ingestion precedent: `scripts/movements-to-db.mjs`
  (`make movements:load`) — no-deps, idempotent upsert over `/api/collections/…`,
  keyed on a unique column, admin auth for prod, works against the mock. The
  library loader is its twin for `workouts`.
- `@id` is already a spec directive (`@id crossfit:fran`, spec preamble) and
  the existing Fran fixture already uses exactly that value.

**L0 — Design note / decision (DEC-021).** Write the contract the rest builds
against, the way M0 → DEC-020 did: org accounts as flagged `users` rows;
`users.handle` = the `@id` namespace **for every account**; how a new account
gets a random two-word handle and how the user edits it; `workouts.wdlId`
parsed from `@id` on save; how a lookup resolves *either* a record id or a
`<handle>:<slug>` `@id`; what a save does when the `@id` in the text disagrees
with `wdlId` (write-back? warn? Phase-1 need only cover org workouts, which are
loaded not hand-saved); the **handle-rename debt** (stale `<oldhandle>:<slug>`
ids — deferred, recorded in `known-debts.md`, not solved here); and the
boundary with what is left in the deferred account-namespacing rethink. No
code. `docs/context` + a `spec` note if the `@id`↔namespace rule needs stating
there. Spawns L1.

**L1 — `users` schema: `org` bool + `handle`, + a handle generator/editor.**
Migration adds `org` (bool, default false) and `handle` (text, **unique**,
nullable) to `users`; a second migration (or the same one) inserts the org rows
— `crossfit`, `hyrox`, `tabata` — with fixed ids and handles, `org: true`, no
password/OAuth. Then the app side: on first sign-in with no handle, assign a
**random `adjective-noun` handle** (a small committed word-list in
`apps/shared/`, collision-checked against the collection) and persist it; add a
**handle editor** in the builder header's account area — show the current
handle, let the user change it to any unused valid slug (`[a-z0-9-]+`),
reject a taken one. `apps/shared/pocketbase.js` grows `updateHandle(h)` /
reads `currentUser().handle`. Mirror in `scripts/mock-api.mjs` +
`fixtures/users.json` (give the mock user a handle). Verify: fresh mock user
gets a handle, rename to a free slug works, rename to `crossfit` (taken)
rejects. Verify up+down of the migration against a real PocketBase v0.40.1
binary. `deploy/README.md` section. **Still-to-do-on-deploy** note like M1/M2.
Spawns L2.

**L2 — `workouts` schema: `wdlId` column.** Migration adds `wdlId` (text,
nullable, indexed) to `workouts`. No rule change (visibility rules unchanged).
Note that existing rows have it null until re-saved / backfilled (L3 covers new
saves; L6's loader sets it for the library). Verify up+down. Spawns L3.

**L3 — `wdlId` on save + lookup resolver.** `apps/shared/pocketbase.js`:
`create` / `update` parse the `@id` value out of `source` (a light regex, or a
core directive helper if one is cheap to import) and send `wdlId`; add a
resolver `getByAnyId(x)` that tries the record-id route then
`filter=wdlId="<x>"`. Point the board's `?w=<id>` resolution at it so a share
link can carry `crossfit:fran`. Mirror in `scripts/mock-api.mjs`
(`filter=wdlId="…"`, and set `wdlId` on mock create/update). Verify by driving
the builder (save a workout with `@id x:y`, confirm the column) and the board
(`?w=x:y` resolves). Spawns L4.

**L4 — Search: API + builder UI.** `searchWorkouts(q, {page})` in
`pocketbase.js` — `filter=(visibility="public" || owner="<uid>") && (title~"<q>"
|| wdlId~"<q>")`, `sort=-updated`, paged. Builder: a search input in the
*My workouts* / *Open…* area that lists matches (own + public, each labelled
which), click-to-open into the editor. `scripts/mock-api.mjs` gains `~`
(substring) operator support and the parenthesised OR for this exact filter
shape. Verify driving the builder in both themes: own private hit, public hit
from an org account, by title and by `@id`. Spawns L5.

**L5 — Author the benchmark `.wdl` library.** `examples/workouts/<org>/<slug>.wdl`
for the canonical lists, each with `@id <org>:<slug>` and a `# Title`:
**CrossFit** — the Girls (Fran, Cindy, Grace, Helen, Diane, Elizabeth, Isabel,
Jackie, Karen, Linda, Nancy, Angie, Barbara, Chelsea, Mary, Annie, Eva, Kelly,
Nicole) and a first set of Heroes (Murph, DT, Chad, JT, Michael, Randy, Daniel,
Josh, Nate) plus Fight Gone Bad, Filthy Fifty, the CrossFit Total; **HYROX** —
the full race and its eight stations; **Tabata** — the protocol and the common
"Tabata This/That" variants. Chris reviews the diff. Hard constraints apply
hardest here: the at-rest text must read on a whiteboard, and a wrong
prescription is a real error. No schema/code — pure content. Spawns L6.

**L6 — Ingestion: library → DB + fixtures.** `scripts/workouts-to-db.mjs`
(`make workouts:load`), twin of `movements-to-db.mjs`: reads
`examples/workouts/**/*.wdl`, upserts each as a `workouts` row owned by the
matching org handle, `visibility: "public"`, `wdlId` from `@id`, **idempotent
on `wdlId`** (`POST` absent / `PATCH` changed / re-run writes nothing;
`--dry-run`). Same run also regenerates `fixtures/workouts.json` (the library
rows) and `fixtures/users.json` (the org rows) so a fresh `make serve` shows
the whole library with no PocketBase — `registry/movements.json` being its own
fixture is the precedent. Prod run needs admin auth
(`WDL_PB_ADMIN_*`, like `movements:load`); against the mock it just works.
Verify: fresh mock → creates N / re-run all-unchanged / edit one `.wdl` →
updates exactly 1. Spawns L7.

**L7 — Surface the library in the apps.** The builder's *Open…* / *My
workouts* area gets a way to browse an org's public set (filter by owner
handle, or a small "Examples" list), and "open on the board" for any public
workout. Board: confirm `?w=crossfit:fran` works end to end and shows the org
as the source. Small polish pass; may fold into L4 if that comes in light.
Closes the epic — move L0–L7 to [completed.md](completed.md) as one section.

---

## Loose bullets — unscheduled, need Chris to scope

- **A full laterality curation sweep** — not a numbered item. `around-worlds` is
  the only movement carrying `lateralityAxis`. The audit-CSV tooling is ready:
  `export-movement-curation.mjs` (`make curation:sheet`) emits the sheet with a
  `Laterality axis` column in both the CURRENT and CURATE blocks, and
  `import-movement-curation.mjs` lands it back. A sweep is run via that CSV per
  [../topics/running-it.md](../topics/running-it.md), not hand-edits — needs
  Chris to scope which movements. Note `around-worlds` itself looks mis-sourced
  (free-exercise-db's "Around The Worlds" is a lying dumbbell bench fly, not the
  kettlebell around-the-head movement its `lateralityAxis: "direction"` +
  `per-side` describe) — the sweep should resolve what that entry is. The CSV is
  now the **bulk** path; per the rethink below, one-at-a-time movement edits are
  headed into an in-app GUI.

- **Post-redesign rethinks** (not scheduled) — the board's **Edit** button
  round-tripping into the builder, and the remaining **account-namespacing**
  questions for *personal* accounts (claiming `chris:*`, whether saving writes
  `@id` back into the text, warn-on-mismatch). *`@id` ↔ record-id correlation,
  the org-account namespace, `users.handle`, `workouts.wdlId` and an
  "open on the board" action are now absorbed into **The workout library
  (L0–L7)** above.* In
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

