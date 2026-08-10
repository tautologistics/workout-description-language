# Workout Description Specification — Development Plan

## 1. Purpose

Develop a human-readable, machine-parseable specification for describing workouts consistently.

The format should be expressive enough for CrossFit-style programming and related strength/conditioning work, including:

- sets and reps
- rounds and loops
- AMRAP, EMOM, E2MOM, intervals, and time caps
- loads and equipment
- distances and calories
- unilateral/alternating work
- rest periods
- complexes and supersets
- scaling and variants
- partner/team workouts
- scoring
- notes and coaching intent

The primary design goal is to make the notation easy for a coach or athlete to read and write while remaining deterministic enough to parse into structured data.

---

## 2. Define the Design Principles

Before defining syntax, establish the principles that will constrain the specification.

Suggested principles:

1. **Human-readable first**  
   A workout should look reasonably similar to how a coach would naturally write it on a whiteboard.

2. **Machine-parseable**  
   Equivalent syntax should have unambiguous semantics.

3. **Minimal punctuation**  
   Avoid turning workout programming into a programming language unless complexity requires it.

4. **Progressive disclosure**  
   Simple workouts should remain simple. Advanced syntax should only be required for advanced workout structures.

5. **Composable structures**  
   The same primitive concepts should work inside rounds, intervals, supersets, partner sections, and other containers.

6. **Explicit semantics**  
   Concepts such as "3 rounds", "21-15-9", "every 2 minutes", and "alternate arms" should have defined meanings rather than relying solely on convention.

7. **Extensible without breaking old files**  
   Future movement attributes, scoring models, equipment, or metadata should be addable without redesigning the grammar.

8. **Round-trip capable**  
   Parsed structured data should be serializable back into a canonical human-readable representation.

---

## 3. Identify the Core Domain Model

Define the concepts independently of textual syntax.

A useful top-level model might contain:

### Workout

- title
- date
- description
- sections
- scoring method
- variants
- metadata

### Section

Examples:

- warm-up
- strength
- skill
- conditioning
- accessory
- cooldown

A section contains one or more executable blocks.

### Block

A block defines control flow or grouping.

Examples:

- sequential block
- rounds
- for-time
- AMRAP
- EMOM
- interval
- superset
- complex
- ladder
- chipper
- rest
- partner block

### Exercise / Movement

A movement should be represented independently from its prescription.

Examples:

- Back Squat
- Thruster
- Pull-up
- Run
- Row
- Dumbbell Snatch

### Prescription

Properties that modify a movement:

- reps
- duration
- distance
- calories
- load
- percentage
- RPE
- tempo
- height
- side
- cadence
- equipment
- movement variation

### Control Flow

Structures that determine repetition and sequencing:

- repeat N times
- repeat according to a rep sequence
- repeat until time expires
- execute on a fixed clock
- alternate movements
- alternate athletes
- stop when work is complete

### Score

Examples:

- elapsed time
- rounds + reps
- total reps
- total load
- max load
- calories
- distance
- completion only

---

## 4. Collect Representative Workout Examples

Before designing the grammar, assemble a corpus of real workouts.

Include simple and pathological cases.

Suggested categories:

### Simple

- 5x5 Back Squat
- 3 rounds of 10 push-ups and 15 air squats
- 1-mile run

### Standard CrossFit

- Fran
- Cindy
- Helen
- Fight Gone Bad
- Grace
- Murph

### Timing Structures

- AMRAP
- EMOM
- E2MOM
- Tabata
- work/rest intervals
- time caps

### Rep Schemes

- 21-15-9
- descending ladders
- ascending ladders
- pyramids
- variable rep lists

### Strength

- percentages
- RPE
- build-to-heavy
- complexes
- tempo prescriptions
- rest between sets

### Scaling

- Rx
- Rx+
- intermediate
- beginner
- athlete-specific substitutions

### Team Workouts

- alternating partners
- synchronized reps
- shared totals
- relay structures
- "you go / I go"

### Ambiguous Whiteboard Examples

Include intentionally messy examples from actual gym boards.

These will reveal where the language needs either:
- explicit syntax
- acceptable shorthand
- an ambiguity flag

---

## 5. Define a Minimal Syntax First

Start with the smallest useful language.

Example:

```text
# Fran

For time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-up
```

Another:

```text
AMRAP 12m:
  - 10 Wall Ball @ 20lb
  - 8 Toes-to-Bar
  - 6 Burpee
```

Another:

```text
5 sets:
  - 5 Back Squat @ 75%
  rest 3m
```

Do not initially attempt to encode every special case.

The first grammar should support approximately 80% of ordinary programming with a very small number of constructs.

---

## 6. Separate Structure from Modifiers

Avoid making individual exercises responsible for workout control flow.

For example:

```text
3 rounds:
  - 10 Pull-up
  - 15 Push-up
  - 20 Air Squat
```

Here:

- `3 rounds` is control flow.
- `10` is the movement prescription.
- `Pull-up` is the movement.
- modifiers may follow the movement.

Example:

```text
- 8 Front Squat @ 135lb, tempo 31X1
```

This separation makes parsing and future extension substantially easier.

---

## 7. Define Units and Quantities

Create a consistent unit system.

Potential units:

### Repetition

```text
10 reps
10x
```

Prefer a canonical form while optionally accepting shorthand.

### Time

```text
30s
2m
1m30s
```

### Distance

```text
400m
1km
1mi
500ft
```

### Load

```text
95lb
43kg
```

### Relative Load

```text
75%
80% 1RM
RPE 8
```

### Calories

```text
15cal
```

### Heights

```text
24in
20in
```

Define whether whitespace is significant and how unit conversion should work.

---

## 8. Define Movement Naming

Movement names introduce a difficult interoperability problem.

Decide whether the specification will:

### Option A — Treat Movement Names as Free Text

```text
- 10 Chest-to-Bar Pull-ups
```

Advantages:
- very flexible
- easy to author

Disadvantages:
- difficult to normalize automatically

### Option B — Maintain Canonical Movement IDs

Example internal representation:

```text
movement: pull_up
variant: chest_to_bar
```

while still displaying:

```text
Chest-to-Bar Pull-up
```

This is likely the better long-term design.

The textual format can remain permissive while parsers map known names and aliases to canonical movement identifiers.

---

## 9. Define Repetition and Loop Semantics

Explicitly specify common structures.

### Fixed Rounds

```text
5 rounds:
```

### Rep Scheme

```text
21-15-9:
```

Meaning: each listed movement receives the corresponding repetition count for each pass.

### AMRAP

```text
AMRAP 12m:
```

### EMOM

```text
EMOM 15m:
```

### Repeating Multi-Minute Cycle

```text
EMOM 15m:
  cycle:
    - min 1: 12 cal Row
    - min 2: 10 DB Snatch
    - min 3: rest
```

### Intervals

```text
5 rounds:
  work 2m:
    - Bike
  rest 1m
```

The semantics should state exactly when timers start, stop, reset, or continue.

---

## 10. Define Scaling and Variants

Scaling should not require duplicating the entire workout.

Example:

```text
variants:
  rx:
    thruster: 95lb / 65lb

  scaled:
    thruster: 65lb / 45lb
    pull-up: ring-row
```

However, sex-based load notation such as:

```text
95lb / 65lb
```

can become ambiguous.

The specification should eventually support named athlete categories explicitly:

```text
load:
  rx_male: 95lb
  rx_female: 65lb
```

while allowing compact shorthand for display.

Variants should be able to override:

- load
- reps
- distance
- movement
- equipment
- time cap
- entire blocks if necessary

---

## 11. Define Scoring

Scoring should be separate from execution.

Examples:

```text
score: time
```

```text
score: rounds + reps
```

```text
score: max load
```

```text
score:
  primary: time
  tie_break: time after round 3
```

More advanced scoring can be added later.

---

## 12. Define Metadata

Metadata should remain optional.

Potential fields:

```text
@date 2026-08-09
@coach Chris
@source whiteboard-photo-0182
@tags conditioning, benchmark
```

Useful metadata for whiteboard extraction:

- source image
- extraction confidence
- original text
- normalized text
- uncertain fields
- gym/location
- workout date

---

## 13. Preserve Original Source Information

For OCR/vision extraction, do not discard uncertainty.

A workout record should potentially retain:

```text
source:
  image: IMG_2841.jpg
  transcription: ...
  confidence: 0.91
```

Individual fields could also carry uncertainty.

Example conceptual representation:

```text
load:
  value: 135lb
  confidence: 0.62
```

This prevents an automated system from silently converting uncertain handwriting into false precision.

---

## 14. Define the Formal Grammar

Once the domain model and examples stabilize, define a formal grammar.

Possible technologies:

- EBNF
- PEG
- ANTLR grammar
- Tree-sitter grammar

A PEG-style grammar may work well because the language will likely be line-oriented and hierarchical.

The grammar should distinguish:

- headers
- directives
- blocks
- repetitions
- quantities
- movements
- modifiers
- comments
- free-form notes

Indentation can define nesting, similar to Markdown or YAML.

---

## 15. Define a Canonical AST

Parsing should produce a stable abstract syntax tree.

Conceptual example:

```json
{
  "type": "workout",
  "title": "Fran",
  "blocks": [
    {
      "type": "for_time",
      "scheme": [21, 15, 9],
      "movements": [
        {
          "movement": "thruster",
          "load": {
            "male": "95lb",
            "female": "65lb"
          }
        },
        {
          "movement": "pull_up"
        }
      ]
    }
  ],
  "score": "time"
}
```

The AST becomes the semantic contract.

The textual DSL is one serialization of that model.

---

## 16. Define Canonical Formatting

The spec should define a formatter.

For example, these:

```text
AMRAP 12 min
```

```text
amrap 12m
```

```text
12 minute AMRAP
```

may all parse successfully, but canonical formatting might always produce:

```text
AMRAP 12m:
```

Canonical formatting simplifies:

- diffs
- storage
- testing
- sharing
- generated workouts

---

## 17. Build Parser and Formatter Together

Do not develop only a parser.

Implement:

1. parser
2. AST
3. validator
4. canonical formatter

Then test round trips:

```text
text
  -> parse
AST
  -> format
canonical text
  -> parse
AST
```

The resulting ASTs should be equivalent.

---

## 18. Add Validation Rules

Grammar validates syntax.

Semantic validation checks meaning.

Examples:

- negative repetitions are invalid
- an AMRAP needs a duration
- a rep scheme must be compatible with its movements
- percentage load may require an implied or explicit reference max
- `score: rounds + reps` is inappropriate for a fixed for-time workout
- an interval cannot have impossible timing constraints

Warnings should be distinguished from errors.

---

## 19. Build a Test Corpus

Every example gathered earlier should become a test case.

Maintain categories:

```text
tests/
  valid/
  invalid/
  ambiguous/
  canonicalization/
  roundtrip/
```

Each real whiteboard workout should eventually become a regression test.

This makes the photo archive particularly valuable: it becomes both workout data and a real-world syntax corpus.

---

## 20. Version the Specification

Begin explicitly with something like:

```text
Workout Description Language 0.1
```

Files may optionally declare:

```text
@wdl 0.1
```

Use semantic-version-like rules:

- patch: clarifications
- minor: backward-compatible features
- major: breaking grammar or semantic changes

Avoid stabilizing at `1.0` until a substantial number of real workouts have been encoded.

---

## 21. Define Extension Mechanisms

Do not attempt to predict every future requirement.

Provide controlled extension points.

Potential form:

```text
@x-gym: hudson-valley-crossfit
```

or structured custom attributes.

Unknown extensions should be preservable even when a parser does not understand them.

---

## 22. Define Interchange Formats

The human-readable DSL should not necessarily be the only representation.

Provide mappings to:

### JSON

Best for APIs and programmatic interchange.

### YAML

Useful for tooling and debugging.

### Database Schema

Useful for workout libraries and analytics.

### Garmin FIT

Possible export target for compatible workout structures.

### Other Fitness Platforms

Adapters may later target:

- Garmin
- Apple Health / WorkoutKit
- TrainingPeaks
- Strava-related formats
- gym programming systems

The internal AST should remain independent of any one vendor.

---

## 23. Whiteboard Extraction Pipeline

Once the spec is sufficiently stable, use it as the target representation for the photo archive.

Suggested pipeline:

```text
Photo
  ↓
Vision / OCR
  ↓
Raw transcription
  ↓
Workout segmentation
  ↓
Movement identification
  ↓
Structure inference
  ↓
DSL generation
  ↓
Parser validation
  ↓
Confidence / ambiguity review
  ↓
Canonical workout record
```

Keep both:

1. original transcription
2. normalized workout specification

Never overwrite the source interpretation.

---

## 24. Develop in Iterations

### Phase 0 — Corpus

Collect 50–100 representative workouts.

Deliverable:

```text
examples/
```

---

### Phase 1 — Semantic Model

Define:

- Workout
- Section
- Block
- Movement
- Prescription
- Loop
- Timer
- Score
- Variant

No syntax decisions beyond examples.

Deliverable:

```text
domain-model.md
```

---

### Phase 2 — Minimal DSL

Support:

- exercises
- reps
- sets
- rounds
- rep schemes
- load
- duration
- AMRAP
- for-time
- EMOM
- rest

Deliverables:

```text
spec-0.1.md
grammar.peg
```

---

### Phase 3 — Parser / Formatter

Implement:

- parser
- AST
- validator
- canonical formatter
- test suite

Deliverable:

```text
reference-implementation/
```

---

### Phase 4 — Scaling and Advanced Workouts

Add:

- variants
- ladders
- complexes
- intervals
- partner workouts
- synchronization
- athlete categories

---

### Phase 5 — Whiteboard Import

Process the real photo archive.

Use failures to identify missing grammar and semantics.

This phase should strongly influence the eventual 1.0 specification.

---

### Phase 6 — Interoperability

Add:

- JSON schema
- database representation
- Garmin FIT exporter where possible
- APIs / libraries

---

### Phase 7 — Specification 1.0

Only stabilize once:

- several hundred real workouts can be represented
- ambiguous cases have documented behavior
- parser/formatter round trips are stable
- extension rules are established
- compatibility strategy is documented

---

## 25. Suggested Repository Layout

```text
workout-spec/
├── README.md
├── spec/
│   ├── specification.md
│   ├── domain-model.md
│   ├── grammar.ebnf
│   ├── semantics.md
│   └── versioning.md
│
├── examples/
│   ├── benchmarks/
│   ├── strength/
│   ├── conditioning/
│   ├── intervals/
│   ├── partner/
│   └── whiteboards/
│
├── schemas/
│   └── workout.schema.json
│
├── reference/
│   ├── parser/
│   ├── formatter/
│   └── validator/
│
└── tests/
    ├── valid/
    ├── invalid/
    ├── ambiguous/
    └── roundtrip/
```

---

## 26. Questions the Specification Must Eventually Answer

The project should maintain an explicit list of unresolved semantic questions.

Examples:

- Does `21-15-9` apply automatically to every movement in the block?
- How should mixed rep schemes be represented?
- Is `95/65` inherently male/female, or merely two variants?
- How are unilateral repetitions counted?
- Does `10 DB snatch alternating` mean 10 total or 10 per arm?
- How are synchronized partner movements represented?
- How are shared team totals represented?
- How is "build to a heavy single" encoded?
- How is "unbroken" represented?
- How are optional substitutions represented?
- What distinction exists between prescribed scaling and athlete-specific modification?
- How are time caps represented relative to scoring?
- How should incomplete workouts be scored?
- How much natural-language shorthand should the parser accept?

These questions should be resolved from observed usage rather than theoretical completeness.

---

## 27. Recommended Immediate Next Step

Do **not** start by writing a formal grammar.

Start by collecting approximately 30–50 representative workouts and manually encode what an ideal notation for each would look like.

Then identify the smallest set of reusable constructs that explains them.

A productive first artifact would therefore be:

```text
examples-0.1.md
```

containing:

- original workout
- proposed notation
- required semantic concepts
- ambiguities discovered

Once those examples stop causing major changes to the domain model, formalize the grammar.

This example-first process will reduce the risk of designing an elegant language that fails to represent how workouts are actually written.
