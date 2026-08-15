# @wdl/core

Reference implementation of the [Workout Definition Language](../../spec/spec-0.1.md).

One dependency — `ohm-js`, which executes the normative grammar in
[spec/grammar-0.1.ohm](../../spec/grammar-0.1.ohm). It is MIT, has no
dependencies of its own, and ships as a single file. Runs on Node 22+ using
native TypeScript type stripping.

```bash
node bin/wdl.ts fmt   file.wdl [-w]   # canonical formatting; -w rewrites in place
node bin/wdl.ts check file.wdl        # parse and report errors
node bin/wdl.ts timeline file.wdl     # compile to an execution outline
node bin/wdl.ts export --to zwo file.wdl          # also erg, mrc, connect; fit needs -o
npm test                              # every check, one summary
```

## Design

Parsing is **two-phase** (roadmap §5.1), which is what keeps a port to another language small:

| Phase | Module | Job |
|---|---|---|
| 1 | [`lines.ts`](src/lines.ts) | Indentation → line tree. Knows nothing about WDL — only indentation, comments, and brace continuations. ~100 lines, trivially portable. |
| 2 | [`parse.ts`](src/parse.ts) | Line tree → AST. Ordinary context-free work, because phase 1 removed the indentation sensitivity. |

[`ast.ts`](src/ast.ts) is the semantic contract; [`format.ts`](src/format.ts) emits canonical text.

[`timeline.ts`](src/timeline.ts) compiles the AST into how a workout is *executed*: rep schemes
expanded into explicit rounds, block-level targets pushed down onto steps, `+N each round`
resolved where the round count is bounded, and every step classified as **timed**,
**athlete-paced**, or **capped** — the axis a display runtime switches on. It also records what
an ordered timeline cannot represent, so exporters report a gap instead of inventing an order.
FIT workout steps, Zwift `.zwo` elements, and WorkoutKit interval blocks are all this shape.

## Tests

`npm test` runs everything through one runner ([`test/all.ts`](test/all.ts)). The suites are
layered by how much they actually prove:

| Layer | What it proves | What it does **not** |
|---|---|---|
| Round-trip, idempotence ([corpus](test/corpus.test.ts)) | parser and formatter agree with each other | that either is right — a workout misread the same way twice still passes |
| Validation ([validate](test/validate.test.ts)) | no rule of ours fires | anything about rules we did not write |
| Semantics ([semantics](test/semantics.test.ts)) | specific ASTs match what the workout means | only ~25 workouts are asserted by hand |
| **External truth** ([truth](test/truth.test.ts)) | **totals match facts that exist outside this codebase** | — |
| Golden ([golden](test/golden.test.ts)) | interpretation has not *changed* | that the recorded interpretation was right to begin with |

The external-truth layer is the one that answers "how do you know it's correct." Fran contains 45
thrusters, Linda 55 reps of each lift, Open 22.2 exactly 100 deadlifts, Fight Gone Bad 17 minutes,
a Hyrox race 8 km of running. Those are facts about the workouts, not about this parser, and any
misread rep scheme, off-by-one in a ladder, wrong `reversed` tier, or repeat applied at the wrong
level changes the number. [`volume.ts`](src/volume.ts) derives the totals; `truth.test.ts` checks
them against the outside world.

The golden snapshot ([`test/golden/interpretations.json`](test/golden/interpretations.json))
records a compact digest of how each of the 190 files is understood — structure, totals, pacing,
duration. Regenerate it deliberately with `node test/golden/generate.ts` and read the diff.

## Adapters

Import and export for Zwift `.zwo`, `.erg`/`.mrc`, and Garmin `.fit`, plus export to **Garmin
Connect workout JSON** — all consuming the compiled timeline.

Connect JSON is the better Garmin target. FIT is the *device* format and reaches a watch only by
USB copy into `GARMIN/NewFiles`; JSON is the *service* format, and a workout posted to an account
syncs over the air. It also carries two things FIT cannot: a real rep-based end condition, and an
external load, so a barbell weight survives. Every exporter returns warnings rather than degrading silently — reps and distance have
no representation in a power curve, a tally block has no order to write down, and an unbounded
repeat has no length, so each is reported.

## Not yet built

Apple WorkoutKit and openweight adapters; the sharing platform; the display runtime.
