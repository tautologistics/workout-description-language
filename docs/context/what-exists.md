# What exists

What is built and working. Read it before building something again; update it
when something lands, and take the same thing out of
[not-built.md](not-built.md) or [ready-to-pick-up.md](ready-to-pick-up.md).

| | |
|---|---|
| **Format** | Parser, canonical formatter, validator, timeline compiler. 190-workout corpus round-trips. Alternatives: `A or B`, `A/B`, `A|B`, and a `choice:` block. Rx by division: `(women 105lb / men 145lb)` or `(105/145)`. |
| **Interop** | Import: `.zwo`, `.erg`/`.mrc`, FIT. Export: those plus Garmin Connect JSON. Verified against a real watch. |
| **Registry** | 3120 movements merged from five sources, 178 marked core, 2983 with muscle data. Every record names its sources and keeps their claims separately. |
| **Analysis** | Muscle attribution with a closed 19-muscle vocabulary; per-muscle volume; ordering with the repeat-wrap. |
| **Goals** | Five rules — `no repeat`, `cover`, `limit`, `balance`, `progress` — in a separate file. `wdl goals`. |
| **Generation** | `?` holes in a template, filled to satisfy the goals. `wdl generate`, single workout or a whole block. |
| **Programs** | An ordered block with slots. `wdl program`. |
| **Grammar** | A normative Ohm grammar in [spec/grammar-0.1.ohm](../../spec/grammar-0.1.ohm) covering **every kind of line phase 2 reads** — step, block header with its comma modifiers, rest, score, `on cap:`/`tiebreak:`, directives, title, variants — as nine start rules over one shared lexical layer, carrying no semantic actions. What each production *means* is one module per area under `packages/core/src/grammar/`, all put on a single semantics object by `parser.ts`. It **runs**, on `ohm-js` vendored into `src/grammar/vendor/` and imported by relative path, and reproduces the hand-written parser's AST on **789/789 step lines, 195/195 block headers, 41/41 rest lines, 40/40 score lines, 11/11 directives and 204/204 titles** — every one in the corpus, in `spec-0.1.md`, and in the vocabulary — with 20 recorded disagreements and 3 recorded shared rejects, each pinned. It runs **in a browser** too: the emitted module resolves, fetches `spec/grammar-0.1.ohm` and parses, confirmed by loading it. It is **not the production path**: `parse.ts` is untouched and both apps run the old parser. What is left to prose is the *assembly* — which score an `on cap:` qualifies, which variant a field belongs to, which block a child belongs to. See [grammar-exploration.md](../grammar-exploration.md). |
| **Tests** | 1578 passing, 24 pending. `vocabulary.test.ts` covers 282 documented forms, pinning both the canonical text and the *interpretation* — the tree — for each; `corpus.test.ts` round-trips 190 real workouts; `grammar.test.ts` runs the grammar beside the parser over every line of every kind the project has, in six separately-counted areas, and also lists the lines *neither* implementation can read; `portable.test.ts` fails on any specifier under `src/` that a browser could not resolve. They answer different questions; see [lessons-learned.md](lessons-learned.md). |
| **Apps** | Builder and board, both in a browser over the same core. The builder has a movement palette with muscle filtering, drag-and-drop, and live goal checking; goals can be written, saved and downloaded from it. The board loops the *section* that repeats, on that section's own clock. |

Working is not the same as trusted: what is built but known to be wrong in some
corner is in [known-debts.md](known-debts.md).
