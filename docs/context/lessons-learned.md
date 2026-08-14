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
