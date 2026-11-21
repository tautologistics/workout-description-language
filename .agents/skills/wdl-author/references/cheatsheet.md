# WDL cheatsheet: "I want to express…"

A map into `spec/spec-0.1.md` (in the WDL repo), organized by what
you're trying to say. Every ```` ```wdl ```` example here passes `wdl check`.
`scripts/verify-cheatsheet.sh` re-checks them all, so run it after you edit this
file. If anything here disagrees with the spec, the spec wins.

## Shape of a file

```wdl
@wdl 0.1
@tags conditioning

# Fran

for time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-Up
```

- A line ending in `:` opens a block. A line starting with `- ` is a step.
  Nesting is two-space indentation (§2).
- One step on its own is a valid workout: `- 1mi Run`.
- `//` is a comment, and comments round-trip.
- Sections group blocks and do nothing else: `warmup:`, `strength:`, `skill:`,
  `conditioning:`, `accessory:`, `cooldown:`, or any plain-words label (§5.1).

## Steps (§4)

| I want… | Write |
|---|---|
| reps | `- 10 Thruster @ 95lb` |
| distance / calories / time | `- 400m Run` · `- 15cal Row` · `- 1min30s Plank` |
| sets × reps, one line | `- 5x5 Back Squat @ 225lb` (fmt writes it as `- 5 Back Squats @ 225lb x5`) |
| a rep range | `- 8-12 DB Row (each arm)` |
| as many as possible | `- max Pull-Up` (inside a clock it means "the rest of the interval") |
| at least N, then as many as possible | `- 5+ Back Squat @ 85% TM` |
| timed, but count the reps | `- 2min max Push-Up` |
| timed, but count calories | `- 1min Row, count cal` |
| open-ended (move on when told) | `- Bike, note: "easy"`. Don't write `- Bike easy`: the `easy` becomes part of the movement name |
| end on heart rate / power | `- Bike until HR > 160bpm` · `rest until HR < 130bpm` |
| pick one of | `- 30cal Bike or Row` · `- 800m Run or 25cal Bike` · or a `choice:` block |

## Load, intensity and other targets (§3, §7, §8.2)

| I want… | Write |
|---|---|
| absolute load | `@ 95lb` · `@ 60kg` · `@ 2pood` (a bare `@ 95` means lb) |
| two implements | `@ 2x24kg` (24 kg in **each** hand) |
| percent of a max | `@ 75% 1RM` · `@ 85% 3RM` · `@ 85% TM` |
| bodyweight-relative | `@ 1.5x BW` |
| effort | `@ RPE 8` · `@ RIR 2` |
| by feel | `@ heavy` · `@ moderate` · `@ light` · `@ unloaded` |
| pace / power / HR | `@ 4:30/km` · `@ 2:00/500m` · `@ 5k pace` · `@ 250W` · `@ 90% FTP` · `@ Z2` · `@ 150-160bpm` |
| height / target | `@ 24in` · `@ 20lb to 10ft` |
| tempo | `, tempo 31X1` |
| ramp within a step | `- 10min Bike, ramp 50% -> 75% FTP` |
| men/women loads | `- 10 Deadlift (women 105lb / men 145lb)`, or a `variants:` table (§10) |
| athlete builds the load | `- 2 Front Squat, building` · score `max load` |
| a load from an earlier block | `build to a heavy single in 12min as heavy-single:` then `@ 85% of heavy-single` (§8.3) |

## Laterality and side (§4)

`(each arm)` / `(each leg)` / `(each side)` / `(each direction)` means that
count on every side. `(split)` means the count is shared across sides, and
`alternating` reads as `(split)`. `(both)` means both sides at once. To pick a
side: `, first arm` / `, second arm` / `, right arm`.

## Blocks (§5)

| I want… | Write |
|---|---|
| N rounds | `5 rounds:` (or `5 sets:`, and fmt keeps whichever word you used) |
| N rounds for time | `3 rounds for time:` (`3 RFT:` also reads) |
| for time | `for time:` · capped: `for time, cap 15min:` |
| ladder / rep scheme | `21-15-9:` · `10..1:` · `1..10..1:`, steps with no count take the tier |
| ascending vs descending couplet | put `, reversed` on the step that runs the other way |
| AMRAP | `AMRAP 12min:` |
| EMOM / every N | `EMOM 20min:` · `E2MOM 20min:` · `every 90s x 6:` · `every 3min x 5:` |
| different work each minute | `EMOM 15min:` with `min 1: 12cal Row`, `min 2: …`, `min 3: rest` |
| interval work:rest (Tabata) | `8 rounds:` / `work 20s: Air Squat` / `rest 10s` |
| overrun rule on a clock | `EMOM 20min, cut on overrun:` (`carry` is the default, `fail` ends it) |
| a fixed window, no repeat | `for 12min:` + `- max Run` + `score: distance` |
| buy-in, then AMRAP in what's left | `for time, cap 25min:` + a run + a bare `AMRAP:` |
| superset / complex | `superset:` · `complex, unbroken:` |
| interruption every N (Kalsu-style) | inside `for time:`, a sibling line: `every 1min: 5 Burpee` |
| until failure | `every 1min until failure:` + `- 1 Burpee, +1 each round` |
| any order (a tally of totals) | `any order:` |
| team | `team of 2:` with `shared` / `each` / `synchronized` on the steps |
| partners swap two stations | `partner rotation:` (exactly two steps) |
| max-attempt testing | `3 attempts:` + `score: best` |
| a load or rep per round | `- 1 Burpee, +1 each round` · `- 8 Jump Squat, -1 each round` (**reps only**, see known gaps) |
| shared target for every step | put it on the header: `5 rounds for time @ 155lb:` |
| wearing gear | `for time, wearing 20lb Vest:` |

## Rest (§6, §5.2)

`rest 3min` · `rest as needed` · `rest = work` · `rest 400m Jog` (active) ·
`rest 3min after last`. A trailing rest fires **between** rounds, not after the
last one, except inside a `work Xs:` interval, where it fires every round.

## Scoring (§9)

`score: time` · `reps` · `rounds + reps` · `rounds` · `load` · `max load` ·
`distance` · `calories` · `complete` · `time per round` · `load per round` ·
`min per round` · `sum of blocks` · `best`. For a capped workout, add a sibling
line `on cap: reps`. `reps` is the default, so `fmt` drops it; write it only
when the fallback is something else. For tiebreaks, mark the step `@tiebreak` and add
`tiebreak: checkpoints`. A `score:` nested inside a block belongs to that
block; at the top level it belongs to the workout.

## Worked examples

A strength day with % waves, RPE back-off sets and an accessory superset:

```wdl
# Squat day

warmup:
  - 5min Bike @ easy pace
strength:
  - 5 Back Squat @ 50% 1RM
  - 3 Back Squat @ 70% 1RM
  - 3 Back Squat @ 85% 1RM x3
  3 sets:
    - 6 Back Squat @ RPE 7
    rest 2min
accessory:
  3 sets:
    superset:
      - 10 Romanian Deadlift @ moderate
      - 12 Walking Lunge (each leg) @ 2x35lb
    rest 90s
```

A mixed-modal couplet with a cap and an rx split:

```wdl
# Couplet

for time, cap 12min:
  21-15-9:
    - KB Swing (women 35lb / men 53lb)
    - Bar-Facing Burpee
score: time
on cap: reps
```

An endurance session with pace targets:

```wdl
sequence:
  - 15min Run @ Z2
  6 rounds:
    - 800m Run @ 5k pace
    rest 2min
  - 10min Run @ easy pace
```
