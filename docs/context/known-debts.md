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

- ~~**`@` with no space after it silently destroys the load.**~~ **Closed
  2026-08-15** by queue item 0a, the swap. `- 10 Thruster @95lb` used to read
  `95lb` as a *flag*: `/@(\w[\w-]*)/g` ran over the whole line before the `@`
  split and `\w` matches digits, so the load never reached `targets` — invisible
  to muscle and volume analysis, to the builder and to the board — while
  `wdl check` reported `ok` and `wdl fmt` rewrote the line to
  `- 10 Thrusters, 95lb`, a stable fixpoint of the wrong reading. No corpus file
  writes `@` without a space, which is why 1257 tests never saw it; the grammar
  exploration found it.

  **The rule, stated in `spec/grammar-0.1.ohm` and now the only reading there
  is:** the first character after the `@` decides. A letter opens a flag, a digit
  opens a target. So `@95lb`, `@ 95lb`, `@95` and `@ 95` all read the same way,
  and the presence of a unit has nothing to do with it — the earlier phrasing of
  the fix ("a flag is `@` not followed by a space") was half of it and would have
  left `@95` a flag called `95`. The flag form does still require the `@` tight
  against the word, because a *spaced* target legitimately begins with a letter —
  `@ Z2`, `@ RPE 8`, `@ of heavy-single` — so `@ tiebreak` is a target, stated
  rather than left to rule ordering. `spec-0.1.md` §7 says all of this too.

  Six forms were pinned as `known-wrong` and are now `was-wrong` in
  `test/golden/vocabulary.ts` — `@95lb`, `@2x35lb`, `@24kg`, `@95`, `@85% 1RM`
  and `18 Thruster @115lb @tiebreak` — with what each used to do kept beside what
  it does now. Two of them were worse than a lost load: `@85% 1RM` stopped the
  flag at the `%` and left `% 1RM` in the movement name, formatting to
  `10 Thruster % 1RMs, 85`. The rule itself is asserted directly in
  `test/grammar.test.ts`, because with one implementation left there is no
  disagreement to read it off.

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

- ~~**A target written after a comma is filed as a note.**~~ **Closed 2026-08-15**
  by the swap. `- 10 Thruster, @ 95lb` used to put `@ 95lb` in `notes`, not
  `targets`: the `@` split ran over the *first* comma segment only, so
  `applyQualifier` never saw a target and fell through to its catch-all. Same
  consequence as the `@95lb` entry above — the load invisible to analysis, the
  builder and the board, `wdl check` saying `ok`, and the wrong reading a perfect
  fixpoint. Found 2026-08-15 by `test/grammar.test.ts`, which read it as a target
  the same day. The grammar reads an `@` group wherever it appears; three forms
  are pinned under `was-wrong`.

- ~~**The browser cannot resolve `ohm-js`.**~~ **Closed 2026-08-15**, before item
  0c rather than with the swap, because there was one import site to change and
  0c adds more. `ohm-js` is vendored into `packages/core/src/grammar/vendor/` and
  imported by relative path; the grammar module now loads and parses in both
  apps, confirmed by loading it. The guardrail that missed it — `portable.test.ts`
  looked for `node:` imports, and this was a bare specifier — now fails on any
  non-relative specifier, and so does `build-web.mjs`. See
  [settled-decisions.md](settled-decisions.md).

- ~~**An rx split with a space-separated qualifier after it is swallowed into the
  movement name.**~~ **Closed 2026-08-15** by the swap, and it was the worst of
  the three. `- 10 Deadlift (105/145) each arm` used to parse to a movement
  literally named `Deadlift (105/145)`, because `peelRx` only fired at the end of
  a comma segment so the paren never left the name. Both loads were lost, and the
  name matched no registry entry — so unlike the `@95lb` family the step also
  dropped out of muscle and volume analysis, and the builder showed an
  unregistered movement. `wdl fmt` then pluralized the name it was handed and
  wrote `10 Deadlift (women 105lb / men 145lb)s each arm`, a `)s` on the
  whiteboard. With a *flag* rather than a laterality it did not even settle:
  `10 Deadlift (105/145) unbroken` formatted to
  `10 Deadlifts (105/145), unbroken`, and the comma spelling reparsed *as an rx*
  — one pass of the formatter lost the loads and the next found them, which is
  why it was the only entry in `KNOWN_UNSETTLED`. Found 2026-08-15 by parsing a
  line in the browser while checking the vendored engine. Five forms pinned under
  `was-wrong`, two correct neighbours under `rx-by-division`, and
  `KNOWN_UNSETTLED` is empty.

- ~~**A header target written after a comma is filed as a flag.**~~ **Closed
  2026-08-15** by the swap. `3 rounds, @ 95lb:` used to put `@ 95lb` in `flags`,
  not `inherited`, so nothing under the block inherited the load. The `@` sweep in
  `parseHeader` ran over the *first* comma segment only, exactly as the
  step-level one did, and `applyBlockModifier` fell through to its catch-all. The
  header twin of the `10 Thruster, @ 95lb` entry above, with the same
  consequences and the same fix: the grammar reads an `@` group as an inherited
  target wherever it appears. Found 2026-08-15 by stating the block header in the
  grammar; it was the one header exclusion, and that list is empty now.

- **`5x5 Back Squat @ 225lb` parses to a movement named `5x5 Back Squat`.** Leading
  `sets x reps` — the way gyms write it, and the way **spec §1's own design rule 4
  writes it**, as the example for "must stay a one-liner" — is read by neither
  implementation. `parseQuantity` matches no pattern on `5x5`, so the whole thing
  falls through into the movement name, the quantity stays `open`, the name
  resolves to nothing, and `wdl fmt` writes it straight back. The *trailing*
  spelling works (`3 Bench Press @ 80% 1RM x5`), which is what hid this. Found
  2026-08-15 by widening the differential test's step source to the vocabulary's
  whole-document forms. Pinned with `3x10 Curl` beside it. **Not stated in the
  grammar**, deliberately: reading it correctly means adding a form to the
  language, which is a decision rather than a transcription.

- ~~**`wdl fmt` drops `after last` from four of the five kinds of rest.**~~
  **Closed 2026-08-15** by queue item 0e. `restText` *used to* return early for
  `as needed`, `= work`, active recovery and a threshold, so only a plain duration
  ever had ` after last` appended. `rest as needed after last` formatted to
  `rest as needed` — "rest only after the last round" became "rest between every
  round", which is a different workout, and `wdl check` said ok. Invisible to the
  vocabulary's fixpoint check, because the *second* format of the shortened line
  is stable: one more way a round trip proves stability and not correctness. Found
  2026-08-15 while writing rest permutations for the grammar.

  **The fix is where the fact lives, not a fifth branch.** `after last` says
  *which* rest rather than how long it is (spec §5.2, N1), so it is appended once,
  outside the branch on the bound — the branch computes a bound and nothing else.
  Written as a fifth early return it would have been the same bug waiting for the
  sixth kind of bound. Eleven forms are pinned now rather than four: every bound
  crossed with `after last`, including the *alternate spellings* of bounds that
  already worked (`rest equal to work after last`, `rest 1:30 after last`,
  `rest 1 min 30 s after last`) and `rest after last` with no bound at all, which
  is the one that would have shown a double space.

- **The nested `score:` block that spec §9.5 and §9.6 both document is dropped
  entirely.** Written as the spec writes it —

  ```wdl
  score:
    primary: time
    on cap: reps
  ```

  — `parseScore` is handed `score:` with nothing after it, `primary` becomes the
  empty string, the children are never looked at, `wdl check` reports ok, and
  `wdl fmt` writes a bare `score:`. The sibling-line spelling (`score: time` then
  `on cap: reps`) is the one that works and is the one the formatter emits. Found
  2026-08-15 while stating the score line in the grammar; pinned as a vocabulary
  form. Either the spec's prose is wrong or the parser is, and that is the
  decision — the grammar reproduces the parser here rather than picking.

- **A brace score with no `primary:` field makes the whole brace text the
  primary.** `score: {tiebreak: reps at 5min}` gives
  `primary: "{tiebreak: reps at 5min}"`, which nothing can rank by, and the
  canonical form then states the tiebreak twice — once inside the `raw` it
  re-emits and once as its own `tiebreak:` line. Pinned 2026-08-15; the grammar
  reproduces it, because a `primary` defaulting to the raw text is what
  `parseScore` says.

- ~~**A spelled-out duration word is a step quantity and not a rest.**~~
  **Closed 2026-08-15** by queue item 0e. `45 seconds Plank` was 45 seconds;
  `rest 45 seconds` was an `unreadable rest duration` error **and** a rest with no
  bound at all, which everything downstream reads as unbounded — so the line meant
  the *opposite* of what it said, which is worse than not reading it. Same for
  `2 mins`, `1 hour`, `45 sec`, `3 minutes`. Spec §3's unit table says these
  spellings are accepted "wherever a duration is expected", and a rest is a
  duration position, so the prose was right and the parser was wrong; no decision
  was needed, only the transcription. Found 2026-08-15 by typing lines into the
  browser.

  **The fix is where a duration is read, not where a rest is.** `parseDuration`
  folds the spelled-out spellings onto the compact ones itself now; they used to
  live in `parseQuantity`, anchored to the end of a single token, and the rest
  path never went through that caller. Global rather than anchored, so
  `rest 1 hour 30 minutes` folds both halves instead of only the last. The grammar
  gained `minuteWords`/`secondWords`/`hourWords` — one named list per unit, shared
  by `durWord` and by the rest line's `looseDuration`, since stated twice they
  would drift. Fourteen forms pinned where three were: every spelling of every
  unit, a compound, one with `after last`, and `rest 45 seconds Plank`, which must
  stay *active recovery* and not a bound with a name left over.

  *The three were the first entries in `grammar.test.ts`'s rejects list, which
  existed because a line **neither** implementation read was the one thing a
  differential test could not see. That list is empty again, and its rationale has
  been restated: with one implementation it is simply "the lines no rule reads",
  which is the honest half of the coverage count.*

- ~~**A target and a `for time` on one header, written in that order, lose
  both.**~~ **Closed 2026-08-15** by queue item 0e. `3 rounds @ 95lb for time:`
  used to hand `95lb for time` to `parseTarget` whole, because `@\s*([^,@]+)` is
  greedy to the end of the segment — so it came back a raw target and the score
  never happened, leaving the children with no real load and the block unscored.
  Written the other way round (`3 rounds for time @ 95lb:`) both always read
  correctly, which is what made this order-sensitivity rather than a missing form,
  and it round-trips as byte-identical text, so nothing but a pinned reading could
  see it. The grammar inherited the same greed, since its target text stopped at a
  comma or an `@` and not at a `for time`.

  **The fix is the parameterized rule the entry above said it would need.**
  `targetGroup<stop>` takes the boundary as a parameter: `never` in a step, where
  a target is prose and legitimately runs to the end of its segment, and `forTime`
  in a header, where `for time` is a score that may be fused onto any kind. One
  rule read to two boundaries, rather than a header-local copy of five rules that
  could drift.

  **What it cost that was not expected, and it is the interesting half.** The
  comma spelling (`3 rounds, @ 95lb for time:`) is the same target one position
  over, so the stop had to apply there too — and applied *alone* it made that line
  strictly **worse** than greedy: with the target stopping short, the `for time`
  had nothing left to consume it, so the whole header became unreadable and the
  kind and the load went down with it. Half-applied, it also turned a
  wrong-but-stable reading into an *unsettled* one, the shape the rx-split defect
  had: `wdl fmt` wrote the comma away and the second pass then read what the first
  had lost. So `headerModifier` gained trailing extras, which states out loud
  something that was true and unsaid — **whatever may qualify a header before a
  comma may qualify it after one**. Eight forms pinned where two were, including
  `3 rounds @ marathon pace:` to prove the boundary is the phrase `for time` and
  not the word `for`, and `10 Thruster @ 95lb for time` to pin that the step side
  is deliberately unchanged.

- An unrecognized step modifier is pushed into `step.notes`, the same array as an
  authored `note: "…"`. *Unchanged by the swap 2026-08-15: `modifier_unknown` in
  the grammar reproduces it deliberately, because until there is somewhere else
  for unknown to live, changing where it lands is item 0d's job and not the
  swap's. One nameless entry did go — a stray trailing comma used to push an
  empty string in, and a comma with nothing after it now contributes nothing.* Afterwards the two cannot be told apart, and notes are
  rendered — so an unknown token silently acquires the meaning "the author wrote
  a note". Unknown should be held as unknown: preserved, round-tripped, inert.
  Bound up with queue item 0. *It has a block-level twin, recorded 2026-08-15
  while stating the header: an unrecognized header modifier is pushed into
  `block.flags`, the same array as `unbroken` and `rounds`, so afterwards nothing
  can tell an unknown token from a flag the language defines. Queue item 0d should
  cover both.*
- The builder's Indent allows a first-in-document top-level line to be indented,
  orphaning it and invalidating the file. `shift` guards only against negative
  indent, never against having no parent to attach to.

The ones with a plan attached are queued in
[ready-to-pick-up.md](ready-to-pick-up.md); the ones found by driving the
builder are in [builder-ux.md](builder-ux.md).
