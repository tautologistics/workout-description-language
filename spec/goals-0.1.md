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

`movements` and `exposures` are different rules. "No more than three shoulder
movements in a session" does not change when you add a round; "no more than
sixty shoulder efforts" does.

Reps are not comparable across movements — a deadlift rep and a sit-up rep both
count as one. Nothing converts reps to load, so `reps` is meaningful for trend
and for balance between similar movements, and misleading between dissimilar
ones. Prefer `movements` when comparing unlike things.

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

`at least` takes a percentage (`+10%`) or an absolute step (`5 reps`), required
from each workout in the block to the next.

## Checking

```bash
wdl goals --goals my-goals.wdlg week1.wdl week2.wdl week3.wdl
```

Files are read as one block in the order given. Session rules are reported per
file; `progress` is reported across the block.

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

**Weights and intensity.** `progress` counts reps because reps are a fact about
the file. Counting load would need a 1RM and a model that turns percentages into
comparable work, and inventing one would make the output look more authoritative
than it is.

**Severity.** Every finding is a finding. Whether a stacked pair of glute
movements matters is a judgement for the person reading, not for the rule.
