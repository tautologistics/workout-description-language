/// <reference path="../pb_data/types.d.ts" />

// Adds `org` (bool) and `handle` (text, unique) to the `users` collection and
// inserts the three non-interactive org accounts — `crossfit`, `hyrox`,
// `tabata` — with fixed ids (queue task L1, the *workout library* epic,
// DEC-021).
//
// Why:
//   - `org` flags a `users` row that owns a curated public workout set. It has
//     no OAuth identity and nobody signs in as it; the flag only lets a UI
//     label "an org's set" and (later) gates who may write the row's workouts.
//     A PocketBase bool is `false` for every existing and new record until set
//     — no default is written — exactly like the `admin` field M2 added.
//   - `handle` is the `@id` namespace prefix for everything an account owns
//     (`crossfit:fran`, `chris:fran`). Unique (a unique index), `[a-z0-9-]+`,
//     nullable at rest but never null for an account that has saved a workout —
//     the app assigns a random `adjective-noun` handle on first sign-in
//     (`apps/shared/handle.js`). The three org rows get their name as the
//     handle here.
//
// Style: edits an *existing* collection, the same shape as
// 1756700000_add_users_admin.js — `findCollectionByNameOrId` ->
// `collection.fields.add(new Field(...))` / `collection.indexes.push(...)` ->
// `app.save(collection)`. The org rows are created with `new Record(usersCol,
// {...})` -> `app.save(record)`; `users` is an auth collection, so each row is
// given an unusable random password (PocketBase's auth-record validation
// requires one even though nobody authenticates as these accounts) and
// `verified: true` so they are not in a limbo state.
//
// Fixed ids (15 chars, `[a-z0-9]`, identical here / in fixtures / in the L6
// loader):
//   crossfit -> org0crossfit001
//   hyrox    -> org0hyrox000001
//   tabata   -> org0tabata00001
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and
// a throwaway pb_data — see deploy/pocketbase/pb_migrations/README.md and the
// L1 write-up. `migrate up` applies this on top of the four existing
// migrations; `org` + `handle` land on `users` with the unique index; the
// three org rows exist with their fixed ids and `org: true`; a second row with
// a duplicate `handle` is rejected by the index; `migrate down 1` removes the
// rows, the index and both fields cleanly. Still worth a glance in the admin
// UI on the box after deploy — see deploy/README.md §7c.

const ORGS = [
  { id: "org0crossfit001", handle: "crossfit" },
  { id: "org0hyrox000001", handle: "hyrox" },
  { id: "org0tabata00001", handle: "tabata" },
];

const HANDLE_INDEX = "CREATE UNIQUE INDEX `idx_users_handle` ON `users` (`handle`)";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(
      new Field({
        name: "org",
        type: "bool",
        required: false,
      }),
    );

    users.fields.add(
      new Field({
        name: "handle",
        type: "text",
        required: false,
        max: 63,
      }),
    );

    if (!users.indexes.includes(HANDLE_INDEX)) {
      users.indexes.push(HANDLE_INDEX);
    }

    app.save(users);

    // The three org accounts. Auth-collection rows: give each an unusable
    // random password (validation wants one; nobody authenticates as these).
    for (const org of ORGS) {
      const rec = new Record(users);
      rec.id = org.id;
      rec.set("handle", org.handle);
      rec.set("org", true);
      rec.set("email", `${org.handle}@orgs.wdl.invalid`);
      rec.set("emailVisibility", false);
      rec.set("verified", true);
      rec.set("name", org.handle);
      rec.setPassword($security.randomString(40));
      app.save(rec);
    }
  },
  (app) => {
    // rollback
    for (const org of ORGS) {
      try {
        app.delete(app.findRecordById("users", org.id));
      } catch (_) {
        // already gone — nothing to undo
      }
    }

    const users = app.findCollectionByNameOrId("users");
    users.indexes = users.indexes.filter((ix) => ix !== HANDLE_INDEX);
    users.fields.removeByName("handle");
    users.fields.removeByName("org");
    app.save(users);
  },
);
