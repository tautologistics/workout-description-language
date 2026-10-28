# Recent Material Changes

## Changes

- **2026-10-27 — `-N each round` counts down (spec §8.1).** Chris asked for
  per-round change in both directions, so a fixed-round workout can write a
  descending ladder on one step (`8 rounds for time:` / `8 Jump Squats, -1 each
  round` / `1 Burpee, +1 each round`) without moving to an `8..1:` scheme with
  `reversed`. Before this the `modifier_perRound` rule read only `+`, and `-1
  each round` was held as unrecognized text — noted, and inert. Now
  `("+" | "-") integer` in `spec/grammar-0.1.ohm`; the semantics sign the delta;
  `format` and the timeline label write `-N` back. A descent is the one change
  that can run out, so `validate` gained `per-round-below-one` (error: a
  repeat, rep scheme or `x N` interval whose last round reaches zero) and
  `per-round-unbounded-descent` (warning: AMRAP / `until failure`, naming the
  round it runs out after). *Found on the way, not fixed:* a rep run written
  before a step's movement (`- 8..1 Jump Squats`) still falls into the movement
  name with `quantity: open` and `wdl check` says ok — see known-debts; and
  `+10lb each round` in §8.1 is still illustration only (reps-only grammar).
  `make test` **2069/2069**. *Touched: `spec/grammar-0.1.ohm`,
  `spec/spec-0.1.md`, `packages/core/src/{ast,format,timeline,validate}.ts`,
  `packages/core/src/grammar/step-semantics.ts`,
  `packages/core/test/{timeline,validate}.test.ts`,
  `packages/core/test/golden/vocabulary.{ts,json}`.*

- **2026-09-03 — a leading bare `Nx` reads as reps (`10x Curl` = `10 Curl`).**
  Closes the last pending test in the suite. Spec §3's unit table has always
  listed `10x` as a rep spelling, but no implementation read it — `10x Curl`
  fell into the movement name (`quantity: open`, no registry match), exactly as
  `3x10` used to before item 0e. Chris settled it: a *leading* run of digits
  then `x` is the plain number — `10x Curl` is `10 Curl`, carrying no `sets`
  (that is `NxM`, the sets-by-reps form, which is matched first, so `10x5` is
  unaffected); a *trailing* `x3` stays a set count. `leadQuantity` in
  `spec/grammar-0.1.ohm` grew an `xReps` alternative
  (`integer "x" ~wordChar spaces`), `leadQuantity_xReps` in
  `packages/core/src/grammar/step-semantics.ts` maps it to
  `{kind:'reps', value:N}`, spec §3's "SxR before the movement" prose updated,
  and the `sets-by-reps :: 10x Curl` vocabulary golden was re-pinned to the
  correct reading with its `KNOWN_WRONG` entry removed. A trailing bare `10x`
  (`Curl 10x`, no movement after) is still left in the name — degenerate, out
  of the leading-position scope. No corpus movement uses `10x`, so
  `interpretations.json` / `registry/workouts.canonical.json` did not move.
  `make test` **2064/2064, 0 pending** (was 1). *Still open (Chris deferred):
  whether the leading `NxM` spelling should be the canonical `format` output —
  the semantic is confirmed, the output spelling is not.* *Touched:
  `spec/grammar-0.1.ohm`, `spec/spec-0.1.md`,
  `packages/core/src/grammar/step-semantics.ts`,
  `packages/core/test/{vocabulary.test.ts, golden/vocabulary.ts,
  golden/vocabulary.json}`.*

- **2026-09-03 — goals-rules hardening migration written and deployed
  (`1757400000_harden_goals_rules.js`, commit `080a924`).** The follow-up to the
  gap G4 surfaced:
  G1's `goals` rules had no `@request.auth.id != ""` guard, and `goals.user` is
  a nullable relation, so an unauthenticated `POST` of `{scope:"user"}` with no
  `user` field satisfied `scope = "user" && user = @request.auth.id` (`"" = ""`)
  and landed an ownerless `user`-scoped row; the list/view rule had the same
  hole for reads. This edits the *existing* collection's five rules (the
  `add_users_admin.js` idiom) to the guarded forms — list/view
  `scope = "global" || (@request.auth.id != "" && user = @request.auth.id)`,
  create/update/delete
  `@request.auth.id != "" && ((scope = "user" && user = @request.auth.id) || @request.auth.admin = true)`.
  A superuser bypasses rules so `make goals:load` is unaffected; a `users` admin
  row is authenticated so the `global`-tier admin write still works. `down`
  restores G1's five strings verbatim. Verified up/down/up against a real
  pocketbase v0.40.1 (darwin_arm64) binary + throwaway `pb_data`: `migrate up`
  applies all nine migrations cleanly, the five rules read back guarded,
  `migrate down 1` restores the exact G1 strings, a re-`up` reapplies.
  README entry added; DEC-028 carries a `*Fixed 2026-09-03*` note with the
  guarded forms as the settled rules. **Applied on prod 2026-09-03
  (`make deploy:db`)** — the five live `goals` rules read back guarded, and the
  anonymous ownerless `{scope:"user"}` `POST` now returns `400 "Failed to create
  record"` with no row (PocketBase's shape for a guest failing a non-null rule,
  not `403` — the same response it already gave an anonymous `scope: "global"`
  write; before the fix this exact request returned `200` and created a row).
  The 3 `global` rows are unaffected.

- **2026-09-03 — G4 shipped (`6d8a9b5`): the goals database is live on prod and
  the G0–G4 epic is closed.** Deploy + `docs/context/**` only — no other repo
  diff (the migration is G1's, the loader G3's, the client G2's); the analogue
  of S4's deploy half, with no S4-style UX pass (DEC-028). **`make deploy:db`**
  rsynced all eight migrations to the VPS and restarted PocketBase;
  `1757300000_create_goals.js` applied — `goals` is live on the prod API (`GET
  …/goals/records` → `200`, was `404`), all seven fields + both indexes + the
  DEC-028 rules confirmed with admin auth. **`make goals:load`** against prod
  (`_superusers` creds from `.env`) created **3** `scope:"global"` rows
  (`wdl:ramp-the-pull` / `wdl:ramp-the-squat` / `wdl:rotate-muscles`), an
  idempotent re-run all-`unchanged`, each row's `source` byte-identical to its
  `examples/goals/*.wdlg`. **`make deploy`** shipped the static apps (suite
  **2064/2064, 1 pending** first) — served `apps/shared/{pocketbase.js,
  goals-store.js}` + `apps/builder/builder.js` byte-identical to `origin/main`;
  the live editor's Global optgroup fetches the three rows from the prod `/api`.
  A signed-in Save round-trip was **not** driven on prod (Google OAuth, no
  interactive prod sign-in) — it rests on G3's mock round-trip + the
  byte-identical JS. The whole **## The goals database (G0–G4)** section moved
  from `tasks/current.md` to `tasks/completed.md` as one grouped block, the way
  the M / L / V / S epics closed. **Open for Chris (found while verifying, not a
  regression):** the `goals` create rule has no `@request.auth.id != ""` guard,
  so an anonymous `POST` of an ownerless `{scope:"user"}` row succeeds (`user =
  @request.auth.id` is `"" = ""`); narrow — a `global` row or one attributed to
  a real uid is `400`, so collection spam not escalation — but a gap
  `movement_sets` / `workouts` don't have, fixed by a follow-up migration + a
  DEC-028 correction. Both probe rows deleted; prod holds exactly the 3 `global`
  rows. `make test` **2064/2064, 1 pending — unchanged**.

- **2026-09-03 — G3 shipped (`1a7252f`): `goals` is behind the local `/api`,
  `make goals:load` ingests the `global` tier, and the signed-in round-trip is
  verified end to end.** G3 of the goals database epic (G0–G4) — `scripts/**` +
  `.gitignore` + `apps/shared/goals-store.js` (the `GOAL_FILES` reconciliation),
  no migration / builder / `packages/core` change; the analogue of S3 for the
  sets epic. **`scripts/goals-to-db.mjs`** / **`make goals:load`** is the
  `vocab-to-db.mjs` twin: a no-deps idempotent upsert of `examples/goals/*.wdlg`
  into `goals` as `scope: "global"` rows keyed on `goalId` (`wdl:<file-basename>`
  — the basis that matches G2's offline fallback with no change to it),
  `POST` / `PATCH`-changed-only, `--dry-run`, `--api` / `WDL_PB_URL`, prod auth
  identical to `movements-to-db.mjs` (default collection `users`, the `global`
  write rule being `@request.auth.admin = true`). It regenerates **no fixture**
  and there is **no `make goals:dump`** — the vocab call, not the workouts one:
  the mock derives the `global` rows from the same committed `.wdlg` files at
  boot, so a `fixtures/goals.json` would only be a second copy to keep in step.
  **`scripts/mock-api.mjs`** grew a `goals/records` handler on the vocab scope
  model (a `scope` column + nullable `user`, not `makeVocab`): list envelope via
  `applyQuery` / `listEnvelope`, `/records/:id` by synthetic id or `goalId`,
  scope-gated reads (`scope = "global" || user = caller`), `Authorization`-gated
  writes (`user` rows owner-only, `global` rows admin-only), the unique `goalId`
  index as a 400 `validation_not_unique`, an overlay on git-ignored
  `fixtures/goals.local.json` keyed by record id. The **`GOALS`-const 2-vs-3**
  is reconciled — `ramp-the-squat.wdlg` is canonical (DEC-028's G0 write-up
  already names all three; the const just never got it), added to
  `goals-store.js`'s `GOAL_FILES`. **Verified** driving `make serve` signed in
  (Global optgroup from `/api`, no fallback warning; Save → a `scope:"user"` row
  with `goalId` `solid-geode:my-rules`; reload persists; Delete tombstones; sign
  out drops the Saved group; the "Against your goals" panel evaluates a
  `/api`-sourced global ruleset unchanged), by `curl` (fetch by `goalId` and by
  synthetic id; `source` byte-identical to each file; 403 unauth POST, 400
  duplicate/collision, 404/200 read gate), with `WDL_MOCK_API=0` (Global still
  from the bundled files, the expected `goals: no /api rulesets …` warning), and
  `make goals:load` against the mock (first run all `unchanged`, `--dry-run`
  clean, an edited `.wdlg` → 1 `updated`). `make test` **2064/2064, 1 pending —
  unchanged**. Next: G4 (`make deploy:db` + `make goals:load` against prod +
  `make deploy`, then close the epic).

- **2026-09-03 — G2 shipped (`2512c23`): saved goal rulesets are rewired onto
  the `goals` collection; the builder no longer touches
  `localStorage['wdl.goals']`.** G2 of the goals database epic (G0–G4) — app
  code only (`apps/shared/pocketbase.js`, `apps/shared/goals-store.js` new,
  `apps/builder/builder.js`), no migration / mock / fixture / core change, the
  analogue of S2 for the movement-sets epic. **`pocketbase.js`** grew a `goals`
  block beside `movement_sets`: `listGlobalGoals` (`filter=scope="global"`,
  `sort=goalId`, `perPage=1000`), `listMineGoals` (`filter=user="<uid>"`, `[]`
  signed out), `getGoalByAnyId` (record id or `goalId`), `createGoal` (always
  `scope:"user"`, `user` = caller, `goalId` = `forceGoalNamespace(title)`),
  `updateGoal` (re-slugs `goalId` on a title change), `removeGoal`, and the
  exported `forceGoalNamespace` — a small parallel helper over the
  `disambiguateNamespace` S2 already factored out, mirroring `forceSetNamespace`.
  **`goals-store.js`** (new, host-agnostic like `sets.js`) is the in-memory
  model: `globals()` / `mine()` caches, `loadGlobal` / `loadMine` / `clearMine` /
  `get` and `create` / `update` / `remove` wrappers, with a **bundled offline
  fallback for the `global` set** in the exact `vocab.js` `muscleIds()`
  fetch-then-`.catch`-to-bundled shape (fetch `examples/goals/*.wdlg`, shape each
  `{ goalId:'wdl:'+slug, title:<goals: header>, source }`, null the cached
  promise on failure); the `GOALS`-const 2-vs-3 stays G3's to reconcile. **The
  builder** deletes `savedGoals` and both `localStorage.setItem('wdl.goals')`
  writers and the module-top `const GOALS`; the picker's **Examples** optgroup
  becomes **Global** (fed from the store, offline-fallback to the bundled files)
  and **Saved** is fed from `listMineGoals()` and rendered only when signed in;
  Save takes the ruleset name from `parseGoals(source).title` (no `prompt()`),
  is signed-in only, PATCHes the same-title row or POSTs a new one, and rolls
  the optimistic row back + shows the failure in `#goal-errors` (never silent);
  Delete → `removeGoal`; Download unchanged. **Verified** driving `make serve`
  signed out + signed in (mock `admin`) + `WDL_MOCK_API=0`, light + dark: Global
  populates from the bundled files (the `goals/records` route 404s until G3 —
  console warns like `muscleIds()` does), no Saved group signed out, a signed-in
  Save POSTs `scope:"user"` + `goalId` `ideal-trail:my-test-ruleset` and the
  no-route 404 rolls the optimistic picker entry back with the error inline, the
  "Against your goals" panel evaluates a picked ruleset unchanged. `make test`
  **2064/2064, 1 pending — unchanged**. Next: G3
  (`scripts/goals-to-db.mjs` + `make goals:load` + `scripts/mock-api.mjs`
  `goals/records` handler + `fixtures/goals*.json` + the signed-in round-trip
  end to end).

- **2026-09-03 — G1 shipped (`1a99448`): the `goals` collection is now
  schema.** G1 of the goals database epic (G0–G4) — pure schema, no app / mock /
  fixture / loader / core change.
  `deploy/pocketbase/pb_migrations/1757300000_create_goals.js` creates the
  `goals` collection per DEC-028 on the **vocab scope model** (not the
  `workouts` pattern S1 took for `movement_sets`): `title` (text, required),
  `goalId` (text, required) + unique index `idx_goals_goal_id`, `source` (text,
  required, `max: 200000` — the `workouts.source` shape), `scope`
  (`select global|user`, required) + plain index `idx_goals_scope`, `user`
  (relation → `users`, **nullable**, cascade-delete — the vocab style, not
  `movement_sets`'s required `owner`), `created` / `updated` autodate. Rules:
  read `scope = "global" || user = @request.auth.id`; create/update/delete
  `(scope = "user" && user = @request.auth.id) || @request.auth.admin = true`.
  `down` drops the collection in one step. Verified **up / down / up** against a
  real pocketbase **v0.40.1 (darwin_arm64)** binary + throwaway `pb_data` (the
  M1 / L1 / V6 / S1 method): all eight migrations apply cleanly; the collection
  lands with all seven fields and both named indexes (`sqlite3` against
  `_collections` / `sqlite_master`); a duplicate `goalId` is rejected (`UNIQUE
  constraint failed: goals.goalId`); the `user` relation resolves to
  `_pb_users_auth_` and is nullable (a `scope: "global"` row with no `user`
  inserts fine); `migrate down 1` drops `goals` with zero leftover
  `sqlite_master` rows and leaves `movements` / `workouts` / `users` /
  `movement_sets` / `equipment` / `patterns` and their indexes intact; a re-`up`
  reapplies. Entry added to `deploy/pocketbase/pb_migrations/README.md`. **Not
  yet applied on the VPS** — `make deploy:db` lands it at G4. `make test`
  **2064/2064, 1 pending — unchanged** (the core suite does not cover
  migrations). Next: G2 (`apps/shared/goals-store.js` + `pocketbase.js` CRUD +
  builder rewire off `localStorage['wdl.goals']`).

- **2026-09-03 — S4 shipped (`6ead525`): the movement-sets dialog reworked,
  prod deployed, and the S0–S4 epic closed.** Final task of the *movement-sets
  database* epic — `apps/builder/{builder.js,builder.css,index.html}` only, **no
  model change** (S2 landed it), nothing in `packages/core` / grammar / spec /
  migration / mock / fixture, `sets.js` / `pocketbase.js` untouched, `movements`
  still an ordered id array. **The dialog rework:** the `#repertoire` section
  moved to the **top** of the palette modal (above the movement search), so a set
  being composed is the subject and the search below it reads as "add movements
  to this set" (the `#search` placeholder switches to *Add movements to "<name>"*
  while composing, and the composed card floats to the top of `#set-list` with an
  accent border). The **set card is a stable grid** — name ellipsises, count in
  its own right-aligned column, the action cluster (`＋` compose / `⊕`
  add-showing / `↧` to-outline / `✎` rename / `✕` delete) lined up straight down
  the list with ≥1.6rem hit targets; the movement list is a numbered `<ol>` with
  a fixed reorder/remove column. A **read-only library set is visibly distinct** —
  recessed `color-mix` ground, dimmed name, a `LIBRARY` pill. The tools are one
  hierarchy: `New set` / `Save showing` primary, `Import` · `Export` a low-key
  link pair (DEC-027's call on the carrier's prominence). **Verified** driving
  `make serve` signed in, light + dark, at 1440 / 900 / 820 / 400px: create /
  compose (one coalesced PATCH) / reorder / remove / rename (`setId` re-slugged) /
  `↧` / `⊕` / delete all work; no console errors; no clipping or horizontal
  overflow inside the modal's scroll container. **Deployed:** `make deploy:db`
  applied the S1 migration on the VPS (API healthy), `movement_sets` is live on
  the prod API (`200`, `totalItems: 0` — nothing ships v1); `make deploy` pushed
  the static apps (served builder + shared assets byte-identical to `origin/main`).
  **The whole S0–S4 section moved to
  [../tasks/completed.md](../tasks/completed.md)** as one grouped section (the
  M / L / V precedent); `what-exists.md` / `deferred.md` / `next-steps.md`
  updated. `make test` **2064/2064, 1 pending — unchanged**. **The
  movement-sets epic is closed; the next scoped `localStorage` → PocketBase epic
  is the goals database (G0–G4).**

- **2026-09-03 — S3 shipped (`7e18879`): `movement_sets` is now behind the
  local dev mock `/api`, with a committed fixture seed; the signed-in round-trip
  is verified end to end.** S3 of the movement-sets database epic (S0–S4) —
  `scripts/**` + `fixtures/**` + `.gitignore` only, no `apps/**` / core / migration
  change. **`scripts/mock-api.mjs`** gained a `movement_sets/records` handler
  built in the `workouts` mould (not a `makeVocab` instance — sets have an owner,
  a read gate, a `setId` uniqueness rejection and a handle-prefix rewrite): the PB
  list envelope via the shared `applyQuery` + `listEnvelope`; `/records/:id` by
  synthetic id **or** `setId`; a **read gate** (`visibility != "private" || owner
  == caller`) on list + single GET; `POST` / `PATCH` / `DELETE` behind the
  `Authorization` gate (**403**) and **owner-only** (403 on the wrong owner); the
  unique **`setId`** index enforced as a **400 `validation_not_unique`** on a
  create or a rename that collides; writes overlay onto git-ignored
  `fixtures/movement-sets.local.json`. The shared filter matcher learned
  `field!="value"` (the operator `listPublicSets` emits). **`fixtures/movement-sets.json`
  (committed)** seeds two `user`-scoped chris sets + one `org-library` `crossfit`
  set. **Handle wrinkle:** `u_mock_chris_0001` has no handle at rest, so the chris
  seed rows carry a `chris:` placeholder `setId` prefix and `withOwnerHandle`
  rewrites it to the owner's current handle on read (the `forceWdlId` philosophy,
  on read) — `users.json` untouched so the L1 random-handle exercise still runs.
  **Verified** the full round-trip on `make serve` signed in: create / compose
  (a 5-click burst coalesced to one PATCH) / reorder / remove / rename (`setId`
  re-slugged) → `curl` confirms `setId` + ordered `movements`; reload persists;
  `↧` splices; delete tombstones; single-record fetch by `setId` and by id;
  read gate 404s a private set for an anon caller; unauth `POST` 403; duplicate
  `setId` 400; sign-out hides the "Sets" section, sign-in restores it. `make test`
  **2064/2064, 1 pending — unchanged**. **Next: S4** — the create/edit dialog UX
  rework, then `make deploy:db` + `make deploy`, then close the S0–S4 epic.

- **2026-09-03 — S2 shipped (`4b3b796`): movement sets now read/write the
  `movement_sets` collection; `localStorage['wdl.sets']` retired.** S2 of the
  movement-sets database epic (S0–S4) — app code only, no migration / mock /
  fixture / core change.
  **New `apps/shared/sets.js`** — a host-agnostic model (no DOM, no `window`,
  like `vocab.js`): an in-memory cache with `load()` / `list()` / `clear()` /
  `get()` / `create` / `rename` / `setMovements` / `remove`, each write a thin
  wrapper over `pocketbase.js` that refreshes the cache.
  **`apps/shared/pocketbase.js`** gained a `movement_sets` block beside
  `workouts`: `listMineSets` / `listPublicSets` / `getSetByAnyId` (record id
  *or* `setId`, the `:` discriminator) / `createSet` (forces `visibility:
  "private"` + `owner` + `setId`) / `updateSet` (re-slugs `setId` on a `name`
  change) / `removeSet` / the exported `forceSetNamespace(name, excludeId)`.
  The `-2`/`-3` suffix loop was factored out of `namespacedId` into a shared
  pure `disambiguateNamespace`; the rest of the workout rule did not generalise
  (a set has no `@id`/title fallback) so `forceSetNamespace` is a small parallel
  helper.
  **`apps/builder/builder.js`** — `let sets = JSON.parse(localStorage['wdl.sets']
  …)` and `saveSets()` deleted; `renderSets` / `renderSetList` / `renderSetCard`
  / `composing` / `addSetToOutline` / the drag-onto-card handler / the
  `#set-file` Export-Import rewired onto the model. Cards key on the record
  `id`. The `#repertoire` section **and** `#set-pick` are hidden unless signed
  in; a non-owned (`org-library` / another person's public) set renders
  read-only. Movement-list edits go through a per-set trailing-edge debounce so
  a compose session is one PATCH. Import now creates one new set per file entry.
  **Signed-in-only, no `localStorage` fallback** (DEC-027).
  **Verified:** every `pocketbase.js` call read against the S1 migration's field
  list; signed-out `make serve` shows the palette modal with **no "Sets"
  section and no `#set-pick`**, no console errors; `make test` **2064/2064, 1
  pending — unchanged**. The signed-in round-trip waits on **S3**'s mock (not
  faked here). Next: S3 — `movement_sets` mock `/api` + `fixtures/movement-sets.json`
  + drive the round-trip on `make serve`.

- **2026-09-03 — S1 shipped (`91e20d5`): the `movement_sets` collection is now
  schema.** S1 of the movement-sets database epic (S0–S4) — pure schema, no app
  / mock / fixture / core change.
  `deploy/pocketbase/pb_migrations/1757200000_create_movement_sets.js` creates
  the collection per
  [DEC-027](../topics/settled-decisions.md#dec-027-movement-sets-are-a-pocketbase-collection-on-the-workouts-pattern-localstoragewdlsets-is-retired):
  `owner` (relation → `users`, required, cascade-delete), `name` (text), `setId`
  (text, **unique index** `idx_movement_sets_set_id`), `movements` (json —
  ordered id array), `visibility` (`select private|unlisted|public`, required —
  the `workouts` field verbatim), `description` (text, optional — carried now
  against a later migration), `created` / `updated` autodate; plain
  `idx_movement_sets_owner` on `owner`. Rules are the `workouts` rules
  (list/view `owner = @request.auth.id || visibility != "private"`,
  create/update/delete `@request.auth.id = owner`). **No `scope` column** —
  scope is derived from `owner` + `visibility`. `down` drops the collection in
  one step. **Wrinkle (in the file header):** PocketBase's `select` field has no
  per-field default in the v0.40.x migration API, so DEC-027's "default
  `private`" is a **client contract** (S2's `createSet()`), exactly as
  `workouts` does it — not a schema default; no `onRecordCreate` hook was added,
  to stay on the `workouts` pattern. Verified **up / down / up** against a real
  pocketbase v0.40.1 (darwin_arm64) binary + throwaway `pb_data`: all seven
  migrations apply cleanly, the collection lands with all eight fields and both
  indexes (`sqlite3` against `_collections` / `sqlite_master`), the unique index
  rejects a duplicate `setId`, the `owner` relation resolves to `users`,
  `migrate down 1` drops it with zero leftover `sqlite_master` rows and leaves
  `movements` / `workouts` / `users` / `equipment` / `patterns` + their indexes
  intact, a re-`up` reapplies. Entry added to
  `deploy/pocketbase/pb_migrations/README.md`. **Still to do on deploy (Chris):**
  **not yet applied on the VPS** — `make deploy:db` lands it at S4 (or whenever
  Chris next deploys); same caveat M1 / L1 / V6 carry. `make test` unchanged
  (2064/2064, 1 pending — the core suite does not cover migrations). S2 (the
  `apps/shared/sets.js` model + `pocketbase.js` CRUD + builder rewire off
  `localStorage['wdl.sets']`) is next.

- **2026-09-02 — DEC-027 settled (`9f82f5f`, docs-only): movement sets become a
  `movement_sets` PocketBase collection; `localStorage['wdl.sets']` retired.**
  S0 of the movement-sets database epic (S0–S4) — the design/DEC task, no code.
  [DEC-027](../topics/settled-decisions.md#dec-027-movement-sets-are-a-pocketbase-collection-on-the-workouts-pattern-localstoragewdlsets-is-retired)
  is written in full in `topics/settled-decisions.md` (after DEC-026) with an
  index entry in `decisions.md`. **What it fixes for S1 — the collection
  contract:** `movement_sets` with `owner` (relation → `users`, required,
  cascade), `name` (text, required), `setId` (text, required, **unique index** —
  the `<owner-handle>:<slug(name)>` namespaced key, the `workouts.wdlId` analog),
  `movements` (json, ordered array of registry ids), `visibility`
  (`private|unlisted|public`, required, default `private`), `description` (text,
  optional — carried now against a later migration), the two autodates; rules
  are the `workouts` rules (list/view
  `owner = @request.auth.id || visibility != "private"`, owner-only
  create/update/delete), `down` drops the collection. **Two scopes only —
  `org-library` and `user`, with no `scope` column:** scope is derived from the
  owner (an L1 org row vs a person) plus `visibility`, exactly as for `workouts`;
  there is no `global` tier (the one difference from DEC-025's vocab layer — a
  set is always attributable to its maker, so nothing is ownerless). **`setId` is
  forced on every create *and* update like `workouts.wdlId` (DEC-021), with a
  `-2`/`-3` suffix on a same-owner clash, and re-slugged on rename** (Chris's
  explicit call — mirror workouts, do not freeze it) — so a set inherits the
  handle-rename staleness debt now recorded in `topics/known-debts.md` alongside
  the workout `@id` case. **`localStorage['wdl.sets']` is retired with no
  migration** (zero rows to carry); sets become **signed-in-only** (the palette
  modal's "Sets" section hidden when signed out) with **no `localStorage`
  fallback**. **Nothing ships at v1** — no `registry/movement-sets.json`, no
  `make sets:load`, no authored first-party sets. The `movement-sets.json`
  export/import carrier stays: DEC-027 **reopens** the "file format for palette
  'sets'" Non-Goal in full (a "Corrected 2026-09-02." paragraph added to
  `topics/deliberately-not-done.md`). Sibling epic: the goals database (DEC-028,
  G0–G4) promotes `localStorage['wdl.goals']` on the vocab pattern with a
  `global` scope. **Docs-only — `make test` not run and not claimed** (nothing it
  covers moved); anchor check over `docs/context/**.md` clean. S1 (the migration)
  is next.

- **2026-09-02 — N3 shipped (`fecf6b3`): the board's *Edit* button round-trips
  into the builder.** The board footer's *Edit* button used to call
  `showEmpty()` — drop the hash/query and reload the board to its empty
  paste-box. It now reads **"Edit in builder ↗"** and opens `../builder/?w=<key>`
  in a new tab, where `<key>` is the workout's `wdlId` (`<handle>:<slug>`) if it
  has one, else its 15-char record id — exactly `openHitOnBoard`'s choice, in
  reverse. It is `hidden` unless the board is showing a workout resolved from
  `?w=` (a module-local `editKey`, cleared by every `load()`, re-set by a
  `loadShared` that got a record); a raw `#<source>` paste board has no button.
  `showEmpty()` retired with its only caller. **The builder now honours
  `?w=<id|handle:slug>` on load** — the bootstrap reads
  `new URLSearchParams(location.search).get('w')` and, inside the
  `refreshAuth().then()` so `currentUser()` is known, `await getByAnyId(w)` and
  loads the row through a **reusable `openRecord(rec, mine)`** helper factored
  out of `openFoundWorkout`: the signed-in user owns it (`rec.owner ===
  currentUser()?.id`) ⇒ **attach** (`openWorkout` set, Save `PATCH`es that row);
  otherwise ⇒ **detached editable copy** (`openWorkout = null`, first Save
  `POST`s a new row re-namespaced to the viewer's handle — the DEC-021 copy
  flow, no fork concept). A failed fetch degrades to a `console.warn` + the
  default buffer; `?w=` is left untouched in the address bar so a reload
  re-loads the same row in the same attach state. No `&division=` — the builder
  shows both sides of a split by decision and would ignore it.
  Files: `apps/display/{index.html, board.js}` + `apps/builder/builder.js`
  (`board.css` untouched — the footer already `flex-wrap`s and `#edit` uses
  generic `button` styling). **No `packages/core` change.** `make test`
  **2064/2064, 1 pending** — unchanged (app code; the core suite does not cover
  it). Verified driving `make serve` signed in as the mock `admin: true` user:
  an owned workout (`?w=wk_mock_gtg_000001`) round-trips **attached** (panel
  *Save* + *Save as copy* + sharing row, no "read-only copy" note) and Save
  `PATCH`ed the same record (workout count unchanged at 4); a public library
  workout (`?w=crossfit:fran`) opens a **detached** copy ("Save to my
  workouts", the read-only note) and the first Save `POST`ed a **new**
  `fresh-dune:fran` row owned by the mock user — `crossfit:fran` was **not**
  `PATCH`ed; a raw `#<source>` board shows no Edit button; `?w=` (a record id
  and a `<handle>:<slug>` both) survives a builder reload with the right attach
  state and the URL never expands into the `#<source>` hash; a bogus `?w=` →
  `console.warn` + default buffer, builder stays up; the board's division
  picker / Reset / footer layout are unaffected, verified at a normal width and
  375px (footer wraps, the button on its own row, no clipping); dark only (the
  board has no light theme); no console errors. **With N1 + N3 landed and N2
  void, the three-task set is closed and the actionable self-contained coding
  queue is empty** — what remains is the deferred sets-model + palette-browse-UX
  reworks, the laterality curation sweep (Chris's manual step), and the deferred
  security audit.

- **2026-09-02 — N2 (palette-drawer redesign) investigated, premise stale,
  nothing shipped.** A session picked N2 up, read `apps/builder/{index.html,
  builder.css,builder.js}` and drove `make serve` at 1440px: the "permanent
  ~24% Movements column with no way to dismiss it" the brief targets **does not
  exist**. The palette is `<dialog id="palette-modal">` — a centred modal opened
  by ⌘K / "＋ movement", closed by ✕ / Esc / backdrop, costing zero layout width
  when closed. `.sheet` is a two-track grid (editor · splitter · analysis
  margin, `builder.css:161`); the `@media` rules only narrow/stack that margin,
  never the palette (`builder.css:661`). **R1 (`758dff1`, 2026-08-30)** turned
  the old docked column into an overlay drawer behind a `☰` toggle +
  `wdl.palette-open` `localStorage`; **R7 (`d1a89ce`, 2026-08-31)** then deleted
  the drawer, the `☰` toggle and that persistence for the summoned dialog — so
  N2-as-briefed would revert R7. Third entry from the 2026-08-30 design-critique
  pass to be stale-the-day-written (read-pane scroll, header control row were
  the first two, both already struck as done-by-R1). **No code touched.**
  `make test` **2064/2064, 1 pending** (checked, unchanged — nothing to change).
  `tasks/current.md` N2 section struck + flagged `**Open for Chris:**` with the
  full source trace and the "## Open" preamble updated; `builder-ux.md`
  **## Layout** entry struck with the finding. **Next actionable queue item is
  N3** (board *Edit* round-trip — premise still valid). N3 chip **not** spawned:
  the chain's premise check just failed once, so the call on what (if anything)
  N2 becomes, and whether to proceed to N3, is Chris's.

  *Follow-up same day, Chris ruled:* **N2 confirmed VOID** (obsolete premise —
  the palette has been a modal since R1/R7). Its two nominal follow-ons: the
  **read-pane four-`<h2>`s item is declined** (Analysis = Body + Against your
  goals, Reads-as = two items — nothing to collapse); the **flat 129-row palette
  list is deferred** ([tasks/deferred.md](../tasks/deferred.md)) pending the
  curation sweep (which grows the core set a lot) + a dedicated browse-UX
  review, *not* a quick `renderPalette` grouping. Separately, Chris flagged the
  **movement-"sets" feature for a model + UX rework** — captured in
  `deferred.md`: sets live only in `localStorage['wdl.sets']` today (no
  collection), and he wants them DB-backed, namespaced (`<handle>:<slug>`),
  scoped (global / org-library / personal) on the workouts pattern, with a
  reworked create/edit dialog (set on top, search below; card formatting is
  broken). This reopens the "file format for palette sets" Non-Goal
  ([topics/deliberately-not-done.md](../topics/deliberately-not-done.md)).
  **N3 (board *Edit* round-trip) is the one self-contained coding task left in
  the queue and is being launched now.** Docs-only commit for all of the above.

- **2026-09-02 — N1 / V9 shipped (`2a534b6`): an admin "＋ new term" row in the
  token-input picker.** A curator mints a global equipment / movement-pattern
  term without leaving the movement editor. `createTokenInput` gained an
  `onCreateTerm` opt — when the host passes one, the filter/select picker grows
  one row (normal flow, above the checklist, DEC-024 intact) offering to create
  the typed term when it folds to no known one; clicking it slugs the text
  ([DEC-026](../topics/settled-decisions.md#dec-026-the-inline--new-term-slugs-by-lowercase--trim--collapse-whitespace-keeping-typed-hyphens):
  lowercase + trim + collapse whitespace, typed hyphens kept), adds it to the
  live vocabulary and picks it **optimistically**, then awaits the host; a
  rejection rolls the add back, keeps the typed text, shows the reason inline.
  `dbVocab()` closures in `apps/shared/vocab.js` gained a **`.reset()`** (drops
  the cached promise); `builder.js` calls it after the `POST` so the *next*
  editor open re-fetches. `createEquipmentTerm` / `createPatternTerm` in
  `pocketbase.js` (POST `{ termId, name, synonyms: [], scope: 'global' }`, the
  twin of `createMovement`). `movement-editor.js` forwards an `onCreateTerm`
  option keyed by field name; `builder.js` wires `equipment` / `pattern` only,
  gated on `currentUser()?.admin`. `apps/shared/{token-input,vocab,pocketbase,
  movement-editor}.js` + `apps/builder/{builder.js,builder.css}`; **no
  `packages/core` change**. `make test` **2064/2064, 1 pending — unchanged**.
  Drove `make serve` signed in: added terms in both pickers (chip + pickable
  option + `collect()` array shape unchanged), `curl` confirmed `scope:
  "global"`, they survived a server restart and showed in a fresh editor open
  (cache-bust working); muscles picker still has no row; signed out the row is
  gone; a forced 403 and the server's real no-auth 403 both roll back with the
  message inline. **Light + dark + 768px** — the row is in normal flow, not
  clipped by the modal scroll container. No console errors. This closes the
  **V1–V9 epic**. `tasks/current.md` (V9 struck, N1 marked done),
  `next-steps.md`, `what-exists.md`, `builder-ux.md`, `settled-decisions.md` +
  `decisions.md` (DEC-026) updated.

- **2026-09-02 — next builder-UX queue set by Chris: N1 V9 → N2 palette-drawer
  redesign → N3 board Edit round-trip.** After the two dispatchable
  design-critique items turned out already-done by the R1 redesign, Chris named
  the concrete next work. **V9** (inline "＋ new term" in the token-input picker)
  is **no longer optional** — "I definitely want that". The **board Edit
  round-trip** into the builder is promoted from a loose bullet — "that's needed
  as well". The **palette-drawer redesign** is now scoped to do (it unblocks the
  flat 129-row list + the read pane's four `<h2>`s). The **laterality curation
  sweep** is confirmed as Chris's manual CSV step, not dev work. Order N1→N2→N3
  is deliberate (small no-dep win → keystone → independent, after N2's churn) but
  not a hard chain. Recorded in [../tasks/current.md](../tasks/current.md)
  "## Next builder-UX work"; `next-steps.md` + `builder-ux.md` **## Layout**
  updated; `deferred.md` unchanged (security sweep stays deferred). Docs only.

- **2026-09-02 — builder header "one undifferentiated control row": verified
  already resolved, no code shipped.** A session was dispatched on the
  design-critique entry *"The header is one undifferentiated control row"* in
  [../topics/builder-ux.md](../topics/builder-ux.md)'s **## Layout** section. Its
  two concrete moves were **already shipped** by **R1 of the layout redesign
  (`758dff1`, 2026-08-30)** + **V1 (`7429863`, 2026-09-02)**: **(b)**
  `#canon` ("Canonicalise") is a `.toolbar-btn` on the editor's `.editor-tabs`
  strip, not the header; **(a)** `header .row` no longer exists — `<header>` is a
  flex with a centred `#doc-title` (`flex:1`) splitting the brand from the
  right-side controls, which read as five distinct zones: `WDL` mark · centred
  title · bordered rounded **`.file-cluster`** (*Open… / Download .wdl / Open on
  the board ↗*) · the bordered rounded **`#mine .menu`** pill (`▾` caret;
  *My workouts → Workouts* by V1) · **`#identity`** far right. Verified by
  driving `make serve` at 1440 / 1000 / 760px, light + dark, signed in: no wrap,
  ≈9–10px gaps between the three right-side units (each with its own border), no
  console errors. The *"future New behind one file control"* popover sub-idea is
  unbuilt/unrequested and a closed call (R1: *"three items didn't warrant a
  popover"*) — not invented. **`make test` 2064/2064, 1 pending — unchanged (no
  code touched).** Docs only: the `builder-ux.md` entry struck with the control
  inventory + the correction that it predicted grouping/Canonicalise work the
  redesign had already done the same day the entry was written;
  `current/next-steps.md` design-critique status updated.

- **2026-09-02 — builder read/analysis pane scroll: verified already fixed, no
  code shipped.** A session was dispatched on the first design-critique entry in
  [../topics/builder-ux.md](../topics/builder-ux.md)'s **## Layout** section —
  *"the 'what it reads as' pane has no scroll container"* — flagged as the
  single highest-value layout fix. The premise was **stale**: the `.read-pane`
  it names was replaced by the tabbed margin's `.rpanel`
  (`flex:1; min-height:0; overflow:auto`, bounded height, full ancestor
  `min-height:0` chain `body → .stage → .sheet → .right-col → .rpanel`) in **R1
  of the layout redesign (`758dff1`, 2026-08-30)** — the same day the critique
  was written, and `completed.md`'s R1 note already said *"the read-pane scroll
  🔴 is fixed."* Re-verified by driving `make serve` in the browser at 1440×900,
  820px, and 375px mobile, light + dark, with a 56-cue six-section workout (58
  lines): the **Analysis** panel is `overflow-y:auto`, `scrollHeight` 1622 vs
  `clientHeight` 722, scrolls internally with header / summary band / editor
  fixed; `documentElement.scrollHeight === innerHeight` — **document overflow 0**
  (the entry had measured 1748 vs 900). **Reads as** is the same bounded
  `.rpanel` (2083 vs 660 with every-cue expanded, overflow still 0). No console
  errors. **`make test` 2064/2064, 1 pending — unchanged (no code touched).**
  Docs only: the `builder-ux.md` entry struck with the measurements + the
  correction that the pane-only `overflow:auto` the entry predicted needed the
  ancestor `min-height:0` chain the redesign supplied; `tasks/current.md` bullet
  with an **Open for Chris** note on the remaining design-critique items. The
  optional *collapsible sub-panels* half was not built — polish on a working
  pane, clustered with the still-open palette-drawer redesign.

- **2026-09-02 — a `.env` now feeds the database + deploy make targets, and the
  prod deploy state is corrected.**
  - **`.env` / `.env.example`.** The root `Makefile` gained
    `ifneq (,$(wildcard ./.env)) / include .env / export / endif` above the
    `?=` defaults, so `WDL_PB_URL` / `WDL_PB_ADMIN_TOKEN` / `WDL_PB_ADMIN_EMAIL`
    / `WDL_PB_ADMIN_PASSWORD` / `WDL_PB_ADMIN_COLLECTION` / `WDL_DEPLOY_SSH` /
    `WDL_DEPLOY_DIR` / `WDL_BACKUP_DIR` set in a git-ignored `.env` reach the
    `node scripts/*` recipes with no inline `VAR=… make …` prefix. `.env.example`
    (committed, every key commented with guidance) is the template; `/.env` added
    to the root `.gitignore`. GNU Make parses the file → values take no quotes,
    no `#` mid-value, no `$`. Precedence verified: `make VAR=x <target>`
    overrides `.env`; `.env` overrides the `?=` defaults and a `VAR=x make`
    shell prefix; a missing `.env` changes nothing (local mock still defaults to
    `http://localhost:8081`). **Files:** `Makefile`, `.env.example` (new),
    `.gitignore`. No script change — they already read `process.env`.
  - **Prod deploy state corrected.** Checked against the live API
    (`https://wex.androidempathy.com/api/...`): **all six migrations are applied
    on the box**, and `movements` **972** / `workouts` **45** / `equipment`
    **29** / `patterns` **11** rows — every loader has run against prod. The
    context files (`what-exists.md` Hosting row, `next-steps.md`,
    `running-it.md`) had said the `movements` table did not exist in prod, the
    vocab migration was unrun, and "prod serves nothing" — all stale, some
    within hours of being written. Fixed as dated corrections in place.
  - **V8 static apps deployed 2026-09-02 21:38 UTC.** An earlier check in this
    session caught the box mid-way (served JS still `last-modified` 21:06, the
    pre-V8 build) and this entry first listed the `make deploy` as open — it
    landed minutes later. Confirmed: served `apps/shared/{pocketbase.js,
    vocab.js, movement-editor.js}` are byte-identical to `origin/main`, and the
    exact call `listEquipment()` builds
    (`?filter=scope="global"&sort=termId&perPage=1000`) returns **29** on the
    live API (`listPatterns()` **11**). **V8 is fully live** — DB + app code.
  - **M6 nightly backup: installed, running, pulled off-box — done.** The
    `crontab -e` line is on the box and produced
    `~/pb/pb_backups/data-2026-09-02.db` (507904 B, written by cron at 03:17 UTC;
    `backup.log` empty; the Sep-1 file is a manual test). `make backups:pull`
    then copied both snapshots into `db-backups/`, verified. **Nothing is open
    on deploy** — every M-series and V-series deploy caveat is closed.
  - **`make backups:pull` now lands in a repo-relative `db-backups/`**, not
    `~/wdl-pb-backups/` — a `make` target has no business writing to `$HOME`.
    `WDL_BACKUP_DIR` default changed from `$(HOME)/wdl-pb-backups` to
    `db-backups`; `db-backups/README.md` committed as the stub; `.gitignore`
    gets `/db-backups/*` + `!/db-backups/README.md` so snapshots and `pull.log`
    stay out of the repo while the directory survives a clone. `.env.example`
    and `deploy/README.md` §9 updated; an absolute `WDL_BACKUP_DIR` in `.env`
    still relocates it. **Files:** `Makefile`, `.gitignore`, `.env.example`,
    `db-backups/README.md` (new), `deploy/README.md`.

- **2026-09-02 — V8 landed (`b2efb64`): `make vocab:load`, and the movement
  editor's equipment + pattern pickers now read `/api`.** Stage C of
  *Vocabularies & editor ergonomics* is complete bar the optional V9.
  - **`scripts/vocab-to-db.mjs` / `make vocab:load`** — the vocab twin of
    `movements-to-db.mjs`: one no-deps run upserts **both**
    `registry/equipment.json` → the `equipment` collection and
    `registry/patterns.json` → the `patterns` collection over `/api`, keyed on
    the registry `id` → `termId` unique index. `POST`s the absent, `PATCH`es only
    `name` / `synonyms` where they differ, a re-run writes nothing.
    Per-collection `created` / `updated` / `unchanged` tally + a combined total;
    `--dry-run`; `--api` / `WDL_PB_URL` default `http://localhost:8081`; prod
    auth identical to `movements-to-db.mjs` (the vocab write rule is
    `@request.auth.admin = true`, **verified against the migration**, so a
    `users` `admin: true` row satisfies it). No `make vocab:dump` — a two-file,
    forty-term vocabulary edited through the registry files does not want the
    round-trip guarantee.
  - **`listEquipment()` / `listPatterns()` in `apps/shared/pocketbase.js`** —
    copies of `listMovements()`'s shape (`filter=scope="global"`, `sort=termId`,
    `perPage=1000`, auth only if a token is held), returning the raw rows.
  - **`apps/shared/vocab.js`** — `equipmentVocab()` / `patternVocab()` fetch
    those and map each row to `termId`, with the committed literals kept as the
    **offline fallback**. `movement-editor.js` swaps `() => EQUIPMENT` /
    `() => MOVEMENT_PATTERNS` for the two new fetchers; the `vocab:` option is
    still a function returning an id array, so `createTokenInput` and `collect()`
    are untouched.
  - **Two corrections to the V8 task note, recorded in `vocab.js`** (the DEC-023
    verify-the-premise habit, now four for four this epic): there is **no**
    "movements fallback pattern" to mirror — `builder.js` loads movement lists
    straight from `registry/movements*.json` with a bare `.catch`; the pattern
    mirrored is this file's own `muscleIds()`. And the literals were always
    `string[]` of ids, **not** `{ id, name, synonyms }` — so the interchangeable
    shape is a `string[]` of term ids.
  - **Files:** `scripts/vocab-to-db.mjs` (new), `Makefile`,
    `apps/shared/{pocketbase.js, vocab.js, movement-editor.js}`. No
    `packages/core` change. `make test` **2064/2064, 1 pending**, before and
    after.
  - **Verified — drove it.** Against `make serve`: both pickers populate from
    `GET /api/collections/{equipment,patterns}/records?filter=scope="global"&sort=termId&perPage=1000`
    → **29** / **11**, `termId` order (equipment `atlas stone … yoke`; patterns
    `carry, core, elbow-extension, …` — push/pull pairs still adjacent). With
    **`WDL_MOCK_API=0 make serve`** and the editor reopened, both pickers still
    populate — **29** / **11**, patterns in family order (`squat, hinge,
    horizontal-push, …`, the literal) — and the console shows
    `equipment: no /api vocabulary, using the bundled list — 404 Not Found` /
    `movement patterns: …`. `make vocab:load` output against the mock:
    ```
      equipment 29 term(s): 0 created, 0 updated, 29 unchanged (29 row(s) in the collection)
      patterns  11 term(s): 0 created, 0 updated, 11 unchanged (11 row(s) in the collection)
    done: 0 created, 0 updated, 40 unchanged
    ```
    `--dry-run` wrote nothing (`git status` clean of fixtures). `curl -X DELETE
    .../equipment/records/skierg -H 'authorization: mock'` then `make vocab:load`
    → **equipment 1 created**, patterns untouched; the recreated row carries
    `name: "SkiErg"`, `synonyms: []`, `scope: "global"`. A `curl -X PATCH`
    drifting `name` / `synonyms` then a reload → **equipment 1 updated** (patched
    back to `Barbell` / `[]`); an idempotent re-run → all `unchanged`. Local
    overlay files deleted after the run.
  - **Still to do on deploy (Chris):** `make deploy:db` (the V6 migration) +
    `make vocab:load` with prod admin creds — until then prod serves nothing and
    the editor uses the fallback.

- **2026-09-02 — V7 landed (`67001cb`): the equipment + pattern vocabulary is
  served by the local mock `/api`.** Stage C of *Vocabularies & editor
  ergonomics* continues. `scripts/mock-api.mjs` grew `equipment/records` and
  `patterns/records` handlers in PocketBase's list-envelope shape, a
  field-for-field copy of the `movements/records` handler built from one
  `makeVocab(name, prefix)` factory — the mock twin of the migration's
  `vocabCollection(name)`, so the two vocabularies cannot drift.
  **Derived, not committed:** the seed is `registry/{equipment,patterns}.json`
  read at boot — there is **no** `fixtures/{equipment,patterns}.json` (the V7
  note offered "commit or derive"; movements has no fixture seed either, so
  derive). Records carry `termId` (registry `id` → column), `name`, `synonyms`,
  `scope: "global"`, and empty `user` / `created` / `updated` on seed rows;
  `/records/:id` resolves by synthetic id (`eq…` / `pt…` hash) or `termId`;
  `filter` / `sort` / `page` / `perPage` via the shared `applyQuery` +
  `listEnvelope`. Reads are open; `POST` / `PATCH` / `DELETE` need an
  `Authorization` header (403 without), the same gate the movements routes use.
  Authorised writes overlay onto git-ignored
  `fixtures/{equipment,patterns}.local.json` (`records` + `deleted` tombstones),
  keyed by `termId`, merged over the seed on read — the two entries added to
  `.gitignore` beside the existing three.
  **Files:** `scripts/mock-api.mjs`, `.gitignore`. No core, no app change —
  `apps/shared/vocab.js` untouched, still the editor's source until V8.
  `make test` **2064/2064, 1 pending**, before and after.
  **Verified — drove it** (`make serve`, `curl` both routes):
  `curl '…/equipment/records?perPage=3'` → `totalItems` **29**;
  `curl '…/patterns/records'` → `totalItems` **11**; single-record fetch works
  by synthetic id (`…/equipment/records/eq000sbozx5`) and by `termId`
  (`…/equipment/records/barbell`), both returning the same row;
  `filter=termId="kettlebell"` → 1 item, `name~"ball"` → 2, `sort=-termId` →
  `yoke`, `wall`; a 404 on a miss. An unauthenticated `POST` → **403**; an
  authorised `POST` (`-H 'authorization: mock_tok'`) of a `trap bar` term → 200,
  `totalItems` **30** on the next read, the row fetchable by `termId`, and
  written to `fixtures/equipment.local.json`; an authorised `PATCH` and `DELETE`
  likewise persist and **survive a server restart** (overlay re-read on boot).
  One mock record compared field-for-field against
  `1757100000_create_vocab.js`'s column list — they **agree** (`termId`, `name`,
  `synonyms`, `scope`, `user`, `created`, `updated`; the mock adds only
  PocketBase's own always-present `id` / `collectionId` / `collectionName`).
  Local overlay files deleted after the run.

- **2026-09-02 — Movement editor wrong-record defect fixed (`a643824`).** The
  data-integrity item scheduled the same day (found verifying V5) is closed:
  Chris's call was **always the API/database, never an in-memory object** —
  "even when it's test, it's gonna be fetching from the fixture anyway."
  *Before → after:* all three entry points (`＋ new movement`, the palette
  `✎`, the `»` panel) handed `createMovementEditor` whichever movement object
  they had on screen, and two of those three were the *canonical* 5-source
  merge rather than the curated row the editor exists to edit and the save
  `PATCH`es against → `openMovementEditor()` takes an **identity**
  (`null`, or `{ id, title }`) and always fills the form from
  `getMovementByMovementId(id)`, awaited before mount, with a `Loading…`
  state and an inline error path in the same host the form uses.
  A movement with no curated row yet opens in **create** mode carrying only
  its id/title — nothing invented.
  **What this closes, all four measured in the scheduled item:** `deadlift`
  no longer opens with an invented `Barbell` equipment value; `skierg` no
  longer loses the `ski erg` alias; canonical `muscles.support`/`sources`
  no longer rides into the `PATCH` body; and the six movements that would
  have claimed another curated record's name as an alias (silently moving
  what that name resolves to, since an alias outranks an id in `fold.ts`'s
  `lookup`) can no longer do so from this form.
  **Files:** `apps/builder/{builder.js,builder.css}`. No core; `make test`
  **2064/2064, 1 pending**, unchanged.
  **Verified:** `deadlift` opens with Equipment empty and only its two
  curated aliases; `skierg` opens with both curated aliases; `push-up` via
  the `»` panel matches `registry/movements.json` field-for-field; a
  canonical-only movement (`1-leg-box-squat`) opens **blank**; an unedited
  `deadlift` save round-trips through `make movements:dump` with **0
  changed, 0 added, 0 removed** (`registry/movements.json` byte-identical);
  `make aliases` holds the pinned baseline — curated 972 records, **0
  contended names**; console clean.

- **2026-09-02 — V6 landed (`370b2d0`): equipment and movement patterns
  become a vocabulary layer — two committed files and the two collections
  behind them.** Opens Stage C of the *Vocabularies & editor ergonomics* epic,
  and is the move
  [DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)
  made for movements, applied to the two **open** vocabularies the movement
  editor offers. Settled as
  [DEC-025](../topics/settled-decisions.md#dec-025-equipment--movement-patterns-are-a-db-backed-vocabulary-layer-registryequipmentpatternsjson-is-the-committed-dump).
  **Data and schema only — nothing is user-visible yet**, on purpose, the way M1
  shipped the `movements` schema ahead of M3's loader. `apps/shared/vocab.js` is
  untouched and stays what the editor reads until V8.
  **What is new:** `registry/equipment.json` (29 terms) and
  `registry/patterns.json` (11), entry shape `{ id, name, synonyms }` matched to
  `registry/muscles.json`; and
  `deploy/pocketbase/pb_migrations/1757100000_create_vocab.js`, creating the
  `equipment` and `patterns` collections from one `vocabCollection(name)` helper
  so the two cannot drift — `termId` (text, required, unique index; the registry
  `id`, *not* `id`, which clashes with PocketBase's own record id), `name`,
  `synonyms` (json), `scope` (`select global|user`, required), a nullable `user`
  relation, two autodate fields; read rules `scope = "global"`, write rules
  `@request.auth.admin = true`; `down` deletes both in reverse creation order.
  Two collections rather than one table with a `kind` column: independent
  vocabularies, and a shared table would need every read to carry a filter a
  wrong one silently widens. `deploy/pocketbase/pb_migrations/README.md` gained
  its entry.
  **Seeded from `vocab.js` and re-checked against the data anyway** — the DEC-023
  habit, now three for three. The 31 distinct `equipment` values in
  `registry/movements.json` minus `kettlebells` (folded) and `other` (dropped)
  is *exactly* the committed 29, and the 11 patterns match, so V5's list and a
  fresh derivation agree.
  **Three corrections to the V6 queue note**, all from reading the committed
  file rather than the note: the entry shape is **`name`, not `label`**
  (muscles.json uses `name`, and matching the file beats matching the note; and
  `synonyms` is always present, because muscles.json's reader iterates it
  without a guard); **a pure case variant is not a synonym** — the note offered
  `Barbell`, but the lookup folds case, spaces, hyphens and underscores, so
  `Barbell` already resolves to `barbell` and `Swiss Ball` is committed as
  `swiss ball`; and **`patterns.json` carries no synonyms at all**, which is a
  finding rather than an omission, since `pattern` is wdl-curated with no
  upstream source. The 16 equipment synonyms that survive the fold are each
  verified to appear as a raw value in one of the two movement files.
  **Verified:** `make test` **2064/2064, 1 pending** — unchanged before and
  after, and stated as such because nothing reads these files yet. The migration
  was verified **up and down against a real pocketbase v0.40.1 (darwin_arm64)
  binary** and a throwaway `pb_data`, the M1/M2 method:

  ```
  $ pocketbase migrate up --dir <tmp>/pb_data --migrationsDir deploy/pocketbase/pb_migrations
  Applied 1756600000_create_workouts.js
  Applied 1756700000_add_users_admin.js
  Applied 1756800000_create_movements.js
  Applied 1756900000_add_users_handle_and_orgs.js
  Applied 1757000000_add_workouts_wdlid.js
  Applied 1757100000_create_vocab.js
  EXIT=0

  $ sqlite3 data.db "SELECT name FROM sqlite_master WHERE type='index'
                     AND tbl_name IN ('equipment','patterns') AND sql IS NOT NULL;"
  CREATE UNIQUE INDEX `idx_equipment_term_id` ON `equipment` (`termId`)
  CREATE INDEX `idx_equipment_scope` ON `equipment` (`scope`)
  CREATE UNIQUE INDEX `idx_patterns_term_id` ON `patterns` (`termId`)
  CREATE INDEX `idx_patterns_scope` ON `patterns` (`scope`)

  $ sqlite3 data.db "INSERT INTO equipment ... VALUES (...,'kettlebell',...);"   # 2nd time
  Error: stepping, UNIQUE constraint failed: equipment.termId (19)

  $ echo y | pocketbase migrate down 1 --dir <tmp>/pb_data --migrationsDir ...
  Reverted 1757100000_create_vocab.js
  EXIT=0
  # collections after down: movements, users, workouts
  # leftover equipment/patterns sqlite_master rows: 0
  # movements / workouts / users indexes: all 8 intact

  $ pocketbase migrate up --dir <tmp>/pb_data --migrationsDir ...
  Applied 1757100000_create_vocab.js
  EXIT=0
  ```

  Both collections landed with all seven fields, the `user` relation resolved to
  `users`, and the binary and temp `pb_data` were discarded, not committed. The
  migration is **not yet applied on the box** — `make deploy:db` lands it; see
  [../topics/running-it.md](../topics/running-it.md).

- **2026-09-02 — V4 + V5 landed together (`10a2b8a`): a reusable token-input
  widget, and the movement editor's seven list fields wired onto it.** Stage B
  of the *Vocabularies & editor ergonomics* epic, in one commit — V4 has no
  user-visible surface on its own and this repo verifies by driving the real
  app, so a scratch host page would have proved less than driving the editor.
  *Before → after:* seven comma-separated `<input>`s ("barbell, dumbbell") →
  seven token inputs — removable chips, a type-ahead entry, and a filter box
  over a bounded scrolling checklist below the field.
  **What is new:** `apps/shared/token-input.js` (`createTokenInput(...)` →
  `{ value(), focus(), destroy() }`, host-agnostic like `movement-editor.js`);
  `apps/shared/vocab.js` (`EQUIPMENT` 29 terms + `MOVEMENT_PATTERNS` 11, seeded
  from `registry/movements.json`; `muscleIds()` fetching
  `registry/muscles.json` relative to `import.meta.url`, never duplicated);
  an optional per-field **`vocab`** option on `createMovementEditor`, through
  which the builder passes `related` (curated ids) and `sameAs` (canonical ids)
  so the editor still holds no movement list of its own; and a **`group()`**
  twin of `field()`. `splitList` / `joinList` retired with their last callers.
  **One composition at every vocabulary size** — no count threshold, no "show 15
  then More" — settled as
  [DEC-024](../topics/settled-decisions.md#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker).
  **The caption bug went with it.** `field()` wrapped every field in a
  `<label>`, and a `<label>` labels only its first labelable descendant, so
  clicking the words COUNTING MODES ticked `both` and MEASURED OUTPUT ticked
  `distance`. `group()` uses `<div role="group" aria-labelledby>` instead, and
  **every** control holding more than one input uses it — the two checkbox
  groups and all seven token inputs, which would each have acquired the bug the
  day they landed. Written as the rule, not as the two fields that broke.
  **The measured-output checkbox pair is untouched** — `measures` is a
  capability set ([DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice))
  — and `skierg` round-tripping as `["distance","calories"]` was the regression
  guard.
  **Two corrections to the queued V5 note, recorded in `vocab.js` rather than
  silently applied.** Folding `kettlebells`→`kettlebell` and dropping `other`
  were right. **"Fold the machine variants" had nothing to fold**:
  `registry/movements.json`'s 31 distinct equipment values carry exactly one
  term containing "machine". The variants (`smith machine`, `t-bar machine`,
  `machine: bench press`, …) are in `registry/movements.canonical.json`, whose
  69 values are the raw upstream union — `Barbell` beside `barbell`, `none
  (bodyweight exercise)` — a merge artefact rather than a vocabulary, and
  exactly why the curated registry is the seed. Checked against the committed
  data before writing the list, which is the habit DEC-023 bought.
  **Files:** `apps/shared/token-input.js` (new), `apps/shared/vocab.js` (new),
  `apps/shared/movement-editor.js`, `apps/builder/builder.js`,
  `apps/builder/builder.css`. No core, grammar, spec, registry, migration or
  test change; `make test` **2064/2064, 1 pending** measured before and after,
  unchanged as expected for app JS + CSS.
  **Verified by driving the builder** against `make serve` (mock `/api`):
  `skierg` and `deadlift` open with the right chips in every field; type-ahead
  narrows on prefix first (`bar` → barbell / e-z curl bar / pull-up bar) and
  Enter adds; the picker adds, its filter narrows (`push` → the two push
  patterns), and removing a chip unticks its checkbox; an unrecognised token
  offers `＋ Add "ski-erg"` in aliases and is refused **without clearing the
  box** in muscles; neither caption ticks anything (the DOM reads nine
  `DIV:group` fields beside eight `LABEL` ones); the axis/per-side validation
  still fires. **The observed `PATCH …/movements/records/mv0007qwakq` body** —
  every list field an array of strings, nothing stringified, same shape as
  before: `aliases:["ski"]`, `equipment:["skierg","machine"]`,
  `pattern:["core","vertical-pull","locomotion"]`,
  `muscles.primary:["abs","lats","triceps"]`,
  `muscles.secondary:["erectors","mid-back","quads","shoulders"]`,
  `measures:["distance","calories"]`, `related:null`, `sameAs:null`,
  `laterality:null` — and stray text typed but never committed to a chip
  (`rowin` left sitting in Related) was correctly **not** saved. Reopened and
  the chips round-tripped. Both themes, 768px wide with
  `scrollWidth === clientWidth` inside the modal host and the picker, console
  clean.
  **One pre-existing defect found on the way and recorded, not fixed:** the
  palette's `✎` hands the editor the **canonical** merged entry rather than the
  curated one, so `deadlift` shows equipment `Barbell` and `skierg` shows only
  one of its two curated aliases — and a save writes that back. Unchanged by V5
  (it is which record the host passes, not how the control renders it), but far
  more visible now that chips show the spelling. Needs a Chris call between two
  fixes; written up in [../topics/builder-ux.md](../topics/builder-ux.md) under
  "The movement editor".

- **2026-09-02 — V3 withdrawn by Chris; settled as
  [DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice).**
  The resolution of the entry below. `measures` on a movement is a **capability
  set**, not a choice, so the movement editor **keeps its two checkboxes** — a
  checkbox pair is the right control for a set, and a 3-way single-select had no
  meaningless state to prevent. The two alternatives were considered and
  declined with it: a **4-way** control (None / Distance / Calories / Both),
  which preserves the data but is the checkbox pair with more clicks; and
  **narrowing the data** to one measure per movement, which contradicts spec
  §9.3 and `import-movement-curation.mjs`'s per-mode contract. **No code change
  either way** — the V3 attempt was already reverted, so the editor today is
  what it was before the epic started. Recorded in
  [../topics/deliberately-not-done.md](../topics/deliberately-not-done.md), and
  the V3 bullet + the epic's own "Decisions already made" line are **struck in
  place rather than deleted** in [../tasks/current.md](../tasks/current.md) —
  the decision V3 was built on is the thing a future reader needs to see was
  tried. **Stage B now starts at V4**; V3 blocked nothing. `make test`
  **2064/2064, 1 pending** — docs only.

- **2026-09-02 — V3 (measured output → a segmented control) built, disproved,
  and reverted. No code shipped; the finding is the deliverable.** The queued
  decision said *measured output is mutually exclusive*, explicitly contrasting
  it with counting modes, which "genuinely co-occur". The 3-way control was
  built to spec (radio group + `.me-seg`, array-of-0-or-1 preserved) and it
  rendered correctly — then verification against the data and the consumers
  showed **`measures` genuinely co-occurs too**, so the change was reverted
  rather than landed. *Was → would-have-been → is:* two checkboxes → one
  3-way picker → **two checkboxes, unchanged**.
  **The evidence:** three committed registry entries carry both values —
  `bike`, `row`, `skierg` — and that is correct curation; the spec says a rower
  is measured in calories (`spec-0.1.md:178`, `:1058`) *and* a duration step
  "defaults from the movement's registry `measures`" (`:185`), and
  `import-movement-curation.mjs:232` maintains the field as a **per-mode
  independent** set. `measures` is a **capability set**, not a choice.
  **What the narrowing would have cost, confirmed live in the builder:** the
  editor seeds from the first known value, so `skierg` opened showing only
  **Distance** lit and a save would have written `["distance"]`, dropping
  `calories` silently. That breaks two shipped consumers — (1)
  `calorieUnitHints()` (rule 2, DEC-022, `952c80c`, landed 2026-09-01), which
  fires only when `entry.measures` includes `calories` and whose *entire*
  registry surface is those same three entries: `15 Row` raises *"a bare count
  on a machine that measures calories — did you mean `15cal Row`?"* today and
  would not after a save; and (2) the `»` panel (`builder.js:329`), which maps
  one pick per mode — a Row step offers both `, count distance` and
  `, count cal`, and narrowing removes one. A save would also have moved
  `registry/movements.json` under `make movements:dump`.
  **Files: none — working tree reverted, nothing committed to the app.** No
  save was ever performed, so no `fixtures/movements.local.json` was written and
  no curated data was touched. `make test` **2064/2064, 1 pending** — measured
  before and after, unchanged, as expected for a change that was app JS + CSS
  and is now nothing. **Written up** in
  [../tasks/current.md](../tasks/current.md) (V3 flagged **Open for Chris**,
  with three options and a recommendation to withdraw V3),
  [../topics/lessons-learned.md](../topics/lessons-learned.md) ("A capability
  set is not a choice"), and
  [../topics/builder-ux.md](../topics/builder-ux.md) — where a **separate,
  pre-existing** bug found on the way is recorded: `field()` wraps each field in
  a `<label>`, and a `<label>` labels only its first labelable descendant, so
  clicking the caption **COUNTING MODES** ticks `both` and **MEASURED OUTPUT**
  ticks `distance`. V5 should fix it. **Next: V4 → V5**; V3 blocks nothing.

- **2026-09-02 — builder: the menu is *Workouts*, and *Libraries* chips drive
  the search box (`7429863`).** **Stage A (V1 + V2) of the *Vocabularies &
  editor ergonomics* epic**, landed as one commit; **Stage B (V3–V5) is next**.
  *Was → is:* the header button **"My workouts" → "Workouts"** (the panel was
  never only yours — your saved workouts *plus* a live search across every
  public one *plus* the publisher chips); the chip row label **"Examples" →
  "Libraries"** (crossfit / hyrox / tabata are official published sets, not
  examples); and the **mechanism**, from a *second* code path to none. A chip
  used to call `browseOrg(handle)` → `listOrgWorkouts(ownerId)` and fill the
  result list while the search box sat blank; it now writes `` `<handle>:` ``
  into the input and calls the existing debounced `onMineSearchInput`, because
  `searchWorkouts`'s filter already matches a `wdlId~` substring — `crossfit:`
  returns exactly that namespace. The lit state is **derived from the query**
  (`libraryChipActive()`, exact match on `<handle>:`), so typing past the prefix
  drops it and re-clicking a lit chip empties the box back to the plain saved
  list. **Retired with it:** `browseOrg`, the `mineOrg` / `mineOrgList` /
  `mineOrgSeq` state, `renderMinePanel`'s org branch, `onMineSearchInput`'s org
  guard, the sign-out reset, `listOrgWorkouts` in `apps/shared/pocketbase.js`
  (the board never used it; the mock `/api` had no handler of its own — the
  generic `workouts/records` filter serves both), and `ORG_ACCOUNTS`'s fixed org
  ids. `renderExamplesRow` → `renderLibrariesRow`; the `.mine-examples` /
  `.examples-label` / `.mine-chip` CSS class names and `id="mine"` stayed —
  internal. **One consequence found by driving it, and handled rather than
  left:** `listOrgWorkouts` fetched `perPage=200` but the search fetches
  `SEARCH_PER_PAGE`, which was **20** — so the CrossFit chip silently returned
  **20 of 31** rows with no "more" affordance. The constant is now **50**, sized
  to cover the largest curated library in one page, with the reason in the
  comment; past 50 this wants a real paging affordance, not a bigger number.
  **Files:** `apps/builder/{index.html,builder.js,builder.css}`,
  `apps/shared/pocketbase.js`. No core / grammar / spec / test change.
  `make test` **2064/2064, 1 pending** — unchanged before and after, as expected
  for app JS the suite does not exercise. **Verified** by driving the builder
  against `make serve` in **light + dark** and at **700px single-column**:
  button reads *Workouts*, row reads *Libraries*, crossfit → 31 rows / hyrox →
  9 / tabata → 3 each labelled `@<handle>` with the chip lit, re-click returns
  to the 3-row saved list, a plain `fran` search lights nothing, `crossfit:fr`
  narrows to one hit and lights nothing, and the per-row `↗` still opens
  `crossfit:angie` on the board (meta strip *Angie (crossfit:angie)*). Console
  clean.
- **2026-09-02 — builder: outline row affordances made discoverable + touch-
  reachable + ≥32px (`6adba47`).** A self-contained item off
  [../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
  (standalone queue empty). *Was:* the per-row tool strip (`↑ ↓ ⇥ ⇤ ⧉ ✕`) and
  the two carets (`▾` movement suggestions, `»` what-this-line-takes / block
  header) were `opacity: 0` until you hovered that exact row — no
  discoverability, unreachable by touch — and the tool buttons were 25.6px,
  under the 24px WCAG 2.2 floor. **Shipped, as one reveal rule + one sizing
  rule over the whole set:** resting `opacity: .6` (effective ~2.2:1 light /
  ~2.9:1 dark, the `--rail` "low but present" band) → `1` on `.node:hover`
  **and** `.node:focus-within`; `.node .tools button` `1.6rem → 2rem` (32px);
  `.node .caret` gets a `2rem` inline-flex hit box (glyph stays `.65rem`), the
  two carets offset by one box so they don't overlap, `input.line`
  right-padding `2.8rem → 4.4rem`. `:focus-within` covered the touch case with
  **no JS** (a tap focuses the button even at `tabindex -1`); the `⋮`-menu the
  critique floated was **declined** (reads fine as a persistent strip, and it's
  an interaction-model fork). Phone (`≤560px`): the tool strip **wraps to its
  own full-width row** under the input so the input keeps its width — rows
  roughly double in height there. Added a global
  `[hidden] { display: none !important }` guardrail (`.caret` now sets
  `display`; per-row carets hide via the attribute) — written as the rule per
  [../topics/lessons-learned.md](../topics/lessons-learned.md).
  **Files:** `apps/builder/builder.css` **only**. `make test` **2064/2064, 1
  pending** — unchanged (app CSS). **Verified** driving the builder against
  `make serve`, both themes, wide + narrow + a 375px mobile viewport:
  resting opacity `.6` / hover-focus `1.0` (measured both themes), tool button
  & caret boxes 32 × 32px, carets non-overlapping, `»` / `▾` / block panels
  still open and splice, Analysis / Reads-as / header unmoved, no console
  errors.
- **2026-09-02 — builder: dim/small text floored at AA contrast + 12px
  (`547d986`).** A self-contained item off
  [../topics/builder-ux.md](../topics/builder-ux.md)'s design-critique section
  (the standalone queue is empty; not a numbered task). The builder's
  `opacity`-dimmed secondary text — the palette muscle tags (`.movement .meta`,
  was 11.25px `opacity: .5`), `.hint`, and ~8 more — failed WCAG AA 4.5:1.
  **Approach:** drop the `opacity` multipliers and let `--dim` carry the
  dimming (`--dim` at full opacity already clears AA on `--page`/`--panel` in
  both themes — measured `.movement .meta` **light 3.4→4.9:1, dark 4.6→6.0:1**,
  every swept selector now ≥4.7:1); **not** raise the `--dim` token (would
  over-darken its ~40 other uses). Written as a **rule** (comment by `:root`):
  no `opacity` on body text — only on non-text (hover-reveal control strips, the
  drag ghost, cycle rails, `.movement .tick` state glyph, `:disabled`) — and no
  text below `.75rem`. Swept every `opacity:` on text and every sub-12px
  `font-size` in the file (`.72–.74rem` labels and fragile `em` → `.75rem`+),
  hierarchy preserved. `--rail` (outline nesting rails) is an independent
  literal, not derived from `--dim`, so untouched and unchanged.
  **Files:** `apps/builder/builder.css` **only**. `make test` **2064/2064, 1
  pending** — unchanged (app CSS, the suite does not exercise it). **Verified**
  by driving the builder against `make serve` in light + dark, wide + narrow:
  palette tags legible, Analysis / Reads-as / outline / header panes show no
  regression, no console errors.
- **2026-09-01 — unit defaults, rule 2: a builder diagnostic for a bare count on
  a calorie machine (`952c80c`).** Second and final rule of the last queued
  standalone task; **the standalone queue is now empty.** `15 Row` on an erg
  parses `15` as reps, but a rower counts calories — the **builder** now shows a
  suggesting diagnostic ("did you mean `15cal Row`?"). No parser / grammar /
  spec-*semantics* change: the reading is untouched, the board stays agnostic.
  **Files:** `apps/builder/builder.js` (`calorieUnitHints(workout)` — a parsed-
  tree walk feeding `renderReading()`'s `diagnostics` array; fires only for a
  bare-`reps` step with no `@`-load / `, count …` whose movement resolves to a
  registry entry with `measures` ⊇ `{calories}` and no `load`), `spec/spec-0.1.md`
  §7.1 (a note that the case is ambiguous and flagged in the builder, not
  defaulted). Reuses the existing `.warning` diagnostic style — no CSS.
  **Verified** by driving the builder against `make serve`: `15 Row` fires,
  `15cal Row` clears it, `15cal Bike` / `95 Back Squat` (a load movement) /
  `500 Run` (distance-only) do not; light + dark; no console errors. `make test`
  **2064/2064, 1 pending** — app code, no suite coverage. Closes the "unit
  defaults" task; DEC-022 covers both rules.
- **2026-09-01 — unit defaults, rule 1: a unitless load magnitude is pounds
  (`6829052`).** First of the two rules of the last queued standalone task.
  `@ <number>` with no unit now parses to a real `load` (`{kind:'absolute',
  unit:'lb', value}`) instead of `{kind:'raw'}`, and `wdl fmt` rewrites `@ 95` →
  `@ 95lb` — pound is the documented default for a load that omits its unit
  (design rule 3), overriding the ten-month "a default is an invention" holding
  answer. **Files:** `packages/core/src/units.ts` (`parseTarget` — one
  `/^\d+(\.\d+)?$/ → lb` branch before the `raw` fallthrough),
  `spec/spec-0.1.md` §3 (unit table) + §7 (the bare-number paragraph rewritten),
  `spec/grammar-0.1.ohm` (comment note — grammar unchanged, it always passed the
  bare magnitude through), `packages/core/test/{units,grammar}.test.ts` (new
  reading asserted directly), `test/golden/vocabulary.ts` (`@ 95` / `@95` moved
  under `was-wrong`, canonical `@ 95lb`). **Goldens:** `vocabulary.json` moved
  for those two pinned forms only; `interpretations.json` **byte-identical** — no
  corpus file writes a unitless load. `make test` **2064/2064, 1 pending** —
  unchanged. Distance still requires its unit; the unlabelled rx split is
  untouched. DEC-022; resolves the "what a target with no unit means" entry in
  [../topics/known-debts.md](../topics/known-debts.md). Rule 2 (a builder-only
  calorie-machine diagnostic) lands separately.
- **2026-09-01 — board: the `#` title moved into the `#meta` strip
  (`110ed2b`).** Second of the two remaining post-library standalone tasks;
  one (**unit defaults**) left. The workout's `# Title` line no longer renders
  as the first board body row — it joins the hidden preamble run and shows in
  the `#meta` strip as the prominent lead element, with any `@id` small and dim
  in parentheses after it (`Fran (crossfit:fran)`). **Files:**
  `apps/display/board.js` (`draw()`'s preamble test gained
  `|| text.trim().startsWith('#')`; `renderMeta()` now reads
  `state.workout.title` and renders `<span class="title">` as the strip lead,
  parenthesising `@id` when a title is present), `apps/display/board.css` (new
  `.meta .title` — 2.8vmin/650/`--ink`; `.meta .id` restyled `--ink`→`--dim`),
  `apps/display/index.html` (the `#meta` strip comment). `dataset.line` stays
  1:1 with the source so `paint()`'s physical-line cue matching + `scrollIntoView`
  are untouched. No `packages/core` / grammar / spec / mock / fixture touch.
  Verified dark only (the board has no light theme) by driving the board:
  `?w=crossfit:fran` → strip `Fran (crossfit:fran)`, first visible row
  `for time:`, Start/Next land the marker on line 7 for cue 3/6 (no off-by-one);
  `#<source>` title + no `@id` → strip shows just the title; `@id` + `@tags`, no
  title → id verbatim + chips; nothing set → strip hidden. `make test`
  unchanged — **2064/2064, 1 pending**.
- **2026-09-01 — board: the notifications strip is now dismissible
  (`01c0af3`).** First of the two remaining post-library standalone tasks.
  The red `#problems` strip at the foot of the board (parse errors, resolve
  diagnostics, run warnings) gained a **Clear notifications** button in the
  footer control row, beside Reset. **Files:** `apps/display/index.html` (static
  `<button id="clear-notifs" hidden>` after `#reset`), `apps/display/board.js`
  (new `setProblems(text = '')` helper — the single show/hide path for the strip
  text + `problems.hidden` + the button's `hidden`; `recue()`, `loadShared()`
  and `showEmpty()` routed through it; click handler `() => setProblems()`). No
  `board.css` change (generic `button` styling), no `packages/core` / grammar /
  spec / mock / fixture touch. The clear is not a permanent suppression — the
  next `recue()` (reparse / `?w=` load / division change) repopulates the strip.
  Verified dark only (the board has no light theme) by driving the board:
  clean workout → no strip, no button; `AMRAP 3min: 10 Push-Up` via the
  `#<source>` hash → strip + button; Clear → both hidden, no reserved gap;
  navigate to another erroring workout → both return; Start / Next / Back /
  Reset and footer layout unaffected. `make test` unchanged — **2064/2064, 1
  pending**; `git status` clean of fixtures.
- **2026-09-01 — L7 of *The workout library* epic landed (`2557177`) — the
  epic is closed.** Surfacing pass: a way to browse a curated org's public set
  from the builder, and "open on the board" for any public workout. **App code
  only** — `apps/shared/pocketbase.js`, `apps/builder/builder.js`,
  `apps/builder/builder.css`; no schema / `packages/core` / grammar / spec /
  mock / fixture / board touch, `make test` unchanged **2064/2064, 1 pending**,
  `git status` clean of fixtures.
  - **`listOrgWorkouts(ownerId)`** in `apps/shared/pocketbase.js` — one
    `GET …/workouts/records` with `filter=owner="<id>" && visibility="public"`,
    `sort=title`, `perPage=200`. `ownerId` is a fixed org-account id passed in,
    not looked up — the real PocketBase `users` list rule (`id =
    @request.auth.id`) resolves an org row for nobody, and the ids never change.
  - **Examples chip row** in the builder's *My workouts* panel, under the search
    box: one toggle per org (`CrossFit` / `Hyrox` / `Tabata`, from a shipped
    `ORG_ACCOUNTS` constant of the L1 fixed ids + handles). The lit chip
    replaces the plain list with that org's public set, each row labelled
    `@<handle>`, click-to-open through the **existing** `openFoundWorkout`
    detached path (a read-only copy the first Save re-namespaces — the DEC-021
    copy flow); re-picking the lit chip closes the set. Searching and browsing
    share the one list slot (a query closes an open set and vice versa);
    sign-out clears the browse state.
  - **Per-row `↗` "Open on the board"** on every hit row (search results and
    Examples set alike) — `openHitOnBoard` opens `../display/?w=<wdlId|id>` in a
    new tab. `renderSearchResults` refactored to a shared
    `renderHitList(hits, emptyMsg)` both views use.
  - **Board:** confirmed `?w=crossfit:fran` resolves end to end and the `#meta`
    strip shows `crossfit:fran` verbatim. The id already names the owner handle,
    so **no separate "by @crossfit" source line was added** — the id is enough
    (noted rather than built). No board change.
  - **Verified** driving the builder against a fresh `make serve` (mock `/api`,
    regenerated fixtures): Examples chips list **31 / 9 / 3** for crossfit /
    hyrox / tabata, all `@<handle>`-labelled, title-sorted; toggle-off restores
    the plain list; opening `Fran` from the crossfit set → detached read-only
    copy (`@id crossfit:fran`, "Opened crossfit:fran — a read-only copy…" note,
    "Save to my workouts"); per-row `↗` → `?w=crossfit:fran`; board renders it
    with `crossfit:fran` in `#meta`, no error strip; `?w=hyrox:race` /
    `?w=tabata:this` resolve; search box unchanged (`fran` → `Fran @crossfit`
    beside `Fran mine`, clearing restores the plain list).
  - **Files:** `apps/shared/pocketbase.js`, `apps/builder/builder.js`,
    `apps/builder/builder.css`, plus `docs/context/`. **The epic is closed —
    L0–L7 moved to `tasks/completed.md` as one grouped section.** Next: the
    three standalone tasks (unit defaults; board dismissible notifications;
    board `#` title into the meta strip).

- **2026-09-01 — L6 of *The workout library* epic landed (`5cc9e0f`)** —
  ingestion: the authored `.wdl` library → the `workouts` DB + regenerated
  fixtures. **Script + Makefile target + two fixtures only** — no
  `packages/core` / grammar / spec / migration / authored-`.wdl` touch;
  `make test` unchanged **2064/2064, 1 pending**; `examples/workouts/` still
  **not** wired into `corpus.test.ts`.
  - **`scripts/workouts-to-db.mjs`** + **`make workouts:load`** (beside
    `movements:load` in the root `Makefile`), the `workouts` twin of
    `movements-to-db.mjs` — no deps (`node:fs` + global `fetch`). Reads
    `examples/workouts/<org>/<slug>.wdl` (43 files); per file: `<org>` → the org
    row's fixed id as `owner` (`crossfit`→`org0crossfit001`,
    `hyrox`→`org0hyrox000001`, `tabata`→`org0tabata00001`), `@id` / `wdlId`
    forced to `<orghandle>:<slug>` via a port of `apps/shared/pocketbase.js`'s
    slug helper (slug from the file's own `@id`; a no-op on the canonical
    authored files), `title` from `# Title`, `source` = the body,
    `visibility: "public"`.
  - **Idempotent on `wdlId`** — bulk-fetch (`perPage=500`, paged), `POST` the
    absent, `PATCH` only when `title`/`source`/`visibility`/`owner` differ,
    re-run writes nothing (`created`/`updated`/`unchanged` tally). **`--dry-run`**
    (`ARGS=--dry-run`) reports and writes nothing — no HTTP mutation, no fixture
    rewrite.
  - **Same run regenerates the committed fixtures** (unless `--dry-run`):
    `fixtures/workouts.json` → 43 library rows (deterministic 15-char ids from
    `wdlId`) + every pre-existing non-org-owned row preserved (the mock user's 3
    seed workouts — they populate the builder's *My workouts* list from a fresh
    `make serve`); the old hand-added `crossfit:helen` row is replaced by the
    generated one (same `wdlId`). `fixtures/users.json` → the three `org: true`
    rows (same fixed ids/handles L1 commits) + the mock user row kept verbatim
    (no `handle`, on purpose). Each file rewritten only when its content
    changes. A fresh `make serve` / prod box now shows the whole library with no
    manual step.
  - **Prod writes need superuser auth** — the `workouts` write rule is
    owner-only, so `WDL_PB_ADMIN_COLLECTION` defaults to `_superusers` (unlike
    `movements:load`); `WDL_PB_ADMIN_TOKEN` / `_EMAIL` / `_PASSWORD` names
    otherwise identical. Against the mock, writes need no auth.
  - **Verified.** `wdl check` / `make test` unchanged (2064/2064, 1 pending).
    Against a fresh mock still carrying the pre-L6 seed:
    `make workouts:load` → **42 created, 1 updated** (the seed's `crossfit:helen`
    source differs from the authored file → PATCH); re-run → **43 unchanged,
    nothing written**; `@ 95lb`→`@ 96lb` in
    `examples/workouts/crossfit/fran.wdl`, re-run → **exactly 1 PATCH (source)**,
    reverted. `--dry-run` → `git status` clean. End-to-end against the
    regenerated fixtures (fresh `make serve`): board `?w=crossfit:fran` /
    `?w=hyrox:race` / `?w=tabata:this` resolve and render, `<org>:<slug>` in the
    `#meta` strip, no error strip, Division selector on `hyrox:race`; builder
    *My workouts* search — `fran` → `Fran @crossfit` beside `Fran mine`, `hyrox`
    → all 9, `murph` → `crossfit:murph`; opening the `@crossfit` hit loads a
    detached read-only copy (the DEC-021 copy flow). Regenerated
    `fixtures/workouts.json` = **46 rows** (43 library + 3 preserved mock-user);
    `fixtures/users.json` unchanged (already canonical from L1).
  - **Files:** `scripts/workouts-to-db.mjs` (new), `Makefile`,
    `fixtures/workouts.json`, plus `docs/context/`. **Next: L7** — surface the
    library in the apps; closes the epic (moves L0–L7 to `tasks/completed.md`).

- **2026-09-01 — L5 of *The workout library* epic landed (`6cb8df4`)** —
  the authored benchmark `.wdl` library. **Content only** — everything new is
  under `examples/workouts/`; no schema / `packages/core` / grammar / spec /
  test-suite touch, `make test` unchanged **2064/2064, 1 pending**.
  - **43 files**, `examples/workouts/<org>/<slug>.wdl`, `<org>` ∈ {`crossfit`,
    `hyrox`, `tabata`}. Each: first line `@id <org>:<slug>` (slug = filename
    stem), then `# Title`, then the body in canonical WDL. Every file is
    **byte-identical to `wdl fmt`** output (verified by diffing each against
    `fmt`), so the at-rest text is already the whiteboard-canonical form.
  - **crossfit/ (31)** — the 19 Girls (Fran, Cindy, Grace, Helen, Diane,
    Elizabeth, Isabel, Jackie, Karen, Linda, Nancy, Angie, Barbara, Chelsea,
    Mary, Annie, Eva, Kelly, Nicole), 9 first Heroes (Murph, DT, Chad, JT,
    Michael, Randy, Daniel, Josh, Nate), and Fight Gone Bad / Filthy Fifty /
    the CrossFit Total. Loads follow corpus house style (single men's Rx
    `@ 95lb`, `@ 2pood`, `@ 1.5x BW`) — the bare `(95/65)` split form was
    rejected because `wdl fmt` expands it to `(women 95 / men 135)`, which is
    not whiteboard-terse.
  - **hyrox/ (9)** — `hyrox:race` (the full 8×(1km run + station) race, spec
    §13.39 shape, loads updated to the **current** standard-division numbers:
    Sled Push 152/102 kg, Sled Pull 103/78 kg, Farmers Carry 2×24/2×16 kg,
    Sandbag Lunge 20/10 kg, Wall Balls 6 kg→10ft / 4 kg→9ft; men's as the
    primary line, women's in a `variants: women:` block) plus its 8 stations as
    individual single-movement files (`hyrox:skierg`, `hyrox:sled-push`,
    `hyrox:sled-pull`, `hyrox:burpee-broad-jump`, `hyrox:row`,
    `hyrox:farmers-carry`, `hyrox:sandbag-lunges`, `hyrox:wall-balls`), each
    with the same women's `variants:` where a split exists.
  - **tabata/ (3)** — `tabata:protocol` (8 rounds `work 20s: / rest 10s`,
    `score: min per round`), `tabata:this` (Tabata each of Row, Air Squat,
    Pull-Up, Push-Up, Sit-Up with `rest 1min` between, `score: sum of blocks`),
    `tabata:something-else` (32 straight-through intervals of Pull-Up / Push-Up
    / Sit-Up / Air Squat, `score: reps`).
  - **`wdl check`**: all 43 print `<file>: ok`, exit 0 (full output pasted in
    the L5 write-up / commit trail).
  - **Board spot-checks** (`make serve`, source pasted into
    `/apps/display/#<encoded>`): Fran, Murph, Fight Gone Bad, `hyrox:race`,
    `tabata:this` all render as legible board rows with `<org>:<slug>` in the
    `#meta` strip, no parse-error strip, no console errors. Murph shows the
    expected non-error timeline note "tally block: totals with no prescribed
    order" for its `any order:` block; `hyrox:race` shows the Division selector
    because of `variants:`.
  - Every `@id` slug matches its filename stem and its `<org>` matches its
    directory. `examples/workouts/` is **not** wired into `corpus.test.ts` —
    that is L6/L7's call, deliberately left out here.

- **2026-09-01 — L4 of *The workout library* epic landed (`0de7f9a`)** —
  search over your own + any public workout, by title or `@id`/`wdlId` (DEC-021).
  **App + mock + one fixture row only** — no schema / `packages/core` / grammar /
  spec touch; `make test` unchanged **2064/2064, 1 pending**.
  - `apps/shared/pocketbase.js`: **`searchWorkouts(q, { page = 1 })`** — one
    `GET …/workouts/records` with
    `filter=(visibility="public" || owner="<uid>") && (title~"<q>" || wdlId~"<q>")`,
    `sort=-updated`, `perPage: 20`. Signed out: no `owner` clause, no auth
    header. `q` trimmed, `"` stripped (it sits inside `"…"` in the filter — a
    one-instance tool, not a query builder); empty `q` → `[]` with no request;
    returns the `items` array. **`getHandle(uid)`** — best-effort, session-
    memoised uid→handle for labelling a public hit; real PocketBase resolves
    only your own uid (`users` list rule `id = @request.auth.id`) → foreign
    owners fall back to the label "public"; the mock resolves every uid. The
    15-char-record-id case DEC-021 lists is left to the existing `Open…` /
    `getByAnyId` path — a bare id matches neither `~` clause and a second
    speculative request per keystroke wasn't worth it.
  - `apps/builder/builder.js` + `builder.css`: a debounced (220 ms)
    `<input type="search">` at the top of the **My workouts** panel. A non-empty
    query swaps the plain list for `searchWorkouts` hits, each row labelled
    `mine` (accent) / `@ownerhandle` / `public` (dim). Click-to-open
    (`openFoundWorkout`): your own hit attaches like `openMine`; someone else's
    public hit opens **detached** with a note, so the first Save writes your
    re-namespaced copy (the DEC-021 copy flow). "No matches." line; clearing the
    box restores the plain list. The `<input>` is one persistent node
    re-appended across panel re-renders with focus/caret restored, so a landing
    result doesn't interrupt typing. New CSS: `.mine-search`, `.mine-label`
    (`.is-mine`) — all on existing `--ink`/`--dim`/`--accent`/`--panel`/`--rule`
    tokens, checked in both themes.
  - `scripts/mock-api.mjs`: `applyQuery`'s single-regex filter replaced by
    **`matchesFilter`** — `splitTop` (paren/quote-aware `&&` / `||` split) +
    `matchesAtom` (`field="v"` exact, `field~"v"` case-insensitive substring).
    Header comment states it is a matcher for the exact strings the client
    emits, not a general engine. `sort` / pagination unchanged.
  - `fixtures/workouts.json`: **one** new row — `crossfit:helen`, owned by
    `org0crossfit001`, `visibility: "public"`, `wdlId` set — so a fresh
    `make serve` has a public workout to find. L6's loader regenerates this
    file.
  - **Verified** driving the builder against `make serve` (mock `/api`) in
    **both** `prefers-color-scheme` themes, signed in as the mock user
    (handle `@canny-clay` assigned on sign-in): search `helen` → the org public
    hit, labelled `@crossfit`; search `fran` → own private seed hit, labelled
    `mine` (accent); click `Fran` → opens attached (share row + "Save"); click
    `Helen` → opens **detached** ("Save to my workouts" + the read-only-copy
    note, no share row); search `zzznope` → "No matches.", no crash; clear the
    box → the plain Pull-up/Cindy/Fran list is back. Dark theme: computed
    colours are the dark tokens (input `#1a1d22`/`#eceef2`, `mine` label
    `#6ea8ff`, `@crossfit` label `#939aa8`) — no un-themed colour; no console
    errors. Direct `curl` against the mock confirmed the filter matcher: the
    signed-in/signed-out shapes, `wdlId~"crossfit:hel"` (colon in the query),
    case-insensitive `title~"HELEN"`, a zero-match query, and the pre-existing
    `owner="…"` / `id="…"` filters all resolve correctly. *Touched:*
    `apps/shared/pocketbase.js`, `apps/builder/builder.js`,
    `apps/builder/builder.css`, `scripts/mock-api.mjs`, `fixtures/workouts.json`,
    `docs/context/`. Spawns L5 (author the benchmark `.wdl` library).

- **2026-09-01 — L3 of *The workout library* epic landed (`5be4a30`)** — the
  app-side write that makes `wdlId` mean something and `@id` deterministic
  (DEC-021). **App + mock only** — no schema / `packages/core` / grammar / spec
  touch; `make test` unchanged **2064/2064, 1 pending**.
  - `apps/shared/pocketbase.js`: a module-local `@id`/slug helper block
    (`slugify`, `readIdValue` / `readTitleLine` — light regex on the zero-indent
    preamble line, `slugOfIdValue`, `baseSlug`, `writeIdLine`, `requireHandle`,
    `namespacedId`, `forceNamespace`). `create` and `update` now run it: every
    save writes/rewrites `source`'s `@id` line to `<owner-handle>:<slug>` and
    sends `wdlId` set to the identical string. `<slug>` = an existing `@id`'s
    slug portion (`@id crossfit:fran` → `fran`), else a slug of the zero-indent
    `# title` line *in the source* (not the passed `title` param, which is a
    display fallback that can read `"Untitled workout"`), else `untitled`; a
    same-owner clash appends a deterministic `-2` / `-3` … suffix that is stable
    across re-saves (scan skips only *other* records' `wdlId`s; `base` is
    re-derived from the stored `@id`). A patch with no `source` leaves `wdlId`
    alone. New export **`getByAnyId(x)`**: `:` in the value → `filter=wdlId="…"`
    (404-shaped `Error` on miss); no `:` → `getById` with a `wdlId` fallback on
    a 404 — same not-found shape as `getById`.
  - `apps/display/board.js`: the `?w=` resolution imports and calls
    `getByAnyId` instead of `getById`; the id-is-the-share-link / clean-`?w=`
    behaviour (`load(..., false)`) is unchanged, so `?w=easy-beacon:fran` and
    `?w=<recordid>` both work and the address bar stays clean.
  - `scripts/mock-api.mjs`: a JS port of the helper (`forceWdlId` +
    `mSlugify` / `mReadId` / `mReadTitle` / `mSlugOfId` / `mBaseSlug` /
    `mWriteId`) runs on mock `workouts` create/update, resolving the owner's
    handle from the `users` fixture; `wdlId` added to the record shape and the
    PATCH field list. `filter=wdlId="<handle>:<slug>"` needed no parser change —
    the generic `field="value"` matcher already spans the colon.
  - **Verified** against `make serve` (mock `/api`), driving the real
    `pocketbase.js` `create`/`update`/`getByAnyId` plus one end-to-end builder
    "Save to my workouts" click: `# Fran` no `@id` → `@id easy-beacon:fran`;
    copy of `@id crossfit:fran` on a clean namespace → `@id easy-beacon:fran`;
    no `@id`/title saved twice → `easy-beacon:untitled` then
    `easy-beacon:untitled-2`, re-saving either keeps its slug; body-edit re-save
    of a saved workout → `@id`/`wdlId` unchanged; builder Save button → `@id
    easy-beacon:new-workout` written after the title line + `wdlId` set. Board:
    `?w=easy-beacon:fran` resolves/renders with the id in the `#meta` strip,
    URL left clean; `?w=<15-char recordid>` resolves; `?w=nope:nope` shows the
    existing "could not be found" line, no crash. Theme not exercised — L3 is
    logic-only, no CSS/render change. *Touched:* `apps/shared/pocketbase.js`,
    `apps/display/board.js`, `scripts/mock-api.mjs`, `docs/context/`. Spawns L4
    (search: `searchWorkouts` + builder search UI + the mock's `~` operator and
    parenthesised OR).

- **2026-09-01 — L2 of *The workout library* epic landed (`fc72881`)** — the
  `workouts` side of the DEC-021 schema.
  `deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js` adds
  `wdlId` (text, `max: 260`, nullable, no default) to the `workouts` collection
  plus a **plain** index `idx_workouts_wdl_id ON workouts (wdlId)` — non-unique
  because two owners may hold the same `<slug>` and same-owner collisions get
  L3's `-2`/`-3` suffix, and a plain index is all the L3 lookup and L4 search
  need. Edits an existing collection the same way M2 / L1 do
  (`findCollectionByNameOrId` → `fields.add(new Field(...))` / `indexes.push` →
  `app.save`; `down` reverses field + index together). **No API-rule change**
  (the item-18 visibility rules on `workouts` are untouched) and **no
  app/mock/fixture change** — L2 is pure DB schema; `wdlId` is `null` on every
  existing and new row until L3 sets it on save (and L6's loader for the org
  rows), so there is no backfill (DEC-021). `make test` unchanged **2064/2064,
  1 pending** — no `packages/core` touch. Migration up/down/up verified against
  a real PocketBase v0.40.1 (darwin_arm64) binary + throwaway `pb_data` with
  all five migration files present:

  ```
  $ ./pocketbase migrate up --dir <tmp>/pb_data --migrationsDir <tmp>/pb_migrations
  Applied 1756600000_create_workouts.js
  Applied 1756700000_add_users_admin.js
  Applied 1756800000_create_movements.js
  Applied 1756900000_add_users_handle_and_orgs.js
  Applied 1757000000_add_workouts_wdlid.js

  $ sqlite3 pb_data/data.db "SELECT fields FROM _collections WHERE name='workouts';"  # wdlId entry
  ('wdlId', 'text', 260, False)      # (name, type, max, required)

  $ sqlite3 pb_data/data.db "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='workouts' AND sql IS NOT NULL;"
  CREATE INDEX `idx_workouts_owner` ON `workouts` (`owner`)
  CREATE INDEX `idx_workouts_visibility` ON `workouts` (`visibility`)
  CREATE INDEX `idx_workouts_wdl_id` ON `workouts` (`wdlId`)

  $ echo y | ./pocketbase migrate down 1 --dir <tmp>/pb_data --migrationsDir <tmp>/pb_migrations
  Reverted 1757000000_add_workouts_wdlid.js
  # wdlId ABSENT; workouts indexes back to owner + visibility only

  $ ./pocketbase migrate up --dir <tmp>/pb_data --migrationsDir <tmp>/pb_migrations
  Applied 1757000000_add_workouts_wdlid.js
  # wdlId + idx_workouts_wdl_id back
  ```

  *Touched:* new
  `deploy/pocketbase/pb_migrations/1757000000_add_workouts_wdlid.js`;
  `deploy/pocketbase/pb_migrations/README.md`; `deploy/README.md` (§7 table +
  index line + new §7d); `docs/context/`. **Still to do on deploy:** glance at
  the admin UI once the migration applies — confirm the `wdlId` column +
  `idx_workouts_wdl_id` landed on `workouts` (`deploy/README.md` §7d); nothing
  to backfill or grant. Spawns L3 (force `@id` on save + set `wdlId` +
  `getByAnyId` resolver).

- **2026-09-01 — L1 of *The workout library* epic landed (`88ab8b6`)** — the
  `users` schema + app-side handle machinery DEC-021 opened the epic against.
  `deploy/pocketbase/pb_migrations/1756900000_add_users_handle_and_orgs.js`
  adds `org` (bool) and unique `handle` (text) to `users`, and inserts the
  three org rows (`crossfit`/`hyrox`/`tabata`, fixed 15-char ids, `org: true`,
  no OAuth/password). App side: `apps/shared/handle.js` +
  `handle-words.js` (pure — validation, the reserved set, the random-pair
  generator over two committed word lists); `apps/shared/pocketbase.js` grows
  `ensureHandle()` (assigns a random `adjective-noun` handle on first sign-in,
  collision-retried, never blocks onboarding), `updateHandle(h)` (validates,
  best-effort free-check, `PATCH`, the server's unique-index 400 as the
  authoritative reject), and `currentHandle()`. The builder header's account
  area shows `@handle` with an inline edit affordance. Mirrored in
  `scripts/mock-api.mjs` (open `filter=handle="…"` + a uniqueness-enforcing
  `PATCH`, unlike real PocketBase's self-only `users` list rule) and
  `fixtures/users.json` (the three org rows; the mock user is committed
  handle-less on purpose so a fresh `make serve` exercises the assignment
  path). `make test` unchanged **2064/2064, 1 pending** — no `packages/core`
  touch. Migration up/down/up verified against a real PocketBase v0.40.1
  (darwin_arm64) binary: all four migrations apply cleanly, the fields + index
  + org rows land, a duplicate `handle` insert is rejected by the index,
  `migrate down 1` removes everything cleanly. Drove the builder against
  `make serve` in both themes: random assignment, a free rename, a taken
  rename (`crossfit`, rejected), a pure-numeric rename (rejected); signed-out
  unchanged. *Touched:* the migration; `apps/shared/{handle,handle-words}.js`
  (new); `apps/shared/pocketbase.js`; `apps/builder/{builder.js,builder.css}`;
  `scripts/mock-api.mjs`; `fixtures/users.json`; `.gitignore`
  (`fixtures/users.local.json`); `deploy/README.md` §7c;
  `deploy/pocketbase/pb_migrations/README.md`; `docs/context/`. **Still to do
  on deploy:** glance at the admin UI — the three org rows + the unique-index
  badge on `handle` (`deploy/README.md` §7c). Spawns L2 (`workouts.wdlId`
  column).

- **2026-09-01 — DEC-021 recorded; L0 of *The workout library* epic closed**
  (docs + one spec-prose sentence, no code). L0's job was the design note the
  rest of the epic builds against, the way M0 → DEC-020 opened the movements
  epic.
  [DEC-021](../topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it):
  curated public sets are owned by **flagged `users` rows** (`org: true`, fixed
  ids from an L1 migration, no OAuth, workouts `visibility: "public"`) — no new
  collection. A new unique **`users.handle`** (`[a-z0-9-]+`, user-editable,
  random `adjective-noun` default from two committed `apps/shared/` word lists)
  is the `@id` namespace prefix for **every** account. **Every save
  writes/rewrites the workout's `@id` line to `<owner-handle>:<slug>`** (slug
  from an existing `@id` else the title; same-owner collision → deterministic
  suffix) — so there is no un-namespaced saved workout and no mismatch state;
  copy→save re-namespaces naturally; the L6 loader applies the identical rule
  non-interactively to org workouts. **`workouts.wdlId`** is set from the same
  value and indexed; **`getByAnyId`** resolves a `:`-bearing `wdlId` or a
  15-char record id to one row (the `:` is the discriminator), and the board's
  `?w=` uses it. The mock `/api` + `fixtures/` mirror all of it. `packages/core`,
  the grammar and spec *semantics* are untouched — the namespace rule is a
  **hosting convention**, recorded as one flagged sentence beside spec §2's
  `@id` bullet. **Deferred:** handle-rename strands saved `@id`s / `wdlId`s /
  share links (already in [../topics/known-debts.md](../topics/known-debts.md));
  any *platform* concern stays a Non-Goal. `make test` unchanged at
  **2064/2064, 1 pending**. *Touched:*
  `docs/context/topics/settled-decisions.md`, `docs/context/decisions.md`,
  `docs/context/tasks/current.md`, `docs/context/current/{recent-changes,next-steps}.md`,
  `spec/spec-0.1.md`. Also tightened L1 (handle validation: reserved/empty/
  numeric rejects, two word lists) and L3 (now spells out the force-`@id`-on-save
  rule + the `:`-discriminator resolver) so they need no mid-flight call.

- **2026-09-01 — queued a new epic + three standalone tasks; recorded the
  unit-defaults decision** (docs only, no code). From Chris, in the same
  session as the `»`-panel fix. **Epic *The workout library* (L0–L7)** in
  [../tasks/current.md](../tasks/current.md): non-interactive "org" accounts
  (`crossfit` / `hyrox` / `tabata`) owning public benchmark-WOD sets; **every
  account gets an editable `handle`** that namespaces its `@id`s (random
  `adjective-noun` default; handle-rename-strands-`@id` recorded as deferred
  debt in [../topics/known-debts.md](../topics/known-debts.md)); a
  `workouts.wdlId` column parsed from `@id` on save; search over own + public
  by name / `@id` / record id; an authored `examples/workouts/<org>/*.wdl`
  library + a `make workouts:load` ingest that also regenerates `fixtures/`.
  Four calls Chris made are recorded in the section; it **absorbs most of the
  deferred account-namespacing rethink**. **Standalone tasks:** (1) **unit
  defaults** — `@ 95` reads as `95lb` (pound default for any load-carrying
  movement), a unitless magnitude on a machine/aerobic movement reads as
  calories; this **settles** the "Open: what a target with no unit means" item
  in `known-debts.md` (was deliberately `raw`), implementation still to land.
  (2) **board: dismissible notifications** — a "Clear notifications" footer
  button. (3) **board: the `#` title into the `#meta` strip** — not a body row,
  `@id` small in parens after it; closes the "reversible default" question item
  15b left open. *Touched:* `docs/context/tasks/current.md`,
  `docs/context/current/{recent-changes,next-steps}.md`,
  `docs/context/topics/{known-debts,builder-ux}.md`.

- **2026-09-01 — `»`-panel per-implement load token reads clearly mid-edit**
  (`00f599c`). Self-contained builder-UX fix, first loose bullet off
  `tasks/current.md`. *Was:* the `»` panel's "takes a load" pick for a
  `load: "per-implement"` movement (Bulgarian Split Squat, Dumbbell Curl,
  `implements: 2`) spliced a bare `@ 2x` seeded from `implements`, which Chris —
  who designed the panel — found cryptic before the weight was typed.
  **Design call:** keep the `@ Nx` token, fix its *reading*. It carries real
  information (the implement count), and — verified by driving the parser, not
  assumed — a bare `@ 2x` with no weight round-trips clean through `parse` +
  `Canonicalise` + diagnostics, whereas the plain-load `@ ` is an *unreadable
  step* until a weight follows, so dropping the seed would read worse.
  `@ 2x⟨wt⟩` was rejected (a literal `⟨wt⟩` is held as target prose).
  **Changed** in `movementModifiers()` / `applyModifier()` in
  `apps/builder/builder.js` (+ a `.mod-hint` rule and `flex-wrap` on
  `.line-wrap` in `builder.css`), no buffer-format / grammar / core change:
  (1) the per-implement load pick's label now names the finished shape —
  `@ 2x — load, per implement (2) — then type the weight: @ 2x35lb`; (2) after
  the pick, a transient one-line hint under the row (`@ 2x is a load in each of
  2 implements — now type the weight: @ 2x35lb`, `--accent`) that clears on the
  next keystroke / blur / re-render; (3) caret position left as-is (already
  correct — end of `@ 2x`, so typing `35lb` gives `@ 2x35lb`). **Verified by
  driving the builder both `prefers-color-scheme` themes:** panel label, hint
  shows + clears, `@ 2x35lb` and bare `@ 2x` both round-trip through
  Canonicalise with clean diagnostics, plain-load Back Squat still inserts `@ `
  with no hint, laterality picks still replace-not-append with load after
  laterality in spec order. `make test` **unchanged — 2064/2064, 1 pending**
  (nothing in the core suite covers `movementModifiers` / `applyModifier`).
  *Touched:* `apps/builder/builder.js`, `apps/builder/builder.css`,
  `docs/context/topics/builder-ux.md`, `docs/context/tasks/current.md`,
  `docs/context/current/{recent-changes,next-steps}.md`.

- **2026-09-01 — `make` task surface: `:` namespaces + `deploy:db` / `backups:pull`**
  (`2c1cdb0`), a follow-up to M6. Chris's call. **(1) Rename** — every
  multi-word target now uses a `:` namespace separator instead of `-`:
  `curation-sheet` → `curation:sheet`, `curation-check` → `curation:check`,
  `curation-apply` → `curation:apply`, `movements-load` → `movements:load`,
  `movements-dump` → `movements:dump`, `deploy-dry` → `deploy:dry`. Single-word
  targets (`test`, `build`, `serve`, `deploy`, `registry`, `goldens`, `aliases`,
  `corpora`, `clean`, `install`) are unchanged. GNU Make needs the `:` in a
  target name backslash-escaped in the `Makefile` (`curation\:sheet:`), typed
  plain on the command line (`make curation:sheet`); the `help` recipe's
  grep/awk was widened to parse and print the escaped names. Verified with GNU
  Make 3.81 — `make help` lists them, each renamed target runs, the `CSV=`
  guard on `curation:check` / `curation:apply` still fires with the new name in
  its hint. **(2) `make deploy:db`** — new: `rsync -av
  deploy/pocketbase/pb_migrations/*.js $(WDL_DEPLOY_SSH):pb/pb_migrations/`
  (**no `--delete`** — the box also holds admin-UI-generated snapshot
  migrations not in the repo, e.g. `1788125462_updated_users.js`) then
  `ssh … 'systemctl --user restart pocketbase && … curl … /api/health'` so a
  new migration applies. `make deploy` stays web-only (`--delete` rsync into
  `pb_public/`); the DB side is now its own target. Motivated by finding the
  box was missing M1's `1756800000_create_movements.js` and M2's
  `1756700000_add_users_admin.js` — the `movements` table doesn't exist in
  prod yet. **(3) `make backups:pull`** — new: `rsync -av
  $(WDL_DEPLOY_SSH):pb/pb_backups/ $(WDL_BACKUP_DIR)/` (default
  `~/wdl-pb-backups`, **no `--delete`** so local history outlives the VPS's
  30-day prune), the M6 off-box copy that was previously a documented raw
  command. No app / core / grammar / spec change — suite unchanged
  **2064/2064, 1 pending**. *Touched:* `Makefile`; `deploy/README.md`,
  `docs/context/topics/{running-it,settled-decisions}.md`,
  `docs/context/tasks/{completed,current}.md`,
  `docs/context/current/recent-changes.md`, plus the `make …` references in
  `docs/context/**` and `scripts/*.mjs` header comments updated to the new
  names.

- **2026-09-01 — Movements epic M6 landed** (`97f236f`), seventh and final
  session of the M-chain — **the *Movements in the database — Phase 1* epic
  (M0–M7) is now complete**; the whole M-section moved to
  [../tasks/completed.md](../tasks/completed.md) as one grouped section (the way
  the deployment epic 18–20 and the redesign chain R1–R10 were closed). M6 is
  **VPS-side config + docs only** — no app / core / migration change; suite
  unchanged **2064/2064, 1 pending** (stated, not re-run against changed code —
  nothing was touched). A **nightly SQLite backup of the PocketBase DB** plus an
  **off-box copy** are now specified:
  - **Mechanism — a shell cron line**, not PocketBase's built-in scheduler: the
    box already carries a per-user `crontab` for the keepalive fallback, so one
    more greppable, version-controlled line beside it (schedule + retention prune
    + path visible in the repo) beats a setting buried in PB's own DB that would
    still need a separate off-box cron anyway; the "box down at the backup hour"
    risk is equal for either scheduler and small. `deploy/pocketbase/crontab.fragment`
    gains, next to the keepalive:
    `17 3 * * * sqlite3 "$HOME/pb/pb_data/data.db" ".backup '…/pb_backups/data-$(date -u +\%F).db'" … && find "$HOME/pb/pb_backups" -name 'data-*.db' -mtime +30 -delete`
    — `\%F` backslash-escaped (cron turns an unescaped `%` into a newline),
    `.backup` is SQLite's online hot-copy (captures `pb_data/data.db` only — not
    `auxiliary.db` logs or `storage/`), 30-day prune on the box.
  - **Off-box copy — a pull** from Chris's machine over the same `~/.ssh/config`
    alias `make deploy` uses (`rsync -az dreamhost.ae.wex:pb/pb_backups/
    ~/wdl-pb-backups/`, no `--delete` so local history outlives the VPS prune;
    wrapped as **`make backups:pull`** in the follow-up above),
    chosen over a VPS push cron (which would need an outbound keypair minted on
    the managed box and Chris's laptop reachable).
  - **Fallback documented:** PocketBase *Settings → Backups* (Auto backups cron +
    Max keep) for a box without `sqlite3` or when a whole-`pb_data/` zip is
    wanted.
  - `deploy/README.md` §9 "Back up (SQLite)" rewritten — the old "recommended,
    not done" note replaced with the cron lines + off-box pull + PB alternative;
    "Restore" aligned to the dated filename with the "app data only" scope noted,
    and a pointer to re-run `make movements:dump` / `movements:load` after a
    restore that rolled movements.
  - **Still to install on the box by Chris:** paste the backup line into
    `crontab -e` on the PocketBase account and verify the first backup + first
    off-box `rsync` by hand on the VPS — the same "still to do on deploy" caveat
    M1/M2/M3 carry. *Touched:* `deploy/pocketbase/crontab.fragment`,
    `deploy/README.md`; `docs/context/tasks/{completed,current}.md`,
    `docs/context/current/{recent-changes,next-steps}.md`,
    `docs/context/topics/{what-exists,running-it}.md`.

- **2026-09-01 — Movements epic M4 landed** (`e472cde`), sixth session of the
  M-chain. **`scripts/movements-from-db.mjs`** (no deps — `node:fs` + global
  `fetch`, `node:child_process` only for the `--dry-run` diff preview) +
  **`make movements:dump`**: the egress half of the round-trip whose ingest half
  is M3. It reads every `scope = "global"` row over
  `/api/collections/movements/records`
  (`filter=scope="global"&perPage=500&sort=movementId`, paged) — **no auth step**,
  the collection's list/view rule is `scope = "global"` — and rewrites
  `registry/movements.json` in its **current formatting**:
  `JSON.stringify(obj, null, 1) + "\n"`, each entry's keys walked in the order
  that entry already uses on disk, a column that is empty on the row
  (json→`null`/`[]`/`{}`, scalar→`""`) omitted — the exact inverse of M3 clearing
  an absent field, so a dump of an unmutated M3 ingest reproduces the file
  byte-for-byte and a real edit shows up as exactly the fields that changed.
  `$comment` / `version` / `$sources` copied from disk untouched; `scope` /
  `user` / the record `id` / `created` / `updated` never written. Existing
  entries keep file order; a DB row with no file entry is appended at the end
  sorted by `id` (keys `id, title, <json present>, <scalar present>`); a file
  entry with no DB row is dropped (the diff shows the removal). Prints a tally
  (rows read, entries written, added / removed / changed). **`--dry-run`** reports
  the tally + a `git diff --stat` preview and writes nothing; **`--check`** writes
  then exits non-zero if the file moved — for the round-trip test and a future
  pre-commit hook (DEC-020 leaves the cadence open; this ships no hook, just the
  building block). Target via `--api <base>` / `WDL_PB_URL` (default
  `http://localhost:8081`), so a dump can also be taken from prod. No
  `packages/core` / grammar / spec / canonical-pipeline change — suite unchanged
  **2064/2064, 1 pending**. Verified against `make serve` (mock `/api` on):
  `make movements:load` then `make movements:dump` leaves
  `git diff registry/movements.json` **empty** (byte-for-byte — the check DEC-020
  requires); a one-field PATCH of `3-4-sit-up` via `/api` then a dump moved
  **exactly that one `force:` line** and nothing else; `--dry-run` wrote nothing;
  `--check` exited 1 dirty / 0 clean. **The dump → load → dump round-trip now
  closes DEC-020's "still open" round-trip requirement.** `registry/movements.json`
  is unchanged in the commit (the dump reproduces it) — the commit is the script
  + Makefile + docs. **Next: M6** — nightly VPS DB backup cron, the last link;
  it closes the epic. *Touched:* new `scripts/movements-from-db.mjs`; `Makefile`,
  `docs/context/tasks/current.md`, `docs/context/current/next-steps.md`,
  `docs/context/current/recent-changes.md`, `docs/context/topics/what-exists.md`,
  `docs/context/topics/running-it.md`, `docs/context/topics/settled-decisions.md`
  (DEC-020).

- **2026-09-01 — Movements epic M5 landed** (`b2bd7b5`), fifth session of the
  M-chain. **`apps/shared/movement-editor.js`** — `createMovementEditor({
  container, record, api, onSaved, onCancel })`, a reusable form over one
  movement's curated fields with no builder-global dependency (it takes the
  `/api` functions and its starting record as params and scopes its DOM to the
  handed container — droppable into an admin page or the board later). The enum
  fields (`force` / `mechanic` / `load` / `defaultLaterality` / `lateralityAxis`)
  are `<select>`s whose options are exactly the registry vocabulary + "— unset
  —", so an out-of-vocab value can't be sent; `laterality` / `measures` are
  checkbox groups; the string-list fields and `muscles.primary` / `.secondary`
  are comma-separated inputs (other `muscles` keys pass through). It `POST`s /
  `PATCH`es a **`scope: "global"`** row over `/api` in the **same record shape
  `scripts/movements-to-db.mjs` (M3) writes** — json fields shape-for-shape,
  scalars straight, empties omitted on create / cleared (json→`null`,
  scalar→`""`) on update; `source` / `user` / timestamps untouched. Cross-field
  rules (an axis needs a per-side mode; a default must be ticked) and a kebab
  `movementId` check gate the write; an `/api` error (the 403 for signed-out /
  non-admin) surfaces in the form. **`apps/shared/pocketbase.js`** gained
  `listMovements` / `getMovementByMovementId` / `createMovement` /
  `updateMovement` in the same hand-rolled `fetch` style (no SDK — DEC-003 /
  DEC-008). **First hosted in the builder:** a `＋ new movement` control in the
  palette modal, an `✎` on every palette card, and an "Edit … its curated
  fields" row in a step's `»` panel — the `»` caret now shows for *any* curated
  movement, not only ones with a modifier to splice. On a save the row is folded
  into the in-memory `curatedMovements` / `catalogue` via `provide(...)` (so
  `defaultRegistry()` / `canonicalRegistry()` rebuild) and the palette / `»`
  panel re-render, so the new/edited movement shows without a reload. Nothing
  touches `packages/core`, the grammar, the spec, the migrations or the registry
  files — suite unchanged **2064/2064, 1 pending**. Verified by driving the
  builder against `make serve` (mock `/api` on, both themes): create a movement →
  it appears in the palette and `GET …?filter=movementId="cossack-squat"` returns
  it in the right shape (`scope: "global"`, json fields as arrays/objects,
  scalars as strings); edit `burpee` (enum + alias) → persisted, and
  `muscles.support` / `sources` kept; enum pickers offer exactly their
  vocabulary; invalid input writes nothing; a server restart keeps the writes
  (`fixtures/movements.local.json`); signed-out → the 403 message shows and
  nothing is created; console clean. **Next: M4** — egress DB →
  `registry/movements.json`. *Touched:* new `apps/shared/movement-editor.js`;
  `apps/shared/pocketbase.js`, `apps/builder/index.html`,
  `apps/builder/builder.js`, `apps/builder/builder.css`,
  `docs/context/tasks/current.md`, `docs/context/current/next-steps.md`,
  `docs/context/current/recent-changes.md`, `docs/context/topics/what-exists.md`,
  `docs/context/topics/builder-ux.md`, `docs/context/topics/running-it.md`.

- **2026-09-01 — Movements epic M3 landed** (`0917705`), fourth session of the
  M-chain. **`scripts/movements-to-db.mjs`** (no deps — `node:fs` + global
  `fetch`) + **`make movements:load`**: an idempotent upsert of every
  `registry/movements.json` entry into the `movements` collection over
  `/api/collections/movements/records`. It bulk-fetches the collection once
  (`perPage=500`, paged), keys on the `movementId` unique index (M1), `POST`s the
  absent and `PATCH`es only the columns that differ — a field the entry lacks is
  omitted on create and **cleared** (json→`null`, scalar→`""`) on update, so
  M4's dump → this → dump round-trips. A re-run writes nothing (reports
  all-`unchanged`); it prints a `created`/`updated`/`unchanged` tally and takes
  `--dry-run`. The nine array/object fields pass shape-for-shape into the `json`
  columns, the six scalars map straight, **every row `scope: "global"`**, `user`
  unset. **Target** is `--api <base>` or `WDL_PB_URL` (default
  `http://localhost:8081`, matching `make serve`). **Prod writes need admin
  auth**: `WDL_PB_ADMIN_TOKEN`, or `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD`
  (+ optional `WDL_PB_ADMIN_COLLECTION`, default `users`) exchanged at
  `POST /api/collections/<c>/auth-with-password`; the token rides as the
  `Authorization` header on every write. With no creds set it falls back to the
  dev-mock OAuth stub (so a bare `make movements:load` works against `make
  serve`) and against a real PocketBase errors with exactly what to set.
  **`scripts/mock-api.mjs` now accepts authorized `movements` writes** — any
  `Authorization` header stands in for admin (the mock's faked sign-in already
  hands every caller an `admin: true` fixture user), and create/update/delete
  persist to a git-ignored **`fixtures/movements.local.json`** (an overlay list +
  `deleted` tombstones) merged over the `registry/movements.json`-derived list on
  read — a bare `GET` stays open, mirroring the collection's real rules. So the
  local round-trip is real and M4/M5 can be built against `make serve`. Nothing
  here touches `packages/core`, the grammar, the spec or the migrations — suite
  unchanged **2064/2064, 1 pending**. Verified against `make serve`: first run
  creates 972 / a re-run reports all-unchanged / delete-one-then-load creates
  exactly 1 / mutate-one-then-load updates exactly 1 / no-auth write → 403 /
  `WDL_MOCK_API=0` still 404s `/api`. **Next: M5** — the movement editor widget.
  *Touched:* new `scripts/movements-to-db.mjs`; `scripts/mock-api.mjs`,
  `Makefile`, `.gitignore`, `docs/context/tasks/current.md`,
  `docs/context/current/next-steps.md`, `docs/context/current/recent-changes.md`,
  `docs/context/topics/what-exists.md`, `docs/context/topics/running-it.md`.

- **2026-08-31 — Movements epic M7 landed** (`4431683`), third session of the
  M-chain. `scripts/mock-api.mjs` — a no-deps mock of the PocketBase `/api`
  surface `apps/shared/pocketbase.js` uses — is wired into `scripts/serve.mjs`
  ahead of static handling. **On by default; `WDL_MOCK_API=0` opts out** and
  `/api/*` falls through to the old 404 / static behaviour; one startup log line
  when active. Covers: **auth** — `users/auth-methods` returns an `authURL`
  pointing at a local `/api/_mock/oauth` stub that 302s straight back to the
  client redirect URI with a canned `?code`; `auth-with-oauth2` / `auth-refresh`
  accept any code and return the fixture user (`admin: true`, so the M5 editor
  is exercisable) + a fake token in PB's `{ token, record }` shape — sign-in
  just works as one fixture identity. **`workouts/records`** — full CRUD in PB's
  list `{ page, perPage, totalItems, totalPages, items }` / record / `204`
  shapes, seeded from a committed `fixtures/workouts.json`; runtime writes
  persist to a git-ignored `fixtures/workouts.local.json` (loaded on boot if
  present, else the seed), so a restart keeps them. **`movements/records`** —
  read-only, from `registry/movements.json` mapped to the M1 collection shape
  (`movementId`, json/scalar passthrough, synthetic stable `id`,
  `scope: "global"`) and wrapped in the PB list envelope; `/records/:id` by
  synthetic id or `movementId`; writes return `403` (mirrors the admin-only
  rule). Minimal query support only as far as the client needs:
  `filter=field="value"` (AND), `sort`, `page`/`perPage`. New committed
  `fixtures/users.json` + `fixtures/workouts.json`; `fixtures/workouts.local.json`
  git-ignored. Nothing touches `packages/core`, the grammar, the spec or the
  migrations — production is unaffected (PocketBase serves real `/api` there).
  Suite unchanged **2064/2064, 1 pending**. Verified by curl over every
  endpoint and by driving the builder — Google sign-in completes the full
  redirect flow as the fixture user and *My workouts* populates from the mock;
  `WDL_MOCK_API=0 make serve` still starts and `/api` 404s. **Next: M3** —
  ingest `registry/movements.json` → the `movements` collection. *Touched:* new
  `scripts/mock-api.mjs`, `fixtures/users.json`, `fixtures/workouts.json`;
  `scripts/serve.mjs`, `.gitignore`, `docs/context/tasks/current.md`,
  `docs/context/current/next-steps.md`, `docs/context/topics/what-exists.md`,
  `docs/context/topics/running-it.md`.

- **2026-08-31 — Movements epic M1 landed** (`00c29a5`), second session of
  the M-chain. `deploy/pocketbase/pb_migrations/1756800000_create_movements.js`
  creates the `movements` PocketBase collection ([DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)):
  one column per per-movement field in `registry/movements.json` — `movementId`
  (text, required — the registry `id`, not `id`); `title` (text, required);
  `force`/`mechanic`/`load`/`lateralityAxis`/`defaultLaterality` as `select`
  (single); every non-scalar field (`aliases`, `muscles`, `pattern`,
  `laterality`, `measures`, `implements`, `equipment`, `related`, `sameAs`) as
  `json` so the dump/load is shape-for-shape; `source` (text); plus `scope`
  (`select global|user`, required — M3 writes every row `global`), `user`
  (relation → `users`, nullable/cascade, unused until Phase 2), and
  `created`/`updated` autodates. Unique index on `movementId` (M3's idempotency
  key), plain index on `scope`. Read rules `scope = "global"` (readable
  signed-out); create/update/delete `@request.auth.admin = true` — the field M2
  added. `down` deletes the collection. Verified locally against a real
  PocketBase v0.40.1 binary + throwaway `pb_data`: `migrate up` applies all
  three migrations cleanly, the collection and both indexes land, `migrate down
  1` drops it; binary discarded, not committed. No `packages/core` change —
  suite **2064/2064, 1 pending**. **Next: M7** — local dev mock `/api` +
  fixtures. *Touched:* new
  `deploy/pocketbase/pb_migrations/1756800000_create_movements.js`,
  `deploy/pocketbase/pb_migrations/README.md`, `deploy/README.md` (new §7b),
  `docs/context/tasks/current.md`, `docs/context/current/next-steps.md`.

- **2026-08-31 — Movements epic M0+M2 landed** (`ea2a64f`), first session
  of the M-chain. **M0:** [DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump)
  recorded — the curated movement layer is edited in a PocketBase `movements`
  collection; `registry/movements.json` stays as its reviewable committed dump
  (`make movements:dump`, M4) and the unchanged offline file `packages/core` /
  tests / `build-canonical.ts` read; production reads
  `/api/collections/movements/records`, local `make serve` reads a mock (M7)
  with `registry/movements.json` as the fixture. Dump cadence + prod-edit dump
  timing left explicitly open in the DEC. **M2:**
  `deploy/pocketbase/pb_migrations/1756700000_add_users_admin.js` adds a
  `bool admin` field to the `users` collection (edits an existing collection via
  `fields.add(new Field(...))` / `fields.removeByName`), so M1's write rules can
  be `@request.auth.admin = true`. Verified locally against a real PocketBase
  v0.40.1 binary + throwaway `pb_data` — `migrate up` applies it and the
  workouts migration cleanly, `migrate down 1` reverts it; binary discarded, not
  committed. Still to do on deploy: set Chris's `users` row `admin: true` in the
  admin UI (`deploy/README.md` §7a). No `packages/core` change — suite
  **2064/2064, 1 pending**. **Next: M1** — the `movements` collection + migration.
  *Touched:* `docs/context/decisions.md`,
  `docs/context/topics/settled-decisions.md`, new
  `deploy/pocketbase/pb_migrations/1756700000_add_users_admin.js`,
  `deploy/pocketbase/pb_migrations/README.md`, `deploy/README.md`,
  `docs/context/tasks/current.md`, `docs/context/current/next-steps.md`.

- **2026-08-31 — New epic: Movements in the database — Phase 1 (M0–M7)** (no
  code yet; task breakdown only). Chris, trying to run the first laterality pass
  through `curation-sheet.csv`, found the spreadsheet unworkable and realised
  movement create/edit wants to be an in-app GUI, hit *while building a workout*.
  Direction: the curated `registry/movements.json` layer moves into a PocketBase
  `movements` collection (a `scope` field `global|user` + a nullable `user`
  field for Phase 2), edited through a reusable widget; ingestion loads the JSON
  in, a reviewable dump writes it back to the repo, `build-canonical.ts` and
  `packages/core` are untouched. Two scopes: **global** (admin-edit — needs an
  admin `bool` on `users`, M2) now; **user-scoped** deferred to Phase 2
  ([../tasks/deferred.md](../tasks/deferred.md)). **M7** adds a **mock `/api` for
  local `make serve`** — on by default, served from committed fixtures
  (`registry/movements.json` doubles as the movements fixture; sample `fixtures/`
  for users + workouts), so local dev — including auth and saved workouts, which
  currently just 404 — works without PocketBase. **M6** is a **nightly VPS DB
  backup cron** — a pre-existing gap, never set up (only the keepalive cron
  exists). The CSV flow shipped below is **kept for bulk** sweeps. Full
  breakdown in [../tasks/current.md](../tasks/current.md) "Movements in the
  database"; direction in
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

- **2026-08-31 — The movement-curation sheet has a committed generator, and
  `lateralityAxis` is in its CURRENT block** (a one-off, not a queue item, in
  prep for the unscheduled laterality sweep). `scripts/export-movement-curation.mjs`
  (`make curation:sheet`) writes `curation-sheet.csv` at the repo root
  (git-ignored) — the audit sheet that `import-movement-curation.mjs` reads back
  was "built ad hoc, not checked in" before this. 32 columns: IDENTITY, a
  reference-only CURRENT block, a blank CURATE block; the two scripts share the
  layout by position. `Laterality axis` was added to the CURRENT block (it was
  CURATE-only since 13a-curation), so `import-movement-curation.mjs`'s
  `CURRENT_HEADERS` gained it too — `CURATE_START` is computed, so that one
  string is the whole importer change; CURRENT cells are never read back.
  Verified the round-trip: generate → import dry-run reports 972 rows, all
  blank, 0 changes, 0 unknown ids (proves the header check agrees); a hand-filled
  CURATE cell still applies. `docs/context/topics/running-it.md` updated.
  Also this session: a `loadKilograms` test in `packages/core/test/units.test.ts`
  pinning that a paired load (`2x24kg`) moves twice a single one (2064/2064,
  was 2063); and two new **open** items in
  [../tasks/current.md](../tasks/current.md) — the `»` panel's bare `@ 2x`
  per-implement token reading as cryptic mid-edit (self-contained, dispatchable),
  and a note that `around-worlds` itself looks mis-sourced (free-exercise-db's
  entry is a dumbbell bench fly, not the kettlebell around-the-head movement its
  curation describes) for the sweep to resolve.

- **2026-08-31 — The `»` panel splices laterality/load after the whole typed
  movement word** (`e27339a`, a one-off follow-up, not a queue item). `applyModifier`
  in `apps/builder/builder.js` derived the splice point from `entryTitle.length`
  whenever the typed name started with the registry title, so a plural or inflected
  name (`Dumbbell Snatches` for entry `Dumbbell Snatch`) spliced the token mid-word
  and stranded the suffix: `- 8 Dumbbell Snatch (each side) es`. Pre-existing since
  13c (`02d819d`), independent of 13a. The seam calc in both the title- and
  load-insert branches is now `titleMatchLen(fragment, entryTitle)`, which extends
  the match through the trailing letters/apostrophe of that same word when
  `fragment` starts with `entryTitle`, and keeps the whole-fragment fallback for
  names that don't (aliases like `DB Snatch`). Bare `each side` fixed identically.
  Builder-only; suite 2063/2063 (nothing in the core suite covers
  `movementModifiers`/`applyModifier`). Drove the builder both themes: the repro
  now yields `- 8 Dumbbell Snatches (each side)`; plural + load lands `@ ` after
  the whole name and before a comma modifier; singular, alias, and `around-worlds`
  (`each direction`) still splice cleanly and `Canonicalise` round-trips.

- **2026-08-31 — The builder `»` panel renders `lateralityAxis`** (`1ffc8d0`,
  queue item **13a** — **this closes item 13 entirely**). `movementModifiers()`
  in `apps/builder/builder.js` built the per-side laterality option as the
  pre-13b bare ` each side` and ignored `entry.lateralityAxis`. It now inserts
  `` `(each ${entry.lateralityAxis ?? 'side'})` `` — parenthesised per DEC-019,
  axis-aware with a `side` fallback — so `12 Around The Worlds` offers
  `(each direction)` and a per-side movement with no curated axis
  (`bulgarian-split-squat`) falls back to `(each side)`. `LATERALITY_RE` (the
  exclusive-class strip `applyModifier` runs before a laterality pick) gained
  the parenthesised per-side form and `direction`, so a previously-inserted
  `(each arm)` / `(each direction)` toggles off on re-pick and is replaced
  cleanly by a different mode — no doubling. Builder-only; no `packages/core`
  change; suite 2063/2063 (nothing in the core suite covers `movementModifiers`).
  Drove the builder both themes: insert, toggle, replace, round-trip through
  `Canonicalise` all verified. Uncovered but left alone — a pre-existing
  `applyModifier` bug (13c `02d819d`) that strands a plural suffix when the
  typed movement name is plural and the registry title singular; recorded in
  [../topics/builder-ux.md](../topics/builder-ux.md).

- **2026-08-31 — `lateralityAxis` — the axis a per-side count runs across**
  (`71f9469`, queue item **13a-curation**). A per-side count is "each
  *something*" — `side` usually, `arm` for a single-arm press, `direction` for
  a dumbbell circled around the head. A curated root field on a movement entry
  (`MovementEntry.lateralityAxis?: 'arm'|'leg'|'side'|'hand'|'direction'`,
  `fold.ts`), so a tool renders `(each direction)` instead of a generic
  `(each side)`. `import-movement-curation.mjs` gained a "Laterality axis"
  CURATE column; `build-movements.mjs`'s `handKept` now carries the laterality
  fields onto free-exercise-db-sourced records (they were silently dropped).
  `around-worlds` is the one vetting entry (`lateralityAxis: "direction"`, plus
  `laterality: ["per-side"]` it lacked); a full sweep is unscheduled. Nothing in
  `packages/core` reads the field yet — the builder `»` panel is the still-open
  **13a**. The panel now *appears* for Around The Worlds (was hidden) offering
  the generic `each side` until 13a. Suite 2063/2063.

- **2026-08-31 — The per-side laterality form is parenthesised: `(each arm)`**
  (`cf3c47f`, queue item **13b**,
  [DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised-each-arm)).
  `format.ts` wrote `(split)` / `(both)` parenthesised but `per-side` as a bare
  ` each side`; Chris wanted parity. Now all four modes are parenthesised —
  `(each <axis>)` names the count mode and the axis (`arm | leg | side | hand |
  direction`). **`direction` is a new axis word** — a rotation once each way —
  and the parser now *reads* the parenthesised per-side form, which it could
  not: `(each direction)` used to fall to `unreadableParen` and be held as
  unknown. `total` still maps to `(split)`, `(both)` stays distinct, bare
  `each arm` still parses. `spec/grammar-0.1.ohm` (`laterality` → `-- word` /
  `-- perSide`, `limbWord += direction`), `step-semantics.ts`, `format.ts`,
  `spec-0.1.md` §4/§7/§11.1, tests, and **9 corpus files reformatted
  `each X` → `(each X)`** — which moved only those 9 `text` fields in
  `workouts.canonical.json` (0 AST / 0 summary changes; `interpretations.json`
  byte-identical). Suite 2060 → 2063 passing. No app code — the builder `»`
  panel piece is the still-open 13a.

- **2026-08-31 — A bare-label block header is an inert section, not an
  "unrecognized header" error** (`70a1852`, queue item **11**,
  [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section)).
  A head that is entirely a bare label — letters, spaces and hyphens, no digit
  anywhere, and not opening with a kind-word — now parses as `type: 'section'`
  (the inert labelled container the fixed eight section words produce, spec §2's
  "any custom label") instead of a `type: 'sequence'` carrying an `unrecognized
  block header` error. `Barbell movements:` inside `3 rounds for time:` is a
  clean visual layer; the rounds still cycle every descendant. Four Chris calls:
  read it **and** emit a `note` (`validate.ts` `custom-section`, per DEC-010 —
  a coined heading could be a typo); preserve the label's case verbatim; a digit
  anywhere or a leading kind-word missing its parameter (`RFT:`, `every:`)
  stays the error (narrow `kindLead` exclusion, ruled on when the first
  `make test` showed the conflict with spec §5.2); a new grammar production
  (`customSection`), not a `parse.ts` reclassification (DEC-006 / DEC-007).
  Must-not-break preserved: `Barbell movements, 3 rounds:` still takes the kind
  after the comma and reports the leftover label. `spec/grammar-0.1.ohm`,
  `block-semantics.ts`, `parse.ts` (comments only), `validate.ts`,
  `spec-0.1.md` §2/§5.1/§5.2/§11.1, tests. Suite 2049 → 2060 passing (1
  pending); block-headers harvest 250 → 254; corpus unchanged
  (`interpretations.json` byte-identical, `workouts.canonical.json` date-only).
  Builder driven both themes.

- **2026-08-31 — Builder `»` panel: laterality and measured-output picks
  replace instead of appending** (`02d819d`, queue item **13c** — one strand of
  item 13, shipped alone; **13a / 13b stay open** and item 13 is not closed).
  `applyModifier` with `position: 'title'` spliced the chosen laterality text in
  after the movement title without checking the line, so `(split)` on top of
  `each side` gave `Dumbbell Snatch (split) each side` and picking a mode twice
  gave `(split) (split)`; the measured-output picks (`position: 'end'`) had the
  same double-append. Now each pick first strips every existing token of its
  mutually-exclusive class — parenthesised laterality (`(both)` / `(split)` /
  `(per-side)` / `(total)`), inline `each|per <limb>`, and
  `, count cal|calories|distance|reps` — then inserts, or clears it (toggle off)
  when the mode already on the line is re-picked. `apps/builder/builder.js`
  only, no core change; suite 2051 passing, 1 pending. Verified driving the
  builder against `Dumbbell Snatch` and `Row`: replace both directions, toggle
  off, diagnostics clean.

- **2026-08-31 — Reads-as tab: the "show every cue" toggle is gone; both
  subsections always show** (`c876691`, Chris, from using it). The per-cue list
  sits at the bottom of the panel and displaces nothing, so hiding it bought
  nothing. `renderReadsAs()` now always renders the terse block-grouped reading
  and then the full uncapped per-cue list under an `EVERY CUE (N)` label. The
  toggle, the `expanded` branch and `localStorage['wdl.reads-expanded']` are
  removed (stale key left harmless). `apps/builder/{builder.js, builder.css}`,
  no core change; suite 2051 passing, 1 pending. **Follow-up (`a8e5d6f`):** a
  `.round-start` class on the first cue of each new round opens a half-line
  (`margin-top: .5rem`), so the every-cue list reads as N groups.

- **2026-08-31 — Builder: the editor/analysis split is draggable, and the body
  map scales with the margin** (`83bfb78`, from Chris using it). The sheet was
  `minmax(0,1fr) 24rem` capped at 1120px, so a wide window added dead margin
  and the analysis column was stuck at 24rem. Now: sheet cap 1600px; the
  margin width is `--right-col-w` on `.sheet` with a `<div class="col-resize">`
  drag handle between the columns. `builder.js` tracks the drag on `window`
  (pointer + mouse, no capture), clamps to a 22rem editor floor / 18rem margin
  floor, persists the unclamped *intent* to `localStorage['wdl.right-col-w']`
  and re-clamps it to the sheet on resize. Double-click resets; arrows nudge.
  Hidden below 820px (single column). The builder body map overrides the
  shared 78px so its two figures split the panel width (each capped 190px) —
  a wider margin → a bigger diagram. `apps/builder/*` only, no core change;
  suite 2051 passing, 1 pending. Verified light + dark and at 1680 / 1024 /
  900 / 760px (drag, keyboard, reset, persist-across-reload, resize re-clamp).

- **2026-08-31 — `make deploy` defaults `WDL_DEPLOY_SSH` to `dreamhost.ae.wex`.**
  The Makefile now sets `export WDL_DEPLOY_SSH ?= dreamhost.ae.wex`, so a bare
  `make deploy` / `make deploy:dry` works on Chris's box without prefixing the
  env var. `?=` still defers to the environment when it is set (any other host
  wins), and the value is a `~/.ssh/config` alias — no host, user or secret —
  so it is safe in the repo. The raw `node scripts/deploy-web.mjs` form does
  **not** inherit the default. Verified with GNU Make 3.81: unset → the
  default reaches the recipe; env-set → the env value wins. *Touched:*
  `Makefile`, `docs/context/topics/running-it.md`, `settled-decisions.md`
  (DEC-017).

- **2026-08-31 — Builder Analysis tab: the per-cue list is gone; the summary
  band is height-capped** (`8720a62` then `9537905`, from driving the builder).
  A workout that unrolled into dozens of cues grew the Analysis tab's `#steps`
  list unbounded and pushed the body map + goals block off the bottom — the
  only scroll container was `#view-analysis` as a whole. `8720a62` first
  bounded `.summary` and `#steps` (each `max-height` + `overflow-y: auto`).
  Then, on Chris's call, the `#steps` list was **removed from the Analysis tab
  entirely**: it was a capped duplicate of the "Reads as" tab's *show every
  cue* expansion (same `cueRow()`), and it was in the way of the two sections
  that tab is for. `#view-analysis` is now directives → diagnostics → body map
  → goals; the run reads only on "Reads as". `.summary` keeps its
  `max-height: 9rem` cap. CSS + JS + HTML in `apps/builder/*`, no core change;
  suite 2051 passing, 1 pending. Verified light + dark, wide + narrow.

- **2026-08-31 — The board no longer renders the `@`-directive preamble as body
  rows; `@id` / `@tags` lifted into the header chrome — item 15 is now fully
  closed** (`9bbda82`, queue item 15b). `draw()` in `apps/display/board.js`
  built one row per raw source line and special-cased only blank / `//` lines,
  so `@wdl` / `@id` / `@date` / `@tags` sat at the top of what the athlete reads
  mid-set and `@id` was never stripped. Now `preambleEnd()` finds the leading
  run of blank / `//` / `@key` / `# title` lines and, within that run only, a
  zero-indent `@key` line (matched as core's `tryDirective` does) gets a
  `.preamble` class hidden in CSS. The row is still built, so `dataset.line`
  stays 1:1 with the source and `paint()`'s physical-line cue matching + scroll
  are untouched (the write-up's preferred shape). A new `#meta` strip under the
  bar shows `@id` verbatim and `@tags` as chips, only when the workout sets one
  of them. The workout **body renders byte-for-byte as before** — same rows,
  same blank/comment handling, same marker / `done` / scroll, division picker
  unaffected. The `# title` was kept as the first board row (a reversible
  default — an open question for Chris whether it moves into the strip too). No
  core change (suite 2051 passing, 1 pending). *Touched:*
  `apps/display/board.js`, `board.css`, `index.html`.

- **2026-08-31 — A root `Makefile` is now the single task surface for the dev
  lifecycle** (queue item 21, [DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson)).
  `make` (or `make help`) lists the targets: `test`, `build`, `serve`
  (`PORT=NNNN` overridable), `registry` (the whole `build-canonical.ts`
  pipeline), `goldens` (regenerate + `git diff --stat`), `aliases`, `corpora`,
  `deploy` / `deploy:dry`, `clean`, and `install` (which just says "nothing to
  install"). Every target is a thin wrapper over the `node scripts/*` /
  `npm --prefix` command that already existed — discoverability, not new build
  logic — and those raw forms still run directly. A root `package.json`
  `scripts` block was the alternative and was rejected: the repo is
  install-free on purpose (no `node_modules`, no lockfile, `ohm-js` vendored)
  and a `package.json` invites `npm install` + a lockfile; `make` adds nothing.
  The command list at the top of
  [../topics/running-it.md](../topics/running-it.md) now leads with the `make`
  targets. *Touched:* new `Makefile`; `docs/context/topics/running-it.md`,
  `settled-decisions.md`, `decisions.md`. No code change.

- **2026-08-31 — Builder layout redesign, R10 of 10: directive metadata block +
  `@`-key type-ahead — the R1–R10 chain is complete** (`5f79ea3`). **15a:** a
  read-only `#directives` block at the top of the Analysis tab, painted by a new
  `renderDirectives()` off the top of `renderReading()`, lists the `@key value`
  preamble read straight off `parse().workout.directives` — `wdl` / `id` /
  `date` / `author` and any `@x-…` extension as verbatim key/value rows, `tags`
  split on comma into chips. It repaints on every edit path, survives a compile
  failure below it (read off the parsed tree, not the run), and is hidden
  entirely when the workout sets no directives — no empty block, no heading.
  Bordered aside with the shared `--kind-directive` accent, both themes.
  **15d:** on a zero-indent `@` outline row with the caret still in the key, the
  movement suggestion dropdown offers a builder-held directive-key list instead
  (`@wdl` / `@id` / `@date` / `@tags` / `@author` / `@x-`, one description each)
  — a parallel branch in `openSuggestions()` plus `pickDirectiveKey()`, reusing
  the `.suggestions` widget and its Arrow/Enter/Escape handling; a pick fills
  the key (`@id `, caret past the space; `@x-`, caret past the dash). Guarded on
  raw-line indent so a `@ 40kg` load fragment never triggers it, and movement
  suggestions on step rows are unchanged. **15b** (the board rendering preamble
  lines as body rows) stays open as an independent item. With R10 the ten-stage
  builder layout redesign (direction C, "Document + margin") is **complete** —
  R1–R10 are grouped as one section in
  [../tasks/completed.md](../tasks/completed.md). No core change — suite **2051
  passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R9 of 10: the Text tab traps Tab and
  carries a syntax-highlight layer** (`05efea0`). `#text` is wrapped with a
  new `<pre id="text-hl">` in a positioned `.text-wrap`; the textarea paints
  `color: transparent; caret-color: var(--ink)` over the layer, which holds the
  same text re-tokenised on every `input` — one colour per line kind from the
  shared `--kind-*` palette (R3), lexically classified by a new `textLineKind()`
  mirroring the Outline's `data-kind` vocabulary (title / directive / comment /
  section / header / step / rest). Every text-metric property is shared between
  the two in one CSS rule and `scrollbar-gutter: stable` is set on both, so the
  caret sits on the layer's glyphs under wrapping and at every scroll offset (a
  `scroll` listener copies `scrollTop`/`scrollLeft`). The layer repaints from
  `render()` and the outline-row write-back paths via a new `paintText()` helper
  (`el('text').value = text()` → `paintText()`), and from the `input` handler
  via `paintTextHl()`. A new `keydown` handler on `#text` traps **Tab** (two
  spaces at the caret), **Shift-Tab** (drop up to two leading spaces),
  multi-line **Tab/Shift-Tab** (indent/dedent every touched line, selection
  preserved) and **Enter** (carry the line's leading indent, plus two more when
  it ends in `:`); every branch edits through `document.execCommand('insertText')`
  (with a `setRangeText` fallback) so native undo and the `#dirty` badge keep
  working and the existing `input` handler re-splits `lines`. No core change —
  suite **2051 passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R8 of 10: the set repertoire is a
  first-class Sets section of the palette modal** (`356e84f`). R7 physically
  moved `#repertoire` inside the modal but left it a tucked-away
  `<details><summary>Sets</summary>`. R8 makes it visible and titled:
  `<section id="repertoire">` with an `<h2>Sets <span
  id="repertoire-count"></span></h2>` bar in the same treatment as the
  "Movements" head, the New set / Save showing / Export / Import strip, then a
  scrolling (`max-height`) `#set-list`. Every id `builder.js` binds stays
  stable; the three now-meaningless `el('repertoire').open = true` lines
  (set-new / set-save / set-import) are gone. New `shownMovements()` factored
  out of `renderPalette`, and a new `addShowingToSet(name)` behind a per-card
  `⊕` button that folds the currently-shown palette list into that set — the
  "compose from the current results" half of the brief, next to the existing
  checklist toggle. `renderSets` / `renderSetList` / `renderSetCard` /
  `renameSet` / `addSetToOutline` / `setsChanged` unchanged in behaviour;
  `localStorage['wdl.sets']` and the `{format:'wdl-movement-sets', version:1,
  sets}` export/import envelope unchanged. No core change — suite **2051
  passing, 1 pending**. *Touched:* `apps/builder/index.html`,
  `apps/builder/builder.css`, `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R7 of 10: the movement palette is a
  ⌘K / add-row modal; the transitional drawer is retired** (`d1a89ce`). The R1
  overlay drawer behind the header `☰ Movements` toggle is gone. The palette is
  now a summoned `<dialog id="palette-modal">` holding the same inner DOM —
  `#search`, `#set-pick`, `#muscle-filter` chips, `#palette`, and `#repertoire`
  (set management untouched; R8 folds it in). It opens on **⌘K / Ctrl-K**
  anywhere, on **+ movement**, and on **Enter on an outline row**; picking a
  movement inserts `lineFor(m)` at the focused row via the existing write-back
  (`replaceLogical` when that row is blank, else `insertAfter`) and closes.
  Esc (the `<dialog>` `cancel` event) and a backdrop click both close through a
  `closePalette` that hands focus back to the editor; Esc while composing a set
  exits compose mode first, as the drawer's Esc did. All three filters still
  combine inside the modal — text, muscle chips (AND), saved set — with every
  filter id stable, so `renderPalette` / `renderMuscleChips` needed no change;
  they now render on open and re-render on filter input, as before. ⌘K is scoped
  and only `preventDefault`s when it should open, and is a no-op mid-IME.
  Removed: `#drawer` / `#drawer-backdrop` / `.drawer*` CSS / `setDrawer` / the
  `#palette-toggle` header button and its handlers / `.ghost` CSS / the
  `wdl.palette-open` bootstrap (the modal has no persistent open state). No core
  change — suite still **2051 passing**, 1 pending. *Touched:*
  `apps/builder/index.html`, `apps/builder/builder.css`,
  `apps/builder/builder.js`.

- **2026-08-31 — Builder layout redesign, R6 of 10: per-section muscle "adds"
  below the body map** (`895404a`). The Analysis tab shows one whole-workout
  body map; for a workout with named sections there was no read of what each
  section contributes. R6 adds, between `#body-hint` and the goals block, one
  terse `.adds-line` per top-level named section — *"warmup adds: glutes,
  quads, chest, triceps, …"* — naming the distinct muscles that section brings
  in (primary in workout order, then secondary marked "(light)", capped at 6
  with "…"; "—" when a section has no attributed movement). Derivation is
  entirely app-side, in a new `renderBlockAdds()` called from the top of
  `renderBody()` so it survives every re-render path: it re-parses/compiles,
  filters `workout.body` for `n.node === 'block' && n.type === 'section'` (the
  same test R3's `kindOf` and R4 use), and scopes `exposures(timeline).list` to
  each section by matching `e.path[0]` to the section's index in
  `timeline.root.items` — found by source line, not position, so a top-level
  `xN` step or `every` interrupt can't misalign it. Nothing renders for a
  sectionless workout (no container content, no heading); the adds lines don't
  change with the `#body-mode` picker. New `#block-adds` container;
  `.block-adds` / `.adds-line` / `.adds-label` use `--ink` / `--dim` / `--rule`
  only — no `--kind-*` / `--rail` touch. Verified light + dark with a
  multi-section workout, mode-switch, and a sectionless workout. No core change
  — suite still **2051 passing**, 1 pending. *Touched:*
  `apps/builder/builder.js`, `apps/builder/builder.css`,
  `apps/builder/index.html`.*

- **2026-08-31 — Builder layout redesign, R5 of 10: Goals restyled into a
  proper block in the Analysis tab** (`47fd26b`). The goals controls — an `<h2>`
  with an inline `<select>`, a loose button row, then three stacked `<ul>`s —
  are now a titled `<section class="goals-block">`: heading, a `.goals-bar`
  holding the set picker (`#goal-pick`, now a bordered control) beside the
  `.goal-tools` toolbar (Edit rules / Open… / Save as… / `.wdlg` / Delete), the
  `#goal-text` `.wdlg` editor revealing inline beneath it, and `#goal-errors` /
  `#goal-notes` / `#findings` grouped in a `.goals-out` output region. **DOM
  reorganise + CSS only** — every id is stable and every handler in `builder.js`
  is untouched (all bound by id, none container-scoped), so no `builder.js`
  change was needed. `.goal-tools` carries its own flex now the `.row.tight`
  wrapper is gone; the hidden `<input id="goal-file">` stays in the DOM. Both
  themes, existing `--ink` / `--dim` / `--rule` / `--panel` tokens only — no
  `--kind-*` / `--rail` touch. Verified light + dark: picker options, Edit rules
  reveal/hide + live re-check, Save as… → set appears in the picker, Delete
  shows for a saved set and removes it; the summary band `<dl>`, `#steps`,
  `#diagnostics`, the body map and the Reads-as tab are all unchanged. No core
  change — suite still **2051 passing**, 1 pending. *Touched:
  `apps/builder/index.html`, `apps/builder/builder.css`.*

- **2026-08-31 — Builder layout redesign, R4 of 10: Reads-as tab is a
  block-grouped run reading + a show-every-cue toggle** (`f8cb0a8`). The
  **Reads as** margin tab, an empty placeholder since R1, now carries
  `renderReadsAs()`: (a) the run grouped by block, read off
  `parse().workout.body` rather than cue-by-cue — one titled group per
  top-level block, header label taken from the raw source line as written (`:`
  and any inline body dropped, so rounds / scheme / window are stated once by
  the header, not repeated per rep), direct steps + rests collapsed onto one
  `·`-joined inline row (`Air Squat ×10 · 200m Run · rest 1min`), nested blocks
  and `every` overlays recursed with a left rule; synthesised label fallback
  when a header node has no physical line. (b) A **"show every cue (N)"** toggle
  to the full, uncapped per-cue list — the same rows `#steps` builds, factored
  into a shared `cueRow()` helper so the Analysis tab's capped list and this one
  cannot drift; state in `localStorage['wdl.reads-expanded']`, read fresh each
  paint so it survives a re-render, a tab switch and a reload. `renderReading`
  still owns `#summary` / `#diagnostics` / `#steps` untouched — the summary band
  `<dl>` and the Analysis cue list are unchanged. Compile failure degrades to a
  short message in `#view-reads`, no exception. Both themes; new CSS is existing
  `--ink` / `--dim` / `--rule` tokens only. No core change — suite still **2051
  passing**, 1 pending. Verified by driving the builder light + dark with a
  named `warmup:` section, a `21-15-9 for time:` ladder, an `AMRAP 12min:` with
  an inline `rest`, and a top-level `rest`. *Touched: `apps/builder/builder.js`,
  `apps/builder/builder.css`.*

- **2026-08-31 — Builder layout redesign, R3 of 10: Outline as a document +
  per-kind rails** (chain item 16, folding in 15c; `d8edde3`). The Outline row
  rhythm loosened; the `#` title renders as a heading set apart with air beneath;
  zero-indent `@` directives render as a dim, smaller preamble block a notch
  under the title and above the workout body — presentation only, every
  `input.line` / write-back path unchanged. New **`--rail`** token darker than
  the `--rule` hairline (light ~2.3:1 against page and panel, up from the
  design-critique's ~1.05:1; dark ~2.3:1), pointed at by `.node .rail`, which now
  stretches to the row's full height so nesting levels read as continuous lines.
  New shared **`--kind-*`** colour tokens (`title`, `directive`, `section`,
  `header`, `step`, `rest`, `comment`), defined in both themes and named for the
  line kind — **R9's Text-tab highlighter consumes these** — each driving a thin
  coloured left edge on `.node .line-wrap`. `renderOutline` builds a `kindOf` map
  off `parse().workout.body` (step / rest / `section` = block `type==='section'`
  / `header` = every other block type + `interrupt`); the walk classes
  `data-kind` from raw text for title + directive + the synthesised comment row,
  from `kindOf` otherwise, falling back to colon-terminated → `header` else
  `step` — so a broken step keeps the step marker under the `.bad` red border
  ("a step, and broken"). No core or grammar change — suite still **2051
  passing**, 1 pending. Verified by driving the builder light + dark with a
  titled, directive'd, commented, multi-section workout including a `rest 90s`
  and a deliberately broken step. *Touched: `apps/builder/builder.js`,
  `apps/builder/builder.css`.*

- **2026-08-30 — Builder layout redesign, R2 of 10: comment rows first-class in
  the Outline + a comment-aware splice in `edit.ts`** (chain item 12, `973d80a`).
  `spans()` now gives every own-line `//` comment its own single-line span, so
  `replaceLogical` / `remove` / `insertAfter` / `moveTo` address a comment line
  unchanged; `move` and `shift` took a dedicated comment path because the
  following node's span still swallows the comments written above it (moving a
  block keeps carrying `// the buy-in`) and a shared splice would double-cut.
  `move` on a comment steps it over the adjacent rendered row — another comment
  (a line swap) or a real node (past that node's whole subtree). `renderOutline`
  synthesises a `.node.comment` row per own-line comment, above the line it
  attaches forward to and at that line's depth; a trailing comment on a content
  line stays in that row's input; trailing/orphan comments render at the margin.
  `+ comment` joins the add-row buttons (inserts `// ` at the focused row). The
  move/reorder drag wiring is now a shared `attachRowDrag`. Also fixes the stray
  empty `data-line="0"` row a trailing-comment file used to draw. Verified by
  driving the builder light + dark (own-line comment above a block, trailing on
  a step, trailing at EOF — all visible and editable; add/edit/delete/indent/
  move/drag write back and survive a Text-tab switch; Canonicalise + diagnostics
  unaffected). Suite 2038 → **2051 passing**, 1 pending (13 cases in
  `test/edit.test.ts`). *Touched: `apps/builder/builder.js`,
  `apps/builder/index.html`, `packages/core/src/edit.ts` + `test/edit.test.ts`.*

- **2026-08-30 — Builder layout redesign, R1 of 10: the layout shell landed.**
  Direction **C (Document + margin)** — a fixed header (WDL mark · `☰ Movements`
  toggle · centred document title read off `parse(text()).workout.title` ·
  Open…/Download/board file cluster · item-20 identity + My workouts), a
  scrolling `.stage` holding a centred `.sheet` grid: the editor (Outline/Text
  tabs, unchanged) beside a right column = a **sticky summary band** (the
  `title / cues / duration / cap / score` `<dl>`, split out of `renderReading`)
  + an **[Analysis][Reads as]** tab strip. Analysis (default) carries the cue
  `#steps` list, `#diagnostics`, the body map, and the whole goals block, and
  **has its own `overflow:auto` + bounded height** — a long analysis scrolls
  inside it instead of pushing the page, the read-pane scroll bug the
  design-critique flagged 🔴. Reads-as is an empty placeholder for R4.
  `Canonicalise` moved from the header onto the editor's tab strip (it acts on
  the buffer). Movements is now a transitional overlay **`.drawer`** behind the
  `☰` toggle (`localStorage['wdl.palette-open']`, default closed) with all its
  `#palette` / `#search` / `#set-pick` / `#repertoire` / `#muscle-filter` DOM
  unchanged inside it — R7 retires it. The three-column `main` grid and the
  1180/900 breakpoints are replaced by the sheet layout (1100px narrowing,
  820px single-column stack). **No behaviour change** — every feature
  re-housed, verified by driving the builder light + dark at 1440/1280/1000/
  700px. `setAnalysisTab` persists to `localStorage['wdl.analysis-tab']`
  (default `analysis`). No `packages/core` change — suite still 2038 passing,
  1 pending. *Touched: `apps/builder/index.html`, `builder.css` (wholesale),
  `builder.js` (doc-title in `renderReading`, `#steps` split out of the
  summary, `setAnalysisTab`, the drawer toggle).* The R-series (R1–R10) closes
  together — see [../tasks/current.md](../tasks/current.md).

- **2026-08-30 — Accounts, saved workouts and sharing in the apps (queue item
  20 — live).** Final item of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage));
  the epic (18–20) is now closed in
  [../tasks/completed.md](../tasks/completed.md).
  Additive on the static apps — signed out, nothing changed (`Download .wdl` /
  `Open…` a local file untouched); `packages/core`, the grammar and the spec are
  not touched, a stored workout is its `.wdl` text in a column.
  - **`apps/shared/pocketbase.js`** — a **hand-rolled ~8-call `fetch` client**,
    no SDK (DEC-003 / DEC-008: no npm runtime dep, no build step, same rule that
    vendors `ohm-js`). Google OAuth2 by the **redirect flow**, not the SDK's
    popup+realtime dance: `GET auth-methods` → navigate to Google's `authURL`
    with our `redirect_uri` → `POST auth-with-oauth2` with
    `code`/`codeVerifier`/`redirectURL` → `{ token, record }` into
    `localStorage`; `refreshAuth()` revalidates on startup and clears a stale
    token on 401/403. Records: `create` / `listMine` / `getById` / `update` /
    `remove` against the `workouts` collection. Targeted at PocketBase
    **v0.40.x** route names (checked against the live `/api`); the header
    comment says which and why hand-rolled.
  - **`apps/builder/auth-callback.html`** — the fixed URL Google returns to
    (a redirect flow needs one). Runs `completeSignInFromRedirect()` and
    bounces back to the builder, hash and all. **This URL
    (`https://wex.androidempathy.com/apps/builder/auth-callback.html`) must be
    registered as a second authorised redirect URI in the Google Cloud
    Console** — see `deploy/README.md` §8; without it Google returns
    `redirect_uri_mismatch`.
  - **Builder** — a *Sign in with Google* control and the signed-in identity in
    the header; a **My workouts** dropdown: **Save** (create if new, update if
    opened from the server — explicit, never autosave), *Save as copy*, open a
    saved workout into the editor, rename, delete, and a **visibility** select
    (`private` / `unlisted` / `public`) + **Copy link**. The buffer is stashed
    to `localStorage` across the sign-in redirect so it survives the round trip.
  - **Board** — `/apps/display/?w=<id>` fetches the record and runs it; a
    `#<source>` hash behaves **exactly as before** and wins when both are
    present. A `private`/missing id 404s and the board shows a "not found" line
    (no crash). A `?w=` load leaves the clean id in the address bar rather than
    expanding the whole source into the hash — expanding it would leak the
    source past a later `unlisted → private`.
  - **Share URL is `/apps/display/?w=<id>`**, not a pretty `/w/<id>`: measured
    against the live instance, PocketBase serves `pb_public/` with an index
    fallback (an unknown path returns the root `index.html`), so `/w/<id>`
    can't route without a `pb_hooks` handler — an infra change for no gain over
    a query param on a file that exists. No `scripts/deploy-web.mjs` change:
    both new files ride the wholesale `apps/` copy.
  - **Verified headless** — against the live `auth-methods` endpoint and a
    faithful local fake of the `workouts` collection: sign-in URL construction
    (state + PKCE + `redirect_uri`), the callback token exchange, Save
    create-vs-update (one record, not two), Save as copy, open-into-editor,
    rename, delete, visibility changes, share links resolving for `unlisted`
    and 404ing for `private` to a stranger, the signed-out builder and the
    board's `#<source>` hash both unregressed, light + dark, zero console
    errors.
  - **Verified live** — Chris registered the second Google redirect URI,
    redeployed, signed in with a real Google account, created workouts, saw
    them persist and list, and inspected them in the SQLite DB. Epic 18–20
    closed to [../tasks/completed.md](../tasks/completed.md); the builder-UX
    chain (12 → 16 → 17 → 15 → 13 → 11) is next, held pending a decision on a
    builder layout redesign now being explored on a design canvas.

- **2026-08-30 — The builder + board are live at
  `https://wex.androidempathy.com/`.** Queue item 19 of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)).
  Item 19's original plan assumed an editable nginx vhost with its own `root`;
  item 18 voided that — the DreamHost managed VPS gives no root and the panel
  proxy sends the **whole domain** to PocketBase — so the static apps ship into
  **PocketBase's own `pb_public/`** (`~/pb/pb_public/` on the box), which
  `apis.Static` serves at `/` for any non-`/api/`, non-`/_/` path. New
  **`scripts/deploy-web.mjs`**: runs `npm --prefix packages/core test` (bails on
  red), runs `build-web.mjs`, assembles `build/deploy/pb_public/` **repo-shaped**
  (the apps fetch by relative path — `apps/`, `build/web/core/`,
  `spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
  `examples/goals/`, plus a generated `index.html`), then `rsync -az --delete`
  to the box. SSH target via `--ssh` / `WDL_DEPLOY_SSH`, never baked in. `/`
  redirects to `/apps/builder/` (generated, so `--delete` can't orphan a
  hand-placed file). **MIME:** PocketBase serves `.ohm` / `.wdlg` as
  `text/plain` (Go's content sniffer) and both apps `fetch().text()` them
  anyway, so no rename / `pb_hooks` / config was needed — `.js` is
  `text/javascript`, `.json` is `application/json`. **Cache:** `pb_public` gets
  `Last-Modified` only — no `Cache-Control`, no `ETag` (the `max-age` line in
  PocketBase is `/_/`-only). Accepted as-is: one `rsync` rewrites
  grammar + registry + core together so they can't drift, and nothing is
  content-hash-pinned; the escalation (a `pb_hooks` `Cache-Control` middleware)
  is documented in `deploy/README.md` "## 10. Static apps", not shipped.
  **Deployed and verified live** — drove both apps against
  `https://wex.androidempathy.com/`: builder (129-movement registry, grammar
  parse, body map, goal picker all load), board (`#<encoded-source>` share link
  resolves, Start advances the clock through the 21-15-9 tiers), both light and
  dark themes, zero console errors; `/api/health` and `/_/` unaffected. Items
  18–20 stay in [tasks/current.md](../tasks/current.md); 19 marked done inline.
  Next: **20** — frontend Google sign-in, saved workouts, sharing. Touches:
  new `scripts/deploy-web.mjs`; `deploy/README.md` "## 10"; this file;
  [what-exists.md](../topics/what-exists.md) **Hosting** row;
  [running-it.md](../topics/running-it.md) "Hosting / deployment";
  [layout.md](../topics/layout.md).
- **2026-08-30 — PocketBase is live on the VPS; the deployment epic (items
  18–20) has its backend.** Queue item 18, the first of the epic Chris made top
  priority the same day ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage),
  [goals.md](../goals.md) "## Pivots"). **PocketBase v0.40.1** runs on the
  DreamHost managed VPS at **`https://wex.androidempathy.com`** as a per-user
  systemd service — no root on that box, but `loginctl enable-linger` gives
  boot-start + crash-restart, verified across a real reboot. TLS + routing are
  the **DreamHost panel's Proxy Server** (whole domain → port 8090) and panel
  Let's Encrypt, not nginx (panel-owned) — so `deploy/nginx/wdl.conf` is
  reference-only and the committed process unit is `pocketbase.user.service`.
  **Google OAuth2** is wired (Cloud Console client + PocketBase provider) and a
  real sign-in was tested end to end — it creates a `users` record. One
  collection, **`workouts`**: `owner` (relation→users, required), `title`,
  `source` (the `.wdl` body), `visibility` (`private`|`unlisted`|`public`),
  auto `created`/`updated`; write is owner-only, read is
  `owner = @request.auth.id || visibility != "private"`. Applied as a
  `deploy/pocketbase/pb_migrations/` JS migration, clean on v0.40.1. **Nothing
  in `packages/core`, the grammar or the spec changed** — a stored workout is
  its source text in a column. **Known issue, documented:** the panel proxy
  connects over the VPS public IP, so PocketBase must bind `0.0.0.0` and port
  8090 is internet-reachable in plaintext past the TLS proxy; mitigated (auth on
  every route, collection rules, HTTPS `Application URL`), real fix is an open
  DreamHost support ticket to firewall the port. `deploy/` (runbook + templates,
  no secrets) is committed. Items 18–20 stay in
  [tasks/current.md](../tasks/current.md) — they close together; 18 is marked
  done inline. Next: **19** — deploy the static builder/board into
  `pb_public/`. Touches: new `deploy/` tree; [what-exists.md](../topics/what-exists.md)
  **Hosting** row; [running-it.md](../topics/running-it.md) "Hosting /
  deployment"; [layout.md](../topics/layout.md).
- **2026-08-29 — An unread parenthetical after a movement is held, not
  swallowed into the name.** Queue item 14 (top priority, Chris) — the only
  open item that corrupted output silently. `- 12 Around The Worlds (each
  direction)` parsed clean with the parenthetical folded into the movement
  name, so the movement resolved to no registry entry (muscle/volume analysis
  went blank) and `wdl fmt` emitted `... (each direction)s`. Fix is queue item
  5's `unreadableRange` pattern one construct over: a new `unreadableParen`
  production (`"(" (~")" any)+ ")"`) in `qualifiedPart` and `stepPart` **after**
  `laterality` and `rxSplit`, routing the whole parenthetical verbatim (parens
  included) into `Step.unknown`. `validate`'s `unread()` reports it as a
  `note`, `format` writes it back after the read modifiers, and the movement
  name is left clean. Edges: match runs to the first `)` (nested `(a (b) c)`
  not caught); ~15 raw-import registry titles that carry a parenthetical
  (`Front Squat (Clean Grip)`) now peel it to a `note` and resolve against the
  base name. No corpus file writes an unread parenthetical, so
  `interpretations.json` and `registry/workouts.canonical.json` regenerate
  unchanged. Suite **2027 → 2038** (+11 vocabulary/grammar cases), 1 pending
  unchanged. Verified by driving the builder in both themes: movement resolves
  (body map lights chest), diagnostics show the `note`, Canonicalise leaves the
  parenthetical intact. `spec/spec-0.1.md` §4 and §11.1 state the rule and the
  unbalanced-paren behaviour;
  [../topics/settled-decisions.md](../topics/settled-decisions.md) records it
  beside item 5's.
- **2026-08-29 — `pluralize` no longer takes the `s` on a leading modifier.**
  A self-contained defect Chris caught in the builder's "what it reads as"
  pane: `- 12 Bent Over Barbell Row` read as `12 Bents Over Barbell Row`.
  `pluralize` (`packages/core/src/fold.ts`) treats the word before a standalone
  preposition as the head noun — right for `Lateral Burpee over Dumbbell` /
  `Atlas Stone to Shoulder`, wrong when that word is the *first* in the name
  and so a participle, not a noun. Now requires a real word before the head
  (`at > 1`, not `at > 0`); the trailing noun takes the plural instead
  (`Bent Over Barbell Rows`). Every corpus name of the `[noun] [prep] [obj]`
  shape has a word before the noun, so nothing that read correctly moved —
  goldens and `registry/workouts.canonical.json` regenerate unchanged. Suite
  **2025 → 2027** (+2 `fold.test.ts` cases), 1 pending unchanged. Also filed
  from the same session: a `builder-ux.md` "## Outline" note that the outline
  shows no row for a `//` comment (they live only in the Text tab), and queue
  item 11 (a bare-word block header should read as an inert section, not an
  "unrecognized header" error).
- **2026-08-29 — `registry/duplicate-candidates.json` retired; `find-duplicates.mjs`
  is a run-on-demand report.** A defect task off
  [../topics/known-debts.md](../topics/known-debts.md), not a queue item (all
  numbered items are closed). The 694-row file was generated once on 2026-08-12
  and never touched: `find-duplicates.mjs` is not in `build-canonical.ts`,
  nothing reads the file, no test guards it — a stale artefact rotting in the
  tree, the shape the "every pipeline step must be in the pipeline" lesson
  exists to stop. **Option A of three:** deleted the committed file; the script
  now writes its summary to stderr and the candidate JSON to stdout, so `node
  scripts/find-duplicates.mjs > pairs.json` captures a fresh list when a curator
  wants one — the same treatment `check-aliases.mjs` already gets. Option B
  (wire it into the pipeline, pin it with a drift test) was rejected: no
  downstream consumer exists, and the script never merges. Pipeline still
  succeeds, `git status` clean apart from the two intended changes; **2025
  passing, 1 pending**, before and after (the suite does not touch either).
  See [../topics/known-debts.md](../topics/known-debts.md),
  [../topics/running-it.md](../topics/running-it.md),
  [../topics/layout.md](../topics/layout.md).
- **2026-08-29 — The builder's Outline and Text are one tabbed editor pane.**
  Queue item 10 (high priority, Chris). The `<main>` grid went 4 → 3 columns —
  the Outline (structural GUI) and the raw Text `<textarea>`, previously two
  side-by-side full columns a user only ever edits one of, are now two tabs of
  a single `.editor-pane` cell. A tab strip stands in for the two `<h2>` bars;
  the inactive view is `display: none`; `render()` still repaints both, so a
  switch is show/hide only (`lines` is the single source of truth both repaint
  from). The `#dirty` "edited" badge moved onto the Text tab so it stays
  visible from the Outline tab; the `+ movement / + block / + rest` row stays
  with the Outline. Choice persisted in `localStorage['wdl.editor-tab']`,
  default Outline. `@media (max-width: 1180px)` now drops to 2 columns under a
  full-width palette; the 900px stack is unchanged. **No core or test change**
  (the suite does not touch the builder DOM; 2025 passing, 1 pending, before
  and after); verified by driving the builder. See
  [../tasks/completed.md](../tasks/completed.md),
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Layout" and
  [../topics/what-exists.md](../topics/what-exists.md) Apps row.
- **2026-08-29 — The one-line interrupt overlay can state its bound.** A
  defect task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `every 1min: 5 Burpee` (spec §5.8) parsed as an `Interrupt`, but
  a one-token regex in `parseNode` could not see the `every` grammar rule's
  bound tails, so `every 90s x 5: …`, `every 90s for 12min: …` and
  `every 1min until failure: …` were unwritable on one line. `Interrupt` gains
  `count?` / `duration?` / `untilFailure?` — the field names `Block` already
  uses for a clock, one spelling — and `parseNode` reads the head via the
  grammar's own `every` production (`tryHeader`) rather than a second bound
  regex. `format` mirrors the clock header's spelling (no `EMOM` sugar);
  `timeline` carries the bound onto `group.interrupt` and into the outline,
  not into `estimate()`. Suite **2020 → 2025 passing** (+4 vocabulary overlay
  twins, +1 timeline case), 1 pending unchanged. `interpretations.json` and
  `registry/workouts.canonical.json` unchanged — no corpus file writes a
  bounded overlay. Design decision in
  [../topics/settled-decisions.md](../topics/settled-decisions.md); builder
  `»`-caret follow-on left unwired, noted in
  [../topics/builder-ux.md](../topics/builder-ux.md).
- **2026-08-29 — `registry/workouts.canonical.json` is guarded against drift.**
  A test task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `scripts/build-workouts.mjs` now exports `buildWorkoutsDoc()`,
  the pure core of its derivation (CLI byte-identical, behind a main guard);
  new `packages/core/test/workouts-canonical.test.ts` re-runs it in process
  and asserts equality against the committed file, one `it()` per corpus
  workout modulo the `generated` stamp — the guard `interpretations.json` and
  `vocabulary.json` had and this file did not. Suite **1817 → 2020 passing**
  (+202 workouts, +1 envelope), 1 pending unchanged. No registry file was
  rebuilt. See [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-29 — `Pec Deck` = `Butterfly` = `Machine chest fly`.** A curation
  task off [../topics/known-debts.md](../topics/known-debts.md), not a queue
  item. The three wger-only / wger-sharing records `find-duplicates.mjs`
  cannot compare by construction were checked against their source
  descriptions — all one seated chest-fly machine — and merged, along with
  everkinetic's `Butterfly Machine`, into one curated `pec-deck` record
  carrying `sameAs`. `cable-crossover` stays separate (standing, cable,
  `force: push`, four sources). **3112 → 3109 records; pool 128 → 129.** No
  corpus workout names any of them, so the golden snapshot did not move.
  `generate.test.ts`'s pool-size pin went 128 → 129. See
  [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-25 — The queue emptied out.** Items 5 (a distance/duration range
  is caught rather than silently swallowed into the movement name), 7 (a body
  map, front and back, in the builder and on the board), and 9 (the board
  runs a cap as a clock, stopping where the cursor stands rather than
  claiming the end) all closed, on separate branches merged the same day.
  Every numbered item raised so far — the whole 0-series, 1, 1a, 2, 3, 4, 5,
  6, 7, 8, 8a and 9 — is now closed; see
  [../tasks/completed.md](../tasks/completed.md). Also landed the same day:
  the builder's outline caret now does real per-row movement completion
  instead of an empty native datalist, an indent guard against orphaning a
  first-in-document line, distinct rail colours for back-to-back repeating
  blocks, the builder's summary showing a workout's scoring rule, and the
  body map's anatomical shapes were swapped in from a real reference source.
- **2026-08-23 — A load can be a word.** `heavy`, `moderate`, `light`,
  `unloaded` are a fifth `Load` kind, `qualitative`, so a target like `@ heavy`
  is visible to anything checking for a load instead of sitting inert in
  `raw`. Queue item 6, closed. See
  [../tasks/completed.md](../tasks/completed.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-23 — Results and `measure: load`.** A new `.wdlr` record type, the
  board writing one when a session ends, and a `progress` goal rule that can
  ask "did the load go up" across a series of them. The largest single piece
  of work in the queue's history; decisions and defects found while building
  it are split across
  [../topics/settled-decisions.md](../topics/settled-decisions.md) and
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-23 — The generation pool became a judgement, not a score.**
  `mark-core` no longer lets catalogue agreement alone put a movement in the
  pool `wdl generate` draws from; **178 → 129**. Queue item 4, closed.
- **2026-08-23 — Registry merge cleanup.** An explicit alias now outranks a
  record's own id (queue item 8a); `sameAs` lets a curator merge two records
  that are one movement, and a source's entry can be redirected to the right
  record without merging (the `Air Bike` split). `check-aliases.mjs` is down
  to one open collision (`assault bike` on `Bike`). See
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-16 — `3 RFT:` and free header ordering.** `3 RFT:` reads as
  `3 rounds for time:`, and a block's kind may now be stated in any comma
  position (`for time, 3 rounds:` no longer silently drops the count). Queue
  item 0f, closed.
- **2026-08-15 — The parser became the grammar.** `parse.ts` now matches and
  walks `spec/grammar-0.1.ohm` directly; the regex chain (83 operations) is
  gone. Nine defects closed with it. Queue items 0/0a–0e, closed; the decision
  history is in [../topics/settled-decisions.md](../topics/settled-decisions.md).

Fold an entry into the owning topic file once it stops being *recent* —
this file is for changes that would still change how someone reasons about
picking up new work today.
