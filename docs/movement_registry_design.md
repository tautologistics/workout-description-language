# Movement Registry — Identity, Naming, and Normalization

How a movement is uniquely identified in WDL, how the many ways people write it fold down to one identity, and how the registry that holds them is governed. Referenced from [product_vision_and_roadmap.md](product_vision_and_roadmap.md) §3.3, and resolves the open question in [workout_description_spec_development_plan.md](workout_description_spec_development_plan.md) §8.

---

## 1. The core rule

**One movement has one identity, expressible in two equivalent surface forms.**

- **Slug form** — the canonical key: `dumbbell-thruster`, `chest-to-bar-pull-up`, `ghd-sit-up`
- **Title form** — the canonical human rendering: `Dumbbell Thruster`, `Chest-to-Bar Pull-Up`, `GHD Sit-Up`

These are not two identifiers. They are two renderings of one identifier, exactly like a blog post's title and its URL slug. The relationship is enforced by an invariant:

> **For every registry entry, `fold(id) == fold(title)`.**

where `fold` is the matching function defined in §3. Both forms are *stored data*. Neither is derived from the other: you cannot mechanically recover `Chest-to-Bar Pull-Up` from a slug, because capitalization and hyphenation are editorial — and you cannot recover the slug from `fold(title)` either, because fold deliberately destroys the readability an id needs (§3). What the invariant guarantees is that the two forms *denote the same thing*, and CI can check it.

The id is chosen by whoever writes the entry and should read well: `chest-to-bar-pull-up`, `clean-and-jerk`, `ghd-sit-up`. Fold is only ever used for matching.

Authors may write either form, or any registered alias, or any spelling that folds to the same key. All of it parses to the same movement. Canonical formatting (roadmap §3.1) emits **title form**, because that's what a human reads on a whiteboard.

---

## 2. What a registry entry is

**An entry is flat and self-contained. There is no inheritance.**

An earlier draft gave entries a `base` field (`dumbbell-thruster` → `base: thruster`) plus a mechanism for generating entries from a base × modifier grid. That's inheritance wearing a different hat, and it should go. Hierarchy in this vocabulary invites disputes nobody can settle — is a squat clean a *clean* or a *squat*? is a devil's press a *burpee* or a *snatch*? — and it creates silent property drift, where editing a base changes the meaning of entries nobody looked at. The benefits it was buying (substitution suggestions, analysis) are available from flat, optional cross-references at a fraction of the cost.

**The distinctness rule:** if two things need separate PR tracking, they are separate entries. `dumbbell-thruster` and `barbell-thruster` are different movements, written out independently. Since almost every field is optional (below), writing one out is a few lines — cheaper than a generation mechanism and its failure modes.

### 2.1 Only two fields are required

```yaml
dumbbell-thruster:
  title: Dumbbell Thruster
```

That's a complete, valid entry. The id (the key) and the human-readable title are the whole contract, and they're the two things §1's invariant relates.

**Everything else is optional, and features degrade in proportion to what's present.** No muscle data means no balance analysis for workouts using it. No `external` mapping means exporters warn instead of mapping. No laterality means the parser can't default a counting mode, so it asks or requires the prescription to be explicit (§6). This is the same graceful degradation that governs unregistered movements (§7) — an unregistered movement is simply the limiting case of a minimal entry, and nothing special has to be built for it.

This matters because the classification fields are for *one* feature. Patterns and muscle groups exist to support building balanced sessions that avoid hitting the same muscle group twice in a row. They are genuinely useful and genuinely not load-bearing: a movement is no less real for lacking them, and requiring them would make the registry a research project instead of a lookup table.

### 2.2 The full optional schema

Grouped by what each field is *for*. Only the first group is required.

```yaml
dumbbell-thruster:
  # identity — required
  title: Dumbbell Thruster

  # naming
  aliases: [db-thruster]

  # classification — serves balance analysis and substitution only
  pattern: [squat, vertical-push]
  muscles:
    primary: [quads, glutes, shoulders]
    secondary: [core, triceps]
  related: [barbell-thruster]        # flat cross-reference, not a parent

  # validation hints — advisory; never needed to parse a file
  implements: 2                      # how many objects are held
  load: per-implement                # `@ 2x50lb` = 50lb each, 100lb moved
  laterality: [both]                 # counting modes admitted (§6)

  # interop
  external:
    fit_category: SQUAT
```

### 2.3 Quantity is not a movement property

The first draft of this schema listed `quantities: [reps]` on the dumbbell thruster. That's wrong twice over.

It conflated two different kinds of fact — how many reps determines *when the step ends*, while how heavy each dumbbell is is *a target attached to the step*. And more fundamentally, **how a movement is measured is contextual.** `10 DB Thruster @ 20lb` and `2min DB Thruster @ 20lb` are the same movement, differently prescribed; Fight Gone Bad prescribes wall balls and push presses by the minute while Fran prescribes thrusters by the rep. Anything can be done for time. Anything discrete can be counted. A registry that whitelists completion conditions per movement will be wrong constantly and will reject legitimate workouts.

**Quantity belongs to the prescription. The registry has no opinion about it.**

The one narrow exception worth recording is *equipment-derived readouts*, because nothing else can catch them: `15cal Thruster` is nonsense not because thrusters have a completion whitelist but because a thruster has no calorie meter.

```yaml
row:  { title: Row,  measures: [distance, calories] }
run:  { title: Run,  measures: [distance] }
bike: { title: Bike, measures: [distance, calories] }
```

Advisory, like everything else here. Absent it, no validation happens and the file still parses.

### 2.4 The governing principle

Three rounds of over-specification in this document all had the same shape: facts belonging to the *prescription* kept migrating into the *movement*. Stating the rule so it stops recurring:

> **The registry answers what a movement is called and what it is. It never answers how a movement may be prescribed.**

Load arity (`implements`, `load`) sits closest to the boundary and earns its place only because it is advisory: the notation already carries the arity explicitly (`2x24kg` versus `24kg`), so parsing never depends on the registry, and the field exists purely so a validator can ask "did you mean `2x24kg`?" and a volume calculation can be right. Same for `laterality` and `measures`. Nothing in the validation-hints group is ever required to read a file.

---

## 3. Normalization: how `DB Thrusters` and `db-thrusters` meet

Two distinct layers. Keep them separate — conflating them is how naming systems become unpredictable.

### Layer 1 — `fold()`: mechanical, deterministic, data-free

Pure string transformation. No registry lookup, no ambiguity, same result forever. It is aggressive on purpose: the output is an internal matching key that is never displayed, so it costs nothing to destroy readability in exchange for collapsing more spellings.

1. Unicode NFKD normalize; strip diacritics
2. Lowercase
3. **Split into tokens** on any run of non-alphanumeric characters — whitespace, `-`, `_`, `.`, `'`, `&`, `/`, `(`, `)`, `,`
4. **Drop stopword tokens**: `and`, `or`, `the`, `a`, `of`, `to`, `with`
5. **Join the remaining tokens with nothing**

The result is a single lowercase alphanumeric string. Retain the token list alongside it — the token-set fallback in layer 2 needs it.

| Input | tokens | fold() |
|---|---|---|
| `DB Thrusters` | db · thrusters | `dbthrusters` |
| `db-thrusters` | db · thrusters | `dbthrusters` |
| `D.B. Thrusters` | d · b · thrusters | `dbthrusters` |
| `Dumbbell Thruster` | dumbbell · thruster | `dumbbellthruster` |
| `Clean & Jerk` | clean · jerk | `cleanjerk` |
| `Clean and Jerk` | clean · ~~and~~ · jerk | `cleanjerk` |
| `Chest-to-Bar Pull-Ups` | chest · ~~to~~ · bar · pull · ups | `chestbarpullups` |
| `Pull-Ups` / `Pull Ups` / `pullups` | *all* | `pullups` |
| `Farmer's Carry` | farmer · s · carry | `farmerscarry` |
| `Farmers Carry` | farmers · carry | `farmerscarry` |

**Joining with nothing solves the concatenation problem.** An earlier draft of this document declared `pullup` versus `pull-up` algorithmically unsolvable and consigned every concatenated spelling to a hand-written alias. Discarding separators entirely dissolves it: `Pull-Ups`, `Pull Ups`, and `pullups` produce one key without a dictionary, without a segmenter, and without anything that can confidently mangle a word. `Farmer's Carry` and `Farmers Carry` converge for the same reason.

**Dropping stopwords** makes `Clean & Jerk` and `Clean and Jerk` converge, which was the original motivation. The risk is two movements differing *only* by a stopword; the vocabulary appears to contain no such pair, and if one ever appears the ambiguity rule below catches it rather than silently merging them.

What layer 1 still does **not** do: it does not know that `db` means `dumbbell`, and it does not depluralize. Those are the next layer.

### Layer 2 — registry resolution

Resolution order, first hit wins:

1. `fold(input)` matches a canonical ID
2. `fold(input)` matches an alias → canonical ID
3. `depluralize(fold(input))`, then retry 1 and 2
4. Expand abbreviation tokens, then retry 1–3
5. **Token-set match** — compare the retained token list as an unordered multiset against every entry's token list. Accept only if exactly one entry matches; otherwise report ambiguity. This catches word-order variation (`Thruster, Dumbbell` → [thruster, dumbbell] → matches `Dumbbell Thruster`) without needing an alias for every permutation.
6. No match → **unregistered movement**

Step 5 is deliberately last and deliberately requires uniqueness, because it is the only step that isn't order-preserving. Exercise names are overwhelmingly modifier-then-base (`hang power clean`, `overhead squat`), and reordering them doesn't produce a different real movement — but the uniqueness requirement means that if that assumption ever fails, the parser errors instead of guessing.

**Why depluralization comes after exact matching, not inside `fold()`.** Algorithmic depluralization is unsafe in this vocabulary — naive rules turn `press` into `pres` and `dips` is a real word ending in `s`. Trying exact matches first means `press`, `push-press`, and any other legitimately-`s`-ending name resolve before the plural rules ever run. Depluralization becomes a safe fallback rather than a source of corruption. Explicit plural aliases in the registry always win over the algorithm.

**Abbreviation expansion is registry data, not string logic.** A small closed token table handles implements and common gym shorthand, because these compose across the whole vocabulary:

```yaml
token_expansions:
  db: dumbbell
  kb: kettlebell
  bb: barbell
  sa: single-arm
  c2b: chest-to-bar
  t2b: toes-to-bar
  hspu: handstand-push-up
  ohs: overhead-squat
  ghd: ghd            # identity — GHD is the canonical token
```

Everything else — `Fran`-style names, regional variants, misspellings, concatenated forms like `pullups` that no segmentation rule will ever split correctly — goes in per-entry `aliases`. Explicit beats clever.

### Ambiguity is an error, not a guess

If an input matches more than one entry (possible once token expansion or token-set matching is in play), the parser must **report the ambiguity with the candidates** rather than pick one. Silent wrong resolution is worse than a parse error, because it corrupts a result record that may outlive the file.

`Erg` is the canonical example: it means the rower in most gyms, the SkiErg in some, and the BikeErg in others. It should be an ambiguity error listing all three, not a coin flip.

---

## 4. The variation classes

The design is only as good as the set of real-world variation it was built against. This is the inventory — every way the same movement gets written — and which layer is responsible for each. It doubles as the test corpus for `fold()`.

| # | Variation class | Examples | Handled by |
|---|---|---|---|
| 1 | Case | `pull-up`, `Pull-Up`, `PULL UP` | `fold()` |
| 2 | Separator choice | `Pull Up`, `Pull-Up`, `pull_up` | `fold()` |
| 3 | Punctuation | `D.B.`, `Farmer's Carry`, `Thruster (DB)` | `fold()` |
| 4 | Plurals | `Thrusters`, `Burpees`, `Dips` | depluralize fallback + explicit aliases |
| 5 | Abbreviations | `DB`, `KB`, `HSPU`, `T2B`, `OHS`, `DU`, `SDHP`, `S2O` | token expansion table + aliases |
| 6 | Word order | `Thruster, Dumbbell`; `Snatch (Dumbbell)` | token-set match (step 5) |
| 7 | Synonyms and regional | `Press-Up`/`Push-Up`, `Skipping`/`Jump Rope`, `Air Squat`/`Bodyweight Squat` | aliases |
| 8 | Equipment and brand names | `Ski`/`SkiErg`, `Assault Bike`/`Echo Bike`/`Air Bike`, `Row`/`Rower`/`C2` | aliases, plus ambiguity errors |
| 9 | Non-English | German/French names — Hyrox is Europe-heavy | locale alias sets |
| 10 | Concatenation | `pullup`, `handstandpushup`, `wallball` | `fold()` — separators are discarded |
| 11 | **Misspellings** | `Burpie`, `Kettlebel`, `Thurster` | **not resolved — see below** |

Classes 1–3 and 10 are pure string work. Classes 4–9 are registry data. Only misspellings remain genuinely unhandled:

**Concatenation is solved by fold** joining tokens with nothing (§3), so `pullup`, `pull-up`, and `pull ups` produce one key. An earlier draft called this unsolvable and routed every concatenated spelling to a hand-written alias; discarding separators removes the problem instead of cataloguing it.

**Misspellings should never auto-resolve.** Edit-distance matching belongs in the *error message* ("unknown movement `Thurster` — did you mean `Thruster`?") and in builder autocomplete, never in the parser's resolution path. A silently corrected typo writes a wrong movement ID into a result record that outlives the correction.

## 5. Where the movement name ends

`fold()` presumes someone already handed it a movement name, which quietly assumes the tokenizer knows where the name stops. Three boundary questions that string normalization cannot answer, and that need deciding at the grammar level:

- **Prescriptions embedded in names.** `24" Box Jump`, `20lb Wall Ball`, `50ft Handstand Walk`. The height, load, and distance are prescriptions, not identity — the parser must peel them off before folding, in whatever position they appear. But `Wall Ball` conventionally implies a target height, and `20in Box Jump` vs `24in Box Jump` are the same movement at different prescriptions, so peeling is right.
- **Modifiers that may or may not be identity.** `Alternating DB Snatch`, `Single-Arm KB Swing`, `Strict Pull-Up`, `Hang Power Clean`. Some of these are genuinely distinct movements (`strict` vs `kipping` pull-ups score differently); others are prescription-level qualifiers (`alternating` describes rep counting). There's no principled line — this has to be decided per modifier and recorded in the registry, with the registry declaring which modifiers are identity-forming.
- **Unilateral rep semantics.** Whether `10 Alternating DB Snatch` means 10 total or 10 per side is a *counting* question attached to the movement, not a naming one, but it surfaces here because the answer is conventional per movement.

These three are more consequential than any normalization detail, because they determine what a movement ID even denotes. They belong in the Phase 0 corpus work.

---

## 6. Laterality and rep counting

Resolves corpus finding **F10** and the open question left in §5.

When a movement involves two limbs, a bare rep count is genuinely ambiguous, and the ambiguity is not academic — it's the difference between 14 reps and 28.

### Three counting modes

| Mode | Meaning | `14 DB Curl` means | Examples |
|---|---|---|---|
| **both** | Both limbs work simultaneously; one rep is one count | 14 curls, both arms each time | Back squat, barbell curl, double-DB thruster, double-KB front squat |
| **split** | The count is divided across the sides | 7 per arm | DB snatch, walking lunges, pistols (as in Mary) |
| **per-side** | The number applies to *each* side; actual work is doubled | 14 per arm, 28 performed | Bulgarian split squat, single-arm row, "10 each leg" |

The case that prompted this section — dumbbell curls with a dumbbell in each hand, 14 prescribed, meaning 7 per hand — is **split**, and it's the mode most likely to be misread as either of the other two.

**Why `split` and not `alternating`.** Alternating names a specific execution pattern: strict left-right-left. But `10 Pistol` just as often means five on one leg and then five on the other. Both distribute the same count across two sides, so they cannot be distinct counting modes — alternation is a pattern layered on top, and it changes nothing about the score, the volume, or the display. `split` names the fact that matters; `alternating` is accepted on input, maps to `split`, and is preserved as a note.

This mirrors the team vocabulary exactly: `shared` for athletes, `split` for sides. Both say the count is divided among the participants however they choose, and neither prescribes the division.

### The movement alone does not determine the mode

This is the crux. A movement being unilateral tells you the limbs work separately; it does *not* tell you whether the prescribed number is a total or a per-side count. Both are common for the same movement, and coaches write both. So:

- The registry entry carries a **default** mode and the set of modes the movement admits.
- The prescription can **override** it.
- When a movement admits more than one mode, **canonical formatting always emits the mode explicitly**, even if the author left it implicit and the default applied. This is the "forgiving input, strict output" principle doing real work: the ambiguity gets resolved once, at parse time, and never again.

```yaml
dumbbell-curl:
  title: Dumbbell Curl
  laterality: [both, split, per-side]        # optional; first listed is the default
```

Like everything outside `title`, this is optional. **When an entry omits `laterality`, there is no default to apply**, so the prescription must state the mode or the parser asks (§12 of the spec, the never-guess rule). That's the correct degradation: a missing fact produces a question, never a silent assumption about how many reps someone did.

Accepted surface forms all map onto the three modes: `14 alternating DB Curl` and `14 alt DB Curl` → split; `14 DB Curl each arm`, `14 ea`, `14/side`, `14 per leg` → per-side; `14 DB Curl (both)` → both.

**Whether alternation must be strict is a note, not structure.** `alternating` and "14, switch as you like" both mean `split` for counting purposes. Strictness is a judging rule, consistent with the constraint discipline in roadmap §2.2 — accept the word, map it to the counting mode, preserve it for display, don't build machinery around it.

### Effective reps

Analysis and volume tracking need actual work performed, which is not the prescribed number:

```
both      → effective = prescribed
split     → effective = prescribed
per-side  → effective = prescribed × 2
```

`both` and `split` both equal the prescribed count because in both cases the number already represents every rep performed — they differ in what a single rep *is*, not how many there are. Only per-side multiplies. The display should show `14 each arm` rather than `28`, so effective reps is an analysis-layer value, not a display one.

### Implement count is a separate axis

Load notation must distinguish per-implement from total, and this is orthogonal to counting mode. Hyrox's farmers carry is `2×24kg` — two implements of 24kg each, 48kg carried. A double-DB thruster at `2×50lb` is 100lb moved. Writing `24kg` where `2×24kg` was meant halves every volume calculation downstream.

Recommend `2x24kg` as canonical for paired implements, with a bare load meaning a single implement or a barbell.

### Validator cases

- **Odd counts in split mode.** `21 DB Snatch (split)` gives 11 on one side and 10 on the other. Legal and common, and worth an informational note.
- **Per-side on a both-only movement.** `10 Back Squat each leg` is a mistake — reject.
- **Mode on a movement that admits only one.** Warn rather than silently accept.

---

## 7. Unregistered movements must always work

A movement missing from the registry is **not a parse error.** The format's value proposition dies if a coach can't write down a movement their gym invented.

- It parses. The workout is valid, formats canonically, runs on the display, and round-trips.
- The AST node carries `{ raw: "Sandbag Bear Hug Carry", id: null, registered: false }` — original text preserved verbatim.
- Only registry-dependent features degrade: no muscle analysis, no substitution suggestions, no external-format category mapping (exporters warn).
- The builder surfaces it: "3 movements aren't in the registry" with a one-click path to submit them.

That last point is how the registry actually grows. Unregistered movements are the contribution funnel, not a failure state.

**Private and gym-specific movements** get an explicit namespace so they never collide with registry IDs and never get retroactively broken by an upstream addition:

```text
x-hvcf:sandbag-bear-hug-carry
```

Namespaced entries can carry the same metadata locally, so a gym can get analysis on its own movements without waiting for anyone.

---

## 8. The clearinghouse

The registry is a **separate versioned dataset with its own release cadence**, not part of the grammar and not baked into the parser. The language spec defines `fold()`, the resolution order, and the entry schema; the registry supplies the data.

**Distribution.** A snapshot ships with `@wdl/core` so everything works offline. Updates are fetchable and versioned. A file may pin a version when reproducibility matters:

```text
@movements 2026.3
```

Pinning is optional and rarely needed — the stability rules below are designed so that not pinning is safe.

**Stability rules.** These are the whole reason a registry beats an ad-hoc list, because result records reference movement IDs for years:

- **IDs are permanent.** Once published, an ID is never deleted and never reused for a different movement.
- **Renames happen at the title layer only.** Changing `title` is a display change; the ID stays. If the slug genuinely must change, the old ID becomes a permanent alias of the new one.
- **Merges leave a tombstone.** When two entries turn out to be the same movement, the loser becomes an alias, never a deletion.
- **Splits require a new ID and a deprecation.** If one entry needs to become two, the original is deprecated with guidance rather than silently reinterpreted — reinterpretation would rewrite history in existing result records.
- **Additive by default.** New movements, aliases, and metadata fields are minor releases. Anything that changes what an existing ID means is major.

**Governance.** Start as a repo with PR review and a schema-validating CI check (ID format, `fold(title) == id`, no alias collisions across entries, required metadata present). That's sufficient for a long time and keeps the barrier low. Formal governance is a problem worth having later.

**Seeding — done.** [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (873 movements, public domain under the Unlicense) is imported for titles, muscles, and equipment; imported entries carry `source: free-exercise-db`. Hand-curated entries are authoritative wherever the two overlap, and an import is skipped rather than allowed to shadow one.

The import produced **zero fold collisions** against the curated set — 873 real exercise names, none of them colliding with a curated id, title, or alias, and none colliding with each other. That is a useful independent check on the fold rules, since the vocabulary was written by people who had never seen them.

Notably the import did *not* cover the CrossFit, Hyrox, and strongman vocabulary — Turkish get-ups, wall walks, sled pulls, ground-to-overhead, atlas stones — so the curated layer remains where the corpus is actually served. The registry now holds 952 entries. Cross-reference [wger](https://github.com/wger-project/wger) and Garmin's FIT `exercise_category`/`exercise_name` enums to populate `external` mappings while the data is fresh.

---

## 9. Open questions

- ~~Should `base` and `implement` be a general modifier list?~~ **Resolved in §2:** neither. Entries are flat and self-contained with no inheritance; optional `related:` cross-references cover substitution suggestions.
- Should there be a **curated seed set** of entries carrying full classification metadata (for the analysis feature to have something to work with on day one), separate from the long tail of title-only entries? Probably yes, but it's a curation policy, not a schema question.
- ~~Do unilateral movements need registry-level rep-counting semantics?~~ **Resolved in §6:** registry default plus prescription override, three modes, explicit in canonical output.
- How are movement *standards* (depth, range of motion, "chin over bar") represented — free-text notes on the entry, or structured? Matters for Rx-vs-scaled judgment but may be out of scope for 1.0.
- Should the registry carry scaling relationships directly (`scales_to: [ring-row, banded-pull-up]`), or is that a separate substitution dataset? A graph of "reasonable substitutions" is arguably its own thing with its own opinions.
- Multi-language titles: one entry with `titles: {en: ..., de: ...}`, or separate alias sets per locale? Hyrox in particular is European-heavy.
