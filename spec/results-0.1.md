# Results 0.1

A result record says what one person did on one day. It is a separate artifact
from the workout, referencing one, and nothing in it ever appears in a `.wdl`.

That separation is the design, and it is the same one goals are built on. A
workout file is the **class** — what the session is, the same for everyone who
does it, the thing on the whiteboard. A result is an **instantiation**: one
athlete, one date, the weight that was actually on the bar and what the clock
said at the end. One workout has as many results as it has been done.

The split is not bookkeeping. It is what makes "ramp the squat load week over
week" a question anything can answer: the weight a person lifts is a fact about
an execution, so a series of *executions* is what a `progress` rule has to read.
Reps, distance, calories and seconds are properties of the class and are
analysed from the file; load is not, and never was.

## Shape

The same indentation-and-colon shape as a workout, a goals file and a program,
read by the same phase-1 line reader. Extension `.wdlr`.

```
result: crossfit:fran
date: 2026-08-21
athlete: chris
division: women
score: 8:42
splits: 2:50, 3:01, 2:51
notes: grip gave out in round 3

loads:
  - Thruster @ 65lb

snapshot:
  # Fran
  @id crossfit:fran

  for time:
    21-15-9:
      - Thrusters @ 95lb
      - Pull-Ups
```

`//` starts a comment, as everywhere else.

**One spelling for the id, and it is on the head.** `goals:` and `program:` head their
files with a title; a result has no title worth writing, because the workout
already has one, and the fact you want at the top of a log entry is which
workout it is. Fields may also be written indented under the head, and that is
not a courtesy — a `result:` naming no id ends in a colon, so §2 opens a
container and everything after it is inside it.

## Fields

| Field | Means |
|---|---|
| `result:` | the workout id (§1). Optional |
| `date:` | `YYYY-MM-DD`, or `YYYY-MM-DD HH:MM` where two sessions share a day |
| `athlete:` | who did it |
| `division:` | which division was read (§10.1) — the same question `--variant` asks |
| `slot:` | the recurring session this was an instance of. Defaults to the workout id |
| `score:` | what was scored, in the shape the workout declares (§9) |
| `splits:` | per-round times, comma separated |
| `loads:` | what was actually lifted, one `- <movement> @ <load>` per line |
| `notes:` | free text, one line each |
| `snapshot:` | the workout text as it was, indented, held verbatim |

An absent field is absent. Nothing here is defaulted into a claim about somebody
who did not make it.

### Identity

A workout id is any unique string, with an optional namespace prefix separated
by a colon: `crossfit:fran`, `hyrox:open-2026`, or a bare `fran`. Uniqueness is
required only within the repository holding it. **An id is never derived from
content** (§1, roadmap §3.2.1) — a content hash breaks every historical
reference the first time the formatter changes, which is the entire reason this
rule exists.

The id is optional. A workout you wrote this morning has no `@id` and you still
did it: the snapshot is what makes the record self-contained, and the id is what
makes it findable. A record with neither is not a result of anything and is
refused.

### The snapshot

The workout text as it was on the day, indented under `snapshot:` and held
**verbatim** — comments, blank lines and the author's own indentation included.

Verbatim is the point. A snapshot that has been through a parser and a formatter
is a copy of what the formatter thinks *today*, which is exactly the reference
§3.2.1 rejected. It makes the record survive the file being edited, deleted or
unreachable, and it doubles as the version record, which is why nothing in this
format is numbered by revision.

### Loads

```
loads:
  - Back Squat @ 102.5kg
  - Wall Ball @ 6kg to 9ft
```

Written in the step's own spelling, because `@` is where this language already
puts a load on a movement. The value is a load, or a load and a height — the
same pair a `variants:` entry may carry (§10.1), read by the same code.

Matched to steps **by movement, through the registry**, so `Thruster` finds a
step written `21 Thrusters`. A load naming a movement the workout does not
contain is reported and kept; a value that reads as neither a load nor a height
is reported and not applied.

**A movement swap is not read here.** What a division prescribes is part of the
class, because the author wrote it into the file; what somebody substituted on
the day is a modification, and whether modifications want structure or free text
is still open (roadmap §3.2). Until it is settled, a swap goes in `notes:`.

## What the record means, applied

Reading a result against its snapshot produces the **instantiation**: the
workout as this execution ran it. Two layers, in order:

1. the **division**, resolved exactly as `wdl check --variant` resolves it — this
   is reading the file, since the author wrote both weights into it;
2. the **loads**, written over whatever the division prescribed — the file says
   145lb, you did 125lb, and the record of what you did is the one that is true
   of you.

Everything downstream — the timeline, the muscle attribution, the volume, the
goal rules — then reads an ordinary workout and never has to know which layer a
number came from.

## Checking

```bash
wdl result r1.wdlr r2.wdlr                          # each against its own snapshot
wdl result --goals ramp.wdlg r1.wdlr r2.wdlr        # and the series, in date order
```

Per record:

| Reported | Severity |
|---|---|
| the snapshot will not parse | error |
| a `division:` the snapshot does not offer | error |
| an id that disagrees with the snapshot's `@id` | warning |
| a `loads:` entry naming a movement the workout does not contain | warning |
| a `score:` whose shape is not what the workout declares | warning |
| a `loads:` value that is neither a load nor a height | note |
| no snapshot, no date, or no score where one was declared | note |

A score is checked against the primary the workout declares, and against its
`on cap:` where it has one — a capped for-time may honestly be recorded either
way (§9.5). A primary this project has not modelled is not checked at all: an
unmodelled score is a gap here, not a fault in somebody's log.

Across the series, `progress` is the rule that needs results. Records are read
in **date order**, grouped by `slot:` — an ISO date sorts as text, so nothing
constructs a clock and no timezone is involved.

## `measure: load`

The dimension results exist for. See [goals-0.1.md](goals-0.1.md); the essentials:

- It is counted in **kilograms**, converted once, because two loads written in
  different units cannot be compared.
- It is **the heaviest, not the total**, and rounds never multiply it. Three sets
  at 100kg is not 300kg of anything, and §9.1 already reads `score: load` as
  "heaviest successful".
- A **percentage** load contributes nothing: `85% 1RM` is a load only once an
  athlete profile says what the 1RM is (§8.2). So does an unlabelled magnitude —
  `(105/65)` is a real prescription on a whiteboard and not a quantity anywhere
  else.
- A `progress` rule that finds **no load anywhere** in the series says so rather
  than passing, because two zeroes satisfy any ramp.

## Deliberately absent

**A leaderboard.** Ranking results against each other is a platform concern.
This format is what one person writes down.

**Structured modifications.** See `loads:` above.

**Anything the board could measure and did not.** The board writes the record it
observed — the clock, the splits, the passes of a section that repeats — and
leaves what no clock can see to be typed. A plausible number invented there
would be software making something up about somebody's training.
