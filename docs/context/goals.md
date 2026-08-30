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

- **2026-08-30 — a hosted instance with lightweight accounts is now in scope.**
  Chris asked to deploy the apps to a public URL on his DreamHost VPS, backed by
  PocketBase for Google sign-in and saved/shared workouts, "as soon as possible"
  because *"that will help steer and discover things for this work"* — real UX
  feedback from himself and a few training partners, which the dev-server-only
  setup cannot give. This reverses the *"Sharing, accounts, a platform"*
  Non-Goal below, which had been gated on "the goal itself changes". **The two
  things the project is for are unchanged** (whiteboard-readable text;
  check/generate against intent), and *"not competing for adoption"* still
  holds — this is a handful of known users on one small instance, not a
  platform play. Nothing about it touches `packages/core`, the grammar or the
  spec: a stored workout is its `.wdl` source text in a column. Queue items
  18–20 in [tasks/current.md](tasks/current.md);
  [DEC-016](topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage) for the host/auth choice.
- The two things the project is for (whiteboard-readable text; checkable and
  generatable against a stated intent) have held since the project's founding
  documents; see
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
- **An authored file format for palette "sets".** A working preference, not
  something a workout depends on. *Narrowed 2026-08-28: a plain JSON
  backup/transfer file for the `localStorage` repertoire now exists; what stays
  declined is a set as its own authored artifact with a grammar. See
  [topics/deliberately-not-done.md](topics/deliberately-not-done.md).*
- **Strength Level as a sixth registry source.** Its terms of use forbid the
  automated access this would need.
- ~~**Sharing, accounts, a platform.**~~ *Reversed 2026-08-30 — see "## Pivots"
  above and [DEC-016](topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage). A hosted instance
  with Google sign-in and saved/shared workouts is now queue items 18–20. What
  stays declined is a *platform* — public signup at scale, discovery, anything
  justified by adoption; the hosted instance is for the author and a few
  training partners.*

Full reasoning for each, including the measurements taken before declining
Strength Level, is in [topics/deliberately-not-done.md](topics/deliberately-not-done.md).
Two hard constraints that are never in doubt — whiteboard-readability and
"record corrections rather than editing history" — are stated at the top of
[../../CLAUDE.md](../../CLAUDE.md).
