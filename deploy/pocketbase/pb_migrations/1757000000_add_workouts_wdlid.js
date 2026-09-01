/// <reference path="../pb_data/types.d.ts" />

// Adds a `wdlId` (text, nullable, plain-indexed) field to the `workouts`
// collection (queue task L2, the *workout library* epic,
// DEC-021).
//
// Why:
//   - `wdlId` mirrors a workout's `@id` directive — `<owner-handle>:<slug>`
//     (`crossfit:fran`, `brave-otter:fran`). DEC-021 makes an account's handle
//     the `@id` namespace and forces `@id` to `<owner-handle>:<slug>` on every
//     save; this column is that same string lifted out of the source text so it
//     can be indexed, searched and resolved without parsing `source`.
//   - **L3** sets it: `apps/shared/pocketbase.js` `create`/`update` write the
//     `@id` line into `source` and send `wdlId` set to the identical value, so
//     the column and the text never disagree. `getByAnyId(x)` then resolves a
//     `:`-bearing value as a `wdlId` (`filter=wdlId="<x>"`) or a 15-char value
//     as a record id, and the board's `?w=` uses it.
//   - **L4** filters on it: search is `title ~ q || wdlId ~ q` (plus the
//     15-char record-id route).
//   - **L6**'s `workouts-to-db.mjs` loader sets it for the org library rows.
//   - Nullable, no default, no backfill: a PocketBase text field is absent /
//     empty for every existing and new record until written — exactly like the
//     `admin` (M2) and `org`/`handle` (L1) fields. Existing rows stay
//     `wdlId: null` until re-saved (L3) or loaded (L6). DEC-021: "no backfill
//     is required".
//
// No rule change — `listRule` / `viewRule` / `createRule` / `updateRule` /
// `deleteRule` on `workouts` are the item-18 visibility rules, untouched here.
//
// The index is **plain, not unique**: two different owners' workouts can carry
// the same `<slug>` (`crossfit:fran` and `brave-otter:fran` collide on `fran`
// but not on `wdlId` — the handle prefix differs), and same-owner collisions
// are disambiguated by L3's deterministic `-2` / `-3` suffix rather than a DB
// constraint. A plain index is all search (L4) and the `getByAnyId` lookup
// (L3) need. `max: 260` is a generous ceiling on `<handle>:<slug>` (handle ≤ 63
// per L1, plus a colon, plus a long slug) — not a real limit, framed the way
// `source`'s `max: 200000` comment is.
//
// Style: edits an *existing* collection, the same shape as
// 1756700000_add_users_admin.js and 1756900000_add_users_handle_and_orgs.js —
// `findCollectionByNameOrId` -> `collection.fields.add(new Field(...))` /
// `collection.indexes.push(...)` -> `app.save(collection)`; `down` reverses
// with `indexes.filter(...)` + `fields.removeByName(...)` -> `app.save`.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and
// a throwaway pb_data, all five migration files in the dir:
//   - `migrate up` -> "Applied 1757000000_add_workouts_wdlid.js" on top of the
//     four existing migrations, all clean.
//   - `SELECT fields FROM _collections WHERE name='workouts'` shows `wdlId`
//     (type text, max 260, required false, system false); `SELECT name,sql FROM
//     sqlite_master WHERE type='index' AND tbl_name='workouts'` shows
//     `idx_workouts_wdl_id` beside the existing owner / visibility indexes.
//   - `echo y | ./pocketbase migrate down 1` -> "Reverted"; `wdlId` and
//     `idx_workouts_wdl_id` both gone, owner / visibility indexes intact.
//   - `migrate up` again -> re-applies clean, `wdlId` + index back.
// Commands + output are in the L2 write-up (docs/context/current/recent-changes.md).
// Still worth a glance in the admin UI on the box after deploy — see
// deploy/README.md §7d.

const WDL_ID_INDEX = "CREATE INDEX `idx_workouts_wdl_id` ON `workouts` (`wdlId`)";

migrate(
  (app) => {
    const workouts = app.findCollectionByNameOrId("workouts");

    workouts.fields.add(
      new Field({
        name: "wdlId",
        type: "text",
        required: false,
        max: 260, // a `<handle>:<slug>` string; generous ceiling, not a real limit
      }),
    );

    if (!workouts.indexes.includes(WDL_ID_INDEX)) {
      workouts.indexes.push(WDL_ID_INDEX);
    }

    app.save(workouts);
  },
  (app) => {
    // rollback
    const workouts = app.findCollectionByNameOrId("workouts");
    workouts.indexes = workouts.indexes.filter((ix) => ix !== WDL_ID_INDEX);
    workouts.fields.removeByName("wdlId");
    app.save(workouts);
  },
);
