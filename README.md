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

Spec 0.1 draft with a working reference parser, formatter, and CLI. The shipped
core — `packages/core/src/` — installs nothing and runs on Node 22+ via native
TypeScript type stripping; build and generation toolchains elsewhere in the repo
are free to have their own dependencies.

The one library it runs is `ohm-js`, which executes
[spec/grammar-0.1.ohm](spec/grammar-0.1.ohm) — the normative grammar, which is
the file the parser runs rather than a description of it. It is MIT, has no
dependencies of its own, ships as a single file, and that file is **vendored**
into `packages/core/src/grammar/vendor/` and imported by relative path: the core
ships into a browser as plain modules, and a browser resolves relative paths and
nothing else.

```bash
make            # list every routine task (thin wrappers over scripts/ and the CLI)
make test       # 2072 passing: units, parsing, round-trips, the 190-workout corpus,
                # timeline, validation, goals, results, and interop with real
                # Zwift / ERG / FIT / Garmin Connect / Sheiko files
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
| [`examples/corpus/`](examples/corpus) | 190 workouts as `.wdl` files, each one parsed, round-tripped and snapshotted by the tests. |
| [`examples/falsification-corpus.md`](examples/falsification-corpus.md) | The model test: what broke, and why. |
| [`packages/core/`](packages/core) | Reference implementation: parser, formatter, timeline compiler, validator, goal checker, generator, exporters, `wdl` CLI. |
| [`apps/`](apps) | The builder (write a workout, with live goal feedback) and the board (run it, and record the result). |
| [`registry/`](registry) | Movement registry: 972 hand-curated entries in `movements.json`, merged with other sources into about 3,100 in `movements.canonical.json`. |
| [`docs/`](docs) | Vision and roadmap, prior art, movement registry design, adversarial review. [`docs/context/`](docs/context/INDEX.md) is the project's working memory. |
| [`.agents/skills/`](.agents/skills) | Agent skills, such as `wdl-author`, which writes workouts in WDL. See [docs/agent-skills.md](docs/agent-skills.md). |

## Reading order

1. [Product vision and roadmap](docs/product_vision_and_roadmap.md) — what this is for and the core model
2. [Spec 0.1](spec/spec-0.1.md) — the notation
3. [Falsification corpus](examples/falsification-corpus.md) — how the model was tested
4. [Prior art](docs/prior_art.md) — what already exists and why none of it covers this
5. [Movement registry design](docs/movement_registry_design.md) — movement identity and normalization
6. [Plan review](docs/plan_review.md) — open defects and strategic risks

## Next

The language and its tools are in use. The builder and the board run on a
small hosted instance for the author and a few training partners. From here,
the work is driven by real workouts: when one can't be written tersely and
clearly, it's written up in [`docs/syntax-gaps/`](docs/syntax-gaps/README.md)
and queued. The live queue is
[`docs/context/tasks/current.md`](docs/context/tasks/current.md).

*Corrected 2026-11-21.* This section used to name a tree-sitter grammar and a
language-neutral conformance suite as the next step. The formal grammar was
built instead as [`spec/grammar-0.1.ohm`](spec/grammar-0.1.ohm), the file the
parser actually runs. A conformance suite for third-party implementations was
declined, because the format isn't seeking adoption (see
[deliberately-not-done](docs/context/topics/deliberately-not-done.md)).
