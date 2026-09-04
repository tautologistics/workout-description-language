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

- **Directives** (`@key value`) carry metadata and identity. All optional. `@id` is any unique string with an optional `namespace:` prefix; it must be unique within the repository holding the file, and is never derived from the file's contents (roadmap §3.2.1). *Hosting convention, not a language rule:* when a file is saved to a hosted account the namespace is by convention that account's editable handle (`crossfit:fran`, `chris:fran`), and the host rewrites `@id` to match on every save — a local file on disk still uses any namespace or none.
- **Title** is a single `#` heading. Optional.
- **Body** is one or more blocks, or a bare list of steps — a single-step workout (`- 1mi Run`) is a valid file.
- **Sections** (optional) group blocks: `warmup:`, `strength:`, `conditioning:`, `accessory:`, `cooldown:`, or any custom label (§5.1) — a bare heading with no digit and no kind-word, read literally and noted.

Nesting is by indentation (two spaces canonical). A line ending in `:` opens a block. A line beginning with `- ` is a step. `//` begins a comment, which survives round-tripping.

**A line that is both wins on the colon.** `- AMRAP 3min:` opens a block, and the `- ` is decoration, exactly as it is on a step. *Stated 2026-08-15; the two rules above had collided since 0.1 was written and neither said which applied.* A step never ends in a colon, so the colon is the more specific signal — and reading the line as a step made a movement named `AMRAP 3min:` and dropped everything indented under it without a word. *Extended 2026-08-28 to the one-line forms that carry a body after the colon — `- min 1: 12cal Row`, `- work 20s: Pull-Up`, `- every 1min: 5 Burpee`: the dash is decoration there too, and `wdl fmt` writes it back without one. A *general* block header carrying an inline body (`AMRAP 3min: 10 Push-Up`, `for time: 50 Burpee`, `21-15-9: Thruster`, dashed or not) has no rule and stays a step — but as of 2026-08-28 it is **reported**, not silent: the parser sees a recognized block kind before the colon with text after it, and says the header opens a block whose body belongs on the next line (or in braces). Only `min`/`work`/`every` and the brace form put a body on the header line.*

### Lines that were never indented

Indentation is how nesting is written, and a file that never uses it is still read. This is forgiveness at the **input** edge only: `wdl fmt` writes the indentation back, and the whiteboard constraint governs what a file looks like at rest.

```
AMRAP 12min:      warmup:            For time:
5 Pull-Up         500m Row           - 800m Run
10 Push-Up        conditioning:      AMRAP 20min:
15 Air Squat      AMRAP 12min:         - 10 Push Press
                  5 Pull-Up            - 30 Air Squat
                  cooldown:          - 30cal Row
                  5min Walk          score: rounds
```

Four rules, and each is separately justified:

1. **An empty block adopts whatever comes next, block or not.** A block holds no work of its own, so empty it is not a thing that can stand as anyone's sibling — `conditioning:` written directly above `AMRAP 12min:` means the AMRAP is in it. This cascades: each still-empty block adopts in turn.
2. **Once a block has content, a plain line cannot close it.** A step is not a container, so a line written flat under a block belongs to that block. A flat file has no way to say "outside the block"; indent to say otherwise.
3. **A block header closes it only if that header is flat too.** A block that indents its own body is a block written the ordinary way, and one written the ordinary way inside a flat run is *in* the run rather than beside it — which is what tells the third example above (the AMRAP's steps indented, so the AMRAP is inside the `For time:`) from the second (all of it flat, so the sections are siblings). When a header does close, it closes every enclosing block populated by adoption, so it lands where its own indentation puts it. The cost is stated rather than hidden: **in a half-indented file nothing returns to the outer level**, so a `cooldown:` with an indented body after a flat `conditioning:` lands inside it. Indent the outer block's body to say otherwise.
4. **A `score:` line is not adopted.** Adoption moves *work* into the block it was written under; a score is a statement about the thing as a whole, and in a flat file the only whole that can be reached is the workout. So `score:`, `on cap:` and `tiebreak:` written flat belong to the workout. Indent one to put it on a block.

**A block header that lands somewhere its own indentation did not put it is reported**, as a `note` (§12) — the adoption rule makes a structural guess, and a guess should not also be silent. `wdl fmt` writes the indentation, which settles it.

**Only the trailing `:` is doing the work in rules 1–3.** That is syntax rather than semantics — true of every kind of block without naming any of them — which is what keeps the indentation pass free of WDL knowledge and phase 2 an ordinary line grammar. It is also the one place the "an empty block is not something anyone writes" argument is weaker than it looks: a `tally` block is the one kind the validator lets stand childless, so an empty `any order:` will adopt the line after it.

---

## 3. Units

**The `m` problem.** `m` means metres in a distance position and minutes in a duration position, and relying on position is fragile. Resolution: **canonical output always writes `min` for minutes and `m` for metres.** Input accepts `m`, `min`, `mins`, and `minute(s)` wherever a duration is expected.

| Kind | Canonical | Also accepted |
|---|---|---|
| Reps | `10` | `10 reps`, `10x` |
| Rep range | `8-12` | — |
| Distance | `400m` `1km` `1mi` `50ft` `25yd` | `400 meters`, `1 mile` |
| Duration | `12min` `1h` `1min30s` `45s` | `12m`, `90s`, `1:30`, `1:04:19`, `90 sec`, `10` (in a duration position) |
| Calories | `15cal` | `15 calories`, `15c` |
| Load | `95lb` `60kg` `2pood` | `95#`, `95 lbs`, `95` (no unit → pounds, §7) |
| Paired load | `2x24kg` | `2 x 24kg`, `24kg each hand` |
| Relative load | `75%` `80% 1RM` `85% 3RM` `85% TM` `1.5x BW` | `75 percent` |
| Qualitative load | `heavy` `moderate` `light` `unloaded` | case-insensitive; canonical is lowercase (§7) |
| Effort | `RPE 8` `RIR 2` | |
| Pace | `4:30/km` `2:00/500m` `7:00/mi` `5k pace` | `threshold pace`, `marathon pace` (§8.2) |
| Power | `250W` `90% FTP` | |
| Heart rate | `150-160bpm` `Z2` | |
| Height | `24in` `50cm` | `24"` |
| Tempo | `31X1` | |

**The clock form takes two fields or three.** `1:30` is a minute and a half and
`1:04:19` is an hour and change — the way anybody writes down a session that ran
past the hour. *Added 2026-08-23: two fields was the whole of it until the first
real result record ([results-0.1.md](results-0.1.md)) recorded a HYROX, whose score the language then could
not read.*

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
- 14 DB Curl (each arm)
```

Shape: `- <quantity> <Movement> [<inline qualifier>]* [@ <target>]* [, <qualifier>]*`

**`xN` repeats a step.** Percentage waves are written this way everywhere strength work is programmed — Sheiko's own notation is `80%x3x5`, five sets of three at eighty percent — and spelling out five identical lines is how transcription errors get in:

```wdl
strength:
  - 5 Bench Press @ 50% 1RM
  - 4 Bench Press @ 60% 1RM x2
  - 3 Bench Press @ 70% 1RM x2
  - 3 Bench Press @ 80% 1RM x5
```

**`SxR` before the movement says the same thing, sets first.** `3x10 Curl` is `10 Curl x3` — three sets of ten — and `5x5 Back Squat @ 225lb` is design rule 4's own one-liner. Both spellings produce the same reading, so a tool never has to know which was written. Written both ways at once (`5x5 Back Squat x3`), the trailing count wins, on the general rule that a step's later part overrides an earlier one. *Read as of 2026-08-15; before that a leading `5x5` fell into the movement name, so the step matched no registry entry and dropped out of muscle and volume analysis. Canonical output still writes the trailing spelling — which of the two should be canonical is open, see `docs/context/topics/known-debts.md`.*

A bare `Nx` before the movement — `10x Curl`, which §3's unit table lists as a rep spelling — reads as the plain rep count: `10x Curl` is `10 Curl`, with no `sets` (that is `NxM`, matched first). Only in the leading position; a trailing `x3` is a set count. Canonical output writes the plain form (`10 Curls`). *Read as of 2026-09-03; before that it fell into the movement name.*

**Laterality and side attach to the movement and precede the target**; team words trail it, because they qualify the whole prescription:

```
- 10 Dumbbell Curl (each arm) @ 2x35lb
- 21 DB Snatch first arm @ 50lb
- 40 Wall Ball @ 20lb shared
```

**Laterality, side, and team words are written inline, without a comma.** They read as part of the prescription rather than as modifiers of it — `14 DB Curl (each arm)`, not `14 DB Curl, each side`. Everything else (tempo, `count cal`, `+3 each round`, notes) follows a comma. Both forms parse; canonical output uses the inline form for those three and commas for the rest, and preserves the axis word the author wrote. Laterality is parenthesised — `(split)`, `(both)`, `(total)`, `(each arm)` (§7); side selectors (`first arm`) and team words (`shared`) stay bare.

**Completion conditions** (exactly one per step): reps, a rep range (`8-12`), distance, calories, duration, `open`, `max`, or `N+` meaning at least N then as many as possible.

**A step or a rest may end on a sensor reading.** `until HR < 130bpm` is how recovery intervals are actually written, and both FIT and Garmin Connect have carried it all along — FIT as `hr_less_than`, Connect as an end condition of `heart.rate` with a comparison. Neither the clock nor the athlete decides when it ends; the device does, which is why compilation classifies it as its own pacing kind rather than folding it into the other three.

```wdl
sequence:
  - Bike until HR > 160bpm
  rest until HR < 130bpm
```

Accepted spellings: `<` / `>` or `below` / `above` / `under` / `over`, and `bpm` is optional. Power thresholds work the same way — `until power > 250W`. A threshold on a step trails the movement; on a rest it follows `rest`.

**`max` means two different things, decided by what encloses it.** Inside a clock it is the *remainder* — `every 3min x 5: 400m Run, max Pull-Up` gives whatever time the run left. With no clock around it, it is a *max effort to failure* — Lynne's `5 rounds: max Bench Press, max Pull-Up` has nothing bounding a round. Compilation resolves which, and classifies the step timed or athlete-paced accordingly.

**A duration and a max can combine.** `2min max Push-Up` ends on the clock and *measures* reps — the completion-versus-measurement distinction of N6, in its most common form. Military and benchmark tests are full of it.

A rep range (`8-12`) is a step quantity; the same shape with a trailing colon (`21-15-9:`) is a block-level rep scheme. A range must ascend, which is what keeps `15-9` from being read as one.

**A range does not carry a unit.** `8-12` is a rep range; `100-150ft` — a carry, or a rest, written as a band rather than a single figure — is not read at all. This is deliberate rather than an omission: reading it would mean every consumer of a rep range learning to handle a distance or duration range too, and that is a larger question than this line's parsing, left open in the roadmap. What is not deliberate is silence — `100-150ft Farmers Carry` is *reported*, at the `note` severity unrecognized text already carries (§12), rather than swallowed into the movement name the way it was before this was stated. `wdl check` names it; `wdl fmt` keeps it verbatim, after a comma, rather than folding it into a pluralized movement name.

**A parenthetical the language does not read does not stop the movement being recognized.** `(both)`, `(split)`, `(per-side)`, `(total)`, and `(each arm)` / `(each direction)` are laterality (§7); `(women 105lb / men 145lb)` and `(105/145)` are an rx split (§10.1). Anything else in parentheses after a movement — `(Clean Grip)`, a bare `(wibble)` — is *held*, exactly the way an unread comma modifier is: the whole parenthetical, parens included, is kept in the step's unrecognized text, `wdl check` reports it at the `note` severity (§11.1, §12), and the movement name is left clean so the step still resolves against the registry. Before this was stated the `(`, the `)` and the text between them fell into the movement name one character at a time — `12 Around The Worlds (each direction)` was a movement literally named `Around The Worlds (each direction)`, matching no registry entry and dropping out of muscle and volume analysis, and `wdl fmt` pluralized it to `... (each direction)s` (that spelling now reads as a per-side laterality — §7 — but the holding rule is unchanged for everything still outside the vocabulary). `wdl fmt` writes a genuinely unread parenthetical back verbatim after a comma, with the modifiers it did read. Two edges are drawn narrowly on purpose: the match runs to the **first** `)`, so a nested `(a (b) c)` is not caught and stays in the name; and the ~15 raw-import registry titles that themselves contain a parenthetical (`Front Squat (Clean Grip)`) now have it peeled to a `note` and resolve against the base name.

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
- 14 DB Curl (split)          // 7 per arm — the count is divided across sides
- 14 DB Curl (each arm)       // 14 per arm, 28 performed
- 14 DB Curl (both)           // 14 reps, both arms simultaneously
```

**All four modes are parenthesised** — `(split)`, `(both)`, `(total)` name only *how* the count is performed; `(each arm)` names that and the **axis** it is performed across. The axis is one of `arm`, `leg`, `side`, `hand`, or `direction` — the last for a rotation performed once each way (`12 Around The Worlds (each direction)`). The bare forms `each arm` / `per leg` are still read on input (and `total` still reads, mapping to `(split)`); canonical output writes the parenthesised form and preserves the axis word the author wrote. *Parenthesising the per-side form is a 2026-08-31 change (queue item 13b): it was written bare and without a comma before, on the argument that `each arm` "reads as part of the prescription" — but the asymmetry with `(split)` was the thing a reader tripped on, and `(each direction)` had no reading at all until the axis vocabulary gained `direction`.*

**`alternating` is not a counting mode.** It names a specific execution pattern — strict left-right-left — and `10 Pistol` more often means five on one leg then five on the other. Both distribute the same count across two sides, so they cannot be different counting modes; alternation is a pattern layered on top, and which pattern the athlete uses changes nothing about the score, the volume, or the display.

So `alternating` / `alt` are accepted on input, map to `(split)`, and are preserved verbatim as a note for the human reading it. This is the same treatment team alternation gets (§5.11) and the same discipline as "one athlete works at a time": execution strategy is recorded, not structured.

---

## 5. Containers

### 5.0 Block headers and modifiers

Modifiers compose on a single header, because that is how workouts are actually written — `3 rounds for time:` for Helen, `5 rounds, building:` for the Bear Complex, `for time, cap 15min:` for any Open workout. Order is free on input; canonical output orders them structure → scoring → cap → qualifiers.

**"Order is free" includes a target beside a `for time`, and until 2026-08-15 it did not.** `3 rounds for time @ 95lb:` read correctly while `3 rounds @ 95lb for time:` lost *both* — the target ran greedily to the end of the segment, so the block inherited a meaningless `95lb for time` and was never scored, while `wdl check` reported ok and the text round-tripped unchanged. The prose above was already right; the parser was what disagreed with it. A header's target now ends at `for time` (a step's does not, because `for time` means nothing inside a step), and `for time` may follow a comma-separated modifier as well — **whatever may qualify a header before a comma may qualify it after one**, so all four spellings below are one reading:

```wdl
3 rounds @ 95lb for time:
3 rounds for time @ 95lb:
3 rounds, @ 95lb for time:
3 rounds for time, @ 95lb:
```

**"Order is free" includes the block's *kind*, and until 2026-08-16 it did not.** The kind — what the block **is**: `3 rounds`, `21-15-9`, `AMRAP 12min`, `team of 2` — had to come first, and one written after a comma was read as text the language does not know. `for time` is what made that expensive rather than merely wrong: it parses on its own, since a sequence scored by the clock is a real block, so `for time, 3 rounds:` ran **once** instead of three times with nothing said beyond a note that `3 rounds` was being kept as written. `for time, 21-15-9:` lost a whole ladder the same way, `for time, AMRAP 12min:` its window, `for time, team of 2:` the team. A kind may now be stated in any comma position, so each pair below is one reading:

```wdl
3 rounds for time:        for time, 3 rounds:
21-15-9 for time:         for time, 21-15-9:
AMRAP 12min for time:     for time, AMRAP 12min:
team of 2 for time:       for time, team of 2:
```

**A header states at most one kind.** A second is not a reordering but a contradiction — `AMRAP 12min, 3 rounds:` cannot be both — so the first one stands and the second is held verbatim and reported, the same answer the language gives anything else it will not act on (§11.1).

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

**A section is a sequence with a name and no other effect.** The eight fixed
section words (`warmup:`, `strength:`, `skill:`, `conditioning:`, `accessory:`,
`cooldown:`, and the hyphen spellings, §2) group the blocks under them and do
nothing else — every enclosing round still cycles their descendants. So does
**any other bare label**: a head whose label — everything before the first `,`
or `@` — is entirely letters, spaces and hyphens, carries no digit, and does not
open with a word that names a kind, is read as a section for whatever label the
author wrote. `Barbell movements:` inside `3 rounds for time:` is a clean visual
layer, not a diagnostic. It still takes the comma modifiers and the inherited
`@` target any header takes. The fixed eight are canonicalised to lower case; a
coined label keeps the case it was written in. Because a new word could be a
typo rather than a deliberate grouping, `wdl check` says so at the `note`
severity — *read `Barbell movements` as a section label* — where the fixed
vocabulary, a closed set, is silent (§11.1).

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

**`3 RFT:` is `3 rounds for time:` said short**, and produces that block exactly — same count, same `rounds`, same score. It is one form rather than an abbreviation of `rounds`, because the `for time` is *inside* it and there is nowhere else on the line for the score to come from. `AMRAP` and `EMOM` are already here on the same grounds: what a gym writes on a whiteboard is a spelling the language reads.

```wdl
3 RFT:            // one block with
3 rounds for time:  // the next
```

Canonical output writes the long form. The abbreviation is *read*, not *preserved* — unlike `rounds` vs `sets`, which are two different words for the structure, `RFT` is the same words shortened, so keeping it would be a spelling to carry with nothing to say. *Reversible if it turns out the short form is what belongs at rest.*

**A bare `RFT:` is not read, on purpose.** `RFT` names rounds without saying how many, and the language has no unbounded repeat — reading it as one round or quietly demoting it to `for time:` would both invent something the author did not write. So it stays an unrecognized header and is **reported**, which is loud rather than silent, and the author is one number away from a block that reads. This is the difference from `AMRAP:` with no window, which *is* accepted: an unbounded AMRAP is a real instruction — go until something else stops you — where an unbounded RFT is a missing count. It is also the difference from a bare label with no kind-word at all (`Barbell movements:`, §5.1), which *is* read — as a section: a head that opens with `RFT`, `rounds`, `every`, `build` or any other kind-word is a kind missing its parameter, not a grouping label, and stays the reported error.

**Trailing rest fires between rounds, not after the last one.** `5 sets: [5 Back Squat] rest 3min` is four rests, not five — you finish the fifth set and move on, which is the common case by a wide margin. To rest after the final round, say so:

```
5 sets:
  - 5 Back Squat @ 225lb
  rest 3min after last
```

`after last` says *which* rest, not how long it is, so it follows **any** bound — a duration, `as needed`, `= work`, active recovery, or a sensor threshold — and canonical output writes it back on all of them. *Until 2026-08-15 only a plain duration kept it: `rest as needed after last` canonicalised to `rest as needed`, silently turning "rest only after the last round" into "rest between every round".*

**Except when the round is an interval.** A `work Xs:` block makes the rest paired with it *structural* rather than recovery, so it fires on every round including the last — which is why a Tabata block is exactly 4:00 and not 3:50:

```
8 rounds:
  work 20s: Pull-Up
  rest 10s
```

The distinction is recovery rest versus interval rest, and the presence of an explicit `work` block is what marks it. The question doesn't arise at all in a clock-driven container (§5.5), where the cadence governs directly.

### 5.3 Rep scheme (ladder)

```
21-15-9:
  - Thruster @ 95lb
  - Pull-Up
```

**Runs may be written with `..`.** `1..10` expands to every tier between the endpoints, and a turning point makes a pyramid — `1..10..1` is the nineteen-tier scheme of Open 22.2. Canonical output collapses a contiguous scheme back to a run and leaves anything else explicit, so `21-15-9` and `50-40-30-20-10` stay as written.

```wdl
10..1:                 // 10, 9, 8 … 1
1..10..1:              // 1 … 10 … 1
```

**`reversed` pairs a movement against the scheme.** A step marked `reversed` takes the mirrored tier, which is the ascending/descending couplet — one movement climbing while the other descends:

```wdl
for time:
  1..10:
    - Squat Clean @ 185lb
    - Parallette Handstand Push-Up, reversed
```

Round one is one clean and ten push-ups; round ten is ten and one. Every documented example of this shape — J.J., "The Ladder", and guest-programmed couplets — is an exact reversal rather than two independent schemes, which is why one keyword covers it. If a genuinely independent pair ever appears, it can be written as two blocks.

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

every 90s for 12min:
  - 3 Power Clean @ 185lb

every 90s:
  - 3 Deadlift @ 315lb

8 rounds:
  work 20s: Burpee
  rest 10s
```

Contents start on the stated cadence regardless of when work finished.

**An interval may be bounded three ways, or not at all**: by a count of cycles (`x 6`), by a window (`for 12min`), by failure (`until failure`), or by nothing — a bare `every 90s:` runs its cadence until the work runs out. **A window and a whole number of minutes is what `EMOM` spells**, so `E2MOM 20min:` and `every 2min for 20min:` are one block and the `E…MOM` form is canonical; `EMOM` is the one-minute spelling of it. *Both the bare form and the window form were unwritable by `wdl fmt` until 2026-08-16 — it emitted `every 1min30s x undefined:` and `every 2min for 20min:` where no rule read the second and nothing read the first. Since an unreadable header is held as a named sequence (§11.1), each was a stable round trip that had lost the clock.*

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

**A cap is a bound, not a duration.** It says how long you are *given*, and a
capped for-time workout is still athlete-paced: an athlete who finishes Open 25.2
in eight minutes took eight, not the twelve they were allowed. A tool must not
report a cap as how long the workout takes. The one case where the two coincide
is work that runs until the clock stops rather than until the work is done — the
bare `AMRAP:` below — which ends *at* the cap and so has that as its length.

**A cap can supply an AMRAP's window.** A bare `AMRAP:` is legal when something above it bounds the time — the "buy-in then AMRAP with whatever is left" shape:

```wdl
for time, cap 25min:
  - 1.5mi Run
  AMRAP:
    - 11 Chest-to-Bar Pull-Up
    - 7 Hang Squat Clean @ 155lb
```

Outside a cap, an AMRAP with no duration is an error.

### 5.6.1 Duration-bounded blocks

Not every timed block is an AMRAP. `for <duration>:` runs its contents for a fixed window with no repeat semantics — the Cooper test being the canonical case:

```wdl
for 12min:
  - max Run
score: distance
```

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

**The overlay's interval takes the same bound as a clock-driven header (§5.5)** — a count of cycles, a window, failure, or nothing:

```
for time:
  - 100 Thruster @ 135lb
  every 90s x 5: 3 Power Clean @ 185lb
```

Canonical output spells the bound the way §5.5 does, minus the `E…MOM` sugar — the overlay keeps its `every …` prefix. *Both the bound and the field it lands on (`Interrupt` reuses `Block`'s `count` / `duration` / `untilFailure`) arrived 2026-08-29; before then a one-token parser stopped at the interval and the bounded overlay was unwritable on one line.*

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

### 5.11.1 Partner rotation

Two athletes, two pieces of work, at the same time — then they swap, so both do both.

```
partner rotation:
  - 150ft Sled Rope Pull
  - 1 Dead Hang
```

One pulls the sled down and back while the other hangs; then they switch. **It holds exactly two**, and that is not a limit to be relaxed later: with two athletes a third piece of work has nobody to be simultaneous with, so `validate` reports `partner-rotation-arity` as an error rather than a warning — the block's whole claim is that these run alongside each other, and with three that claim is false.

**Why this is a kind of its own rather than a `team of 2` qualifier.** §5.11 declines a team `alternating` because *"alternation only means anything for a team of exactly two, and says nothing a larger team can use"* — which is an argument against generalising it, not against the thing itself. A block that is two athletes by definition never has to answer "what about four", so the objection does not reach it. It carries no count for the same reason.

**And why the alternation is prescription rather than execution strategy.** Roadmap §2.5 keeps "when athletes swap" out of the format, and that is right for a team splitting 100 wall balls, where how they carve it up is their business. This is not that. **`1 Dead Hang` has no length of its own — it lasts exactly as long as the partner takes to pull down and back.** One athlete's work *bounds* the other's, so removing the alternation does not leave a simpler prescription, it leaves a meaningless one.

Two consequences follow from that and are stated rather than left to be discovered:

- **The timeline warns rather than computing a duration.** A timeline is one athlete's order, and the two steps are sequential in it — correct for either partner, since they take opposite ones. What it cannot express is that the second is bounded by the work beside it rather than by its own count, so it says so instead of inventing a length.
- **There is no prescribed order inside it.** One partner does the first step first and the other does the second first, so "which comes before which" has no single answer. It is `freeOrder` for the same reason a tally block is, reached from the opposite direction, and adjacency rules (§goals `no repeat`) do not apply within it.

Team qualifiers (`shared`, `each`, `synchronized`) are not used here. Both athletes complete every step by definition, which is what the block says; `shared` would mean the opposite, and `synchronized` means every rep performed together, which is what a rotation is not.

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
rest 3min             // prescribed
rest as needed        // athlete discretion
rest = work           // dynamic: matches the preceding work interval
rest 400m Jog         // active recovery — the interval is work, not a clock
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

`@` also introduces a **marker** — `@tiebreak` (§9.6). **The first character after
the `@` is what decides which of the two it is: a letter opens a marker, a digit
opens a target.** So `@95lb`, `@ 95lb`, `@95` and `@ 95` are all targets, and
whether a unit follows has nothing to do with it — nobody writes a marker called
`95lb`, and `@95` on a whiteboard is a weight.

A marker additionally has to be written tight against the `@`, and that
asymmetry is deliberate rather than tidy: a *spaced* target legitimately begins
with a letter — `@ Z2`, `@ RPE 8`, `@ marathon pace`, `@ of heavy-single` — so
the space cannot be ignored on the letter side the way it is on the digit side.
`@ tiebreak` is therefore a target, read like those.

A target that is a bare number with no unit — `@ 95` — **is pounds.** `@ 95` and
`@ 95lb` are one reading, and canonical output writes the unit in: `wdl fmt`
rewrites `@ 95` to `@ 95lb`, because the format's job is to make the reading
explicit (design rule 3 — pound is the dominant convention for a load, so it is a
documented default, not a guess). *Settled 2026-09-01, DEC-022 (`6829052`). Earlier
drafts held `@ 95` as raw and meaning nothing, on the reasoning that a defaulted
unit is an invention; Chris settled it the other way — a workout that carries a
load and omits the unit means pounds.*

Distance still requires its unit (`400m`, never a bare `400` after `@`), because
a distance is written in feet, metres or miles about equally and there is no
dominant one to default to.

### 7.1 A bare count on a calorie-measured machine

A *leading* bare magnitude — `15 Row`, not a target — on a machine that carries
no load and measures calories is genuinely ambiguous: the `15` reads as reps,
but the thing a rower or a bike-erg counts is calories. **The reading is not
changed** — the parser keeps the count as written and the board renders it
verbatim; there is no calorie default anywhere. Where a workout is being
*authored*, the **builder** shows a suggesting diagnostic ("did you mean
`15cal Row`?"), fired only when the movement resolves to a registry entry whose
`measures` include `calories` and that has no `load`. *Chris's call,
2026-09-01: flag it where it is written, default it nowhere.* This is unlike a
unitless *load* (§7), which pound is the documented default for.

A load can also be a word from a small closed vocabulary — `heavy`, `moderate`,
`light`, `unloaded` — read exactly like a coach says it out loud:

```
- 150ft Farmers Carry @ heavy
```

This is a `Load`, not a fallback to raw text: coaches prescribe a carry, a KB
swing or a build by feel constantly, and that is the normal way to write one
rather than an omission. It carries no kilograms, on purpose — the same silence
`85% 1RM` already has when no profile says what the 1RM is — so it contributes
nothing to volume, to a `progress` ramp, or to an exporter that wants a number.
What it buys over holding the word as unrecognized text is that the step still
reads as *loaded*: anything checking whether a step carries a load gets a true
answer and an honestly-unresolvable value, rather than the target falling out
of every load-aware check the way free text does.

`spec/grammar-0.1.ohm` states all of this in the `targetGroup` rule, and where
this prose and that file disagree, that file is right.

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

**A score names what to rank by, and a score that names nothing is incomplete rather than invalid.** The two ways to write one are a bare `score:` and a brace form that never says `primary:` — `score: {tiebreak: reps at 5min}`. Both are *read*: whatever fields were written are kept and survive a round trip, and the primary is simply absent, because an absent field is absent and a default here would be an invention. Both are then **reported** by `wdl check` as `score-without-primary`. This is a rule about a value rather than about a shape, so it lives in validation and not in the grammar, the same way `min < max` on a rep range does. *Stated 2026-08-15: before that the brace form with no `primary:` made the whole brace text the primary — something nothing could rank by — and emitted the tiebreak twice.*

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
score: time
on cap: reps              // if capped, score becomes reps completed
```

Default when capped: reps completed. Capped and uncapped results are not directly comparable and tools should not rank them together.

**A compound score has two spellings and only two: sibling lines, as above, or inline braces (`score: {primary: time, on cap: reps}`) when it has to fit on one line.** *Corrected 2026-08-15.* This section and §9.6 previously illustrated a third — a nested block with `primary:`, `on cap:` and `tiebreak:` indented under a bare `score:` — which no implementation has ever read: the fields were silently dropped and `wdl check` reported ok. The prose was the bug. An indented key-and-value block is the same object the brace form is, in the notation the format exists to avoid; it says nothing the two spellings above cannot, and it is not what anyone writes on a whiteboard. Written anyway, each indented line is now reported by name.

### 9.6 Tiebreaks

Checkpoints are marked **where they happen** with `@tiebreak`; the score declaration just says to use them. This handles Open 25.3's five checkpoints without listing them twice.

```
- 5 Wall Walk @tiebreak
...
score: time
tiebreak: checkpoints          // ordered, last reached wins
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

### 10.1 A step's rx split is a variant

The step-level split in the appendix — `- 10 Deadlifts (women 105lb / men 145lb)` — and a `variants:` entry are **two spellings of one statement**, and they name divisions in one namespace. Whichever way a division was written, asking for it resolves both: `wdl fmt --variant women` reads the file as the women's workout, and so do `check`, `timeline` and `export`.

Where a workout carries both and they speak about the same step, the **`variants:` entry wins** — the table names the movement, which is the more specific statement than a split standing on the line.

Because the axes are independent, a split answers only the axis it names. A step split by sex says nothing about `scaled`, so resolving `scaled` leaves the split standing.

**With no division chosen, a step reads as what the file says: both magnitudes, labelled.** `30 Clean & Jerks (women 105lb / men 145lb)` is the cue on a board just as it is the line in the file. Resolving is something a reader asks for and never something `fmt` does — formatting a workout with two divisions leaves it with two.

A `variants:` value may state a load, a load and a height (`6kg to 9ft`), or a movement to swap in. A value that reads as none of those is reported and the step is left alone.

*Added 2026-08-18. Before it, the two mechanisms shared nothing: the split was read by the formatter and by nothing else, so a step whose only load was a split reached the builder and the board with **no load at all**.*

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

**Canonical output writes a note with its `note:` marker.** Input accepts a bare phrase (`, ramp 50% -> 75% FTP`), and three spellings keep it on output because the parser reads them back as notes by their first word: `alternating`, `ramp …`, `wearing …`. Everything else is emitted as `note: "…"`, because a bare phrase the parser does not recognize means something else — see below.

### 11.1 Text the language does not read

**Unknown is a first-class state: not an error, and not a guess.** A modifier after a comma that matches no rule is *held in the tree as unrecognized*. It is kept verbatim, it survives a round trip, and it carries no meaning — implicit or explicit — for execution, analysis or export. The same treatment reaches two things that are not written after a comma: a range wearing a unit (`100-150ft Farmers Carry`, §4) and a parenthetical that is neither laterality nor an rx split (`Deadlift (Clean Grip)`, §4). Both used to be swallowed into the movement name; both are now held, inert, and noted, and the movement name is left clean.

```
- 10 Thruster, note: "keep the elbows up", with a band
```

`keep the elbows up` is a note, written for the athlete and shown to them. `with a band` is unknown: kept on the line, shown to nobody as a cue, read by nothing. The two are separate fields in the tree (`notes` and `unknown`), which is why the note is written back with its marker — a bare phrase would come back as an unknown.

Three consequences, all deliberate:

- **Held, not dropped.** `wdl fmt` writes it back. What moves is its *position*: it is emitted after the modifiers the language does read, because canonical output normalises where every modifier sits. Text survives; column does not.
- **Inert.** It never reaches a cue, so nothing on the board says it, and no exporter can act on it. `- 10min Bike, warmup pace` is a bike interval with a phrase on the line, not a warmup segment.
- **Reported, at a severity that claims nothing.** `wdl check` says *note: `unbrokn` is not something the language reads*. Not an error — the rest of the line executes exactly as written — and not a question, because there is nothing to choose between. Held-and-inert must not also be silent: `unbrokn` is one keystroke from a constraint that decides whether a set counts.

The same rule applies to a block header's modifiers (`3 rounds, wibble:` is three rounds). It does **not** apply to a header's *kind*: `3 rounds of madness:` is an error, because the kind decides how the block executes and failing to read it loses the three rounds, where a modifier nobody taught the language costs nothing that runs. That holds wherever the kind was written — `cap 12min, 3 rounds:` is three rounds *and* an error, because `cap 12min` is not a reading the language has for a header's opening segment (§5.0). Canonical output writes such a head back in front, since a name on a block that already has a kind is not the block's identity and nothing else would write it.

Between the two sits the **bare label** — a head whose label (everything before the first `,` or `@`) is all letters, spaces and hyphens, carries no digit, and does not open with a kind-word. It names nothing the language must act on and loses nothing by being read literally, so it is a **section** (§5.1): a sequence with a name, which still takes the comma modifiers any header takes. `Barbell movements:` and `some shape nobody taught the parser:` are sections; `3 rounds of madness:` (a digit) and `RFT:` (opens with a kind-word missing its count) are not, and stay errors. The section still gets a `note`, because a coined word is one typo away from a kind-word — held-and-inert, not silent.

A **second** kind is the one case that is held rather than reported as an error: `AMRAP 12min, 3 rounds:` is the AMRAP, with `3 rounds` kept verbatim and noted. Nothing is lost — the block executes as its first kind says — so the severity that claims nothing is the right one.

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
- `EMOM 20min:` with a two-minute cycle and `every 2min x 10:` say the same thing (§13.28). Should one be canonical? *Half answered 2026-08-16: the two spellings of a **window** are settled — `every 2min for 20min:` canonicalises to `E2MOM 20min:` (§5.5). A **count** is a different field and still writes as `every 2min x 10:`, so whether ten cycles of two minutes and a twenty-minute window are the same block is the part still open.*
- Does `+3 each round` need a subtractive form, or is a literal list always clearer for descending schemes?


## Pick one of

A step may name alternatives. The athlete does one of them, so it takes one
place in the order and counts once.

**Inline**, when it fits on a line. `or`, `/` and `|` all separate:

```
- 30cal Bike or Row
- 30cal Bike/Row
- 1min Bike|Row|SkiErg
```

An alternative that names no amount takes the first one's, because nobody
writes the minute three times. Each may carry its own where they differ:

```
- 800m Run or 25cal Bike or 20cal Row
```

**As a block**, when that is a mouthful — three options each with their own
measure, which is what a run becomes when it rains:

```
choice:
  - 800m Run
  - 25cal Bike
  - 20cal Row
```

Both round-trip in the shape they were written. The block form exists because
one line was too long; rewriting it inline would undo the reason for it.

`/` separates only when it is not between two digits, so `10 3/4 Sit-Up` is one
movement and `30cal Bike/Row` is two.

**The first is the prescription.** It is what `movement` and `quantity` hold, so
everything that does not care about the choice is unaffected, and muscle
analysis reads the thing you would do by default rather than a union of
everything you might. A rule about lats should not fire because one of three
options happened to involve them.


## Rx by division

A step may carry what each division is prescribed:

```
- 10 Deadlifts (women 105lb / men 145lb)
```

Minimally, without labels:

```
- 10 Deadlifts (105/145)
- 20cal Row (15/20)
```

**Unlabelled, the larger number is the men's** — not the first one. Position is
the usual whiteboard convention (`95/65` is men first) and it is not safe:
reading position would put the heavier bar on the lighter athlete for anyone who
writes it the other way round. Magnitude cannot be written backwards.

A label overrides magnitude, so a deliberate `(women 145lb / men 105lb)` is
taken at its word.

A unit on one side covers both — `(105/145lb)` is two weights in pounds — and
bare numbers stay bare, since the measure is whatever the step is measured in.

Canonical output is always the labelled form, whichever way it came in. The
short form is readable once you know the rule; the explicit one needs no rule,
and canonical output is where an ambiguity should stop.

A split is only read in the parentheses that follow a movement. `3 rounds @ 95/65:` is
not a split: it is a header target whose text contains a slash, inherited by
every child as written, and `check` asks which of the three readings is meant
(§12) rather than picking one. `3 rounds (women 105lb / men 145lb):` is not a
header the grammar knows, and is reported as one.

What a division *means* once chosen — and that these are the same divisions a
`variants:` table names — is §10.1.
