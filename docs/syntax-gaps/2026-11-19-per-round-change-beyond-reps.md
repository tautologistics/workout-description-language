# A per-round change in load, distance or time

- **Date:** 2026-11-19
- **Classification:** held (the one-line form) / verbose (the workaround)
- **Status:** open
- **Related:** spec §8.1 ("Only a whole number of reps is read today"); skill
  `known-gaps.md` #1 and #2; the rest-range report isn't written yet (see
  `known-gaps.md` #3)

*This is the seed report, written while building the `wdl-author` skill. It
comes from the skill's own dry run, not from a real request yet. Append real
cases under Evidence.*

## The workout as intended

> "5 sets of 5 back squats, start at 135 and add 10 pounds every set, 2 minutes
> rest."

That's a standard ramp to a working weight. On a whiteboard:
`Back Squat 5x5, 135 +10/set`. The same shape comes up for distance
(`200m Run, +100m each round`, a ladder run) and time (`30s Plank, +10s each
round`).

What matters: the **load is different every round**. Volume (tonnage), the
`progress` goal rules, a result record's per-set loads, and the board's cue for
the current round all need the actual number in each round.

## The closest WDL today

The one-liner the spec itself uses as its §8.1 illustration:

```wdl
5 sets:
  - 5 Back Squat @ 135lb, +10lb each round
  rest 2min
```

`wdl check` says:

```
c2.wdl:2: note: `+10lb each round` is not something the language reads — it is kept as written, and nothing acts on it
```

Or spelled out, which is valid but not something anyone writes on a board:

```wdl
sequence:
  - 5 Back Squat @ 135lb
  rest 2min
  - 5 Back Squat @ 145lb
  rest 2min
  - 5 Back Squat @ 155lb
  rest 2min
  - 5 Back Squat @ 165lb
  rest 2min
  - 5 Back Squat @ 175lb
```

(`xN` can't help here, because every set has a different load.)

## What that loses

- **The one-liner:** every round runs at 135 lb. Tonnage is understated by
  `10+20+30+40 = 100 lb × 5 reps = 500 lb`. The board shows `135lb` in round 5,
  and a `progress` rule on load sees a flat series inside the session. The text
  survives, but nothing reads it.
- **The spelled-out form:** correct, but it's nine lines for a one-line idea.
  The "5 sets" structure is gone, so `score: load per round` has no rounds to
  attach to, and the rest stops being a between-rounds rest (§5.2), which only
  works here because the last rest was left off by hand.

## Candidate notations

1. **Extend §8.1's `+N each round` to take a unit.** It's what the spec
   already writes as its example:
   ```
   - 5 Back Squat @ 135lb, +10lb each round
   - 200m Run, +100m each round
   - 30s Plank, +10s each round
   ```
   The unit decides which field changes: a load unit changes the target, a
   distance or duration unit changes the quantity. Collides with nothing; the
   `-N` direction and the `per-round-below-one` check carry over unchanged.
   Open: a `%` change (`+5% each round`) means percent of what?
2. **A load list on the step:** `- 5 Back Squat @ 135/145/155/165/175lb`.
   It's terse and common in strength notebooks, but `/` already means an rx
   split (§Rx by division) and pick-one-of. Likely a collision.
3. **A load scheme on the header**, mirroring a rep scheme:
   `5 sets @ 135..175lb:`. Reads well for an even ramp, but says nothing about
   the step size, and the meaning of `..` for loads would need defining.

## Questions for the syntax session

- Is candidate 1's "the unit picks the field" rule acceptable, or should a load
  change be marked differently (`@ +10lb each round`)?
- How does a per-round load interact with an inherited header target
  (`5 sets @ 135lb:` plus `+10lb each round` on the step)?
- Should `+5%` be in scope, and is it relative to the starting load or to 1RM?

## Evidence

- 2026-11-19: `wdl-author` skill dry run, "5×5 back squat, 135 + 10 lb per set".
- 2026-11-21: Chris, "Gross Tonnage" ([2026-11-21-tonnage-score.md](2026-11-21-tonnage-score.md)).
  This is the **result** side of the same shortfall. Each athlete holds one
  load per movement, but "if weight needs to be dropped, note at what round it
  changed so the tonnage total is accurate." A result's `loads:` takes one
  value per movement, so `- Deadlift @ 185lb from round 6` has nowhere to go.
  Here the change isn't prescribed in the workout. It's an unplanned drop that
  only the result knows about, and it directly changes a load-weighted score.
  **Chris ruled a comment acceptable for this case (2026-11-21), so it didn't
  get this report queued.** It still counts as evidence for the result side.
