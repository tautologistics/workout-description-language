# Next Steps

## Immediate

**No epic is in flight.** *Movements in the database — Phase 1 (M0–M7)* is
**complete as of 2026-09-01** — all of M0–M7 landed and the M-section moved to
[../tasks/completed.md](../tasks/completed.md) as one grouped section. The last
link, **M6** (`97f236f`), specified the nightly VPS SQLite backup + off-box
copy in `deploy/README.md` + `deploy/pocketbase/crontab.fragment` (shell cron
`sqlite3 .backup` + 30-day prune, 03:17 UTC; off-box `rsync` pull from Chris's
machine over the `dreamhost.ae.wex` alias; PocketBase built-in backups as the
documented fallback; restore steps aligned). **It still has to be installed on
the box by Chris** (`crontab -e`, paste the line) and the first backup + first
off-box `rsync` verified by hand on the VPS — the "still to do on deploy" caveat
M1/M2/M3 also carry (admin `users` row, migrations glanced at, prod ingest run).

Everything else is closed: the whole 0-series through 21, the deployment epic
(18–20, landed 2026-08-30) and the builder layout redesign (R1–R10, landed
2026-08-31) — see [../tasks/completed.md](../tasks/completed.md).

**The next work is the loose unscheduled bullets** in
[../tasks/current.md](../tasks/current.md) after the "Open" preamble, or a fresh
session off the board:

- **The `»` panel's per-implement load token (`@ 2x`) is unclear mid-edit** —
  explicitly flagged self-contained and dispatchable now; detail in
  [../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.
- A full **laterality curation sweep** (needs Chris to scope which movements;
  run via the audit CSV, not hand-edits).
- The **post-redesign rethinks** — `@id` ↔ record-id correlation, account
  namespacing, the board's Edit button round-tripping into the builder, an
  "open on the board" action (need Chris to scope).

Phase 2 of the movements epic (user-scoped movements) is in
[../tasks/deferred.md](../tasks/deferred.md).

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
