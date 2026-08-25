# Goals

## Current Goals

A human-writable format for any workout — endurance, strength, CrossFit
metcons, Hyrox — plus the tools around it.

Built for its author first, and a handful of training partners after. **It is
not competing for adoption**, and no decision should be justified by what
would make the format popular. Two things are the point:

1. **It reads on a whiteboard.** The at-rest format is what you would write up
   before a session and glance at during one. This is a hard constraint. It is
   why the format is not JSON, and why a canonical output that grew braces
   around a compound score was a *bug* rather than a formatting choice.
2. **Workouts can be checked and generated against a stated intent.** "Ramp
   these muscles week over week." "Don't put two movements that hit the same
   thing back to back." This is the larger half, and what the registry and
   analysis layers exist to serve.

Universal coverage and interoperability are means to those, not ends.

**"Not competing for adoption" is not an argument for informality.** It rules
out decisions justified by *popularity* — not decisions justified by rigour.
The syntax must be a clearly and formally defined specification, because that
is the only thing that keeps the language maintainable and manageable as it
matures and grows more complex. That requirement holds whether or not another
pair of eyes ever sets upon it: it is owed to the person maintaining this in
five years, who is the author. Reimplementability by someone else is a side
effect of a good spec, not the reason for one.

*Clarified 2026-08-14, after the original wording was read as licensing a
loose spec — 83 regexes standing in for a grammar were treated as acceptable
because nobody outside was asking for better. That inference was wrong.*

## Pivots

- None recorded. The two things the project is for (whiteboard-readable text;
  checkable and generatable against a stated intent) have held since the
  project's founding documents; see
  [../product_vision_and_roadmap.md](../product_vision_and_roadmap.md) for the
  original framing.

## Non-Goals

- **Universal coverage and interoperability**, beyond what serves the two
  goals above — see the framing above.
- **Conformance suites, third-party implementations.** These matter for a
  format seeking adoption. This one is not.
- **A field per property in the builder.** It would always lag the grammar.
- **Reps → load conversion.** Would need a 1RM and a physiological model that
  would make every number look more authoritative than it is.
- **A file format for palette "sets".** A working preference, not something a
  workout depends on.
- **Strength Level as a sixth registry source.** Its terms of use forbid the
  automated access this would need.
- **Sharing, accounts, a platform.** Deliberately far off — see
  [tasks/deferred.md](tasks/deferred.md).

Full reasoning for each, including the measurements taken before declining
Strength Level, is in [topics/deliberately-not-done.md](topics/deliberately-not-done.md).
Two hard constraints that are never in doubt — whiteboard-readability and
"record corrections rather than editing history" — are stated at the top of
[../../CLAUDE.md](../../CLAUDE.md).
