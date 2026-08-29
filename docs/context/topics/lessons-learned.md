# Things learned the hard way

Each of these cost real time. They are here so they cost it once. Record
corrections here rather than quietly editing history elsewhere — a reader who
does not know a road was tried will try it again.

**Tests do not read.** The corpus said `21 Thruster` for the entire project and
1226 tests were happy. Chris looked at the board for ten seconds and saw it. The
same pattern repeated with the builder: two bugs found by driving the UI, none
by the suite. *Verify by looking, not only by asserting.*

*It held again on 2026-08-15, and this time the looking was at a browser
console.* Proving the vendored grammar ran meant typing a line into it by hand,
and the first line invented on the spot — `10 Deadlift (105/145) each arm` —
disagreed with the parser: the rx paren goes into the *movement name*. 1510
tests and a 249-form vocabulary had not covered an rx with anything after it.
The habit worth copying is not "check the browser"; it is that a hand-typed
example is drawn from a different distribution than anything already written
down, which is why it finds what the suite cannot.

**A ranking between two kinds of name has to survive the plural.** Reversing
the resolver's two tiers on 2026-08-23 so an explicit alias beats a record's own
id was correct, resolved every contested name the way the curator meant, and
immediately split `Squat` from `Squats` onto two different movements — because
the imported record carries its own plural in `aliases`, so the plural matched
the *alias* tier on one record while the singular matched it on the other. A
reordering is not a local change: it changes which tier every *derived* spelling
lands in too. The fix is that a regular self-plural is not a name the registry
needs to hold — `depluralize` reconstructs it — so it is not indexed at all.
*It was caught by a test rather than by thinking, and by the one test written
for exactly this: `never changes which movement a name resolves to`. Second time
it has paid.*

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

**A count nobody regenerates is a count that lies.** `SOURCES.json`'s
`mergedCorpora` line and the `SOURCES.md` table both described the merged corpus
by hand, and both still carried the figures `build-movements.mjs` prints *before*
dedup — 3335 movements, 3161 with muscle data, 1510 with a Garmin mapping, 850
translated — against a file holding 3120, 2983, 1503 and 621. All four were
wrong, in the file whose whole job is to be believed about provenance.
`describe-corpora.mjs` writes both now, as the last pipeline step, counted from
the finished corpora rather than from the merge. Two of the four were only
findable by measuring: the Garmin figure was a coincidence — 1510 is the size of
Garmin's *catalogue*, quoted correctly elsewhere and wrong here — and the
translation figure had no definition until one was chosen, since 784 records
carry a translations block but 163 hold only the English name again.

**One number cannot answer two questions, and a threshold hides that it is
trying.** `commonality` scores how well *attested* a movement is, which is what
deduplication needs. The generation pool and the builder's palette read the same
number for something else — is this worth putting in a workout — and `Quad
Stretch` reached the pool on three catalogues listing it. The trap is that the
failure looks like a badly-chosen threshold, so the fix looks like moving it; it
is not. Raising the bar to 5 drops `Sumo Deadlift`, `Face Pull` and `Pistol` and
keeps `Smith Machine Squat`, because there is no cut along "well attested" that
orders "worth writing into a round". **When one score is serving two questions,
separate the questions, not the cut.** The pool now takes the three signals that
are a *judgement* — the corpus writes it, the curator wrote a record, a vendor
tracks a 1RM — and the score is left alone to go on doing dedup.

The same collision had the *strongest* evidence in the whole pipeline coming
last: hand curation is +3 against a bar of 4, so a curated record no corpus
workout happened to use never reached the pool at all. Fourteen did not, while
`Smith Machine Close-Grip Bench Press` did. A weight and a threshold quietly rank
kinds of evidence against each other; naming which evidence answers which
question does not.

**And the shape of the wrong answers is where to look for the rule.** All 77
records the threshold admitted on catalogue evidence alone had **no `pattern`** —
none of them classified as a squat, a hinge or a pull, so `? squat` could never
reach one and they entered workouts only through a bare `?`. That correlation was
sitting in the data the whole time and is what turned a taste argument about
which movements deserve to be there into a statement that can be checked. Found
2026-08-23, queue item 4.

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

**A fix predicted from a debt entry is a hypothesis, not a plan.** Queue item 1
and `builder-ux.md` both said the display bug would close *as a consequence* of
lowering `rx` to a variant: "the load would arrive through `targets` and label
itself with no change to `stepCue`". It would not have. That sentence is true
only when a division has been **chosen**, and neither app ever chooses one — a
fact the same entry states two paragraphs earlier. Building the resolver and
stopping there would have left the board exactly as blank as before, with the
item marked done. The cue needed its own branch, and the branch is four lines.
*2026-08-18.* The correction that generalizes: when a debt says fixing A closes
B, re-derive B's mechanism before believing it, because the entry was written by
someone reasoning forward and the two halves can each be right separately.

**The one file exercising a feature is worth more than the reasoning about it.**
`variants:` appears in exactly one of 190 corpus files, and resolving that file
for the first time found two things no amount of reading had: a variant key
folds to `wallball` where the step it targets is written `100 Wall Balls` and
folds to `wallballs`, so a plain `fold` equality silently left the women's wall
ball at the men's 9kg — and `Ring Row`, spec §10's own movement-swap example,
is absent from the curated registry, so consulting only that registry made the
spec's example unreadable. Neither is visible from the types or the prose.
*2026-08-18.*

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

**A differential test cannot see a defect both sides share, and the silence is
where it hides.** `grammar.test.ts` returned `null` from its reference reader for
"the parser makes nothing of this line", and `null` meant *skip*. So a line
**neither** implementation reads was invisible to it — and invisible to the
round-trip test too, since a line that fails to parse the same way twice is a
perfect fixpoint. The first one found this way: `rest 45 seconds` is an
`unreadable rest duration` error and a rest with no bound, while `45 seconds
Plank` is 45 seconds. Those lines are now listed with a reason and a stale entry
fails, the same contract as the exclusions. *When a test compares two things, ask
what it does with the cases where it cannot compare them — that is where the
answer "both are wrong" gets filed.* Recorded 2026-08-15.

**A rule application is a child even when its body matches nothing.** `headEnd =
~moreHead` consumes no input and yet `headerKind_rounds = integer spaces roundWord
headEnd` has arity **4**, not 3 — Ohm counts the application, not what it matched.
Twenty-four actions were off by exactly one, which is how the shape of the mistake
gave it away. The companion to the rest-parameter note above, and the useful
consequence is the same: the error message states the true arity, so the fix is
mechanical once the pattern is recognized.

**An ordered choice must be ordered by *prefix*, and a second unit list forgot
it.** `schemeUnit` listed `mi` before `min`, so `1..5..1 min` matched `mi`, choked
on the `n`, and the whole ladder fell through to the unrecognized-header
production. This is the exact trap already recorded for the spelled-out units, in
a new list written the same day by the same hand — which is the point worth
keeping: knowing the rule does not stop it, because the ordering constraint lives
between two lines that each look right on their own. Any alternation of literals in
this grammar wants reading longest-first before it is believed. Recorded 2026-08-15.

**Widening where a test draws its input finds more than deepening what it checks.**
The step-line comparison had been green on 748 lines for a day. Pointing it at the
vocabulary's *whole-document* forms as well as its bare step lines — no new
assertions, just more lines — immediately produced `5x5 Back Squat @ 225lb`, which
parses to a movement named `5x5 Back Squat` and is **spec §1's own example** for
"must stay a one-liner". The lines were already written down; nothing had ever fed
them to that comparison. *Before strengthening a check, ask what it is not being
shown.*

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

**A guardrail is only as wide as the failure it was written for.** `src/` is
portable "enforced by a test" — and the test looked for `node:` imports, because
a filesystem import was the failure that existed when it was written. So
`import * as ohm from 'ohm-js'` sat in `src/grammar/` through a fully green
suite, walked into `build/web/core/`, and would have taken the browser down the
moment `parse.ts` imported it. The rule was never "no `node:`"; it was "a browser
must be able to resolve every specifier", and a browser resolves relative paths
and nothing else. Both checks now read *every* specifier and fail on anything
that is not relative. *When a rule is enforced by a test, check that the test
states the rule and not the one instance of it that was in front of someone.*
The wider check found a second thing immediately, and it was a false positive
worth keeping: `env.ts` tells a caller to `import "@wdl/core/node"` in an error
message. Imports are read at the start of a line now — prose about importing is
not importing.

**A vendored file is worth more than an installed one when the consumer has no
resolver.** `ohm-js` was a legitimate dependency of the shipped core and still
could not reach the browser, because `build-web.mjs` does no module resolution
and a browser has no `node_modules`. Copying `ohm.min.js` into
`src/grammar/vendor/` and importing it by path fixed it in the one place, needs
nothing at the other end, and cost the repo its only `npm install`. *Ask not
whether a dependency is allowed but whether every consumer can resolve it.*
Settled while there was exactly one import site: item 0c would have added
several, and a mechanism is cheapest to settle when it is one file wide.

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

**A regex chain is accidentally forgiving; a grammar has to say so out loud.**
Swapping `parse.ts` over to the grammar, one thing got *worse* before it got
better: `10 Thruster,` and `3 rounds,:` stopped parsing at all. The old code
split on commas and handed each piece to a cascade, so an empty piece fell
through to a catch-all and cost nothing; the grammar required a modifier after
each comma, so one stray keystroke made the whole line unreadable and took the
movement, the amount and the block's kind down with it. Nobody had ever written
that tolerance down — it was a property of `String.split`. The fix is a `?` in
two rules and a sentence beside each, and the general shape is the thing worth
keeping: **when replacing a lenient implementation with a stated one, the
leniency you are about to lose is invisible, because it was never a decision.**
Look for it where the old code iterated over pieces rather than matching a shape.
Recorded 2026-08-15.

**Measure the thing someone waits for, not the hot loop.** Ohm is **55× slower**
than the regex chain at the thing it replaced: parsing all 190 corpus files went
from 3.1ms to 172ms. That number is real and it is also almost entirely
irrelevant, because nothing in this project parses in a loop — `wdl check` on one
file went from 0.16s to 0.22s, most of the difference being a one-off 107ms
grammar compile, and the whole test suite from 5.9s to 9.9s. Both numbers are
worth having and only one of them is a cost: had the ratio been the only thing
measured, the swap would have looked unaffordable. The fix if that ever changes
is known and cheap — compile the grammar once and keep it, which `wdl()` already
does within a process, or precompile it across processes. Recorded 2026-08-15.

**A differential test's exclusion list is a to-do list, and then it is nothing.**
Twenty step lines and one header were listed in `grammar.test.ts` as "the two
read these differently, and here is why", each pinned as a vocabulary form. On
the day of the swap every one of the twenty-one cleared, in the way its reason
predicted, and the vocabulary diff was exactly those lines and no others — no
corpus file moved, and `interpretations.json` regenerated to nothing. That is
what the list was for, and it is the strongest argument for writing a
disagreement down instead of shrugging at it. But the same day it stopped being
worth anything: with one implementation, a differential test compares something
to itself and is green by construction. Both halves matter — **pin the
disagreements before the swap, and convert the harness after it**, into coverage
counts and direct assertions on the tree, rather than leaving a test whose name
still says it differentiates. Recorded 2026-08-15.

**A half-applied boundary is worse than the wrong boundary it replaces.** Stopping
a header's `@` target at `for time` fixed `3 rounds @ 95lb for time:` and broke its
comma twin — because the same target rule is reached from two places, and with the
stop applied in only one of them the leftover `for time` had nothing to consume it.
The visible symptom was not a failure but an *unsettled* canonical form: `wdl fmt`
wrote the comma away, and the second pass then read a load and a score the first
pass had lost. That is the exact shape the rx-split defect had, and it is the
argument against scoping a boundary fix to the case that was pinned. **When you
narrow where something stops, find every place it is reached from before deciding
you are done** — a wrong-but-stable reading turning into a reading that changes
under the formatter is a regression even when the new reading is the right one.
Recorded 2026-08-15.

**A rule that differs by position wants a parameter, not a second copy and not one
global answer.** A step's `@` target is prose and runs to the end of its segment; a
header's stops at `for time`. Written globally, a step with a leftover `for time`
would have lost its movement and its amount over a phrase that only means
something one level up — strictly worse than holding it verbatim. Copied, five
rules would have had two versions to keep in step. Ohm takes rule parameters and
they compose with `--` case labels and with existing semantic actions unchanged,
which makes `targetGroup<never>` versus `targetGroup<forTime>` the honest
statement: one rule, read to two boundaries. *Check the arity when you do it — a
parameter adds no child, but the inline `~wordChar` you write beside it adds none
either, where a rule application like `headEnd` would have added one.* Recorded
2026-08-15.

**Ask which caller knows, when a rule works in one position and not another.**
Every spelled-out duration word (`45 seconds`, `2 mins`, `1 hour`) worked in a
step's quantity and in no rest, and it was tempting to read that as the rest line
being under-specified. It was not: `parseDuration` never knew the spellings at all,
and `parseQuantity` folded them on the way in — so the rule reached exactly one
caller and every other position was silently poorer. The fix was to move the fold
*down* into the thing it is a property of. **A capability that exists in one
position and not its siblings is usually a rule living in a caller rather than in
the concept**, and the tell is that the two positions have no reason to differ.
Recorded 2026-08-15.

**Declining a form is not a licence to drop what somebody wrote.** The nested
`score:` block that spec §9.5 documented was settled *against* — it is a third
spelling of a compound score in the notation the whiteboard constraint exists to
avoid. But the decision changed nothing about the actual defect, which was that the
two indented field lines vanished without a word while `wdl check` reported ok. A
form the language declines is still a form somebody typed, and the answer is to
name it and name the spelling to use. **When a decision is "we do not support
this", the work is not finished until the unsupported input is reported** — that
half is owed whichever way the decision goes, so it is not a reason to delay the
decision either. Recorded 2026-08-15.

**A grammar can hold something the AST throws away, and the grammar's own
comment will tell you it does not.** `spec/grammar-0.1.ohm` has said *"Everything
the grammar does not recognize: a production, not a failure and not a guess. Held
verbatim, round-trips, means nothing anywhere"* since the day it was written, and
every word of that was true of the **notation** and false of the **program**: the
semantics pushed the match into `step.notes`, the formatter rendered it, and two
exporters read notes to decide whether a step was a warmup. *When a formalism
"already handles" something, the claim is about what it can express — check
separately what the semantics do with the match, what the formatter writes, and
what downstream reads.* All three were the actual work of queue item 0d; the
grammar file needed no change at all. Recorded 2026-08-15.

**Conflating two things is only cheap until one of them is read.** An unknown
token and an authored `note:` were the same array for the life of the project,
and the argument for it was good: both are free text, neither means anything to
execution. But `notes` was *not* inert — `flatten.ts` and `garmin-connect.ts`
search it for `warmup`/`cooldown` to set a step's intensity role, and for
`ramp …` to recover a power ramp's bounds. So `- 10min Bike, warmup pace`, a
phrase no rule reads, exported to a watch as a **warmup segment**. Nobody added
that meaning to unknown text; it arrived because the container it was put in
acquired a reader later. *Two things in one field is a bet that nothing will ever
read the field for what only one of them is, and that bet is settled by whoever
edits next year.* Recorded 2026-08-15.

**Splitting a field splits its round trip, and the formatter is where that
lands.** Moving unknown text out of `notes` broke something neither the field nor
the parser touched: with a bare phrase after a comma now meaning *unrecognized*,
a note emitted bare came back as an unknown, so one `wdl fmt` demoted something
written for the athlete into something nothing renders. The fix was forced rather
than chosen — unknown text is verbatim by definition, so the bare spelling is the
only one it can have, and the marker has to go on the note. **Ask what the
canonical spelling of each half is before splitting a field**, and note that
which half keeps the bare form is decided by which half *cannot* wear a marker.
The three spellings the grammar reads as notes on their own (`alternating`,
`ramp …`, `wearing …`) kept the bare form, and that list is a rule mirrored in a
caller — checked by writing a note in each spelling out and reading it back,
rather than by comparing the two lists, so it fails whichever side moves.
Recorded 2026-08-15.

**"Inert" is a claim about a specific list, so write the list down and check it.**
The wording for item 0d was *"carries no meaning for execution on the board or
anywhere else"*, which is unfalsifiable until it names the readers: `timeline.ts`,
`run.ts` and `stepCue`, `volume.ts`, `muscles.ts`, `validate.ts`, the exporters,
both apps. Enumerated, it collapsed to **one** decision — `timeline.ts` line 248,
which copies `notes` onto the cue — because every downstream consumer reads the
*timeline*, not the AST. A cue is the choke point, and not adding a field to it is
the whole of "inert". *Find the choke point before auditing the consumers; the
audit is what tells you where it is.* Recorded 2026-08-15.

**A stamp is read in local time, so it must be written in local time.** All four
generator scripts wrote `new Date().toISOString().slice(0, 10)`, which is the
**UTC** date, and this machine is behind UTC — so a run in the evening stamped
tomorrow. Observed on 2026-08-15 producing `"generated":"2026-08-16"`. The
expression looks like "the date" and is only wrong for part of each day, in a
direction that puts the stamp *ahead* of the commit that produced it, which is
exactly the comparison the stamp exists to serve: the note below uses it to
judge whether a registry file has drifted. `toISOString` is the only ISO
formatter on `Date` that is not locale-dependent, which is why four separate
hands reached for it; the local-calendar build is in `scripts/lib/stamp.mjs`
now, one copy rather than four. *An expression that is wrong only between
midnight UTC and midnight local will not be caught by running it and looking —
check it at a fixed instant on the wrong side of the boundary.* Recorded
2026-08-16.

**A generated file with no test drifts, and the drift is invisible because the
file is one line.** `registry/workouts.canonical.json` was stamped 2026-08-13 and
had sat through the parser swap and two rounds of fixes; rebuilding it for item 0d
changed six workouts that had nothing to do with the change. They differed by JSON
**key order** only, so nothing had actually been misread — but that was luck, and
the way to find out was a script that diffs the two parses field by field, because
`git diff` on a single-line 3MB JSON says "1 insertion, 1 deletion" and tells you
nothing. `interpretations.json` and `vocabulary.json` cannot drift like this,
because a test regenerates and compares them on every run. Recorded 2026-08-15.
*Corrected 2026-08-29: `workouts.canonical.json` cannot drift like this either
now — `packages/core/test/workouts-canonical.test.ts` re-runs its deriver and
compares, the same way. The lesson stands: the reflex is to give a generated
file a regenerate-and-compare test, and it took fourteen days and two "fine by
luck" rebuilds to act on it here.*

**A fixture can pin a loss, and a group of fixtures written the same way will
agree with each other about it.** Four `structure` vocabulary forms were written
to pin nesting and every one wrote the nested header as `- AMRAP 3min:` — a form
that appears in no corpus file, no template and no spec example. That spelling
dropped everything under the dashed line, so the snapshot recorded a block's
contents vanishing *as the canonical form*, and the fixpoint check passed on it
because the loss was stable. One of them had been sitting there as
`conditioning:\n  - 3 rounds:s` for as long as the file has existed.

The trap is that a vocabulary file is written in one sitting by one person, so
the forms are not independent witnesses — a habit in how the fixtures are typed
becomes a habit in what is pinned. What found it was a *different* change
(adoption) making the loss compound instead of stable. **When a group of pinned
forms share a spelling, check the spelling against the corpus before trusting
their agreement.** Recorded 2026-08-15.

**Fixing a defect can turn a wrong-but-stable reading into an unsettled one, and
that is a reason to widen the change rather than to narrow it.** Two of the three
things fixed here were not the queue item: the dashed nested block, and a
primary-less score formatting to a bare `score:` that the new rule then read as a
block header. Neither was newly *wrong* — both were wrong before — but adoption
turned each from "loses the same thing every time" into "loses one more thing per
`wdl fmt`". A stable wrong reading can be filed; a compounding one cannot, so the
blast radius of a rule at the input edge is every place something *emits* input.
*Check what the formatter writes, not only what the parser reads.* Recorded
2026-08-15.

**A decision made against invented examples will be wrong about the shape nobody
invented.** The adoption rule (queue item 0b) was settled twice on the day it
landed. Version one had every block header terminate a flat run, and absorbed
every kind of line into the block above it; both were argued carefully, pinned in
the vocabulary, verified in both apps, and **both were wrong on the first real
workout typed into the builder**. That file was *half*-indented — a `For time:`
buy-in whose contents sat at column 0, containing an `AMRAP 20min:` that indented
its own steps, and a trailing `score:` — and it came out as three top-level things
with the score overwriting the for-time's kind.

The examples that decided version one were all *fully* flat or *fully* indented,
because those are the shapes that come to mind when you are reasoning about a
rule. Nobody writes half-indented on purpose; they write it by starting to indent
and stopping, which is exactly what the forgiveness rule exists for. **The corpus
could not see it either** — all 190 files are properly indented, so the whole
class was invisible to 1669 tests and to a regenerated interpretation digest that
came back with zero changes. *Zero corpus movement means the change is safe for
what exists, and says nothing about the input the feature was built to accept.*

The fix in both cases turned out to be a signal already present in the file. A
block that indents its own body was written the ordinary way, so it belongs
*inside* the flat run rather than beside it. And a `score:` is not work, so
adoption — which exists to move work into the block it was written under — has no
business moving it. *When a rule about malformed input has to guess, look for
what the author already did consistently elsewhere in the file before inventing a
tiebreak.* Recorded 2026-08-15.

**Widening a reading can create silence where there was none, and the new silence
is invisible because the change is a fix.** Queue item 0f made a block's kind
readable in any comma position, which is unambiguously more input read than
before. Two things went quiet as a direct consequence, and neither was in the
item:

- `AMRAP 12min, 3 rounds:` had been *reported* — the `3 rounds` was held as
  unknown and noted. Letting the later kind win turned it into a `repeat` still
  carrying the AMRAP's window, which no formatter writes, so the twelve minutes
  vanished with nothing said. A header now takes the **first** kind and holds any
  second, because a second kind is a contradiction rather than a reordering.
- `cap 12min, 3 rounds:` had been reported by a condition that read
  `type === 'sequence' && block.name`, which was exact while an unreadable head
  was the *only* way a block kept a name. Once a comma could supply the kind, the
  same header was a `repeat` with a name — and the report stopped firing while
  `headerText`, which writes a name only for a sequence or a section, stopped
  writing it. One change, two silences, in a diagnostic and a formatter that
  never appeared in the diff.

Both share a shape: a condition that was *equivalent* to the thing it meant, under
an assumption the change removed. `type === 'sequence'` meant "no kind was read";
widening what counts as reading a kind broke the equivalence and left the literal
test behind. **After widening a rule, re-read every condition that was true only
because the rule used to be narrow** — the diagnostics and the formatter first,
since neither is exercised by asking whether the new form parses. What caught
both here was formatting each new form and re-parsing the result, which is a
cheap thing to run over any list of new cases. Recorded 2026-08-16.

**A formatter with a branch no rule reads is a destructive bug, not a cosmetic
one, and fail-open is what hides it.** `headerText`'s clock branch wrote
`every 1min30s x undefined:` for an unbounded `every` and `every 2min for 20min:`
for an E2MOM. Neither is a header the grammar reads — and because an unreadable
header is *held* as a named sequence rather than rejected, each output reparsed to
a sequence with the clock gone and then formatted back to itself. Perfect text
fixpoint, perfect canonical fixpoint, twenty minutes of interval work gone, and
only `wdl check` saying a word.

This is the `@95lb` shape from further up this file, arriving from the other
direction: there a *parser* misreading survived a round trip, here a *formatter*
misspelling does. Fail-open is what makes both of them quiet — a format that
rejected what it could not read would have turned each into a crash on the next
parse. **The property to hold is not "the round trip settles" but "every branch of
the formatter writes something the grammar reads."** Nothing in the suite asked
that: `vocabulary.json` pinned both broken spellings as canonical, with
`fixpoint: true` beside them, for as long as they had existed.

What found them was formatting each newly-pinned form and *re-parsing the result*,
comparing the block field by field rather than comparing text to text. That is a
few lines of throwaway script over any list of new cases, and it is the check that
text-fixpoint testing cannot do on its own. Recorded 2026-08-16.

**A queue item's *reasoning* goes stale the same way its facts do, and the
reasoning is the half nobody re-checks.** Item 0e was found to have been written
against a world that had moved, and the correction recorded then was to re-read
an item against the code before working it. Item 1a went stale in a way that
advice does not catch: its facts were all current — `divisions()` and `resolve()`
existed, `board.js` called neither — and the one thing that was wrong was a
**premise inside an argument**. It left the persistence question open and pointed
at an answer: *"the board already keeps position across a reload, and a division
is the same kind of fact"*. The board does not. `load` ends in `reset`; a reload
restarts the session at cue zero. Thirty seconds in a browser said so, and
nothing in the item's own list of files to touch would have led anyone to look.

The answer came out the same in the end — the division does persist — but by a
different route, and the route is what would have been inherited. The false
premise pointed at *session state*, which on this board is deliberately not kept;
what actually justifies persisting a division is that it is part of *which
reading of the file is on screen*, which is what the hash already carries. Had
the premise been believed, the choice would have gone wherever position was
imagined to live and the share link would never have been considered.

*A claim of the form "X already does Y, so Z should too" is a measurement written
in the past tense. Run it.* Recorded 2026-08-20.

**A figure in prose has to say what it counts, or it cannot be re-checked.** The
roadmap's §G said the registry held *"3148 merged from five sources, of which 181
are marked core and 101 cover the corpus"*. Two of the three had gone stale with
a rebuild — 3120 and 178 — and the third could not be checked at all, because
"cover the corpus" named a *purpose* rather than a query. Nothing in
`movements.canonical.json` counts 101 of anything called coverage: the records a
corpus line actually resolves to are 67 (the `used-in-corpus` signal in
`scripts/mark-core.mjs`), and 101 is the size of the **hand-curated** set —
`sources` containing `wdl-curated`. That set is the descendant of the original
plan's "~150 movements covering the corpus", which is where the word came from,
and it does not literally cover the corpus: 61 of the 67 are curated, 6 came in
from a catalogue.

The stale numbers cost a re-derivation. The unverifiable one cost a dig through
the commit that wrote it — 93bce99, where the registry did hold 3148 / 181 / 101
— to establish that the figure was right and only the noun was wrong. **Write a
figure as the thing that produces it** — "101 carry the `wdl-curated` source",
not "101 cover the corpus" — so the next reader re-runs it in a line instead of
guessing what was meant. It pairs with the arrow convention: arrows
(`3335 → 3148`) for what a run did, bare counts for what is true now, and either
way the sentence names the set being counted. The second half of the fix is
knowing there are two copies: `what-exists.md` **owns** the registry counts and
the roadmap restates them, so a rebuild that moves them has to reach both — this
one had been stale in the roadmap alone since 93bce99. Recorded 2026-08-22.

**A number in prose is either a measurement or a record of a run, and the two go
stale in opposite directions.** `registry/SOURCES.md` carried `3335 → 3148
records` (what the dedup run did — permanently true) two paragraphs above
`Chasing duplicates through 3148 records is diminishing returns` (a claim about
the file as it stands — false the moment the corpus changed). Both are the same
numeral, so nothing distinguishes them by grep, and the second dedup pass landed
inside a commit about *pluralization*: the file that owns the dedup story was
never opened. `3148` stayed on the page for eleven days, and the `variantOf` count
beside it drifted 1108 → 1106 unnoticed.

Two corrections. Prefer arrows for what a run did and bare counts for what is
true now, so the *shape* of the sentence says which kind it is — and when a fix
changes the corpus as a side effect, the owning doc is part of the change, not
follow-up. Present-tense figures against `movements.canonical.json` are cheap to
re-derive; there is no reason for one to be wrong. Recorded 2026-08-23.

**A source has two gates, and the one that costs nothing is the licence.** Strength
Level was researched as a sixth registry source on 2026-08-22. The terms took
four minutes to read and closed it: *Automated Access and API Usage* forbids
automated collection and, by name, access "through APIs that haven't been
officially published", which is exactly what an undocumented `/api/exercises` is.
`robots.txt` said `Allow: /`, and that is the trap worth naming — **a crawl
directive is not a licence**, and reading it as one would have had the whole merge
designed before anything checked whether the data could be used at all.

Two things came out of it that are not about this source.

**The shape of a claim is a second gate, and it is not the same question as
whether the claim is true.** Their `bodypart` is one coarse label from nine
values; every existing source fills `muscleClaims[source] = { primary, secondary
}`, and `mark-core` counts *how many sources* named each muscle. *Legs* maps onto
six of the closed 19, so writing it in as a primary claim on all six would not
merely be imprecise — it would **manufacture agreement**, reading to the scorer
as a sixth source independently confirming what wger said. A coarse claim
recorded in a precise field does not degrade gracefully; it forges a vote. Ask
what *kind* of claim a source makes before asking how good it is.

**A source you decline can still pay, and the payment is a measurement.** The
sweep was run afterwards, deliberately, to price the decision rather than reopen
it. It closed **0** of the 137 muscle-data gaps — predicted near-zero, measured
exactly zero, because the gaps are stretches and mobility and this was a
strength-standards catalogue. But it found **55** names for movements we already
hold that the registry cannot resolve, 24 of them on core movements. The 55 are
`Pulldown`, `Bench`, `Seated Row`, `Pushdown` — gym shorthand any curator writes
unaided from our own titles. **The data was unusable and the measurement was
not**: it sized a hole nobody had sized, and that hole is queue item 8. Comparing
their aliases to ours also threw 52 collisions, a good share of which are
duplicates *inside our registry* rather than disagreements with theirs.

*Declining a source is a decision about its data. It is not a decision about what
looking at it can teach.* Recorded 2026-08-22.

**A CSS rule with a `display` silently overrules `hidden`, and the JavaScript
goes on believing it worked.** The board's `offerDivisions` hides the division
picker on a workout that offers none, `what-exists.md` said it did, and
`builder-ux.md` had nothing against it — and it had been on every workout since
the day it shipped, because `.division { display: flex }` is an *author* rule and
`[hidden] { display: none }` is the user agent's. Author origin wins whatever the
specificity. The bar and the footer had the same bug for longer: an empty board
showed a clock reading 0:00 above the words "drop a file here".

Three things worth keeping from it. **It was invisible to every kind of test this
project has** — the state was right, the attribute was right, and only a rendered
pixel disagreed. **It shipped inside a feature that was verified by driving the
app**: item 1a was checked in a browser on a workout *with* divisions, and the
case that broke was the workout without any, which nobody thinks to open. And the
fix was written twice — first as `.record[hidden], header[hidden], footer[hidden]`,
which is the failure list, then as a single `[hidden] { display: none !important }`,
which is the rule. *A guardrail written as a list of the elements that broke will
be missing the next one.* Recorded 2026-08-23.

**The field named `rounds` is not the rounds.** The board's splits keyed on
`Cue.rounds`, which is what it is called and what it looks like, and recorded no
splits at all for Fran — the one workout the roadmap uses to *illustrate* splits.
`run` fills `rounds` only for a block that repeats, and `21-15-9` does not repeat:
`compile` expands a rep scheme into three explicit tiers, so every cue in Fran
carries an empty round list. Nothing was wrong in the core; the name was a
promise it never made.

What replaced it is not a bigger lookup but a different question — **a round is a
line you have already been on** — which is a fact about the cue list rather than
a reading of a field, and which covers a ladder, a `5 sets:` and a pass of an
AMRAP with one rule. *When a field's name matches the question, check what fills
it before believing it answers it.* Found by running Fran on the board, which is
the only place it could have been found. Recorded 2026-08-23.

**A new check can re-create the noise an old mechanism exists to suppress.**
`progress` was made to report a series where it saw no load at all, since two
zeroes satisfy any ramp. Written per **slot**, it immediately fired on the real
programs: "ramp the pull" found no lats in the push slot or the leg slot — which
is not a silence, it is the slot mechanism *working*, and suppressing exactly
that comparison is why slots exist. The check is right only across the whole
series, where an empty measure really does mean the rule saw nothing.

The suite caught this one, which is the part worth noticing: `program: slots`
exists precisely because that noise was once real, and a test written to pin a
past fix is what stopped a new feature from undoing it. *Before adding a report,
find the mechanism that already decided what is worth reporting, and check the
new one is not arguing with it.* Recorded 2026-08-23.

**The first real record of a thing is where the format finds out what it cannot
write.** `parseDuration` read `1:30` and had for the life of the project.
Nothing needed more, because no workout file states an elapsed hour — a workout
says what to do, not how long it took. The **first result** written for a real
session was a HYROX, whose score is `1:04:19`, and the language could not read
its own example. One regex, two fields to three.

This is the third time a hand-typed real example has found what 1700 tests could
not, and the distribution argument from 2026-08-15 holds exactly: the corpus is
190 *definitions*, so no amount of widening it could have contained an hour-long
finishing time. *A new record type is a new distribution of input, and the
cheapest way to test one is to write a real one.* Recorded 2026-08-23.

**A rule stated as "X is never Y" is worth testing against the corpus before it
is written down, because the corpus is where the exception lives.** Queue item 3
said a cap is not a duration, which is true of nine of the ten capped files and
false of the tenth. `77-tiff.wdl` is a run and then a bare `AMRAP:`, and that
AMRAP takes whatever is left of the cap — so the block ends **at** twenty-five
minutes and twenty-five minutes is its length. A blanket "a cap is a bound"
would have broken a file the suite was already pinning correctly, and the failure
would have looked like a test being wrong rather than a rule being too wide.

The exception was not a special case to carve out; it was the actual rule showing
through. The question is never "is there a cap" but **"does the work inside end
when the work is done, or when the clock is"** — and once it is asked that way
the AMRAP case falls out rather than being excluded. *When a fix needs an
exception list, the rule is probably one question away from not needing one.*
Recorded 2026-08-23.

**Two numbers computed in two places agree until something puts them side by
side.** `run()` sums the cues itself when every one is timed, and that sum never
knew about a cap; `estimate()` in `timeline.ts` had clamped the same case with
`Math.min(total, cap)` since the day it was written. Both had been shipping for
months and neither was ever wrong on screen, because the cap had no row of its
own — so the only visible number was the wrong one, alone, with nothing to
disagree with. Giving the cap a row made `for time, cap 5min:` over eight minutes
of rowing print `duration 8:00` beside `cap 5:00 at most`, two rows contradicting
each other, and that was the first anyone knew of it.

*Adding a display for a value you already had is a way of testing every other
value beside it.* The suite could not have found this: it asserts the two numbers
in two different files, and nothing asked them the same question at the same
time. Recorded 2026-08-23, and it is [the builder pane](builder-ux.md) finding a
core bug for the third time.

**A field that conflates is usually conflating something a layer below it.** The
same cap defect, found independently on a second branch, and what that reading
added is *where* to split. The fix looks like it belongs in `run()`, because
`run()` is where the wrong word was printed — but `run()` was reading
`estimatedSeconds`, and `estimate()` in `timeline.ts` had already thrown the
distinction away, returning `item.cap` for work no clock measures and a real sum
for work it does, through the same `return`. Splitting at the place the wrong
word appears would have left the two values already merged one call down.
*Fix a conflated field where the two values are still apart, not where somebody
noticed.* Recorded 2026-08-23, from the branch whose implementation was not the
one taken — the observation outlived the code.

**A pipeline step that skips a record skips everything on it, including the parts
nothing upstream supplies.** `build-movements.mjs` opened with
`if (m.source === 'free-exercise-db') continue`, which is right for the reason it
was written: those 852 records in `registry/movements.json` are a snapshot of the
import, and their muscles and equipment are re-read from the reference file
rather than trusted twice. But `aliases` is not in the snapshot — no upstream
catalogue has the field — so an alias hand-written onto one of those records was
dropped on the floor. Fifty-eight of the 178 core movements sit on such a record,
so a third of the alias pass would have gone nowhere, silently, and the only
visible symptom would have been aliases that failed to resolve — the exact
failure the pass existed to remove.

The tell was in the shape of the guard, not in the data: it filtered by *where a
record came from* and used that to decide *what to do with all of it*. Provenance
answers the first question and not the second. Aliases are now collected from
those records and applied after every source has been read, and the script says
so where the guard is.

*A `continue` keyed on provenance is a claim that no field on the record is
hand-kept. Check that it is one.* Recorded 2026-08-22.

**An alias that overreaches does not merely fail to resolve — it redirects, and
the redirect travels.** `Air Squat` carried the alias `squat` and `Walking Lunge`
carried `lunge`, both of which are movements the registry holds as records of
their own. The visible cost looked like a two-line duplicate-name problem. The
actual cost was three steps downstream: `link-families.mjs` indexes aliases as
well as titles, in id order, so `air-squat` claimed the key `squat` before the
`Squat` record was reached; wger's squat variation group resolved its member
"Squat" to `air-squat`; the family was named after its shortest member, and the
squat family in `registry/movements.canonical.json` was called **`pistol`**.

Nobody would have found that by reading the family list, because a family named
`pistol` containing fourteen squats is not obviously wrong until you ask why.
It was found by fixing the alias and watching an unrelated number move —
`mark-core` reported 177 instead of 178 — and chasing the one record that
changed.

*The blast radius of a wrong name is every pass that indexes by name.* Recorded
2026-08-22.

**The golden snapshot does not cover muscles, so "the corpus did not move" is
only ever a claim about structure.** `interpretations.json` regenerated
byte-identical across a merge that moved muscle attribution in eight of the 190
corpus files, and `workouts.canonical.json` differed only in its date. Every
habitual check said nothing changed. They were all telling the truth: the digest
in `test/golden/generate.ts` holds shape, seconds, pacing, unbounded and volume
by movement, and muscle attribution is not in it — reasonably, since it is a
digest of how a workout is *understood*, and muscles are a property of the
registry the workout points into rather than of the workout.

Merging two records changes what a name points at, so it moves muscles and
nothing else. That is the one shape of change the snapshot is blind to by
construction, and it is exactly the shape a registry merge has. The diff was
found by attributing the whole corpus twice — `muscleLoad` over every file,
once against the previous `movements.canonical.json` and once against the new
one — which took a throwaway twenty-line script and is the only thing that would
have caught it. Six of the eight moves were improvements and two were a source's
bad claim reaching a workout it had not reached before; reporting "no change"
would have hidden both.

*Ask which digest would have to move for the change you actually made. If the
answer is "none of them", that is not reassurance — it is a gap.* Recorded
2026-08-23.

*Closed the same day: `muscleLoad`'s `byMuscle` is in the digest, so the eight
files that moved would now have moved `interpretations.json` too — verified by
regenerating against the pre-merge `movements.canonical.json`, which produces a
difference in exactly those eight and in nothing else. The by-hand recipe is
gone from [running-it.md](running-it.md). **The lesson is not retired with it**,
because what cost the time was not the missing recipe: it was believing three
green checks that were each answering a question nobody had asked. The next
change of a kind no digest covers will look exactly as clean as this one did.*

**A defect's stated consequence goes stale, and the queue orders itself by the
stale copy.** `Air Bike` sat at the top of item 8 as "the oldest thing on this
list with a corpus consequence: `Air Bike` in a workout gets an abdominal
exercise's muscles". That sentence was true when it was written and stopped
being true a few hours later, on the same day, when `resolve` learned to rank an
explicit alias above a record's own id — `Bike`'s curated `air bike` outranked
the `air-bike` record from that moment, and `check-aliases.mjs` had been
printing the winning `*` on `bike` ever since. No corpus file writes the name in
any case. Regenerating the golden digest after the split moved **not one byte**,
which is the correct result and would have read as a failure to anyone working
from the bullet.

The record was still wrong and still worth splitting — a false `3-sources`
agreement signal is a real defect, and it was blocking a merge — but it was not
the *urgent* one, and it was ranked as urgent because the sentence describing it
had not been re-checked against the code since the day it was written. Two
fixes landing on the same day, each correct, left the second one's write-up
describing a world the first had already changed.

*A consequence written down is a measurement with a date on it. Re-take it
before letting it order the queue — `check-aliases.mjs` and a `grep` of the
corpus were the whole cost here, and both were available the entire time.*
Recorded 2026-08-23.

**A collision that reads as an unavoidable trade-off may be a bad record
wearing a trade-off's clothes.** `air bike` and `assault bike` on `Bike` were
written up together as one finding — the price of a modality lump the registry
cannot express, pinned rather than argued away. They were not one finding. Once
`Air Bike` was split, Garmin's fan bike claimed `quads` primary with
`hamstrings`, `glutes` and `calves` assisting: the same claim, muscle for
muscle, that `Bike` already carried. Nothing would spread and nothing had to be
thrown away, so it merged and the collision closed. What made it look like the
`Assault Bike` case was the *shape* of the pair — a machine name colliding with
the lump that covers it — not anything checked about the record underneath.

*Before writing "neither move is an improvement", check whether the record on
one side is sound. A standoff between two good records is a debt; a standoff
where one side is a false merge is a bug with a debt written over it.* Recorded
2026-08-23.

**A field can be two shapes across one file and every consumer that only ever
saw the common shape stays quiet about it.** `equipment` on 669 of
`registry/movements.json`'s 971 curated entries was a bare string
(`"equipment": "machine"`) rather than the array every other entry, and all of
`movements.canonical.json`, uses — `scripts/build-movements.mjs` normalizes it
on the canonical merge, but the curated seed file itself never went through
that pass. Nothing had crashed on it: the builder's palette reads
`canonicalMovements` (always arrays), and `generate()` defaults to
`canonicalRegistry()` for the same reason, so the one place that reads
`movements.json`'s `equipment` directly — a modifier-affordance panel added
2026-08-25 — was also the first place with no array assumption to protect it,
and even that only breaks for a row that has *both* string equipment *and*
laterality/measures/load data, a combination that happened not to exist yet.
Caught by generating a CSV export for Chris to eyeball, where a string's
characters spread across a joined column read as `m; a; c; h; i; n; e` instead
of `machine` — visibly wrong, the way a `TypeError` in a code path nothing
exercises yet is not. Fixed by normalizing every string `equipment` to a
single-element array in `registry/movements.json`, same shape as everywhere
else.

*A field's shape is only as uniform as its most restrictive consumer has
proven it to be. `?? []` guards against absence; it does not guard against the
wrong shape being present, and a merge step run on a downstream file does not
retroactively fix the seed file feeding it.* Recorded 2026-08-25.
