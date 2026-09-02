# Running it

The routine actions have a **root `Makefile`** as their single surface — run
`make` (or `make help`) for the list. It is thin wrappers over the `node
scripts/*` commands below, which still run directly; the Makefile is
discoverability, not new build logic. Choice recorded in
[settled-decisions.md](settled-decisions.md); a Makefile (not a root
`package.json`) because the repo is install-free and a `package.json` invites a
lockfile.

```bash
make test        # npm --prefix packages/core test — ~2050 tests, 1 pending, ~10s
make build       # node scripts/build-web.mjs — emit the core as browser modules
make serve       # build, then node scripts/serve.mjs 8081  (override PORT=NNNN; WDL_MOCK_API=0 to disable the mock /api)
make registry    # node scripts/build-canonical.ts — rebuild registry/ from its sources
make goldens     # regenerate the golden files, then show what moved
make aliases     # node scripts/check-aliases.mjs — names two records answer to, and who wins
make corpora     # node scripts/describe-corpora.mjs — are SOURCES.json/.md still right
make curation:sheet          # export-movement-curation.mjs curation-sheet.csv — the modifier hand-pass sheet
make curation:check CSV=x.csv  # import-movement-curation.mjs x.csv — dry-run report, nothing written
make curation:apply CSV=x.csv  # import-movement-curation.mjs x.csv --apply — land it into registry/movements.json
make movements:load  # movements-to-db.mjs — idempotent upsert of registry/movements.json into the movements collection over /api
make movements:dump  # movements-from-db.mjs — dump the movements collection back to registry/movements.json (ARGS=--dry-run / --check)
make workouts:load   # workouts-to-db.mjs — idempotent upsert of examples/workouts/**/*.wdl into the workouts collection over /api + regenerate fixtures (ARGS=--dry-run)
make deploy      # node scripts/deploy-web.mjs — static apps into pb_public/  (WDL_DEPLOY_SSH defaults to dreamhost.ae.wex — see "## Hosting")
make deploy:dry  # same, rsync with -n
make deploy:db   # rsync deploy/pocketbase/pb_migrations/*.js to the VPS + restart PocketBase to apply
make backups:pull  # rsync the VPS DB backups off the box into ~/wdl-pb-backups (WDL_BACKUP_DIR; no --delete)
make clean       # rm -rf build pairs.json curation-sheet.csv
make install     # prints "nothing to install" — the repo is install-free, on purpose
```

Multi-word targets use a `:` namespace separator (`curation:sheet`,
`movements:load`, `workouts:load`, `deploy:dry`, `deploy:db`, `backups:pull`) — GNU Make needs it
backslash-escaped in the `Makefile` (`curation\:sheet:`), typed plain on the
command line (`make curation:sheet`). Single-word targets (`test`, `build`,
`serve`, `deploy`, …) are unchanged.

Not wrapped (situational, take arguments): `node scripts/find-duplicates.mjs >
pairs.json` (cross-source dup pairs to triage) and the `wdl` CLI itself
(below). `import-movement-curation.mjs` is wrapped as `make curation:check
CSV=…` / `make curation:apply CSV=…` — both refuse to run without `CSV=`.

`build-canonical.ts` is the whole registry pipeline and the only way to run any
step of it — `mark-core.mjs` last, because it scores from what the earlier steps
produced. Never run a step by hand: each rewrites the file from the one before,
so a step run alone is erased by the next rebuild. See *Every pipeline step must
be in the pipeline* in [lessons-learned.md](lessons-learned.md).

**Nothing to install.** *Corrected 2026-08-15: for one day this said to run
`npm --prefix packages/core install` first, which was true while `ohm-js` was a
dependency.* It is now vendored into `packages/core/src/grammar/vendor/` and
imported by relative path, because a dependency the core is allowed is still one
the browser cannot resolve — see [settled-decisions.md](settled-decisions.md).
There is no `package-lock.json` and no `node_modules` again.

The CLI: `wdl fmt | check | timeline | export | goals | generate | program | result`.
`--variant <name>` on the first four reads the file as one division — an rx split
or a `variants:` entry, whichever way it was written (spec §10.1). The board asks
the same question through a picker in its footer, and a division chosen there
rides in the URL: `#<workout>&division=women`.

`wdl result <file.wdlr>` checks a result against the snapshot it carries;
`--goals` reads the records as one series, in date order, which is the only way
a `progress` rule about load can be asked. The board writes a `.wdlr` when a
session ends.

The server must be rooted at the repository — the apps reach `build/` and
`registry/` from there.

**`make serve` answers `/api` from a mock** *(since 2026-08-31, queue task M7,
DEC-020)*. There is no PocketBase behind the dev server, so `scripts/serve.mjs`
intercepts `/api/*` before static handling and delegates to
`scripts/mock-api.mjs` — a no-deps mock of the endpoints
`apps/shared/pocketbase.js` calls: auth (short-circuits the Google redirect via
a local `/api/_mock/oauth` stub — sign-in "just works" as one fixture user with
`admin: true`), `users/records` (list/filter + a `handle`-setting `PATCH`, task
L1 — see below), `workouts/records` CRUD (seeded from committed
`fixtures/workouts.json`, runtime writes persisted to the git-ignored
`fixtures/workouts.local.json` — delete that file to reset), and
`movements/records` from `registry/movements.json` in PocketBase's list envelope
(reads open; writes accepted with any `Authorization` header since M3, persisted
git-ignored to `fixtures/movements.local.json`). **On by default**;
**`WDL_MOCK_API=0 make serve`** opts out and
`/api/*` falls through to the old behaviour (404 / static). Sample data lives in
`fixtures/` (`users.json`, `workouts.json` committed; `workouts.local.json`
git-ignored). Nothing here touches `packages/core`, the grammar, the spec or the
PocketBase migrations, and the mock never runs in production.

**The mock user starts with no `handle`** *(since 2026-09-01, task L1,
DEC-021)*. `fixtures/users.json`'s signed-in mock user is committed without a
`handle` on purpose, so a fresh `make serve` + first sign-in exercises
`apps/shared/pocketbase.js`'s random `adjective-noun` assignment path the same
way a brand-new real account would; the assigned handle (and any later edit
through the builder header's handle editor) persists to git-ignored
`fixtures/users.local.json` — **delete that file to go back to a handle-less
mock user and see the assignment run again**. `fixtures/users.json` also
carries the three `org: true` rows (`crossfit` / `hyrox` / `tabata`, fixed ids
matching `1756900000_add_users_handle_and_orgs.js`), so editing your handle to
one of those and getting rejected is exercisable locally too. Unlike real
PocketBase — whose `users` list/view rule is `id = @request.auth.id`, so a
client can only ever confirm *its own* handle — the mock's
`filter=handle="…"` is open, so the free-handle pre-check is fully accurate
against it.

**Ingesting `registry/movements.json` into the DB** *(since 2026-09-01, queue
task M3, DEC-020)*. `make movements:load` (`scripts/movements-to-db.mjs`, no
deps) upserts every entry into the `movements` collection over
`/api/collections/movements/records` — **idempotent**, keyed on the `movementId`
unique index: it `POST`s the absent, `PATCH`es only the columns that differ, and
a re-run writes nothing (prints a `created`/`updated`/`unchanged` tally;
`--dry-run` reports without writing). A field the entry lacks is cleared on the
row (json→`null`, scalar→`""`), so the M4 dump round-trips.

- **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
  (matches `make serve`).
- **Local round-trip** — with `make serve` running (mock `/api` on by default),
  a bare `make movements:load` in another terminal works: the mock now accepts
  authorized `movements` writes, and with no `WDL_PB_ADMIN_*` set the script
  authenticates through the mock's stubbed OAuth. Runtime writes land in
  git-ignored `fixtures/movements.local.json` — delete it to reset. Since the
  mock already serves all of `registry/movements.json` on read, a first
  `movements:load` against a fresh mock reports *all unchanged* (the diff
  matches); `curl -X DELETE .../records/<id> -H 'authorization: x'` then a
  `movements:load` is how to see it create.
- **Against prod PocketBase** — needs admin auth: `WDL_PB_ADMIN_TOKEN`, or
  `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD` (+ optional
  `WDL_PB_ADMIN_COLLECTION`, default `users` — the row needs `admin: true`,
  `deploy/README.md` §7a) exchanged at
  `POST /api/collections/<c>/auth-with-password`. Run it once after M1/M2 are
  applied on the box. Without creds against a real PocketBase the script exits
  with the list of what to set.

**Dumping the DB back to `registry/movements.json`** *(since 2026-09-01, queue
task M4, DEC-020)*. `make movements:dump` (`scripts/movements-from-db.mjs`, no
deps) is the egress half. It reads every `scope = "global"` row over
`/api/collections/movements/records`
(`filter=scope="global"&perPage=500&sort=movementId`, paged) — **no auth step**,
the collection's list/view rule is `scope = "global"` — and rewrites
`registry/movements.json` in its **current formatting**:
`JSON.stringify(obj, null, 1) + "\n"`, each entry's keys walked in the order that
entry already uses on disk, a column empty on the row (json→`null`/`[]`/`{}`,
scalar→`""`) omitted — the inverse of M3 clearing an absent field. So a dump of
an unmutated `make movements:load` reproduces the file byte-for-byte, and a real
edit shows up as exactly the changed fields. `$comment` / `version` / `$sources`
are copied from disk untouched; `scope` / `user` / the record `id` / `created` /
`updated` are never written. Existing entries keep file order; a movement in the
DB but not the file is appended at the end sorted by `id`; a movement gone from
the DB is dropped (the diff shows the removal).

- **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
  (matches `make serve`); `--api` also lets a dump be taken from prod.
- **Flags** — `make movements:dump ARGS=--dry-run` reports the tally + a
  `git diff --stat` preview and writes nothing; `ARGS=--check` writes then exits
  non-zero if the file moved — for the round-trip test and a future pre-commit
  hook (DEC-020 leaves the cadence open; **no hook is shipped**, just the flag).
- **Round-trip check** — from a clean `registry/movements.json` (and no
  `fixtures/movements.local.json`), with `make serve` running:
  `make movements:load` then `make movements:dump`, then
  `git diff --stat registry/movements.json` — **must be empty**. This is the
  check DEC-020 requires; it now passes.

**Ingesting the workout library into the DB** *(since 2026-09-01, queue task L6,
DEC-021)*. `make workouts:load` (`scripts/workouts-to-db.mjs`, no deps —
`node:fs` + global `fetch`) is the `workouts` twin of `movements:load`. It reads
`examples/workouts/<org>/<slug>.wdl` (the 43 authored files, L5), and for each:
resolves `<org>` from the path to the org `users` row's **fixed id** as `owner`
(`crossfit`→`org0crossfit001`, `hyrox`→`org0hyrox000001`,
`tabata`→`org0tabata00001`), forces `@id` / `wdlId` to `<orghandle>:<slug>`
(slug from the file's own `@id`; a port of `apps/shared/pocketbase.js`'s slug
helper — a no-op on the already-canonical authored files), takes `title` from
the `# Title` line and `source` from the file body, and sets
`visibility: "public"`.

- **Upsert, idempotent on `wdlId`** — bulk-fetches the collection
  (`?perPage=500`, paged, keyed on `wdlId`), `POST`s a file whose `wdlId` is
  absent, `PATCH`es one whose `title` / `source` / `visibility` / `owner`
  changed, and a re-run with nothing changed **writes nothing** and says so
  (prints a `created` / `updated` / `unchanged` tally).
- **`--dry-run`** (`make workouts:load ARGS=--dry-run`) reports the planned
  POSTs/PATCHes and writes **nothing** — no HTTP mutation and **no fixture
  rewrite** (`git status` stays clean).
- **The same run regenerates the committed fixtures** (unless `--dry-run`):
  `fixtures/workouts.json` — the 43 library rows (deterministic 15-char ids
  derived from `wdlId`) plus every pre-existing **non-org-owned** row preserved
  (the mock signed-in user's own seed workouts, which populate the builder's
  *My workouts* list from a fresh `make serve`); the old hand-added
  `crossfit:helen` row is replaced by the generated one (same `wdlId`).
  `fixtures/users.json` — the three `org: true` rows (same fixed
  ids/handles L1 commits) plus the mock user row kept verbatim (no `handle`, on
  purpose). Each file is rewritten only when its content changes. So a fresh
  `make serve` (and a fresh prod box, after the run) shows the whole library
  with no manual step — `registry/movements.json`-as-committed-fixture is the
  precedent.
- **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
  (matches `make serve`).
- **Against the mock** (`make serve`) — writes need no auth; a bare
  `make workouts:load` in another terminal just works. Runtime writes land in
  git-ignored `fixtures/workouts.local.json` — delete it to reset to the
  regenerated seed.
- **Against prod PocketBase** — writes need **superuser** auth, because the
  `workouts` write rule is owner-only (unlike `movements:load`, where a
  `users` `admin: true` row satisfies the movements rule): set
  `WDL_PB_ADMIN_TOKEN`, or `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD` with
  `WDL_PB_ADMIN_COLLECTION` (defaults to `_superusers` here) exchanged at
  `POST /api/collections/<c>/auth-with-password`. Without creds against a real
  PocketBase the script exits with the list of what to set.

**Exercising the movement editor** *(since 2026-09-01, queue task M5)*. No `make`
target — it is app code. Drive the builder against `make serve` (mock `/api` on
by default): sign in (the mock's faked Google sign-in hands every caller an
`admin: true` fixture user, so writes are allowed), then open the movement editor
from `＋ new movement` in the palette modal, the `✎` on a palette card, or "Edit
… its curated fields" in a step row's `»` panel. Saves `POST` / `PATCH` a
`scope: "global"` row over `/api`; the mock persists them to git-ignored
`fixtures/movements.local.json` (an overlay merged over `registry/movements.json`
on read) — delete that file to reset. Check a save with
`curl 'http://localhost:8081/api/collections/movements/records?filter=movementId=%22<id>%22'`.
Signed out, a write `403`s and the form shows the message.

A change to the apps needs `build-web.mjs` before the browser sees it, and the
board and builder are verified by driving them, not only by the suite — see
*Tests do not read* in [lessons-learned.md](lessons-learned.md).

**Curated modifier data (laterality — including `lateralityAxis`, the
`arm|leg|side|hand|direction` a per-side count runs across, since queue item
13a-curation — measures, load, force, mechanic, equipment) lands via
`import-movement-curation.mjs`, from a CSV of the audit sheet, not by hand.**
`make curation:sheet` (`export-movement-curation.mjs`) writes
`curation-sheet.csv` at the repo root (git-ignored — a working artifact): 32
columns in three blocks — IDENTITY, a CURRENT block showing what
`registry/movements.json` holds today (reference only, never read back), and a
blank CURATE block to fill in. `lateralityAxis` sits in *both* the CURRENT and
CURATE blocks (added 2026-08-31), so a curator sees the current axis beside the
blank. Chris reviews the sheet in a spreadsheet and exports it back to CSV in
chunks; `import-movement-curation.mjs` reads only the CURATE cells, per-cell
rather than per-group — a blank cell means "not reviewed" and never touches the
registry, a filled one is an assertion and does. The two scripts share the
column layout by position (two columns are named "Laterality: both"), so a
sheet re-saved with a column moved/renamed/removed fails the header check
loud. Contradictory cells (both Load booleans TRUE, all three laterality modes
FALSE, a `Default laterality` naming a mode not also marked TRUE) are reported
and that one field is left untouched rather than guessed at; everything else in
the same run still applies. `make curation:check CSV=<chunk>.csv` is the
dry-run report (nothing written); `make curation:apply CSV=<chunk>.csv` writes.
Run the check before and after each chunk the same way — the report before
applying is the whole safety mechanism.

This CSV flow is the **bulk** path — wide sweeps across many movements. For
one-at-a-time create/edit while building a workout, an in-app movement GUI is
the intended surface (unscheduled — see
[builder-ux.md](builder-ux.md) "Accounts, IDs and layout").

**A change to the registry is checked by regenerating the goldens, like every
other change.** `node packages/core/test/golden/generate.ts`, then read the
diff: the digest holds each file's muscle attribution as well as its shape,
pacing and volume, so a merge that moves which record a name points at moves
`interpretations.json` and says so. *Corrected 2026-08-23: for one day this
paragraph gave a by-hand recipe — attribute all 190 files twice, once against
each `registry/movements.canonical.json`, and diff — because attribution was in
no digest and "the goldens regenerated clean" was true and meaningless after a
merge. That gap is closed; the [lessons-learned.md](lessons-learned.md) entry
keeps the case, because the reflex it teaches outlives the recipe.*

**The parser is an Ohm grammar as of 2026-08-15, and it is slower.** Measured on
the day of the swap: parsing all 190 corpus files went from **3.1ms to 172ms**
(55×), the suite from **5.9s to 9.9s**, and `wdl check` on one file from
**0.16s to 0.22s** — the last of those being what anyone actually waits for, and
most of the difference is a one-off 107ms grammar compile rather than the parsing.
Nothing here parses in a loop, so the 55× is a number and not yet a cost; if it
becomes one, keeping a compiled grammar across processes is the known fix.

Anything that calls `parse` outside the CLI must be handed the grammar first —
`import '../node.ts'` on Node, a fetch in a browser. The regenerators in
`test/golden/` do this; `required('grammar')` throws by name if something new
forgets.

## Hosting / deployment

*Since 2026-08-30 (queue items 18–19).* There is a public instance at
**`https://wex.androidempathy.com`**, on the DreamHost VPS. **PocketBase**
(v0.40.1) is the backend — Google sign-in and a `workouts` collection — and it
runs as a **per-user systemd service** on that box (`systemctl --user … pocketbase`,
linger enabled so it survives a reboot), fronted by the DreamHost panel's Proxy
Server + panel Let's Encrypt. The panel proxy sends the **whole domain** to
PocketBase, so **the static builder + board are served from PocketBase's own
`pb_public/` directory** (`~/pb/pb_public/` on the VPS) — `apis.Static` serves
that tree at `/` for every path that is not `/api/…` or `/_/…`. `/` redirects
to `/apps/builder/`. Item 20 adds the frontend that calls `/api/…`.

Deploy the static apps (needs SSH to the VPS):

```bash
make deploy       # static apps into pb_public/. WDL_DEPLOY_SSH defaults to dreamhost.ae.wex (Chris's ~/.ssh/config alias)
make deploy:dry   # no-write rsync -n
make deploy:db    # rsync deploy/pocketbase/pb_migrations/*.js to the VPS, then restart PocketBase to apply
make backups:pull # rsync the VPS ~/pb/pb_backups/ off the box into ~/wdl-pb-backups (WDL_BACKUP_DIR; no --delete, so history accrues)
# From another box, override the alias:
WDL_DEPLOY_SSH=androidempathy_wex@wex.androidempathy.com make deploy
# Raw form (bypasses the Makefile default):
# node scripts/deploy-web.mjs [--ssh …] [--dry-run] [--stage-only] [--skip-tests]
```

`make deploy` is web-only (`--delete` rsync into `pb_public/`); the DB side is
separate — `make deploy:db` copies migrations **without** `--delete` (the box
also holds admin-UI-generated snapshot migrations that are not in the repo) and
restarts PocketBase so any new migration applies. A migration already applied is
a harmless no-op on restart.

The `Makefile` sets `export WDL_DEPLOY_SSH ?= dreamhost.ae.wex`, so a bare
`make deploy` works on Chris's box; `?=` still defers to the environment when
it is set, and the value is safe in the repo — it is an SSH-config alias, no
host / user / secret in it. The raw `node scripts/deploy-web.mjs` form does
**not** get the default; pass `--ssh` or set the env var yourself.

`scripts/deploy-web.mjs` runs the core suite (bails on red), runs
`build-web.mjs`, assembles a repo-shaped tree under `build/deploy/pb_public/`
(the apps fetch by relative path, so the served tree mirrors the repo — `apps/`,
`build/web/core/`, `spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
`examples/goals/`, plus a generated `index.html`), then `rsync -az --delete` it
to `~/pb/pb_public/`. No PocketBase restart needed. Flags: `--dry-run`,
`--stage-only`, `--ssh`/`WDL_DEPLOY_SSH`, `--remote-dir`/`WDL_DEPLOY_DIR`. Full
detail — the MIME finding (`.ohm`/`.wdlg` land as `text/plain`, and are
`fetch().text()`d anyway) and the cache decision (PocketBase sends
`Last-Modified` only; accepted as-is) — is in
[`deploy/README.md`](../../../deploy/README.md) "## 10. Static apps".

- **Admin UI:** `https://wex.androidempathy.com/_/` (superuser `chris@winberry.net`,
  password in Chris's password manager — not the repo).
- **Runbook:** [`deploy/README.md`](../../../deploy/README.md) — install, the
  panel proxy setup, PocketBase upgrade, SQLite backup/restore, and the
  "port 8090 exposure" known issue (open DreamHost firewall ticket).
- **Migrations onto the box:** `make deploy:db` — `rsync` of
  `deploy/pocketbase/pb_migrations/*.js` to `~/pb/pb_migrations/` (no `--delete`)
  then a PocketBase restart so any new migration applies. Run it whenever a
  migration is added; `deploy/README.md` §3 / §7a–b.
- **DB backup / restore:** [`deploy/README.md`](../../../deploy/README.md) §9
  "Back up (SQLite)" is the runbook — *since 2026-09-01 (task M6)* a nightly
  `sqlite3 .backup` cron line in
  [`deploy/pocketbase/crontab.fragment`](../../../deploy/pocketbase/crontab.fragment)
  (03:17 UTC, 30-day prune) plus **`make backups:pull`** — an off-box `rsync`
  **pull** to Chris's machine (`~/wdl-pb-backups`, no `--delete`) over the
  `dreamhost.ae.wex` alias, with PocketBase's built-in *Settings → Backups* as
  the fallback and aligned restore steps. **Not yet installed on the box** —
  Chris pastes the line into `crontab -e` and verifies
  the first run + first pull by hand.
- **Config templates** committed under `deploy/`; secrets are gitignored.
- No new local commands. The apps' test/build/serve commands above are
  unchanged; a production static deploy is item 19's `deploy/` script.
- **Item 20 (accounts / sharing) — live since 2026-08-30.** The apps also call
  the co-located PocketBase at **`/api/…`** (same origin, no CORS) through
  `apps/shared/pocketbase.js` — a hand-rolled `fetch` client, no SDK, no new
  dependency. Nothing to install or run locally; against a dev server with no
  `/api` the sign-in and *My workouts* controls simply report the call failed.
  Google sign-in uses a second redirect URI
  (`…/apps/builder/auth-callback.html`) registered alongside PocketBase's own —
  see [`deploy/README.md`](../../../deploy/README.md) §8 and "## 10".
