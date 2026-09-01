/// <reference path="../pb_data/types.d.ts" />

// Creates the `movements` collection (queue task M1) — the curated movement
// layer moves from a hand-edited JSON file into PocketBase (DEC-020). Every
// per-movement field in `registry/movements.json` gets a column here, so a
// dump -> ingest -> dump round-trip (built in M3/M4) is a shape-for-shape
// mapping.
//
// Field choices, reading the real ~972-entry `registry/movements.json`:
//   - `movementId` (text, required) is the registry `id` — NOT named `id`,
//     which would clash with PocketBase's own record id.
//   - Flat enum fields with a small closed vocabulary become `select` (single):
//     `force` push|pull|static, `mechanic` compound|isolation,
//     `load` total|per-implement, `lateralityAxis` arm|leg|side|hand|direction,
//     `defaultLaterality` both|split|per-side.
//   - Everything non-scalar in the data becomes a `json` field so the shape is
//     preserved verbatim: `aliases`, `muscles`, `pattern`, `laterality`,
//     `measures`, `implements`, `equipment` (always an array in the data),
//     `related`, `sameAs`. `implements` is a scalar number in the data, but a
//     json field round-trips a number fine and keeps the dump/load code
//     uniform.
//   - `source` (text) carries the import provenance string that ~87% of rows
//     have.
//   - `scope` (select, required) global|user and `user` (relation -> users,
//     nullable) are new — Phase 1 writes every ingested row `scope: "global"`;
//     `user` is unused until Phase 2 (user-scoped movements).
//
// Access rules (M1):
//   list/view:            scope = "global"   (readable signed-out)
//   create/update/delete: @request.auth.admin = true   (the field M2 added;
//                         PocketBase treats null/false admin as not-true, so
//                         non-admins are denied)
//
// Written against the PocketBase v0.40.x JS migration API — the
// `new Collection({ type, name, ...Rule, fields: [...], indexes: [...] })` form,
// same as 1756600000_create_workouts.js; `down` deletes the collection, same as
// that migration's rollback.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and
// a throwaway pb_data: `migrate up` applies this plus the workouts and
// users.admin migrations cleanly (exit 0); the `movements` collection lands with
// all fields and both indexes; `migrate down 1` drops it cleanly. Binary and
// temp pb_data discarded, not committed. Still worth a glance in the admin UI on
// the box after deploy — same caveat as 1756600000_create_workouts.js.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const movements = new Collection({
      type: "base",
      name: "movements",

      // Anyone (signed in or not) may read global movements. Phase 2 will widen
      // this to also expose a viewer's own user-scoped rows.
      listRule: 'scope = "global"',
      viewRule: 'scope = "global"',
      // Curating the global layer is admin-only — this is why M2 added
      // `users.admin`.
      createRule: "@request.auth.admin = true",
      updateRule: "@request.auth.admin = true",
      deleteRule: "@request.auth.admin = true",

      fields: [
        {
          name: "movementId",
          type: "text",
          required: true,
          max: 200,
        },
        {
          name: "title",
          type: "text",
          required: true,
          max: 400,
        },
        {
          name: "aliases",
          type: "json",
          required: false,
          maxSize: 20000,
        },
        {
          name: "muscles",
          type: "json",
          required: false,
          maxSize: 50000,
        },
        {
          name: "pattern",
          type: "json",
          required: false,
          maxSize: 20000,
        },
        {
          name: "laterality",
          type: "json",
          required: false,
          maxSize: 5000,
        },
        {
          name: "measures",
          type: "json",
          required: false,
          maxSize: 5000,
        },
        {
          name: "implements",
          type: "json",
          required: false,
          maxSize: 2000,
        },
        {
          name: "equipment",
          type: "json",
          required: false,
          maxSize: 10000,
        },
        {
          name: "related",
          type: "json",
          required: false,
          maxSize: 20000,
        },
        {
          name: "sameAs",
          type: "json",
          required: false,
          maxSize: 20000,
        },
        {
          name: "force",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["push", "pull", "static"],
        },
        {
          name: "mechanic",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["compound", "isolation"],
        },
        {
          name: "load",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["total", "per-implement"],
        },
        {
          name: "defaultLaterality",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["both", "split", "per-side"],
        },
        {
          name: "lateralityAxis",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["arm", "leg", "side", "hand", "direction"],
        },
        {
          name: "source",
          type: "text",
          required: false,
          max: 200,
        },
        {
          name: "scope",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["global", "user"],
        },
        {
          name: "user",
          type: "relation",
          required: false,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
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
        // The registry `id` is the natural key M3's ingestion is idempotent on.
        "CREATE UNIQUE INDEX idx_movements_movement_id ON movements (movementId)",
        "CREATE INDEX idx_movements_scope ON movements (scope)",
      ],
    });

    app.save(movements);
  },
  (app) => {
    // rollback
    const movements = app.findCollectionByNameOrId("movements");
    app.delete(movements);
  },
);
