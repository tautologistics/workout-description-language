/// <reference path="../pb_data/types.d.ts" />

// Ownership can't be reassigned on update, and `movement_sets` creates get an
// explicit signed-in guard. Security audit M-1 (SEC-3) and L-1 (SEC-6).
//
// SEC-3: the update rules of `workouts`, `movement_sets` and `goals` checked
// *who* was writing, never *what* they set. In PocketBase a rule's plain
// field names (`owner`, `scope`, `user`) are the record as it is *before* the
// write, and `@request.body.*` is what the request sets. So an owner could
// PATCH their own row `{owner: <someone else>}`, handing it to another
// account, an org's say. Worse, a `goals` owner could PATCH a `user`-scoped
// row to `{scope: "global", user: null}` and publish into the admin-only
// global tier. Both were reproduced on a local v0.40.1 before this migration
// (see the verification below). Each update rule now also requires the body
// to leave those fields unset or unchanged. An admin may still change a
// goal's scope.
//
// SEC-6: `movement_sets.createRule` was `@request.auth.id = owner`, safe only
// because `owner` is required. That's the same shape that let anonymous
// writes into `goals` while its `user` was nullable
// (1757400000_harden_goals_rules.js). It now matches `workouts`:
// `@request.auth.id != "" && @request.auth.id = owner`.
//
// `down` restores the exact previous rule strings.
//
// Style: the 1757400000_harden_goals_rules.js idiom. `findCollectionByNameOrId`
// -> assign the `*Rule` strings -> `app.save(collection)`.

const OWNER_UNCHANGED = "(@request.body.owner:isset = false || @request.body.owner = owner)";

const OLD = {
  workouts: { updateRule: "owner = @request.auth.id" },
  movement_sets: {
    createRule: "@request.auth.id = owner",
    updateRule: "@request.auth.id = owner",
  },
  goals: {
    updateRule:
      '@request.auth.id != "" && ((scope = "user" && user = @request.auth.id) || @request.auth.admin = true)',
  },
};

const NEW = {
  workouts: { updateRule: "owner = @request.auth.id && " + OWNER_UNCHANGED },
  movement_sets: {
    createRule: '@request.auth.id != "" && @request.auth.id = owner',
    updateRule: "@request.auth.id = owner && " + OWNER_UNCHANGED,
  },
  goals: {
    updateRule:
      '@request.auth.id != "" && (' +
      '(scope = "user" && user = @request.auth.id' +
      " && (@request.body.scope:isset = false || @request.body.scope = scope)" +
      " && (@request.body.user:isset = false || @request.body.user = user))" +
      " || @request.auth.admin = true)",
  },
};

function apply(app, rules) {
  for (const name of Object.keys(rules)) {
    const col = app.findCollectionByNameOrId(name);
    for (const rule of Object.keys(rules[name])) col[rule] = rules[name][rule];
    app.save(col);
  }
}

migrate(
  (app) => apply(app, NEW),
  (app) => apply(app, OLD), // rollback
);
