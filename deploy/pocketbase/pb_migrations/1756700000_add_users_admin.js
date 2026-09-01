/// <reference path="../pb_data/types.d.ts" />

// Adds a `bool admin` field to the `users` collection (queue task M2).
//
// M1's `movements` collection gives its create/update/delete rules as
// `@request.auth.admin = true`, so the field has to exist first. A PocketBase
// bool field is `false` for every existing and new record until explicitly set
// — no default is written here — so applying this migration grants nobody
// anything. After deploy, set Chris's own `users` row `admin: true` in the
// admin UI (the migration can't know his user id). See deploy/README.md §7a.
//
// Written against the PocketBase v0.40.x JS migration API: an *existing*
// collection is edited by `findCollectionByNameOrId` -> `collection.fields.add`
// / `collection.fields.removeByName` -> `app.save(collection)` (docs:
// https://pocketbase.io/docs/js-collections "Update existing collection"),
// distinct from the `new Collection({ fields: [...] })` form the workouts
// migration uses to create one. The field object keeps the same `{ name, type,
// ... }` shape as the workouts migration, wrapped in `new Field(...)` because
// `fields.add` takes Field instances.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and
// a throwaway pb_data: `migrate up` applies this and the workouts migration
// cleanly; the `admin` bool field lands on `users` (required:false,
// system:false); `migrate down 1` removes it cleanly. Still worth a glance in
// the admin UI on the box after deploy — same caveat as
// 1756600000_create_workouts.js.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(
      new Field({
        name: "admin",
        type: "bool",
        required: false,
      }),
    );

    app.save(users);
  },
  (app) => {
    // rollback
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("admin");
    app.save(users);
  },
);
