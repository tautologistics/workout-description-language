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

## Wanted

Other formats that publish a checkable summary alongside the workout:

- `.erg` / `.mrc` — time/power tables; total duration and work are both derivable
- Garmin FIT workout files — step counts and durations, and a binary format worth proving against
- intervals.icu text workouts — durations and training load, and a text format to compare notation against
- Structured strength programs that publish per-session tonnage (Sheiko is the classic)
