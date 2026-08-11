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

Two canonical files, rebuilt by `scripts/build-canonical.ts`:

| File | Records | Contents |
|---|---:|---|
| `movements.canonical.json` | 3335 | Every movement we hold: 3161 with muscle data, 1510 with a Garmin mapping, 850 with names in other languages |
| `workouts.canonical.json` | 202 | Every workout, with source text, parsed AST, and a derived summary |

**Every record names the sources that contributed to it.** That is what keeps the merge reversible:
the licence question is deferred, not dissolved, and a record can be traced or dropped later.

One honest caveat on the movement merge: only 233 of the 3335 appear in more than one source. The
catalogues use genuinely different naming, so `fold()` only unifies exact matches, and the true
overlap is certainly far higher than the merge detects — five sources each holding several hundred
to 1500 exercises will not have 93% disjoint vocabularies. Deduplicating properly would mean
matching on muscles and equipment rather than names alone. Until then the count is of *records*,
not of *distinct movements*.
