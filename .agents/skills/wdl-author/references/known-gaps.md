# Known gaps (as observed 2026-11-19)

These shortfalls were already seen when the skill was written. Check here and in
`docs/syntax-gaps/` before you open a new gap report. If a request hits one of
these, still mention it in the reply's **Fidelity** section. If it gives a new
real-world case, add the case to the matching report in `docs/syntax-gaps/` (or
create that report if none exists yet). Each entry says what the parser does
today, so you can describe the loss precisely.

Status key: **open** means nobody has decided anything. **declined** means it
was settled against on purpose, so cite the reason rather than re-proposing
it. **deferred** means spec §15 parks it for 0.2+.

| # | Shortfall | Today's behavior | Status |
|---|---|---|---|
| 1 | **A load change per round:** `5 Back Squat, +10lb each round` | Held as unread text. Only whole-rep `+N`/`-N` is read (spec §8.1 says so). Every round gets the same load. Workaround: spell out each round, which is verbose. | open |
| 2 | **A distance or duration change per round:** `200m Run, +100m each round` | Held as unread text, same cause as #1. | open |
| 3 | **A rest range:** `rest 2-3min`, `rest 60-90s` | `check` reports an **error** (`unreadable rest duration`). **`wdl fmt` then writes a bare `rest`, so the bound is lost and the line now means unbounded rest.** The silent rewrite is a defect, separate from whether ranges should read. | open (the fmt loss looks like a bug) |
| 4 | **A distance or duration range on a step:** `100-150ft Farmers Carry` | Held, reported as a note, and fmt moves it after a comma. Declined for now: distance and duration ranges are a different shape from rep ranges (`docs/context/tasks/completed.md` in the WDL repo, "`100-150ft`"). | declined (for now) |
| 5 | **Set techniques:** drop sets, rest-pause, cluster sets (`cluster 1.1.1.1.1`), myo-reps | Held as unread text. Nothing models the intra-set structure, so volume and timeline see one plain set. | open |
| 6 | **An intensity word on an open step:** `- Bike easy` (the spec's own §4 example) | `easy` is folded into the **movement name** (`Bike easy`), which resolves to nothing in the registry and silently drops out of analysis. Use `- Bike, note: "easy"` or `@ easy pace`. | open (the spec example contradicts the registry) |
| 7 | **Independent ladders on two movements** (not an exact reversal) | Spec §5.3 says to write it as two blocks, which loses the "same round" pairing. | open (the spec accepts the cost) |
| 8 | **The load or movement changing per tier of a ladder** (Open 25.2 shape) | Spec §5.3 says a rep scheme is sugar, so you write an explicit sequence instead. Correct, but verbose. | open (accepted by the spec) |
| 9 | **Leading `5x5` comes out as trailing `x5`** in canonical output | It reads correctly. Which spelling should be canonical is an open known debt. | open (see known-debts.md) |
| 10 | Partner relay ordering beyond `shared`/`each`/`synchronized`, structured movement standards (depth, ROM), gym dialect files, extension attributes | Not expressible. | deferred (spec §15) |
| 11 | Execution strategy for a team: who goes when, strict alternation | Deliberately not represented. Use a `//` comment. | declined (spec §5.11) |
| 12 | **A tonnage score** (reps × load), and steps excluded from the score | `score: tonnage` is held **with no note** (`wdl check: ok`, the same as `score: wibble`, which is a defect queued as B1). Nothing marks a step unscored, so use a `//` comment. Tonnage ÷ bodyweight is a quoted comment by decision, not a gap. See `docs/syntax-gaps/2026-11-21-tonnage-score.md`. | open, queued as G1 |

A movement that's **missing from the registry** is not a syntax gap. Flag it
under Assumptions and suggest adding it to `registry/movements.json`.
