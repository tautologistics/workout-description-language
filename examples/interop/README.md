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

## Wanted

Other formats that publish a checkable summary alongside the workout:

- `.erg` / `.mrc` — time/power tables; total duration and work are both derivable
- Garmin FIT workout files — step counts and durations, and a binary format worth proving against
- intervals.icu text workouts — durations and training load, and a text format to compare notation against
