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
