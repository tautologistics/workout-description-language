# Blockers

## Active Blockers

- None. The queue in [../tasks/current.md](../tasks/current.md) is empty —
  every numbered item raised so far is closed.

## Accepted Risks

The full list of things known to be wrong and left that way, by area (registry
merges, the parser's open questions, app-level defects), is
[../topics/known-debts.md](../topics/known-debts.md) — check it before treating
something odd as a new discovery. Two worth naming here because they shape
near-term design:

- **`Bike` is a modality, not a movement, and the registry has no word for
  that.** `assault bike` collides with the `Bike` lump on purpose; withdrawing
  the alias or merging the record are both worse than the collision. See the
  entry in known-debts.md for what a fix would need.
- **A result's loads are keyed by movement**, so a session that ramps a lift
  mid-workout can only record one figure for it. Unaddressed because nobody
  has asked for the finer-grained spelling yet.
