# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

The deployment epic (items 18–20) **landed 2026-08-30** and the **builder
layout redesign** — direction **C (Document + margin)**, the ten-stage chain
**R1 → R10** — **landed 2026-08-31**. Both are in [completed.md](completed.md),
each grouped as one section. The redesign's absorbed chain items (12 ↔ R2,
16 ↔ R3, 17 ↔ R9, 15 a/c/d ↔ R3 + R10) closed with it.

**Item 21 (a root Makefile task surface) landed 2026-08-31** —
[DEC-017](../topics/settled-decisions.md#dec-017-a-root-makefile-is-the-task-surface-not-a-root-packagejson).
**Item 11 (a bare-word block header is an inert section) landed 2026-08-31**
(`70a1852`) — [DEC-018](../topics/settled-decisions.md#dec-018-a-bare-label-block-header-is-a-section).
**Item 13 (laterality in the builder's `»` panel) is closed entirely as of
2026-08-31** — 13c `02d819d` (append/double bug), 13b `cf3c47f`
([DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised),
the per-side form is parenthesised), 13a-curation `71f9469` (the
`lateralityAxis` registry field), 13a `1ffc8d0` (the `»` panel renders the
axis — `(each direction)`). See [completed.md](completed.md).

**Every earlier numbered item is closed** — the whole 0-series through 21, the
deployment epic (18–20) and the redesign chain (R1–R10). **The
*Movements in the database — Phase 1* epic is also complete as of 2026-09-01**:
M0–M7 all landed (M6, the nightly VPS DB backup, `97f236f`), and the whole
M-section moved to [completed.md](completed.md) as one grouped section, the way
the deployment epic and the redesign chain were closed.

**The *workout library* epic (L0–L7) is complete as of 2026-09-01** — all of
L0–L7 landed and the whole L-section moved to [completed.md](completed.md) as one
grouped section (the last link, **L7 (`2557177`)**, surfaced the library: an
**Examples** chip row in the builder's *My workouts* panel that browses each org
account's public set — `crossfit` 31 / `hyrox` 9 / `tabata` 3 — plus a per-row
`↗` "Open on the board" shortcut; app code only, `make test` unchanged). The
board resolves `?w=<handle>:<slug>` end to end and shows the namespaced id in the
`#meta` strip. This absorbed most of the deferred account-namespacing rethink;
what is left of it — the board **Edit** button round-tripping into the builder —
is a loose bullet below.

**No epic is in flight, and the standalone queue is empty.** Every numbered
queue item is closed and all three post-library standalone tasks have landed.
What remains is the two loose bullets below, which need Chris to scope.

Recently closed (kept here briefly for the trail):

- **~~unit defaults: a unitless load target is pounds~~ — landed 2026-09-01
  (rule 1 `6829052`, rule 2 `952c80c`).** Rule 1: `@ <number>` with no
  unit now parses to a real `load` (`{kind:'absolute', unit:'lb', value}`) and
  `wdl fmt` rewrites `@ 95` → `@ 95lb` — pound is the documented default for a
  load that omits its unit (design rule 3), overriding the "a default is an
  invention" holding answer. `parseTarget` in `packages/core/src/units.ts`, spec
  §3/§7, grammar comment; no corpus movement, `interpretations.json` unmoved,
  `vocabulary.json` moved for the pinned `@95` / `@ 95` forms only. Rule 2: a
  *builder-only* suggesting diagnostic (`calorieUnitHints()` in
  `apps/builder/builder.js`) for a bare count on a load-less calorie machine
  (`15 Row` → "did you mean `15cal Row`?"); the board stays agnostic, no parser
  change. [DEC-022](../topics/settled-decisions.md#dec-022-a-unitless-load-magnitude-is-pounds-wdl-fmt-writes-the-unit-in);
  resolves the "what a target with no unit means" entry in
  [../topics/known-debts.md](../topics/known-debts.md). `make test` 2064/2064,
  1 pending throughout. Write-ups in
  [../topics/what-exists.md](../topics/what-exists.md) (Format / load rows) and
  [../topics/builder-ux.md](../topics/builder-ux.md) ("What it reads").
- **~~board: the `#` title belongs in the meta strip, not the body~~ — landed
  2026-09-01 (`110ed2b`).** The `# Title` line now joins the hidden preamble
  run (`draw()`'s preamble test covers a `#`-line in the leading run) and shows
  in the `#meta` strip as the prominent lead element, with any `@id` small and
  dim in parentheses after it (`Fran (crossfit:fran)`); `dataset.line` stays 1:1
  so the cue marker still tracks the right physical lines, and the strip still
  hides when the workout sets none of title / `@id` / `@tags`. `apps/display/`
  only (`board.js` `draw()` + `renderMeta()`, `board.css` `.meta .title` / `.meta
  .id`, `index.html` comment); dark verified; `make test` unchanged (2064/2064,
  1 pending). Closes the "reversible default" question left by item 15b —
  write-up in [../topics/builder-ux.md](../topics/builder-ux.md) under "The
  board".
- **~~board: parse errors / notifications must be dismissible~~ — landed
  2026-09-01 (`01c0af3`).** A **Clear notifications** button now sits in the
  board's footer control row (static markup in `apps/display/index.html`, beside
  Reset), shown only while the red `#problems` strip has content and hidden with
  it. One `setProblems(text = '')` helper in `apps/display/board.js` is the
  single show/hide path — it sets the strip text, `problems.hidden`, and the
  button's `hidden` together; `recue()`, `loadShared()`'s catch and
  `showEmpty()` all route through it. Clicking the button calls `setProblems()`
  with no text, so the strip is genuinely `hidden` (`[hidden]{display:none}` — no
  reserved gap), not suppressed: the next `recue()` (a reparse, a `?w=` load, a
  division change) repopulates it if anything is still wrong. `apps/display/`
  only; dark verified; `make test` unchanged (2064/2064, 1 pending). Write-up in
  [../topics/builder-ux.md](../topics/builder-ux.md) under "The board".
- **~~The `»` panel's per-implement load token (`@ 2x`) is unclear
  mid-edit~~ — landed 2026-09-01 (`00f599c`).** The seeded `@ Nx` token
  stays (it carries the implement count, and a bare `@ Nx` round-trips clean —
  unlike the plain-load `@ `); its *reading* was fixed instead — the pick's
  label now names the finished shape (`@ 2x — load, per implement (2) — then
  type the weight: @ 2x35lb`) and a transient inline hint appears by the caret
  after the pick. Full write-up in
  [../topics/builder-ux.md](../topics/builder-ux.md) under the `»`-panel entry.

---

## Vocabularies & editor ergonomics (V1–V9)

A staged epic from the 2026-09-02 design review of two builder surfaces — the
header **Workouts** menu and the **movement editor** form. The review canvas
(recreated from source, `Main` / `WorkoutsMenu{Today,Proposed}` /
`MovementEditor{Today,Proposed}` / token-input pattern) is a private Artifact;
its findings are transcribed here so the queue is self-contained.

**Decisions already made (Chris, 2026-09-02):**

- The header button **"My workouts" → "Workouts"** (it is your saved workouts
  *plus* a search across all public ones *plus* the publisher chips).
- The chip row **"Examples" → "Libraries"** (crossfit / hyrox / tabata are
  official published sets, not examples).
- A **Libraries** chip **types `<handle>:` into the search box and lets the
  normal search run** — no separate `listOrgWorkouts` path.
- **Measured output** in the editor is **mutually exclusive** → a 3-way
  segmented control (None / Distance / Calories), not two checkboxes.
  ("Counting modes" above it stays multi — both/split/per-side genuinely
  co-occur.)
- The editor's list fields (equipment, patterns, muscles, aliases, related,
  same-as) become a **token/chip input + type-ahead + a filter/select picker
  widget below** — *one* pattern at every list size (the count-driven
  vocab-tray / "show 15 then More" idea was considered and dropped; a picker
  scales without blowing out the layout).
- **Equipment** and **movement patterns** become a **DB/API-backed vocabulary
  layer** — fixtures + mock `/api` + a PocketBase collection + a committed
  `registry/*.json` dump, mirroring the movements M-series (DEC-020) — so they
  grow by data, not a code edit. **Muscles stays `registry/muscles.json`** (a
  closed 19-term set the body-map SVG has one hand-drawn path per id for, wired
  deep into the core merge pipeline — it is already data, and runtime-editable
  is the wrong risk for no gain). The editor's muscle picker reads that file;
  `allowCustom` is **false** for muscles, **true** for equipment / patterns /
  aliases / related / same-as.

### Stage A — menu quick wins (builder-only, no data, no deps, ship first)

- **V1. Rename the header menu "My workouts" → "Workouts".**
  `apps/builder/index.html` `<summary>` text; sweep `builder.js` /
  `builder.css` / any `title`/aria string that names it. Trivial; can land with
  V2. *Touched: `apps/builder/{index.html,builder.js,builder.css}`. No core, no
  test move.*

- **V2. "Examples" row → "Libraries", and the chip drives the search box.**
  Relabel `renderExamplesRow()`'s `.examples-label` to **Libraries**. Change the
  chip `onclick`: instead of `browseOrg(handle)` (which calls `listOrgWorkouts`
  and fills the list while the search box stays blank), set the search input's
  value to `` `${handle}:` ``, fire the existing debounced `onMineSearchInput`
  path, and let `searchWorkouts` do the rest (it already matches a `wdlId~`
  substring, so `crossfit:` returns that namespace). Keep the chip's `.active`
  state driven by "does the query start with `<handle>:`". Clearing the box
  returns to the plain saved list, as today. Retire `browseOrg` / `mineOrg` /
  `mineOrgList` / `mineOrgSeq` / `renderHitList`'s org branch and, if nothing
  else consumes it, `listOrgWorkouts` in `apps/shared/pocketbase.js` (check
  `apps/display/board.js` first). *Touched: `apps/builder/builder.js`,
  `apps/builder/index.html`?, maybe `apps/shared/pocketbase.js`. Mock `/api`
  already supports `~`. No core, no test move — verify by driving the builder.*

### Stage B — editor ergonomics (the visible win; V4 is the keystone)

- **V3. Measured output → a 3-way segmented control.**
  In `apps/shared/movement-editor.js` replace the `measures` multi-checkbox
  group with a single-select segmented control writing `[]` / `['distance']` /
  `['calories']` — the stored shape stays an array (0 or 1 element) so the DB
  column and the M4 round-trip are unchanged; `collect()` just can't emit both.
  A `.me-seg` style in `builder.css` on the shared `--ink`/`--rule`/`--accent`
  tokens (the widget carries no host look — same rule as the rest of
  `movement-editor.js`). Independent of V4/V5. *Touched:
  `apps/shared/movement-editor.js`, `apps/builder/builder.css`. No core.*

- **V4. Build the reusable token-input widget** — `apps/shared/token-input.js`,
  host-agnostic like `movement-editor.js`. Signature roughly
  `createTokenInput({ container, value: string[], vocab: string[] | () =>
  Promise<string[]>, allowCustom: boolean, placeholder?, onChange })`. Renders:
  removable **chips** for the current value; a text **input with type-ahead**
  over `vocab` (arrow-key highlight, Enter/click to add; `allowCustom` →
  a `＋ Add "x"` row for an unrecognised token, else no-op); and, below the
  field, a small **filter/select picker** — a filter box + a scrollable
  (max-height, `overflow:auto`) checklist of `vocab`, click to toggle a term in
  or out. *One* composition at every vocab size — no count threshold, no "show
  N then More". CSS lives in `builder.css` on the shared tokens (no
  host-specific look). *Touched: `apps/shared/token-input.js` (new),
  `apps/builder/builder.css`. No core. Verify by driving the editor once V5
  wires it.*

- **V5. Wire the token-input widget into the movement editor.**
  In `movement-editor.js` replace the free-text comma inputs for `equipment`,
  `pattern`, `musclesPrimary`, `musclesSecondary`, `aliases`, `related`,
  `sameAs` with `createTokenInput`. Vocab source, **static for now** (Stage C
  swaps equipment/patterns to the API): a new `apps/shared/vocab.js` holding the
  deduped equipment + pattern lists (seed from the distinct values in
  `registry/movements.json` — collapse `kettlebell`/`kettlebells`, fold the
  machine variants, drop `other`); muscles from `registry/muscles.json`;
  `related`/`sameAs` type-ahead over the movement-id list already in memory;
  `aliases` gets chips with no vocab. `allowCustom`: false for muscles, true for
  the rest. `collect()` still emits arrays exactly as today (`splitList` /
  `joinList` retire for these fields), so the write path and validation are
  unchanged. *Touched: `apps/shared/{movement-editor.js, vocab.js (new)}`,
  `apps/builder/builder.css`. No core. Verify: edit a movement, add/remove
  chips, type-ahead, picker, save, confirm the `/api` body is unchanged shape.*

### Stage C — equipment + patterns become data (mirror the movements M-series, lean)

- **V6. Vocab files + collections + migration.**
  Commit `registry/equipment.json` and `registry/patterns.json` — the canonical
  ordered vocab, entry shape matched to `registry/muscles.json` (`{ id, label,
  synonyms? }`). Seed equipment from the deduped registry values (V5's list is
  the same list — share it), patterns from the 11 distinct values. Add a
  PocketBase migration `deploy/pocketbase/pb_migrations/<ts>_create_vocab.js`
  creating `equipment` + `patterns` collections (one row per term, `scope:
  "global"`, list/view rule open, write rule admin) — mirror
  `1756800000_create_movements.js`. Migration up/down verified against a real
  PocketBase binary, like M1/M2. *Touched: `registry/{equipment,patterns}.json`
  (new), `deploy/pocketbase/pb_migrations/` (new). No core, no app change yet.*

- **V7. Fixtures + mock `/api` for equipment + patterns.**
  `scripts/mock-api.mjs` serves `equipment/records` + `patterns/records` from
  the registry files in the PB list-envelope shape (copy the `movements/records`
  handler): reads open, authorised writes persisted to git-ignored
  `fixtures/{equipment,patterns}.local.json` overlaid on read. Commit
  `fixtures/{equipment,patterns}.json` (or derive from `registry/` at boot, as
  movements does). So a bare `make serve` serves the vocab. *Touched:
  `scripts/mock-api.mjs`, `fixtures/`. No core.*

- **V8. Load script + point the widget at the API.**
  `scripts/vocab-to-db.mjs` / `make vocab:load` — idempotent upsert of
  `registry/{equipment,patterns}.json` into the two collections, keyed on `id`
  (mirror `movements-to-db.mjs`: created/updated/unchanged tally, `--dry-run`,
  prod needs admin auth). Add `listEquipment()` / `listPatterns()` to
  `apps/shared/pocketbase.js` (`filter=scope="global"`, no auth — like
  `movements:dump`'s read). Change `apps/shared/vocab.js` so equipment + pattern
  vocab is fetched from `/api` with the committed `registry/*.json` as the
  offline fallback (same fallback pattern the apps use for movements). Now a
  term is added by a DB row (or edit the file + `make vocab:load`). Optional
  `make vocab:dump` twin if the round-trip guarantee is wanted. *Touched:
  `scripts/vocab-to-db.mjs` (new), root `Makefile`, `apps/shared/{pocketbase.js,
  vocab.js}`, `docs/context/topics/running-it.md`. No core.*

- **V9 (optional, defer unless wanted). Inline "＋ new term" in the picker.**
  An admin-only affordance in the token-input picker that `POST`s a `scope:
  "global"` row to `equipment` / `patterns` — the `＋ new movement` pattern, so a
  curator adds a term mid-edit. Only if the editing flow asks for it.

### Sequencing

```
V1 ─┐
V2 ─┴─ ship (Stage A, independent, no risk)
V3 ──── ship (independent)
V4 ──> V5 ──────────────┐
V6 ──> V7 ──> V8 ───────┴─ (V8 swaps V5's vocab source to the API)
                           V9 optional, after V8
```

Stage A first (value now, zero risk). V3 any time. V4→V5 is the ergonomics
deliverable and can ship on static vocab. Stage C (V6→V7→V8) makes it
data-driven and only needs V5 to exist. Land each with its `docs/context/`
write-up; V6/V8 want a **DEC** — "equipment & movement patterns are a DB-backed
vocabulary layer; `registry/{equipment,patterns}.json` is the committed dump"
(mirrors [DEC-020](../topics/settled-decisions.md)) — and a settled-decision
note for the token-input pattern (chips + type-ahead + filter/select picker; no
size-driven variants; `allowCustom` per field; muscles closed).

---

## Loose bullets — unscheduled, need Chris to scope

- **A full laterality curation sweep** — not a numbered item. `around-worlds` is
  the only movement carrying `lateralityAxis`. The audit-CSV tooling is ready:
  `export-movement-curation.mjs` (`make curation:sheet`) emits the sheet with a
  `Laterality axis` column in both the CURRENT and CURATE blocks, and
  `import-movement-curation.mjs` lands it back. A sweep is run via that CSV per
  [../topics/running-it.md](../topics/running-it.md), not hand-edits — needs
  Chris to scope which movements. Note `around-worlds` itself looks mis-sourced
  (free-exercise-db's "Around The Worlds" is a lying dumbbell bench fly, not the
  kettlebell around-the-head movement its `lateralityAxis: "direction"` +
  `per-side` describe) — the sweep should resolve what that entry is. The CSV is
  now the **bulk** path; per the rethink below, one-at-a-time movement edits are
  headed into an in-app GUI.

- **Post-redesign rethinks** (not scheduled) — the board's **Edit** button
  round-tripping into the builder. *Everything else in that thread —
  `@id` ↔ record-id correlation, the account namespace, `users.handle`,
  `workouts.wdlId`, forcing the `@id` namespace on save, an "open on the board"
  action — is now in **The workout library (L0–L7)** above; the handle-rename
  debt is in [../topics/known-debts.md](../topics/known-debts.md).* In
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

