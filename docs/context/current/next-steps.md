# Next Steps

## Immediate

**The active epic is *Movements in the database — Phase 1 (M0–M7)*** (Chris,
2026-08-31): move the curated `registry/movements.json` layer into a PocketBase
`movements` collection edited through an in-app widget, with ingestion in and a
reviewable dump back out; local `make serve` gets a mock `/api` from committed
fixtures so it works without PocketBase. Execution order (established 2026-08-31): **M0+M2 (DEC + admin bool, one
session) → M1 (collection) → M7 (mock API + fixtures) → M3 (ingest) → M5 (editor
widget) → M4 (dump)**; **M6 (nightly VPS DB backup cron)** is independent and
can go anytime — a pre-existing gap never set up. **M0+M2 landed 2026-08-31** (DEC-020 written;
`1756700000_add_users_admin.js` added, verified locally against a real
PocketBase v0.40.1 binary). **M1 landed 2026-08-31** (`00c29a5`):
`1756800000_create_movements.js` — the `movements` collection (one column per
curated field, `scope`/`user` for Phase 2, admin-gated writes), verified locally
against a real PocketBase v0.40.1 binary. **M7 landed 2026-08-31** (`4431683`):
`scripts/mock-api.mjs` + `fixtures/` — `make serve` now answers `/api` (auth
short-circuit, `workouts/records` CRUD from committed fixtures with git-ignored
runtime state, read-only `movements/records` from `registry/movements.json` in
the PB envelope), on by default / `WDL_MOCK_API=0` opts out. **In progress: M3**
— ingest `registry/movements.json` → the `movements` collection
(`scripts/movements-to-db.mjs`, `make movements-load`; idempotent on
`movementId`, every row `scope: "global"`). Phase 1 is global
(admin-edited) movements only; Phase 2 (user-scoped) is in
[../tasks/deferred.md](../tasks/deferred.md). Full
write-ups: [../tasks/current.md](../tasks/current.md) "Movements in the
database".

Everything before this is closed: the whole 0-series through 21, the deployment
epic (18–20, landed 2026-08-30) and the builder layout redesign (R1–R10, landed
2026-08-31) — see [../tasks/completed.md](../tasks/completed.md). The loose
unscheduled bullets (the `»`-panel `@ 2x` clarity task, a full laterality
curation sweep, the post-redesign account/ID/layout rethinks) are in
[../tasks/current.md](../tasks/current.md) after the epic section.

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
