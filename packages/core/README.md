# @wdl/core

Reference implementation of the [Workout Definition Language](../../spec/spec-0.1.md).

Zero dependencies. Runs on Node 22+ using native TypeScript type stripping.

```bash
node bin/wdl.ts fmt   file.wdl [-w]   # canonical formatting; -w rewrites in place
node bin/wdl.ts check file.wdl        # parse and report errors
npm test                              # every check, one summary
```

## Design

Parsing is **two-phase** (roadmap §5.1), which is what keeps a port to another language small:

| Phase | Module | Job |
|---|---|---|
| 1 | [`lines.ts`](src/lines.ts) | Indentation → line tree. Knows nothing about WDL — only indentation, comments, and brace continuations. ~100 lines, trivially portable. |
| 2 | [`parse.ts`](src/parse.ts) | Line tree → AST. Ordinary context-free work, because phase 1 removed the indentation sensitivity. |

[`ast.ts`](src/ast.ts) is the semantic contract; [`format.ts`](src/format.ts) emits canonical text.

## Tests

`npm test` runs six suites through one runner ([`test/all.ts`](test/all.ts)).

The distinction that matters: **round-tripping proves the parser and formatter agree with each
other, not that either is right.** A workout could parse into the wrong AST and still round-trip
perfectly. [`semantics.test.ts`](test/semantics.test.ts) is the correctness layer — it asserts
that Fran's scheme is `[21,15,9]`, that Kalsu is an interrupt rather than a sequence, that Murph
holds a tally block, that Fight Gone Bad measures calories on a duration-completed step.

[`errors.test.ts`](test/errors.test.ts) also records **pending** cases: checks the suite
acknowledges but does not yet enforce, so that missing validation stays visible instead of being
implied as covered by silence.

## Not yet built

Semantic validation (the 8 pending cases), movement-registry resolution, timeline compilation,
and the interop adapters.
