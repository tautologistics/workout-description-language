# Deliberately not done

Not holes — decisions. Each of these looks like an obvious improvement, and each
has a reason it is not one here. Check this before proposing one of them.

- **Conformance suite, third-party implementations.** These matter for a format
  seeking adoption. This one is not. Revisit only if someone outside actually
  wants to implement it.

  **Corrected 2026-08-14.** This entry originally read *"Tree-sitter grammar,
  conformance suite, third-party implementations"* and declined all three
  together on the adoption argument. That lumped in the wrong thing. A formally
  specified grammar is not an adoption feature — it is a maintainability
  requirement, and it holds regardless of whether anyone outside ever reads it.
  Declining it here was reasoning from "no outside implementers" to "no rigorous
  spec needed", which does not follow. The grammar is severed from this entry and
  is now queue item 0; conformance suites and third-party implementations stay
  declined for the reason given. See the clarification in [INDEX.md](../INDEX.md).
- **A field per property in the builder.** It would always lag the grammar, and
  the grammar is the interesting part.
- **A single-select control for the movement editor's *measured output*.**
  Proposed as queue item V3 from the 2026-09-02 design review — two checkboxes
  (`distance`, `calories`) become a 3-way segmented control, because a movement
  measures one or the other. **Withdrawn 2026-09-02 by Chris after it was built
  and the premise disproved.** A registry entry's `measures` is a **capability
  set** — the units the movement *can* be prescribed in — not a choice: `bike`,
  `row` and `skierg` correctly carry **both**, a rower being written `500m Row`
  or `20cal Row` depending on the workout. There is no meaningless state for a
  single-select to prevent, and narrowing would have silently dropped a value on
  save, switching off `calorieUnitHints()` for the only three entries it fires
  on. The checkbox pair stays.
  [DEC-023](settled-decisions.md#dec-023-measures-on-a-movement-is-a-capability-set-not-a-choice);
  the habit it cost is in [lessons-learned.md](lessons-learned.md) ("A capability
  set is not a choice"). *Revisit only as a **new field** — a per-movement
  "preferred" measure — never as a narrowing of this one.*

  **Still holds — and the test of it was met, not dodged (2026-08-28).** The
  builder now has a "what can this line take next" affordance on both step rows
  (from the registry) and block-header rows (from the grammar) — see
  [topics/builder-ux.md](builder-ux.md) under "## Outline". It is not the
  declined thing: the *set* of block modifiers is enumerated from
  `spec/grammar-0.1.ohm`'s `blockModifier_*` cases at runtime, not hand-listed.
  Only a label and a default string per case are hand-written, keyed by the
  grammar's own rule names, and `packages/core/test/block-affordances.test.ts`
  fails the moment that annotation drifts from the grammar. The grammar owns
  what exists; the annotation owns only what to call it.
- **Reps → load conversion.** Would need a 1RM and a physiological model.
  Inventing one would make every number look more authoritative than it is.
- **A file format for palette "sets".** A working preference, not something a
  workout depends on. `localStorage` until it earns more.

  **Corrected 2026-08-28.** Half of this still holds and half was given up. When
  hand-composed movement sets landed (a repertoire you *author from*, not just a
  frozen query — see [topics/builder-ux.md](builder-ux.md) under "## Movements"),
  Chris's call was: `localStorage['wdl.sets']` **stays the primary store**, for
  the reason above — a repertoire is a working preference, and nothing a workout
  reads depends on it. But it is worth carrying between machines and worth
  surviving a cleared browser, so the builder now also **exports** the whole
  repertoire to a plain `movement-sets.json` (`{format, version, sets}`, the
  same `{name: [ids]}` shape) and **imports** one back, merging by set name.
  That file is a carrier for the working copy, not a format a workout is ever
  written in and not a new grammar — so "no file format at all" was more than
  the reasoning required. The [goals.md](../goals.md) Non-Goal is narrowed to
  match: still no *authored artifact* for sets, but a backup/transfer file is
  fine.

  **Reopened 2026-09-02 (Chris).** The premise "a working preference, not
  something a workout depends on — `localStorage` until it earns more" no longer
  holds the whole feature: Chris now wants sets to be a **DB-backed, namespaced,
  scoped artifact** (global vs org/library vs personal), following the same
  collection + `<handle>:<slug>` + ingest pattern as workouts, with a reworked
  create/edit dialog. That is captured in
  [../tasks/deferred.md](../tasks/deferred.md) ("The movement-'sets' feature
  needs a model + UX rework"). `localStorage['wdl.sets']` stays the *only* store
  until that lands; this entry is kept for the trail of how the call moved.
- **Strength Level as a sixth registry source.** *Declined 2026-08-22 on terms.
  Measured 2026-08-22 anyway, at the author's direction, to size what was being
  given up; the measurement did not change the answer.*

  **The terms close it.** Its `/api/exercises` endpoint is undocumented and looks
  like an easy sixth catalogue. The site's
  [Terms and Conditions](https://strengthlevel.com/terms-and-conditions) (last
  updated 2025-01-23), under *Automated Access and API Usage*, forbid — absent
  written authorization — automated means "to access, query or otherwise collect
  information from the Service", access through "APIs that haven't been
  officially published", which is precisely what this endpoint is, and
  systematically downloading or copying any content. `robots.txt` says
  `Allow: /`; that is a crawl directive, not a licence, and it does not survive
  the contract. Strength Level Limited sells subscriptions against this data.
  Same disposition MuscleWiki already has in
  [registry/SOURCES.json](../../../registry/SOURCES.json), for the same reason.
  Revisit only on written authorization — support@strengthlevel.com.

  **What the sweep found**, against the registry as it stood on 2026-08-22
  (3120 movements, 2983 with muscle data, 178 core — since moved to 3113, 2976
  and 128, which changes none of the conclusions below). 36 requests, `a`–`z` and `0`–`9`, serial with
  a 2s delay; digits return nothing, so the alphabet is the sweep. The catalogue
  is **290 distinct exercises** — small, because `standard=true` is the set they
  publish strength standards for. `limit=256` is not a cap: the largest letter
  was `e` at 254, and raising the limit to 1000 still returned 254, so no paging
  is needed. Every field is 100% populated except `aliases` at 40.7%. The
  response carries `id` and `name` beyond the requested `exercise.fields`, and
  `name` is not in that list even though nothing works without it. `meta.count`
  is the returned count, not a total. With `standard=true` dropped, `query=e`
  alone hits a 1000-record limit, so the user-submitted set is thousands — not
  pulled, and not worth a later pass on these terms either.

  - **Muscle data: it closes none of the gap. Zero.** Of the 290, 197 resolve
    against the registry through `fold`/`depluralize`, and **every one of those
    197 already has muscle data**. The 137 movements that lack it are stretches,
    mobility and warmups — `Cat-Cow`, `Chin tuck`, `Ankle Roll`, `Blackroll` —
    and a strength-standards site has none of that. This was predicted before
    the sweep and the sweep returned exactly 0.
  - **`bodypart` could not have been recorded honestly anyway.** Nine values:
    Legs, Whole Body, Back, Shoulders, Chest, Core, Biceps, Triceps, Forearms.
    One coarse label per exercise, with no primary/secondary split, where every
    other source fills `muscleClaims[source] = { primary, secondary }` and the
    merge counts how many sources named each muscle as a mover versus an
    assister. *Legs* does not map onto one of the closed 19 — it maps onto six,
    and writing it in as a primary claim on all six would **manufacture
    agreement**, reading to the scorer as a sixth source confirming what wger
    said. Not the same kind of claim as the others'.
  - **Aliases: 55 real ones, and this was the only genuine find.** Of 196 alias
    strings, 55 name a movement we hold by a name we cannot currently resolve,
    with **no collisions among themselves**; 18 we already resolve; 71 hang off
    records we do not hold. That would take the registry from 278 aliases across
    219 movements to 333 across 240 — about +20%, with **24 of the 55 landing on
    core movements**.
  - **But the 55 are gym shorthand, not a dataset.** `Pulldown` → Lat Pull-down,
    `Bench` → Bench Press, `Fly` → Dumbbell Fly, `Seated Row` → Seated Cable Row,
    `Elbow Plank` → Plank, `Pushdown` → Triceps Pushdown. This is what a gym
    calls things, and any curator holding the list of our own movement titles can
    write it out unaided. The sweep did not supply knowledge we lacked; it
    supplied a **measurement of how thin our alias coverage is**, and where. That
    measurement is what queue item 8 acts on, and item 8 needs none of this data.
  - **The 93 unresolved records are mostly spellings, not movements.** 62 of the
    93 near-match an existing record on token overlap (`Hex Bar Deadlift` ≈ our
    `Trap-bar Deadlift`, `Sled Leg Press` ≈ `Leg Press`, `Close Grip Bench Press`
    ≈ `Close-grip Barbell Bench Press`). Of the 31 with no close match, most are
    named variants of things we hold — `Pause Deadlift`, `Half Squat`,
    `Zercher Deadlift`. The genuinely-absent residue is a handful of named
    powerlifting variants: Pendlay Row, Yates Row, Spoto Press, Viking Press,
    Z Press, Jefferson Deadlift, Safety Bar Squat. Worth adding by hand one day;
    not worth a source.
  - **It would have moved queue item 4 the wrong way.** `mark-core` scores
    `+2 per source beyond the first` against a threshold of 4, and **220 records
    sit at 2 or 3** — one source short. A sixth catalogue tips a large share in
    and could roughly double the core, purely by agreeing a movement exists.
    Item 4's complaint is that source agreement is a proxy for *commonly
    catalogued* rather than *worth putting in a workout*. Another catalogue
    sharpens the proxy item 4 already distrusts.
  - **The one field that would have fixed item 4 is the one we can never have.**
    `count` is lifts actually logged — Bench Press 48.7M, Squat 25.0M, Deadlift
    23.0M, down to Scissor Kicks at 1,810. That is a direct measure of what
    people really do, which is exactly the signal item 4 says source agreement is
    a poor proxy for. It is also aggregated user data and the most proprietary
    thing on the endpoint. Noting it so nobody re-derives the idea: the right
    signal exists, and it is not ours.

  **A side effect worth keeping.** Matching their aliases against ours threw 52
  *collisions* — a name they treat as an alias that we resolve to a different
  record. Some are real identity disagreements (they fold `Back Squat` into
  `Squat`; we hold both). But many are **near-duplicates inside our own
  registry**: `Curl` sits apart from `Barbell Curl`, `Leg Curl` from
  `Seated Leg Curl`, `Hyperextensions` from `Back Extension`, `Star Jump` from
  `Jumping Jacks`. Those pairs are facts about our own data, surfaced by the
  comparison rather than taken from it, and they are dedupe candidates for
  `scripts/find-duplicates.mjs`. (`Butterfly` / `Pec Deck` / `Machine chest
  fly` were on this list too and were merged by hand on 2026-08-29 — one
  machine under three names; see [known-debts.md](known-debts.md).)

  *Correction to the entry as first written, same day: it said the decision was
  taken "before any request was made", and for a few hours that was true. The
  sweep was then run deliberately, to price the decision rather than to reopen
  it. The estimates it replaced were right in both directions — muscle data was
  predicted near-zero and measured at zero, aliases were predicted the prize and
  measured at 55 — but they were estimates, and the numbers above are not.*


What is missing but *wanted* is in [tasks/deferred.md](../tasks/deferred.md).
