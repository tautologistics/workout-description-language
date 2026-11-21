/// <reference path="../pb_data/types.d.ts" />

// Puts the `users` collection's five API rules under version control and makes
// the privileged fields `admin` and `org` impossible to set from a client
// (queue task SEC-1, security audit finding C-1).
//
// Why: every other collection's rules live in a migration, but `users` ran on
// PocketBase's stock auth-collection defaults plus a box-only snapshot. On
// those defaults the update rule is `id = @request.auth.id` with no guard on
// custom fields, so a signed-in user could `PATCH` their own row
// `{ "admin": true }` and get every admin-gated write: `movements`,
// `equipment`, `patterns`, and the `global` goals tier (DEC-020 / DEC-025 /
// DEC-028). With password auth enabled and an open create rule, an anonymous
// `POST` could mint an admin outright.
//
// The rules after this migration:
//
//   list / view / delete   id = @request.auth.id
//       Only yourself. Matches what the apps already assume (`handleTaken` in
//       apps/shared/pocketbase.js is documented as best-effort for exactly this
//       reason), and what scripts/mock-api.mjs says the real rule is.
//
//   create   @request.body.admin != true && @request.body.org != true
//       Not `null`. Whether PocketBase applies the create rule when Google
//       sign-in creates a brand-new user depends on the version, and `null`
//       (superusers only) risks breaking first sign-in. Instead, any create
//       that tries to set `admin` or `org` is rejected, whichever route it
//       comes through. A direct create that sets neither still yields a plain,
//       non-privileged account. Disabling password auth on `users` would close
//       that too, but the `make *:load` scripts may sign in with a password
//       against this collection (`WDL_PB_ADMIN_COLLECTION`), so that's a
//       separate decision, recorded in the audit.
//
//   update   id = @request.auth.id
//         && (@request.body.admin:isset = false || @request.body.admin = admin)
//         && (@request.body.org:isset = false   || @request.body.org = org)
//       You may edit your own row (the apps set `handle` on first sign-in), but
//       a body that changes `admin` or `org` is rejected. Re-sending the
//       current value is allowed, so a client echoing the whole record back
//       still works.
//
// Superusers bypass collection rules, so granting admin in the admin UI
// (deploy/README.md §7a) and the superuser-authed loaders are unaffected.
// `@request.body.*` (not the pre-0.23 `@request.data.*`) is the spelling for
// the box's v0.40.1.
//
// `down` restores PocketBase's stock auth-collection rules (`id =
// @request.auth.id` for list/view/update/delete, and an open create). Those
// are what an unmodified `users` collection carries. The box's real
// pre-migration values live only in its own snapshot migration, which isn't in
// the repo.
//
// Style: edits the existing collection, the 1757400000_harden_goals_rules.js
// idiom. `findCollectionByNameOrId` -> assign the `*Rule` strings ->
// `app.save(collection)`.
//
// Verified locally 2026-11-21 against a real pocketbase v0.40.1 (darwin_arm64)
// binary and a throwaway pb_data, the M2 / G1 method. With this migration
// reverted (stock rules), both exploits worked: a signed-in user's self-PATCH
// `{admin:true}` landed, and an anonymous password sign-up with `admin: true`
// minted an admin. With it applied (`migrate up` on all eleven, exit 0):
//   - An anonymous create with `admin`/`org` set true (also as the string
//     "true" and as 1) gets 400. A plain create, or one with `admin: false`,
//     gets 200.
//   - A self-PATCH of `admin` or `org` gets 404 (the rule hides the row from
//     that write). A self-PATCH of `handle`, or one echoing `admin:false,
//     org:false` back, gets 200.
//   - A user's list sees only their own row, an anonymous list sees none, and
//     a PATCH of another user's row gets 404.
//   - A superuser can still grant admin (200). The granted admin can't clear
//     their own flag, can still edit `handle`, and can do an admin-gated write
//     (an `equipment` create, 200). A non-admin's gated write is rejected.
//   - `migrate down 1` restores the stock rules exactly, and a re-`up`
//     reapplies cleanly.
// Not covered: a real Google sign-up, since there's no OAuth provider locally.
// It sends no `admin`/`org`, so the create rule admits it either way. Binary
// and pb_data discarded, not committed.

const SELF = "id = @request.auth.id";

const NOT_PRIVILEGED_ON_CREATE = "@request.body.admin != true && @request.body.org != true";

const NOT_PRIVILEGED_ON_UPDATE =
  SELF +
  " && (@request.body.admin:isset = false || @request.body.admin = admin)" +
  " && (@request.body.org:isset = false || @request.body.org = org)";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.listRule = SELF;
    users.viewRule = SELF;
    users.createRule = NOT_PRIVILEGED_ON_CREATE;
    users.updateRule = NOT_PRIVILEGED_ON_UPDATE;
    users.deleteRule = SELF;
    app.save(users);
  },
  (app) => {
    // rollback — PocketBase's stock auth-collection rules
    const users = app.findCollectionByNameOrId("users");
    users.listRule = SELF;
    users.viewRule = SELF;
    users.createRule = "";
    users.updateRule = SELF;
    users.deleteRule = SELF;
    app.save(users);
  },
);
