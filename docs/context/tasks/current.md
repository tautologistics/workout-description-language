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

**One epic is in flight — *The workout library* (L0–L7)**, fleshed out
2026-09-01 from Chris's ask and the calls he made on it; the section is below,
sized like M0–M7 for sequential sessions. **L0 landed 2026-09-01
(`b9c52f1`)** — the contract is
[DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)
+ a spec §2 note; **L1 landed 2026-09-01 (`88ab8b6`)** — the `users`
`org`+`handle` migration + handle generator/editor; **L2 landed 2026-09-01
(`fc72881`)** — the `workouts.wdlId` column migration; **L3 landed 2026-09-01
(`<TASK-SHA>`)** — every save now force-writes `@id` / `wdlId` to
`<owner-handle>:<slug>` and the board resolves `?w=<handle>:<slug>` as well as
`?w=<recordid>`; **L4 (search: `searchWorkouts` + builder search UI + the mock's
`~` operator and parenthesised OR) is next**. Three standalone tasks are also
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
task's report. Settles the "what a target with no unit means" Open item in
[../topics/known-debts.md](../topics/known-debts.md). Two rules with very
different blast radii — rule 1 is a real parser/spec change, rule 2 is a
builder-only diagnostic — and they can land separately.*

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
2. **A unitless magnitude on a non-load machine/aerobic movement — a
   *builder-only suggesting diagnostic*, not a parse-level default**
   (Chris, 2026-09-01). `15 Row` on a machine that measures calories: the
   **builder** shows a diagnostic suggesting the unit ("did you mean
   `15cal Row`?"), registry-derived (the row's movement resolves to an entry
   with `measures` including `calories` and no `load`). The **board stays
   agnostic** — it renders exactly what was written, no defaulting, no
   forced calories. So this rule is **not** a `parse.ts` / grammar / spec
   semantics change: the parser keeps the magnitude as-is; only
   `apps/builder/builder.js`'s diagnostics/findings gain the suggestion. A
   `spec` *note* that a bare magnitude on a calorie-measured machine is
   ambiguous is fine; the reading is not changed. Can land independently of
   rule 1 (and is much smaller).

Scope — **rule 1**: `spec/spec-0.1.md` §3/§7, `spec/grammar-0.1.ohm`,
`packages/core/src/parse.ts` + the load/target semantics, `packages/core/src/`
formatter and anything walking `targets` for `kind === 'load'`, the golden
files (`node packages/core/test/golden/generate.ts`, read the diff — load-by-
muscle moves), `test/grammar.test.ts` + `test/golden/vocabulary.ts` (six forms
are pinned there as `was-wrong`; `@ 95` joins them). No app change strictly
required. **Rule 2**: `apps/builder/builder.js` diagnostics/findings only —
registry-derived suggestion, no core/spec-semantics change; the board is
untouched.

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
   - **Saving always forces the `@id` namespace to the owner's handle**
     (Chris, 2026-09-01): a user *cannot not* set the namespace. On every
     save, the `@id` line is written/rewritten to `<owner-handle>:<slug>` — so
     there is no "mismatch" state and no warn-on-mismatch UX to design.
     Copying another user's workout (`crossfit:fran`) and saving it naturally
     re-namespaces it to `<yourhandle>:<slug>`. This **fully closes** the
     `@id`-write-back question the deferred rethink held open.
   - **Known debt, explicitly deferred (Chris: "we can revisit that"):** when a
     user changes their handle, every *already-saved* `<oldhandle>:<slug>` `@id`
     and every share link built on it goes stale. Phase 1 does **not** solve
     this — record it in [../topics/known-debts.md](../topics/known-debts.md)
     and move on. Options to weigh later: on rename, rewrite `wdlId` + the `@id`
     text across all the user's workouts (the natural extension of "save forces
     the namespace"); keep old handles as resolvable aliases; forbid rename once
     a workout exists.

   After this epic, **nothing about `@id` ↔ namespace is left in the deferred
   rethink** — only the handle-rename debt above, and it is deferred on purpose.
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

**L0 — Design note / decision (DEC-021). DONE 2026-09-01 (`b9c52f1`).**
Written up as
[DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)
(+ the index entry in [../decisions.md](../decisions.md)) and a one-sentence
**hosting-convention note** beside spec §2's `@id` bullet (`spec/spec-0.1.md`)
— flagged explicitly as a convention, so the "never derived from contents"
language rule is untouched; no grammar / parser / `packages/core` change, suite
unchanged at 2064/2064. The DEC nails: `org: true` flagged `users` rows own the
curated sets; `users.handle` (unique, `[a-z0-9-]+`, user-editable, random
`adjective-noun` default from committed `apps/shared/` word lists) is the `@id`
namespace for every account; every save writes/rewrites `@id` to
`<owner-handle>:<slug>` (slug from an existing `@id` else the title; same-owner
collision → deterministic suffix; copy→save re-namespaces; L6 loader applies the
same rule to org workouts non-interactively); `workouts.wdlId` set from the same
value, indexed; `getByAnyId` resolves a `:`-bearing `wdlId` or a 15-char record
id to one row (the `:` is the discriminator) and the board's `?w=` uses it; the
mock `/api` + `fixtures/` mirror all of it; the handle-rename staleness and any
*platform* concern are out of scope. Original spec follows.

Write the contract the rest builds
against, the way M0 → DEC-020 did. It must state, at minimum:

- Org accounts are flagged `users` rows (`org: true`), no OAuth, fixed ids,
  workouts owned by them at `visibility: "public"`.
- `users.handle` (unique) is the `@id` namespace **for every account**. A new
  account with no handle is assigned a random `adjective-noun` handle
  (collision-checked); the user can edit it to any unused valid slug.
- **Saving a workout always forces its `@id` to `<owner-handle>:<slug>`** —
  written/rewritten into the text on every save. There is no un-namespaced
  saved workout and no mismatch state. `<slug>` derives from the existing
  `@id` slug if present, else the title; a collision within the owner's
  namespace gets a suffix. Copying another user's workout and saving
  re-namespaces it naturally.
- `workouts.wdlId` mirrors the `@id` (`<handle>:<slug>`), set from the text on
  save, indexed — the searchable/resolvable handle.
- A lookup resolves *either* a 15-char record id *or* a `<handle>:<slug>`
  `wdlId` to the same record.
- The **handle-rename debt** is deferred (stale already-saved ids /
  share-links) — recorded in [../topics/known-debts.md](../topics/known-debts.md),
  not solved here.
- What (if anything) `spec/spec-0.1.md` should say about the `@id` ↔ account
  namespace rule.

No code. `docs/context` (DEC-021 in `settled-decisions.md` + the index entry
in `decisions.md`) + the `spec` note. Spawns L1.

**L1 — `users` schema: `org` bool + `handle`, + a handle generator/editor.
DONE 2026-09-01 (`88ab8b6`).**
`deploy/pocketbase/pb_migrations/1756900000_add_users_handle_and_orgs.js` adds
`org` (bool, `required:false`) and `handle` (text, `required:false`, **unique**
— `CREATE UNIQUE INDEX idx_users_handle ON users (handle)`) to `users`, then
inserts the three org rows — `crossfit` / `hyrox` / `tabata`, fixed 15-char ids
(`org0crossfit001` / `org0hyrox000001` / `org0tabata00001`), `org: true`,
`verified: true`, an unusable random password (an auth-collection record needs
one even though nobody signs in as these), `handle` = the name. App side:
`apps/shared/handle.js` (pure — `validateHandle`, `randomHandle`, the reserved
set; a handle is 3–63 characters, Chris's call 2026-09-01 on the minimum)
reads two committed word lists in `apps/shared/handle-words.js` (~130
adjectives, ~120 nouns, plain `[a-z]+`). `apps/shared/pocketbase.js` grows
`ensureHandle()` — called from `refreshAuth()` and
`completeSignInFromRedirect()`, so onboarding never blocks: assigns a random
`adjective-noun` handle on first sign-in, retrying on collision and falling
back to a numeric-suffixed pair after 6 tries — `updateHandle(h)` (client-side
`validateHandle`, a best-effort free-check, then `PATCH`, with the server's
unique-index 400 as the authoritative "taken" reject — the `users` list/view
rule is `id = @request.auth.id`, so the pre-check can only ever confirm your
*own* handle against real PocketBase; it is fully accurate against the mock)
— and `currentHandle()`. The builder header's account area (`apps/builder/
builder.js` `renderIdentity`/`renderHandle`/`startEditHandle`,
`apps/builder/builder.css`) shows `@handle` beside the signed-in identity
("assigning a handle…" in the brief gap right after sign-in) with an inline
edit affordance — Enter/Escape, an error line for a rejected value. Mirrored in
`scripts/mock-api.mjs` (`GET`/`PATCH .../users/records`, filter=`handle="…"`
open there since the real self-only list rule doesn't apply) and
`fixtures/users.json` (the three org rows with the same fixed ids; the mock
signed-in user is committed **without** a `handle` on purpose, so a fresh
`make serve` exercises the random-assignment path — the assignment persists to
git-ignored `fixtures/users.local.json`, deleted to re-exercise it).
`deploy/README.md` §7c + `pb_migrations/README.md` entry.
**Verified:** `make test` unchanged 2064/2064, 1 pending (no `packages/core`
touch). Migration up/down/up against a real PocketBase v0.40.1 (darwin_arm64)
binary + throwaway `pb_data`: all four migrations apply cleanly, `org`+`handle`
land on `users` with the unique index, the three org rows exist with the right
fixed ids and `org: true`, a duplicate-`handle` insert is rejected
(`UNIQUE constraint failed: users.handle`), `migrate down 1` removes the rows +
index + both fields cleanly, a re-`up` reapplies cleanly. Drove the builder
against `make serve` (mock `/api`) in both themes: a fresh mock user is
assigned a random handle (`@grand-cairn` on this run) that survives reload;
edited to a free slug (`river-otter`) — succeeds; edited to `crossfit` (an org
handle) — rejected with "That handle is already taken."; edited to `123` —
rejected with "A handle can't be all digits." (the empty/mixed-case/reserved
paths run the identical pure `validateHandle`, checked directly). Signed-out
builder unchanged (`Download .wdl` / `Open…`, no handle UI). **Still to do on
deploy:** glance at the admin UI — the three org rows landed, `handle` shows
the unique-index badge (`deploy/README.md` §7c) — same caveat as M1/M2/M3.
Spawns L2.

**L2 — `workouts` schema: `wdlId` column. DONE 2026-09-01 (`fc72881`).**
`deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js` adds `wdlId`
(text, `max: 260`, `required: false`) to `workouts` plus a **plain** index
`CREATE INDEX idx_workouts_wdl_id ON workouts (wdlId)` (non-unique — two owners
can hold the same slug; same-owner collisions get L3's `-2`/`-3` suffix; a
plain index is all L3's lookup and L4's search need). Edits an existing
collection the same way `1756700000_add_users_admin.js` /
`1756900000_add_users_handle_and_orgs.js` do — `findCollectionByNameOrId` →
`fields.add(new Field(...))` / `indexes.push(...)` → `app.save`; `down`
reverses field + index together. **No rule change** — the item-18
`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` on `workouts` are
untouched. **No app/mock/fixture change** — L2 is pure DB schema; nothing sets
`wdlId` yet (L3 does, on save; L6's loader for the org rows), so existing rows
stay `wdlId: null` — no backfill, per DEC-021. `deploy/README.md` §7 table +
new §7d; `pb_migrations/README.md` entry. **Verified:** `make test` unchanged
2064/2064, 1 pending (no `packages/core` touch). Migration up/down/up against a
real PocketBase v0.40.1 (darwin_arm64) binary + throwaway `pb_data`, all five
migration files present: `migrate up` applies all five cleanly; `sqlite3`
against `_collections` shows `wdlId` (text, max 260, required false, system
false) and against `sqlite_master` shows `idx_workouts_wdl_id` beside the
existing `owner` / `visibility` indexes; `echo y | migrate down 1` reverts —
`wdlId` and `idx_workouts_wdl_id` both gone, owner/visibility indexes intact;
a re-`up` reapplies cleanly. **Still to do on deploy:** glance at the admin UI
after the migration applies — confirm the `wdlId` column + `idx_workouts_wdl_id`
landed on `workouts` (`deploy/README.md` §7d); nothing to backfill or grant,
same style as the M1/M2/M3/L1 "still to do on deploy" notes. Spawns L3.

**L3 — force `@id` on save + set `wdlId` + lookup resolver. DONE 2026-09-01
(`<TASK-SHA>`).** App + mock only, no schema/core/grammar/spec touch, `make
test` unchanged 2064/2064 (1 pending). `apps/shared/pocketbase.js` grew a
module-local `@id`/slug helper block (`slugify`, `readIdValue` / `readTitleLine`
— light regex on the zero-indent preamble line, `slugOfIdValue`, `baseSlug`,
`writeIdLine`, `requireHandle`, `namespacedId`, `forceNamespace`) and
`create` / `update` now run it: on every save `source`'s `@id` line is
written/rewritten to `<owner-handle>:<slug>` and `wdlId` is sent set to the same
string. `<slug>` = the slug portion of an existing `@id` in the text (`@id
crossfit:fran` → `fran`, re-namespaced to `<yourhandle>:fran`), else a slug of
the zero-indent `# title` line *in the source* (the passed `title` param is a
display fallback and is deliberately not used for the slug — it can be
`"Untitled workout"`), else `untitled`. A same-owner clash appends a
deterministic `-2` / `-3` … suffix, stable across re-saves (the scan skips only
*other* records' `wdlId`s and `base` is re-derived from the stored `@id`). A
patch without `source` leaves `wdlId` alone. New export `getByAnyId(x)`: a
value with `:` → `filter=wdlId="<x>"` (throws a 404-shaped `Error` on no hit);
no `:` → `getById`, with a `filter=wdlId="<x>"` fallback on a 404 — same
error/not-found shape as `getById` so `board.js`'s `loadShared` `catch` is
untouched. `apps/display/board.js` swapped the `?w=` import + call from
`getById` to `getByAnyId`; the id-is-the-share-link / clean-`?w=` behaviour
(`load(..., false)`) is unchanged. `scripts/mock-api.mjs` gained a JS port of
the helper (`forceWdlId` + `mSlugify` / `mReadId` / `mReadTitle` / `mSlugOfId` /
`mBaseSlug` / `mWriteId`) run on mock `workouts` create/update, resolving the
owner's handle from the `users` fixture; `wdlId` added to the record shape and
the PATCH field list; `filter=wdlId="<handle>:<slug>"` needed **no** parser
change — the generic `field="value"` matcher already spans the colon. **Verified**
(mock `/api`, driving `pocketbase.js`'s real `create`/`update`/`getByAnyId` and
one end-to-end builder "Save to my workouts" click): `# Fran` no `@id` → `@id
easy-beacon:fran`; copy of `@id crossfit:fran` on a clean namespace → `@id
easy-beacon:fran`; no `@id`/title ×2 → `easy-beacon:untitled` then
`easy-beacon:untitled-2`, and re-saving either keeps its slug (no bump / no
creep); body-edit re-save of a saved workout → `@id`/`wdlId` unchanged; builder
Save button → `@id easy-beacon:new-workout` inserted after the `# New workout`
title line + `wdlId` set. Board: `?w=easy-beacon:fran` resolves and renders with
`easy-beacon:fran` in the meta strip and the URL left clean; `?w=<15-char
recordid>` still resolves; `?w=nope:nope` shows the existing "could not be
found" line, no crash. Theme is not exercised — L3 is logic-only, no CSS/render
change, both `prefers-color-scheme` values run identical code. Spawns L4.

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
  round-tripping into the builder. *Everything else in that thread —
  `@id` ↔ record-id correlation, the account namespace, `users.handle`,
  `workouts.wdlId`, forcing the `@id` namespace on save, an "open on the board"
  action — is now in **The workout library (L0–L7)** above; the handle-rename
  debt is in [../topics/known-debts.md](../topics/known-debts.md).* In
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

