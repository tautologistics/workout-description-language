# Current State

*Last updated: 2026-08-25 (136 commits, 1800 tests passing, 1 pending). Every
numbered queue item raised so far is closed — see
[current/next-steps.md](current/next-steps.md).*

## Working State

Parser, canonical formatter, validator, and timeline compiler all round-trip a
190-workout corpus. Import/export covers `.zwo`, `.erg`/`.mrc`, FIT and Garmin
Connect JSON. The registry merges 3112 movements from five sources, 128 in the
curated generation pool. Analysis covers muscle attribution, per-muscle
volume, and five goal rules across six dimensions including `load`. Both apps
(builder, board) run in a browser over the same core; the board now writes a
`.wdlr` result when a session ends, runs a cap as a clock, and both apps draw
a body map (front and back) of what a workout hits. Full detail, by area, is
in [topics/what-exists.md](topics/what-exists.md) — read that before building
something again.

## Active Work

There is no persistent "in progress" state between sessions — work is
whatever sits at the top of the queue.

-> [current/active-work.md](current/active-work.md)

## Blockers

Known debts, accepted risks, and open questions that affect near-term work.

-> [current/blockers.md](current/blockers.md)

## Recent Material Changes

-> [current/recent-changes.md](current/recent-changes.md)

## Immediate Next Steps

-> [current/next-steps.md](current/next-steps.md)
