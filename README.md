# Workout Definition Language (WDL)

A human-writable, machine-parseable text format for describing workouts — endurance, strength,
CrossFit-style metcons, and Hyrox-style station races — with scaling, scoring, and interop.

```wdl
# Fran

for time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-Up
```

## Status

Spec 0.1 draft with a working reference parser, formatter, and CLI. Zero dependencies — the
core runs on Node 22+ via native TypeScript type stripping.

```
npm test --prefix packages/core        # 477 passing

units            11/11   quantities, loads, targets, duration decomposition
fold/registry    17/17   name normalization, aliases, abbreviations, ambiguity
corpus round 2   15/15   structures found by growing the corpus to 114
lines             9/9    indentation tree, comments, brace continuations
structure        10/10   containers parse to what the workout means
prescriptions     6/6    relative loads, labels, dynamic rest, paired implements
laterality/teams  3/3    counting modes, side selectors, shared totals
scoring           6/6    per-round, aggregates, tiebreaks, attempts
corpus         114/114   parse, round-trip, and formatter idempotence
timeline       130/130   desugaring, pacing, duration, and what can't be a timeline
accepted input   13/13   documented variants canonicalize as specified
errors            6/6    parse-level failures report file and line
external truth   56/56   totals checked against facts outside this codebase
golden         190/190   interpretation of every corpus file, snapshotted
zwo interop     42/42    38 real Zwift files: XML duration sum == compiled duration
sheiko interop  17/17    12 Sheiko days: published number-of-lifts == parsed reps
erg interop      4/4     24 ERG/MRC courses: final timestamp == compiled duration
fit interop      6/6     4 Garmin FIT binaries: declared step counts == parsed
export          22/22    import -> export round trips, fidelity reported, FIT verified
validation     130/130   errors, warnings, and never-guess questions
```

```bash
node packages/core/bin/wdl.ts fmt      examples/corpus/04-fran.wdl
node packages/core/bin/wdl.ts timeline examples/corpus/18-fight-gone-bad.wdl
node packages/core/bin/wdl.ts check    examples/corpus/*.wdl
node packages/core/bin/wdl.ts export --to zwo examples/corpus/37-bike-intervals.wdl
```

## Layout

| Path | What's there |
|---|---|
| [`spec/spec-0.1.md`](spec/spec-0.1.md) | The notation. §13 encodes all 40 corpus workouts; §14 records what that found. |
| [`examples/corpus/`](examples/corpus) | 114 workouts as `.wdl` files — the conformance suite. |
| [`examples/falsification-corpus.md`](examples/falsification-corpus.md) | The model test: what broke, and why. |
| [`packages/core/`](packages/core) | Reference implementation: parser, formatter, timeline compiler, validator, `wdl` CLI. |
| [`registry/movements.json`](registry/movements.json) | Movement registry — 82 entries covering the corpus. |
| [`docs/`](docs) | Vision and roadmap, prior art, movement registry design, adversarial review. |

## Reading order

1. [Product vision and roadmap](docs/product_vision_and_roadmap.md) — what this is for and the core model
2. [Spec 0.1](spec/spec-0.1.md) — the notation
3. [Falsification corpus](examples/falsification-corpus.md) — how the model was tested
4. [Prior art](docs/prior_art.md) — what already exists and why none of it covers this
5. [Movement registry design](docs/movement_registry_design.md) — movement identity and normalization
6. [Plan review](docs/plan_review.md) — open defects and strategic risks

## Next

A tree-sitter grammar and a language-neutral conformance suite, so other languages get correctness
rather than just a parser (roadmap §5.1). Then the builder and the display runtime, both of which
consume the timeline that already exists.
