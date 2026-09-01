# Next Steps

## Immediate

***The workout library* (L0–L7) is in flight. L0 landed 2026-09-01
(`b9c52f1`)** — the epic's design note, written up as
[DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it)
plus a one-sentence hosting-convention note beside spec §2's `@id` bullet.
**L1 landed 2026-09-01 (`88ab8b6`)** — the `users` migration adding `org`
(bool) + unique `handle` (text) and inserting the `crossfit` / `hyrox` /
`tabata` org rows, plus the app-side random `adjective-noun` handle assignment
(`apps/shared/handle.js` + `handle-words.js`, `ensureHandle()`), the handle
editor in the builder header, and `updateHandle` / `currentHandle()` in
`apps/shared/pocketbase.js`; mock `/api` + `fixtures/users.json` mirror;
migration up+down verified against a real PocketBase v0.40.1 binary; `make
test` unchanged (2064/2064, 1 pending). **L2 landed 2026-09-01
(`fc72881`)** — `deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js`
adds `wdlId` (text, `max: 260`, nullable) + a plain index
`idx_workouts_wdl_id` to `workouts`; no rule change, no app/mock/fixture change
(pure schema — existing rows stay `null` until L3 sets it on save / L6's loader
for the org rows); `make test` unchanged; migration up/down/up verified against
a real PocketBase v0.40.1 binary. **L3 landed 2026-09-01 (`5be4a30`)** —
app + mock only: `apps/shared/pocketbase.js` `create`/`update` now force-write
`source`'s `@id` line to `<owner-handle>:<slug>` and send `wdlId` set to the
same string (module-local `@id`/slug helper; slug from an existing `@id`, else
the `# title`, else `untitled`; re-save-stable `-2`/`-3` suffix on a same-owner
clash); new `getByAnyId(x)` resolves a `:`-bearing value as a `wdlId` else a
15-char record id with a `wdlId` fallback; `apps/display/board.js`'s `?w=` uses
it; `scripts/mock-api.mjs` mirrors (`forceWdlId` port, `wdlId` on the record
shape). `make test` unchanged (2064/2064, 1 pending); verified driving the
builder + board against `make serve`. **Next is L4 — Search: API + builder UI**
— `searchWorkouts(q, {page})` in `pocketbase.js`
(`filter=(visibility="public" || owner="<uid>") && (title~"<q>" ||
wdlId~"<q>")`, `sort=-updated`, paged), a builder search input in the
*My workouts* / *Open…* area listing own + public matches each labelled which,
click-to-open into the editor, and `scripts/mock-api.mjs` growing the `~`
(substring) operator + that one parenthesised OR shape. See
[../tasks/current.md](../tasks/current.md) "## The workout library (L0–L7)".

*Movements in the database — Phase 1 (M0–M7)* is
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
  regenerates fixtures. **L0 (DEC-021), L1 (`users` `org`+`handle`), L2
  (`workouts.wdlId` column) and L3 (force `@id`/`wdlId` on save + `getByAnyId`)
  done 2026-09-01; L4 (search) next.** This absorbs most of the deferred
  account-namespacing rethink.
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
