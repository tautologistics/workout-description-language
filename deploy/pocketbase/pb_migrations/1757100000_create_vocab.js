/// <reference path="../pb_data/types.d.ts" />

// Creates the `equipment` and `patterns` collections (queue task V6) — the
// equipment and movement-pattern vocabularies move from a hardcoded list in
// `apps/shared/vocab.js` into PocketBase (DEC-025), the same move DEC-020 made
// for the curated movement layer. One row per term, so a vocabulary grows by a
// DB row rather than a code edit.
//
// Two collections rather than one table with a `kind` column: they are two
// independent vocabularies that happen to share a shape, the editor asks for
// one or the other and never both, and a shared table would need every read to
// carry a filter that a wrong or missing one silently widens. The cost is this
// file describing the same five fields twice, which is cheap and obvious.
//
// Field choices, mirroring 1756800000_create_movements.js:
//   - `termId` (text, required) is the registry `id` — NOT named `id`, which
//     would clash with PocketBase's own record id. Same reason, same name shape
//     as `movements.movementId`.
//   - `name` (text) is the display label. `registry/muscles.json` calls this
//     field `name`, and these two files match that file's entry shape, so the
//     column does too. (The V6 queue note said `label`; the committed file wins
//     — recorded as a correction in tasks/current.md.)
//   - `synonyms` (json) is the other spellings the same term arrives under
//     upstream — always an array in the data, empty where there are none.
//   - `scope` (select, required) global|user and `user` (relation -> users,
//     nullable) are carried over from `movements` unchanged: V8's loader writes
//     every row `scope: "global"`, and `user` is unused until user-scoped vocab
//     exists, if it ever does. Keeping the pair means the read rule, the loader
//     and any later per-user layer are the same shape they already are for
//     movements rather than a second pattern to learn.
//
// Access rules, identical to `movements` (M1):
//   list/view:            scope = "global"   (readable signed-out — the editor
//                         reads the vocabulary before anyone signs in)
//   create/update/delete: @request.auth.admin = true   (the field M2 added;
//                         PocketBase treats null/false admin as not-true, so
//                         non-admins are denied)
//
// Written against the PocketBase v0.40.x JS migration API — the
// `new Collection({ type, name, ...Rule, fields: [...], indexes: [...] })` form,
// same as 1756800000_create_movements.js; `down` deletes both collections in
// reverse creation order.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and a
// throwaway pb_data: `migrate up` applies this plus the five earlier migrations
// cleanly (exit 0); both collections land with all seven fields, both unique
// `termId` indexes and both `scope` indexes (checked via sqlite3 against
// `_collections`); `migrate down 1` drops both and leaves `movements`,
// `workouts` and `users` intact; a re-`up` reapplies cleanly. Binary and temp
// pb_data discarded, not committed. Still worth a glance in the admin UI on the
// box after deploy — same caveat as 1756600000_create_workouts.js.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // The two vocabularies are the same shape, so the fields and rules are
    // built once per collection rather than copy-pasted and allowed to drift.
    const vocabCollection = (name) =>
      new Collection({
        type: "base",
        name,

        // Anyone (signed in or not) may read the global vocabulary — the
        // movement editor's pickers need it before auth, and it is not secret.
        listRule: 'scope = "global"',
        viewRule: 'scope = "global"',
        // Curating the global vocabulary is admin-only, same as `movements`.
        createRule: "@request.auth.admin = true",
        updateRule: "@request.auth.admin = true",
        deleteRule: "@request.auth.admin = true",

        fields: [
          {
            name: "termId",
            type: "text",
            required: true,
            max: 200,
          },
          {
            name: "name",
            type: "text",
            required: true,
            max: 200,
          },
          {
            name: "synonyms",
            type: "json",
            required: false,
            maxSize: 20000,
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
          // The registry `id` is the natural key V8's upsert is idempotent on —
          // the same role `movementId` plays for `movements`.
          `CREATE UNIQUE INDEX idx_${name}_term_id ON ${name} (termId)`,
          `CREATE INDEX idx_${name}_scope ON ${name} (scope)`,
        ],
      });

    app.save(vocabCollection("equipment"));
    app.save(vocabCollection("patterns"));
  },
  (app) => {
    // rollback — reverse of creation order
    app.delete(app.findCollectionByNameOrId("patterns"));
    app.delete(app.findCollectionByNameOrId("equipment"));
  },
);
