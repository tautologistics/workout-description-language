# Next Steps

## Immediate

**No epic is in flight yet** (*The workout library*, L0–L7, is queued but
unstarted — see below). *Movements in the database — Phase 1 (M0–M7)* is
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

**The `»`-panel per-implement load-token fix landed 2026-09-01
(`00f599c`)** — the token stays `@ Nx`, its reading was fixed (reworded pick
label + a transient inline hint by the caret); see
[../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.

**One epic + three standalone tasks are queued** (all fleshed out 2026-09-01
from Chris, in [../tasks/current.md](../tasks/current.md)):

- ***The workout library* (L0–L7)** — non-interactive "org" accounts
  (`crossfit`, `hyrox`, `tabata`) owning public benchmark-WOD sets; every
  account gets an editable `handle` that namespaces its `@id`s; a
  `workouts.wdlId` column; search over own + public by name / `@id` / record
  id; authored `.wdl` library + a `make workouts:load` ingest that also
  regenerates fixtures. Start at **L0** (DEC-021 design note). This absorbs
  most of the deferred account-namespacing rethink.
- **unit defaults** — `@ 95` reads as `95lb`; a unitless magnitude on a
  machine/aerobic movement reads as calories. Spec + grammar + parser + golden
  change.
- **board: dismissible notifications** — a "Clear notifications" footer button.
- **board: the `#` title into the meta strip** — not a body row; `@id` small in
  parentheses after it.

Still needing Chris to scope: a full **laterality curation sweep** (which
movements), and the board's **Edit** button round-tripping into the builder.

Phase 2 of the movements epic (user-scoped movements) is in
[../tasks/deferred.md](../tasks/deferred.md).

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
