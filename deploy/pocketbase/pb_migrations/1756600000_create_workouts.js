/// <reference path="../pb_data/types.d.ts" />

// Starter migration for the `workouts` collection (queue item 18).
//
// Written against the PocketBase v0.23+ JS migration API (`new Collection({...})`
// with a flat `fields: []` array). If the installed version rejects it, set the
// collection up by hand per deploy/README.md and snapshot it with
// `./pocketbase migrate collections` — see pb_migrations/README.md.
//
// Access rules (item 18):
//   read  (list/view): owner = @request.auth.id  ||  visibility != "private"
//   write (create):    signed in AND owner is self
//   write (update/del): owner-only
// An `unlisted` or `public` workout is therefore readable by anyone with the
// link (including signed-out); a `private` one 404s for everyone but the owner.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const workouts = new Collection({
      type: "base",
      name: "workouts",

      listRule: 'owner = @request.auth.id || visibility != "private"',
      viewRule: 'owner = @request.auth.id || visibility != "private"',
      createRule: '@request.auth.id != "" && owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',

      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
          minSelect: 1,
        },
        {
          name: "title",
          type: "text",
          required: false,
          max: 200,
        },
        {
          name: "source",
          type: "text",
          required: true,
          max: 200000, // a .wdl body; generous ceiling, not a real limit
        },
        {
          name: "visibility",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["private", "unlisted", "public"],
        },
        {
          name: "created",
          type: "autodate",
          onCreate: true,
          onUpdate: false,
        },
        {
          name: "updated",
          type: "autodate",
          onCreate: true,
          onUpdate: true,
        },
      ],

      indexes: [
        "CREATE INDEX idx_workouts_owner ON workouts (owner)",
        "CREATE INDEX idx_workouts_visibility ON workouts (visibility)",
      ],
    });

    app.save(workouts);
  },
  (app) => {
    // rollback
    const workouts = app.findCollectionByNameOrId("workouts");
    app.delete(workouts);
  },
);
