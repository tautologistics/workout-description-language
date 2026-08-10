# Falsification Corpus — 40 Workouts vs. the Current Model

Purpose: attack the universal core model in [product_vision_and_roadmap.md](../docs/product_vision_and_roadmap.md) §2 with real workouts and record what breaks. Recommended by [plan_review.md](../docs/plan_review.md) §E.

Workouts are real, drawn from CrossFit benchmarks, CrossFit Open 2024–25, Hyrox official race formats, and standard strength/endurance programming. Syntax below is **throwaway proto-notation** — the point is to test the *model*, not to propose a grammar.

**Verdict key:** ✅ encodes cleanly · ⚠️ encodes but loses information · ❌ cannot be expressed

**Result: 18 ✅ · 6 ⚠️ · 16 ❌.** Eleven distinct gaps (F1–F11), four of them structural.

> **Second pass, against the revised model:** all 40 now encode in [spec-0.1](../spec/spec-0.1.md) §13. That round surfaced eleven *notation* problems (N1–N11, spec §14) — four already fixed, seven needing decisions — but no further structural gaps. F1–F11 are closed.

---

## Findings

### The topology claim held; the sufficiency claim did not

**All 40 workouts were a tree of containers over steps.** Not one needed a different shape. The core decomposition survives, and that's the part worth keeping.

What failed is the claim that the *listed* containers and completion conditions suffice. Sixteen of forty couldn't be expressed.

**Crucially, the gaps are not modality-specific.** F1/F3/F4/F9 surfaced in CrossFit, F5/F6 in strength, F7 in endurance, F8 in both CrossFit and Hyrox. No modality needed its own topology. So universality survives the test — **completeness doesn't.** That's a much better outcome than the reverse, because gaps are additive and a wrong topology would be a rewrite.

### F8 is the one that changes the architecture 🔴

**Murph** ("partition the pull-ups, push-ups, and squats as needed") and **Hyrox Doubles** ("no rule governing how to split the workload") are two of the most-performed workouts in the world, and **neither is a timeline.** They specify *totals*, and the athlete or team invents the structure at execution time.

This breaks an assumption the whole architecture rests on — that every workout compiles to a step sequence. The display runtime can't produce a timeline for Murph. Neither can any exporter.

The model needs a distinction between **prescribed structure** (a timeline) and **a tally block** (totals, athlete-chosen order). The runtime needs a second mode: a tally board, not a step advancer. This was not visible from the armchair and is the single most valuable thing the exercise produced.

> **Scoped down after review.** The first draft of this finding proposed representing the split itself — who does what, how many reps before swapping, ordering rules. That's execution strategy, not prescription: unwriteable by hand and useless to every consumer. A tally block holds **only totals**. Two flags survive because they change what the numbers mean — whether a total is **shared or per-athlete** (`40 wall balls` between you vs. each), and whether reps are **synchronized** (20 synchro burpees is 20 scored, 40 performed). Everything else is a judging rule for free-text notes. This shrinks the runtime work from a subsystem to a screen.

### F9: scoring is a first-class subsystem, not a field 🔴

The roadmap treats scoring almost as an afterthought (`score: time`). The corpus says otherwise. Real scoring includes per-round scores (Barbara, Bear Complex), aggregate functions over rounds (Tabata scores the *lowest* round, then sums the lowest across five exercises), mixed-unit totals (Fight Gone Bad adds reps and calories together), multiple ordered tiebreak checkpoints (24.1, 25.2, 25.3), best-of-N attempts summed across lifts (CrossFit Total), and "score is where you failed" (Death by Burpees).

Since the results/leaderboard product is downstream of this, scoring deserves its own design pass on par with the movement registry.

### The rest

| ID | Gap | Seen in |
|---|---|---|
| **F1** | **Quantity as a function of iteration** — rep counts or loads that vary per round by rule, not by literal list | 25.1, Death by, Bear Complex |
| **F2** | **"Remainder" completion condition** — max reps in the time left in the parent container | E3MOM + max pull-ups |
| **F3** | **Until-failure / unbounded repeat** — container exit determined by athlete failure, which also sets the score | Death by, Chelsea |
| **F4** | **Interrupt overlay** — a primary task interrupted periodically by a secondary one | Kalsu |
| **F5** | **Derived and bodyweight-relative loads** — 1.5×BW, % of training max (itself 90% of 1RM) | Linda, 5/3/1 |
| **F6** | **Athlete-determined load** — load is an output of the workout, not an input | Build to a heavy single, Bear Complex |
| **F7** | **Dynamic rest** — rest duration referencing another value ("rest equal to work") | Rowing pyramid |
| **F8** | **Athlete-discretion partitioning** 🔴 — totals without prescribed order | Murph, Hyrox Doubles, partner WODs |
| **F9** | **Rich scoring model** 🔴 | ~12 workouts |
| **F10** | **Side/limb as sequence element vs. modifier** — *resolved:* three counting modes (bilateral / total / per-side), registry default + prescription override, explicit in canonical output. See [registry §6](../docs/movement_registry_design.md) | 24.1, Mary (pistols), DB curls |
| **F11** | **Execution constraints** — only `unbroken` and `synchronized` need machine semantics; the rest are notes | Bear Complex, Hyrox Doubles |

### What held up, and one pleasant surprise

- **The clock-driven repeat container generalized further than expected.** EMOM, Tabata, Fight Gone Bad's one-minute stations, and swimming send-off intervals (`10×100m on 1:45`) are all the same container with different parameters. That's a genuine unification win across three modalities.
- **Cap, ladder, sequence, repeat-N, superset, and rest** all worked as specified.
- **The four original completion conditions covered ~90% of steps.** Only "remainder" was missing.
- **Hyrox needed no special support.** The full race encoded as a plain sequence in about eight lines, and divisions (Open/Pro, men/women) fell straight out of the variant system. The worry that Hyrox would need bespoke modeling was unfounded.
- **Rep schemes are sugar, not a primitive.** 25.2 looks like a ladder but changes movement *and* load at each tier. `21-15-9:` should desugar to an explicit per-round expansion rather than being its own construct.

---

## The corpus

### Baseline — should just work

**1. 5×5 Back Squat** ✅
```
5 sets:
  - 5 Back Squat @ 225lb
  rest 3m
```

**2. Partner AMRAP** — *AMRAP 20 with a partner: 20 synchronized burpees, 30 alternating pull-ups, 40 wall balls split as desired; one athlete works at a time except synchro reps* ❌ **F8, F11**
Synchronization, athlete alternation, and free-split all appear in one workout, and "one works at a time" is a constraint no container expresses. *Resolved in spec 0.1: the free split and the alternation are the same thing — `shared` — and the constraint is a note.*

**3. 1-mile run** ✅

**4. Fran** ✅
```
for time:
  21-15-9:
    - Thruster @ 95lb
    - Pull-Up
score: time
```

**5. Cindy** ✅ — `AMRAP 20m: 5 Pull-Up, 10 Push-Up, 15 Air Squat`

**6. Grace** ✅ — `for time: 30 Clean & Jerk @ 135lb`

**7. Helen** ✅ — `3 rounds for time: 400m Run, 21 KB Swing @ 53lb, 12 Pull-Up`

**8. Annie** ✅ — `for time: 50-40-30-20-10 Double-Under, Sit-Up`

### Timing structures

**9. Barbara** — *5 rounds: 20 pull-ups, 30 push-ups, 40 sit-ups, 50 squats; rest 3 min between rounds; time each round* ❌ **F9**
Structure is trivial. Scoring is not: five separate times, not one.

**10. Chelsea** — *EMOM 30: 5 pull-ups, 10 push-ups, 15 squats* ⚠️ **F3**
Encodes, but the defining feature is unstated: you're done when you can't finish a round inside its minute, and your score is how many minutes you survived. The model has no failure semantics, so this silently becomes "a 30-minute EMOM everyone completes."

**11. Mary** — *AMRAP 20: 5 HSPU, 10 pistols (alternating legs), 15 pull-ups* ⚠️ **F10**
Is "10 pistols alternating" 10 total or 5 per leg? Convention says 10 total. Nothing in the model records that.

**12. DT** ✅ — `5 rounds for time: 12 Deadlift, 9 Hang Power Clean, 6 Push Jerk @ 155lb`

**13. Filthy Fifty** ✅ — plain sequence of 10 movements × 50 reps.

**14. Murph** — *For time, wearing a 20lb vest: 1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run. **Partition the pull-ups, push-ups and squats as needed.*** ❌ **F8**
```
for time:
  - 1mi Run
  ??? partition freely:          # no container expresses this
      100 Pull-Up
      200 Push-Up
      300 Air Squat
  - 1mi Run
  with: vest @ 20lb
```
The middle section is a *set of totals*, not a sequence. Most people do 20 rounds of 5/10/15 — but that's an athlete strategy, not the prescription. Encoding it as a sequence would be wrong.

**15. Linda ("3 Bars of Death")** — *10-9-8…1 of deadlift @ 1.5× bodyweight, bench press @ bodyweight, clean @ 0.75× bodyweight* ❌ **F5**
The ladder is fine. `@ 1.5×BW` is not expressible — it's neither absolute nor %1RM, and it requires an athlete profile value at resolution time.

**16. Bear Complex** — *5 rounds for load. Each round = 7 unbroken sets of: power clean, front squat, push press, back squat, push press. Increase load each round. Bar may not touch the ground mid-round.* ❌ **F1, F6, F9, F11**
Four separate failures in one workout: load ascends by athlete choice (F6), varies per round (F1), scoring is five loads not one (F9), and "unbroken / bar can't touch ground" is an execution constraint with no home (F11).

**17. Kalsu** — *For time: 100 thrusters @ 135lb. 5 burpees at the top of every minute, starting at 0:00.* ❌ **F4**
```
for time:
  primary: 100 Thruster @ 135lb
  interrupt every 1m: 5 Burpee      # no such container
```
Not a sequence, not a clock-driven repeat — it's an athlete-paced primary task with a periodic interrupt. Genuinely new, and it wasn't on the review's gap list.

**18. Fight Gone Bad** — *3 rounds in 17 min: 1 min each of wall ball, SDHP, box jump, push press, row (cals), then 1 min rest. Score = total reps.* ⚠️ **F9**
Structure encodes cleanly via clock-driven repeat. But the score adds **reps and calories in the same total** — the scoring model has no notion of summing across incompatible units.

**19. Tabata This** — *Five exercises (pull-up, push-up, sit-up, squat, row), each 8 rounds of :20 work / :10 rest. Score for each exercise = its **lowest** round. Total = sum of the five.* ❌ **F9**
Timing is a clean clock-driven repeat. Scoring needs an aggregate function (`min`) over rounds, then a sum across sibling blocks. Nothing close exists.

**20. Death by Burpees** — *Minute 1: 1 burpee. Minute 2: 2 burpees. Continue until failure.* ❌ **F1, F3**
Rep count is a function of the round index, the repeat is unbounded, and the score is the round you failed on. Three model gaps in a two-line workout.

### CrossFit Open 2024–25

**21. Open 24.1** — *For time (15 min cap): 21-15-9 of DB snatch arm 1, lateral burpees over DB, DB snatch arm 2, lateral burpees over DB. Two ordered tiebreak checkpoints.* ⚠️ **F9, F10**
"Arm 1" then "arm 2" as distinct sequence elements — the registry's side-as-identity question (movement_registry_design.md §5) confirmed as load-bearing rather than theoretical.

**22. Open 24.2** ✅ — `AMRAP 20m: 300m Row, 10 Deadlift @ 185lb, 50 Double-Under`

**23. Open 24.3** ✅ — sequence of two rounds-blocks separated by `rest 1m`, under a 15-min cap. Encodes exactly.

**24. Open 25.1** — *AMRAP 15: 3 lateral burpees over DB, 3 DB hang clean-to-overhead, 30ft walking lunge. **After each round, add 3 reps** to the burpees and clean-to-overheads.* ❌ **F1**
An ascending AMRAP. Round *n* has `3n` reps of two movements and a fixed lunge distance. Requires quantity-as-function-of-iteration inside a time-boxed repeat.

**25. Open 25.2** — *For time (12 min cap): 21 pull-ups / 42 DU / 21 thrusters @ w1; 18 C2B / 36 DU / 18 thrusters @ w2; 15 BMU / 30 DU / 15 thrusters @ w3.* ⚠️
Looks like `21-18-15` but the **movement changes** each tier (pull-up → chest-to-bar → bar muscle-up), the **load changes** each tier, and the double-unders are 2× the tier number. Encodable only as three explicit sequential blocks. Useful negative result: **rep-scheme notation is sugar over per-round expansion**, and treating it as a primitive would have made this inexpressible.

**26. Open 25.3** — *For time (20 min cap): 5 wall walks, 50-cal row, 5 wall walks, 25 deadlifts, 5 wall walks, 25 cleans, 5 wall walks, 25 snatches, 5 wall walks, 50-cal row. Tiebreak recorded after **each** set of wall walks.* ⚠️ **F9**
Structure is a plain sequence. Five ordered tiebreak checkpoints are not representable.

**27. E3MOM × 5: 400m run, then max-rep pull-ups in the time remaining** ❌ **F2**
The canonical "remainder" case. Score is total pull-ups across five rounds.

**28. E2MOM 20 alternating** ✅ — odd minutes 12-cal row, even minutes 10 DB snatch. The cycle-within-clock-driven-repeat pattern works as designed.

### Strength

**29. Every 90s × 6: 2 front squats, building to a heavy double** ❌ **F6**
Clock-driven container works; athlete-chosen ascending load does not.

**30. 5/3/1 Week 1** — *Squat: 5 @ 65%, 5 @ 75%, 5+ @ 85% of training max (TM = 90% of 1RM)* ❌ **F5**
Two problems. Percentages reference a *training max*, itself derived from a 1RM — a chain of derived values with no home. And `5+` means "at least 5, then as many as possible," a completion condition with both a floor and an open component.

**31. Build to a heavy single in 12 minutes** ❌ **F6**
Time-boxed, athlete-determined load, score is max load achieved. Load is an output.

**32. 3×3 Back Squat @ 85% of today's heavy single** ❌ **F5** (and review item A3)
Cross-block reference to a value produced earlier in the same session. Confirmed as real, not hypothetical.

**33. CrossFit Total** — *Best of 3 attempts each: back squat, shoulder press, deadlift. Score = sum of the three bests.* ❌ **F9**
Needs an attempts model (N attempts, best counts, failures allowed) plus cross-block score composition.

**34. Tempo Front Squat 4×6 @ 30X1, rest 2m** ✅ — tempo as a target works exactly as specified.

### Endurance

**35. 8×400m @ 5k pace, 90s rest** ✅

**36. Rowing pyramid — 250/500/750/1000/750/500/250m, rest equal to the work interval just completed** ❌ **F7**
Distances are a literal list (fine). Rest duration referencing the *measured duration of the preceding step* is not expressible.

**37. Bike: 10m warmup ramping 50%→75% FTP; 4×(8m @ 95% FTP, 4m @ 55% FTP); 10m cooldown** ✅
Ramp, nested repeat, and % FTP targets all work. This is the shape the Zwift/FIT exporters consume.

**38. Swim: 10×100m on a 1:45 send-off** ✅
Start every 1:45 regardless of finish; remaining time is rest. **This is the same container as EMOM** — a satisfying confirmation that the clock-driven repeat generalizes across modalities.

### Hyrox

**39. Hyrox Open — full race** ✅
```
for time:
  8 rounds:
    - 1km Run
    - station                     # station varies by round
score: time
variants:
  men:   { sled_push: 152kg, sled_pull: 103kg, farmers: 2x24kg, sandbag: 20kg, wallball: 9kg @ 10ft }
  women: { sled_push: 102kg, sled_pull: 78kg,  farmers: 2x16kg, sandbag: 10kg, wallball: 6kg @ 9ft }
```
Encoded as an explicit 16-element sequence (run, ski, run, sled push, run, sled pull, run, burpee broad jump, run, row, run, farmers carry, run, sandbag lunge, run, wall balls). Divisions fall straight out of variants. **Hyrox needs no special support** — the pre-test worry was unfounded. Roxzone transition time is implicit in total time and needs no representation.

**40. Hyrox Doubles** ❌ **F8, F11**
Same 8 runs and 8 stations, but both athletes run together (within 15 seconds of each other), and station work is split **however the pair chooses** — alternating reps, uneven splits, self-selected changeover points. The rulebook explicitly declines to prescribe the split.

Same class as Murph: totals plus constraints, no timeline.

---

## Recommended model changes

1. **Add a second workout kind: tally blocks** alongside timeline blocks (F8) — totals only, plus a shared/per-athlete flag. Highest priority: architectural, affects the runtime and every exporter, and covers two of the most popular workouts in existence.
2. **Promote scoring to a designed subsystem** (F9): per-round capture, aggregate functions, ordered tiebreak checkpoints, mixed-unit totals, attempt models, failure-point scores.
3. **Generalize prescriptions to expressions over iteration index and reference values** (F1, F5, F6, F7) — one mechanism covers ascending reps, bodyweight loads, training maxes, cross-block references, and dynamic rest. Requires an athlete-profile record.
4. **Add the `remainder` completion condition and unbounded/until-failure repeats** (F2, F3).
5. **Add an interrupt-overlay container** (F4).
6. **Add exactly two structured execution constraints** (F11): `unbroken` and `synchronized`. Everything else — "one works at a time," "within 15s" — goes in free-text notes. No constraint language.
7. **Demote rep schemes to sugar** over explicit per-round expansion (from 25.2).
8. **Settle side-as-identity** in the registry (F10).
