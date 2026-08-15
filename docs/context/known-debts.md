# Known debts

Things that are wrong, known to be wrong, and left that way for now. Check here
when something looks odd before treating it as a discovery.

- Three singular/plural duplicates remain in the registry's long tail
  (`Hindu Push-up`, `Rack Pull`, `Squat with Bands`). Pinned by a test so the
  count cannot grow; none used by the corpus.
- `Quad Stretch` scored into the 178 core movements on source agreement. Visible
  when generating with a bare `?`.
- Step-level `rx` and workout-level `variants:` are two mechanisms for one idea.
  `rx` should probably desugar into a variant so `--variant women` covers both;
  it does not yet. Worse than untidy: `stepCue` labels from `targets` only, so a
  step whose load is an `rx` split shows no weight in the builder *or* on the
  board.
- Templates and workouts share the `.wdl` extension, so `wdl fmt` on a template
  is easy to do by accident.
- A capped for-time workout reports `duration: 12:00` in the builder, which
  reads as "this takes twelve minutes" where it means "you have at most twelve".
  `run` does not expose the cap separately from a computed total, so telling
  them apart needs a core change. Same class as the AMRAP `duration`/`window`
  duplication that Chris caught.

- **`@` with no space after it silently destroys the load.** `- 10 Thruster
  @95lb` reads `95lb` as a *flag*, not a target: `/@(\w[\w-]*)/g` runs over the
  whole line before the `@` split, and `\w` matches digits. The load never
  reaches `targets`, so it is invisible to muscle and volume analysis, the
  builder and the board; `wdl check` reports `ok`; and `wdl fmt` rewrites the
  line to `- 10 Thrusters, 95lb`, which is a stable fixpoint of the wrong
  reading. No corpus file writes `@` without a space, which is why 1257 tests
  never saw it. Found by the grammar exploration, pinned as `pending` cases in
  `test/golden/vocabulary.ts`.

  **The grammar now states the correct rule, and the swap is the fix.**
  *Settled 2026-08-15.* `spec/grammar-0.1.ohm` reads **the first character after
  the `@`**: a letter opens a flag, a digit opens a target. So `@95lb`, `@ 95lb`,
  `@95` and `@ 95` all read the same way, and the presence of a unit has nothing
  to do with it — the earlier phrasing of the fix ("a flag is `@` not followed by
  a space") was half of it and would have left `@95` a flag called `95`. The flag
  form does still require the `@` tight against the word, because a *spaced*
  target legitimately begins with a letter — `@ Z2`, `@ RPE 8`,
  `@ of heavy-single` — so `@ tiebreak` is a target, stated rather than left to
  rule ordering. `spec-0.1.md` §7 says all of this now too.

  Grammar and parser therefore **disagree on every `@`-plus-digit form**, which
  is the intended state: the grammar is right and `parse.ts` is wrong until the
  swap (queue item 0a). Six lines are listed as exclusions in
  `test/grammar.test.ts` with reasons and pinned as `known-wrong` in the
  vocabulary — `@95lb`, `@2x35lb`, `@24kg`, `@95`, `@85% 1RM`, and
  `18 Thruster @115lb @tiebreak`. Two of them are worse than a lost load:
  `@85% 1RM` stops the flag at the `%` and leaves `% 1RM` in the movement name,
  formatting to `10 Thruster % 1RMs, 85`.

- **Open: what a target with no unit means.** `@ 95` parses to
  `{kind: 'raw', text: '95'}` — held verbatim, meaning nothing. That is
  deliberate as of 2026-08-15 and pinned as a vocabulary case, but it is a
  holding answer rather than a settled one. The alternative is a `load` with an
  absent unit, which `Load` cannot express today (`unit` is a required
  `'lb' | 'kg'`), and making it optional reaches `formatLoad`, volume, muscle
  analysis and every exporter. `raw` at least says something true — a target was
  written and nothing can be computed from it — where a defaulted unit would be
  an invention: `@95` is 95lb in one gym and 95kg in another. Decide it properly
  when something needs to consume it.

- **A target written after a comma is filed as a note.** `- 10 Thruster, @ 95lb`
  puts `@ 95lb` in `notes`, not `targets`. The `@` split runs over the *first*
  comma segment only, so `applyQualifier` never sees a target and falls through
  to its catch-all. Same consequence as the `@95lb` entry above — the load is
  invisible to analysis, the builder and the board, `wdl check` says `ok`, and
  the wrong reading is a perfect fixpoint. Found 2026-08-15 by
  `test/grammar.test.ts`, which reads it as a target; pinned as three `pending`
  cases in `test/golden/vocabulary.ts` and listed as a grammar exclusion.

- ~~**The browser cannot resolve `ohm-js`.**~~ **Closed 2026-08-15**, before item
  0c rather than with the swap, because there was one import site to change and
  0c adds more. `ohm-js` is vendored into `packages/core/src/grammar/vendor/` and
  imported by relative path; the grammar module now loads and parses in both
  apps, confirmed by loading it. The guardrail that missed it — `portable.test.ts`
  looked for `node:` imports, and this was a bare specifier — now fails on any
  non-relative specifier, and so does `build-web.mjs`. See
  [settled-decisions.md](settled-decisions.md).

- **An rx split with a space-separated qualifier after it is swallowed into the
  movement name.** `- 10 Deadlift (105/145) each arm` parses to a movement
  literally named `Deadlift (105/145)`: `peelRx` only fires at the end of a comma
  segment, so the paren never leaves the name. Both loads are lost, and the name
  now matches no registry entry — so unlike the `@95lb` family, the step also
  drops out of muscle and volume analysis, and the builder shows an unregistered
  movement. `wdl fmt` then pluralizes the name it was handed and writes
  `10 Deadlift (women 105lb / men 145lb)s each arm`, a `)s` on the whiteboard.
  With a *flag* rather than a laterality it does not even settle: `10 Deadlift
  (105/145) unbroken` formats to `10 Deadlifts (105/145), unbroken`, and the
  comma spelling reparses *as an rx* — one pass of the formatter loses the loads
  and the next finds them. A comma or writing the qualifier first both read
  correctly, so this is the space that decides it. Found 2026-08-15 by parsing a
  line in the browser while checking the vendored engine; pinned as five
  `known-wrong` cases and two correct-neighbour cases in
  `test/golden/vocabulary.ts`, listed as grammar exclusions, and the unsettled
  one is in `KNOWN_UNSETTLED` in `vocabulary.test.ts`. The grammar reads all
  seven correctly, so the swap (queue item 0a) dissolves it — which is now one
  of the arguments for the swap.

- An unrecognized step modifier is pushed into `step.notes`, the same array as an
  authored `note: "…"`. Afterwards the two cannot be told apart, and notes are
  rendered — so an unknown token silently acquires the meaning "the author wrote
  a note". Unknown should be held as unknown: preserved, round-tripped, inert.
  Bound up with queue item 0.
- The builder's Indent allows a first-in-document top-level line to be indented,
  orphaning it and invalidating the file. `shift` guards only against negative
  indent, never against having no parent to attach to.

The ones with a plan attached are queued in
[ready-to-pick-up.md](ready-to-pick-up.md); the ones found by driving the
builder are in [builder-ux.md](builder-ux.md).
