# @wdl/core

Reference implementation of the [Workout Definition Language](../../spec/spec-0.1.md).

Zero dependencies. Runs on Node 22+ using native TypeScript type stripping.

```bash
node bin/wdl.ts fmt   file.wdl [-w]   # canonical formatting; -w rewrites in place
node bin/wdl.ts check file.wdl        # parse and report errors
npm test                              # conformance suite over examples/corpus
```

## Design

Parsing is **two-phase** (roadmap §5.1), which is what keeps a port to another language small:

| Phase | Module | Job |
|---|---|---|
| 1 | [`lines.ts`](src/lines.ts) | Indentation → line tree. Knows nothing about WDL — only indentation, comments, and brace continuations. ~100 lines, trivially portable. |
| 2 | [`parse.ts`](src/parse.ts) | Line tree → AST. Ordinary context-free work, because phase 1 removed the indentation sensitivity. |

[`ast.ts`](src/ast.ts) is the semantic contract; [`format.ts`](src/format.ts) emits canonical text.

## Not yet built

Semantic validation, movement-registry resolution, timeline compilation, and the interop adapters.
