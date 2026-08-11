# Reference data from Garmin Connect

Files captured from Connect's own web endpoints. They are the authority for the
adapter in `packages/core/src/adapters/garmin-connect.ts`, and each one settled a
question that guesswork had got wrong.

| File | Endpoint | What it settled |
|---|---|---|
| `Exercises.json` | `/web-api/web-data/exercises/Exercises.json` | The real catalogue: 47 categories, 1510 exercises, with primary and secondary muscles per exercise. Replaced a third-party extraction that was missing 238 of them. |
| `bechmarks.json` | `/gc-api/workout-service/benchmarks` | The 17 lifts Connect tracks a 1RM for — the list that decides whether `@ 85% 1RM` can resolve to a real weight on a device. |

## What a natively created workout revealed

A strength workout built in Connect's own editor, exported, settled three things
no amount of reading had:

**`weightValue` is expressed in the unit `weightUnit` names**, and `factor` is
grams per unit. A 135lb bar stores as `134.99786` tagged `pound` — Connect's own
UI converts through kilograms and back, so writing pounds directly is *more*
accurate than what its editor produces. A reference library documenting the field
as grams is simply wrong.

**`skipLastRestStep`** is Connect's own name for the trailing-rest rule in
spec §5.2: a rest between rounds does not fire after the last one. Its editor
exposes it as a "Skip Last Rest" checkbox. We set it from the same rule.

**A rest step can end on heart rate**, not just time or a lap button:
`conditionTypeKey: "heart.rate"` with `endConditionValue: 130` and
`endConditionCompare: "gt"`. WDL has no way to say "rest until your heart rate
drops below 130" yet, so this is recorded rather than used.
