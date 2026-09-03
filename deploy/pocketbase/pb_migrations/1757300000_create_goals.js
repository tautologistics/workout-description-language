/// <reference path="../pb_data/types.d.ts" />

// Creates the `goals` collection (queue task G1 of the goals database epic
// G0-G4, [DEC-028]) — a saved goal ruleset is a "Saved" entry in the builder's
// Analysis-tab Goals block (R5), and it moves out of the flat
// `localStorage['wdl.goals']` blob (`{ "name": "<.wdlg source text>" }`, written
// only by that block's Save-as and Delete handlers in `apps/builder/builder.js`)
// into one row per ruleset here.
//
// This is modelled on the vocab collections (`equipment` / `patterns`,
// 1757100000_create_vocab.js), NOT on `workouts` / `movement_sets`:
//   - A ruleset has a genuine ownerless default tier. A `global` ruleset is
//     *the ruleset applied / available by default, everywhere* — shown to every
//     reader with no owner in the picture — exactly like an `equipment` term, so
//     it needs an explicit `scope: global|user` column plus a nullable `user`
//     relation (DEC-025's vocab model), not the `workouts` `visibility` model
//     with a derived scope that `movement_sets` (DEC-027) took. This is the one
//     place the goals epic diverges from its sibling sets epic.
//   - There is deliberately no `org-library` tier: Chris, 2026-09-02 — "there
//     wouldn't be any org-library ones ... there's not really much to enforce
//     there." Two scopes only.
//
// Field choices (DEC-028's G1 contract):
//   - `title` (text, required, max 200) — the `.wdlg` title,
//     `parseGoals(source).title` (the inline text after the `goals:` header).
//     `max: 200` matches `workouts.title` and the vocab `name` column.
//   - `goalId` (text, required, **unique index**) — the namespaced key:
//     `wdl:<slug>` for a `global` row (a fixed first-party namespace the G3
//     loader sets, the goals analog of `movements.movementId`'s `wdl:` idea) or
//     `<owner-handle>:<slug(title)>` for a `user` row (the `workouts.wdlId` /
//     `movement_sets.setId` rule, re-slugged on rename per DEC-028). NOT named
//     `id`, which clashes with PocketBase's own record id — same reason
//     `movements.movementId` / `vocab.termId` / `movement_sets.setId` avoid it.
//     `max: 200` — a handle plus a slug, comfortably inside 200. G2 forces it on
//     every create and update via a `forceGoalNamespace` twin of
//     `apps/shared/pocketbase.js`'s `forceNamespace`; the unique index below is
//     the server-side guard behind that client rule.
//   - `source` (text, required, max 200000) — the raw `.wdlg` source, verbatim.
//     The `workouts.source` field shape (`max: 200000` — "a .wdlg body; generous
//     ceiling, not a real limit"). The G3 loader writes each `examples/goals/*.wdlg`
//     byte-identical into this column.
//   - `scope` (select, required, maxSelect 1) global|user — carried from the
//     vocab collections unchanged, so the read rule, the loader and any later
//     per-user layer are the same shape they already are for `equipment` /
//     `patterns` rather than a second pattern to learn.
//   - `user` (relation -> users, required false, cascadeDelete, maxSelect 1) —
//     **nullable**, null for a `global` row. The vocab collections' nullable
//     `user` relation verbatim, NOT `movement_sets.owner` (required). Deleting a
//     user removes their `user`-scoped rulesets.
//   - `created` / `updated` (autodate) — the two-field pattern every collection
//     here uses.
//
// Access rules (DEC-028's G1 contract) — a user owns their own rows, and an
// admin may write the `global` tier:
//   list/view:            scope = "global" || user = @request.auth.id
//                         (a `global` ruleset is readable by anyone, incl.
//                          signed-out — the Goals block shows it before auth; a
//                          `user` ruleset is visible only to its owner)
//   create/update/delete: (scope = "user" && user = @request.auth.id)
//                           || @request.auth.admin = true
//                         (`@request.auth.admin` is the field M2 added;
//                          PocketBase treats null/false admin as not-true, and
//                          an unauthenticated request has `@request.auth.id = ""`
//                          which cannot equal a required relation value)
//
// Written against the PocketBase v0.40.x JS migration API — the
// `new Collection({ type, name, ...Rule, fields: [...], indexes: [...] })` create
// form, same as 1757200000_create_movement_sets.js / 1757100000_create_vocab.js.
// `down` drops the collection in one step.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and a
// throwaway pb_data (the M1 / L1 / V6 / S1 method): `migrate up` applies this
// plus the seven earlier migrations cleanly (exit 0); `goals` lands with all
// seven fields (title, goalId, source, scope, user, created, updated) and both
// indexes — `idx_goals_goal_id` (unique) and `idx_goals_scope` — checked via
// sqlite3 against `_collections` and `sqlite_master`; the unique index rejects a
// second row with the same `goalId` (`UNIQUE constraint failed: goals.goalId`);
// the `user` relation resolves to the `users` collection id and is nullable (a
// `scope: "global"` row with no `user` inserts fine); `migrate down 1` drops
// `goals` and leaves `movements` / `workouts` / `users` / `movement_sets` /
// `equipment` / `patterns` and their indexes intact with zero leftover
// `sqlite_master` rows; a re-`up` reapplies cleanly. Binary and temp pb_data
// discarded, not committed. Still worth a glance in the admin UI on the box
// after deploy — same caveat as 1756600000_create_workouts.js.
//
// The rows themselves are **not** loaded by this migration —
// `examples/goals/*.wdlg` is the committed `global` source and G3's
// `make goals:load` is what ingests it. **Not yet applied on the box** —
// `make deploy:db` lands it at G4 (or whenever Chris next deploys).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const goals = new Collection({
      type: "base",
      name: "goals",

      // A `global` ruleset is readable by anyone (incl. signed-out); a `user`
      // ruleset is visible only to its owner.
      listRule: 'scope = "global" || user = @request.auth.id',
      viewRule: 'scope = "global" || user = @request.auth.id',
      // A user owns their own rows; an admin may write the `global` tier.
      createRule:
        '(scope = "user" && user = @request.auth.id) || @request.auth.admin = true',
      updateRule:
        '(scope = "user" && user = @request.auth.id) || @request.auth.admin = true',
      deleteRule:
        '(scope = "user" && user = @request.auth.id) || @request.auth.admin = true',

      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          max: 200,
        },
        {
          name: "goalId",
          type: "text",
          required: true,
          max: 200,
        },
        {
          name: "source",
          type: "text",
          required: true,
          max: 200000, // a .wdlg body; generous ceiling, not a real limit
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
          required: false, // nullable — null for a `global` row
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
        // `goalId` is the natural key G2's create/update is forced onto and G3's
        // loader upserts on — the same role `wdlId` plays for `workouts`, but
        // unique here, across both scope tiers.
        "CREATE UNIQUE INDEX idx_goals_goal_id ON goals (goalId)",
        "CREATE INDEX idx_goals_scope ON goals (scope)",
      ],
    });

    app.save(goals);
  },
  (app) => {
    // rollback — one step
    app.delete(app.findCollectionByNameOrId("goals"));
  },
);
