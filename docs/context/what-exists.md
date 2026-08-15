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
| **Grammar** | A normative Ohm grammar for the **step line** in [spec/grammar-0.1.ohm](../../spec/grammar-0.1.ohm), reproducing the current parser's AST on 538/538 step lines. Not wired up yet — `src/` still runs the hand-written parser — block headers, rest, score and the preamble are still prose plus implementation. See [grammar-exploration.md](../grammar-exploration.md). |
| **Tests** | 1494 passing. `vocabulary.test.ts` covers 235 documented forms, pinning both the canonical text and the *interpretation* — the tree — for each; `corpus.test.ts` round-trips 190 real workouts. The two answer different questions; see [lessons-learned.md](lessons-learned.md). |
| **Apps** | Builder and board, both in a browser over the same core. The builder has a movement palette with muscle filtering, drag-and-drop, and live goal checking; goals can be written, saved and downloaded from it. The board loops the *section* that repeats, on that section's own clock. |

Working is not the same as trusted: what is built but known to be wrong in some
corner is in [known-debts.md](known-debts.md).
