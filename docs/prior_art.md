# Prior Art — Existing Workout / Exercise Definition Formats

Survey conducted 2026-08-09. Question: does a human-writable, machine-parseable "markdown for workouts" already exist that covers strength + cardio + CrossFit + Hyrox?

**Short answer: no.** Several formats exist, but they split cleanly into two camps — *endurance/cardio interval formats* (mature, machine-oriented, XML/binary) and *strength-log formats* (human-readable but no control flow). Nothing covers metcon-style control flow (rounds, AMRAP, EMOM, ladders, chippers), scaling/variants, or Hyrox-style mixed station races. That gap is the actual opportunity.

---

## 1. Endurance / interval formats (mature, but machine-first)

These are structurally the closest thing to "an execution timeline," and they're what devices actually consume. All are XML or binary — none are hand-writable in any pleasant way.

| Format | Owner | Shape | Covers | Human-writable? |
|---|---|---|---|---|
| **Garmin FIT (workout files)** | Garmin / ANT+ | Binary, step sequence with repeat steps | Duration/distance/calorie steps, target zones (power, HR, pace, cadence), repeats. Strength support exists but is thin. | No |
| **Zwift `.zwo`** | Zwift | XML | Warmup/steady/ramp/intervals/freeride, % FTP targets, cadence, text cues | Barely — XML, but semantically simple |
| **`.erg` / `.mrc`** | ergo trainer ecosystem | Plain text, time/target pairs | Power targets over time (`.mrc` = %FTP, `.erg` = absolute watts) | Yes, but it's a numeric table, not language |
| **Apple WorkoutKit** | Apple | Swift API / JSON-ish | Warmup, work, recovery, cooldown steps; time/distance/open goals; repeatable blocks; pace/HR/power/cadence alerts | No (it's an API, not a file format) |
| **intervals.icu text format** | intervals.icu | **Plain text, indentation-based** | Sections, `4x` repeats, durations, distance, % FTP / HR / pace zones, ramps | **Yes — closest existing thing to what we want** |

**Key takeaway:** the [intervals.icu workout text format](https://forum.intervals.icu/t/intervals-icu-workout-markdown-format-rules/115629) is the single best precedent for the *shape* of our syntax — headed sections, indented steps, `Nx` repeat prefixes, compact duration/target notation, and it compiles down to device formats (Garmin/Zwift export). But it's endurance-only: no reps, no load, no rounds-of-mixed-movements, no scaling. It's also a forum-documented app feature, not a versioned open spec.

The whole endurance camp converges on the same underlying model — **a flat-ish sequence of steps with repeat blocks and per-step targets** — which is strong validation for the "compile the AST to a step timeline" design (§2.2 of the roadmap). It's also the export path: FIT/Zwift/WorkoutKit all consume roughly that model.

---

## 2. Strength / lifting log formats (human-readable, but no control flow)

| Project | Shape | Covers | Notes |
|---|---|---|---|
| **[Fitdown](https://github.com/datavis-tech/fitdown)** | Markdown superset, plain text | `Deadlift 5@185 5@255`, `3x5@165` multiplied sets, inline notes, dated workout headers | Explicitly a *log* format, not a prescription format. No rounds/timers/AMRAP/supersets. Small, dormant project (~17 stars). |
| **[Liftosaur / Liftoscript](https://www.liftosaur.com/doc/liftoscript)** | Text program editor + embedded scripting language (`{~ ~}`) | Sets/reps/weight, and a real JS-like language for *progression logic* — `if (completedReps >= reps) { state.weight = state.weight + 5lb }` | The most sophisticated thing in this space. Notable for handling multi-week progression, which our plan currently defers. But it's app-specific and deliberately programmer-facing — it crosses the line into a programming language. |
| **[openweight](https://openweight.dev)** | JSON + JSON Schema, TS/Kotlin SDKs | Workout, WorkoutTemplate, Program (5/3/1, nSuns), LifterProfile, PRs, RPE/RIR/tempo, `app:*` extension namespaces | Explicitly aiming to be "GPX for lifting." **Strength only — no cardio, no metcons.** Data-interchange format, not hand-writable. New/early but well-structured. |
| **Fitmark** | Markdown-based | Exercise per line: time-or-reps, name, video URL | Site was unreachable at time of survey; tied to a specific app. |
| **[wlang2](https://github.com/vishans/wlang2)** | C++ Flex/Bison DSL | Workout routine tracking with custom fields | Tiny hobby project; not a spec. |

**Key takeaway:** the strength camp gives us naming conventions worth stealing — Fitdown's `reps@weight` and `sets x reps @ weight` are genuinely good, near-universal shorthand — and openweight is worth watching as a *results/log* interchange target (our §2.3 result record could deliberately map to it). None of them model workout control flow.

---

## 3. CrossFit / functional fitness — the actual gap

Searched specifically for CrossFit WOD formats, parsers, and schemas. Findings:

- **No open specification exists.** What's on GitHub is REST APIs over ad-hoc database schemas (`crossfit-wod-api`, `wod-tracker` and similar), WOD scrapers, and Open leaderboard analytics — all app-internal models, none intended as an interchange format.
- **Commercial apps have text importers, not formats.** Beyond the Whiteboard (btwb) and SmartWOD accept pasted whiteboard-style text and parse common shorthand (`RFT`, `HSPU`, `95/65`). This is proof the parsing problem is tractable and worth solving — but the parsers are proprietary and there's no round-trippable, shareable text form behind them.
- **The notation itself is already standardized by convention, not by spec.** `AMRAP`, `EMOM`, `RFT`, `21-15-9`, `Rx`/`Scaled`, `95/65` are universally understood by athletes and universally un-machine-readable. This is the sweet spot: a format that *looks like what's already on the whiteboard* has essentially zero adoption friction.
- **Hyrox: nothing at all.** No format models station races or compromised-running formats.
- **Exercise databases do exist** and are worth reusing rather than rebuilding for the movement library (§2.4): [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (~800 exercises, public domain, includes primary/secondary muscles and equipment), [wrkout/exercises.json](https://github.com/wrkout/exercises.json), and [wger](https://github.com/wger-project/wger)'s dataset (AGPL, self-hosted fitness platform).

---

## 4. What this means for the project

1. **The gap is real and specific.** Nobody has a human-writable format that spans strength + cardio + metcon + station-race with control flow and scaling. Proceed.
2. **Don't invent syntax where convention exists.** Whiteboard shorthand (`21-15-9`, `AMRAP 12`, `95/65`, `Rx`) and lifting shorthand (`5x5 @ 225`, `5@185`) should parse as-is. The format's job is to *formalize existing notation*, not replace it.
3. **Borrow the intervals.icu shape** for sections/indentation/repeats and compact target syntax — it's proven in the one adjacent domain where a text format actually gets used.
4. **Borrow the endurance step-timeline model** as the compile target. It's what FIT, Zwift, and WorkoutKit all consume, so exports become mechanical rather than bespoke.
5. **Reuse an existing exercise database** as the seed for the movement library rather than hand-curating from zero; free-exercise-db already carries the muscle/equipment metadata the analysis feature needs.
6. **Consider openweight as the results interchange target** rather than inventing a competing log format — our definition format and their log format are complementary, not overlapping.
7. **Watch the Liftoscript line.** It shows where "workout DSL" ends and "programming language" begins. Our design principle "minimal punctuation / not a programming language" (spec plan §2) is the right call; multi-week progression logic is where that principle will come under pressure, and deferring it (roadmap §4, parking lot) is correct.

## Sources

- [Fitdown — datavis-tech/fitdown](https://github.com/datavis-tech/fitdown)
- [intervals.icu workout text format rules](https://forum.intervals.icu/t/intervals-icu-workout-markdown-format-rules/115629)
- [Liftoscript documentation](https://www.liftosaur.com/doc/liftoscript) / [astashov/liftosaur](https://github.com/astashov/liftosaur)
- [Building openweight: An Open Data Format for Strength Training](https://medium.com/@radupana/building-openweight-an-open-data-format-for-strength-training-3011bc62e08c)
- [Zwift workout file reference — h4l/zwift-workout-file-reference](https://github.com/h4l/zwift-workout-file-reference)
- [Apple WorkoutKit — CustomWorkout](https://developer.apple.com/documentation/workoutkit/customworkout) / [Build custom workouts with WorkoutKit (WWDC23)](https://developer.apple.com/videos/play/wwdc2023/10016/)
- [free-exercise-db — yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)
- [wrkout/exercises.json](https://github.com/wrkout/exercises.json)
- [wger-project/wger](https://github.com/wger-project/wger)
- [vishans/wlang2](https://github.com/vishans/wlang2)
- [Beyond the Whiteboard](https://www.beyondthewhiteboard.com/)
