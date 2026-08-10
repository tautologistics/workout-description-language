# Workout Definition Language — Specification 0.1 (Draft)

**Status: draft.** First notation for the semantic model in [product_vision_and_roadmap.md](../docs/product_vision_and_roadmap.md) §2, which was tested against 40 real workouts in [falsification-corpus.md](../examples/falsification-corpus.md). This document proposes syntax for all of it, including the two subsystems the corpus flagged as underspecified: **scoring** (§9) and **expressions** (§8).

The test of this draft is §13 — the hardest workouts in the corpus, written out. If any of them reads badly, the notation is wrong, not the workout.

File extension `.wdl`. Files may declare `@wdl 0.1`.

---

## 1. Design rules

Restating from the spec development plan, because they decide every question below:

1. **Looks like a whiteboard.** Where a convention exists, formalize it rather than inventing syntax.
2. **Forgiving on input, strict on output.** Accept the many ways people write things; emit exactly one.
3. **Default to the common case; say what it is.** Where a dominant convention exists, take it as the default, document it explicitly here, and have canonical output state it. Where no dominant convention exists, the parser asks rather than picking (§12). Defaulting and never-guessing are the same rule applied to different inputs: a convention everyone shares is not a guess, and stating it in canonical output means it is only ever decided once.
4. **Progressive disclosure.** `5x5 Back Squat @ 225lb` must stay a one-liner. Complexity only appears when the workout is complex.
5. **Structure and prescription are separate.** Containers control flow; steps describe work.

---

## 2. File structure

```wdl
@wdl 0.1
@id crossfit:fran
@date 2026-08-09
@tags conditioning, benchmark

# Fran

for time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-Up

score: time
```

- **Directives** (`@key value`) carry metadata and identity. All optional. `@id` is any unique string with an optional `namespace:` prefix; it must be unique within the repository holding the file, and is never derived from the file's contents (roadmap §3.2.1).
- **Title** is a single `#` heading. Optional.
- **Body** is one or more blocks, or a bare list of steps — a single-step workout (`- 1mi Run`) is a valid file.
- **Sections** (optional) group blocks: `warmup:`, `strength:`, `conditioning:`, `accessory:`, `cooldown:`, or any custom label.

Nesting is by indentation (two spaces canonical). A line ending in `:` opens a block. A line beginning with `- ` is a step. `//` begins a comment, which survives round-tripping.

---

## 3. Units

**The `m` problem.** `m` means metres in a distance position and minutes in a duration position, and relying on position is fragile. Resolution: **canonical output always writes `min` for minutes and `m` for metres.** Input accepts `m`, `min`, `mins`, and `minute(s)` wherever a duration is expected.

| Kind | Canonical | Also accepted |
|---|---|---|
| Reps | `10` | `10 reps`, `10x` |
| Distance | `400m` `1km` `1mi` `50ft` `25yd` | `400 meters`, `1 mile` |
| Duration | `12min` `1h` `1min30s` `45s` | `12m`, `90s`, `1:30`, `90 sec`, `10` (in a duration position) |
| Calories | `15cal` | `15 calories`, `15c` |
| Load | `95lb` `60kg` | `95#`, `95 lbs` |
| Paired load | `2x24kg` | `2 x 24kg`, `24kg each hand` |
| Relative load | `75%` `80% 1RM` `85% TM` `1.5x BW` | `75 percent` |
| Effort | `RPE 8` `RIR 2` | |
| Pace | `4:30/km` `2:00/500m` `7:00/mi` `5k pace` | `threshold pace`, `marathon pace` (§8.2) |
| Power | `250W` `90% FTP` | |
| Heart rate | `150-160bpm` `Z2` | |
| Height | `24in` `50cm` | `24"` |
| Tempo | `31X1` | |

**Durations decompose into the largest units that express the value exactly.** Ninety seconds is written `1min30s`, not `90s`; forty-five seconds stays `45s`. One rule, no threshold — the alternative (seconds below some cutoff, decomposed above) is an arbitrary line that gets forgotten. Both spellings parse.

**Paired loads state the arity in the notation itself.** `@ 2x24kg` is 24kg in *each* hand — two implements, 48kg carried — and `@ 24kg` is a single implement or a barbell. The number is never inferred from the movement's name, so a step parses correctly whether or not the movement is registered; registry metadata only enables validation ("this movement takes a per-implement load — did you mean `2x24kg`?") and correct volume math.

Units never convert silently. A file written in `kg` stays in `kg`; display conversion is a tool concern.

---

## 4. Steps

```
- 10 Thruster @ 95lb
- 400m Run
- 15cal Row
- 90s Plank
- 8 Front Squat @ 135lb, tempo 31X1
- 14 DB Curl each arm
```

Shape: `- <quantity> <Movement> [<inline qualifier>]* [@ <target>]* [, <qualifier>]*`

**Laterality, side, and team words are written inline, without a comma.** They read as part of the prescription rather than as modifiers of it — `14 DB Curl each arm`, not `14 DB Curl, each side`. Everything else (tempo, `count cal`, `+3 each round`, notes) follows a comma. Both forms parse; canonical output uses the inline form for those three and commas for the rest, and preserves the limb noun the author wrote.

**Completion conditions** (exactly one per step): reps, distance, calories, duration, `open`, `max` (the remainder of the enclosing clock — see §5.5), or `N+` meaning at least N then as many as possible.

```
- 5+ Back Squat @ 85% TM       // 5/3/1 final set
- max Pull-Up                   // remainder of enclosing clock
- Bike easy                     // open — advance when told
```

**What ends a step and what a step measures are different facts.** Every step in Fight Gone Bad completes on the clock, yet the workout scores reps and calories — `1min Row` ends on duration and *measures* calories. So a step carries an optional **measured output** that scoring reads (§9.3), independent of its completion condition:

```
- 1min Row, count cal
- 1min Wall Ball @ 20lb        // measures reps; the default
```

The measured output defaults to reps for a rep-completed step, and to the step's own quantity for a distance- or calorie-completed one. For a duration-completed step it defaults from the movement's registry `measures` where present; where neither resolves, the parser asks rather than assuming (§12).

**A side selector is separate from a counting mode.** Counting modes (below) say *how to count*; a side selector says *which limb does the work*. Open 24.1 needs the latter — 21 snatches on one arm, then 21 on the other:

```
- 21 DB Snatch @ 50lb, first arm
- 21 DB Snatch @ 50lb, second arm
- 10 Single-Arm Row @ 70lb, right arm
```

`first arm` / `second arm` matter because 24.1 deliberately lets the athlete choose which comes first. When a side selector is present the count applies to that side, so no counting mode is needed.

**Laterality** follows [movement_registry_design.md](../docs/movement_registry_design.md) §6. Three modes, always explicit in canonical output when the movement admits more than one. A registry entry *may* declare a default; where it doesn't — including for unregistered movements — the prescription must say, or the parser asks (§12). A missing fact produces a question, never a silent assumption about how many reps someone did.

```
- 14 DB Curl (split)       // 7 per arm — the count is divided across sides
- 14 DB Curl each arm      // 14 per arm, 28 performed
- 14 DB Curl (both)        // 14 reps, both arms simultaneously
```

**`alternating` is not a counting mode.** It names a specific execution pattern — strict left-right-left — and `10 Pistol` more often means five on one leg then five on the other. Both distribute the same count across two sides, so they cannot be different counting modes; alternation is a pattern layered on top, and which pattern the athlete uses changes nothing about the score, the volume, or the display.

So `alternating` / `alt` are accepted on input, map to `(split)`, and are preserved verbatim as a note for the human reading it. This is the same treatment team alternation gets (§5.11) and the same discipline as "one athlete works at a time": execution strategy is recorded, not structured.

---

## 5. Containers

### 5.0 Block headers and modifiers

Modifiers compose on a single header, because that is how workouts are actually written — `3 rounds for time:` for Helen, `5 rounds, building:` for the Bear Complex, `for time, cap 15min:` for any Open workout. Order is free on input; canonical output orders them structure → scoring → cap → qualifiers.

A header has exactly one colon, the one that opens the block. Modifiers are comma-separated words or phrases before it, never `key: value` pairs.

**Targets and equipment may sit on the header and are inherited by the steps inside.** A step's own target always wins; the block's applies otherwise.

```wdl
5 rounds for time @ 155lb:      // DT — the load is stated once
  - 12 Deadlift
  - 9 Hang Power Clean
  - 6 Push Jerk

for time, wearing 20lb Vest:    // Murph
  ...
```

Canonical output **preserves inheritance as authored** — it neither hoists a repeated target onto the header nor expands an inherited one onto every step. Hoisting would fight the author's intent, and expanding would recreate exactly the verbosity this exists to remove. The AST records each step's effective value along with the fact that it was inherited, so round-tripping stays honest.

### 5.1 Sequence

The default. A block with no header runs its steps in order.

### 5.2 Repeat

```
5 rounds:
  - 400m Run
  - 21 KB Swing @ 53lb
  - 12 Pull-Up

5 sets:
  - 5 Back Squat @ 225lb
  rest 3min
```

`rounds` and `sets` are synonyms; canonical output preserves whichever the author used, since coaches mean slightly different things by them.

**Trailing rest fires between rounds, not after the last one.** `5 sets: [5 Back Squat] rest 3min` is four rests, not five — you finish the fifth set and move on, which is the common case by a wide margin. To rest after the final round, say so:

```
5 sets:
  - 5 Back Squat @ 225lb
  rest 3min after last
```

The question doesn't arise in a clock-driven container (§5.5), where the cadence governs and Tabata's final ten seconds is part of the interval rather than a trailing step.

### 5.3 Rep scheme (ladder)

```
21-15-9:
  - Thruster @ 95lb
  - Pull-Up
```

**A rep scheme is sugar.** It desugars to a repeat whose per-round rep count comes from the list, applied to every step lacking its own quantity. Open 25.2 proved this must be sugar rather than a primitive — it looks like `21-18-15` but changes movement *and* load per tier, so it's written as an explicit sequence instead (§13.25).

### 5.4 Time-boxed repeat (AMRAP)

```
AMRAP 12min:
  - 10 Wall Ball @ 20lb
  - 8 Toes-to-Bar
```

Repeat contents until the clock expires. Default score is `rounds + reps`.

### 5.5 Clock-driven repeat

One container covers EMOM, intervals, Tabata, and swim send-offs — the corpus's clearest unification.

```
EMOM 20min:
  - 12cal Row

every 2min x 10:
  - 5 Power Clean @ 155lb

every 90s x 6:
  - 2 Front Squat, building

every 3min x 5:
  - 400m Run
  - max Pull-Up

8 rounds:
  work 20s: Burpee
  rest 10s
```

Contents start on the stated cadence regardless of when work finished.

**Cycles** — different work on different intervals:

```
EMOM 15min:
  min 1: 12cal Row
  min 2: 10 DB Snatch (split) @ 50lb
  min 3: rest
```

**Overrun behaviour must be declared** (corpus finding; review item A4). Default is `carry`, and canonical output always states it. Modifier keywords never take a colon of their own — a block header has exactly one, the one that opens it:

| Mode | Meaning |
|---|---|
| `carry` | Unfinished work bleeds into the next interval; the clock does not reset |
| `cut` | Unfinished reps are abandoned; the next interval starts clean |
| `fail` | Failing to finish ends the workout (`EMOM 20min, fail on overrun:`) |

### 5.6 Cap

```
for time, cap 15min:
  ...
```

Wraps any container. On expiry the workout ends; scoring follows §9.5.

### 5.7 Superset and complex

```
superset:                      // no rest between elements
  - 8 Bench Press @ 185lb
  - 12 Bent-Over Row @ 135lb

complex, unbroken:             // load carried across, bar never grounded
  - 1 Power Clean
  - 1 Front Squat
  - 1 Push Press
```

### 5.8 Interrupt overlay

Kalsu's shape: an athlete-paced primary task periodically interrupted.

```
for time:
  - 100 Thruster @ 135lb
  every 1min: 5 Burpee
```

The `every` line is a sibling of the work it interrupts, not a container around it.

### 5.9 Unbounded repeat

```
every 1min until failure:
  - 1 Burpee, +1 each round
```

The failure point is the score (§9.4).

### 5.10 Tally block

Totals with no prescribed order (roadmap §2.5). Deliberately shallow — it holds totals and nothing else.

```
any order:
  - 100 Pull-Up
  - 200 Push-Up
  - 300 Air Squat
```

### 5.11 Team

```
team of 2:
  - 100 Wall Ball @ 20lb shared      // 100 between the team, split freely
  - 40 Burpee each                   // 40 per athlete, 80 total
  - 20 Burpee synchronized           // performed together; 20 scored, 40 performed
```

Three qualifiers, and they scale to any team size:

| Qualifier | Meaning | Team of 2 | Team of 4 |
|---|---|---|---|
| `shared` | The total is split among the team, however they choose | 100 between 2 | 100 between 4 |
| `each` | The total applies to every athlete | 80 performed | 400 performed |
| `synchronized` | Every athlete performs each rep together; counted once | 20 scored, 40 performed | 20 scored, 80 performed |

`shared` is the default when a step appears inside a team block, but **canonical output always states it** — "40 burpees" in a team context is exactly the kind of thing a reader guesses wrong about, and one word settles it permanently. Same discipline as laterality (§4) and overrun mode (§5.5).

**There is no team `alternating`.** Alternation only means anything for a team of exactly two, and says nothing a larger team can use — three athletes rotating through a station are not alternating, they are sharing. Whether a pair strictly takes turns is execution strategy, which the format deliberately does not represent (roadmap §2.5). `alternating` remains a *laterality* term only, describing limbs (§4).

How the work is divided is never represented. `team of 2` and `team of 4` differ only in the divisor.

### 5.12 Attempts

```
3 attempts:
  - 1 Back Squat
score: best
```

### 5.13 Ramp

```
- 10min Bike, ramp 50% -> 75% FTP
```

---

## 6. Rest

```
rest 3min          // prescribed
rest as needed     // athlete discretion
rest = work        // dynamic: matches the preceding work interval
```

---

## 7. Targets and qualifiers

Attached with `@` (targets) or after a comma (qualifiers).

```
- 5 Back Squat @ 85% 1RM
- 3 Deadlift @ 1.5x BW
- 8 Front Squat @ 135lb, tempo 31X1
- 1km Run @ 4:30/km
- 8min Bike @ 95% FTP
- 20min Run @ Z2
- 20 Box Jump @ 24in
- 200m Farmers Carry @ 2x24kg
- 30 Wall Ball @ 20lb to 10ft
```

Qualifiers: `tempo`, `unbroken`, `synchronized`, laterality, `building`, and free-text notes in quotes.

---

## 8. Expressions

One mechanism covers ascending reps, relative loads, cross-block references, and dynamic rest (corpus findings F1, F5, F6, F7). Deliberately **not** a programming language — three forms only.

### 8.1 Per-round change

Whiteboard idiom preferred over arithmetic:

```
- 3 Lateral Burpee over Dumbbell, +3 each round
- 1 Burpee, +1 each round
- 5 Back Squat, +10lb each round
```

### 8.2 Athlete-profile references

Resolved against an athlete profile record at execution time. Unresolved references are a validation warning, not a parse error — the file is still valid.

`BW` (bodyweight) · `1RM` · `TM` (training max) · `FTP` · HR zones · **named paces** — `5k pace`, `10k pace`, `marathon pace`, `threshold pace`, `easy pace`

```
- 400m Run @ 5k pace
- 20min Run @ threshold pace
```

Named paces need no new machinery: they are additional athlete-profile keys read exactly like `1RM` and `FTP`.

```
- 10 Deadlift @ 1.5x BW
- 5 Press @ 85% TM
```

### 8.3 Named results

A block can be labelled and referenced later in the same workout.

```
build to a heavy single in 12min as heavy-single:
  - 1 Back Squat

3 sets:
  - 3 Back Squat @ 85% of heavy-single
```

### 8.4 Athlete-determined load

Where load is an output rather than an input:

```
build to a heavy single in 12min:
  - 1 Back Squat
score: max load
```

`building` on a step marks ascending athlete-chosen load without a fixed target.

---

## 9. Scoring

The corpus found scoring to be one of the richest parts of the domain, not a single field. It is declared per block or per workout; block scores compose.

### 9.1 Simple scores

```
score: time            // elapsed
score: reps            // total scored units — see 9.3
score: rounds + reps
score: rounds          // completed rounds (survival formats)
score: load            // heaviest successful
score: max load
score: distance
score: calories
score: complete        // done / not done
```

`for time:` is sugar for a block with `score: time`. `AMRAP:` defaults to `rounds + reps`.

### 9.2 Per-round scores

```
5 rounds:
  ...
  rest 3min
score: time per round       // Barbara — five times, not one
score: load per round       // Bear Complex — five loads
```

### 9.3 Scored units

`score: reps` counts **scored units**: one per rep and one per calorie. This is how Fight Gone Bad legitimately sums reps and calories into one total. Distance-based steps contribute nothing unless the block declares a conversion.

### 9.4 Aggregates and composition

```
score: min per round        // Tabata — the lowest round counts
score: max per round
score: sum of blocks        // compose sibling block scores
score: best                 // best of attempts (§5.12)
```

Death-by formats score `rounds`, meaning the last **fully completed** round.

### 9.5 Time caps

```
score:
  primary: time
  on cap: reps            // if capped, score becomes reps completed
```

Default when capped: reps completed. Capped and uncapped results are not directly comparable and tools should not rank them together.

### 9.6 Tiebreaks

Checkpoints are marked **where they happen** with `@tiebreak`; the score declaration just says to use them. This handles Open 25.3's five checkpoints without listing them twice.

```
- 5 Wall Walk @tiebreak
...
score:
  primary: time
  tiebreak: checkpoints        // ordered, last reached wins
```

---

## 10. Variants and scaling

Variants override without duplicating the workout. They may override load, reps, distance, movement, height, or a whole block.

```
variants:
  rx:
    thruster: 95lb
  rx+:
    thruster: 115lb
  scaled:
    thruster: 65lb
    pull-up: Ring Row
```

**Athlete categories are explicit.** `95/65` is accepted on input as a shorthand and canonicalised to named categories — the parser asks which reading is meant when it can't tell (§12).

```
variants:
  men:   { sled-push: 152kg, wall-ball: 9kg to 10ft }
  women: { sled-push: 102kg, wall-ball: 6kg to 9ft }
```

Variants compose along independent axes (division × sex), so Hyrox's Open/Pro × men/women grid is four variants, not a special case.

---

## 11. Constraints and notes

Exactly two constraints carry machine semantics, because both change whether or how work counts:

- `unbroken` — the set is void if broken (Bear Complex: the bar may not be grounded)
- `synchronized` — reps are performed together and scored once (§5.11)

Everything else is a note. Resist building a constraint language:

```
// one athlete works at a time
// partners must finish within 15s of each other
- 100 Wall Ball, note: "no dropping from the top"
```

---

## 12. Ambiguity

Global rule: **the parser never guesses.** Where input admits more than one reading, it reports the candidates and asks. In the paste-in flow this is a feature, not friction — "we read `95/65` as men/women; correct?"

Known ambiguity classes: `95/65` (sex categories vs Rx/scaled vs two loads), bare `Erg`, unqualified laterality on a movement admitting several modes, `m` as minutes vs metres in novel positions, and a rep scheme whose length doesn't match its movements.

---

## 13. The corpus, encoded

All 40 workouts from [falsification-corpus.md](../examples/falsification-corpus.md). This is the test: if any of them reads badly, the notation is wrong. Problems found are numbered **N1–N11** and collected in §14.

### Baseline

**1. 5×5 Back Squat**
```wdl
5 sets:
  - 5 Back Squat @ 225lb
  rest 3min
```
*Four rests, not five — resolved in §5.2.* **N1**

**2. Partner AMRAP**
```wdl
team of 2:
  AMRAP 20min:
    - 20 Burpee synchronized
    - 30 Pull-Up shared
    - 40 Wall Ball @ 20lb shared
// one athlete works at a time except synchronized reps
```
*Originally encoded with `alternating`, which only works for a team of two.* **N2**

**3. One-mile run**
```wdl
- 1mi Run
```
*A workout that is a single step with no enclosing block.* **N11**

**4. Fran**
```wdl
# Fran
for time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-Up
```

**5. Cindy**
```wdl
# Cindy
AMRAP 20min:
  - 5 Pull-Up
  - 10 Push-Up
  - 15 Air Squat
```

**6. Grace**
```wdl
# Grace
for time:
  - 30 Clean & Jerk @ 135lb
```
*`Clean & Jerk` and `Clean and Jerk` fold identically — resolved in [registry §3](../docs/movement_registry_design.md).* **N10**

**7. Helen**
```wdl
# Helen
3 rounds for time:
  - 400m Run
  - 21 KB Swing @ 53lb
  - 12 Pull-Up
```
*Two block modifiers on one header.* **N3**

**8. Annie**
```wdl
# Annie
for time:
  50-40-30-20-10:
    - Double-Under
    - Sit-Up
```

### Timing structures

**9. Barbara**
```wdl
# Barbara
5 rounds:
  - 20 Pull-Up
  - 30 Push-Up
  - 40 Sit-Up
  - 50 Air Squat
  rest 3min
score: time per round
```

**10. Chelsea**
```wdl
# Chelsea
EMOM 30min, fail on overrun:
  - 5 Pull-Up
  - 10 Push-Up
  - 15 Air Squat
score: rounds
```
*Earlier draft wrote this `on overrun: fail:` — two colons on one header line. Fixed in §5.5.* **N4**

**11. Mary**
```wdl
# Mary
AMRAP 20min:
  - 5 Handstand Push-Up
  - 10 Pistol (split)          // 5 per leg
  - 15 Pull-Up
```

**12. DT**
```wdl
# DT
5 rounds for time @ 155lb:
  - 12 Deadlift
  - 9 Hang Power Clean
  - 6 Push Jerk
```
*Block-level load, resolved in §5.0.* **N5**

**13. Filthy Fifty**
```wdl
# Filthy Fifty
for time:
  - 50 Box Jump @ 24in
  - 50 Jumping Pull-Up
  - 50 KB Swing @ 35lb
  - 50 Walking Lunge (split)
  - 50 Knees-to-Elbow
  - 50 Push Press @ 45lb
  - 50 Back Extension
  - 50 Wall Ball @ 20lb
  - 50 Burpee
  - 50 Double-Under
```

**14. Murph**
```wdl
# Murph
for time, wearing 20lb Vest:
  - 1mi Run
  any order:
    - 100 Pull-Up
    - 200 Push-Up
    - 300 Air Squat
  - 1mi Run
```

**15. Linda**
```wdl
# Linda
for time:
  10-9-8-7-6-5-4-3-2-1:
    - Deadlift @ 1.5x BW
    - Bench Press @ 1x BW
    - Clean @ 0.75x BW
```

**16. Bear Complex**
```wdl
# Bear Complex
5 rounds, building:
  7 sets, unbroken:
    - 1 Power Clean
    - 1 Front Squat
    - 1 Push Press
    - 1 Back Squat
    - 1 Push Press
score: load per round
```

**17. Kalsu**
```wdl
# Kalsu
for time:
  - 100 Thruster @ 135lb
  every 1min: 5 Burpee
```

**18. Fight Gone Bad**
```wdl
# Fight Gone Bad
3 rounds:
  - 1min Wall Ball @ 20lb
  - 1min Sumo Deadlift High-Pull @ 75lb
  - 1min Box Jump @ 20in
  - 1min Push Press @ 75lb
  - 1min Row, count cal         // completes on time, measures calories
  rest 1min
score: reps
```
*Every step here completes on duration, yet the score counts reps and calories — resolved by the measured output in §4.* **N6**

**19. Tabata This**
```wdl
# Tabata This
sequence:
  8 rounds: { work 20s: Pull-Up,   rest 10s }   score: min per round
  rest 1min
  8 rounds: { work 20s: Push-Up,   rest 10s }   score: min per round
  rest 1min
  8 rounds: { work 20s: Sit-Up,    rest 10s }   score: min per round
  rest 1min
  8 rounds: { work 20s: Air Squat, rest 10s }   score: min per round
  rest 1min
  8 rounds: { work 20s: Row,       rest 10s }   score: min per round
score: sum of blocks
```

**20. Death by Burpees**
```wdl
# Death by Burpees
every 1min until failure:
  - 1 Burpee, +1 each round
score: rounds
```

### CrossFit Open

**21. Open 24.1**
```wdl
# Open 24.1
for time, cap 15min:
  21-15-9:
    - DB Snatch @ 50lb, first arm
    - Lateral Burpee over Dumbbell
    - DB Snatch @ 50lb, second arm
    - Lateral Burpee over Dumbbell @tiebreak
score: { primary: time, on cap: reps, tiebreak: checkpoints }
```
*`first arm` selects a side, which is separate from the three counting modes — resolved in §4.* **N7**
*The marker fires once per ladder tier and the last reached wins, which is exactly the official rule. The §15 worry about round qualifiers was unfounded.*

**22. Open 24.2**
```wdl
# Open 24.2
AMRAP 20min:
  - 300m Row
  - 10 Deadlift @ 185lb
  - 50 Double-Under
```

**23. Open 24.3**
```wdl
# Open 24.3
for time, cap 15min:
  5 rounds:
    - 10 Thruster @ 95lb
    - 10 Chest-to-Bar Pull-Up
  rest 1min
  5 rounds:
    - 7 Thruster @ 135lb
    - 7 Bar Muscle-Up
```

**24. Open 25.1**
```wdl
# Open 25.1
AMRAP 15min:
  - 3 Lateral Burpee over Dumbbell, +3 each round
  - 3 DB Hang Clean to Overhead @ 50lb, +3 each round
  - 30ft Walking Lunge
```

**25. Open 25.2**
```wdl
# Open 25.2
for time, cap 12min:
  - 21 Pull-Up
  - 42 Double-Under
  - 21 Thruster @ 95lb @tiebreak
  - 18 Chest-to-Bar Pull-Up
  - 36 Double-Under
  - 18 Thruster @ 115lb @tiebreak
  - 15 Bar Muscle-Up
  - 30 Double-Under
  - 15 Thruster @ 135lb
score: { primary: time, on cap: reps, tiebreak: checkpoints }
```

**26. Open 25.3**
```wdl
# Open 25.3
for time, cap 20min:
  - 5 Wall Walk @tiebreak
  - 50cal Row
  - 5 Wall Walk @tiebreak
  - 25 Deadlift @ 225lb
  - 5 Wall Walk @tiebreak
  - 25 Clean @ 135lb
  - 5 Wall Walk @tiebreak
  - 25 Snatch @ 95lb
  - 5 Wall Walk @tiebreak
  - 50cal Row
score: { primary: time, on cap: reps, tiebreak: checkpoints }
```

**27. Remainder**
```wdl
every 3min x 5:
  - 400m Run
  - max Pull-Up
score: reps
```

**28. E2MOM alternating**
```wdl
EMOM 20min:
  min 1: 12cal Row
  min 2: 10 DB Snatch (split) @ 50lb
```
*Also expressible as `every 2min x 10:` with two steps. Two spellings of one thing — acceptable, but note it.*

### Strength

**29. Building to a heavy double**
```wdl
every 90s x 6:
  - 2 Front Squat, building
score: max load
```

**30. 5/3/1 Week 1**
```wdl
strength:
  - 5 Back Squat @ 65% TM
  - 5 Back Squat @ 75% TM
  - 5+ Back Squat @ 85% TM
```

**31. Build to a heavy single**
```wdl
build to a heavy single in 12min:
  - 1 Back Squat
score: max load
```

**32. Cross-block reference**
```wdl
build to a heavy single in 12min as heavy-single:
  - 1 Back Squat
3 sets:
  - 3 Back Squat @ 85% of heavy-single
```

**33. CrossFit Total**
```wdl
# CrossFit Total
sequence:
  3 attempts: { - 1 Back Squat }      score: best
  3 attempts: { - 1 Shoulder Press }  score: best
  3 attempts: { - 1 Deadlift }        score: best
score: sum of blocks
```

**34. Tempo Front Squat**
```wdl
4 sets:
  - 6 Front Squat @ 185lb, tempo 30X1
  rest 2min
```

### Endurance

**35. Interval run**
```wdl
8 rounds:
  - 400m Run @ 5k pace
  rest 90s
```
*`5k pace` is an athlete-profile reference — resolved in §8.2.* **N8**

**36. Rowing pyramid**
```wdl
sequence:
  - 250m Row
  rest = work
  - 500m Row
  rest = work
  - 750m Row
  rest = work
  - 1000m Row
  rest = work
  - 750m Row
  rest = work
  - 500m Row
  rest = work
  - 250m Row
```

**37. Bike intervals**
```wdl
sequence:
  - 10min Bike, ramp 50% -> 75% FTP
  4 rounds:
    - 8min Bike @ 95% FTP
    - 4min Bike @ 55% FTP
  - 10min Bike @ 55% FTP
```

**38. Swim send-off**
```wdl
every 1min45s x 10:
  - 100m Swim
```
*An earlier draft offered `10 x 100m Swim on 1:45` as sugar. It's an inconsistent one-liner — dropped.* **N9**

### Hyrox

**39. Hyrox Open**
```wdl
# HYROX
for time:
  - 1km Run
  - 1000m SkiErg
  - 1km Run
  - 50m Sled Push @ 152kg
  - 1km Run
  - 50m Sled Pull @ 103kg
  - 1km Run
  - 80m Burpee Broad Jump
  - 1km Run
  - 1000m Row
  - 1km Run
  - 200m Farmers Carry @ 2x24kg
  - 1km Run
  - 100m Sandbag Lunge @ 20kg
  - 1km Run
  - 100 Wall Ball @ 9kg to 10ft

variants:
  women: { sled-push: 102kg, sled-pull: 78kg, farmers-carry: 2x16kg,
           sandbag-lunge: 10kg, wall-ball: 6kg to 9ft }
```

**40. Hyrox Doubles**
```wdl
# HYROX Doubles
team of 2:
  for time:
    - 1km Run
    - 1000m SkiErg
    // … remaining 14 elements as above
// both athletes run every kilometre together, within 15s
// station work may be split however the pair chooses
```

---

## 14. What encoding the full corpus found

All 40 encode. Eleven problems surfaced (N1–N11), none structural — every one was notation, which is the right kind of problem at this stage. **All eleven are now closed.**

| | Problem | Resolution |
|---|---|---|
| **N1** | Does a trailing `rest` fire after the final round? | No — between rounds only, with `rest after last` to opt in (§5.2) |
| **N2** | `alternating` meant limbs on a step and athletes on a team | There is no team `alternating` — it only parses for a team of two. Team totals are `shared` / `each` / `synchronized` (§5.11), which scale to any size |
| **N3** | `3 rounds for time:` — two block modifiers on one header | Modifiers compose; a header has exactly one colon (§5.0) |
| **N4** | `on overrun: fail:` put two colons on one header | Reworded to `fail on overrun` (§5.5) |
| **N5** | DT repeated `@ 155lb` on three consecutive lines | Block headers carry targets and equipment, inherited by their steps, preserved as authored (§5.0) |
| **N6** | Completion condition and measured output are different facts | Steps carry an optional measured output that scoring reads, independent of what ends them (§4) |
| **N7** | `right arm` selects a side; counting modes say how to count | Separate concepts, separate slots; a side selector makes the counting mode unnecessary (§4) |
| **N8** | Named intensity references (`5k pace`) had no home | Athlete-profile keys, read exactly like `1RM` and `FTP` (§8.2) |
| **N9** | `10 x 100m Swim on 1:45` was an inconsistent one-liner | Dropped; `every 1min45s x 10:` covers it |
| **N10** | `Clean & Jerk` and `Clean and Jerk` folded differently | `fold()` now tokenizes, drops stopwords, and joins with nothing ([registry §3](../docs/movement_registry_design.md)) |
| **N11** | A single-step workout had no legal form | A bare step list is a valid body (§2) |

**N10 turned out to be worth more than its own problem.** Rewriting `fold()` to discard separators entirely — joining tokens with nothing rather than with hyphens — dissolved the concatenation problem the registry had previously declared algorithmically unsolvable. `Pull-Ups`, `Pull Ups`, and `pullups` now produce one key with no dictionary and no segmenter. A whole class of hand-written aliases disappeared as a side effect. The cost is that fold output is no longer readable, so the id/title invariant relaxed from `fold(title) == id` to `fold(id) == fold(title)` — which is the honest statement anyway, since it says the two forms denote the same thing without pretending either is derived from the other.

**Confirmed working**

- The `@tiebreak` marker fires once per ladder tier with the last reached winning, which matches the official Open rules exactly. The worry about needing round qualifiers was unfounded.
- Every container earned its place. None went unused across 40 workouts.
- Progressive disclosure holds: the eight baseline workouts use no syntax beyond quantities, movements, and `@`.

---

## 15. Deferred to 0.2+

- Program-level constructs (multi-week progressions referencing workout files)
- Partner relay ordering beyond shared/each/synchronized
- Structured movement standards (depth, range of motion)
- Gym-local dialect files (review item A6)
- Extension attributes (`@x-gym: …`)

## 16. Open syntax questions

**Settled by building the parser** ([`@wdl/core`](../packages/core)):

- **The `{ … }` inline-block form is accepted input, not canonical output.** Writing the formatter forced the issue: normalizing braces to indentation exposed a genuine ambiguity, because a `score:` line at the *same* indent as its block header is indistinguishable from a sibling statement. The fix generalizes — **a `score:` nested inside a block belongs to that block; at the top level it belongs to the workout.** One rule, no ambiguity, and the inline form survives as sugar the formatter quietly removes. Tabata This and CrossFit Total round-trip through it.
- **Units may be spaced.** `15 cal Row`, `400 meters Run`, `rest 3 m`, `155 lbs`, `135#`, `24"` all parse; duration words are matched before a bare `m` so `12 min` is minutes and `400 m` is metres. Also `EMOM 10` and `AMRAP 12` — a bare number in a duration position is minutes.
- **`alternating` may precede the movement name.** `10 alternating DB Snatch` is how it is written on a whiteboard; it is a counting mode rather than part of the name, so it maps to `(split)` and survives as a note. The original draft only accepted it as a trailing qualifier.

**Still open**, and best judged against real usage rather than more design:
- `rounds` vs `sets` preserved as authored — right call, or false precision?
- `EMOM 20min:` with a two-minute cycle and `every 2min x 10:` say the same thing (§13.28). Should one be canonical?
- Does `+3 each round` need a subtractive form, or is a literal list always clearer for descending schemes?
