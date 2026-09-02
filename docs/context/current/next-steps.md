# Next Steps

## Immediate

***The workout library* (L0–L7) is complete as of 2026-09-01** — all eight
tasks landed and the whole L-section moved to
[../tasks/completed.md](../tasks/completed.md) as one grouped section. The last
link, **L7 (`2557177`)**, surfaced the library in the apps: an **Examples**
chip row in the builder's *My workouts* panel that browses each org account's
whole public set (`crossfit` 31 / `hyrox` 9 / `tabata` 3), each row a
click-to-open detached read-only copy, plus a per-row `↗` "Open on the board"
shortcut; `listOrgWorkouts(ownerId)` in `apps/shared/pocketbase.js` against the
L1 fixed org ids. The board resolves `?w=<handle>:<slug>` end to end and shows
the namespaced id in its `#meta` strip (no separate source line — the id names
the owner). App code only; `make test` unchanged (2064/2064, 1 pending). The
epic absorbed most of the deferred account-namespacing rethink; what is left —
the board **Edit** button round-tripping into the builder — is now scheduled as
**N3** (see "## Next builder-UX work" in
[../tasks/current.md](../tasks/current.md)).

**board: dismissible notifications closed 2026-09-01 (`01c0af3`)** — a
**Clear notifications** button in the board footer beside Reset, shown only
while the red `#problems` strip has content; one `setProblems()` helper in
`apps/display/board.js` is the single show/hide path, and clearing is not
permanent (the next reparse / `?w=` load / division change repopulates it).
`apps/display/` only, dark verified, `make test` unchanged (2064/2064, 1
pending).

**board: the `#` title moved into the `#meta` strip, closed 2026-09-01
(`110ed2b`)** — the `# Title` line joins the hidden preamble run
(`draw()`'s preamble test covers a `#`-line in the leading run) and shows in
the `#meta` strip as the prominent lead element, with any `@id` small and dim
in parentheses after it (`Fran (crossfit:fran)`); `dataset.line` stays 1:1 so
the cue marker still tracks the right physical lines. `apps/display/` only
(`board.js`, `board.css`, `index.html`), dark verified, `make test` unchanged
(2064/2064, 1 pending). Closes the "reversible default" question left by item
15b.

**unit defaults closed 2026-09-01 (rule 1 `6829052`, rule 2 `952c80c`)**
— the last queued standalone task. Rule 1: `@ 95` with no unit now parses to a
real `load` and `wdl fmt` rewrites it to `@ 95lb` (pound is the documented
default; `parseTarget` in `packages/core/src/units.ts`, spec §3/§7, no corpus
movement). Rule 2: a builder-only suggesting diagnostic for a bare count on a
load-less calorie machine (`15 Row` → `15cal Row`); the board is untouched.
[DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in).
`make test` 2064/2064, 1 pending.

**builder: dim/small text floored at AA + 12px, landed 2026-09-02
(`547d986`)** — a self-contained pull from
[../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
(not a queued task). The `opacity`-dimmed secondary text (palette muscle tags,
`.hint`, ~8 more) now dims by `--dim` colour, not `opacity` — AA in both themes
(`.movement .meta` light 3.4→4.9:1, dark 4.6→6.0:1) — with a 12px floor,
written as a rule (no `opacity` on body text; nothing below `.75rem`).
`apps/builder/builder.css` only, `make test` unchanged (2064/2064, 1 pending).

**builder: outline row affordances made discoverable + touch-reachable, landed
2026-09-02 (`6adba47`)** — a self-contained pull from
[../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
(not a queued task). The per-row tool strip and both carets went from
`opacity: 0`-until-hover to a persistent `opacity: .6` brightening to full on
`.node:hover` / `.node:focus-within` (`:focus-within` covered touch — no JS,
`⋮`-menu declined), tool + caret hit boxes to 32px, the tool strip wrapping to
its own row below `560px`. `apps/builder/builder.css` only; `make test`
unchanged (2064/2064, 1 pending). Closes the two open design-critique-trio
entries in that file's *Outline* section (the nesting-rails third was already
fixed `d8edde3`).

**The Vocabularies & editor ergonomics epic (V1–V9) is complete** (V3 withdrawn;
V9 `2a534b6` 2026-09-02) — from the 2026-09-02 design review of the header
**Workouts** menu and the **movement editor**. Staged tasks in
[../tasks/current.md](../tasks/current.md), with the decisions recorded at the
top of that epic section.

**Stage A (V1 + V2) landed 2026-09-02 (`7429863`)** — the header button reads
**Workouts**, the chip row reads **Libraries**, and a chip is now sugar over the
search box (it types `<handle>:` and lets the normal debounced search run), which
retired `browseOrg` / `listOrgWorkouts` and the whole parallel browse path.

**V3 is withdrawn as of 2026-09-02 — its premise was false, and it blocked
nothing else.** It was built and reverted: `measures` on a registry entry is a
**capability set** (the units a movement *can* be measured in), not a choice —
`bike` / `row` / `skierg` correctly carry **both**, and narrowing them would
switch off `calorieUnitHints()` (rule 2, DEC-022) and drop a `»` pick. Chris
withdrew it the same day; the editor keeps its two checkboxes. Settled as
[DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)
and listed in
[../topics/deliberately-not-done.md](../topics/deliberately-not-done.md).
**Nothing is open on it.**

**Stage B (V4 + V5) landed 2026-09-02 (`10a2b8a`)** — in one commit, because V4
has no user-visible surface on its own and this repo verifies by driving the
real app. `apps/shared/token-input.js` is the reusable widget (chips +
type-ahead + a filter/select picker, **one composition at every vocab size** —
[DEC-024](../topics/settled-decisions.md#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker)),
and the movement editor's seven list fields are wired onto it over a static
`apps/shared/vocab.js`. `collect()` emits the same arrays, so the write path and
both validations are unchanged. It also carried the **caption bug** fix: a
`group()` twin of `field()` wraps every multi-input control in a `<div
role="group" aria-labelledby>`, so neither checkbox-group caption — nor any of
the seven token inputs — is bound to its first input any more. `make test`
unchanged (2064/2064, 1 pending).

**The movement-editor wrong-record defect is fixed, 2026-09-02 (`a643824`) —
V6 was correctly landed ahead of it, and the fix landed right after.** The
editor used to open on the *canonical* merged entry rather than the curated
row it edits, at two of its three entry points, so a save could invent
`deadlift`'s equipment, drop `skierg`'s second alias, smuggle merge metadata
into `muscles`, or — the sharpest direction, found scheduling the fix — flip
which movement a name resolves to, for six movements where a merged alias
already named a different curated record.
**Chris's call: always the API/database, never an in-memory object** — "even
when it's test, it's gonna be fetching from the fixture anyway." So
`openMovementEditor()` now takes an identity (`null`, or `{ id, title }`) and
always fetches `getMovementByMovementId(id)` before the form mounts, at all
three entry points. Verified: `deadlift` no longer invents equipment, `skierg`
keeps both aliases, an unedited save round-trips `make movements:dump` with 0
changes, and `make aliases` holds the pinned baseline — **0 contended names
across 972 curated records**. `make test` 2064/2064, 1 pending, unchanged.
Write-up in [../tasks/current.md](../tasks/current.md) (struck) and
[../topics/builder-ux.md](../topics/builder-ux.md).

**Stage C (V6 + V7 + V8) shipped 2026-09-02. V6 (`370b2d0`)** — the committed
`registry/equipment.json` (29 terms) and `registry/patterns.json` (11), plus
`1757100000_create_vocab.js` creating the `equipment` and `patterns`
collections, verified up and down against a real pocketbase v0.40.1 binary.
Settled as
[DEC-025](../topics/settled-decisions.md#dec-025-equipment--movement-patterns-are-a-db-backed-vocabulary-layer-registryequipmentpatternsjson-is-the-committed-dump),
mirroring DEC-020. At V6 this was data and schema only; V8 (below) put the
`/api` fetch in front of `apps/shared/vocab.js`. **On prod (2026-09-02): fully
live** — migration applied, `make vocab:load` run (`equipment` 29, `patterns`
11), and the V8 static apps `make deploy`'d (served JS byte-identical to
`origin/main`), so the live editor fetches the DB vocab.

**V7 landed 2026-09-02 (`67001cb`)** — `scripts/mock-api.mjs` grew
`equipment/records` + `patterns/records` handlers in the PocketBase
list-envelope shape, one `makeVocab(name, prefix)` factory copied field-for-field
from the `movements/records` handler: reads open, authorised writes
(`Authorization` header, 403 without) overlaid from git-ignored
`fixtures/{equipment,patterns}.local.json` on read. **Derived from
`registry/{equipment,patterns}.json` at boot — no committed fixture**, the
movements pattern. Drove it: `make serve` + `curl` both routes — `totalItems`
**29** / **11**, single-record by synthetic id and `termId`, unauthenticated
`POST` 403, authorised write persisted and survived a restart; a mock record
agrees field-for-field with the migration's columns. `.gitignore` gained the two
`*.local.json` entries. No core, no app change; `make test` 2064/2064, 1
pending.

**V8 landed 2026-09-02 (`b2efb64`) — Stage C complete; V9 (`2a534b6`,
2026-09-02) closed the V1–V9 epic as N1 of the next set.**
`scripts/vocab-to-db.mjs` / `make vocab:load` is the `movements:load` twin (one
run upserts both `registry/{equipment,patterns}.json` into the two collections,
keyed on `id` → `termId`, per-collection tally, `--dry-run`, prod auth identical
to `movements-to-db.mjs`); `listEquipment()` / `listPatterns()` in
`apps/shared/pocketbase.js` copy `listMovements()`'s shape; and
`apps/shared/vocab.js` now fetches those and maps to `termId`, with the committed
literals kept as the **offline fallback** (the fetch-with-bundled-default shape
is `muscleIds()`'s — there is no movements-list fallback to mirror, one of two
task-note premises corrected in the file). Drove it: both pickers populate from
`/api` (29 / 11) and still populate with `WDL_MOCK_API=0` from the literals.
`make test` 2064/2064, 1 pending. **No `make vocab:dump`** — not wanted for a
two-file vocabulary. **Muscles stays `registry/muscles.json`.**

**The active queue is *## Next builder-UX work* in
[../tasks/current.md](../tasks/current.md) — three tasks Chris named 2026-09-02.
N1 is done; N2 is next:**

- ~~**N1 — V9: inline "＋ new term" in the token-input picker.**~~ **Shipped
  2026-09-02 (`2a534b6`).** `createTokenInput` gained an `onCreateTerm` opt; the
  builder wires it for `equipment` / `pattern` only, gated on
  `currentUser()?.admin`. `dbVocab()` closures got `.reset()` for the cache-bust;
  the widget splices a new term into its live list optimistically and rolls back
  on a failed `POST` with the reason inline. Slug rule
  [DEC-026](../topics/settled-decisions.md#dec-026-the-inline--new-term-slugs-by-lowercase--trim--collapse-whitespace-keeping-typed-hyphens).
  `make test` 2064/2064, 1 pending — unchanged. Light + dark + 768px verified.
- **N2 — the *Movements* palette-drawer redesign.** A header toggle collapsing
  *Movements* to a strip / overlay drawer **at any width**, persisted in
  `localStorage`; reuse the `@media (max-width:1100px)` collapsed-palette CSS as
  the closed state. Must not regress `--right-col-w` / `.col-resize` / `#bodymap`
  scaling. **Unblocks** two further design-critique items gated on it — the flat
  129-row core list (pattern/region grouping) and the read pane's four stacked
  `<h2>`s (collapsible sub-panels). `apps/builder/{index.html,builder.css,
  builder.js}`, no core.
- **N3 — the board's *Edit* button round-trips into the builder.** Chris:
  *"that's needed as well."* A footer control on the board that opens the builder
  on the shown workout (owner's copy if owned, detached copy otherwise). Last
  piece of the post-redesign account thread; the rest shipped in the L-series.
  `apps/display/*` + maybe a builder load param, no core.

No hard dependency chain, but the order is deliberate: N1 was a small no-dep win
(done), N2 is the keystone, N3 lands after N2's large `builder.{js,css}` churn.

Not dev work: the **laterality curation sweep** is Chris's manual CSV step
([../tasks/current.md](../tasks/current.md) loose bullets). A **full security
audit** is [../tasks/deferred.md](../tasks/deferred.md) ("once functionality has
settled"). Most [../topics/known-debts.md](../topics/known-debts.md) items are
core / spec / grammar, not app-only.

**Deploy state, 2026-09-02** (checked against the live API): all six migrations
applied, every loader has run against prod (`movements` **972**, `workouts`
**45**, `equipment` **29**, `patterns` **11** rows), and the **V8 static apps
are `make deploy`'d** — the served `apps/shared/{pocketbase.js, vocab.js,
movement-editor.js}` are byte-identical to `origin/main` and the prod editor
fetches the DB vocab. **V8 is fully live.** The **M6 nightly-backup cron is
installed, running, and pulled off-box** — cron writes
`~/pb/pb_backups/data-YYYY-MM-DD.db` at 03:17 UTC (`backup.log` clean), and
`make backups:pull` copies them into the repo-relative `db-backups/`
(git-ignored contents), verified 2026-09-02 with both snapshots landing.
**Nothing is open on deploy.** (Deferred, not open: PocketBase upgrades, and
the DreamHost firewall ticket for the port-8090 exposure.)

*Corrected 2026-09-02, twice the same day: this first said the prod
`equipment` / `patterns` collections still needed `make deploy:db` +
`make vocab:load` and "prod serves nothing"; then (after those ran) that the V8
static apps were still un-deployed. Both stale within hours — Chris ran
`make deploy:db`, the loaders, and `make deploy` all on 2026-09-02. Since then
the `WDL_PB_ADMIN_*` / `WDL_DEPLOY_*` vars for those targets can live in a
git-ignored `.env` (`.env.example` is the template) — [running-it.md](../topics/running-it.md).*

**The movement-editor wrong-record defect is closed (`a643824`, 2026-09-02)** —
see the dedicated paragraph above; nothing is open on it. Still needing Chris to
scope: the two loose bullets below.

**Deferred 2026-09-02 (Chris): a full security audit / hardening sweep** —
nothing from the client trusted; verify `admin` / user identity server-side on
**every mutating endpoint** (PocketBase collection create/update/delete rules,
not just the UI gate), no cross-user editing, no secret/PII leakage, plus the
usual `filter=` injection / OAuth-redirect / static-asset / port-8090 checks.
**Explicitly a "once the queue is exhausted and functionality has settled down"
item, not a next task** — auditing the rules while the accounts / vocab /
library surface is still moving would mean auditing twice. Full write-up in
[../tasks/deferred.md](../tasks/deferred.md) ("## Deferred" + "## Reconsider
when").

The two design-critique items that were dispatchable on their own — the
read/analysis-pane scroll and the **header control-row grouping** — both turned
out **already resolved by the R1 layout redesign** (+ V1 for the header rename),
verified 2026-09-02, no code shipped. Chris then named the concrete next work
(2026-09-02): **N1 V9 → N2 palette-drawer redesign → N3 board Edit round-trip**,
detailed above and in [../tasks/current.md](../tasks/current.md) "## Next
builder-UX work". **N1 shipped 2026-09-02 (`2a534b6`); N2 is next.** N2 unblocks
the two remaining design-critique items (the flat 129-row list; the four
`<h2>`s). The **laterality curation sweep** is Chris's
manual step, not dev work.

**Verified already-done 2026-09-02, no code shipped — two design-critique
## Layout entries:**

- *"the 'what it reads as' pane has no scroll container"*, billed as the single
  highest-value layout fix — resolved by **R1 (`758dff1`, 2026-08-30)**.
  `.read-pane` was replaced by the tabbed margin's bounded `.rpanel`; a 56-cue
  workout scrolls inside the panel with the document itself not overflowing
  (`scrollHeight === innerHeight`), light + dark, 1440 / 820 / 375px.
- *"the header is one undifferentiated control row"* — resolved by **R1**
  (`header .row` gone; `#doc-title` centred `flex:1` splits brand from controls;
  Canonicalise moved onto `.editor-tabs`) + **V1 (`7429863`)** (*My workouts →
  Workouts*). Driven signed-in at 1440 / 1000 / 760px, light + dark: five
  distinct header zones — mark · centred title · bordered `.file-cluster` ·
  bordered `.menu` pill · `#identity` far right — no wrap, no collision, no
  console errors. The unbuilt *"future New behind one file control"* popover is
  a closed call (R1: *"three items didn't warrant a popover"*), not invented.

Both entries struck in `builder-ux.md`.

---

<details><summary>Historical — the L0–L7 trail (kept for the record)</summary>

***The workout library* (L0–L7).** L0 landed 2026-09-01
(`b9c52f1`)** — the epic's design note, written up as
[DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)
plus a one-sentence hosting-convention note beside spec §2's `@id` bullet.
**L1 landed 2026-09-01 (`88ab8b6`)** — the `users` migration adding `org`
(bool) + unique `handle` (text) and inserting the `crossfit` / `hyrox` /
`tabata` org rows, plus the app-side random `adjective-noun` handle assignment
(`apps/shared/handle.js` + `handle-words.js`, `ensureHandle()`), the handle
editor in the builder header, and `updateHandle` / `currentHandle()` in
`apps/shared/pocketbase.js`; mock `/api` + `fixtures/users.json` mirror;
migration up+down verified against a real PocketBase v0.40.1 binary; `make
test` unchanged (2064/2064, 1 pending). **L2 landed 2026-09-01
(`fc72881`)** — `deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js`
adds `wdlId` (text, `max: 260`, nullable) + a plain index
`idx_workouts_wdl_id` to `workouts`; no rule change, no app/mock/fixture change
(pure schema — existing rows stay `null` until L3 sets it on save / L6's loader
for the org rows); `make test` unchanged; migration up/down/up verified against
a real PocketBase v0.40.1 binary. **L3 landed 2026-09-01 (`5be4a30`)** —
app + mock only: `apps/shared/pocketbase.js` `create`/`update` now force-write
`source`'s `@id` line to `<owner-handle>:<slug>` and send `wdlId` set to the
same string (module-local `@id`/slug helper; slug from an existing `@id`, else
the `# title`, else `untitled`; re-save-stable `-2`/`-3` suffix on a same-owner
clash); new `getByAnyId(x)` resolves a `:`-bearing value as a `wdlId` else a
15-char record id with a `wdlId` fallback; `apps/display/board.js`'s `?w=` uses
it; `scripts/mock-api.mjs` mirrors (`forceWdlId` port, `wdlId` on the record
shape). **L4 landed 2026-09-01 (`0de7f9a`)** — app + mock + one fixture row:
`searchWorkouts(q, {page})` in `pocketbase.js`
(`filter=(visibility="public" || owner="<uid>") && (title~"<q>" ||
wdlId~"<q>")`, `sort=-updated`, `perPage: 20`; empty `q` → `[]`; `"` stripped)
plus `getHandle(uid)` for owner labels; a debounced search box in the builder's
**My workouts** panel listing own + public hits each labelled
`mine`/`@handle`/`public`, click-to-open (own → attached, public → detached
copy); `scripts/mock-api.mjs`'s `applyQuery` grew a `~` operator + the
parenthesised OR (`matchesFilter`); `fixtures/workouts.json` gained one public
`crossfit:helen` row. `make test` unchanged (2064/2064, 1 pending); verified
driving the builder against `make serve` in both themes. **L5 landed 2026-09-01
(`6cb8df4`)** — the authored benchmark `.wdl` library, **43 files** under
`examples/workouts/<org>/<slug>.wdl`: **crossfit** (31 — the 19 Girls, 9 first
Heroes, Fight Gone Bad / Filthy Fifty / the CrossFit Total), **hyrox** (9 — the
full race + its 8 stations), **tabata** (3 — the protocol, Tabata This, Tabata
Something Else). Each is `@id <org>:<slug>` + `# Title` + body, byte-identical to
`wdl fmt` canonical output; all 43 pass `wdl check`; Fran / Murph / Fight Gone
Bad / `hyrox:race` / `tabata:this` spot-checked on the board. **Content only** —
no schema / `packages/core` / grammar / spec / test touch, `make test` unchanged
(2064/2064, 1 pending); `examples/workouts/` deliberately **not** wired into
`corpus.test.ts` (L6/L7's call). **L6 landed 2026-09-01 (`5cc9e0f`)** —
`scripts/workouts-to-db.mjs` / `make workouts:load`, twin of
`movements-to-db.mjs`: idempotent-on-`wdlId` upsert of the 43
`examples/workouts/**/*.wdl` files into the `workouts` collection as public rows
owned by the matching org account, plus regeneration of `fixtures/workouts.json`
(46 rows — 43 library + 3 preserved mock-user seed) and `fixtures/users.json`
(the three org rows), so a fresh `make serve` / prod box shows the whole library
with no manual step; `--dry-run` writes nothing; prod writes need superuser auth
(`WDL_PB_ADMIN_*`, collection defaults to `_superusers`). `make test` unchanged
(2064/2064, 1 pending); verified fresh mock → 42 created / 1 updated, re-run
clean, edit-one → 1 PATCH, board + builder end-to-end against the regenerated
fixtures. **Next is L7 — surface the library in the apps** (the builder's
*Open…* / *My workouts* area gets a way to browse an org's public set — filter
by owner handle or a small "Examples" list — and "open on the board" for any
public workout; board confirms `?w=crossfit:fran` end to end and shows the org
as source; small polish). **L7 closes the epic — move L0–L7 to
[../tasks/completed.md](../tasks/completed.md) as one grouped section.** See
[../tasks/current.md](../tasks/current.md) "## The workout library (L0–L7)".

</details>

*Movements in the database — Phase 1 (M0–M7)* is
**complete as of 2026-09-01** — all of M0–M7 landed and the M-section moved to
[../tasks/completed.md](../tasks/completed.md) as one grouped section. The last
link, **M6** (`97f236f`), specified the nightly VPS SQLite backup + off-box
copy in `deploy/README.md` + `deploy/pocketbase/crontab.fragment` (shell cron
`sqlite3 .backup` + 30-day prune, 03:17 UTC; off-box `rsync` pull from Chris's
machine over the `dreamhost.ae.wex` alias; PocketBase built-in backups as the
documented fallback; restore steps aligned). **The backup cron is installed and
running** (`data-2026-09-02.db` written at 03:17 UTC, `backup.log` clean); only
the off-box `make backups:pull` is left. *Corrected 2026-09-02, thrice: this
listed "admin `users` row, migrations glanced at, prod ingest run", then
"install the backup cron line", then "verify the cron runs" as outstanding — all
done by 2026-09-02 (Chris's `users` row is `admin: true`, all six migrations
applied, `movements` 972 / `workouts` 45 / `equipment` 29 / `patterns` 11 rows
loaded, the V8 static apps `make deploy`'d, and the backup cron installed and
observed producing a nightly file). See "Deploy state" above.*

Everything else is closed: the whole 0-series through 21, the deployment epic
(18–20, landed 2026-08-30) and the builder layout redesign (R1–R10, landed
2026-08-31) — see [../tasks/completed.md](../tasks/completed.md).

**The `»`-panel per-implement load-token fix landed 2026-09-01
(`00f599c`)** — the token stays `@ Nx`, its reading was fixed (reworded pick
label + a transient inline hint by the caret); see
[../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.

**The standalone queue is empty as of 2026-09-01.** All three post-library
standalone tasks landed: `01c0af3` (board dismissible notifications), `110ed2b`
(board title-into-strip), and **unit defaults** (rule 1 `6829052` — `@ 95`
reads as `95lb`, `wdl fmt` writes the unit in; rule 2 `952c80c` — a
builder-only calorie-machine diagnostic).
[DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in).

The board's **Edit** round-trip is now scheduled as **N3** (see "## Next
builder-UX work"). The **laterality curation sweep** is Chris's manual CSV step,
not dev work.

Phase 2 of the movements epic (user-scoped movements) is in
[../tasks/deferred.md](../tasks/deferred.md).

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
