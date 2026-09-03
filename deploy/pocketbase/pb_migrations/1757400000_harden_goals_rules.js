/// <reference path="../pb_data/types.d.ts" />

// Hardens the `goals` collection access rules — a follow-up to
// 1757300000_create_goals.js (queue task G1, [DEC-028]), found while verifying
// G4's prod deploy.
//
// The create/update/delete rule G1 shipped was
//     (scope = "user" && user = @request.auth.id) || @request.auth.admin = true
// with no `@request.auth.id != ""` guard. An unauthenticated request has
// `@request.auth.id = ""`, and `goals.user` is a *nullable* relation, so a
// `POST` of `{ scope: "user" }` with **no `user` field** makes the left branch
// `"user" = "user" && "" = ""` — which is TRUE — and an anonymous caller lands
// an ownerless `user`-scoped row. The list/view rule
//     scope = "global" || user = @request.auth.id
// has the same `"" = ""` hole: an anonymous caller can read those ownerless
// rows. The sibling collections do not have this gap — `movement_sets` and
// `workouts` both guard create with `@request.auth.id != ""`, and their read
// rule's `owner`/`user` clause is safe only because `owner` there is *required*
// (never ""), which `goals.user` is not.
//
// Exposure was narrow — an anonymous `POST` of a `scope: "global"` row is
// rejected (admin-only), and so is one that attributes a `scope: "user"` row to
// a real uid (`user` != "") — so it was collection spam, not privilege
// escalation. Verified on the live API 2026-09-03, both probe rows deleted; the
// collection held exactly the 3 `global` rows loaded by `make goals:load`.
//
// This migration tightens all five rules on the *existing* collection:
//
//   list/view:            scope = "global"
//                           || (@request.auth.id != "" && user = @request.auth.id)
//   create/update/delete:  @request.auth.id != ""
//                           && ( (scope = "user" && user = @request.auth.id)
//                                 || @request.auth.admin = true )
//
// A superuser bypasses collection rules entirely, so `make goals:load` (which
// authenticates as `_superusers`) is unaffected; a `users` admin row is
// authenticated, so `@request.auth.id != ""` is satisfied and the admin-write
// path for the `global` tier still works.
//
// Written against the PocketBase v0.40.x JS migration API — the *existing*
// collection is edited by `findCollectionByNameOrId` -> assign the `*Rule`
// string properties -> `app.save(collection)` (the
// 1756700000_add_users_admin.js idiom, not the `new Collection({...})` create
// form). `down` restores G1's original five rule strings verbatim.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and a
// throwaway pb_data (the M2 / G1 method): `migrate up` applies this plus the
// eight earlier migrations cleanly (exit 0); the five `goals` rules read back as
// the guarded forms above (checked via `sqlite3` against `_collections`); an
// unauthenticated create of `{ scope: "user" }` with no `user` is now rejected
// (403), while a `scope: "global"` read stays open and an owner still reads and
// writes their own `user` rows; `migrate down 1` restores the exact G1 rule
// strings and leaves every collection and index intact; a re-`up` reapplies
// cleanly. Binary and temp pb_data discarded, not committed. Still worth a
// glance in the admin UI on the box after deploy — same caveat as
// 1756600000_create_workouts.js.

migrate(
  (app) => {
    const goals = app.findCollectionByNameOrId("goals");

    // A `global` ruleset stays readable by anyone (incl. signed-out); a `user`
    // ruleset is visible only to an *authenticated* owner.
    goals.listRule =
      'scope = "global" || (@request.auth.id != "" && user = @request.auth.id)';
    goals.viewRule =
      'scope = "global" || (@request.auth.id != "" && user = @request.auth.id)';

    // Every mutating request must be authenticated first; then a user owns their
    // own `user` rows, and an admin may write the `global` tier.
    const writeRule =
      '@request.auth.id != "" && ((scope = "user" && user = @request.auth.id) || @request.auth.admin = true)';
    goals.createRule = writeRule;
    goals.updateRule = writeRule;
    goals.deleteRule = writeRule;

    app.save(goals);
  },
  (app) => {
    // rollback — restore 1757300000_create_goals.js's original five rules
    const goals = app.findCollectionByNameOrId("goals");

    goals.listRule = 'scope = "global" || user = @request.auth.id';
    goals.viewRule = 'scope = "global" || user = @request.auth.id';

    const original =
      '(scope = "user" && user = @request.auth.id) || @request.auth.admin = true';
    goals.createRule = original;
    goals.updateRule = original;
    goals.deleteRule = original;

    app.save(goals);
  },
);
