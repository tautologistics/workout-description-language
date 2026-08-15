# Workout Definition Language — Product Vision and Roadmap

> For **where the project is right now** — what exists, what was learned the hard
> way, what is still open — read [context/](context/README.md). This document is
> the *why* and the *plan*, and changes slowly. Those are the state, and change
> every session.

Companion to [workout_description_spec_development_plan.md](workout_description_spec_development_plan.md), which covers how to develop the language itself. This document covers **why** the language exists — the modalities it must span and the products it must power — and works backward to the constraints those impose on the format.

See also [prior_art.md](prior_art.md). Summary: endurance formats (FIT, Zwift, intervals.icu) are mature but cardio-only and machine-first; strength log formats (Fitdown, openweight) are readable but have no control flow; nothing covers metcons, scaling, or Hyrox; and nothing spans all of it.

---

## 1. Vision

**One human-writable format for any workout, in any modality, that can be converted to and from the formats that already exist.**

This is built for its author first, and for a handful of training partners after
that. It is not competing for adoption, and no decision here should be justified
by what would make the format popular. Two things are the point:

**Goal 1 — It reads on a whiteboard.** The at-rest format is what you would write
up before a session and glance at during one: steps, flow, repeats and rules all
plain at arm's length. This is a hard constraint, not a preference. It is the
reason the format is not JSON, and the reason a canonical output that grew braces
around a compound score was a bug rather than a formatting choice — if the stored
form degenerates into a data format, the premise is gone.

**Goal 2 — Workouts can be checked and generated against a stated intent.** "Ramp
these muscles week over week." "Don't put two movements that hit the same thing
back to back." Those are rules, and a workout can be measured against them or
built to satisfy them. This is the larger half of the project and the one the
whole registry and analysis layer exists to serve.

Two means, not ends, follow from those:

**Universal coverage.** Straight endurance/cardio, interval training, classical strength and weightlifting, CrossFit-style metcons, and Hyrox-style station races are all first-class. None is the "primary" modality with the others bolted on. The claim being tested is that these mostly share one set of primitives, with a small number of carve-outs for genuinely more complex loops and patterns (AMRAP, EMOM, ladders, partner alternation).

**Interoperability by design.** Importers and exporters for Garmin FIT, Zwift `.zwo`, `.erg`/`.mrc`, Apple WorkoutKit, and intervals.icu. Import is the faster win: it bootstraps the corpus and immediately proves or disproves expressiveness. If a real Zwift workout can't round-trip through WDL, the format is missing something — that's a test, not a chore.

On that foundation sits the product ecosystem:

3. **Workout builder (web, then mobile)** — paste text or drop a file, see the structure visually, edit in GUI or text with both views in sync. Or build from scratch and get clean text out.
4. **Sharing platform** — publish, browse, fork, exchange; the text format is the interchange unit.
5. **Gym display runtime** — a Raspberry Pi screen that reads a file and runs it live: timers, current movement, "what's next," round counters.
6. **Progress tracking** — log results against a definition: done or not, Rx or which scaling, time/rounds/load, over time.
7. **Analysis / smart builder** — per-movement muscle and movement-pattern metadata enables balance analysis and orderings that rotate through muscle groups.

The strategic bet: **the text format is the foundation.** Every app is a view or runtime over the same parsed representation; every external format is an adapter over the same compiled timeline.

---

## 2. The Universal Core Model

**Status: tested against 40 real workouts in [falsification-corpus.md](../examples/falsification-corpus.md).** The topology claim survived 40/40 — every workout was a tree of containers over steps, and no modality needed its own shape. The *sufficiency* claim failed: 16 of 40 could not be expressed, yielding 11 gaps (F1–F11), which are folded into the model below. Two are structural enough to change the architecture — see §2.5.

**Every workout in every modality is a tree of containers over steps.**

### 2.1 A step

A step is a movement plus:

- **A completion condition** — the single most important axis, and the thing that unifies the modalities. Exactly one of:
  - **reps** (`10 Thruster`) — athlete-paced
  - **distance** (`400m Run`, `1km SkiErg`) — athlete-paced
  - **calories** (`15cal Row`) — athlete-paced
  - **duration** (`2m Bike`, `90s Plank`) — clock-paced
  - **open** (`Bike easy`) — advances when told, or when the enclosing container ends
  - **remainder** (`max-rep Pull-Up in time remaining`) — runs until the enclosing container's clock expires *(F2)*
  - **floor-then-open** (`5+ reps`) — a minimum, then as many as possible *(F5, from 5/3/1)*
  - **threshold** (`until HR < 130bpm`) — a sensor reading ends it. Found by exporting to Garmin: both FIT and Connect have carried heart-rate end conditions all along, and recovery intervals are written this way constantly. It is a fourth pacing kind, since neither the clock nor the athlete decides.
- **A quantity that may be an expression, not a literal** *(F1, F5, F6, F7)* — over the iteration index (`3 × round` for ascending AMRAPs, `round` for death-by), over athlete-profile values (`1.5 × bodyweight`, `85% training max`), over values produced earlier in the session (`85% of today's single`), or over a measured prior step (`rest = previous work duration`). One mechanism covers all five cases; it requires an athlete-profile record to resolve against.
- **Possibly no prescribed load at all** *(F6)* — "build to a heavy single," Bear Complex. Load is an *output* of the workout, and the score.
- **Zero or more targets/qualifiers**, each optional and modality-flavored but structurally identical — a typed value or range attached to the step:
  - load (`@ 95lb`), paired-implement load (`@ 2x24kg` — two implements of 24kg, 48kg carried), relative load (`@ 75%`, `@ 80% 1RM`), effort (`RPE 8`)
  - **laterality** *(F10)* — `both` (both limbs at once, one count), `split` (the count is divided across sides — `14 DB Curl` is 7 per arm), or `per-side` (the number applies to each side, so work doubles). `alternating` names an execution pattern, not a counting mode, and maps to `split`. The movement alone doesn't determine this, so the registry supplies a default and the prescription overrides; canonical output always states it explicitly. See [movement_registry_design.md](movement_registry_design.md) §6.
  - pace (`@ 4:30/km`, `@ 2:00/500m`), power (`@ 250W`, `@ 90% FTP`), heart rate (`@ Z2`, `@ 150-160bpm`), cadence
  - tempo (`31X1`), height (`24in`), side (`each arm`), equipment/variation
- **An intensity role** — work, rest, warmup, cooldown. Mostly implicit; matters for export (FIT and WorkoutKit both require it) and for display.

Note that targets divide cleanly into *prescriptions* (what to load/do — load, tempo, height) and *intensity targets* (how hard — pace, power, HR, RPE, %1RM). The endurance world lives almost entirely in the second group and the strength world mostly in the first, but the grammar shouldn't care.

**The completion condition belongs to the step, never to the movement.** `10 DB Thruster @ 20lb` and `2min DB Thruster @ 20lb` are the same movement, differently prescribed — Fight Gone Bad prescribes wall balls by the minute while Fran prescribes thrusters by the rep. Anything can be done for time; anything discrete can be counted. The movement registry has no opinion here ([movement_registry_design.md](movement_registry_design.md) §2.3).

### 2.2 Containers

**Core containers** — needed by every modality:

- **sequence** — do these in order (a Hyrox race, a strength session, a warmup)
- **repeat N** — do the contents N times (5 sets, 8×400m, 5 rounds)
- **rest** — a step, but worth naming; the difference between prescribed rest and rest-as-needed matters

**Extended containers** — the carve-outs, where the more complex loops live:

- **ladder / rep scheme** (`21-15-9`) — repeat where a quantity varies per pass
- **time-boxed repeat (AMRAP)** — repeat the contents until the clock expires; score is rounds + reps
- **clock-driven repeat (EMOM / E2MOM / intervals / Tabata)** — start contents on a fixed cadence regardless of when work finishes
- **cap** — a wrapper putting a time limit on any container, with defined behavior on expiry
- **superset / complex** — grouping with no rest between elements, and (for complexes) load carried across
- **partner / team** — alternation, synchronization, shared totals
- **ramp** — an endurance-specific step where a target varies linearly over the step (needed for Zwift/FIT fidelity)
- **unbounded repeat** *(F3)* — repeat until the athlete fails; the failure point determines the score (death-by ladders, and every EMOM where finishing inside the minute is the real test)
- **interrupt overlay** *(F4)* — an athlete-paced primary task periodically interrupted by a secondary one. Kalsu (100 thrusters, 5 burpees at the top of every minute) is neither a sequence nor a clock-driven repeat, and nothing else expresses it.
- **tally block** *(F8)* — totals with no prescribed order; see §2.5

Alongside containers, steps and blocks may carry **execution constraints** *(F11)*. These split by whether a machine needs to act on them. A small set changes the arithmetic or the validity of work and must be structured: **unbroken** (Bear Complex — touching the barbell down voids the round) and **synchronized** (§2.5). The much larger set — "one athlete works at a time," "partners within 15 seconds," "no dropping from the top" — are judging rules that only a human acts on, and they belong in free-text notes. Resist the urge to build a constraint language; the corpus doesn't justify one.

### 2.3 How the modalities map

| Modality | Containers used | Step completion | Typical targets |
|---|---|---|---|
| Steady cardio | sequence | duration or distance | pace / power / HR zone |
| Interval cardio | repeat N (work + recovery), ramp | duration or distance | pace / power / HR, % FTP |
| Classical strength | repeat N (sets), rest, superset/complex | reps | load, % 1RM, RPE, tempo |
| CrossFit for-time | sequence or ladder, inside a cap | reps / distance / calories | load, height |
| CrossFit AMRAP | time-boxed repeat | reps | load |
| CrossFit EMOM | clock-driven repeat | reps | load |
| Hyrox race | sequence (8 stations + 8 runs) | distance / reps / calories | sled load, carry load |
| Hyrox training | sequence + repeat N | mixed | mixed |
| Partner WODs | partner container over any of the above | any | any |

The table is the thesis: **the modalities differ in which containers and completion conditions they favor, not in kind.** Only two things are genuinely modality-specific — ramps (endurance) and load-carrying complexes (strength) — and both are ordinary extended containers.

The falsification corpus supports this. All eleven gaps it found were *shared*: F1/F3/F4/F9 surfaced in CrossFit, F5/F6 in strength, F7 in endurance, F8 across CrossFit and Hyrox — and every one is a missing primitive in the common set, not a modality demanding its own topology. Notably, Hyrox needed no special support at all: the full race encodes as a plain sequence, with divisions falling out of the variant system.

### 2.4 Compilation to a timeline

Both the display runtime and every exporter need the same thing: the AST compiled into a flat(ish) **sequence of steps with repeat blocks**, where each step carries a completion condition, targets, and an intensity role.

This is not a coincidence. FIT workout steps, Zwift `.zwo` elements, and WorkoutKit's `IntervalBlock`/`IntervalStep` are all *the same model*. Defining that compilation well is what makes exports mechanical rather than bespoke, and what makes the Pi display possible. It should be part of the core library from the start, not a later phase.

Every container in §2.2 needs defined compilation semantics: exactly when timers start, stop, reset, or continue, what happens at a cap, and — the corpus's most-repeated omission — **what happens when work overruns its clock**, as in an EMOM round the athlete can't finish inside the minute.

### 2.5 Not everything is a timeline

The corpus turned up a case the architecture didn't anticipate. **Murph** ("partition the pull-ups, push-ups and squats as needed") and **Hyrox Doubles** ("no rule governing how to split the workload") specify *totals*, and the athlete or team invents the structure during execution. They are two of the most-performed workouts in the world, and neither compiles to a step sequence.

So the model needs two kinds of block:

- **Timeline blocks** — a prescribed order, compiling to steps as in §2.4. Everything above.
- **Tally blocks** — a set of totals with no prescribed order.

**A tally block is deliberately shallow.** It holds totals and nothing else. It does not model who performs which reps, in what order, or when athletes swap — that's execution strategy, not prescription, and capturing it would be both unwriteable by hand and useless to every consumer. A partner workout says `100 Wall Ball (team)`; how the pair carves that up is their business.

Only two things must survive, because both change what the numbers mean:

- **Shared vs. per-athlete totals.** `40 Wall Ball` in a team workout is either 40 between everyone or 40 apiece. Different workout, different count on the display, different score. One flag: `shared` (the default) or `each`. It scales to any team size — `team of 2` and `team of 4` differ only in the divisor — which is why the format has no notion of athletes *alternating*: alternation only parses for a team of exactly two, and tells a team of four nothing.
- **Synchronized reps.** `20 synchronized Burpees` isn't a total — both athletes perform each rep together, so twenty scored reps is forty performed ones. Flattening it to a count gets the arithmetic wrong and erases the defining feature of the workout. This is a step-level flag, not a constraint language.

Everything else — "one athlete works at a time," "partners must stay within 15 seconds," relay ordering — is a judging rule. It belongs in free-text notes where a human reads it, not in machine-readable structure.

Consequences are correspondingly modest. The display runtime needs a **tally mode**: show remaining counts, tap to decrement, no step advancing. That's a screen, not a subsystem. Exporters report tally blocks as unrepresentable rather than inventing an order. The builder needs a way to enter totals and mark them shared or per-athlete.

### 2.6 Scoring is a subsystem, not a field

The corpus found scoring to be one of the richest parts of the domain, not the afterthought `score: time` implies. Real workouts need per-round score capture (Barbara, Bear Complex), aggregate functions over rounds (Tabata scores the *lowest* round, then sums across five exercises), mixed-unit totals (Fight Gone Bad adds reps and calories), ordered tiebreak checkpoints (Open 24.1, 25.2, 25.3 each define several), best-of-N attempt models (CrossFit Total), and failure-point scores (death-by ladders).

Since result records, history, and leaderboards are all downstream of this, scoring deserves a design pass on par with the movement registry.

---

## 3. What the Products Force on the Format

Requirements that are expensive to retrofit, so they belong in the design now.

### 3.1 Lossless GUI ↔ text round-tripping

The builder edits structure in a GUI and must regenerate text; a hand-written file carries comments and ordering the author cares about.

**Canonical formatting is the storage form.** Parsing any accepted input and reformatting produces canonical text (like `prettier`/`gofmt`). GUI edits mutate the AST and the file is re-emitted canonically. Comments must survive — attach them to AST nodes (leading/trailing). When importing a hand-written file, show a normalized diff preview rather than silently rewriting. This is far simpler than whitespace-exact preservation and good enough here; it also makes diffs, dedup, and hashing sane.

### 3.2 A separate result/log record format

"Did you do it, Rx or scaled, what was your time" is not part of the definition — it's a second record type referencing one:

```yaml
result:
  workout: crossfit:fran         # any unique string; namespace optional
  snapshot: "Fran — 21-15-9 …"   # denormalized copy, survives deletion
  date: 2026-08-09
  athlete: chris
  variant: scaled
  modifications:
    - pull-up -> ring row
  score:
    time: 8:42
  splits: [2:50, 3:01, 2:51]
  notes: "grip gave out in round 3"
```

Consequences: the declared `score:` type constrains the shape of a valid result, named variants are what results point at, and workouts need **stable identity** — see §3.2.1. Consider mapping this to [openweight](https://openweight.dev) rather than competing with it — their format is logs, ours is definitions.

#### 3.2.1 Identity *(resolves review item A1)*

The original plan referenced workouts by a content hash of their canonical text. That's broken: canonical output changes whenever the formatter changes, and when it does, every historical result's reference breaks at once.

**A workout id is just a unique string.** No prescribed format, no mandated generator — prescribing one adds nothing.

- An optional namespace prefix, separated by a colon: `crossfit:fran`, `hyrox:open-2026`, `hvcf:friday-grinder`, or a bare `fran`.
- Uniqueness is required **only within a repository** — a folder, a library, a platform instance. The format cannot enforce global uniqueness and shouldn't pretend to; cross-repo collisions are resolved by whoever merges them.
- Tools that need to auto-generate ids may use whatever they like (a ULID is a reasonable default when sortability helps). That's an implementation choice, not a spec requirement.

The one rule that matters: **an id is never derived from content.** That is the entire fix.

Two small supporting pieces:

- **Results embed a snapshot** of the workout text. This makes a result self-contained — it survives the workout being edited, deleted, or unavailable offline — and it doubles as the version record, so the format needs no revision numbering at all. A repository that lets people mutate published workouts will want its own versioning; that's a platform concern, not a format one.
- **A semantic digest is a tool feature, not a format concept.** Hashing the presentation-stripped AST powers "we already have this one" and "this looks like Fran — link it?". Advisory only, free to change across spec versions, never a durable reference.

The test: a formatter change alters canonical text for every stored workout, and **nothing breaks**, because nothing durable ever referenced the text.

### 3.3 A movement registry with canonical IDs

Analysis, exports, and result tracking all need stable movement identity, so the spec plan's §8 question is settled: **permissive surface, canonical core.** Full design in [movement_registry_design.md](movement_registry_design.md); the essentials:

- **One identity, two equivalent surface forms** — slug (`dumbbell-thruster`) and title (`Dumbbell Thruster`), like a blog post, held consistent by the invariant `fold(title) == id`.
- **Two-layer normalization.** A deterministic `fold()` (case, separators, punctuation) collapses `DB Thrusters`, `db-thrusters`, and `D.B. Thrusters` to one key with no data involved; registry alias and abbreviation lookup (`db` → `dumbbell`) handles what string rules can't.
- **Flat, self-contained entries with no inheritance.** `dumbbell-thruster` and `barbell-thruster` are separate entries, written out independently — if two things need separate PR tracking, they're separate movements. Only `id` and `title` are required; classification data (patterns, muscles) exists to serve the balance-analysis feature and is optional everywhere.
- **Features degrade in proportion to metadata present.** No muscles means no balance analysis; no laterality means the parser asks instead of defaulting; an unregistered movement is just the limiting case of a minimal entry.
- **The registry says what a movement is, never how it may be prescribed.** Quantities, completion conditions, and targets are prescription facts. The few movement-side fields that touch them (`implements`, `load` arity, `measures`, `laterality`) are advisory validation hints, never required to parse a file.
- **Unregistered movements always parse**, preserving raw text and round-tripping; only registry-dependent features degrade. They're the contribution funnel, not a failure.
- **A separately versioned clearinghouse** with permanence guarantees — IDs are never reused, merges leave tombstones — because result records reference them for years.

The registry powers analysis, builder autocomplete, validation ("400m of thrusters" → warning), substitution suggestions, and export category mapping. Seed from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) rather than curating from zero. Movement-pattern rotation (hinge / squat / push / pull / carry / core / locomotion) is a better first analysis target than per-muscle modeling — coarser, more defensible, closer to how coaches think.

### 3.4 Corpus must cover all modalities from day one

The spec plan's corpus (§4) is CrossFit-heavy. Balance it so the grammar doesn't come out metcon-shaped:

- **Strength**: 5×5, percentage waves (5/3/1), tempo work, supersets, "build to a heavy single"
- **Endurance**: 8×400m w/ 90s rest, tempo runs, rowing pyramids, zone-2 duration work, bricks, ramps
- **Hyrox**: the race itself (8 stations + 1km runs), plus station circuits and compromised-running sessions
- **CrossFit**: benchmarks, AMRAP/EMOM, ladders, chippers, partner WODs

Seed a chunk of this **by importing** real `.zwo`, `.erg`, FIT, and intervals.icu files — instant realistic corpus, and each failure to represent one is a concrete spec gap.

### 3.5 Plain-text ergonomics are a feature

"Paste plain text" is a primary input path, so the parser should be **forgiving on input, strict on output**: accept `AMRAP 12`, `amrap 12m`, `5x5 back squat @ 225`, `5@185`; emit canonical form; produce errors with line/column and suggestions. Error quality is the UX of the paste-in flow.

Where convention already exists, formalize it rather than inventing syntax. Whiteboard shorthand (`21-15-9`, `Rx`, `95/65`) and lifting shorthand (`5x5 @ 225`) should parse as-is; borrow intervals.icu's proven section/indentation/`Nx` shape for the endurance side.

---

## 4. Interoperability

Adapters are core deliverables. Each one is a mapping between WDL's compiled timeline (§2.4) and a target format, and each must **report its lossiness** rather than degrade silently — `wdl export --to fit` should warn about what it dropped, consistent with the spec plan's "never overwrite the source interpretation" ethos.

| Format | Import | Export | Fidelity notes |
|---|---|---|---|
| **Garmin FIT** (workout) | Yes | Yes | Step model maps well: duration types (time/distance/calories/open/repeat-until), target types (power/HR/pace/cadence), intensity roles. Strength is supported but via a limited `exercise_category` enum. AMRAP has no native equivalent — approximate as an open/timed step and warn that internal round structure is lost. |
| **Zwift `.zwo`** | Yes | Partial | Warmup/SteadyState/IntervalsT/Ramp/FreeRide/Cooldown, % FTP targets, text events. Clean fit for cycling and running intervals; nothing else exports. Import is a great corpus source. |
| **`.erg` / `.mrc`** | Yes | Yes (lossy) | Just a time/power curve — trivial both ways. Export flattens all structure; import produces steady/ramp steps only. |
| **Apple WorkoutKit** | n/a | Yes | `CustomWorkout` → warmup + `IntervalBlock`(steps, iterations) + cooldown; goals are time/distance/energy/open; alerts are HR/power/cadence/speed. Endurance-shaped — no reps or load concept, so strength and metcons export poorly. Delivered via an iOS app, not a file. |
| **intervals.icu text** | Yes | Yes | Text-to-text, endurance subset. Cheapest adapter to build and a good early validation of the endurance side. |
| **openweight JSON** | Yes | Yes | Strength subset; natural target for *result* records (§3.2) as much as definitions. |
| **TCX workout** | Maybe | Maybe | Older Garmin XML; similar step model. Only if demand appears. |

Two structural implications: build the timeline compiler early (everything above depends on it), and define a **conformance/fidelity vocabulary** — full, lossy-with-warnings, or unsupported — that adapters report uniformly.

---

## 5. Architecture: One Core, Many Frontends

TypeScript is the pragmatic choice: it runs in the web app, in React Native/Capacitor mobile, in Node, and on a Pi, so one implementation serves every surface.

```text
              ┌─────────────────────────────────────┐
              │           @wdl/core (TS)            │
              │  parser → AST → validator           │
              │  canonical formatter (AST → text)   │
              │  compiler (AST → step timeline)     │
              │  movement library + lookup          │
              └──────┬──────────┬──────────┬────────┘
                     │          │          │
         ┌───────────┴──┐  ┌────┴─────┐  ┌─┴──────────────────────┐
         │ Builder app  │  │ Display  │  │ Adapters               │
         │ web → mobile │  │ runtime  │  │ FIT, ZWO, ERG/MRC,     │
         │ (GUI ⇄ text) │  │ (Pi)     │  │ WorkoutKit, icu, JSON  │
         └──────┬───────┘  └──────────┘  └────────────────────────┘
                │
         ┌──────┴────────────────────────┐
         │ Sharing platform (later)      │
         │ library, results, leaderboards│
         └───────────────────────────────┘
```

- **The AST (JSON-serializable) is the semantic contract.** Apps exchange text or AST-JSON; they're equivalent by the round-trip guarantee.
- **Builder editor**: CodeMirror 6 with a WDL mode gives highlighting, inline error squiggles, and movement autocomplete — most of the text side for free.
- **The Pi display is just a browser.** Chromium in kiosk mode running the same web runtime avoids a second codebase. Big-font timer UI, keyboard/GPIO/phone-as-remote to advance athlete-paced steps, audio cues via Web Audio.
- **Mobile**: responsive PWA first (works in the gym), Capacitor wrapper when native features are needed.
- **Sharing platform**: workouts stored as canonical text keyed by their id (§3.2.1), unique within the platform's repository, with a semantic digest used for dedup-on-import and benchmark recognition. Results reference the id and carry a snapshot, so leaderboards fall out. Forking copies the text and records `derived_from`.

### 5.1 Portability: how other languages get a parser

> **Deprioritised.** This section is an argument for a format seeking independent
> implementations; this one is not seeking any. It is kept because the reasoning
> holds if that ever changes, and because point 4 — one reference implementation
> carrying the semantic layer — is what actually got built. The two-phase parse
> was adopted, and has paid for itself three times over: workouts, goals and
> programs are each a line grammar over the same indentation reader.

Writing one implementation per language doesn't scale, and waiting for volunteers means the format stays confined to whatever the reference implementation is written in. But **generating parsers from one grammar solves less of the problem than it appears to.**

Parsing is the small part. The bulk of `@wdl/core` is the semantic layer — desugaring rep schemes into per-round expansion, resolving movement names through `fold()` and the registry, applying block-level inheritance, validating, emitting canonical text, compiling to a timeline. No grammar tool generates any of that, so a generated parser leaves an implementer with roughly 70% of the work still to do, and no way to know whether they did it right.

The layered strategy, in order of leverage:

1. **A normative grammar in the spec** (EBNF). The human contract — what everyone implements against.
2. **A language-neutral conformance suite.** The [40 corpus files](../examples/corpus) paired with their expected ASTs as JSON, plus canonical-formatting and error cases. This is the highest-leverage artifact and the cheapest: it's what makes a third-party implementation *correct* rather than merely present, and it's how JSON, TOML, and CommonMark got broad independent implementations — a spec plus a test suite, not a generated parser.
3. **A tree-sitter grammar** as the primary machine artifact. It's the right pick over ANTLR here for two specific reasons: it yields editor tooling (syntax highlighting for the builder's CodeMirror editor) from the same definition, and it handles **indentation sensitivity** through an external scanner written once in C and compiled everywhere — where ANTLR would need INDENT/DEDENT lexer logic rewritten by hand for every target language, which quietly defeats the point. Bindings exist for Rust, Python, Go, Java, Swift, C#, Ruby, and JS/WASM. Error-tolerant parsing is a bonus for the paste-in flow.
4. **One reference implementation** (TypeScript) carrying the full semantic layer.
5. **Later, only if demand appears:** a Rust core compiled to WASM, which gives every language the semantics rather than just the syntax.

**Design consequence, and it's worth honoring regardless:** keep the language **line-oriented and two-phase** — an indentation pass that turns lines into a tree, then a context-free grammar over line content. The indentation pass is ~50 lines in any language and the line grammar is small and portable. That keeps the hard-to-generate part isolated and tiny, so a hand implementation stays a weekend rather than a project.

---

## 6. Roadmap

Each product milestone is scheduled to **stress-test the spec** before it stabilizes.

**A — Corpus & model** *(spec P0–P1)* — *shipped*
Started: [falsification-corpus.md](../examples/falsification-corpus.md) covers 40 hostile cases and produced gaps F1–F11. Extend toward 100 spanning all modalities (§3.4), partly by importing real ZWO/ERG/FIT/icu files. Design the two subsystems the corpus flagged as underspecified — scoring (§2.6) and the prescription-expression/athlete-profile mechanism — then re-encode the corpus against the revised model.
*Exit:* new examples stop forcing model changes; all 40 existing cases encode; the ✅/⚠️/❌ split stops moving.

**B — Minimal language + core library** *(spec P2–P3)* — *shipped*
Grammar for the 80% case. Implement `@wdl/core`: parser, AST, validator, canonical formatter, **the timeline compiler** (pulled forward — §4 depends on it), and **movement `fold()` + resolution order** against a stub registry (the algorithm is needed at parse time even before the data is curated). Ship as npm + CLI (`wdl fmt`, `wdl check`, `wdl compile`).
*Exit:* the whole corpus round-trips text → AST → canonical text → identical AST.

**C — Builder web app (MVP)** — *shipped, first cut*
[apps/builder](../apps/builder) — outline, text and "what it reads as", over one
document. Deliberately *not* a field per property: that would always lag the
grammar. The outline gives shape — order, nesting, duplication — and every line
stays a line you type. Structural edits splice the text rather than regenerating
from the AST, so comments and spacing survive; canonicalising is a button.
*Still open:* a real editor component, drag to reorder, accounts and sharing.

**D — Adapters, round one** — *shipped*
Import: intervals.icu text, `.zwo`, `.erg`/`.mrc`, FIT. Export: FIT, `.zwo`, `.erg`/`.mrc`. Fidelity reporting throughout. Import failures feed straight back into the grammar.
*Exit:* a corpus of real third-party workouts imports, canonicalizes, and re-exports with only documented losses.

**E — Display runtime** — *shipped, first cut*
[apps/display](../apps/display) — the workout as written, with a marker for where you are.
`run()` in the core lays a timeline out as the ordered things an athlete does,
carrying a source line on every cue so a cursor can point at the line that was
written; the app adds only a clock and a position. Renders the source text
rather than a generated layout, on purpose: a display that reformats the
workout is asserting the text was not good enough to read.
*Still open:* audio cues, and the exit criterion — run a real class off it.

**F — Scaling, variants & results** *(spec P4)*
Variants/scaling syntax; variant picker in builder and display. Result record format (§3.2), logging, history view.
*D, E, and F are largely parallelizable — sequence by what you want to use first.*

**G — Movement registry & analysis** — *shipped, differently*
Not a separate repo: `registry/` in this one, rebuilt by `scripts/build-canonical.ts`.
Not ~150 movements: 3148 merged from five sources, of which 181 are marked core
and 101 cover the corpus. Every record names the sources that contributed to it
and keeps their muscle claims separately, so the merge stays reversible and the
licence question stays answerable. Muscle names are a closed 19-entry vocabulary
in `registry/muscles.json`; an unrecognised name fails the build rather than
becoming a new muscle. What is still outstanding is the builder-side use of it:
autocomplete, unregistered-movement flagging, substitution suggestions.

**H — Adapters round two + platform + spec 1.0** *(spec P6–P7)*
JSON Schema for the AST, WorkoutKit export (needs the iOS app), openweight mapping. Accounts, publish/browse/fork, results and leaderboards. Stabilize at 1.0 only after real usage.

**I — Goals, analysis and generation** — *shipped*
See [goals-0.1.md](../spec/goals-0.1.md). Goals are a **separate artifact**, never part of
the workout syntax: a workout says what to do, and what you were trying to
achieve by writing it is supplied alongside. Five rules — `no repeat`, `cover`,
`limit`, `balance`, `progress` — over a muscle attribution layer with a closed
19-muscle vocabulary and per-source provenance. `wdl goals` checks; `wdl generate`
fills `?` holes in a template until the rules are satisfied; `wdl program` checks
a training block, with slots so `progress` compares pull day to pull day.

**Parking lot**
Whiteboard photo → WDL extraction (spec plan §23) — valuable but a separate project; slot after F. Watch companion; HR integration on the display.

**Deprioritised** *(by the author, deliberately)*
Language-neutral conformance suite, third-party implementations. These matter for
a format seeking adoption; this one is not. Revisit only if someone outside
actually wants to implement it.

> **Corrected 2026-08-14.** This read *"Tree-sitter grammar, language-neutral
> conformance suite, third-party implementations"* and deprioritised all three on
> the adoption argument. The reasoning does not carry to the grammar. A formally
> specified syntax is a **maintainability** requirement, not an adoption feature:
> it is what keeps the language manageable as it matures and grows more complex,
> and it is owed to whoever maintains this in five years — the author. Going from
> "no outside implementers" to "no rigorous spec needed" does not follow.
>
> Note also that **layer 1 of the strategy above — a normative EBNF grammar in
> the spec — was never in this list.** It stands as written and is simply not
> done. Machine artifacts generated from it are a separate question; the human
> contract is not.
>
> *Done 2026-08-15, in PEG rather than EBNF and with the "machine artifacts"
> question answered by there being none: `spec/grammar-0.1.ohm` is the normative
> grammar and it is also the file the parser runs, with no generation step
> between them. EBNF was rejected on evidence — WDL's rules are inherently
> ordered, and EBNF's alternation is not, so every such rule would need a prose
> caveat beside it, which is prose beside an implementation again. See
> [docs/grammar-exploration.md](grammar-exploration.md).*
>
> "Not competing for adoption" rules out decisions justified by *popularity*, not
> decisions justified by rigour. It was read as licensing a loose spec, which is
> how 83 regexes came to stand in for a grammar. Queue item 0 in
> [docs/context/ready-to-pick-up.md](context/ready-to-pick-up.md) took this up,
> and item 0a finished it: the regexes are gone.

---

## 7. Decisions to Lock In Now

| # | Decision | Choice | Forced by |
|---|---|---|---|
| 1 | Scope | All modalities first-class in one core model; no primary modality | Vision goal 1 |
| 2 | Core abstraction | Containers over steps; step = movement + completion condition + targets | §2, universality claim |
| 3 | Interop | Import/export adapters are core deliverables with uniform fidelity reporting | Vision goal 2 |
| 4 | Timeline compiler | In the core library from Milestone B | Display *and* every exporter depend on it |
| 5 | Movement naming | One identity in slug + title form; deterministic fold, then registry aliases; separately versioned clearinghouse | Analysis, exports, result stability |
| 6 | Formatting | Canonical formatter is the storage/interchange form; comments attach to AST nodes | GUI ⇄ text sync, hashing, dedup |
| 7 | Results | Separate record type referencing the workout id + named variant, carrying a snapshot; map to openweight | Progress tracking, leaderboards |
| 7a | Identity | Any unique string, optional `namespace:` prefix, unique within a repository, never derived from content (§3.2.1) | Results must outlive formatter and spec changes |
| 8 | Implementation | TypeScript monorepo (`@wdl/core` + apps + adapters) | One core for web, mobile, Pi, server, CLI |
| 8a | Portability | Line-oriented two-phase parse. The conformance suite and tree-sitter grammar are **deprioritised** — the two-phase split has already paid for itself three times over (workouts, goals, programs each being a line grammar over one indentation reader), which was the real argument for it | §5.1 |
| 11 | Intent lives outside the workout | Goals are a separate artifact supplied alongside a workout, never syntax inside it | The same workout is good against one intent and bad against another; burying the intent makes that unsayable |
| 12 | Nothing converts reps to load | Analysis counts reps, metres, seconds and exposures, and says so. No 1RM model, no fatigue score | An invented number looks more authoritative than it is; the honest limit is stated instead |
| 9 | Syntax influences | Formalize existing convention: whiteboard shorthand, `5x5 @ 225`, intervals.icu's section/`Nx` shape | Zero-friction adoption |
| 10 | Movement library seed | Fork free-exercise-db rather than curating from zero | Metadata already exists |

## 8. Open Questions (beyond spec plan §26)

- Pace and intensity targets: absolute (`4:30/km`), named zones (`Z2`), percent of threshold (`90% FTP`), or all three with a defined resolution order against athlete settings?
- Do athlete settings (FTP, threshold pace, 1RMs, HR zones) belong in a separate athlete-profile record? Exports need them to resolve relative targets.
- How much does the format model *ramps* natively vs. treating them as an export-only concept?
- Does a result's `modifications` list need structure, or is free text enough for v1?
- Display runtime input: how does an athlete advance an athlete-paced step on a Pi (keyboard, GPIO button, phone as remote)?
- Where does the movement library live — bundled with core, or fetched and versioned independently?
- Sharing licensing: are published workouts implicitly free to fork? Decide before the platform exists.
