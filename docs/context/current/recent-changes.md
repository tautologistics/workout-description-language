# Recent Material Changes

## Changes

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
