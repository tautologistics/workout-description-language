# Things learned the hard way

Each of these cost real time. They are here so they cost it once. Record
corrections here rather than quietly editing history elsewhere — a reader who
does not know a road was tried will try it again.

**Tests do not read.** The corpus said `21 Thruster` for the entire project and
1226 tests were happy. Chris looked at the board for ten seconds and saw it. The
same pattern repeated with the builder: two bugs found by driving the UI, none
by the suite. *Verify by looking, not only by asserting.*

**An absent field is not a claim.** 64 movements had no equipment declared, and
`usable()` read that as bodyweight — so "generate for a dumbbell and a pull-up
bar" returned a workout with a sandbag carry in it. Absent means absent.

**Silence is worse than a crash.** An empty movement registry makes every
movement unregistered and switches off half of `validate` without a word.
`required()` throws and names the missing data instead.

**A filter must never widen.** The first muscle filter took the palette from 178
to 279 on the first click, because it silently changed scope.

**A flag about the whole must be set only by something that spans the whole.**
`run` hoisted `window` and `loops` from the first group that had them, anywhere
in the tree, so a 20-minute AMRAP between a run and a row reported the entire
workout as a seven-cue loop on a 20-minute clock. Neither number was true of
the run or the row. Now only a group on the spine — an only child of an only
child, up to the root — may speak for the workout.

**Position is not a safe way to say which is which.** `(105/145)` for a
women's and a men's Rx reads by *magnitude* — the larger is the men's — because
whiteboards write `95/65` meaning men first, so anyone writing the lighter first
would have had the heavier bar assigned to the lighter athlete. Magnitude cannot
be written backwards.

**A clock you can restart is not a clock.** The board starts a section's clock
when the cursor arrives in it — right, until Back steps out of the AMRAP and in
again, which handed out a fresh ten minutes. Stepping over a boundary and back
is how a mis-tap is undone, so what a section has already taken is kept against
the section, not against the cursor. The same shape as the rest: *elapsed
belongs to the thing being timed, not to the way you got there.*

**A caveat is not a finding.** "The amounts are floors" is true of every AMRAP
ever written and says how to *read* the results; "quads: 2 movements, at most 1"
says the workout breaks a rule. Both were list items in near-identical reds, so
the caveat read as a complaint about a workout that had one. Severity classes
are not enough when two things differ in *kind*: separate them structurally.

**Union is not merge.** Muscles were accumulated into a shared set alongside the
per-source claims, so deduplication kept one source's claim and orphaned
another's. Thruster came out working nine muscles including chest and calves.
Derive the merged view *from* the claims; never alongside them.

**Every pipeline step must be in the pipeline.** `mark-core.mjs` was run by hand
and never added to `build-canonical.ts`, so a rebuild erased `core` from all 3120
records. Each step rewrites the file from the one before.

**A wrong turn worth recording:** the first fix for browser portability was a
build-time module substitution — emit a `registry.web.js` and swap the specifier.
That is a workaround for a design smell. The core should not know where its data
lives on any platform. `src/env.ts` and the `provide()` seam replaced it, and the
build script became one regex.

**A round trip proves stability, not correctness.** `10 Thruster @95lb` — no
space after the `@` — reads the load as a *flag* named `95lb`, drops it from
`targets`, formats to `- 10 Thrusters, 95lb`, and reparses to that same text
forever. Perfect text fixpoint, perfect canonical fixpoint, and the load is
gone; `wdl check` says `ok`. A round trip asks "does this settle?", which a
wrong reading answers just as well as a right one. Only a *pinned
interpretation* — the expected tree, written down and diffed — asks "is this
right?". `test/golden/vocabulary.json` pins both, and the two questions are kept
separate there on purpose.

**A suite is only as wide as its vocabulary.** 1257 tests and a 190-workout
corpus that round-tripped cleanly, and 13 of the 24 documented syntax features
appeared in **zero** corpus files — alternatives, rx splits, thresholds,
`note:`, `variants:`, the inline brace form. Every defect the grammar
exploration turned up lived in that gap, because real workouts are a *sample*
and a language is a *space*. Sampling real documents will not cover a language;
only enumerating its forms does.

**Standing rule: a parsing defect becomes permutations, not just a fix.** Any
parsing issue, any round-trip discrepancy, any misreading found by looking —
capture it as new line permutations in `test/golden/vocabulary.ts` *before or
with* the fix, including the neighbours that share its shape. One case proves
the bug is gone; the permutations around it are what stop the same situation
coming back through a slightly different spelling. The `@95lb` find is pinned
with `@2x35lb` and `@24kg` beside it for exactly that reason. If a defect
arrives without a permutation, the fix is not finished.

**Two implementations of one language disagree in ways neither one is wrong
about.** Running the grammar beside the hand-written parser over all 746 step
lines this project has produced seven disagreements, and only one was a bug.
Three were the *order* of array elements — `peelTrailingQualifiers` strips from
the end so it reads right to left, and the `@` regex sweeps the whole line first
so an `@` flag is always hoisted in front, both artefacts of how the regexes are
arranged rather than decisions anyone made. Two were the parser being stricter
than the grammar can be: `min < max` on a rep range is a constraint on the
*values*, and a PEG has no way to say it. One was the parser being arbitrarily
narrower — `20cal` and `20 calories` are amounts and `20calories` is not,
because of a `\s*` in one regex. *A differential test's value is not the
failures it finds; it is that it forces every incidental behaviour to be either
stated or corrected.* Each of the seven is now a line in
`test/golden/vocabulary.ts` and a listed exclusion with a reason.

**An exclusion list has to be able to go stale.** Listing the lines a second
implementation reads differently is only honest if a line that stops differing
*fails* — otherwise the list quietly turns into a set of permanently ignored
cases and the headline number drifts away from what it claims. `grammar.test.ts`
checks both directions: every non-excluded line must agree, and every excluded
line must still disagree.

**Ohm's arity check is strict, and a rest parameter does not satisfy it.**
`durationQty_hms(...c)` is rejected with *"has the wrong arity: expected 4, got
0"* — the check reads `fn.length`, which a rest parameter reports as zero. Every
action has to spell out one parameter per child. Useful, once known: the error
tells you the true arity of each production, which settles `~x` contributing
nothing and `&x` contributing a child without having to reason about it.

**A constraint on the shipped library is not a constraint on the repository.**
"Zero dependencies" was written about `packages/core/src/`, where it is real and
load-bearing: that code ships into a server, a browser and a mobile app at once.
Read as a property of the *repo*, it produced a plan to hand-write a PEG engine
so that no package.json would appear anywhere — when a build-time generator
emits a standalone parser with no imports at all, which satisfies the actual
rule completely. The toolchain that *produces* a file is not the file. Before
honouring a constraint, check which artifact it binds; the phrasing in
README.md, running-it.md and settled-decisions.md has been sharpened so the
question does not come up again. *Corrected 2026-08-14.*
