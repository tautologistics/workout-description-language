# Next Steps

## Immediate

***The workout library* (L0–L7) is complete as of 2026-09-01** — all eight
tasks landed and the whole L-section moved to
[../tasks/completed.md](../tasks/completed.md) as one grouped section. The last
link, **L7 (`2557177`)**, surfaced the library in the apps: an **Examples**
chip row in the builder's *My workouts* panel that browses each org account's
whole public set (`crossfit` 31 / `hyrox` 9 / `tabata` 3), each row a
click-to-open detached read-only copy, plus a per-row `↗` "Open on the board"
shortcut; `listOrgWorkouts(ownerId)` in `apps/shared/pocketbase.js` against the
L1 fixed org ids. The board resolves `?w=<handle>:<slug>` end to end and shows
the namespaced id in its `#meta` strip (no separate source line — the id names
the owner). App code only; `make test` unchanged (2064/2064, 1 pending). The
epic absorbed most of the deferred account-namespacing rethink; what is left —
the board **Edit** button round-tripping into the builder — is a loose bullet
below.

**board: dismissible notifications closed 2026-09-01 (`01c0af3`)** — a
**Clear notifications** button in the board footer beside Reset, shown only
while the red `#problems` strip has content; one `setProblems()` helper in
`apps/display/board.js` is the single show/hide path, and clearing is not
permanent (the next reparse / `?w=` load / division change repopulates it).
`apps/display/` only, dark verified, `make test` unchanged (2064/2064, 1
pending).

**board: the `#` title moved into the `#meta` strip, closed 2026-09-01
(`110ed2b`)** — the `# Title` line joins the hidden preamble run
(`draw()`'s preamble test covers a `#`-line in the leading run) and shows in
the `#meta` strip as the prominent lead element, with any `@id` small and dim
in parentheses after it (`Fran (crossfit:fran)`); `dataset.line` stays 1:1 so
the cue marker still tracks the right physical lines. `apps/display/` only
(`board.js`, `board.css`, `index.html`), dark verified, `make test` unchanged
(2064/2064, 1 pending). Closes the "reversible default" question left by item
15b.

**unit defaults closed 2026-09-01 (rule 1 `6829052`, rule 2 `952c80c`)**
— the last queued standalone task. Rule 1: `@ 95` with no unit now parses to a
real `load` and `wdl fmt` rewrites it to `@ 95lb` (pound is the documented
default; `parseTarget` in `packages/core/src/units.ts`, spec §3/§7, no corpus
movement). Rule 2: a builder-only suggesting diagnostic for a bare count on a
load-less calorie machine (`15 Row` → `15cal Row`); the board is untouched.
[DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in).
`make test` 2064/2064, 1 pending.

**builder: dim/small text floored at AA + 12px, landed 2026-09-02
(`547d986`)** — a self-contained pull from
[../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
(not a queued task). The `opacity`-dimmed secondary text (palette muscle tags,
`.hint`, ~8 more) now dims by `--dim` colour, not `opacity` — AA in both themes
(`.movement .meta` light 3.4→4.9:1, dark 4.6→6.0:1) — with a 12px floor,
written as a rule (no `opacity` on body text; nothing below `.75rem`).
`apps/builder/builder.css` only, `make test` unchanged (2064/2064, 1 pending).

**builder: outline row affordances made discoverable + touch-reachable, landed
2026-09-02 (`6adba47`)** — a self-contained pull from
[../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
(not a queued task). The per-row tool strip and both carets went from
`opacity: 0`-until-hover to a persistent `opacity: .6` brightening to full on
`.node:hover` / `.node:focus-within` (`:focus-within` covered touch — no JS,
`⋮`-menu declined), tool + caret hit boxes to 32px, the tool strip wrapping to
its own row below `560px`. `apps/builder/builder.css` only; `make test`
unchanged (2064/2064, 1 pending). Closes the two open design-critique-trio
entries in that file's *Outline* section (the nesting-rails third was already
fixed `d8edde3`).

**The epic in flight is Vocabularies & editor ergonomics (V1–V9)** — from the
2026-09-02 design review of the header **Workouts** menu and the **movement
editor**. Nine staged tasks in [../tasks/current.md](../tasks/current.md), with
the decisions recorded at the top of that epic section.

**Stage A (V1 + V2) landed 2026-09-02 (`7429863`)** — the header button reads
**Workouts**, the chip row reads **Libraries**, and a chip is now sugar over the
search box (it types `<handle>:` and lets the normal debounced search run), which
retired `browseOrg` / `listOrgWorkouts` and the whole parallel browse path.

**V3 is withdrawn as of 2026-09-02 — its premise was false, and it blocked
nothing else.** It was built and reverted: `measures` on a registry entry is a
**capability set** (the units a movement *can* be measured in), not a choice —
`bike` / `row` / `skierg` correctly carry **both**, and narrowing them would
switch off `calorieUnitHints()` (rule 2, DEC-022) and drop a `»` pick. Chris
withdrew it the same day; the editor keeps its two checkboxes. Settled as
[DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)
and listed in
[../topics/deliberately-not-done.md](../topics/deliberately-not-done.md).
**Nothing is open on it.**

**Stage B (V4 + V5) landed 2026-09-02 (`10a2b8a`)** — in one commit, because V4
has no user-visible surface on its own and this repo verifies by driving the
real app. `apps/shared/token-input.js` is the reusable widget (chips +
type-ahead + a filter/select picker, **one composition at every vocab size** —
[DEC-024](../topics/settled-decisions.md#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker)),
and the movement editor's seven list fields are wired onto it over a static
`apps/shared/vocab.js`. `collect()` emits the same arrays, so the write path and
both validations are unchanged. It also carried the **caption bug** fix: a
`group()` twin of `field()` wraps every multi-input control in a `<div
role="group" aria-labelledby>`, so neither checkbox-group caption — nor any of
the seven token inputs — is bound to its first input any more. `make test`
unchanged (2064/2064, 1 pending).

**So the next work is Stage C — V6 → V7 → V8**, which makes **equipment** and
**movement patterns** a DB/API-backed vocabulary (committed
`registry/{equipment,patterns}.json` + a PocketBase migration, then fixtures +
mock `/api`, then a load script and a fetch in front of `vocab.js`'s literals,
which are already shaped to become the offline fallback). V6 starts it and wants
a **DEC** of its own, mirroring DEC-020. **Muscles stays
`registry/muscles.json`** — closed set, body-map SVG is the real limit. **V9
(inline "＋ new term" in the picker) stays optional**, after V8.

**One new self-contained item came out of V5's verification**, needing Chris to
pick between two fixes: the palette's `✎` hands the movement editor the
**canonical** merged entry rather than the curated one, so `deadlift` opens
showing equipment `Barbell` and `skierg` shows one of its two curated aliases —
and a save writes that back. Pre-existing since M5 and unchanged by V5, but
newly legible now that chips show the spelling. In
[../topics/builder-ux.md](../topics/builder-ux.md) under "The movement editor".

Also still open, needing Chris to scope: a full **laterality curation sweep**
(which movements), and the board's **Edit** button round-tripping into the
builder — the two loose bullets in [../tasks/current.md](../tasks/current.md).
Other self-contained builder-UX items remain in
[../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
(the read pane's four stacked `<h2>`s; the *Movements* palette drawer + the
flat 129-row core list).

---

<details><summary>Historical — the L0–L7 trail (kept for the record)</summary>

***The workout library* (L0–L7).** L0 landed 2026-09-01
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
shape). **L4 landed 2026-09-01 (`0de7f9a`)** — app + mock + one fixture row:
`searchWorkouts(q, {page})` in `pocketbase.js`
(`filter=(visibility="public" || owner="<uid>") && (title~"<q>" ||
wdlId~"<q>")`, `sort=-updated`, `perPage: 20`; empty `q` → `[]`; `"` stripped)
plus `getHandle(uid)` for owner labels; a debounced search box in the builder's
**My workouts** panel listing own + public hits each labelled
`mine`/`@handle`/`public`, click-to-open (own → attached, public → detached
copy); `scripts/mock-api.mjs`'s `applyQuery` grew a `~` operator + the
parenthesised OR (`matchesFilter`); `fixtures/workouts.json` gained one public
`crossfit:helen` row. `make test` unchanged (2064/2064, 1 pending); verified
driving the builder against `make serve` in both themes. **L5 landed 2026-09-01
(`6cb8df4`)** — the authored benchmark `.wdl` library, **43 files** under
`examples/workouts/<org>/<slug>.wdl`: **crossfit** (31 — the 19 Girls, 9 first
Heroes, Fight Gone Bad / Filthy Fifty / the CrossFit Total), **hyrox** (9 — the
full race + its 8 stations), **tabata** (3 — the protocol, Tabata This, Tabata
Something Else). Each is `@id <org>:<slug>` + `# Title` + body, byte-identical to
`wdl fmt` canonical output; all 43 pass `wdl check`; Fran / Murph / Fight Gone
Bad / `hyrox:race` / `tabata:this` spot-checked on the board. **Content only** —
no schema / `packages/core` / grammar / spec / test touch, `make test` unchanged
(2064/2064, 1 pending); `examples/workouts/` deliberately **not** wired into
`corpus.test.ts` (L6/L7's call). **L6 landed 2026-09-01 (`5cc9e0f`)** —
`scripts/workouts-to-db.mjs` / `make workouts:load`, twin of
`movements-to-db.mjs`: idempotent-on-`wdlId` upsert of the 43
`examples/workouts/**/*.wdl` files into the `workouts` collection as public rows
owned by the matching org account, plus regeneration of `fixtures/workouts.json`
(46 rows — 43 library + 3 preserved mock-user seed) and `fixtures/users.json`
(the three org rows), so a fresh `make serve` / prod box shows the whole library
with no manual step; `--dry-run` writes nothing; prod writes need superuser auth
(`WDL_PB_ADMIN_*`, collection defaults to `_superusers`). `make test` unchanged
(2064/2064, 1 pending); verified fresh mock → 42 created / 1 updated, re-run
clean, edit-one → 1 PATCH, board + builder end-to-end against the regenerated
fixtures. **Next is L7 — surface the library in the apps** (the builder's
*Open…* / *My workouts* area gets a way to browse an org's public set — filter
by owner handle or a small "Examples" list — and "open on the board" for any
public workout; board confirms `?w=crossfit:fran` end to end and shows the org
as source; small polish). **L7 closes the epic — move L0–L7 to
[../tasks/completed.md](../tasks/completed.md) as one grouped section.** See
[../tasks/current.md](../tasks/current.md) "## The workout library (L0–L7)".

</details>

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

**The standalone queue is empty as of 2026-09-01.** All three post-library
standalone tasks landed: `01c0af3` (board dismissible notifications), `110ed2b`
(board title-into-strip), and **unit defaults** (rule 1 `6829052` — `@ 95`
reads as `95lb`, `wdl fmt` writes the unit in; rule 2 `952c80c` — a
builder-only calorie-machine diagnostic).
[DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in).

Still needing Chris to scope: a full **laterality curation sweep** (which
movements), and the board's **Edit** button round-tripping into the builder.

Phase 2 of the movements epic (user-scoped movements) is in
[../tasks/deferred.md](../tasks/deferred.md).

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
