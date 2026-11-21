# A tonnage score (reps × load), with unscored steps and a per-bodyweight form

- **Date:** 2026-11-21
- **Classification:** inexpressible (the score, the unscored step, the
  per-bodyweight form) / held, and silently (see "A defect found on the way")
- **Status:** open, queued as **G1** in `docs/context/tasks/current.md`
  (the tonnage score plus unscored steps). The defect below is queued
  separately as **B1**. Scope narrowed by Chris on 2026-11-21; see "Scope
  decisions".
- **Related:** spec §9 (Scoring), §8.4 (athlete-determined load), §5.11
  (`synchronized`, a step-level scoring keyword); results-0.1.md `loads:` and
  `measure: load` ("the heaviest, not the total"); results-0.1.md "Deliberately
  absent: a leaderboard"; [2026-11-19-per-round-change-beyond-reps.md](2026-11-19-per-round-change-beyond-reps.md)
  (a load drop partway through, recorded on a result)

## The workout as intended

Chris designed this benchmark for a group whose racers always grab light
weights so they can finish first. Changing the score from time to total
weight moved is meant to reward going heavy:

> Gross Tonnage (40-minute AMRAP): 8 deadlifts, 8 DB front squats, 8 DB bench
> presses, 8 DB bent-over rows (both arms at once), 8 DB push presses, 8
> alternating DB reverse lunges (8 in total), 8 pull-ups. Each athlete picks
> their own load for each movement and keeps it. If they have to drop a load,
> they note the round where they dropped it, so the total stays accurate. DB
> loads count both bells. **The score is total tonnage: reps × load, summed
> over every movement except the pull-ups.** The pull-ups set the pace and
> score nothing. Tonnage is the personal benchmark. **Tonnage ÷ bodyweight is
> the score for comparing athletes.**

On the board: `40:00 AMRAP — score = total lb moved (pull-ups don't count) ·
÷ BW to compare`.

The score is what this workout is for. The movement list is ordinary. The
tonnage score is what makes it a different workout from the same AMRAP
scored by rounds + reps.

## The closest WDL today

```wdl
# Gross Tonnage

// Pick one load per movement and hold it. Drop only if you must, and note the round.
// Score = reps x load on every scored movement. DB loads count both bells.
// Pull-ups pace the round and add nothing to the score.
AMRAP 40min:
  - 8 Deadlifts
  - 8 DB Front Squats (both)
  - 8 DB Bench Presses (both)
  - 8 DB Bent-Over Rows (both)
  - 8 DB Push Presses (both)
  - 8 DB Reverse Lunges (split), alternating
  - 8 Pull-Ups

score: tonnage
```

`wdl check` says:

```
tonnage40.wdl: ok
```

## What that loses

- **The score is held, and nothing says so.** `score: tonnage` is kept as
  text, and `wdl check` reports `ok`. Nothing reads it: the board, a result's
  score check ("a primary this project has not modelled is not checked at
  all"), and a ranking all have nothing they can compute. Leave the line out
  and the AMRAP falls back to `rounds + reps`. That is the exact score this
  workout exists to replace.
- **Which steps count is only in a comment.** The pull-ups look the same as
  the scored steps. A tool computing tonnage would either add the pull-ups at
  zero load (harmless only by accident) or, with a BW-relative load model,
  count them at bodyweight. That would reverse the coach's rule.
- **The per-bodyweight form has nowhere to go.** No `score:` spelling divides
  by a reference value. A result record has no field for bodyweight on the day.
  `BW` resolves against an athlete profile (§8.2), but a profile's bodyweight
  changes over time, so the number used at comparison time can't be recovered.
  Ranking across people is deliberately absent from results-0.1, and this case
  doesn't change that. What's missing is the **per-athlete** normalized number,
  which is a fact about one result.
- **"Pick a load and hold it" is only a comment.** §8.4's `building` means a
  load that goes up and has no target. Nothing says "athlete's choice,
  constant". The result side does handle this: one `loads:` line per movement
  is exactly "the load you held". A drop partway through is the per-round
  change already open in the 2026-11-19 report, seen here from the result
  side.
- **Scoring by tonnage needs the timeline to know about partial rounds.** A
  rounds + reps result (`7 + 23`) is enough to compute tonnage, because the
  reps-into-the-round fall on known steps in order. That only works if the
  score reader walks the timeline. It doesn't today.

## Candidate notations

1. **`score: tonnage` as a new primary, plus a step keyword to exclude a step**
   ```
   AMRAP 40min:
     - 8 Deadlift
     ...
     - 8 Pull-Up, unscored
   score: tonnage
   ```
   `tonnage` is the word gyms use. `unscored` follows `synchronized` (§5.11)
   as a step-level scoring keyword, and it reads plainly on a board. The
   score's value is derived: Σ reps completed × load per scored step, with
   loads taken from the result's `loads:`. Collides with nothing. Open: does
   `unscored` also take the step out of `score: reps`? It should, because one
   meaning is better than two.

2. **Bodyweight-relative as a qualifier on the score**
   ```
   score: tonnage
   compare: tonnage per BW
   ```
   or, on one line, `score: tonnage, per BW`. The board shows the raw
   number. "per BW" is what people say. This needs one new result field,
   `bodyweight: 84kg`, so the divisor is fixed at the moment of the result
   rather than looked up later from a profile. Whether `compare:` is a
   tiebreak-like sibling line or part of the score is the main decision.

3. **Name the athlete's choice in the load slot**
   ```
   - 8 Deadlift @ choice
   ```
   The board then shows "your load" rather than nothing, and a result checker
   can warn when a scored-by-load step has no `loads:` entry. Optional. The
   workout reads fine without it.

## Questions for the syntax session

- Is tonnage a **score** (§9) or a **measure** (goals)? results-0.1 says
  `measure: load` is "the heaviest, not the total". Tonnage is the total, on
  purpose, so it's a different dimension rather than a variant of `load`.
- Units: if loads are mixed (a lb barbell and kg DBs), convert once to kg, as
  `measure: load` already does. Then show which unit on the board?
- `(both)` and `2x24kg`: the per-implement × 2 convention (§3) already gives
  the right number when the load is written `2x50lb`. Is a single `@ 100lb`
  on a `(both)` DB step the pair or each bell? Today it's ambiguous, and
  tonnage makes the ambiguity cost points.
- Unscored steps under `rounds + reps`: does an unscored step still count as
  a rep? (In this workout it would have to, or the pull-ups could be skipped
  for free.)
- Where does `bodyweight:` belong: in the result, in a profile snapshot, or
  both?

## A defect found on the way

**An unread score primary is silent.** `score: tonnage` and `score: wibble`
both get `wdl check: ok`. Spec §11 says held-and-inert must not also be
silent, and the unread-modifier note (§4, "not something the language reads")
is the established way to say so. `validate.ts` reports a *missing* primary
(`score-without-primary`) but not an *unread* one. This is a defect whatever
happens to the tonnage proposal: `score: rounds + rep` (a typo) is held the
same way.

## Scope decisions (Chris, 2026-11-21)

These came after the report was written. The candidates above are left as
they were written, and this section takes precedence over them.

- **In scope (G1):** the tonnage score and a way to mark a step unscored.
  Both are one item. Until G1 lands, a `//` comment saying the pull-ups don't
  score is acceptable.
- **Out of scope:** tonnage ÷ bodyweight. It stays a quoted comment on the
  workout (`// To compare with others: tonnage ÷ bodyweight`). Candidate 2
  and the `bodyweight:` result field are therefore not part of G1.
- **Out of scope:** recording a load dropped at round N. A comment on the
  result saying which round is acceptable, so this case doesn't by itself
  promote the per-round-change report.
- **Queued on its own (B1):** the silent unread-score-primary defect.

## Evidence

- 2026-11-21: Chris, designing a group benchmark ("Gross Tonnage", working title "Tonnage 40") to stop
  athletes picking light loads in order to race. The score is the reason the
  workout exists.
