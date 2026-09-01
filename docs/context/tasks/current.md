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
deployment epic (18–20) and the redesign chain (R1–R10). The **one active epic**
is *Movements in the database — Phase 1 (M1–M6)*, its own section below. The
loose bullets that follow are unscheduled — the first is self-contained and
dispatchable now; the rest need Chris to scope or sequence:

- **The `»` panel's per-implement load token (`@ 2x`) is unclear mid-edit** —
  not a numbered item; a self-contained builder-UX task. For a
  `load: "per-implement"` movement the panel splices a bare `@ 2x` (seeded from
  `implements`) that reads as cryptic before the weight is typed. Revisit the
  formatting of the seeded `@ Nx` token and its clarity (hint / label / caret).
  Detail in [../topics/builder-ux.md](../topics/builder-ux.md) under the
  `»`-panel entry.

- **A full laterality curation sweep** — not a numbered item. `around-worlds` is
  the only movement carrying `lateralityAxis`. The audit-CSV tooling is ready:
  `export-movement-curation.mjs` (`make curation-sheet`) emits the sheet with a
  `Laterality axis` column in both the CURRENT and CURATE blocks, and
  `import-movement-curation.mjs` lands it back. A sweep is run via that CSV per
  [../topics/running-it.md](../topics/running-it.md), not hand-edits — needs
  Chris to scope which movements. Note `around-worlds` itself looks mis-sourced
  (free-exercise-db's "Around The Worlds" is a lying dumbbell bench fly, not the
  kettlebell around-the-head movement its `lateralityAxis: "direction"` +
  `per-side` describe) — the sweep should resolve what that entry is. The CSV is
  now the **bulk** path; per the rethink below, one-at-a-time movement edits are
  headed into an in-app GUI.

- **Post-redesign rethinks** (not scheduled) — `@id` ↔ record-id correlation,
  account **namespacing** (a username as a workout-id prefix; touches the
  `workouts` collection schema), the board's **Edit** button round-tripping into
  the builder, an **"open on the board"** action for saved workouts. In
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

## Movements in the database — Phase 1 (M0–M7)

The movement registry moves from a hand-edited JSON file to a PocketBase
collection, edited through an in-app widget. Raised 2026-08-31 (see
[../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout"):
the curation spreadsheet is unworkable, and the need to fix or add a movement
comes up *while building a workout*. **Phase 1 is global (admin-edited)
movements only.** Phase 2 — user-scoped movements — is in
[deferred.md](deferred.md).

**Execution order (established 2026-08-31):** ~~M0+M2~~ → ~~M1~~ → **M7 (next /
in progress)** → M3 → M5 → M4, with **M6** landable at any point (it depends
on nothing here). **M0+M2 landed 2026-08-31** (`ea2a64f`): DEC-020
recorded, `1756700000_add_users_admin.js` added (verified locally against a real
PocketBase v0.40.1 binary). **M1 landed 2026-08-31** (`00c29a5`):
`1756800000_create_movements.js` added (verified locally against a real
PocketBase v0.40.1 binary — up + down clean, collection and both indexes land).
Each session lands its task fully (committed, pushed to `origin/main`,
`docs/context/` updated) and spawns the next.

Grounding facts, so an M-task can start cold:

- The **curated layer** is `registry/movements.json` (~972 entries: `id`,
  `title`, `aliases`, `muscles`, `pattern`, `force`, `mechanic`, `equipment`,
  `laterality`, `defaultLaterality`, `lateralityAxis`, `measures`, `load`,
  `implements`). This is what moves into the DB.
- `registry/movements.canonical.json` is **built** from external sources by
  `scripts/build-canonical.ts` and is *not* ingested — that pipeline keeps
  running; the DB replaces the curated seed it merges in.
- `packages/core` reads `registry/movements.json` directly
  (`packages/core/src/env.ts`) and **must stay install-free and offline** — this
  epic does not touch it. The apps go through `apps/shared/pocketbase.js`, a
  hand-rolled client hitting `/api/*` **same-origin**: in production that is
  PocketBase (it serves the apps from `pb_public/`); under `make serve` there is
  no PocketBase, so today auth and saved workouts just 404 and movements work
  only because they are fetched as a static file. M7 fixes that with a mock
  `/api`.
- PocketBase v0.40.1 on the DreamHost VPS, `~/pb/`, migrations in
  `deploy/pocketbase/pb_migrations/`, the `workouts` collection as the model.

- **M0 — Design note: read path + dump cadence** — **DONE 2026-08-31**
  (`ea2a64f`), written up as
  [DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump).
  Dump cadence + prod-edit dump timing left explicitly open in the DEC's
  "Consequences" para. Original notes kept below.
  **Settled:** production apps read movements from the
  PocketBase `movements` collection via the same `/api/*` the client already
  uses; `packages/core`, its tests and `build-canonical.ts` keep reading
  `registry/movements.json` and are untouched; local `make serve` answers `/api`
  from a **mock** (M7), and `registry/movements.json` **is** the movements
  fixture — the mock reads it and wraps records in PocketBase's response
  envelope; M4's dump keeps that file current from the live DB. **Residual:**
  when the dump runs (manual `make` target, a git pre-commit, or the deploy
  step); whether an admin edit in prod is expected to be dumped + committed
  promptly or batched.

- **M1 — `movements` PocketBase collection + migration.** — **DONE 2026-08-31**
  (`00c29a5`). `deploy/pocketbase/pb_migrations/1756800000_create_movements.js`
  creates a `base` collection `movements` via `new Collection({...})`. One
  column per per-movement field in `registry/movements.json`: `movementId`
  (text, required — the registry `id`, deliberately not `id`); `title` (text,
  required); `force`/`mechanic`/`load`/`lateralityAxis`/`defaultLaterality` as
  `select` (single); every non-scalar field — `aliases`, `muscles`, `pattern`,
  `laterality`, `measures`, `implements`, `equipment`, `related`, `sameAs` — as
  `json` (`equipment` is always an array in the data; `implements` is a scalar
  number but json keeps the dump/load code uniform); `source` (text). Plus
  `scope` (select `global|user`, **required**) and `user` (relation → `users`,
  `maxSelect: 1`, **nullable, cascadeDelete, unused in Phase 1** — present for
  Phase 2), and `created`/`updated` autodates like `workouts`. Indexes: unique
  on `movementId` (M3's idempotency key), plain on `scope`. Rules:
  list/view `scope = "global"`; create/update/delete `@request.auth.admin =
  true` (the field M2 added). `down` deletes the collection. Verified locally
  against a real PocketBase v0.40.1 binary + throwaway `pb_data` — `migrate up`
  applies all three migrations cleanly, the collection and both indexes land,
  `migrate down 1` drops it; binary discarded, not committed. No `packages/core`
  change — suite **2064/2064, 1 pending** unchanged. **Still to do on deploy:**
  glance at the collection in the admin UI on the box, same caveat as the
  workouts migration.

- **M2 — Admin designation.** — **DONE 2026-08-31** (`ea2a64f`).
  `deploy/pocketbase/pb_migrations/1756700000_add_users_admin.js` adds a
  `bool admin` field to the `users` collection (`up`: `fields.add(new Field(...))`;
  `down`: `fields.removeByName`), so M1's write rule can be
  `@request.auth.admin = true`. Verified locally against a real PocketBase
  v0.40.1 binary (up + down both clean). **Still to do on deploy:** set Chris's
  own `users` row `admin: true` in the admin UI — the migration can't know his
  id (`deploy/README.md` §7a).

- **M3 — Ingestion: `registry/movements.json` → DB.**
  `scripts/movements-to-db.mjs` (wrap as `make movements-load`), idempotent,
  keyed by `id`, every row `scope: "global"`. Run once against prod after
  M1/M2 deploy; re-runnable in dev. Canonical corpus untouched.

- **M4 — Egress: DB → `registry/movements.json`.**
  `scripts/movements-from-db.mjs` (`make movements-dump`) reads `scope =
  "global"` and rewrites `registry/movements.json` in the current key order and
  formatting, so the git diff is reviewable. This is "capture it back out and
  persist it in the codebase". Round-trip check: dump → load → dump yields no
  diff. Pairs with M3.

- **M5 — Movement editor widget.** A reusable form component
  (`apps/shared/movement-editor.js`) over one movement's fields, validating
  against the registry enums already spelled out in
  `scripts/import-movement-curation.mjs` / `packages/core/src/fold.ts`
  (laterality `both|split|per-side`, axis `arm|leg|side|hand|direction`, force
  `push|pull|static`, mechanic `compound|isolation`, load `total|per-implement`,
  measures `distance|calories`). First host: the builder — a "new / edit
  movement" affordance (from the `»` panel or the Movements drawer) writing a
  `scope: "global"` row. Built to drop into other hosts later.

- **M6 — Nightly DB backup cron on the VPS** *(pre-existing gap, independent of
  M1–M5, now higher priority — raised by Chris 2026-08-31; the answer to "did we
  set this up?" is **no**)*. Only the keepalive cron exists
  (`deploy/pocketbase/crontab.fragment`). `deploy/README.md` §"Back up (SQLite)"
  documents the manual `sqlite3 pb_data/data.db .backup` and *recommends*
  automating it — never done, and `~/pb/pb_backups/` stays empty. Task: a daily
  backup (a shell cron running `sqlite3 .backup` into `~/pb/pb_backups/` +
  `find -mtime +30 -delete`, or PocketBase v0.40's built-in scheduled backups
  under Settings → Backups) **and copy the backups off the box** (rsync to
  Chris's machine). Update `deploy/README.md` + `crontab.fragment`. Load-bearing
  once movement data lives only in the DB.

- **M7 — Local dev mock `/api` + fixtures** *(on by default; opt out with
  `WDL_MOCK_API=0` to hit a real local PocketBase)*. `scripts/serve.mjs`
  intercepts `/api/*` before static handling and routes to a small mock module
  (no deps — it is still a one-person dev server). Covers the endpoints
  `apps/shared/pocketbase.js` uses:
  - **auth** (`users/auth-methods`, `auth-with-oauth2`, `auth-refresh`) —
    short-circuit the Google redirect: `auth-methods` returns an `authURL`
    pointing at a local stub that bounces straight back with a canned `?code`;
    `auth-with-oauth2` accepts any code and returns a fixture `users` record +
    a fake token. Sign-in "just works" locally as one fixture user.
  - **`workouts/records`** CRUD — seeded from a committed `fixtures/workouts.json`
    of sample data, runtime writes persisted to a git-ignored
    `fixtures/workouts.local.json` so a restart keeps them. Just something to
    work with; not a prod mirror.
  - **`movements/records`** (needs M1's shape) — read-only, straight from
    `registry/movements.json`, wrapped in the PB list/response envelope.
  New: `fixtures/workouts.json` + `fixtures/users.json` (sample data, committed);
  `registry/movements.json` doubles as the movements fixture; runtime write
  state stays out of git. Unblocks the builder's account features and (with M1)
  the movement editor without a local PocketBase. The auth part depends on
  nothing; the movements endpoint waits on M1.

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
