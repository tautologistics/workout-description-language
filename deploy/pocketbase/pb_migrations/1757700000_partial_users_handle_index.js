/// <reference path="../pb_data/types.d.ts" />

// Rebuilds the `users.handle` unique index as partial, so it constrains only
// accounts that actually have a handle (known-debts.md, "`users.handle`'s
// unique index treats every empty handle as the same value", found 2026-11-21
// while verifying SEC-1).
//
// Why: 1756900000_add_users_handle_and_orgs.js added
//     CREATE UNIQUE INDEX `idx_users_handle` ON `users` (`handle`)
// and PocketBase stores an unset text field as `''` under a NOT NULL column,
// not as NULL. So the index treated every handle-less account as the same
// value: once one `users` row had an empty handle, every further create failed
// with `handle: validation_not_unique`. That includes a new person's first
// Google sign-in, because the apps assign a handle only after the account
// exists.
//
// After this migration:
//     CREATE UNIQUE INDEX `idx_users_handle` ON `users` (`handle`) WHERE `handle` != ''
// Two real handles still can't collide, and any number of accounts can sit
// without one. `WHERE <field> = ''` / `!= ''` is the predicate
// 1757500000_add_soft_delete.js established for PocketBase's empty text
// values. `IS NULL` would match nothing.
//
// The old index is dropped by *name*, not by exact string, because the box's
// copy may have been re-serialized by PocketBase or its box-only snapshot
// migration. `down` restores 1756900000's exact plain index. If two accounts
// lack a handle when you roll back, the plain index can't be rebuilt and
// `down` fails. That's the bug coming back, and it's the honest outcome.
//
// Verified locally 2026-11-21 against a real pocketbase v0.40.1 (darwin_arm64)
// binary and a throwaway pb_data:
//   - Without this migration, a second handle-less account is rejected with
//     `handle: validation_not_unique` (the bug reproduced).
//   - With it (`migrate up` on all twelve, exit 0), the index reads back as the
//     partial form above. A second and a third handle-less account are both
//     created. A duplicate real handle, including an org's `crossfit`, is
//     still rejected.
//   - `migrate down 1` fails while three accounts lack a handle, as described
//     above. Once each has one, it restores the exact plain index, and a
//     re-`up` reapplies cleanly.
// Binary and pb_data discarded, not committed.
//
// Style: the 1757000000_add_workouts_wdlid.js / 1757500000_add_soft_delete.js
// idiom. `findCollectionByNameOrId` -> filter / push `indexes` ->
// `app.save(collection)`.

const NAME = "idx_users_handle";
const PLAIN = "CREATE UNIQUE INDEX `idx_users_handle` ON `users` (`handle`)";
const PARTIAL = "CREATE UNIQUE INDEX `idx_users_handle` ON `users` (`handle`) WHERE `handle` != ''";

function setHandleIndex(app, definition) {
  const users = app.findCollectionByNameOrId("users");
  users.indexes = users.indexes.filter((ix) => !ix.includes(NAME));
  users.indexes.push(definition);
  app.save(users);
}

migrate(
  (app) => setHandleIndex(app, PARTIAL),
  (app) => setHandleIndex(app, PLAIN), // rollback
);
