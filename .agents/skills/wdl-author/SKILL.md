---
name: wdl-author
description: >-
  Turn a workout request into WDL (Workout Definition Language) text, and write
  up a syntax-gap report when the language can't express it cleanly. Use when
  someone asks for a workout in WDL / `.wdl` form, or describes a workout to
  write down: a broad type ("a 20-minute couplet", "a Hyrox-style sim"), a goal
  ("posterior chain, kettlebells only, 40 minutes"), or exact movements, sets,
  reps and loads. Also use to convert a workout written in prose, a whiteboard
  photo or another app's format into WDL.
---

# Authoring a workout in WDL

You turn a description of a workout into WDL that is valid, canonical and
reads like a whiteboard. Requests come at three levels of detail, often mixed:

- **A type of workout:** "a short, spicy metcon", "a 5/3/1 squat day", "a
  Tabata finisher".
- **A goal or target:** "build my pull-up volume", "45 minutes, dumbbells and a
  rower, nothing overhead", "something to test my 2k".
- **Exact details:** movements, reps, loads, rests, order, and how it's scored.

Then there's the second half of the job. **When the workout can't be written
tersely and clearly, say so out loud.** Don't bend the workout to fit the
syntax and don't hide the problem. Write a gap report (step 6). Those reports
are how the language finds out what it needs to grow.

## Ground rules

- **The spec is authoritative:** `spec/spec-0.1.md` in the WDL repo for the
  format, and `spec/grammar-0.1.ohm` where the prose and the grammar disagree. [references/cheatsheet.md](references/cheatsheet.md)
  is a quick map *into* the spec, not a replacement for it. If the cheatsheet
  and the spec disagree, the spec wins, and you fix the cheatsheet.
- **The at-rest text has to read on a whiteboard.** That's a hard constraint
  on the project. If the only valid spelling is one a coach would never write
  on a board, that counts as a gap. It isn't a success.
- **Never guess silently.** The language's own rule (spec §12) applies to you
  too. If you had to choose something the request didn't settle (a load, a
  rest, a laterality, a division), list it under **Assumptions**.
- **Draft first; don't ask before drafting** unless the request is truly
  unusable. Make sensible coaching calls, show the draft, and list what you
  assumed. A concrete draft with labelled assumptions is easier to correct
  than a list of questions. *(Chris's call, 2026-11-21.)*
- **Never save a workout without being told where.** Print it as a raw text
  block, then ask whether and where to save it (step 7).

## Where the WDL repo is

This skill can be installed into any project (a Claude Code plugin, `npx
skills`), so the WDL repo it needs may not be the one you're in. The
canonical public copy is
**https://github.com/tautologistics/workout-description-language**. Before
anything else, run:

```bash
WDL=$(sh <skill>/scripts/wdl-home.sh)
```

(`<skill>` is this skill's own directory.) It prints the path of a **WDL
checkout**, a directory with `spec/spec-0.1.md` and `packages/core/bin/wdl.ts`,
found in this order:

1. **`$WDL_HOME`**, if set and valid.
2. **The working directory or any directory above it.** This is the usual case
   when you're working in the WDL repo itself.
3. **A cached clone of the GitHub repo** under
   `${XDG_CACHE_HOME:-~/.cache}/wdl-author/`. The first use clones it (a
   shallow, sparse clone of about 7 MB that takes a couple of seconds), and it
   refreshes itself once a day after that. Override the location with
   `$WDL_CACHE`.

Its stderr line says which source it used. **A cached clone is a read-only
reference.** Read the spec and run the CLI from it, but never write a report
or queue entry into it (step 6 says what to do instead).

If the script fails (no git, no network), fall back in this order:

- If you can fetch web pages, read the spec straight from GitHub:
  `https://raw.githubusercontent.com/tautologistics/workout-description-language/main/spec/spec-0.1.md`
  (and `.../spec/grammar-0.1.ohm`). Then skip step 4.
- Otherwise, write from [references/cheatsheet.md](references/cheatsheet.md)
  alone and skip step 4.

Either way, say plainly that the draft hasn't been machine-checked.

## Workflow

### 1. Pin down the intent

Pull out whatever the request gives you, and fill in the rest from coaching
convention:

| Fact | If it isn't stated |
|---|---|
| Time domain | Infer it from the type ("metcon" ≈ 8–20 min, "strength day" ≈ 45–60 min). |
| Equipment | Assume a standard gym (barbell, rack, DBs, KBs, pull-up bar, rower, bike). |
| Athlete level / loads | Use RPE, `% 1RM`, `heavy`/`moderate`/`light`, or an rx split `(women 35lb / men 53lb)` rather than inventing one absolute number. |
| Scoring | Use the block's default (`for time` → time, `AMRAP` → rounds + reps). Only write `score:` when it differs or matters. |
| Units | Write lb if the request uses lb and kg if it uses kg. Never convert. |

If the request names a goal that matches an existing goal file in
`$WDL/examples/goals/*.wdlg` (for example ramping a muscle group, or rotating
muscles), you can check the draft against it in step 4.

### 2. Design the workout (only when it's under-specified)

Act as a competent coach: give it a coherent stimulus, don't hit the same
muscle back to back in mixed-modal work, use movements the athlete's equipment
allows, and pick sensible rests. Keep the design simple. Use the plainest
structure that delivers the stimulus.

### 3. Write the WDL

Open [references/cheatsheet.md](references/cheatsheet.md) and find each piece of
the workout under "I want to express…". Reach for the spec section it points to
when a shape is unfamiliar. Conventions:

- Two-space indentation. Steps start with `- `. Block headers end with `:`.
- Movement names in Title Case, as they'd appear in the registry (`Pull-Up`,
  `KB Swing`, `Wall Ball`). `wdl fmt` pluralizes them, and that's expected.
- Use `@ <target>` for load, pace, power, height and HR. Put qualifiers after a
  comma. Put laterality in parentheses: `(each arm)`, `(split)`.
- Use `// comments` for human cues that have no structural meaning ("scale to
  ring rows if needed"). **If the workout's *structure* lives in a comment, the
  language didn't express it, and that's a gap.**
- Add `# Title` when the workout has a name. Directives (`@id`, `@tags`) are
  optional. Don't invent an `@id` unless you're saving a file.

### 4. Validate (when you're in the repo checkout)

Write the draft to a scratch or temp file (never into the repo; that's step
7's question), then run:

```bash
node $WDL/packages/core/bin/wdl.ts check draft.wdl      # structure: errors, warnings, notes
node $WDL/packages/core/bin/wdl.ts fmt draft.wdl        # the canonical text to show the user
WDL_HOME=$WDL node <skill>/scripts/check-movements.ts draft.wdl   # names the registry knows
node $WDL/packages/core/bin/wdl.ts timeline draft.wdl   # optional: does it run the way you meant?
node $WDL/packages/core/bin/wdl.ts goals --goals $WDL/examples/goals/<g>.wdlg draft.wdl  # optional
```

Nothing needs installing. The repo has no install step on purpose. Read each
result:

- **`check` errors or warnings:** fix them. If the only fix is a contortion,
  that's a gap (step 5).
- **`check` notes saying "`X` is not something the language reads":** the
  language is holding `X` as inert text, and nothing acts on it. That's fine
  for incidental flavor. It's a **gap** when `X` carries something the athlete
  or a tool needs: load progression, set structure, a range, a rule.
- **`UNREGISTERED` / `AMBIGUOUS` from check-movements:** rename the movement to a
  form the registry resolves (search `$WDL/registry/movements.canonical.json` by
  title). If the movement really isn't in the registry, keep the name, flag it
  under Assumptions, and suggest adding it. A missing movement is a registry
  gap, not a syntax gap.
- **`fmt` output differs from your draft:** show the user the `fmt` output.
  That's the canonical form. If `fmt` *loses* information (drops text, changes
  meaning), report it as a defect in the gap report or the reply.
- **The timeline doesn't match your intent** (wrong round count, rest in the
  wrong place): the text means something other than what you think. Re-read
  the relevant spec section.

With no checkout at all (the fallbacks above), skip this step. Say that the
draft hasn't been machine-checked and lean harder on the spec or cheatsheet.

### 5. Judge expressiveness

Go through every requirement in the request and classify it:

| Class | Meaning | Action |
|---|---|---|
| **Native** | A language construct says it, and tools act on it. | Nothing. |
| **Note-only** | Only a `note: "…"` or `// comment` carries it, and it's purely a human cue. | Fine. Mention it if it isn't obvious. |
| **Held** | `check` reports it as unread text, and it has meaning a tool should act on. | **Gap.** |
| **Approximated** | It's expressed with a different construct that changes the meaning or loses precision (for example, a load progression spelled out as five separate lines, or a range collapsed to one number). | **Gap.** |
| **Verbose** | It's correct but needs repetition or nesting no coach would write on a board. | **Gap.** |
| **Inexpressible** | Nothing captures it. | **Gap.** |

Before calling something a gap, check that it isn't already known:

- [references/known-gaps.md](references/known-gaps.md): shortfalls already observed.
- `$WDL/docs/syntax-gaps/`: earlier reports. If one covers the same
  shortfall, *add this case to it* rather than opening a new one.
- `$WDL/docs/context/topics/deliberately-not-done.md` and spec §15
  "Deferred to 0.2+". If it was declined on purpose, say so and
  cite the reason rather than reporting it as new. A new real-world case
  against a declined item is still worth recording, framed as fresh evidence.

### 6. Raise the gap (only when step 5 found one)

A gap goes in two places. Both live in the WDL repo, so write them only into
a **writable** checkout: the local or `$WDL_HOME` one, never the cached
clone. If the only checkout is the cached clone, or there's none, put the
report in the reply instead, in the template's shape. Tell the user it belongs
in the WDL repo's `docs/syntax-gaps/` plus a queue entry, and offer to file it
there when they're working in a writable checkout. Don't post it anywhere
(a GitHub issue, say) without being asked.

**a. The report:** `$WDL/docs/syntax-gaps/YYYY-MM-DD-<short-slug>.md`, from
[references/gap-report-template.md](references/gap-report-template.md). It's
meant to go into a later session whose job is to evolve the syntax, so it has
to stand on its own: the workout as the athlete means it, the closest WDL that
exists today, exactly what that loses, and one or more candidate notations
that would read on a whiteboard. Candidates are proposals, not decisions.
Don't edit the spec or grammar from this skill. One report per distinct
shortfall. A workout with two unrelated gaps gets two reports, and each one
links to the other.

**b. The queue item:** add an entry to the
`## Syntax gaps raised from real workouts` section of
`$WDL/docs/context/tasks/current.md` (create it, right after the `## Open`
introduction, if it's missing). Mark it **Raised from a real workout**, naming the
workout and who asked, so it can't be mistaken for speculative design work.
Keep it short and self-contained: the shortfall in one sentence, the
classification, and a link to the report, which holds the detail. When the
gap already has an entry, add the new workout to that entry instead.

**Only a real workout gets queued.** Something the user actually wants to
train or program counts. A hypothetical, a test, or your own made-up example
doesn't, and gets a report with no queue entry. When you can't tell, ask.

### 7. Reply

Give the user, in this order:

1. **The workout:** the canonical text (the `fmt` output) as a raw text block,
   a plain ```` ``` ```` fence with nothing else inside, so it copies cleanly.
2. **Assumptions:** every call you made that the request didn't settle.
3. **Fidelity:** "fully expressed", or the gaps classified as above, with a
   link to each report and queue entry.
4. **Check results:** what you ran and what it said, or that nothing was run.
5. **Where to save it:** ask whether to save it, and where. Suggest a
   filename (`<slug>.wdl`), but don't pick a location. Save only once the user
   names one. `$WDL/examples/workouts/` feeds the hosted database through
   `make workouts:load`, so only write there when told to in so many words.

Keep the explanation short. The workout should mostly speak for itself.
