/// <reference path="../pb_data/types.d.ts" />

// Creates the `movement_sets` collection (queue task S1 of the movement-sets
// database epic, [DEC-027]) — a movement *set* is the compose-by-hand repertoire
// in the builder palette modal's "Sets" section, and it moves out of the flat
// `localStorage['wdl.sets']` blob (`{ "Set name": ["movement-id", …] }`, written
// only by `saveSets()` in `apps/builder/builder.js`) into one row per set here.
//
// This is modelled on `workouts`, NOT on the vocab collections:
//   - It is *owned* content — every set is attributable to whoever made it —
//     with the same list/view/write rules the `workouts` collection uses, so
//     scope (org-library vs user) is *derived* from `owner` + `visibility` the
//     way it already is for workouts. That is why there is deliberately **no
//     `scope` column** here, unlike `equipment` / `patterns` (DEC-025), whose
//     rows carry an explicit `scope: global|user` because a vocab term is
//     applied everywhere by default and needs ownerless first-party rows. A set
//     has no such tier: it is a named list you compose *from*, always owned.
//
// Field choices (DEC-027's S1 contract):
//   - `owner` (relation -> users, required, cascadeDelete, min/maxSelect 1) —
//     the `workouts.owner` field verbatim. Deleting a user removes their sets.
//   - `name` (text, required, max 200) — the display label. `max: 200` matches
//     `workouts.title` and the vocab `name` column.
//   - `setId` (text, required, **unique index**) — the namespaced key
//     `<owner-handle>:<slug(name)>`, the `workouts.wdlId` analog. NOT named
//     `id`, which clashes with PocketBase's own record id — same reason
//     `movements.movementId` / `vocab.termId` avoid it. S2 forces it on every
//     create and update (re-slugged on rename, per DEC-027 / Chris) via a
//     `forceSetNamespace` twin of `apps/shared/pocketbase.js`'s `forceNamespace`;
//     the unique index below is the server-side guard behind that client rule.
//     `max: 200` — a handle plus a slug, comfortably inside 200.
//   - `movements` (json, required false, maxSize 20000) — an **ordered** array of
//     registry movement ids (the exact value the palette's `text/wdl-movement-id`
//     drag payload already carries). `maxSize: 20000` mirrors the vocab
//     `synonyms` ceiling; a set of a few hundred ~40-char ids stays well under
//     it, and it is a generous ceiling rather than a real limit.
//   - `visibility` (select `private|unlisted|public`, required, maxSelect 1) —
//     the `workouts.visibility` field verbatim. **There is no schema-level
//     default**: PocketBase's `select` field has no per-field default option in
//     the v0.40.x migration API, so — exactly like `workouts` (deploy/README.md
//     §7: "The client always sends `visibility: \"private\"` on create") — the
//     "default private" in DEC-027 is a *client contract*, enforced by
//     `createSet()` in S2, not by this migration. A create with no `visibility`
//     is rejected by `required`, which is the intended failure (the client must
//     name it), not a gap. Adding an `onRecordCreate` hook to inject a default
//     would diverge from the `workouts` pattern DEC-027 says to copy verbatim.
//   - `description` (text, required false, max 2000) — carried now, against a
//     later migration, per DEC-027; whether S4's create/edit dialog surfaces it
//     is S4's call. `max: 2000` — room for a short paragraph, bounded.
//   - `created` / `updated` (autodate) — the two-field pattern every collection
//     here uses.
//
// Access rules — the `workouts` rules:
//   list/view:            owner = @request.auth.id || visibility != "private"
//                         (an `unlisted` / `public` set is readable by anyone
//                          with the link, incl. signed-out; a `private` one
//                          404s for everyone but the owner)
//   create/update/delete: @request.auth.id = owner
//                         (DEC-027's stated form — owner-only. Equivalent in
//                          effect to the workouts create guard
//                          `@request.auth.id != "" && owner = @request.auth.id`:
//                          an unauthenticated request has `@request.auth.id = ""`,
//                          which cannot equal a required relation value.)
//
// Written against the PocketBase v0.40.x JS migration API — the
// `new Collection({ type, name, ...Rule, fields: [...], indexes: [...] })` create
// form, same as 1757100000_create_vocab.js / 1756600000_create_workouts.js.
// `down` drops the collection in one step.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and a
// throwaway pb_data (the M1 / L1 / V6 method): `migrate up` applies this plus the
// seven earlier migrations cleanly (exit 0); `movement_sets` lands with all eight
// fields (owner, name, setId, movements, visibility, description, created,
// updated) and both indexes — `idx_movement_sets_set_id` (unique) and
// `idx_movement_sets_owner` — checked via sqlite3 against `_collections` and
// `sqlite_master`; the unique index rejects a second row with the same `setId`
// (`UNIQUE constraint failed: movement_sets.setId`); the `owner` relation
// resolves to the `users` collection id; `migrate down 1` drops `movement_sets`
// and leaves `movements` / `workouts` / `users` / `equipment` / `patterns` and
// their indexes intact with zero leftover `sqlite_master` rows; a re-`up`
// reapplies cleanly. Binary and temp pb_data discarded, not committed. Still
// worth a glance in the admin UI on the box after deploy — same caveat as
// 1756600000_create_workouts.js.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const movementSets = new Collection({
      type: "base",
      name: "movement_sets",

      // The `workouts` rules — scope is derived from owner + visibility.
      listRule: 'owner = @request.auth.id || visibility != "private"',
      viewRule: 'owner = @request.auth.id || visibility != "private"',
      createRule: "@request.auth.id = owner",
      updateRule: "@request.auth.id = owner",
      deleteRule: "@request.auth.id = owner",

      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
        {
          name: "name",
          type: "text",
          required: true,
          max: 200,
        },
        {
          name: "setId",
          type: "text",
          required: true,
          max: 200,
        },
        {
          name: "movements",
          type: "json",
          required: false,
          maxSize: 20000,
        },
        {
          name: "visibility",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["private", "unlisted", "public"],
        },
        {
          name: "description",
          type: "text",
          required: false,
          max: 2000,
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
        // `setId` is the natural key S2's create/update is forced onto — the
        // same role `wdlId` plays for `workouts`, but unique here.
        "CREATE UNIQUE INDEX idx_movement_sets_set_id ON movement_sets (setId)",
        "CREATE INDEX idx_movement_sets_owner ON movement_sets (owner)",
      ],
    });

    app.save(movementSets);
  },
  (app) => {
    // rollback — one step
    app.delete(app.findCollectionByNameOrId("movement_sets"));
  },
);
