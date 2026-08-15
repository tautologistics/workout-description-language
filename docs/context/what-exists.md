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
| **Grammar** | A normative Ohm grammar in [spec/grammar-0.1.ohm](../../spec/grammar-0.1.ohm) covering **every kind of line phase 2 reads** — step, block header with its comma modifiers, rest, score, `on cap:`/`tiebreak:`, directives, title, variants — as nine start rules over one shared lexical layer, carrying no semantic actions. What each production *means* is one module per area under `packages/core/src/grammar/`, all put on a single semantics object by `parser.ts`. It runs on `ohm-js`, vendored into `src/grammar/vendor/` and imported by relative path. |
| **The parser is the grammar** | *Since 2026-08-15 (queue item 0a).* `parse.ts` matches these rules and walks them, in Node and in both apps; the regex chain is deleted. The grammar text reaches the core through the same `provide()` seam as the registry — `node.ts` reads the file, a browser fetches it, and `required('grammar')` throws by name if nobody hands it over. `parse.ts` is **306 lines and 18 regex literals**, down from 548 and ~101, and every regex that remains is *dispatch*: which kind of line this is, which phase 1 does not answer and the grammar deliberately does not either. What is still hand-written is the **assembly** — which score an `on cap:` qualifies, which variant a field belongs to, which block a child belongs to, and the `parseNode` dispatch itself. Those are questions about several lines. |
| **Tests** | 1628 passing, 1 pending. `vocabulary.test.ts` covers 323 documented forms, pinning both the canonical text and the *interpretation* — the tree — for each; `corpus.test.ts` round-trips 190 real workouts; `grammar.test.ts` feeds every line of every kind the project has to the start rule for its kind, in six separately-counted areas — **820 step lines, 202 block headers, 60 rests, 42 scores, 11 directives, 204 titles** — lists the ones it cannot read with a reason each, and asserts the rules that used to be visible only as a disagreement with the old parser; `portable.test.ts` fails on any specifier under `src/` that a browser could not resolve. They answer different questions; see [lessons-learned.md](lessons-learned.md). *As of queue item 0e, 2026-08-15, only **one** line the project writes is unread by any rule (`10x Curl`) and only one pinned reading is known-wrong — the same line.* |
| **Apps** | Builder and board, both in a browser over the same core. The builder has a movement palette with muscle filtering, drag-and-drop, and live goal checking; goals can be written, saved and downloaded from it. The board loops the *section* that repeats, on that section's own clock. |

Working is not the same as trusted: what is built but known to be wrong in some
corner is in [known-debts.md](known-debts.md).
