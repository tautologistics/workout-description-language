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
([DEC-019](../topics/settled-decisions.md#dec-019-the-per-side-laterality-form-is-parenthesised-each-arm),
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

**The *Vocabularies & editor ergonomics* epic (V1–V9) is complete** — V3 was
withdrawn; **V9 shipped 2026-09-02 (`2a534b6`) as N1 of the three-task set
below.** *Corrected 2026-09-02: this paragraph read "No epic is in
flight, and the standalone queue is empty" from 2026-09-01 until the V-series
was queued on 2026-09-02, and stayed that way for a day after — a session
picking work off this file would have been told there was none.* Every earlier
numbered queue item is closed and all three post-library standalone tasks have
landed. The standalone **movement-editor wrong-record defect** was fixed
2026-09-02 (`a643824`) — its section below is struck, kept for the trail.

**The active queue is *## Next builder-UX work* below — three tasks Chris named
2026-09-02, in order: N1 = V9 (inline "＋ new term"), N2 = the *Movements*
palette-drawer redesign, N3 = the board's **Edit** round-trip into the builder.**
**N1 landed 2026-09-02 (`2a534b6`).** **N2 is VOID — its premise (a docked
palette column) has been obsolete since R1/R7, confirmed dead by Chris
2026-09-02; nothing shipped, see its struck section below.** The palette has not been "a permanent ~24% column" since **R1
(`758dff1`, 2026-08-30)** made it an overlay drawer behind a `☰` toggle, and
**R7 (`d1a89ce`, 2026-08-31)** then replaced the drawer *and* that `☰` toggle
*and* its `wdl.palette-open` persistence with the summoned `<dialog
id="palette-modal">` it is today — opened by ⌘K / "＋ movement", closed by ✕ /
Esc / backdrop, zero layout width when closed. Building N2 as briefed would
re-add the exact `☰` + `localStorage` state R7 deliberately deleted, to collapse
a column that no longer exists. Same fate as the other two entries from that
2026-08-30 design-critique pass (read-pane scroll, header control row), both
already struck as "already done by R1". N2's two claimed follow-ons were
gated on a *drawer* that never happened, and Chris ruled on both 2026-09-02:
the **read pane's four `<h2>`s — declined** (two sections per tab, nothing to
collapse); the **flat 129-row palette list — deferred** to
[deferred.md](deferred.md) pending the curation sweep (which grows the core set
substantially) and a dedicated browse-UX review, not a quick grouping patch.

**N3 shipped 2026-09-02 (`fecf6b3`)** — the board's *Edit in builder ↗* footer
button opens the builder on the shown workout, in a new tab; the builder reads
`?w=<id|handle:slug>` on load and attaches (owned) or opens a detached copy
(the DEC-021 flow). App code only, `make test` unchanged. Its section below is
struck.

**With N1 + N3 landed and N2 void, the three-task set (N1/N2/N3) is closed.**

**The *movement-sets database* epic (S0–S4) is complete as of 2026-09-03** —
S0 (`9f82f5f`, DEC-027), S1 (`91e20d5`, the migration), S2 (`4b3b796`, the
`apps/shared/sets.js` model + `pocketbase.js` CRUD + builder rewire off
`localStorage['wdl.sets']`), S3 (`7e18879`, the mock `/api` + fixture seed +
signed-in round-trip) and **S4 (`6ead525`, the create/edit dialog UX rework +
prod deploy)** all landed, and the whole S-section moved to
[completed.md](completed.md) as one grouped section, the way the M / L / V epics
were closed. Movement sets are now a `movement_sets` PocketBase collection
(signed-in only, `org-library` + `user` scopes derived from owner + visibility,
`setId = <handle>:<slug(name)>` re-slugged on rename) — see
[../topics/what-exists.md](../topics/what-exists.md). The migration is on the VPS
and `movement_sets` is live on the prod API (nothing ships v1 — no loader, no
seed content).

**The *goals database* epic (G0–G4) is complete as of 2026-09-03** — G0
(`8680e2a`, DEC-028), G1 (`1a99448`, the migration), G2 (`2512c23`, the
`apps/shared/goals-store.js` model + `pocketbase.js` CRUD + builder rewire off
`localStorage['wdl.goals']`), G3 (`1a7252f`, the `make goals:load` loader + the
mock `goals/records` route + the signed-in round-trip) and **G4 (`6d8a9b5`,
deploy + close)** all landed, and the whole G-section moved to
[completed.md](completed.md) as one grouped section, the way the M / L / V / S
epics were closed. Saved goal rulesets are now a `goals` PocketBase collection
(scopes `global` + `user` on the vocab model — DEC-028 — a nullable `user`
relation, `goalId` `wdl:<slug>` global / `<handle>:<slug(title)>` user) — see
[../topics/what-exists.md](../topics/what-exists.md). The G1 migration is on the
VPS and the three `global` rows (`examples/goals/*.wdlg`, `source`
byte-identical) are loaded on the prod API; the served
`apps/shared/{pocketbase.js,goals-store.js}` + `apps/builder/builder.js` are
byte-identical to `origin/main`.

**Goals-rules hardening (found while verifying G4's prod deploy — fixed and
deployed 2026-09-03).** G1's `goals` rules had no `@request.auth.id != ""`
guard, and `goals.user` is a nullable relation, so an unauthenticated `POST` of
`{scope:"user"}` with no `user` field created an ownerless `user`-scoped row
(`user = @request.auth.id` is `"" = ""`; the same `"" = ""` let an anon caller
read ownerless rows). Narrow — an anon `global` write, or one attributing a
`user` row to a real uid, was still rejected — so collection spam, not
escalation, but a gap `movement_sets` / `workouts` do not have. **Fixed by
`deploy/pocketbase/pb_migrations/1757400000_harden_goals_rules.js`** — edits the
existing collection's five rules to the guarded forms
(list/view `scope = "global" || (@request.auth.id != "" && user = @request.auth.id)`;
create/update/delete
`@request.auth.id != "" && ((scope = "user" && user = @request.auth.id) || @request.auth.admin = true)`),
verified up/down/up against a real pocketbase v0.40.1 binary; DEC-028's
correction note records the guarded forms as settled. **Applied on prod
2026-09-03 (`make deploy:db`)** — the five live rules read back guarded, and the
anonymous ownerless `{scope:"user"}` `POST` now returns `400 "Failed to create
record"` with no row (PocketBase's shape for a guest failing a non-null rule —
not `403`; before the fix this exact request returned `200` and created a row).
The 3 `global` rows are unaffected. The G3 mock `/api` is already stricter (it
403s the anonymous write), so local dev is unaffected.

**Two epics queued 2026-09-05 (Chris). The *Palette search normalization*
epic (P1–P3) is complete as of 2026-09-05 — `P1` (`327b8c6`), `P2` (`e55a302`),
`P3` (`d8f592a`) all landed, and the whole `## Palette search normalization
(P1–P3)` section moved to [completed.md](completed.md) as one grouped section
(the way the M / L / V / S / G epics were closed). The active queue is now the
`## Soft delete across records (D0–D6)` epic below. **D0 landed 2026-09-05
(`ae6c469`) as [DEC-029](../topics/settled-decisions.md#dec-029-soft-delete-is-a-nullable-deleted-timestamp-hidden-by-server-rules-hard-delete-is-retired),
D1 landed 2026-09-05 (`487668e`) — the queue starts at `### D2` (D2 + D3
together).**
P1 shipped the shared `searchKey()` helper (fold separators, depluralize,
expand `bb`/`db`/`kb` shorthand) and rewired both builder matchers; P2 pinned
the `resolve()` winner to the head of the palette list with a marker; **P3
(`d8f592a`) dropped 58 now-redundant within-record aliases across 51 curated
records** — plural-of-own-name, hyphen/space/`&` variants, and `bb`/`kb`/`db`
implement-prefix shorthand whose full equipment word is already the id/title
(`barbell-row` → just `["bent over row"]`, `dumbbell-curl` drops `"db curl"`,
etc.). Standalone gym acronyms core also expands (`hspu`, `ohs`, `sdhp`, `du`,
`wb`, …) were **kept** as aliases on Chris's call — they are whiteboard
vocabulary and would vanish if `TOKEN_EXPANSIONS` were ever trimmed.
*Soft
delete across records* (**D0–D6**, section below) gives workouts / movements /
movement sets / goals a nullable `deleted` **timestamp** (`null` = live, a value
= when it was deleted), flips the existing hard-`DELETE` buttons to soft-delete,
filters deleted rows out of every read and the `movements:dump`, and adds the
one missing delete button (movements, in the editor). Both are app + DB only —
**no `packages/core` change.** Background for the palette work:
[../topics/name-normalization.md](../topics/name-normalization.md) and the
2026-09-05 discussion it came from.

Also queued / deferred, unchanged:
- the **flat 129-row palette browse UX** — deferred pending the curation sweep
  + a dedicated UX review ([deferred.md](deferred.md));
- the **laterality curation sweep** — Chris's manual CSV step (`make
  curation:sheet`), not dev work (loose bullet at the end);
- a **full security audit** — recorded in [deferred.md](deferred.md) as a "once
  functionality has settled" item.

Recently closed (kept here briefly for the trail):

- **~~builder: the header is one undifferentiated control row~~ — was already
  resolved; verified 2026-09-02, no code shipped.** A session was dispatched on
  the *"The header is one undifferentiated control row"* design-critique entry in
  [../topics/builder-ux.md](../topics/builder-ux.md)'s **## Layout** section. Its
  two concrete moves were **already shipped** by **R1 of the layout redesign
  (`758dff1`, 2026-08-30)** + **V1 (`7429863`)**: **(b)** *Canonicalise* is a
  `.toolbar-btn` on the editor's `.editor-tabs` strip, not the header; **(a)**
  `header .row` no longer exists — `<header>` is a flex with a centred
  `#doc-title` (`flex:1`) splitting the brand from five distinct right-side
  zones (`WDL` mark · title · bordered `.file-cluster` *Open…/Download/board* ·
  bordered `#mine .menu` pill, *My workouts → Workouts* by V1 · `#identity` far
  right). Verified driving `make serve` at 1440 / 1000 / 760px, light + dark,
  signed in — no wrap, no collision, no console errors; `make test` 2064/2064,
  1 pending, unchanged. The *"future New behind one file control"* popover is a
  closed call (R1: *"three items didn't warrant a popover"*), not invented.
  Entry struck in `builder-ux.md`; `current/recent-changes.md` +
  `current/next-steps.md` updated. Both dispatchable design-critique items
  (read-pane scroll, this one) were already-done by R1. *Chris then named the
  concrete next work (2026-09-02): see **## Next builder-UX work** — N1 V9, N2
  palette-drawer redesign, N3 board Edit round-trip.*

- **~~builder: the read/analysis pane has no scroll container~~ — was already
  fixed; verified 2026-09-02, no code shipped.** A session was dispatched on the
  first design-critique entry in
  [../topics/builder-ux.md](../topics/builder-ux.md)'s **## Layout** section
  ("the single highest-value layout fix"). Its premise turned out to be **stale**
  — the `.read-pane` it describes was replaced by the tabbed margin's `.rpanel`
  (`flex:1; min-height:0; overflow:auto`, bounded) in **R1 of the layout
  redesign (`758dff1`, 2026-08-30)**, the day the critique was written.
  Re-verified by driving `make serve` at 1440×900 + 820px + mobile, light +
  dark, with a 56-cue workout: both Analysis and Reads-as scroll **internally**,
  the document itself does not overflow (`scrollHeight === innerHeight`, where
  the entry measured 1748 vs 900), header / band / editor stay put. The entry is
  struck in `builder-ux.md` with the measurements and the correction that the
  minimum it predicted (`overflow:auto` on the pane alone) needed the whole
  ancestor `min-height:0` chain, which the redesign supplied. The optional
  *collapsible sub-panels* half was **not** built — polish on a working pane,
  and it clusters with the palette-drawer items. **Open for Chris:** the
  remaining design-critique items are all in `builder-ux.md` — the *Movements*
  palette drawer + flat 129-row list + four stacked `<h2>`s, all gated on the
  palette-drawer redesign, which needs Chris to scope. *(The header control-row
  grouping, listed here as still-open, was itself verified already-done by
  R1 + V1 on 2026-09-02 — see the bullet above.)*

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
- ~~**Measured output** in the editor is **mutually exclusive** → a 3-way
  segmented control (None / Distance / Calories), not two checkboxes.
  ("Counting modes" above it stays multi — both/split/per-side genuinely
  co-occur.)~~ **Reversed 2026-09-02 — the premise was false.** `measures`
  genuinely co-occurs too (`bike` / `row` / `skierg` correctly carry both), so
  the editor **keeps its two checkboxes**:
  [DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice).
  Kept here struck rather than deleted — this is the decision V3 was built on,
  and a reader who does not know it was tried will try it again.
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

**Stage A is done as of 2026-09-02 (`7429863`) — V1 and V2 landed together in
one commit. Stage B is next, and starts at V4 — V3 was withdrawn 2026-09-02
([DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)),
detailed in its own bullet below.**

- ~~**V1. Rename the header menu "My workouts" → "Workouts".**~~
  **Fixed 2026-09-02 (`7429863`).** The `<summary>` in
  `apps/builder/index.html` reads **Workouts**; the two `builder.js` /
  `builder.css` section comments that named the old label were swept with it.
  `id="mine"` / `el('mine')` / `.mine-*` stayed — internal names. The one
  remaining "my workouts" string is the panel's own **Save to my workouts**
  button, which is still literally true and was left alone.

- ~~**V2. "Examples" row → "Libraries", and the chip drives the search box.**~~
  **Fixed 2026-09-02 (`7429863`).** The row label is **Libraries**, and a chip
  is now pure sugar over the search box: its `onclick` writes `` `${handle}:` ``
  into the input and calls the existing debounced `onMineSearchInput`, so
  `searchWorkouts`'s `wdlId~` substring returns exactly that namespace. The lit
  state is derived from the query — **exact** match on `<handle>:`
  (`libraryChipActive()`), so typing past the prefix drops it and re-clicking a
  lit chip empties the box back to the plain saved list. The whole parallel path
  went: `browseOrg`, `mineOrg` / `mineOrgList` / `mineOrgSeq`,
  `renderMinePanel`'s org branch, `onMineSearchInput`'s org guard, the sign-out
  reset, and `listOrgWorkouts` in `apps/shared/pocketbase.js` (the board never
  used it; the mock `/api` had no handler of its own — the generic
  `workouts/records` filter serves both). `ORG_ACCOUNTS` dropped the fixed org
  ids it no longer needs. `renderExamplesRow` → `renderLibrariesRow`; the
  `.mine-examples` / `.examples-label` CSS class names are L7's and stayed.
  **One consequence handled rather than left:** `listOrgWorkouts` fetched
  `perPage=200` but the search fetches `SEARCH_PER_PAGE`, which was **20** — so
  the CrossFit chip silently returned 20 of 31 rows with no "more" affordance.
  The constant is now **50**, enough to cover the largest curated library in one
  page (crossfit 31 / hyrox 9 / tabata 3), with the reason in the comment. If a
  library ever passes 50 this needs a real paging affordance, not a bigger
  number.

### Stage B — editor ergonomics (the visible win; V4 is the keystone)

**Stage B is done as of 2026-09-02 (`10a2b8a`) — V4 and V5 landed together in
one commit, and V5 carried the caption-bug fix with it. Stage C is under way —
V6 landed 2026-09-02 (`370b2d0`), so it starts at V7.**

- ~~**V3. Measured output → a 3-way segmented control.**~~ **Withdrawn
  2026-09-02 by Chris — the premise does not hold. Nothing shipped; no code
  landed. Settled as
  [DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)
  and listed in
  [../topics/deliberately-not-done.md](../topics/deliberately-not-done.md); the
  editor keeps its two checkboxes.** The decision above said *measured output is mutually
  exclusive*, contrasting it with counting modes, which "genuinely co-occur".
  Built as specified, then verified against the data and the consumers, and
  **`measures` genuinely co-occurs too**. Three entries in the committed
  registry carry both values — **`bike`, `row`, `skierg`**, the three
  ergometers — and that is correct curation, not drift: a rower is prescribed in
  metres *or* in calories. The spec is explicit
  (**§9.3 / spec-0.1.md:178**, "`1min Row` ends on duration and *measures*
  calories"; **:185**, a duration-completed step "defaults from the movement's
  registry `measures`"; **:1058**, `- 1min Row, count cal`), and
  `import-movement-curation.mjs:232` maintains the field as a **per-mode
  independent** set in as many words. **`measures` on an entry is a capability
  set — the output units this movement *can* be measured in — not a choice.**
  All four subsets are meaningful: neither (a squat), distance (a run),
  calories, both (the three ergs). A checkbox pair is the right control for a
  capability set; the review mistook the set for a choice.

  **What single-select would have cost, verified in the browser:** the editor
  seeded on the *first* known value, so opening `skierg` showed only
  **Distance** lit and saving would have written `["distance"]`, silently
  dropping `calories`. That is not cosmetic — it breaks two shipped consumers.
  (1) **`calorieUnitHints()`** (rule 2, **DEC-022**, landed 2026-09-01,
  `952c80c`) fires only when `(entry.measures ?? []).includes('calories')` —
  and `bike` / `row` / `skierg` are the **only three entries in the registry
  that carry `calories` at all**, so narrowing any of them switches the
  diagnostic off for that movement permanently. Confirmed live: `15 Row` raises
  *"a bare count on a machine that measures calories — did you mean `15cal
  Row`?"* today, and would not after a save. (2) **the `»` panel**
  (`builder.js:329`) maps **one pick per mode**, so a Row step offers both
  `, count distance` and `, count cal`; narrowing removes one. A save would
  also move `registry/movements.json` under `make movements:dump`.

  **Chris's call, 2026-09-02: withdraw V3** — keep the checkbox pair, since it
  is the correct control for a capability set and there is no meaningless state
  to prevent. The two alternatives considered and declined with it: a **4-way**
  control (None / Distance / Calories / Both), which preserves the data but is
  the checkbox pair with more clicks; and **narrowing the data** to one measure
  per movement, which contradicts spec §9.3 and the curation script's per-mode
  contract. Full reasoning in
  [DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice).

  The ergonomic complaint underneath the review is real and survives the
  withdrawal: see the caption bug in
  [../topics/builder-ux.md](../topics/builder-ux.md) ("The movement editor"),
  which **V5 should fix** when it restructures these fields. *Touched by the
  reverted attempt: `apps/shared/movement-editor.js`,
  `apps/builder/builder.css`. No core.*

- ~~**V4. Build the reusable token-input widget.**~~ **Fixed 2026-09-02
  (`10a2b8a`, with V5 in one commit).** `apps/shared/token-input.js` —
  `createTokenInput({ container, value, vocab, allowCustom, placeholder,
  onChange })`, returning `{ value(), focus(), destroy() }`, host-agnostic the
  way `movement-editor.js` is (no builder globals; the caller hands it a
  container and callbacks). Renders the three things as specified: removable
  chips; a text entry with type-ahead over `vocab` (arrow-key highlight, Enter
  or click to add, a `＋ Add "x"` row when `allowCustom`, a **no-op that leaves
  the typed text visible** when not — clearing the box would have made a refusal
  look like a success); and, below the field, a filter/select picker (filter box
  + a `max-height` / `overflow:auto` checklist, click to toggle). `vocab` may be
  a `string[]` or a sync/async function, resolved once at mount. Comma and a
  pasted `a, b, c` still commit tokens, so the old comma habit survives the
  control change. **One composition at every vocab size** — settled as
  [DEC-024](../topics/settled-decisions.md#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker).
  The only thing size changes is how far the two bounded lists scroll; the only
  thing a vocab's *absence* changes is that the picker and type-ahead are not
  rendered at all (`aliases` is chips + free text). Both the menu and the picker
  sit in **normal flow, not floating**, so neither can be clipped by or overflow
  the modal's own scroll container at any width — verified at 768px. CSS in
  `apps/builder/builder.css` on the shared tokens only, ≥2rem hit boxes, no text
  under `.75rem`, secondary text dimmed by colour. *Touched:
  `apps/shared/token-input.js` (new), `apps/builder/builder.css`.*

- ~~**V5. Wire the token-input widget into the movement editor.**~~
  **Fixed 2026-09-02 (`10a2b8a`, with V4 in one commit).** All seven list fields
  — `aliases`, `equipment`, `pattern`, `related`, `sameAs`, `musclesPrimary`,
  `musclesSecondary` — are `createTokenInput`s. `collect()` emits the same
  arrays it always did, so the request body, the write path and **both**
  cross-field validations are untouched; `splitList` / `joinList` retired with
  their last callers. Vocab from a new **`apps/shared/vocab.js`**: `EQUIPMENT`
  (29 terms) and `MOVEMENT_PATTERNS` (11) as literals seeded from
  `registry/movements.json`, and `muscleIds()` fetching `registry/muscles.json`
  relative to `import.meta.url` (never duplicated — a stale copy would offer a
  term `build-movements.mjs` rejects). `createMovementEditor` gained an optional
  **`vocab`** option keyed by field name; the builder passes `related` (curated
  ids) and `sameAs` (canonical ids) through it, so the editor still holds no
  movement list of its own and stays host-agnostic. `allowCustom` false for
  muscles, true for the rest.
  **Also fixed the caption bug** recorded in
  [../topics/builder-ux.md](../topics/builder-ux.md): a `group()` twin of
  `field()` wraps a multi-input control in a `<div role="group"
  aria-labelledby>` instead of a `<label>`, used by both checkbox groups and all
  seven token inputs — written as the rule, not as the two fields that broke.
  **Two corrections to this item's own note, recorded in `vocab.js`.**
  `kettlebells`→`kettlebell` and dropping `other` were right; **"fold the
  machine variants" has nothing to fold** in `registry/movements.json`, whose 31
  distinct values carry exactly one term containing "machine". The variants
  (`smith machine`, `t-bar machine`, `machine: bench press`, …) are in
  `registry/movements.canonical.json`, the raw upstream union — `Barbell` beside
  `barbell`, `none (bodyweight exercise)` — which is a merge artefact rather
  than a vocabulary, and is exactly why the curated registry is the seed.
  Checked against the committed data before writing the list, per DEC-023.
  *Touched: `apps/shared/{movement-editor.js, vocab.js (new)}`,
  `apps/builder/builder.js`, `apps/builder/builder.css`. No core;
  `make test` 2064/2064, 1 pending, before and after.*

### Stage C — equipment + patterns become data (mirror the movements M-series, lean)

- ~~**V6. Vocab files + collections + migration.**~~ **Fixed 2026-09-02
  (`370b2d0`).** `registry/equipment.json` (29 terms) and
  `registry/patterns.json` (11) are committed, plus
  `deploy/pocketbase/pb_migrations/1757100000_create_vocab.js` creating the
  `equipment` and `patterns` collections. Settled as
  [DEC-025](../topics/settled-decisions.md#dec-025-equipment--movement-patterns-are-a-db-backed-vocabulary-layer-registryequipmentpatternsjson-is-the-committed-dump).
  Both files were **seeded from `apps/shared/vocab.js`** as the note said, and
  re-checked against the data anyway: the 31 distinct `equipment` values in
  `registry/movements.json` minus `kettlebells` (folded) and `other` (dropped)
  is *exactly* the committed 29, and the 11 patterns match — V5's list agrees,
  so nothing was re-derived differently. Ordering kept from `vocab.js`
  (equipment alphabetical, patterns grouped by family), with the reason in each
  `$comment`. The migration builds both collections from one
  `vocabCollection(name)` helper so they cannot drift: `termId` (text, required,
  unique index) for the registry `id` — not `id`, which clashes with
  PocketBase's own record id — plus `name`, `synonyms` (json), `scope`
  (`select global|user`, required), a nullable `user` relation and the two
  autodate fields; read rules `scope = "global"`, write rules
  `@request.auth.admin = true`; `down` deletes both in reverse creation order.
  Entry added to `deploy/pocketbase/pb_migrations/README.md`, which lists every
  migration.

  **Three corrections to this item's own note, each found by reading the
  committed file rather than the note** — the DEC-023 habit, which is now three
  for three:
  - **The entry shape is `{ id, name, synonyms }`, not `{ id, label, synonyms? }`.**
    `registry/muscles.json` — the file this one is explicitly modelled on — uses
    **`name`**. Matching the committed file beats matching the note, so the JSON
    key and the collection column are both `name`. `synonyms` is *always*
    present, empty where there is nothing to fold, because muscles.json is
    always-present and its reader (`scripts/lib/muscles.mjs`) iterates it
    without a guard.
  - **A pure case variant is not a synonym.** The note offered `Barbell` as a
    good one to mine out of the canonical file. But the lookup that reads these
    lists folds case, spaces, hyphens and underscores (`flat()` in
    `scripts/lib/muscles.mjs`), so `Barbell` already resolves to `barbell` and
    listing it claims a distinction that does not exist — same for `Swiss Ball`,
    which is committed as **`swiss ball`**, the lowercased form muscles.json's
    `$comment` specifies. The 16 synonyms that survive that fold are the ones
    committed, each verified to appear as a raw value in one of the two movement
    files: `kettlebells`, `dumbbells`, `swiss ball`, `stability ball`, `sz-bar`
    (wger's German name for an E-Z curl bar), `cable machine`, `exercise band`,
    `resistance band`, `body`, `none (bodyweight exercise)`, and the six
    `machine` variants (`smith machine`, `t-bar machine`, `chest machine`,
    `machine: bench press`, `machine: butterfly`, `machine: chest`) — which are
    the variants V5 correctly reported it had nothing to fold *in the curated
    file*, and which land here as synonyms because this is where they belong.
  - **`patterns.json` carries no synonyms at all, and that is a finding.**
    `pattern` is a wdl-curated field with no upstream source, so
    `movements.canonical.json` holds the same 11 values —
    nothing to mine. The key is kept and kept present so the two files share one
    shape.

  Terms **deliberately left out** of `equipment.json`: `bench` (and its six
  `flat`/`incline`/`decline`/`hyperextension` spellings), `balance board`,
  `bosu ball`, `gym mat`, `towel`, `weight` / `weight plate`, `parallel bars`,
  `bar`, `v-bar`, `wide bar`. All are canonical-only kit with **no vocabulary
  term to be a spelling of** — folding `parallel bars` onto `parallettes` or
  `bosu ball` onto `exercise ball` would invent an equivalence, which is the
  failure mode the curated registry exists to avoid. If any of them is a real
  gap it is a *new term*, not a synonym, and now costs a DB row rather than a
  code edit. `other` stays dropped.

  Migration verified up **and** down against a real pocketbase **v0.40.1
  (darwin_arm64)** binary and a throwaway `pb_data`, the M1/M2 method: `migrate
  up` applies all six migrations cleanly (exit 0); both collections land with
  all seven fields and all four indexes (`sqlite3` against `_collections` /
  `sqlite_master`); the unique index rejects a duplicate `termId` (`UNIQUE
  constraint failed: equipment.termId`); the `user` relation resolves to
  `users`; `migrate down 1` drops both, leaving `movements` / `workouts` /
  `users` and their indexes intact with **zero** leftover `sqlite_master` rows;
  a re-`up` reapplies cleanly. Binary and temp `pb_data` discarded, not
  committed. *Touched: `registry/{equipment,patterns}.json` (new),
  `deploy/pocketbase/pb_migrations/1757100000_create_vocab.js` (new),
  `deploy/pocketbase/pb_migrations/README.md`. No core, no app change —
  `apps/shared/vocab.js` is untouched and stays the source until V8.
  `make test` 2064/2064, 1 pending, before and after.*

- ~~**V7. Fixtures + mock `/api` for equipment + patterns.**~~ **Fixed
  2026-09-02 (`67001cb`).** `scripts/mock-api.mjs` serves `equipment/records` +
  `patterns/records` in the PB list-envelope shape from one `makeVocab(name,
  prefix)` factory (the mock twin of the migration's `vocabCollection`), a
  field-for-field copy of the `movements/records` handler: `termId` (registry
  `id` → column) / `name` / `synonyms` / `scope: "global"` / empty `user` /
  `created` / `updated`; `filter` / `sort` / `page` / `perPage` via the shared
  `applyQuery` + `listEnvelope`; `/records/:id` by synthetic id (`eq…` / `pt…`
  hash) or `termId`; reads open, `POST`/`PATCH`/`DELETE` behind the
  `Authorization` gate (403 without). Authorised writes overlay onto git-ignored
  `fixtures/{equipment,patterns}.local.json` (`records` + `deleted` tombstones),
  keyed by `termId`, merged over the registry seed on read — the two entries
  added to `.gitignore` beside the three existing ones. **Derives from
  `registry/{equipment,patterns}.json` at boot — no committed
  `fixtures/{equipment,patterns}.json`.** The V7 note offered "commit the fixture
  *or* derive"; re-checked, and there is no `fixtures/movements.json` (only
  `users.json` / `workouts.json`), so derive is the movements pattern and the one
  taken. Drove it: `make serve` then `curl` both routes — `totalItems` **29** /
  **11**, single-record fetch by synthetic id and by `termId`, unauthenticated
  `POST` → **403**, authorised `POST`/`PATCH`/`DELETE` persist to the
  `.local.json` overlay and survive a server restart. One mock record compared
  field-for-field against `1757100000_create_vocab.js`'s column list — they
  agree (the mock adds only PocketBase's own always-present `id` /
  `collectionId` / `collectionName`). No core, no app change —
  `apps/shared/vocab.js` untouched, still the source until V8. `make test`
  2064/2064, 1 pending, before and after. *Touched: `scripts/mock-api.mjs`,
  `.gitignore`.*

- ~~**V8. Load script + point the widget at the API.**~~ **Fixed 2026-09-02
  (`b2efb64`).** `scripts/vocab-to-db.mjs` / `make vocab:load` — a no-deps
  idempotent upsert of `registry/{equipment,patterns}.json` into the two
  collections, keyed on the registry `id` → `termId` unique index, `POST` the
  absent and `PATCH` only `name` / `synonyms` where they differ; per-collection
  `created` / `updated` / `unchanged` tally, `--dry-run`, `--api` / `WDL_PB_URL`
  default `http://localhost:8081`, prod auth identical to `movements-to-db.mjs`
  (the vocab write rule is `@request.auth.admin = true`, verified against the
  migration). `listEquipment()` / `listPatterns()` in `apps/shared/pocketbase.js`
  copy `listMovements()`'s shape (`filter=scope="global"`, `sort=termId`,
  `perPage=1000`, auth only if a token is held). `apps/shared/vocab.js` now
  fetches those and maps each row to `termId`, with the committed literals kept
  as the offline fallback; `movement-editor.js` swaps `() => EQUIPMENT` /
  `() => MOVEMENT_PATTERNS` for the new `equipmentVocab` / `patternVocab` — the
  `vocab:` option is still a function returning an id array, so `createTokenInput`
  and `collect()` are untouched. **Optional `make vocab:dump` was not built** —
  the round-trip guarantee is not wanted for a two-file, forty-term vocabulary
  edited through the registry files, and V8's bullet gated it on that.

  **Two corrections to this bullet's own text, both recorded in `vocab.js`** —
  the DEC-023 verify-the-premise habit, now four for four in this epic:
  - **"the same fallback pattern the apps use for movements" — there is none.**
    `builder.js` loads movement *lists* straight from `registry/movements*.json`
    with a bare `.catch` that only warns; there is no `/api`→file fallback to
    mirror. The pattern actually mirrored is `vocab.js`'s own `muscleIds()`:
    fetch, `.catch` → bundled default, null the cached promise so a later open
    retries.
  - **the literals were never `{ id, name, synonyms }`.** `EQUIPMENT` /
    `MOVEMENT_PATTERNS` are and were bare `string[]` of ids. So the
    interchangeable shape is a `string[]` of term ids — `listEquipment()` returns
    full rows (like `listMovements()`), and `vocab.js` maps them to `termId`.

  Drove it against `make serve`: both pickers populate from
  `GET /api/collections/{equipment,patterns}/records` (**29** / **11**, `termId`
  order); with `WDL_MOCK_API=0` they still populate from the bundled literals
  (**29** / **11**, family order for patterns) and the console warns
  `equipment: no /api vocabulary, using the bundled list — 404 Not Found`.
  `make vocab:load` against the mock: first run **all `unchanged`** (40) for both
  collections (the mock serves the full registry on read, so the diff matches —
  the movements precedent); `--dry-run` writes nothing (`git status` clean);
  `curl -X DELETE .../equipment/records/skierg -H 'authorization: mock'` then
  `make vocab:load` reports **1 created** for equipment and nothing else; a
  `curl -X PATCH` drifting `name` / `synonyms` then a reload reports **1
  updated**; an idempotent re-run writes nothing. `make test` **2064/2064, 1
  pending**, before and after. No `packages/core` change. *Touched:
  `scripts/vocab-to-db.mjs` (new), root `Makefile`, `apps/shared/{pocketbase.js,
  vocab.js, movement-editor.js}`.*

- ~~**V9. Inline "＋ new term" in the picker.**~~ **Shipped 2026-09-02
  (`2a534b6`)** as N1 of the three-task set below — full write-up in the
  **### N1 — V9** section. An admin-only row in the token-input picker
  (`onCreateTerm` opt) that `POST`s a `{ termId, name, synonyms: [], scope:
  "global" }` row to `equipment` / `patterns`; the term is added to the live
  vocabulary optimistically and the `dbVocab` cache is busted so the next editor
  open re-fetches. Gated on `currentUser()?.admin`; the server rule is the real
  boundary and a 403 rolls the optimistic add back with the message inline. Slug
  rule settled as
  [DEC-026](../topics/settled-decisions.md#dec-026-the-inline--new-term-slugs-by-lowercase--trim--collapse-whitespace-keeping-typed-hyphens).

### Sequencing

```
V1 ─┐
V2 ─┴─ ship (Stage A, independent, no risk)
V3 ──── WITHDRAWN 2026-09-02 (premise false — DEC-023; blocked nothing)
V4 ──> V5 ── shipped ───────────┐
V6 ── shipped ──> V7 ── shipped ──> V8 ─┴─ shipped (V8 swapped V5's vocab source to the API)
                                          V9 ── shipped 2026-09-02 (`2a534b6`, as N1)
```

**Stage C is complete — V6 (`370b2d0`), V7 (`67001cb`), V8 (`b2efb64`) all
shipped 2026-09-02, and V9 (`2a534b6`) closed the epic** as N1 of the
three-task set in **## Next builder-UX work** below.
**Prod, 2026-09-02: V8 is fully live.** `make deploy:db`, `make vocab:load`
and `make deploy` have all run — `equipment` 29 rows, `patterns` 11, and the
served `apps/shared/*.js` is byte-identical to `origin/main` V8, so the prod
editor fetches the DB vocab with the bundled literals as the offline fallback.

**Stage A shipped 2026-09-02 (`7429863`).** **V3 is withdrawn** (2026-09-02 —
its premise turned out to be false; DEC-023, see the item above); it was
independent of everything else, so nothing waited on it and nothing changes.
**Stage B shipped 2026-09-02 (`10a2b8a`) — V4 and V5 in one commit**, the
ergonomics deliverable, on static vocab; its pattern is settled as
[DEC-024](../topics/settled-decisions.md#dec-024-the-token-input-is-one-composition-chips--type-ahead--a-filterselect-picker).
They landed together on purpose: V4 has no user-visible surface on its own, and
this repo verifies by driving the real app, so a scratch host page would have
proved less than driving the editor V4 exists for.
**Stage C shipped 2026-09-02 — V6 (`370b2d0`), V7 (`67001cb`), V8
(`b2efb64`)**, and the DEC behind all three is written:
[DEC-025](../topics/settled-decisions.md#dec-025-equipment--movement-patterns-are-a-db-backed-vocabulary-layer-registryequipmentpatternsjson-is-the-committed-dump),
"equipment & movement patterns are a DB-backed vocabulary layer;
`registry/{equipment,patterns}.json` is the committed dump", mirroring
[DEC-020](../topics/settled-decisions.md#dec-020-the-curated-movement-layer-lives-in-pocketbase-registrymovementsjson-is-its-committed-dump).
V6 shipped the data and the schema; V7 put both vocabularies behind the local
mock `/api`; **V8 added `make vocab:load` and put the `/api` fetch in front of
`apps/shared/vocab.js`'s literals, which are now the offline fallback** — so the
movement editor's equipment and pattern pickers read the DB when it answers and
the bundled list when it does not. That staging matched M1→M3 for movements.
**V9 (`2a534b6`, 2026-09-02) closed the epic** — the inline "＋ new term" row,
dispatched as N1 of **## Next builder-UX work** below.
Prod is fully deployed as of 2026-09-02 — `make deploy:db` + `make vocab:load`
+ `make deploy` all run (`equipment` 29, `patterns` 11; served V8 JS
byte-identical to `origin/main`), so the live editor fetches the DB vocab.

---

## Next builder-UX work — three concrete tasks (Chris, 2026-09-02)

With the two dispatchable design-critique items verified already-done (read-pane
scroll, header row — both by the R1 redesign), Chris named the work that
concretely comes next. **Order: N1 → N2 → N3.** No hard dependency chain, but
this order is deliberate — N1 is a small no-dep win, N2 is the keystone that
unblocks two further design-critique items, N3 is independent and lands after
N2's large `builder.{js,css}` churn so it isn't rebasing across it. Each is its
own session; each spawns the next when it lands.

*Not in this set: the **laterality curation sweep** — Chris does that manually
through the audit CSV (`make curation:sheet`), it is not a coding task. It stays
in the loose bullets below as his step.*

### N1 — V9: inline "＋ new term" in the token-input picker — **DONE 2026-09-02 (`2a534b6`)**

**Shipped.** An admin-only row in the token-input picker creates a new global
equipment / movement-pattern term without leaving the editor. `make test`
2064/2064, 1 pending — unchanged (app code; core suite does not cover it).
Drove `make serve` signed in: added `indian club` and `weight vest` in the
equipment picker and `anti-rotation` in the patterns picker — each showed as a
pickable option, added a chip, `collect()` still emitted the same array
(`equipment: ["indian club"]` on a saved movement); `curl` confirmed each row
`scope: "global"`; after a server restart all three were served (equipment
`totalItems` 29 → 31) and appeared in a freshly opened editor's picker. Muscles
picker has no row (unchanged). Signed out, the row is gone. A rejected `POST`
rolls the optimistic add back, keeps the typed text, and shows the message
inline (verified against a forced 403 and the server's real no-auth 403). Light
+ dark + 768px — the row sits in normal flow inside the picker, not clipped.
No console errors.

**Decisions made:**
- **Which fields.** A new `onCreateTerm` opt on `createTokenInput`, passed only
  for `equipment` / `pattern` by the builder. Not inferred from `allowCustom` —
  absent opt ⇒ no row. Muscles, `aliases`, `related`, `sameAs` never get it.
- **The gate.** `currentUser()?.admin` in `builder.js` — when false the opt is
  `undefined` and no row renders. *Note: `#movement-new` itself carries no such
  gate today (the queue brief's premise there was slightly off) — the server
  rule is the only boundary on the existing button; V9 adds the client gate the
  brief describes for the new row.*
- **Cache-bust.** `dbVocab()` closures gained `.reset()` (drops the cached
  promise); `builder.js` calls it after the `POST`. The widget splices the term
  into its live `terms` list optimistically so the current picker updates
  without waiting.
- **Slug rule** — settled as
  [DEC-026](../topics/settled-decisions.md#dec-026-the-inline--new-term-slugs-by-lowercase--trim--collapse-whitespace-keeping-typed-hyphens):
  lowercase + trim + collapse whitespace, hyphens kept as typed (equipment ids
  keep spaces, pattern ids hyphenate — no one transform is right for both). The
  row is withheld when the text folds (case/space/hyphen/underscore) to an
  existing term.

Original brief kept below for the trail.

**Chris: "I definitely want that."** An **admin-only** row in the token-input
picker (`apps/shared/token-input.js`, the filter/select list below the field)
that creates a new global vocabulary term without leaving the editor — the
`＋ new movement` pattern, one level down.

- **Where.** Only for fields whose vocab is the DB-backed equipment / pattern
  layer (`allowCustom: true` *and* a real `vocab` source). Not muscles
  (`allowCustom: false`, closed set). `aliases` / `related` / `sameAs` already
  take free text and have no picker to add to.
- **Gate.** `currentUser()?.admin` — mirror `#movement-new`'s gate in
  `apps/builder/builder.js`. A non-admin never sees the affordance; the server
  rule (`@request.auth.admin = true` on `equipment` / `patterns`, DEC-025)
  is the real boundary and a 403 message must still surface if it is ever shown.
- **Write path.** Add `createEquipmentTerm(fields)` / `createPatternTerm(fields)`
  to `apps/shared/pocketbase.js` beside `createMovement` — `POST` a
  `{ termId, name, synonyms: [], scope: 'global' }` row (`termId` = the typed
  term slugged/lowercased the way `registry/equipment.json` ids are; `name` =
  the typed display text). One helper factored over both collections is fine.
- **Cache + live update — the fiddly part.** `equipmentVocab` / `patternVocab`
  in `apps/shared/vocab.js` are `dbVocab()` closures that **cache the resolved
  promise** (`promise ??= …`), and `createTokenInput` **resolves its `vocab`
  once at mount**. So after a successful `POST` the new term must be (a)
  spliced into the *live* widget's in-memory term list optimistically so it
  shows and can be picked immediately, and (b) the `dbVocab` cache busted (add a
  `.reset()` to the closure, or null the cached promise) so the *next* editor
  open in the same session also sees it. On `POST` failure: roll back the
  optimistic add and show the error inline (reuse the editor's existing
  error surface).
- **Scope.** `apps/shared/{token-input.js, vocab.js, pocketbase.js,
  movement-editor.js}`, `apps/builder/builder.js` (pass the gate + a
  create callback into the token inputs it builds), `apps/builder/builder.css`
  for the `＋ new term` row. **No `packages/core` change.** Mock `/api` already
  accepts authorised `equipment` / `patterns` writes (V7) and persists them to
  `fixtures/{equipment,patterns}.local.json` — delete those to reset.
- **Verify.** Drive `make serve` signed in (mock hands an `admin: true` user):
  add a term in the equipment picker, confirm it appears as a pickable option
  and as a chip when picked, confirm `curl` shows the row in
  `equipment/records`, restart the server and confirm it persisted, sign out and
  confirm the affordance is gone. `make test` 2064/2064, 1 pending, unchanged.

### ~~N2 — the *Movements* palette-drawer redesign~~ — **VOID: premise obsolete, confirmed by Chris (2026-09-02). Nothing shipped.**

**Chris, 2026-09-02:** *"a holdover from when the movement palette was the full
right sidebar or the full top row depending on browser width. Now it's an
overlay/modal, so this doesn't really mean anything anymore."* No task here — do
not re-pick. The two items it was said to unblock are both now off the coding
queue: **read-pane sub-panels — declined** by Chris (Analysis = Body + Against
your goals, Reads-as = two items, nothing to collapse); **129-row palette
grouping — deferred** pending the curation sweep + a dedicated browse-UX review
([deferred.md](deferred.md)).

**A session picked N2 up 2026-09-02, read the source, and drove `make serve` at
1440px — the palette this brief is written against does not exist.** It is not a
docked column and has no `☰`-less "no way to dismiss it" problem:

- **`apps/builder/index.html`** — the palette is `<dialog id="palette-modal"
  class="palette-modal" aria-label="Movements">`. The `.sheet` grid holds
  exactly `<section class="doc-col">` · `<div class="col-resize">` ·
  `<section class="right-col">` — **editor, splitter, analysis margin. No third
  column.**
- **`apps/builder/builder.css:161`** —
  `grid-template-columns: minmax(22rem, 1fr) 6px var(--right-col-w, 24rem)` (two
  tracks + the 6px handle). The header comment at `:9` states it outright:
  *"The movement palette is a summoned `.palette-modal` (⌘K / add-row), not a
  docked column."* `:686` — *"a centred panel, not a docked column. Same inner
  DOM the drawer held."*
- **The `@media` rules do not "stack the palette full-width on top".** `:655`
  (`max-width: 1100px`) only lowers the `--right-col-w` fallback to 20rem; `:662`
  (`max-width: 820px`) drops to one column (editor stacked above margin) and
  hides `.col-resize`. `:661` comment: *"The palette modal is centred at every
  width, so nothing about it changes here."* **There is no collapsed-palette CSS
  to promote to a `body.palette-collapsed` class.**
- **`apps/builder/builder.js:1639`** — *"Summoned, never docked: ⌘K / Ctrl-K
  anywhere, or '+ movement' / Enter on a blank outline row."* `openPalette()` →
  `paletteModal.showModal()`; `closePalette()` → `.close()`; Esc / backdrop /
  `#palette-close` all route through it.

**History (from [completed.md](completed.md)):** R1 (`758dff1`, 2026-08-30)
turned the docked column into an overlay `.drawer` + backdrop **behind a
`☰ Movements` header toggle**, `localStorage['wdl.palette-open']`, default
closed — i.e. R1 *shipped the exact toggle N2 describes*. Then **R7
(`d1a89ce`, 2026-08-31)** retired it: *"Retired: `#drawer` / `#drawer-backdrop`
/ `.drawer*` CSS / `setDrawer` / the `#palette-toggle` header button + `.ghost`
CSS / the `wdl.palette-open` bootstrap"* in favour of the summoned `<dialog>`.
So N2-as-briefed = **revert R7** — re-add a `☰` toggle + `wdl.palette-*`
persistence that was built and then deliberately deleted, to collapse a column
that has not existed since 2026-08-30.

**This is the third entry from the 2026-08-30 design-critique pass to turn out
stale-the-day-it-was-written** — the read-pane-scroll and header-control-row
entries from the same pass were both found already-done by R1 and struck
(see the "Recently closed" bullets above). The palette-column entry has the
same cause: it describes the pre-R1 four-/three-column `<main>` grid.

**Open for Chris — the call this session cannot make.** With the palette already
a dismiss-anywhere modal that costs zero width when closed, is there anything
left to do here?
- If the complaint was *"a docked column"* — **it is fully resolved**, strike
  N2, and the two follow-ons (129-row grouping, read-pane sub-panels) are gated
  on nothing but your say-so.
- If there is a *live* ergonomic gap in the modal (opens over the caret you were
  reading; ⌘K discoverability; the modal's own height on a laptop) — that is a
  **different, smaller task** and needs re-scoping in one line.
- The `builder-ux.md` **## Layout** entry has been struck with this finding so it
  is not re-picked as written.

Original brief kept below for the trail. **Its every load-bearing claim — "~24%
column", "at 1440px the three panes are 344 / 688 / 408px", "the
`@media (max-width:1100px)` rule already does the right thing structurally
(palette full-width on top, capped, own scroll)", "reuse the existing
collapsed-palette CSS as the drawer's closed state" — is false against the
current source.**

The design-critique item *"Movements is a permanent ~24% column with no way to
dismiss it"* (see [../topics/builder-ux.md](../topics/builder-ux.md) **## Layout**).
**Now scoped by Chris — do it.** The palette is *reference you dip into*; it
should not hold a quarter of the width while you are heads-down in the editor.

- A **header toggle** (hamburger / rail) that collapses *Movements* to a strip
  or an overlay drawer **at any width**, so the editor + analysis get the full
  canvas. The `@media (max-width:1100px)` rule already does the right thing
  structurally (palette full-width on top, capped, own scroll) — this makes it a
  *choice*, not only a width response. Reuse the collapsed-palette CSS as the
  drawer's closed state; persist in `localStorage` like `wdl.editor-tab` /
  `wdl.right-col-w`.
- **Must stay inside direction C** and must not regress `--right-col-w` /
  `.col-resize` / `#bodymap` scaling or the `@media` structural behaviour
  (struck entries in `builder-ux.md` **## Layout**).
- **Note for the follow-on:** landing the drawer **unblocks two further
  `builder-ux.md` design-critique items** that were explicitly gated on it — the
  flat 129-row core movement list needing pattern/region grouping
  (**## Movements**), and the read pane's four stacked `<h2>`s needing
  collapsible sub-panels (**## What it reads**). The N2 session should close its
  loop by noting those are now dispatchable and (optionally) spawning them.
- **Scope.** `apps/builder/{index.html, builder.css, builder.js}`. No core.

### ~~N3 — the board's **Edit** button round-trips into the builder~~ — **DONE 2026-09-02 (`fecf6b3`)**

**Shipped.** The board's footer **"Edit in builder ↗"** button — which used to
drop the hash/query and reload the board to its empty paste-box — now opens the
builder on the workout the board is showing, in a new tab. Last piece of the
post-redesign account thread; the rest shipped in the L-series. `make test`
2064/2064, 1 pending — unchanged (app code; the core suite does not cover it).

Drove `make serve`, signed in as the mock `admin: true` user:
- **Owned workout** (`?w=wk_mock_gtg_000001`): board shows the button →
  `../builder/?w=wk_mock_gtg_000001` loads the builder **attached** (panel shows
  *Save* + *Save as copy* + the sharing row, no "read-only copy" note); Save
  `PATCH`ed the same record — workout count unchanged at 4.
- **Public library workout** (`?w=crossfit:fran`): builder opens a **detached**
  copy (*Save to my workouts*, note "Opened crossfit:fran — a read-only copy;
  Save makes it yours."); first Save `POST`ed a **new** `fresh-dune:fran` row
  owned by the mock user — `crossfit:fran` was **not** `PATCH`ed.
- **Raw `#<source>` board**: no Edit button (nothing saved to round-trip to).
- `?w=` (both a record id and a `<handle>:<slug>`) **survives a builder reload**
  — same row, same attach state, URL never expands into the `#<source>` hash.
- A bogus `?w=` → `console.warn` + the default buffer, builder stays up.
- The board's division picker / Reset / footer layout are unaffected; verified
  the button on a normal width and at 375px (footer wraps, button on its own
  row, no clipping); dark only (the board has no light theme); no console errors.

**Decisions made:**
- **Button label — "Edit in builder ↗".** It leaves the app and opens a new
  tab, so the label says where you land and the `↗` signals the new tab,
  mirroring the builder header's *Open on the board ↗*. Not the terse "Edit" the
  other footer buttons use — this is a meaningfully different (cross-app) action.
- **Placement — footer end, after the division picker and position readout**,
  where the button already sat. Reads cleanest as a distinct "leave" action.
- **Shown only for a `?w=` workout the builder can open** — a module-local
  `editKey` (the workout's `wdlId` if it has one, else its record id — exactly
  `openHitOnBoard`'s choice, in reverse) is cleared by every `load()` and re-set
  only by a `loadShared` that resolved a record; `showEditLink()` toggles
  `#edit.hidden` off it. A `#<source>` paste/drop board has no `editKey`, so no
  button.
- **Shown even with parse errors** — editing is how you fix them; the button
  gates on "is there a saved record", not on parse state.
- **No division rides along.** The builder shows both sides of a split by
  decision ("What it reads" in [../topics/builder-ux.md](../topics/builder-ux.md))
  and a `&division=` on the builder URL would be ignored, so it is not added.
- **`?w=` is the builder's load-a-saved-workout entry point** but this executes
  the existing L-series / DEC-021 copy flow across the board→builder direction —
  no new structural decision, so no DEC (the contract is: `?w=<id|handle:slug>`,
  attach when `rec.owner === currentUser()?.id`, detached copy otherwise).

**What shipped, by file:**
- `apps/display/index.html` — `#edit` starts `hidden`; label + comment updated.
- `apps/display/board.js` — `editKey` / `showEditLink()`; `load()` clears it,
  `loadShared` sets it after a resolved record; the button's `onclick` is
  `window.open('../builder/?w=' + encodeURIComponent(editKey), '_blank',
  'noopener')` (mirrors `openHitOnBoard`); `showEmpty()` retired with its only
  caller. `board.css` untouched — the footer already `flex-wrap`s and `#edit`
  uses generic `button` styling.
- `apps/builder/builder.js` — imports `getByAnyId`; a reusable
  **`openRecord(rec, mine)`** factored out of `openFoundWorkout` owns the
  attach-vs-detached-copy call in one place; the bootstrap reads
  `new URLSearchParams(location.search).get('w')` and, inside the
  `refreshAuth().then()` (so `currentUser()` is known), `await getByAnyId(w)` →
  `openRecord(rec, rec.owner === currentUser()?.id)`, degrading to a
  `console.warn` + default buffer on a failed fetch.

---

## ~~The movement editor edits the wrong record~~ — **Fixed 2026-09-02 (`a643824`)**

**Chris's call: always the API/database, never an in-memory object — "even
when it's test, it's gonna be fetching from the fixture anyway."** That
settles it as fix **2** below (fetch the row), not fix 1 (look up a file
already in memory); no `CANONICAL` fallback is ever shown in place of a
missing curated row.

`openMovementEditor()` now takes an **identity** — `null` to create, or
`{ id, title }` — and nothing else; it can no longer be handed a display
object to show. What fills the form is always `getMovementByMovementId(id)`,
exactly the row a save will `PATCH` against, awaited before the form mounts
(a `Loading…` state in the same host element the form uses, and an inline
error there rather than a silent open). A movement with no curated row yet —
most of the merged corpus — opens in **create** mode carrying only its id and
title, so every curated field is an assertion the curator makes, not one the
merge made for them. All **three** entry points route through it —
`＋ new movement`, the palette's `✎`, and the `»` panel's "Edit … its curated
fields" — closing the gap the original write-up flagged (all three needed the
same treatment, one helper rather than a per-call-site patch).

**Verified against every failure mode this section named.** `deadlift` opens
with Equipment empty (not the invented `Barbell`) and only its two curated
aliases; `skierg` opens with both curated aliases (`ski`, `ski erg`) intact;
`push-up`, opened via the `»` panel, matches `registry/movements.json`
field-for-field; a canonical-only movement (`1-leg-box-squat`, no curated row)
opens **blank**, confirming nothing is seeded from the merge. Saved `deadlift`
unedited and ran `make movements:dump`: **0 changed, 0 added, 0 removed** —
`registry/movements.json` is byte-identical, the round-trip this section asked
for. `make aliases` still reports the pinned baseline unchanged: **curated —
972 records, 0 contended names.** `make test` 2064/2064, 1 pending, unchanged.
Full write-up in [../topics/builder-ux.md](../topics/builder-ux.md) and
[../current/recent-changes.md](../current/recent-changes.md).

Kept below for the trail — the finding and the two candidate fixes, as they
stood before Chris's answer.

**A live data-integrity defect in a shipped feature, not new work.** Found
2026-09-02 while verifying V5; **pre-existing since M5 (2026-09-01), unchanged
by V4/V5**, and left unfixed because the fix is a choice. Full write-up in
[../topics/builder-ux.md](../topics/builder-ux.md) ("The palette's `✎` hands the
editor the *canonical* entry"); this slot exists so it is **scheduled** rather
than resting in that file's unordered list.

`renderPalette()` (`apps/builder/builder.js:~2092`) hands `openMovementEditor()`
the object it drew the card from, and that comes from `catalogue` —
`registry/movements.canonical.json`, the 5-source merge — not
`registry/movements.json`, the curated layer the editor exists to edit. So the
form opens on merge output and **a save writes merge output into the `movements`
collection**. Verified against the two files, it corrupts in three directions at
once:

- **It invents.** `deadlift` has **no `equipment` at all** in the curated file;
  the canonical entry says `['Barbell']` (capital B — the canonical file carries
  69 raw upstream spellings, `Barbell` beside `barbell`). Opening and saving
  writes an equipment value curation deliberately does not have, in the wrong
  case.
- **It deletes.** `skierg`'s curated `aliases` are `['ski', 'ski erg']`; the
  canonical entry has only `['ski']`. A save drops `ski erg`.
- **It smuggles.** Canonical `muscles` carries `support` and `sources`
  sub-objects. `collect()` preserves unknown sub-keys (`{...state.fields.muscles}`
  replaces only `primary`/`secondary`), so `buildBody` carries merge metadata
  into the curated column.
- **It adds aliases, and a few of those flip which movement a name resolves
  to — the sharpest direction, added 2026-09-02.** The alias flow is not
  one-way: where `skierg` *loses* `ski erg`, `deadlift` *gains* `Deadlifts`.
  Measured across the committed files (folded-key comparison, entries present in
  both): **123 curated entries would gain aliases, 140 added names in total.**

  *Corrected 2026-09-02, same day, before anyone acted on it. This bullet first
  said the danger was the **self-plurals** — 28 of the additions being a regular
  self-plural of the entry's own title (`Burpees`, `Back Squats`) — citing
  [../topics/lessons-learned.md](../topics/lessons-learned.md)'s* A ranking
  between two kinds of name has to survive the plural. *That has it backwards.
  The self-plurals are the **guarded** class: the fix that lesson produced is
  `fold.ts:212` — `if (depluralize(fold(a)) === fold(entry.id)) continue;` — so
  a record's own regular self-plural is **never indexed at all**. Written into
  the DB it is inert for resolution; it pollutes the row and shows in a
  `movements:dump` diff, but it cannot split `Squat` from `Squats`. **31 of the
  140 additions are that harmless class.***

  **The real risk is the other 109**, which *are* indexed as genuine alias
  claims — and **6 of them collide with a name another curated record already
  holds as its id/title**. Since the 2026-08-23 reordering made **an explicit
  alias beat a record's own id**, each of those six flips the name onto the
  wrong movement:

  | the record that gains the alias | the name it would claim | currently resolves to |
  |---|---|---|
  | `bent-over-row-barbell` | `Bent Over Barbell Row` | `bent-over-barbell-row` |
  | `biceps-curl-machine` | `Machine Bicep Curl` | `machine-bicep-curl` |
  | `cable-front-raise` | `Front Cable Raise` | `front-cable-raise` |
  | `dumbbell-split-squat` | `Split Squat with Dumbbells` | `split-squat-dumbbells` |
  | `pec-deck` | `Butterfly` | `butterfly` |
  | `squat-bands` | `Squats - With Bands` | `squats-bands` |

  **And the suite would not catch it.** The bullet first named
  `never changes which movement a name resolves to` as the guard; that test
  compares `title` against `pluralize(title)`, so it sees plural/singular splits
  and not an alias-tier flip on an unrelated spelling. `Registry.validate()`
  misses them too — it reports only *within-tier* duplicates (`byName` or
  `byAlias` mapping to more than one entry), and an alias-on-A / id-on-B
  collision is length 1 in each. The tool that does list them is
  **`make aliases`** (`scripts/check-aliases.mjs`), which `fold.ts`'s own comment
  names for exactly this case. **Run `make aliases` before and after a post-fix
  `make movements:dump`** — that is the check, not the test suite. The baseline
  to hold, measured 2026-09-02 at `7956fa1`, pins the two sides separately:

  ```
  curated   (registry/movements.json)           — 972 records,  0 contended names
  canonical (registry/movements.canonical.json) — 3109 records, 1 contended name
                                                   assaultbike -> bike (via alias)
  ```

  **`0 contended names` on the curated side is the acceptance criterion** — that
  zero is exactly what the six collisions break, and it is a sharper test than
  "run `make aliases` and read it". One of the six is a small warning about how
  quietly this would land: `squat-bands` claiming `Squats - With Bands` lands on
  **Squat with Bands**, already pinned in `fold.test.ts:347` as one of the three
  known plural-split survivors the suite tolerates — so the defect would add a
  *second, different* problem to a record the suite is already looking at and
  still passing.

**Same class as the bug [DEC-023](../topics/settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice)
was written to prevent** — a silent write-back that degrades curation, invisible
in the form and invisible to the suite — which is the argument for doing it
**before Stage C**: V6→V8 is additive infrastructure, this is losing curated data
on every `✎` save today. That ordering is Chris's call too. The fourth bullet
raises the stakes: the first three degrade one row each, quietly, but a bad
alias claim reaches **name resolution**, so the damage is not confined to the
row that was edited — a workout that never mentions `pec-deck` still resolves
`Butterfly` differently afterwards. It is also the one direction **no test
covers**, so it would surface as a muscle total quietly moving, not as a red
suite.

**Two fixes; Chris picks one.**
1. **Look the curated entry up by id before opening**, falling back to the
   canonical one for a movement the curated layer does not carry. No network,
   no new state; needs the curated file loaded in the builder (check whether it
   already is — the palette only loads `CANONICAL`).
2. **Fetch the row over `/api`** the way `getMovementByMovementId` already can.
   Always current and matches what the save will `PATCH` against, but adds a
   round-trip and a failure path to opening the editor.

Whichever wins, **`＋ new movement` and the `»` panel's "Edit … its curated
fields" need the same treatment** — check all three entry points, and write the
fix as the rule (one helper that resolves a movement id to the record the editor
should edit), not as a patch at the palette call site.
*Scope: `apps/builder/builder.js`. No core change. Verify by opening `deadlift`
and `skierg`, confirming the form shows the curated values, saving, and checking
the `PATCH` body carries no `support` / `sources`, no invented equipment, and no
added alias — then `make aliases` and a `make movements:dump` diff, which is
what catches the resolver direction.*

---

## Soft delete across records (D0–D6)

Queued 2026-09-05 (Chris). Every user-facing record type — **workouts,
movements, movement sets, goals** — gets a nullable **timestamp** column
`deleted`: `null` = live, a timestamp = soft-deleted and *when*. The existing
delete buttons (workouts `deleteMine`, set cards `✕`, goals `✕`) issue a hard
`DELETE` today; they become soft-deletes, and the one surface with no delete
button — movements, in the editor — gets one. App + DB only, **no
`packages/core` change** (D4 keeps soft-deleted movements out of the dump core
reads).

### D0 — settle the soft-delete contract (short DEC) — **DONE 2026-09-05 (`ae6c469`)**

Settled as
[DEC-029](../topics/settled-decisions.md#dec-029-soft-delete-is-a-nullable-deleted-timestamp-hidden-by-server-rules-hard-delete-is-retired)
and indexed in [../decisions.md](../decisions.md). Docs-only; `make test`
2064/2064, unchanged. The six bullets resolved:

1. **Field** — `deleted`, PocketBase `date`, nullable, **no default**. `null` =
   live, an ISO timestamp = soft-deleted and *when*.
2. **Filter placement** — **enforced in the collection rules**, Chris's call
   *over* the brief's "permissive rules + client filter". D1's migration ANDs
   `deleted = null` into the **list/view** rules of all four collections;
   create/update/delete rules untouched so the owner still `PATCH`es `deleted`
   set→timestamp and timestamp→null (restore). D2 keeps the same clause in the
   `pocketbase.js` filter strings only as defence for a rules-bypassed
   superuser read.
3. **Hard delete** — **retired entirely**, no `purge*`. `remove` / `removeSet` /
   `removeGoal` + the new movements delete all become `PATCH { deleted: <ISO> }`.
   A retention/erasure job is a separate future server-side task.
4. **The dump** — hard requirement for D4: `scripts/movements-from-db.mjs` adds
   `&& deleted=null` to its `filter=scope="global"` query (the tightened list
   rule already excludes tombstones on the unauthenticated read; the explicit
   clause guards a future authed dump). `packages/core` must never see a
   soft-deleted movement.
5. **Unique keys** — `workouts.wdlId` is already a plain non-unique index →
   nothing to do. `movement_sets.setId` / `goals.goalId` / `movements.movementId`
   unique indexes become **partial** — `CREATE UNIQUE INDEX … WHERE deleted IS
   NULL` (D1) — so a soft-deleted row frees its natural key; no id suffix.
6. **Collection scope** — the four named now. `equipment` / `patterns`
   **deferred** (admin-only global vocab, low delete pressure; V6's
   `vocabCollection` helper can add the column later).

Consequences carried into D1: the migration also edits the four list/view rules
and rebuilds three unique indexes as partial — all schema/config, one
real-binary up/down verification. No trash/restore UI in this epic; D5 only
softens delete-confirm copy.

Original brief kept below for the trail.

Decide and record in
[../topics/settled-decisions.md](../topics/settled-decisions.md) +
[../decisions.md](../decisions.md):

- **Field name / type.** `deleted` (Chris's wording) vs `deletedAt`; type
  `date`, nullable, **no default**.
- **Where the filter lives.** Server list/view rules exclude `deleted != null`
  (enforced, but blocks a later trash/restore view without an admin path) —
  *or* rules stay permissive and every client read filters `deleted = null`
  (keeps "when it was deleted" queryable for a future trash UI).
  *Recommendation: permissive rules + client filter.*
- **Hard delete.** Retained as an admin-only `purge*`, or removed entirely.
- **The dump.** `make movements:dump` (and any goals / vocab dump) **must**
  exclude `deleted != null` rows — `packages/core` reads the committed
  `registry/movements.json`, and a soft-deleted movement left in it would still
  resolve and still carry muscle data.
- **Unique keys.** Whether a soft-deleted row releases its `wdlId` / `setId` /
  `goalId` (so the name can be reused) — likely yes; note if the unique index
  forces a rule change or a suffix.
- **Collection scope.** The 4 named now; `equipment` / `patterns` follow later
  or join now — Chris's call.

### D1 — migration: add `deleted` to the four collections — **DONE 2026-09-05 (`487668e`)**

`deploy/pocketbase/pb_migrations/1757500000_add_soft_delete.js` — one migration,
edits the four *existing* collections (`add_users_admin.js` idiom):

1. Adds a `deleted` field (`date`, `required: false`, no default) to `workouts`,
   `movements`, `movement_sets`, `goals` via one helper over the collection list.
2. ANDs `&& deleted = null` onto the **list + view** rules of all four
   (create/update/delete untouched). Pre-D1 rule strings taken verbatim from the
   migrations that last set them (`goals` from `1757400000_harden_goals_rules.js`)
   and restored exactly by `down`.
3. Rebuilds `idx_movement_sets_set_id` / `idx_goals_goal_id` /
   `idx_movements_movement_id` as **partial unique** so a soft-deleted row frees
   its natural key. `workouts.wdlId` already plain non-unique — untouched.

**Correction to DEC-029's letter:** the DEC specifies `WHERE deleted IS NULL`,
but PocketBase stores an unset `date` as `''` in a `NOT NULL` column, so
`IS NULL` matches nothing and the partial index would enforce nothing. The
migration uses **`WHERE deleted = ''`** — DEC-029's intent (tombstone leaves the
uniqueness scope, live row stays in it), and the form PocketBase itself emits for
optional unique fields. Recorded on DEC-029 too.

Verified up / down / up against a real pocketbase **v0.40.1 (darwin_arm64)**
binary + throwaway `pb_data` (M1 / M2 / G1 method): `migrate up` applies all ten
migrations clean (exit 0); `deleted` present on all four (`PRAGMA table_info`,
empty for fresh rows); the four list/view rules read back with the
`&& deleted = null` clause; the three indexes read back with `WHERE deleted = ''`;
a second live row with a duplicate natural key is rejected
(`UNIQUE constraint failed`) while the same key inserts once the first row is
tombstoned — proven for all three collections; `migrate down 1` drops the field,
restores the plain unique indexes and original rule strings, zero leftover
`sqlite_master` rows; re-`up` clean. Binary + temp `pb_data` discarded (not
committed). `make test` **2064/2064**, unchanged. README row added. **Not
deployed** — `make deploy:db` lands it at D6.

Original brief kept below for the trail.

- One migration file in `deploy/pocketbase/pb_migrations/` (next timestamp
  prefix) adding `deleted` (`date`, nullable, no default) to `workouts`,
  `movements`, `movement_sets`, `goals` via one helper over the collection list
  so they cannot drift (the `1757100000_create_vocab.js` pattern). `down`
  removes it from all four.
- **Verify up and down against a real pocketbase v0.40.1 binary** + throwaway
  `pb_data` (the M1 / M2 / G1 method): `migrate up` clean; column present on all
  four (`sqlite3` against `_collections`); existing rows read back `deleted`
  null; `migrate down 1` drops it with zero leftover schema; re-`up` reapplies.
  Discard the binary + temp data (do not commit).
- Add the row to `deploy/pocketbase/pb_migrations/README.md`.
- **Scope:** `deploy/pocketbase/pb_migrations/`. No app, no core. `make test`
  unchanged.

### D2 — client: `pocketbase.js` reads filter out soft-deleted; `remove*` becomes soft-delete

- Add `deleted = null` to the filter of every read in
  `apps/shared/pocketbase.js`: `listMine`, `searchWorkouts`, `getById` /
  `getByAnyId`, `listMovements`, `getMovementByMovementId`, `listMineSets`,
  `listPublicSets`, `getSetByAnyId`, `listMineGoals`, `listGlobalGoals`,
  `getGoalByAnyId`. A soft-deleted record fetched by direct id/link → the
  existing not-found (404) shape callers already handle.
- `remove` / `removeSet` / `removeGoal` (and the movements delete path) change
  from `DELETE` to `PATCH { deleted: <ISO now> }`. If D0 keeps a hard purge, add
  `purge*` beside them.
- The builder's existing delete buttons call these, so they become soft-deletes
  with no UI change (D5 adjusts the "cannot be undone" copy and adds the
  movements button).
- **Pairs with D3** for a drivable test (mock must honour the field first).
- **Verify** (with D3): a deleted workout / set / goal leaves its list but the
  row still exists with `deleted` set; re-creating with the same natural key
  still works (per D0's unique-key decision).
- **Scope:** `apps/shared/pocketbase.js`; `apps/shared/{sets.js,goals-store.js}`
  only if they cache. No core.

### D3 — mock `/api`: honour `deleted`

- `scripts/mock-api.mjs`: the shared `applyQuery` / filter path understands
  `deleted = null`; `PATCH { deleted }` persists to the same `.local.json`
  overlays; keep the existing hard-delete tombstone path if D0 retains purge.
  **Do not conflate** the mock's internal `deleted` tombstone arrays
  (`mvDeleted` etc.) with the new record field.
- **Verify** by driving `make serve`: soft-delete each record type from the UI,
  confirm it leaves the list, confirm `curl` without the filter still returns
  the row with `deleted` set, restart the server and confirm persistence.
- **Scope:** `scripts/mock-api.mjs`. No core.

### D4 — dump path excludes soft-deleted

- `make movements:dump` (the M4 dump side — `scripts/movements-to-db.mjs` dump
  path or its script) filters out `deleted != null` rows so
  `registry/movements.json` — and therefore `packages/core` — never sees a
  soft-deleted movement. Same for any goals / vocab dump.
- **Verify:** soft-delete a movement, run `make movements:dump`, confirm only
  that movement is removed from `registry/movements.json`; `make test`
  unchanged; `make aliases` baseline (`curated — 972 records, 0 contended`)
  holds — recompute if the deleted movement changes the count, and record the
  new baseline.
- **Scope:** `scripts/`. No core, no app.

### D5 — UI: the missing delete button (movements) + confirm copy

- Add an **admin-only Delete** button to the movement editor
  (`apps/shared/movement-editor.js`, wired in `apps/builder/builder.js`) calling
  the D2 soft-delete, with a `confirm()` like the set / goal / workout ones. A
  soft-deleted movement drops from the palette via the D2 filter.
- Audit the three existing delete buttons — `deleteMine`
  (`builder.js:~3417`, copy: *"This cannot be undone."*), the set card `✕`
  (`:~2381`), the goals `✕` (`:~2834`) — they already `confirm()` and now
  soft-delete via D2; update any "cannot be undone" wording since a trash view
  is now possible.
- **Verify** each of the four surfaces by driving `make serve` signed in as the
  mock admin.
- **Scope:** `apps/shared/movement-editor.js`, `apps/builder/builder.js`,
  `apps/builder/builder.css`. No core.

### D6 — deploy

- `make deploy:db` (the D1 migration onto the VPS), then `make deploy` for the
  served app JS. Verify the four live collections read back the `deleted`
  column, a soft-delete from the prod UI leaves the list, and the served
  `apps/shared/*.js` is byte-identical to `origin/main`.
- **Scope:** deploy only.

### Sequencing

```
P1 ─> P2 ─> P3            (P3 gated on P1; the palette normalizer must exist first)
D0 ─> D1 ─> (D2 + D3) ─> D4 ─> D5 ─> D6
```

P-series first (Chris's order), then D-series. `D2`+`D3` land together so the
change is drivable; `D4` before `D5` so a dump-affecting change is proven before
the UI leans on it; `D6` last. Each item is its own session and spawns the next
when it lands, per [../../CLAUDE.md](../../CLAUDE.md).

---

## Loose bullets

- **A full laterality curation sweep — Chris's manual step, not a coding task.**
  *Confirmed 2026-09-02: "that's a manual step that I need to do."* Run through
  the audit CSV (`make curation:sheet` → review in a spreadsheet →
  `make curation:apply CSV=…`), per
  [../topics/running-it.md](../topics/running-it.md). Kept here so it is not
  re-picked as dev work. `around-worlds` is
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

- **Near-duplicate movement records: `barbell-row` vs `bent-over-barbell-row` /
  `bent-over-row-barbell`** (surfaced 2026-09-05 during the palette discussion).
  The curated `barbell-row` (aliases `bent-over row`, full muscle data) is the
  standard "bent over row"; the two `free-exercise-db` records
  `bent-over-barbell-row` (thin — `mid-back` primary only) and
  `bent-over-row-barbell` (id + title only) look like duplicates of it. Under
  the current pipeline the fix is `sameAs: ["bent-over-barbell-row",
  "bent-over-row-barbell"]` on `barbell-row` + rebuild + dedupe. Under the
  **DB-as-single-source-of-truth** direction Chris named (external-catalogue
  merge retired, `sameAs` and the split directive retire with it, dedup becomes
  an ordinary DB edit + an id-redirect / merge-log), it is just "merge the rows,
  leave a redirect". Needs Chris to pick the model before this is a task — it is
  a curation decision, not dev work, and it is *not* blocking the P-series
  (which resolves the search-side symptom without touching the records).

- **Post-redesign rethinks** — the board's **Edit** button round-tripping into
  the builder is now **scheduled as N3** in **## Next builder-UX work** above
  (Chris, 2026-09-02: "that's needed as well"). *Everything else in that thread —
  `@id` ↔ record-id correlation, the account namespace, `users.handle`,
  `workouts.wdlId`, forcing the `@id` namespace on save, an "open on the board"
  action — shipped in **The workout library (L0–L7)** above; the handle-rename
  debt is in [../topics/known-debts.md](../topics/known-debts.md).* Background in
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout".

