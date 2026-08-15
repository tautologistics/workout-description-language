# Can the grammar be stated formally, and drive the parser?

*Queue item 0, answered 2026-08-14. The deliverable was an answer, not a rewrite.*

**Yes.** The step line — the hardest slice, and the one carrying most of the
regex surface — was expressed as a grammar and reproduces the hand-written
parser's AST on **538/538 lines**: every step line in `examples/corpus`, every
step form in `spec-0.1.md`, and the exotic forms neither exercises. The result
is `spec/grammar-0.1.ohm`, which is normative, carries no semantic actions, and
is the same file the parser runs.

---

## What was actually measured

The parser's real surface is bigger than the queue item's "83 regex operations":
`parse.ts` alone holds ~101 regex literals and `units.ts` another 40. The step
half of that — `parseStep`, `parseOneStep`, `peelTrailingQualifiers`,
`applyQualifier`, `splitOr` and most of `units.ts` — is **241 code lines and 52
regex literals**, and it is what the 218-line grammar replaces.

Two candidate engines were built out far enough to compare on evidence rather
than on spec sheets. Both reached full parity, so neither was chosen for being
the only one that worked.

## Why a PEG, and not EBNF

The vision doc's layer 1 asked for "a normative EBNF grammar in the spec". EBNF
is the wrong notation for this language, and the reason is specific rather than
aesthetic: **WDL's rules are inherently ordered.**

- `each arm` must be tried before bare `each`, or `10 DB Snatch each arm` reads
  a team qualifier and loses the limb.
- `min` must be tried before a bare `m`, or `12min` is twelve metres.
- A laterality word must be tried before an rx split, since both are parenthesised.

EBNF's alternation is unordered. Every one of those rules would need a prose
caveat beside it — which is exactly the situation the item exists to end: prose
beside an implementation, with the prose not binding. In a PEG, `|` means "try
in this order", so the ordering *is* the specification and the grammar is
unambiguous by construction.

## What a grammar forced into the open

The most valuable output was not the parser. Three of the six first-round
failures were **boundary conditions the regexes were getting by accident**, and
none of them was written down anywhere:

1. **The unit boundary is "not a word character", not "not a letter."** The
   implementation gets this from `\b`. Without it stated, `1min30s` reads as a
   spaced `1 min` with `30s` left over.
2. **A quantity is a whole whitespace-delimited token.** The implementation gets
   this from splitting on whitespace before matching. Without it, `3/4 Sit-Up`
   reads its leading `3` as three reps of a movement called `/4 Sit-Up`.
3. **A zone digit is a whole token.** Without it, `until HR > 160bpm` matches
   zone 1 and leaves `60bpm` on the floor.

A regex chain can hold rules like these implicitly and still be right. A grammar
cannot — which is the maintainability argument made concrete.

## What it found

**`@` with no space after it silently destroys the load.** `- 10 Thruster @95lb`
reads `95lb` as a *flag*: `/@(\w[\w-]*)/g` runs over the whole line before the
`@` split, and `\w` matches digits. The load never reaches `targets`, so it is
invisible to analysis, the builder and the board; `wdl check` reports `ok`; and
`wdl fmt` rewrites the line to `- 10 Thrusters, 95lb`. In the grammar this is one
rule — a flag is `@` *not* followed by a space — and it cannot be written any
other way. Recorded in `known-debts.md`, pinned as three `pending` cases.

**The test suite was as wide as its sample, not its language.** 1257 tests and a
190-workout corpus that round-tripped cleanly, and **13 of 24 documented syntax
features appeared in zero corpus files** — alternatives, rx splits, thresholds,
`note:`, `variants:`, the inline brace form. Every defect above lived in that
gap. Addressed by `test/golden/vocabulary.ts` (235 forms, +237 tests), which
pins the *interpretation* and not only the round trip, because a misreading
round-trips perfectly. See `lessons-learned.md`.

## The engines, and why Ohm

| | peggy | Ohm | tree-sitter |
|---|---|---|---|
| Parity reached | 431/431 + 146/146 | **538/538** | not built |
| Grammar file | actions embedded | **pure** | a JS DSL |
| Reaches `src/` | nothing (generated JS) | 95K library, 0 deps | WASM runtime |
| Build step | required | none | required |
| Unknown input | explicit production | explicit production | heuristic `ERROR` nodes |

**tree-sitter was declined, and the reason it was originally *chosen* turned out
not to apply.** Vision doc §5.1 picked it over ANTLR for indentation sensitivity
via an external C scanner, plus editor tooling. The indentation argument is void
here by design: the two-phase parse already isolates indentation in `readLines`,
so phase 2 is an ordinary line grammar. What remained was a WASM runtime, a
CST→AST layer to hand-write (which is most of what `parse.ts` already is), and
an answer to unrecognized input — cost-based recovery into `ERROR` nodes — that
is "reported rather than held", precisely what the item rules out.

**peggy was rejected only on comparison.** It is pure JS, MIT, and its generated
parser has no imports at all — genuinely zero runtime dependency. But its
grammars embed semantic actions, so the pure normative grammar would have to be
*generated* from the `.peggy` file by stripping them, and it checks 128K of
generated JS into the source path.

**Ohm was chosen because its defining property is the requirement.** It
completely separates grammars from semantic actions: the grammar file is pure,
the semantics are a sibling file, and there is no generation step between the
spec and the parser to drift. The cost is a runtime import in
`packages/core/src/` — accepted because `ohm-js` has zero dependencies of its own
and ships as a single 95K file, and because the escape hatch is cheap: if the
no-imports line ever has to be absolute, that file can be vendored into the core
outright. Reversible in both directions, which is what makes it safe.

A useful side effect: the builder's modifier affordance — "what can this line
take next" — becomes a second *operation* over the same grammar rather than a
second derivation.

## Two wrong turns, recorded

**Reasoning from "the repo has no dependencies".** That phrasing appeared in
`README.md` and `running-it.md`, and produced a plan to hand-write a PEG engine
so no `package.json` would appear anywhere. The rule is narrower and binds a
different artifact: **`packages/core/src/` has no external dependencies**,
because it ships to a server, a browser and a mobile app at once. Toolchains that
*produce* those files may have whatever they need. Corrected at source in three
files; the lesson is in `lessons-learned.md`.

**Ohm's `--` binds one alternative, not a group.** `"<" | "below" | "under" -- lt`
names only `under`. The same latent bug sat in the spelled-out unit rules, where
`12 minutes` would have produced `NaN` seconds while `12 min` worked. Caught
because the vocabulary suite covers the spellings; it would not have been caught
by the corpus.

## Since: the semantics came into the repo

*Added 2026-08-15. The exploration's numbers above are left as they were
measured; this is what changed, not a correction to them.*

The semantics that proved 538/538 were written in a scratchpad and thrown away
with it, which meant the claim above was true and unreproducible at the same
time. They have been rewritten as `packages/core/src/grammar/step-semantics.ts`,
`ohm-js` is a dependency of `packages/core`, and
`packages/core/test/grammar.test.ts` re-derives the number on every run instead
of asserting it.

**The number is now 746/746**, and it is a wider set rather than a better
result: the earlier count was of the lines the scratchpad harness happened to
feed it, and this one is every step line in `examples/corpus` (431), every one
in `spec-0.1.md` (157), and every step case in `test/golden/vocabulary.ts`
(158), deduplicated.

**Seven lines disagree, and they are the interesting part.** None is in the
corpus or the spec; all seven were found by probing around the edges and are now
pinned in the vocabulary and listed as exclusions with reasons.

| Line | Disagreement |
|---|---|
| `10 Thruster, @ 95lb` (+2) | The parser files a target after a comma as a **note** — the load is lost. A real defect, now in `known-debts.md`. |
| `10 Deadlift unbroken building` | Same flags, reverse order: `peelTrailingQualifiers` reads right to left. |
| `10 Deadlift building @tiebreak` | The `@` regex sweeps the whole line first, so an `@` flag is hoisted in front. |
| `10-5 Squat` | `min < max` is a constraint on the *values*; a PEG cannot state it, so the grammar reads a descending range. |
| `20calories Row` | The parser wants a space before a spelled-out unit; the grammar is regular about it. |

One more, not in the table because nothing writes it: a line that is *only* a
threshold — `until HR > 160bpm` with no movement — parses today to a step with
an empty movement name, and the grammar rejects it, because `movement` requires
at least one character.

**The swap was still not made, and the reason has hardened.** Steps and block
headers share the lexical layer — durations in `cap 12min` and `every 90s`,
targets as an inherited `@`, `21-15-9` as a ladder against `8-12` as a range —
so landing steps alone would mean reworking the step semantics once headers
force those productions apart. The grammar runs *beside* the parser until it
covers all of phase 2, then goes in as one change. Queue item 0c is now first.

**A finding that only appears once the code is in the repo:** the browser cannot
resolve `ohm-js`. `build-web.mjs` strips types and rewrites specifiers; it does
no module resolution, so a bare `import` survives into `build/web/core/` and the
browser refuses it. Nothing imports the grammar module yet, so both apps still
run clean — verified by loading them — but this has to be solved before the
swap. It is in `known-debts.md` with the fix.

## What is not answered

- **The grammar covers the step line only.** Block headers (~20 forms), block
  modifiers, rest, score, variants and the preamble are still prose plus
  `parse.ts`. That is roughly half of phase 2.
- **Nothing is wired up.** `parse.ts` is untouched and the builder and board run
  the old path. *(The semantics are now in the repo — see the section above.)*
- **`unknown` is proven in the grammar, not in the AST.** The production holds
  unrecognized text as a first-class node, but the `Step` type has no field for
  it and `format` does not render it, so the known debt — unknown modifiers
  becoming indistinguishable from authored notes — is not yet closed end to end.
- **Phase 1 is untouched**, so queue item 0b (a container adopting unindented
  following lines) is unaffected by any of this.
