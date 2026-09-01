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
