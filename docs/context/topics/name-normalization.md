# Movement-name normalization: read side, write side, and the split

*Investigation findings, 2026-09-05. Proposed as a new `topics/` file — not yet
wired into [../INDEX.md](../INDEX.md) pending discussion. Answers "when a name is
looked up or an alias is saved, what gets normalized, by which normalizer, and do
the two sides agree?"*

> **Correction 2026-09-05 (P1, `327b8c6`).** The two builder matchers described
> below as "plain `.toLowerCase()`" — `matches()` (palette, `builder.js:~2103`)
> and `movementSuggestions()` (row type-ahead, `builder.js:~233`) — **no longer
> use plain `.toLowerCase()`**. Both now fold query *and* candidate text through
> a shared `searchKey()` helper (`depluralize(foldTokens(s).tokens.map(t =>
> TOKEN_EXPANSIONS[t] ?? t).join(''))`, importing the three core primitives from
> `build/web/core/fold.js`). So separators fold, plurals fold, stopwords drop,
> and `bb`/`db`-style shorthand expands — on both sides — for palette search and
> the type-ahead. They still fold-then-`includes`/`startsWith` (partial-word
> matching preserved), so they remain non-authoritative discoverability helpers,
> not identity — the parsed line is still re-resolved by core `resolve()`. The
> `.toLowerCase()` rows in the normalizer table and the two "`matches`" /
> "`movementSuggestions`" rows in the Q1 table are stale from here on; the
> `TOKEN_EXPANSIONS` "the app-side matchers never reach it" claim in Q4 is
> likewise now false for these two. Everything else in this file still holds —
> core paths are unchanged, no `packages/core` edit. See
> [../tasks/current.md](../tasks/current.md) `## Palette search normalization`
> → `### P1`.

## TL;DR

- **Every *authoritative* movement lookup goes through core `fold()` / `resolve()`,
  and it folds both the query and the stored value.** There is no read/write
  normalization asymmetry on any path that decides identity.
- **Alias entries are stored as typed** (trimmed only — no fold, no lowercase) —
  in the editor, in the mock API, in the real `movements` collection, and in the
  committed `registry/movements.json`. This is *safe today* only because the read
  side re-folds the stored value at index time (`Registry.add` → `fold(alias)`).
- **Two matchers do *not* fold**: the builder's find-as-you-type palette search
  and its row suggestions. Neither determines identity — they autocomplete text
  the user is typing, and the resulting line is re-resolved by core `resolve()`
  afterwards. So this is a *discoverability* looseness, not a correctness bug.
- **`TOKEN_EXPANSIONS` (`db→dumbbell`, `bb→barbell`, `c2b→chesttobar`, …) is a
  `resolve()` feature, not a `fold()` feature.** It runs only in
  `Registry.resolve()` layer 2, in the abbreviation→full-word direction. Bare
  `fold()` comparisons and the app-side matchers never see it.
- There are **three different normalizers** in the tree — `fold()`, `flat()`,
  `foldKey()` — plus plain `.toLowerCase()`. They are never applied to the same
  lookup, so they don't collide *today*; the risk is future.

## The normalizers

| Name | Definition | file:line | NFKD? | stopwords? | separators | TOKEN_EXPANSIONS? | Used for |
|---|---|---|---|---|---|---|---|
| `fold()` / `foldTokens()` | NFKD, strip combining marks, lowercase, split on `[^a-z0-9]+`, drop `and/or/the/a/of/to/with`, join with `''` | [fold.ts:31](../../../packages/core/src/fold.ts) | yes | yes (dropped) | all removed | **no** (see below) | every core movement lookup |
| `depluralize()` | folded-key plural rules, fallback *after* exact match | [fold.ts:49](../../../packages/core/src/fold.ts) | — | — | — | — | `resolve()`, `check-aliases.mjs`, `volume.repsOf`, `sameMovement` |
| `TOKEN_EXPANSIONS` | `{db:dumbbell, kb:kettlebell, bb:barbell, sa:singlearm, c2b:chesttobar, t2b:toestobar, hspu:…, ohs:…, sdhp:…, du:…, bmu:…, rmu:…, wb:wallball, hpc:…, s2o:…, gtoh:…}` | [fold.ts:20](../../../packages/core/src/fold.ts) | — | — | — | is the table | **only** `Registry.resolve()` layer 2 |
| `flat()` | `trim().toLowerCase().replace(/[\s_-]+/g,' ')` — single spaces kept | [scripts/lib/muscles.mjs:13](../../../scripts/lib/muscles.mjs) | no | no | ws/`_`/`-` → one space | no | build-time muscle-vocab ingest only |
| `foldKey()` | `toLowerCase().replace(/[\s_-]+/g,'')` | [apps/shared/token-input.js:79](../../../apps/shared/token-input.js) | no | no | ws/`_`/`-` removed | no | editor "is this term already listed?" dedupe |
| `norm()` | `trim().toLowerCase()` | [apps/shared/token-input.js:62](../../../apps/shared/token-input.js) | no | no | kept | no | editor chip dedupe |
| plain `.toLowerCase()` | — | builder | no | no | kept | no | palette search, row suggestions |

`fold()` vs `flat()`: `fold("chest to bar")` → `"chesttobar"` (stopword `to`
dropped, all joined); `flat("chest to bar")` → `"chest to bar"` (stopword kept,
spaces kept). `foldKey("chest to bar")` → `"chesttobar"` but with no NFKD and no
stopword handling, so `foldKey("clean and jerk")` → `"cleanandjerk"` where
`fold()` gives `"cleanjerk"`.

## Q1 — On lookup: is the query normalized, then matched against the store?

`parse.ts` does **no** resolution. A step's movement is stored as raw trimmed
text (`step.movement = text.trim()`, [parse.ts:44](../../../packages/core/src/parse.ts));
`parse.ts` imports no registry and no `fold`). Every consumer resolves on demand.

| Lookup path | file:line | Normalizer | Folds query? | Folds stored value? | Match |
|---|---|---|---|---|---|
| `Registry.add` — index build | [fold.ts:194](../../../packages/core/src/fold.ts) | `fold()` | — | **yes** — `byName` keyed on `fold(id)`, `fold(title)`; `byAlias` on `fold(alias)` | maps on folded keys |
| `Registry.resolve` | [fold.ts:265](../../../packages/core/src/fold.ts) | `foldTokens` + `depluralize` + `TOKEN_EXPANSIONS` | **yes** (`foldTokens(raw)`) | yes (keys pre-folded) | exact folded key → depluralized → abbrev-expanded → depluralized+expanded → token-multiset |
| `Registry.lookup` — tier order | [fold.ts:256](../../../packages/core/src/fold.ts) | — (operates on a folded candidate) | — | — | `byAlias` tier **before** `byName` tier (DEC-014) |
| `validate.ts` name check | [validate.ts:232](../../../packages/core/src/validate.ts) | `reg.resolve(s.movement)` | yes | yes | core resolve |
| `muscles.ts` `musclesFor` | [muscles.ts:72](../../../packages/core/src/muscles.ts) | `canonicalRegistry().resolve()` | yes | yes | core resolve |
| `variants.ts` `movementLookup` / `sameMovement` | [variants.ts:146](../../../packages/core/src/variants.ts) | `resolve()`, else `depluralize(fold(a))===depluralize(fold(b))` | yes | yes | resolve + folded equality (no expansions in the fallback) |
| `result.ts` movement match | [result.ts:275](../../../packages/core/src/result.ts) | `movementLookup` / `sameMovement` | yes | yes | as variants |
| `volume.ts` `repsOf` | [volume.ts:131](../../../packages/core/src/volume.ts) | `depluralize(fold(...))` both sides | yes | yes | folded equality; **no** `TOKEN_EXPANSIONS` — both sides are workout text, so only bites if a caller passes an abbreviation the workout didn't use |
| `generate.ts` | [generate.ts:232](../../../packages/core/src/generate.ts) | `canonicalRegistry()` + `fold()` on equipment | yes | yes | core |
| adapters (`garmin-exercises`) | [adapters/garmin-exercises.ts:32](../../../packages/core/src/adapters/garmin-exercises.ts) | `fold()` + `defaultRegistry().resolve()` | yes | yes | core |
| **builder** — modifier `»` affordance / calorie hint (`movementEntry`) | [builder.js:284](../../../apps/builder/builder.js) | `defaultRegistry().resolve(title)` | yes | yes | core resolve |
| **builder** — muscle hover (`musclesFor`) | [builder.js:1003](../../../apps/builder/builder.js) | core `musclesFor` | yes | yes | core resolve |
| **builder** — row type-ahead (`movementSuggestions`) | [builder.js:233](../../../apps/builder/builder.js) | `.trim().toLowerCase()` | **no** | **no** — raw `m.title.toLowerCase()` | `startsWith` / reverse-`startsWith` / `includes`; UX only, non-authoritative |
| **builder** — palette search (`matches`) | [builder.js:2103](../../../apps/builder/builder.js) | `.toLowerCase()` | **no** | **no** — haystack = `title + pattern + equipment + primary muscles + aliases`, lowercased | each whitespace-split query token must be a substring of the haystack; UX only |
| **board** — cue attribution | [board.js:307](../../../apps/display/board.js), [board.js:920](../../../apps/display/board.js) | core `musclesFor` / `resolve` | yes | yes | core resolve |
| **pocketbase.js** `getMovementByMovementId` | [pocketbase.js:864](../../../apps/shared/pocketbase.js) | none | **no** — `filter=movementId="…"` exact | **no** | server-side string equality on the id slug (normalized by construction — `ID_RE` in the editor); never touches names/aliases |
| **pocketbase.js** `listMovements` | [pocketbase.js:857](../../../apps/shared/pocketbase.js) | none | n/a | n/a | returns all `scope="global"`; any name matching happens client-side afterwards |
| **editor** "term already present?" | [token-input.js:177](../../../apps/shared/token-input.js), [token-input.js:322](../../../apps/shared/token-input.js) | `norm` / `foldKey` | typed value | stored chip | dedupe only — not movement identity |
| muscle-vocab ingest | [scripts/lib/muscles.mjs:13](../../../scripts/lib/muscles.mjs) | `flat()` | yes (`flat(x)`) | yes (`flat(id)`, `flat(synonym)`) | build-time map on `flat` keys |

**Answer:** yes — on every path that decides *which movement a name is*, the
query is folded and matched against a folded store. The two exceptions
(`movementSuggestions`, `matches`) are find-as-you-type helpers that only place
text into a row; identity is always re-derived by core `resolve()` from that
text later. PocketBase server filters are exact-equality on the `movementId`
slug and never see a human name.

## Q2 — On save: is each alias entry normalized before it is persisted?

**No. Stored as typed (trimmed only).**

- **Editor** — `token-input.js` `add(raw)` ([token-input.js:174](../../../apps/shared/token-input.js)):
  `const t = String(raw).trim()`; dedupes against existing chips by `norm()`
  (trim + lowercase) but **commits the trimmed original string** (`known ?? t`).
  `aliases` has `vocab: () => []`, `allowCustom: true`
  ([movement-editor.js:84](../../../apps/shared/movement-editor.js)) — pure free
  text. `collect()` emits `tokens[k].value()` verbatim
  ([movement-editor.js:345](../../../apps/shared/movement-editor.js)); `buildBody`
  passes the array straight into the request body
  ([movement-editor.js:359](../../../apps/shared/movement-editor.js)).
- **Write path** — `createMovement` / `updateMovement`
  ([pocketbase.js:875](../../../apps/shared/pocketbase.js)) forward `body`
  untouched.
- **Mock API** — `scripts/mock-api.mjs` stores the JSON fields as received
  (`M_JSON` includes `aliases`), keyed by `movementId`. No transform.
- **Real PocketBase** — `aliases` is a plain JSON column; no server-side hook.
- **Registry build pipeline** — `build-movements.mjs` unions each source's
  `aliases` into a `Set` ([build-movements.mjs:194](../../../scripts/build-movements.mjs)),
  then on output ([build-movements.mjs:224](../../../scripts/build-movements.mjs))
  keeps `aliases.filter(a => fold(a) !== fold(r.title)).sort()` — `fold()` is used
  only for the self-equality filter; **the raw alias string is what's written**.
  `movements-to-db.mjs` sends `entry.aliases` shape-for-shape
  ([movements-to-db.mjs:168](../../../scripts/movements-to-db.mjs)).

So `registry/movements.json` holds `"bodyweight squat"`, `"bw squat"`,
`"ankle circle"` — human text. It happens to be lowercase because sources and
curators wrote it that way; nothing enforces or normalizes it.

## Q3 — Do the read and write sides agree?

**Yes, functionally — because the read side folds the stored value at index
time.** `Registry.add()` calls `fold(a)` on every alias when building `byAlias`
([fold.ts:203](../../../packages/core/src/fold.ts)), and `resolve()` folds the
query. A stored alias of `"DB Curl"`, `"db curl"`, `"db-curl"` or `"  Db  Curl "`
all index to `dbcurl`; any of those spellings as a query folds to `dbcurl` and
matches. **No asymmetry on any core path.** A saved alias silently never matching
would require it to fold to empty (only stopwords / punctuation) or to collide
with another record's key — the latter is exactly what `check-aliases.mjs` and
the pinned list in `fold.test.ts` exist to catch.

The asymmetry that *does* exist is **core vs. the non-core matchers**:

- The builder palette can find an alias literally present in its haystack
  (`c2b` as a substring of a stored `"c2b"` alias) but does **not** apply
  `TOKEN_EXPANSIONS`. Typing `chest to bar` in palette search reaches
  `chest-to-bar` only if that string is literally in the title/alias list; it is
  never reached via `c2b→chesttobar`. The movement still resolves correctly once
  the line is parsed — this is a search-box gap, not a parse gap.
- `flat()` / `foldKey()` diverge from `fold()` on stopwords and separators (table
  above). They are never applied to the same lookup as `fold()` today, so no live
  collision — but any change that routed movement/alias lookups through a
  `flat()`-style normalizer (or moved muscle-vocab lookup onto `fold()`) would
  change stopword and separator behavior.

## Q4 — The `TOKEN_EXPANSIONS` situation, for the "always normalize before match" proposal

- **Where it's defined:** [fold.ts:20](../../../packages/core/src/fold.ts) —
  `db/kb/bb/sa/c2b/t2b/hspu/ohs/sdhp/du/bmu/rmu/wb/hpc/s2o/gtoh` → full words.
  Direction is **abbreviation → full word**, so a fold key contains `barbell`,
  never `bb`.
- **Where it's applied:** **only** in `Registry.resolve()` layer 2
  ([fold.ts:271](../../../packages/core/src/fold.ts) and the token-multiset step
  at [fold.ts:284](../../../packages/core/src/fold.ts)). It is **not** in
  `foldTokens()` / `fold()`. So:
  - Paths that call `resolve()` get abbreviation collapsing: core `validate`,
    `muscles`, `variants` primary path, `result`, `generate`, adapters, the
    builder's `»`/calorie affordance, the board.
  - Paths that compare bare `fold()` keys do **not**: `Registry` index keys,
    `volume.repsOf`, `sameMovement`'s fallback, `build-movements.mjs` keying,
    `check-aliases.mjs`.
  - The app-side matchers (`matches`, `movementSuggestions`) never reach it —
    they don't import core's fold at all.
- **Direction is cosmetic for matching *iff* the same expansion runs on every
  path that matters.** Today it doesn't run on the bare-`fold()` paths — but
  those compare a stored registry value against another stored registry value (or
  a plural), where both sides are already full words, so the gap only shows when
  a **user-typed abbreviation reaches a bare-`fold()` comparator instead of
  `resolve()`**. In practice that's `volume.repsOf(v, "BB Snatch")` against a
  workout that wrote `"Barbell Snatch"`, and the palette search box.

## Nuances / risks to weigh before extending normalization (not recommending a path)

1. **Coverage, not direction, is the real question.** `bb` vs `barbell` in the
   key is immaterial if one normalizer runs on every lookup on both sides.
   Today core is internally consistent; the two builder matchers are
   *deliberately* looser (find-as-you-type wants partial-word substring, not
   identity). Pushing `fold()` into them changes palette behavior: `fold()`
   joins everything, so `"thrust"` → `"Thruster"` still needs `includes` on the
   folded form, not exact match; and `fold()` drops `to/with/of/and`, so
   `"clean and jerk"` and `"clean jerk"` would collapse (probably wanted).
2. **Short tokens are ambiguous.** `bb`→`barbell` is one reading; some gyms mean
   "bench" or "band". `bw` already appears as a free-text alias meaning
   "bodyweight" (`air-squat` → `"bw squat"`) and is *not* in `TOKEN_EXPANSIONS`.
   Every abbreviation added widens the collision surface and is a curatorial
   call — the same class of judgement as the 14 rejected alias candidates
   (DEC-005).
3. **DEC-005 / DEC-014 / DEC-015 constraints.**
   - *An alias must never be a movement in its own right* (DEC-005). A rule that
     *stripped* implement words (`barbell X` → `X`) would violate this whenever
     `X` is itself a record — `Back Squat` must not fold to `Squat`.
     `TOKEN_EXPANSIONS` only rewrites tokens (`bb`→`barbell`), it never drops
     one, so it's clear of this today; a stripping rule would not be.
   - *An explicit alias outranks a record's own id* (DEC-014), and the pinned
     test *"resolution never changes which movement a name resolves to"*
     (`fold.test.ts`) is the gate. Any change to `fold()` or `TOKEN_EXPANSIONS`
     reshapes the `byName` / `byAlias` keys and must run green against that test,
     `make aliases` (`scripts/check-aliases.mjs`), and the pinned
     "known alias collisions in the canonical corpus" list.
   - `assault bike` on `Bike` (DEC-015) is a *deliberate, correct* collision — a
     normalization pass that auto-resolved collisions could clobber it.
4. **`make test` is the gate** — 2064/2064, 0 pending at `88c9e1b`.
   `check-aliases.mjs` baseline: the canonical corpus has one contended-name
   family surviving as a real `AMBIGUOUS` (both records hold it only as an
   alias), plus the pinned `Bike` / `assault bike`. Any change needs a fresh
   `node scripts/check-aliases.mjs` diff.
5. **Where a change would land to be "always before any match."**
   `foldTokens()` is the single chokepoint for the fold half — every core path
   funnels through it. Moving `TOKEN_EXPANSIONS` down from `resolve()` into
   `foldTokens()` would make the index keys, `volume.ts`, `sameMovement`, and the
   build scripts abbreviation-aware in one move — but it also changes
   `check-aliases.mjs` and `build-movements.mjs` (they import `fold` directly),
   and it runs the `fold(id) === fold(title)` invariant
   ([fold.ts:226](../../../packages/core/src/fold.ts)) through expansions, so a
   curated `id`/`title` pair that only folds together *because* of an expansion
   would newly fail `validate()`. The two app-side matchers still need explicit
   updating — they don't import core's fold.
6. **PocketBase can't help.** Server-side `filter=` is raw equality / `~`
   contains; there is no folded column. Parity with core on the server would need
   either a stored folded-key column or client-side resolution over the full list
   (`listMovements` already pulls up to 1000 in one page).
