# Where this project is

Start here, and read on only as far as the task needs.

This directory is the project's memory: what exists, what was learned the hard
way, and what is still open — so a session can start without re-deriving any of
it. It is split by *question asked* rather than by topic, so answering "what is
already built?" does not mean loading the debts, the lessons and the run
commands as well.

*Last updated: 2026-08-23 (134 commits, 1797 tests passing, 1 pending).*

---

## What this is

A human-writable format for any workout — endurance, strength, CrossFit metcons,
Hyrox — plus the tools around it.

Built for its author first, and a handful of training partners after. **It is not
competing for adoption**, and no decision should be justified by what would make
the format popular. Two things are the point:

1. **It reads on a whiteboard.** The at-rest format is what you would write up
   before a session and glance at during one. This is a hard constraint. It is
   why the format is not JSON, and why a canonical output that grew braces
   around a compound score was a *bug* rather than a formatting choice.
2. **Workouts can be checked and generated against a stated intent.** "Ramp
   these muscles week over week." "Don't put two movements that hit the same
   thing back to back." This is the larger half, and what the registry and
   analysis layers exist to serve.

Universal coverage and interoperability are means to those, not ends.

**"Not competing for adoption" is not an argument for informality.** It rules out
decisions justified by *popularity* — not decisions justified by rigour. The
syntax must be a clearly and formally defined specification, because that is the
only thing that keeps the language maintainable and manageable as it matures and
grows more complex. That requirement holds whether or not another pair of eyes
ever sets upon it: it is owed to the person maintaining this in five years, who
is the author. Reimplementability by someone else is a side effect of a good
spec, not the reason for one.

*Clarified 2026-08-14, after the original wording was read as licensing a loose
spec — 83 regexes standing in for a grammar were treated as acceptable because
nobody outside was asking for better. That inference was wrong.*

## What is in here

| File | What it holds | Load it when |
|---|---|---|
| [layout.md](layout.md) | Where everything lives, one line per directory. | Before touching a file, or when looking for where something belongs. |
| [what-exists.md](what-exists.md) | The capabilities that are built, by area. | Asking "does this already work?" before building it again. |
| [not-built.md](not-built.md) | The real holes, and what they block. | Scoping something new, or wondering why a feature stops short. |
| [ready-to-pick-up.md](ready-to-pick-up.md) | The queue: self-contained pieces of work, in order, each with what it touches. | Starting a session with no task named. |
| [builder-ux.md](builder-ux.md) | Defects and gaps caught by driving the builder, by pane. Unordered; dispatchable individually. | Working on the builder UI, or looking for a small self-contained piece. |
| [settled-decisions.md](settled-decisions.md) | Design decisions that are closed, and what each one buys. | About to change how something is structured — check it is not settled first. |
| [lessons-learned.md](lessons-learned.md) | What cost real time, and the correction each one bought. | Before a change to parsing, analysis, the registry pipeline, or anything with a clock. |
| [known-debts.md](known-debts.md) | Things that are wrong and known to be wrong. | Hitting something odd — it may already be written down. |
| [deliberately-not-done.md](deliberately-not-done.md) | Things not built *on purpose*, with the reason. | Tempted by an obvious-looking feature. Check here before proposing it. |
| [running-it.md](running-it.md) | Test, build, serve, and the CLI verbs. | Running anything. |

## Keeping it current

**When something lands, say so in the file that owns the fact** — not here. A
shipped capability belongs in `what-exists.md` and comes *out* of `not-built.md`
or `ready-to-pick-up.md`; a road that cost time belongs in `lessons-learned.md`;
something known-wrong and left that way belongs in `known-debts.md`. The index
changes only when a file is added or the high-level picture moves.

**Record corrections rather than quietly editing history.** The wrong turns are
the expensive knowledge, and a reader who does not know a road was tried will
try it again.
