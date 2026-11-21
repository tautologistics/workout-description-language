# Gap report template

Copy everything below the line into `docs/syntax-gaps/YYYY-MM-DD-<short-slug>.md`.
The report gets brought into a later session whose job is to evolve the
syntax, and that session won't have this conversation. So write it to stand
on its own: no "as discussed", no "see above".

---

# <Shortfall in a few words>

- **Date:** YYYY-MM-DD
- **Classification:** held | approximated | verbose | inexpressible
- **Status:** open
- **Related:** <other gap reports, known-gaps.md #, spec §, known-debts entry, or "none">

## The workout as intended

<What the athlete or coach actually wants, in plain words or whiteboard
shorthand. Quote the original request if there was one. Say what makes this
structure matter: what a tool, the board, or analysis needs to know.>

## The closest WDL today

```wdl
<the best valid spelling that exists now — run it through `wdl check`>
```

`wdl check` says:

```
<paste the output>
```

## What that loses

<Be precise. Which fact is held as inert text, approximated, or repeated? What
does the timeline, volume, goal checking, the board, or an exporter get wrong or
miss because of it? A concrete consequence is worth more than "it's unclear".>

## Candidate notations

Proposals only, not decisions. Each one should read on a whiteboard (a hard
constraint of the project) and fit the spec's design rules (§1): formalize an
existing convention rather than inventing one, keep the one-liner a one-liner,
and keep structure separate from prescription.

1. **<name>**
   ```
   <example>
   ```
   <What it reads as, why a coach would write it this way, and what it collides
   with in the existing grammar, if anything.>

2. **<name>** …

## Questions for the syntax session

- <What has to be decided: semantics, edge cases, interaction with existing
  constructs>

## Evidence

- <Each real-world case that hit this, with date and source. Append to this list
  when the same shortfall comes up again, rather than opening a new report.>
