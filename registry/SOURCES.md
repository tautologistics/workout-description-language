# Where the data comes from

Machine-readable provenance lives in [`SOURCES.json`](SOURCES.json); this explains the decisions
behind it. Run `node scripts/refresh-sources.ts` to check upstreams for changes.

## The licence question decides the architecture

Exercise catalogues are plentiful. What separates them is not size but what they let you do:

| Source | Records | Licence | Merge into a permissive registry? |
|---|---:|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 873 | Unlicense | **Yes** — public domain, no obligations |
| [Garmin Connect catalogue](https://connect.garmin.com/web-api/web-data/exercises/Exercises.json) | 1510 | none stated | Interop enums only; see below |
| [wger](https://wger.de/api/v2/exerciseinfo/) | 863 | CC-BY-SA 4.0 | Merged into the canonical corpus; keep out of a permissive core |
| [Everkinetic](https://github.com/everkinetic/data) | 289 | CC-BY-SA 4.0 | Merged into the canonical corpus; keep out of a permissive core |
| [ExerciseDB](https://github.com/ExerciseDB/exercisedb-api) | 11000 | AGPL (code); data unclear | Not until the data licence is stated |
| [MuscleWiki](https://api.musclewiki.com/) | 1900 | commercial | No |
| EMG literature | sparse | per-paper | Cite, never bulk-import |

**Share-alike is contagious.** Merging wger or Everkinetic into `movements.json` would place that
file — and arguably anything built from it — under CC-BY-SA 4.0. That is a decision about what this
project can be, not a data-quality question, and it should be made deliberately rather than
discovered later.

## So: layers, not one merged file

- **Core** (`movements.json`) stays public domain and hand-curated. Only Unlicense material and our
  own work goes in. This is what a permissive consumer gets.
- **Interop** (`garmin-exercises.json`, `garmin-benchmarks.json`) holds vendor enum values. These
  are facts about an interface — the exact strings Connect accepts — and are useless outside that
  context. Kept separate so nobody mistakes them for a general catalogue.
- **Enrichment** (not built) would be optional overlays keyed by movement id: wger under CC-BY-SA,
  EMG activation with citations, anything else with its own terms. Joined at load time by whoever
  wants them, carrying their own licences.

The join key is the movement id, and `fold()` is what makes joining across vocabularies work at all.

## On synthesising one canonical corpus

Tempting, and mostly a mistake as a single artefact. Merging everything produces a file whose licence
is the union of the strictest terms in it, whose provenance is untraceable per-field, and which
cannot be refreshed when one upstream changes. The layered form gives the same query results without
any of that.

The one genuinely different source is **EMG literature**: measured `%MVIC` activation rather than an
editor's judgement about which muscles an exercise works. Every catalogue above is the latter. No
consolidated open dataset exists — it is per-study, inconsistent in protocol and normalisation, and
covers a few hundred exercises at best. Worth citing for specific movements where the analysis
feature makes a strong claim; not worth pretending it can be imported in bulk.

## Garmin's data specifically

Garmin publishes no licence for the exercise catalogue or the benchmarks list. Both are kept because
interoperating with Connect is impossible without the exact enum values, and those are facts about
an interface rather than creative work. That reasoning is not a licence grant, and `SOURCES.json`
records the position as unresolved rather than settled.

Both endpoints return 403 without a Connect session, so refreshing means opening the URL in a
logged-in browser and saving the response over the copy in `docs/references/`.

## Is there a published spec?

Two different answers, and the distinction matters.

**FIT: yes, and it is fully public.** Garmin publishes the [FIT SDK](https://developer.garmin.com/fit/)
openly, and [`garmin/fit-sdk-tools`](https://github.com/garmin/fit-sdk-tools) carries `Profile.xlsx`
— every message and every type, updated with each release. It is the authority. All 22 enum values
our FIT exporter writes were checked against it and every one matched; the mistake we made earlier
(claiming FIT had no rep-count duration) would have been caught in a minute by reading it.

**Garmin Connect JSON: no.** There is an official [Training API](https://developer.garmin.com/gc-developer-program/training-api/),
but it is partner-gated — you apply, Garmin approves, and the specification is not public. What
Connect's own web app posts to `/workout-service/workout` is undocumented, and **no JSON Schema for
it exists anywhere**, official or community. The nearest things are prose
([n1t3k/garmin-strength-api](https://github.com/n1t3k/garmin-strength-api)) and the payload shapes
inside client libraries. Everything we know about that format came from reading those, then testing
against a live account — which is why an import that failed with `Invalid category` taught us more
than any amount of further reading would have.

## The merged corpora

Two canonical files, rebuilt by `scripts/build-canonical.ts`.

**The row counts below, and the `mergedCorpora` block in `SOURCES.json`, are written by
`scripts/describe-corpora.mjs` as the last step of that rebuild. Do not hand-edit them.** They were
hand-maintained until 2026-08-22, and by then both copies still carried the figures
`build-movements.mjs` prints *before* dedup — 3335 movements against a file holding 3120.

| File | Records | Contents |
|---|---:|---|
| `movements.canonical.json` | 3120 | Every movement we hold: 2983 with muscle data, 1503 with a Garmin mapping, 621 with a name in another language, 178 marked core |
| `workouts.canonical.json` | 202 | Every workout, with source text, parsed AST, and a derived summary |

**Every record names the sources that contributed to it.** That is what keeps the merge reversible:
the licence question is deferred, not dissolved, and a record can be traced or dropped later.

One honest caveat on the movement merge: only 351 of the 3120 appear in more than one source —
written as 233 of 3335 when the merge first ran, and restated here against the deduplicated file.
The catalogues use genuinely different naming, so `fold()` only unifies exact matches, and the true
overlap is certainly far higher than the merge detects — five sources each holding several hundred
to 1500 exercises will not have 89% disjoint vocabularies. Deduplicating properly would mean
matching on muscles and equipment rather than names alone. Until then the count is of *records*,
not of *distinct movements*.


## Provenance inside a merged record

Every record in `movements.canonical.json` carries three layers of it:

- **`sources`** — which catalogues contributed, at record level.
- **`origin`** — each source's own identifier and the name *it* used, so a merged record can be
  traced back to the exact upstream row. Garmin's is `CATEGORY/EXERCISE`, wger's is its uuid.
- **`muscleClaims`** — each source's muscle assignment, kept separately **wherever they disagree**.
  178 records have this. The unioned `muscles` field is convenient; `muscleClaims` is the truth
  about what each catalogue actually says.

The raw, unmerged source files are mirrored under `docs/references/`, so the merge is always
reproducible from originals rather than being the only surviving copy.

That last point was a real gap: Everkinetic had only ever existed in `/tmp`, and would have been
lost on reboot.

## Finding the same movement under different names

`scripts/find-duplicates.mjs` proposes matches and never merges. Word-level, not character-level:
character edit distance is the wrong tool, because `Barbell Bench Press` and `Dumbbell Bench Press`
are two characters apart and are different exercises, while `Band External Rotation` and
`External Rotation with Band` are far apart and are the same one. Comparing token *sets* is both
order-insensitive and blind to spelling noise, which is the actual shape of the problem.

Two halves to the score. **Similarity** is Jaccard overlap of the folded, stopword-stripped tokens.
**Veto** is a token that distinguishes rather than describes — implement, side, grip, stance,
tempo — present in one name and missing from the other, which rules the pair out outright.

The veto list is the whole game, and it is where this goes wrong if it goes wrong. An earlier draft
omitted `internal` and `external`, and duly proposed merging internal and external rotations.

Output on the 3335-record merge, before dedup collapsed it — where the numbers below end up is
under *Automated deduplication*:

| Confidence | Pairs | Meaning |
|---|---:|---|
| `high` | 86 | Identical word sets, sources agree on primary muscles |
| `conflicting` | 13 | Identical word sets, sources *disagree* on muscles — usually the catalogues differing, not the exercises |
| `possible` | 946 | Partial overlap; needs a human |

The `conflicting` tier is the interesting one. `Dumbbell Lunges` and `Lunges: Dumbbell` are plainly
the same movement, and the muscle disagreement is a fact about the sources rather than evidence
against the match — which is exactly why `muscleClaims` is preserved rather than silently unioned.


## Automated deduplication

`scripts/dedupe-movements.mjs` collapses the merge. It reports by default and rewrites only with
`--apply`, and every decision lands in `dedupe-audit.json` so a cluster can be inspected or unpicked.

Three ideas do the work:

**Lemmas.** Token sets are compared after depluralising and folding a small synonym table, so
`Tricep Extensions` and `Triceps Extension` become the same set rather than a near miss. Most of
what looked like partial overlap was this.

**Veto tokens.** A token that distinguishes rather than describes blocks the pair outright, however
similar the rest looks. `Band Internal Rotation` and `Band External Rotation` stay separate.

**A strict subset is a variant, not a duplicate.** If one token set contains the other and the extra
words are all qualifiers, the longer name is a *more specific* exercise — `45 Degree Cable External
Rotation` is not `Cable External Rotation`. These become `variantOf` links instead of merges, which
is where a plain similarity threshold does its worst damage. 1106 such links now exist, each
pointing at the closest parent rather than the broadest.

Merging is transitive via union-find, so three spellings of the same curl collapse to one record
rather than to two overlapping pairs.

Result: **3335 → 3148 records**, 164 clusters absorbing 187 duplicates. Cross-source records rose
from 233 to 338, which is the real measure — those are movements now known to exist in more than
one catalogue rather than hiding behind different spellings.

One ordering bug worth remembering: variants were originally computed *before* the collapse, so
half the links pointed at records about to be absorbed — `barbell-burpee` came out as a variant of
both `burpee` and `burpees`. They are computed after now.

A second pass later took it further. The tokenizer treats `pullups` as one token and `pull-up` as
two, so singular and plural spellings of the same movement had survived as separate records —
`pull-up` and `pullups` were *both* marked core, and muscle analysis read a different one depending
on how you spelt it. Comparing names with the word boundaries taken out found 66 such pairs, every
one inspected before applying: **3148 → 3120 records**. The two arrows above are what each run did;
counts elsewhere in this file that describe the corpus as it stands are against 3120.


## Families: the sources' own opinion

wger's editors group exercises into variation families — every squat variant, every bench press
variant. `scripts/link-families.mjs` attaches those to the canonical corpus, and they turn out to be
a better signal than anything derived from names.

A family is a **sibling** relation, which is a different thing from the `variantOf` parent links.
Those can only relate names where one contains the other, so they cannot know that an Arnold press
and a push press are both shoulder presses. Of 629 within-family pairs, our subset heuristic already
related only **120**; the other **509** are relationships no string comparison would ever find.

The more useful half is that it cuts the other way. Two records in the same family are
**deliberately distinct** — a human listed them separately — so family membership is a *veto* on
merging, not encouragement. `Deadlift` and `Rack Deadlift` were sitting in the candidate list and are
now blocked outright.

50 families cover 221 movements. All 221 wger members resolved onto our records with none left over,
which is a decent independent check on the fold and dedup work: a vocabulary we did not write mapped
cleanly onto ours.

Ordering matters in the pipeline. Families are linked *before* dedup so sibling pairs are vetoed,
then relinked *after* it because merging changes which ids survive.

Duplicate candidates are down from 1047 to **694**, all in the weakest tier, and none of them are
same-family pairs.


## Where this stops: a core, and a long tail left alone

Chasing duplicates through 3120 records is diminishing returns. The tail is machine variants, banded
rehab work and cable isolation nobody writes into a workout, and two of those staying separate costs
nothing. What matters is that the *common* movements each have exactly one canonical record.

`scripts/mark-core.mjs` scores every record on evidence of commonality rather than opinion:

| Signal | Points |
|---|---:|
| Referenced by a workout in our corpus | +3 |
| Hand-curated | +3 |
| A lift Garmin tracks a 1RM for | +2 |
| Each source beyond the first | +2 |
| Is the base of a variation family | +1 |
| Absorbed a duplicate during dedup | +1 |

Four or more is the core: **181 records**. Deadlift, Bench Press, Clean, Snatch, Thruster, Plank,
Kettlebell Swing all land at the top, which is the sanity check. The score stays on every record so
the line can be redrawn later.

Checking those 181 against each other found **one** genuine duplicate — `Dumbbell Bicep Curl` and
`Dumbbell Curl` — now merged by alias. Everything else that name similarity flagged is a real
distinction: `Hang Power Clean` is not `Power Clean`, close-grip bench is not wide-grip bench.

### Why name similarity stops here

The test that found those 48 "duplicates" was wrong, and instructively so. It asked whether two names
differed only by non-distinguishing words — but the *head noun* is the most distinguishing token of
any exercise name, and treating it as generic makes `Barbell Deadlift` and `Barbell Shrug` look
identical. In a vocabulary where nearly every name is `<qualifier> <qualifier> <movement>`, string
similarity cannot tell a qualifier from the thing being qualified without knowing which words name
movements — and at that point it is a taxonomy, not a string comparison.

So the core is clean, the tail is left as it is, and the useful structure that remains is the part
that does not depend on names at all: 1106 `variantOf` links and 50 source-attested families.
