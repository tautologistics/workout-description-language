# Where the data comes from

Machine-readable provenance lives in [`SOURCES.json`](SOURCES.json); this explains the decisions
behind it. Run `node scripts/refresh-sources.ts` to check upstreams for changes.

## The licence question decides the architecture

Exercise catalogues are plentiful. What separates them is not size but what they let you do:

| Source | Records | Licence | Merge into a permissive registry? |
|---|---:|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 873 | Unlicense | **Yes** — public domain, no obligations |
| [Garmin Connect catalogue](https://connect.garmin.com/web-api/web-data/exercises/Exercises.json) | 1510 | none stated | Interop enums only; see below |
| [wger](https://wger.de/api/v2/exerciseinfo/) | 863 | CC-BY-SA 4.0 | No — would make the registry share-alike |
| [Everkinetic](https://github.com/everkinetic/data) | 290 | CC-BY-SA 4.0 | No — same |
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
