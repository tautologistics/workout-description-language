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
npm test --prefix packages/core        # 104 passing, 8 pending

units            11/11   quantities, loads, targets, duration decomposition
lines             9/9    indentation tree, comments, brace continuations
structure        10/10   containers parse to what the workout means
prescriptions     6/6    relative loads, labels, dynamic rest, paired implements
laterality/teams  3/3    counting modes, side selectors, shared totals
scoring           6/6    per-round, aggregates, tiebreaks, attempts
corpus           40/40   parse, round-trip, and formatter idempotence
accepted input   13/13   documented variants canonicalize as specified
errors            6/6    plus 8 pending — gaps awaiting semantic validation
```

```bash
node packages/core/bin/wdl.ts fmt examples/corpus/04-fran.wdl
```

## Layout

| Path | What's there |
|---|---|
| [`spec/spec-0.1.md`](spec/spec-0.1.md) | The notation. §13 encodes all 40 corpus workouts; §14 records what that found. |
| [`examples/corpus/`](examples/corpus) | The 40 workouts as `.wdl` files — the parser's test suite. |
| [`examples/falsification-corpus.md`](examples/falsification-corpus.md) | The model test: what broke, and why. |
| [`packages/core/`](packages/core) | Reference implementation: two-phase parser, canonical formatter, `wdl` CLI. |
| [`docs/`](docs) | Vision and roadmap, prior art, movement registry design, adversarial review. |

## Reading order

1. [Product vision and roadmap](docs/product_vision_and_roadmap.md) — what this is for and the core model
2. [Spec 0.1](spec/spec-0.1.md) — the notation
3. [Falsification corpus](examples/falsification-corpus.md) — how the model was tested
4. [Prior art](docs/prior_art.md) — what already exists and why none of it covers this
5. [Movement registry design](docs/movement_registry_design.md) — movement identity and normalization
6. [Plan review](docs/plan_review.md) — open defects and strategic risks

## Next

Semantic validation, the movement registry, and the timeline compiler that the display runtime
and every exporter depend on. Then a tree-sitter grammar and a language-neutral conformance
suite so other languages get correctness, not just a parser (roadmap §5.1).
