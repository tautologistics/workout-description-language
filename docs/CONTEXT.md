# Where this project is

The file to read first. It says what exists, what was learned the hard way, and
what is still open — so a session can start without re-deriving any of it.

**Keep it current.** When something lands, say so here. When a belief turns out
to be wrong, record the correction rather than quietly editing history: the
wrong turns are the expensive knowledge, and a reader who does not know a road
was tried will try it again.

*Last updated: 2026-08-13 (58 commits, 1233 tests passing).*

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

## Layout

```
packages/core/src/     the whole language and analysis. Portable — no node: imports.
packages/core/node.ts  the Node host: reads the data files and hands them to src/.
packages/core/node/    the parts that genuinely need a filesystem.
packages/core/bin/     the `wdl` CLI.
apps/builder/          write a workout: palette, outline, text, live goal feedback.
apps/display/          the board: a workout as written, with a marker for where you are.
registry/              movements, muscles, workouts. Rebuilt by scripts/build-canonical.ts.
examples/              corpus (190 workouts), goals, programs, templates.
spec/                  spec-0.1.md (the format), goals-0.1.md (the rules).
docs/                  this file, product_vision_and_roadmap.md, prior art, design notes.
```

## What exists

| | |
|---|---|
| **Format** | Parser, canonical formatter, validator, timeline compiler. 190-workout corpus round-trips. |
| **Interop** | Import: `.zwo`, `.erg`/`.mrc`, FIT. Export: those plus Garmin Connect JSON. Verified against a real watch. |
| **Registry** | 3120 movements merged from five sources, 178 marked core, 2983 with muscle data. Every record names its sources and keeps their claims separately. |
| **Analysis** | Muscle attribution with a closed 19-muscle vocabulary; per-muscle volume; ordering with the repeat-wrap. |
| **Goals** | Five rules — `no repeat`, `cover`, `limit`, `balance`, `progress` — in a separate file. `wdl goals`. |
| **Generation** | `?` holes in a template, filled to satisfy the goals. `wdl generate`, single workout or a whole block. |
| **Programs** | An ordered block with slots. `wdl program`. |
| **Apps** | Builder and board, both running in a browser over the same core. Goals can be written, saved and downloaded from the builder. |

## What is not built

- **Results.** Nothing records what you actually did. `progress` ramps
  *prescribed* volume; whether you finished last week is unknown to it. This is
  the biggest hole and the natural next thing.
- **Sharing, accounts, a platform.** Deliberately far off.
- **Whiteboard photo → WDL.** Interesting, separate project.

## Deliberately not done

- **Tree-sitter grammar, conformance suite, third-party implementations.** These
  matter for a format seeking adoption. This one is not. Revisit only if someone
  outside actually wants to implement it.
- **A field per property in the builder.** It would always lag the grammar, and
  the grammar is the interesting part.
- **Reps → load conversion.** Would need a 1RM and a physiological model.
  Inventing one would make every number look more authoritative than it is.
- **A file format for palette "sets".** A working preference, not something a
  workout depends on. `localStorage` until it earns more.

---

## Things learned the hard way

Each of these cost real time. They are here so they cost it once.

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

## Design decisions that are settled

- **Intent lives outside the workout.** Goals are a separate artifact. The same
  workout is good against one intent and bad against another, which is unsayable
  if the intent is inside the file.
- **Two-phase parse.** `readLines` turns indentation into a tree and knows
  nothing about workouts; phase 2 is an ordinary line grammar over it. This has
  paid for itself three times: workouts, goals and programs are each a grammar
  over the same reader.
- **`src/` is portable and is handed its data.** Enforced by a test. It decays
  the moment one module adds one convenient import, and the Node suite would keep
  passing while the browser broke.
- **The text is the document.** Structural edits splice lines in place rather
  than regenerating from the AST, so comments and spacing survive. Canonicalising
  is a button, never a side effect.
- **The board renders source text, line for line.** Not the parsed structure. If
  the format only works once a program has reformatted it, the format has failed.
- **Movement identity survives spelling.** `fold()` depluralizes, so `Pull-Up`
  and `Pull-Ups` resolve to one record. Pluralization is how a name *reads*.

## Known debts

- Three singular/plural duplicates remain in the registry's long tail
  (`Hindu Push-up`, `Rack Pull`, `Squat with Bands`). Pinned by a test so the
  count cannot grow; none used by the corpus.
- `Quad Stretch` scored into the 178 core movements on source agreement. Visible
  when generating with a bare `?`.
- Templates and workouts share the `.wdl` extension, so `wdl fmt` on a template
  is easy to do by accident.
- A capped for-time workout reports `duration: 12:00` in the builder, which
  reads as "this takes twelve minutes" where it means "you have at most twelve".
  `run` does not expose the cap separately from a computed total, so telling
  them apart needs a core change. Same class as the AMRAP `duration`/`window`
  duplication that Chris caught.

## Running it

```bash
npm --prefix packages/core test     # 1233 tests, no dependencies
node scripts/build-canonical.ts     # rebuild registry/ from its sources
node scripts/build-web.mjs          # emit the core as browser modules
node scripts/serve.mjs 8081         # then open http://localhost:8081/
```

The CLI: `wdl fmt | check | timeline | export | goals | generate | program`.
The server must be rooted at the repository — the apps reach `build/` and
`registry/` from there.
