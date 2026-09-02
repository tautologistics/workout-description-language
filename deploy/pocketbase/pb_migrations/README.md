# pb_migrations/

PocketBase auto-applies every `*.js` file in its `--migrationsDir` on start, in
filename order, once. This directory is that dir: symlink or copy it to
`$PB_DIR/pb_migrations` on the box (the systemd unit and `run-pocketbase.sh`
both pass `--migrationsDir`).

## How the `workouts` schema gets here

The **authoritative** setup is the manual steps in [`../../README.md`](../../README.md)
("The `workouts` collection") — done once in the admin UI, against whatever
PocketBase version is actually installed. The collection API in JS migrations
has changed shape across PocketBase minor versions, so a hand-written migration
is only a starting point.

After the collection exists on the box, export the real snapshot and commit it:

```sh
cd "$PB_DIR"
./pocketbase migrate collections        # writes pb_migrations/<ts>_collections_snapshot.js
```

Copy that generated file back into this directory, commit it, and delete
`1756600000_create_workouts.js` (the hand-written starter below) if the snapshot
supersedes it. From then on the collection schema is reproducible: a fresh
`pb_data` + this dir = the same collections.

## Files

- `1756600000_create_workouts.js` — hand-written starter for the `workouts`
  collection (owner/title/source/visibility + the access rules from item 18).
  Written against the PocketBase v0.23+ JS API. **Verify it applied cleanly**
  (`./pocketbase migrate` output, then check the admin UI); if your version
  rejects it, set the collection up by hand per the runbook and snapshot it as
  above.

- `1756700000_add_users_admin.js` — adds a `bool admin` field to the `users`
  collection (queue task M2), so M1's `movements` write rules can be
  `@request.auth.admin = true`. Edits an *existing* collection
  (`findCollectionByNameOrId` → `fields.add(new Field(...))` → `app.save`),
  verified against the PocketBase v0.40.1 JS API. Checked locally against a real
  v0.40.1 binary + throwaway `pb_data`: `migrate up` applies it and the workouts
  migration cleanly, the `admin` field lands on `users`, `migrate down 1`
  removes it. Still glance at the admin UI on the box after deploy, same as the
  workouts migration. The field defaults to `false`
  for every record, so the migration grants nobody anything — after deploy,
  set Chris's `users` row `admin: true` in the admin UI (see
  [`../../README.md`](../../README.md) §7a).

- `1756800000_create_movements.js` — creates the `movements` collection (queue
  task M1, [DEC-020](../../../docs/context/topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)):
  one column per per-movement field in `registry/movements.json` (`movementId`
  is the registry `id`; `force`/`mechanic`/`load`/`lateralityAxis`/
  `defaultLaterality` are `select`; every non-scalar field — `aliases`,
  `muscles`, `pattern`, `laterality`, `measures`, `implements`, `equipment`,
  `related`, `sameAs` — is `json`), plus `scope` (`select global|user`,
  required) and `user` (relation → `users`, nullable, for Phase 2). Read rules
  `scope = "global"`; write rules `@request.auth.admin = true`. Unique index on
  `movementId`, plain index on `scope`. Uses the `new Collection({...})` create
  form like the workouts migration; `down` deletes the collection. Verified
  against a real v0.40.1 binary + throwaway `pb_data`: `migrate up` applies all
  three migrations cleanly, the collection and both indexes land, `migrate down
  1` drops it. Glance at the admin UI on the box after deploy, same caveat as
  the workouts migration.

- `1756900000_add_users_handle_and_orgs.js` — adds `bool org` and unique `text
  handle` to `users`, then inserts the three non-interactive org accounts
  (`crossfit` / `hyrox` / `tabata`, fixed ids, no password/OAuth) that own the
  curated public workout sets (queue task L1, the *workout library* epic,
  [DEC-021](../../../docs/context/topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)).
  Edits an *existing* collection the same way `1756700000_add_users_admin.js`
  does, plus a `collection.indexes.push(...)` for the unique index and three
  `new Record(usersCol, {...})` / `app.save(record)` inserts. Verified against a
  real v0.40.1 binary + throwaway `pb_data`: `migrate up` applies all four
  migrations cleanly, `org`/`handle` land on `users` with the unique index, the
  three org rows exist with `org: true`, a duplicate `handle` insert is
  rejected by the index (`UNIQUE constraint failed`), and `migrate down 1`
  removes the rows, the index and both fields cleanly. Glance at the admin UI
  on the box after deploy — [`../../README.md`](../../README.md) §7c.

- `1757000000_add_workouts_wdlid.js` — adds a `wdlId` field (text, `max: 260`,
  nullable) plus a **plain** index `idx_workouts_wdl_id ON workouts (wdlId)` to
  the `workouts` collection (queue task L2, the *workout library* epic,
  [DEC-021](../../../docs/context/topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)).
  `wdlId` mirrors the workout's `@id` (`<owner-handle>:<slug>`) — L3 sets it on
  every save, L4 searches on it, L6's loader sets it for the org rows; existing
  rows stay `null` (no backfill, per DEC-021). No API-rule change. Edits an
  *existing* collection the same way `1756700000_add_users_admin.js` and
  `1756900000_add_users_handle_and_orgs.js` do — `findCollectionByNameOrId` →
  `fields.add(new Field(...))` / `indexes.push(...)` → `app.save`; `down`
  reverses with `indexes.filter(...)` + `fields.removeByName(...)`. Verified
  against a real v0.40.1 (darwin_arm64) binary + throwaway `pb_data`: `migrate
  up` applies all five migrations cleanly, `wdlId` + `idx_workouts_wdl_id` land
  on `workouts` (checked via `sqlite3` against `_collections` / `sqlite_master`),
  `migrate down 1` removes the field and the index together (owner / visibility
  indexes intact), a re-`up` reapplies cleanly. Glance at the admin UI on the
  box after deploy — [`../../README.md`](../../README.md) §7d.

- `1757100000_create_vocab.js` — creates the `equipment` and `patterns`
  collections (queue task V6, the *vocabularies & editor ergonomics* epic,
  [DEC-025](../../../docs/context/topics/settled-decisions.md#dec-025-equipment--movement-patterns-are-a-db-backed-vocabulary-layer-registryequipmentpatternsjson-is-the-committed-dump)):
  one row per vocabulary term, so equipment and movement patterns grow by a DB
  row rather than an edit to `apps/shared/vocab.js`. Both collections share one
  shape, built by a local `vocabCollection(name)` helper so the two cannot
  drift: `termId` (text, required — the registry `id`, *not* `id`, same clash
  `movements.movementId` avoids), `name` (text, required — `registry/muscles.json`
  calls this field `name`, and the committed dumps match that file's entry
  shape), `synonyms` (json), plus `scope` (`select global|user`, required) and
  `user` (relation → `users`, nullable) carried over from `movements`
  unchanged. Read rules `scope = "global"`; write rules
  `@request.auth.admin = true`. Unique index on `termId` and a plain index on
  `scope`, per collection. Uses the `new Collection({...})` create form like the
  movements migration; `down` deletes both collections in reverse creation
  order. Two collections rather than one table with a `kind` column — they are
  independent vocabularies and a shared table would need every read to carry a
  filter a wrong one silently widens. Verified against a real v0.40.1
  (darwin_arm64) binary + throwaway `pb_data`: `migrate up` applies all six
  migrations cleanly, both collections land with all seven fields and all four
  indexes (checked via `sqlite3` against `_collections` / `sqlite_master`), the
  unique index rejects a duplicate `termId` (`UNIQUE constraint failed:
  equipment.termId`), the `user` relation resolves to `users`, `migrate down 1`
  drops both and leaves `movements` / `workouts` / `users` and their indexes
  intact (zero leftover `sqlite_master` rows), and a re-`up` reapplies cleanly.
  The rows themselves are **not** loaded by this migration —
  `registry/{equipment,patterns}.json` is the committed dump and V8's
  `make vocab:load` is what ingests it. Glance at the admin UI on the box after
  deploy, same caveat as the workouts migration.
