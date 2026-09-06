/// <reference path="../pb_data/types.d.ts" />

// Adds soft delete to the four user-facing record collections — `workouts`,
// `movements`, `movement_sets`, `goals` (queue task D1 of the *Soft delete
// across records* epic, [DEC-029]).
//
// What lands here (all schema / config — no app code, no `packages/core`):
//
//   1. A `deleted` field on each of the four collections — PocketBase `date`,
//      **nullable, no schema default**. `null` = live; an ISO-8601 timestamp =
//      soft-deleted, and the value records *when*. Chris's wording (`deleted`,
//      not `deletedAt`) — the `date` type already says it is a time. The field
//      is added by one helper over the collection list so the four cannot drift
//      (the `1757100000_create_vocab.js` `vocabCollection` idea).
//
//   2. `&& deleted = null` ANDed onto the **list and view** rules of all four
//      (DEC-029). A soft-deleted row is then invisible to *every* reader, so a
//      tombstone cannot leak through a read that forgot a clause. The
//      **create / update / delete rules are left untouched** — the owner still
//      `PATCH`es `deleted` set→timestamp (the soft-delete) and timestamp→null
//      (a restore) under the existing write rule, which does not test `deleted`.
//      The pre-D1 rule strings, verbatim from the migrations that last set them
//      (`goals` from `1757400000_harden_goals_rules.js`, the other three from
//      their create migrations), are the `oldRule` values below — `down`
//      restores them exactly.
//
//   3. The three unique natural-key indexes — `idx_movement_sets_set_id`,
//      `idx_goals_goal_id`, `idx_movements_movement_id` — rebuilt as **partial**:
//      `CREATE UNIQUE INDEX … WHERE deleted = ''`. A soft-deleted row then
//      releases its `setId` / `goalId` / `movementId`, so the client clash-check
//      (which reads the now-filtered list, never sees the tombstone) can mint the
//      same key again without hitting `UNIQUE constraint failed` at the DB.
//      `workouts.wdlId` is **already a plain, non-unique index**
//      (`1757000000_add_workouts_wdlid.js`) — nothing to do there. `down`
//      restores the plain unique form.
//
//      **Correction to DEC-029's letter.** The decision text specifies the
//      predicate as `WHERE deleted IS NULL`, assuming SQL `NULL` for a live row.
//      PocketBase does not store `NULL` in an optional `date` column — the
//      generated schema is `"deleted" TEXT DEFAULT '' NOT NULL`, and an unset
//      date is the empty string `''` (the same sentinel the API round-trips and
//      the app already treats as "no value"). `WHERE deleted IS NULL` would
//      therefore match no rows and the partial index would enforce nothing. The
//      working predicate that carries DEC-029's intent — a soft-deleted row
//      (`deleted` = an ISO timestamp) drops out of the uniqueness scope, a live
//      row (`deleted = ''`) stays in it — is `WHERE deleted = ''`, which is also
//      the form PocketBase itself emits for an optional unique field
//      (`WHERE `field` != ''`). Recorded as a correction on DEC-029 and in the
//      D1 task write-up.
//
// Style: edits *existing* collections — `findCollectionByNameOrId` →
// `fields.add(new Field(...))` / assign the `*Rule` strings / rewrite the
// `indexes` array → `app.save(collection)`, the same idiom as
// `1756700000_add_users_admin.js` / `1757000000_add_workouts_wdlid.js` /
// `1757400000_harden_goals_rules.js`. The field-add + rule-edit is one helper
// over the four; the three index rebuilds are a short explicit block (they are
// not uniform — different index and table names). `down` is the exact inverse:
// restore the three plain indexes first (they no longer reference `deleted`),
// then restore each rule pair and drop the `deleted` field.
//
// Written against the PocketBase v0.40.x JS migration API.
//
// Verified locally against a real pocketbase v0.40.1 (darwin_arm64) binary and a
// throwaway `pb_data` (the M1 / M2 / G1 method): `migrate up` applies this plus
// the nine earlier migrations cleanly (exit 0); a `deleted` (type date, required
// false, system false) field lands on all four collections and reads back empty
// for freshly created rows (checked via `sqlite3` against `_collections` and
// `PRAGMA table_info`); the four list / view rules read back with the
// `&& deleted = null` clause; the three unique indexes read back with the
// `WHERE deleted = ''` predicate (`sqlite_master.sql`), a second live row with
// the same natural key is rejected (`UNIQUE constraint failed`), and the same
// natural key is accepted once the first row carries a non-empty `deleted`;
// `migrate down 1` drops the field from all four, restores the plain
// unique indexes and the original rule strings with zero leftover `sqlite_master`
// rows, and a re-`up` reapplies cleanly. Binary and temp `pb_data` discarded,
// not committed. `make test` 2064/2064, unchanged (migration-only). Still worth a
// glance in the admin UI on the box after deploy — same caveat as
// `1756600000_create_workouts.js`.

// The four collections, each with its pre-D1 list/view rule (verbatim, from the
// migration that last set it) and the post-D1 rule with `&& deleted = null`
// ANDed on with the parenthesisation DEC-029 spells out.
const SOFT_DELETE_COLLECTIONS = [
  {
    name: "workouts",
    oldRule: 'owner = @request.auth.id || visibility != "private"',
    newRule:
      '(owner = @request.auth.id || visibility != "private") && deleted = null',
  },
  {
    name: "movements",
    oldRule: 'scope = "global"',
    newRule: 'scope = "global" && deleted = null',
  },
  {
    name: "movement_sets",
    oldRule: 'owner = @request.auth.id || visibility != "private"',
    newRule:
      '(owner = @request.auth.id || visibility != "private") && deleted = null',
  },
  {
    name: "goals",
    // Set by 1757400000_harden_goals_rules.js, not the create migration.
    oldRule:
      'scope = "global" || (@request.auth.id != "" && user = @request.auth.id)',
    newRule:
      '(scope = "global" || (@request.auth.id != "" && user = @request.auth.id)) && deleted = null',
  },
];

// The three unique natural-key indexes rebuilt as partial. `workouts.wdlId` is
// deliberately absent — it is already a plain, non-unique index.
const PARTIAL_INDEXES = [
  {
    collection: "movement_sets",
    plain:
      "CREATE UNIQUE INDEX idx_movement_sets_set_id ON movement_sets (setId)",
    partial:
      "CREATE UNIQUE INDEX idx_movement_sets_set_id ON movement_sets (setId) WHERE deleted = ''",
  },
  {
    collection: "goals",
    plain: "CREATE UNIQUE INDEX idx_goals_goal_id ON goals (goalId)",
    partial:
      "CREATE UNIQUE INDEX idx_goals_goal_id ON goals (goalId) WHERE deleted = ''",
  },
  {
    collection: "movements",
    plain:
      "CREATE UNIQUE INDEX idx_movements_movement_id ON movements (movementId)",
    partial:
      "CREATE UNIQUE INDEX idx_movements_movement_id ON movements (movementId) WHERE deleted = ''",
  },
];

// Swap one index definition string for another on an existing collection, then
// save — the `1757000000_add_workouts_wdlid.js` `indexes.filter(...)` /
// `indexes.push(...)` idiom.
const swapIndex = (app, { collection, from, to }) => {
  const col = app.findCollectionByNameOrId(collection);
  col.indexes = col.indexes.filter((ix) => ix !== from);
  col.indexes.push(to);
  app.save(col);
};

migrate(
  (app) => {
    // 1 + 2: add `deleted` and tighten the list/view rules, one helper over the
    // four so they cannot drift.
    for (const { name, newRule } of SOFT_DELETE_COLLECTIONS) {
      const col = app.findCollectionByNameOrId(name);

      col.fields.add(
        new Field({
          name: "deleted",
          type: "date",
          required: false,
        }),
      );

      col.listRule = newRule;
      col.viewRule = newRule;

      app.save(col);
    }

    // 3: rebuild the three unique natural-key indexes as partial. The `deleted`
    // column exists now (added above), so the `WHERE deleted = ''` predicate
    // resolves.
    for (const { collection, plain, partial } of PARTIAL_INDEXES) {
      swapIndex(app, { collection, from: plain, to: partial });
    }
  },
  (app) => {
    // Exact inverse. Restore the plain unique indexes first — they no longer
    // reference `deleted`, so this must precede dropping the column.
    for (const { collection, plain, partial } of PARTIAL_INDEXES) {
      swapIndex(app, { collection, from: partial, to: plain });
    }

    // Restore each list/view rule pair and drop the `deleted` field.
    for (const { name, oldRule } of SOFT_DELETE_COLLECTIONS) {
      const col = app.findCollectionByNameOrId(name);

      col.listRule = oldRule;
      col.viewRule = oldRule;
      col.fields.removeByName("deleted");

      app.save(col);
    }
  },
);
