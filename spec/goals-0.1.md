# Goals 0.1

A goals file states what a workout is *for*. It is a separate artifact from the
workout, supplied alongside it, and nothing in it ever appears in a `.wdl`.

That separation is the whole design. A workout file is meant to be read on a
whiteboard mid-session, where the only useful content is what to do next. Why
you wrote it that way is a different question, asked at a different time, and
the same workout can be good against one intent and bad against another —
which is impossible to say if the intent is buried in the file. Goals are also
the input to generation: the rules a workout must satisfy are the rules a
generator works backwards from.

Goals are checked, never enforced. A finding says what a rule noticed; it does
not make a file invalid.

## Shape

The same indentation-and-colon shape as a workout, read by the same phase-1
line reader. Every rule is a header naming its kind, and a body of `key: value`
lines. Rules may sit at the top level or under a `goals:` header with a title.

```
goals: Rotate the muscles, don't stack them

  no repeat:
    level: primary
    gap: 1
    except: forearms, abs, obliques, erectors

  cover:
    regions: upper, core, lower
    at least: 2 movements
```

`//` starts a comment, as in a workout file.

## Targets

`muscles:` and `regions:` both take a comma-separated list. Each name becomes
its own group:

- `muscles: lats, chest` — two groups, and the bound applies to each.
- `regions: upper` — one group of every muscle in the region, and the bound
  applies to the region's total.

That is what each phrasing reads as. Conflating them makes "cover the upper
body" demand that the neck be worked.

A group is counted over the *steps* that touch it, once each — not summed over
its muscles. A 400m run works four muscles below the waist; the lower body ran
400 metres, not 1600.

The muscle names are the ids in `registry/muscles.json`. Regions are `upper`,
`core`, `lower`. An unrecognised name is an error, not a silently dropped rule.

## Dimensions

| Dimension | Means |
|---|---|
| `movements` | steps in the written order that touch the group |
| `exposures` | the same, with rounds multiplied in |
| `reps` | reps, rounds included |
| `seconds`, `metres`, `calories` | likewise, for steps measured that way |
| `load` | the heaviest load on the group, in kilograms — see below |

`movements` and `exposures` are different rules. "No more than three shoulder
movements in a session" does not change when you add a round; "no more than
sixty shoulder efforts" does.

Reps are not comparable across movements — a deadlift rep and a sit-up rep both
count as one. Nothing converts reps to load, so `reps` is meaningful for trend
and for balance between similar movements, and misleading between dissimilar
ones. Prefer `movements` when comparing unlike things.

**`load` is the odd one and is odd in three ways**, each of which is the honest
answer rather than the consistent one:

- **It is not a total.** Every other dimension adds up; a sum of loads is not a
  quantity, since three sets at 100kg is not 300kg of anything. It is the
  *heaviest* load on the group, and rounds do not multiply it. §9.1 already
  reads `score: load` as "heaviest successful".
- **It is in kilograms**, converted once, because two loads written in different
  units cannot be compared. A bound may be written either way: `at least: 10lb`
  is read as 4.54kg.
- **It is mostly a question about a result**, not about a file. See below.

## `level`

`level: primary` (the default) counts only the muscles a movement is *for*.
`level: any` also counts the ones it demands in passing. Primary is the right
default for sequencing: nearly everything demands grip and trunk, and a rule
counting those fires on every pair of movements ever written.

## Rules

### `no repeat`

No muscle worked by two movements close together.

| Key | Default | Means |
|---|---|---|
| `level` | `primary` | which muscles count |
| `gap` | `1` | how many exposures must separate two uses |
| `except` | none | muscles the rule ignores |

`gap: 1` means not adjacent. A repeating block wraps: its last movement runs
immediately before its first again, and the rule sees that. Movements inside an
`any order:` block are not before or after each other at all, so the rule says
nothing about them.

`except` matters more than it looks. Without exempting grip and trunk, `level:
any` fires on almost every pair, and a rule that can never be satisfied is one
nobody reads twice.

### `cover` / `limit`

A floor and a ceiling on how much a group receives.

```
cover:
  regions: upper, core, lower
  at least: 2 movements

limit:
  muscles: shoulders
  at most: 3 movements
```

### `balance`

Two or more groups held in proportion.

```
balance:
  between: upper, lower
  within: 25%
  measure: movements
```

`within` is how far the smallest may fall below the largest.

### `progress`

The only rule about a series rather than a session. Checked across files in the
order given; a single file cannot be checked against it at all.

```
progress:
  muscles: lats, mid-back, biceps
  at least: +10%
  measure: reps
```

`at least` takes a percentage (`+10%`) or an absolute step (`5 reps`, `2.5kg`),
required from each workout in the block to the next.

`measure: load` reads a load wherever one is written, but ramping it across
*files* is rarely the question — the same file every week is the point, and the
weight that changes is recorded on a **result**. See *What is deliberately
absent* below.

## Checking

```bash
wdl goals --goals my-goals.wdlg week1.wdl week2.wdl week3.wdl
```

Files are read as one block in the order given. Session rules are reported per
file; `progress` is reported across the block.

A fault that recurs is stated once with a count. A ten-tier ladder repeats its
structure ten times, and reporting one structural fault ten times buries the
other nine faults in the file.

Two things are reported alongside the findings, because every number inherits
them:

- **Unresolved movements.** A movement no source has muscle data for is invisible
  to every rule. It is named rather than passed over.
- **Open-ended workouts.** In an AMRAP or an until-failure block, the contents
  are counted once, so every amount is a floor rather than a figure.

## What is deliberately absent

**Equipment, time and space.** Real constraints, but not muscle constraints, and
adding them before the muscle rules have been used in anger would be guessing at
what is needed.

**A model that turns intensity into comparable work.** *This section read
"weights and intensity" until 2026-08-23, and the objection it recorded is
intact — it was just wider than the thing it ruled out.*

A **percentage** load is still absent, for exactly the reason given then: `85%
1RM` is a load only once an athlete profile says what the 1RM is, and inventing
one would make the output look more authoritative than it is. So is an
unlabelled magnitude — `(105/65)` is a real prescription on a whiteboard and not
a quantity anywhere else. Neither contributes to `measure: load`, silently and
by construction.

What is now present is the **absolute** load, which needs no model at all: it is
a number of kilograms somebody actually lifted. And it is mostly a fact about an
*execution* rather than about a file — a workout is a class and the weight on
the bar is not part of it — so "ramp the squat week over week" is asked of a
series of **results**, not of a series of workout files:

```bash
wdl result --goals ramp-the-squat.wdlg week1.wdlr week2.wdlr week3.wdlr
```

See [results-0.1.md](results-0.1.md). A load the *author* wrote into the file is
read where it is written, because that one was stated in the file — which is the
same exception that makes divisions resolve at the workout layer (§10.1).

A `progress` rule that finds **nothing anywhere** in the series reports that
rather than passing: two zeroes satisfy any ramp, and a ramp reported as met
when nothing was measured is the worst answer available.

**Severity.** Every finding is a finding. Whether a stacked pair of glute
movements matters is a judgement for the person reading, not for the rule.

## Generating

The rules a workout must satisfy are the rules a generator works backwards
from. A **template** is an ordinary workout file with `?` where a movement
would go:

```
# Generated metcon
5 rounds for time:
  - 12 ? squat
  - 10 ? pull
  - 15 ? push
  - 200m ?
```

```bash
wdl generate --goals rotate-muscles.wdlg --equipment "dumbbell,pull-up bar" templates/metcon.wdl
```

The structure — rounds, rep schemes, loads, rests — stays the author's. Only
the movements are chosen. Deciding how hard a workout should be is a judgement
about the athlete; deciding what not to put next to what is a mechanical
question the rules already answer.

What follows the `?` narrows the choice. A token is read as a muscle first,
then a region, then a movement pattern — so `? lats` wants a movement that
works them, `? lower` anything below the waist, and `? pull` both the vertical
and horizontal kinds. Several tokens all have to hold.

Two constraints apply without being asked for. A step in metres needs a
movement that reports metres, and a step in reps rules out the movements
counted by ground covered — nobody does ten reps of a run.

`--seed` changes the answer and repeats it: the same template, goals and seed
always give the same workout, and a different seed gives a different one.

`--equipment` restricts the pool. **A movement with no equipment declared is
excluded**, not assumed to be bodyweight — bodyweight is declared explicitly.
An absent field is not a claim, and reading it as one put a sandbag carry in a
workout generated for a dumbbell and a pull-up bar.

### When it cannot

Generation reports its failures rather than hiding them in a plausible-looking
workout:

- A hole no candidate fits comes back as a hole, with the constraint named.
- When no complete assignment satisfies every rule, the least-bad one is
  returned along with the rules it breaks — a workout you can judge beats a
  refusal.
- A workout that still has holes in it reports **no** findings, because the
  rules were judged against something other than what was asked for.

## Session rules and block rules

`cover`, `limit` and `balance` take `per: session` (the default) or `per: block`.

A floor on pushing volume is usually a statement about a training block — "don't
let the push drop while ramping the pull". Asked of every session it fires on
leg day, which was never going to have any pushing in it.

```
cover:
  muscles: chest, shoulders
  at least: 100 reps
  per: block
```

`no repeat` is always a session rule. Order only exists inside a session; the
last movement of Monday does not run before the first movement of Thursday.

## Programs

A program is an ordered block of training and the goals it is built against. It
names its workouts rather than containing them, so each stays a file you can
format, check and send to a watch on its own.

```
program: Winter build
goals: ../../goals/ramp-the-pull.wdlg

week 1:
  - pull: w1-pull.wdl
  - push: w1-push.wdl
  - legs: w1-legs.wdl

week 2:
  - pull: w2-pull.wdl
  - push: w2-push.wdl
  - legs: w2-legs.wdl
```

```bash
wdl program winter-build.wdlp
```

Paths resolve against the program file's own directory, so a program moves with
its workouts.

**The slot names are the point.** `pull`, `push`, `legs` — `progress` compares a
session to the last session in the same slot and to nothing else. Without them,
"ramp the pulling volume" compares this week's pull session against this week's
leg session, notices the pulling has collapsed, and reports a failure that is
really just the observation that leg day is not pull day. On the example block
that is nine spurious findings against none.

Slots are optional; unnamed entries are numbered by position, which is right for
a block that is genuinely one session repeated.

Cycle labels — `week 1`, `block A`, `Monday` — are yours. Nothing reads them but
you; the order they appear in is what counts.

### Generating a block

A program whose entries are templates can be filled all at once:

```bash
wdl generate --program ramp-block.wdlp --seed 2 -w
```

**Holes in the same slot and the same position are one decision**, however many
cycles the block runs. Generating week 1 and week 2 of the pull session
independently gives them different movements, and a `progress` rule on the lats
then measures an accident rather than a plan. Six sessions with two holes each,
across two slots, is four choices — not twelve.

Every rule applies: session rules to each workout, `per: block` rules to the
whole, and `progress` within each slot. So the block that comes out has a ramp
in it because the ramp was asked for.

Without `-w` the filled workouts go to stdout with their paths; with it they are
written back over the templates.

Generating against a program with no readable goals is refused rather than
silently producing first-fit workouts.
