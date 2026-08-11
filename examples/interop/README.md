# Interop corpora

Workouts in *other* formats, used as cross-format oracles.

## Why these are worth more than more `.wdl` files

Everything in [`../corpus`](../corpus) was written by us. These were not: they were authored by
other people, for another tool, before this project existed. Nothing about them was shaped to
suit our parser, and each one carries its own statement of the facts we can check against.

## `zwo/` — 38 Zwift workout files

Source: [bdcheung/zwift_workouts](https://github.com/bdcheung/zwift_workouts).

A `.zwo` file states every segment's `Duration` explicitly. That makes the workout's total
derivable **straight off the XML**, by a computation that shares no code with the parser, the AST,
or the timeline compiler. If the two disagree, one of them is wrong — and the sum is not something
we could quietly bend to match.

[`interop.test.ts`](../../packages/core/test/interop.test.ts) checks three things per file:

1. XML duration sum equals the compiled timeline duration
2. the same holds after a full trip out to canonical WDL text and back
3. the imported workout validates without errors

## `sheiko/` — Sheiko #29, twelve training days

Source: [liftosaur.com/programs/sheiko-29-32](https://www.liftosaur.com/programs/sheiko-29-32), kept
verbatim in [`sheiko-29.json`](sheiko/sheiko-29.json) in Sheiko's own notation — percentage × reps ×
sets, where a missing third number means one set.

The oracle here is **number of lifts**, powerlifting's standard volume measure: reps at or above 50%
of a competition 1RM, on the competition lifts only. It is arithmetic over Sheiko's notation, done
without touching the parser, and the counting rule is a published convention rather than one of ours.

This is the strength-side check the suite was missing. Everything else in the corpus verifies reps
and distance; percentage-based loading had no external oracle at all.

Week totals come out at 243, 239, 225, and 233 competition lifts, against Sheiko's documented
200–400 per week.

## `erg/` — 24 ERG and MRC courses

Source: [GoldenCheetah](https://github.com/GoldenCheetah/GoldenCheetah) test workouts.

A course is a list of `(minute, target)` breakpoints, so the workout's length is literally the last
timestamp — a number sitting in the file, readable with no structural interpretation at all.
`.erg` gives absolute watts, `.mrc` a percentage of FTP.

This oracle caught a precision bug immediately: rounding each segment independently accumulated a
second or two of drift across a long workout, so the totals no longer matched the file. Rounding
each breakpoint to absolute seconds once and taking differences makes the segments telescope back
to exactly the final timestamp.

## `fit/` — 4 Garmin FIT workout files

Source: the Garmin FIT SDK examples, via
[dtcooper/python-fitparse](https://github.com/dtcooper/python-fitparse) test fixtures.

Binary and self-describing: definition records declare each message's fields and widths, and data
records follow that layout. Only `workout` (26) and `workout_step` (27) matter, so no SDK is needed.

Three independent checks come out of the file itself:

- **`message_index` must come back contiguous** — any misread field width desynchronises the record
  stream and breaks the sequence, so this validates the binary walk without interpreting anything
- **`num_valid_steps` equals the work steps**, excluding repeat markers — consistent across all four
- **expanded step count** — a `repeat_until_steps_cmplt` names the index it jumps back to and how
  many times, so the leaf-step total is derivable from raw fields

## Not added: intervals.icu

Deliberately. Its text format is well documented, but a workout is *only* a prescription — the file
publishes no summary of itself. Checking it would mean comparing our reading against our reading,
which is the trap this directory exists to avoid. Every source here states a number we did not
compute: Zwift a `Duration`, ERG a final timestamp, FIT a step count, Sheiko a number of lifts.
Format diversity without an oracle is not worth the entry.

## Wanted

Other formats that publish a checkable summary alongside the workout:

Sources that publish a checkable summary alongside the workout:

- TrainingPeaks or similar structured libraries that publish TSS per workout
- Concept2 logbook standard test protocols with published pace and distance tables
- CrossFit Open leaderboards, which publish the maximum rep count per workout
