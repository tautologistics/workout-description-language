# Agent skills

Skills checked into this repo that coding agents (Claude Code, Codex, and
others) discover automatically. The first one is **`wdl-author`**: it turns a
workout request into WDL, and writes a syntax-gap report when the language
can't say it cleanly.

## Where they live and how agents find them

```
.agents/skills/<name>/SKILL.md   the real files (the cross-agent location)
.claude/skills/<name>            symlink → ../../.agents/skills/<name>
```

- **Codex** reads repo skills from `.agents/skills/`, scanning from the
  working directory up to the repo root
  ([OpenAI docs](https://developers.openai.com/codex/skills)).
- **Claude Code** reads project skills from `.claude/skills/`. The symlink means
  there's one copy. This follows the precedent `AGENTS.md → CLAUDE.md` already
  set in this repo.
- The format is the open Agent Skills standard: a folder with a `SKILL.md`
  whose YAML frontmatter has `name` and `description`, plus optional
  `references/` and `scripts/`. Other tools that follow the standard and look
  in `.agents/skills/` pick it up too.
- **An agent with no skill support** (a plain chat window) can still use it:
  paste or attach `SKILL.md` and `references/cheatsheet.md`. The skill tells it
  to say its draft hasn't been machine-checked when it can't run the
  validators.

*Confirmed 2026-11-21:* Claude Code follows the symlink. `wdl-author`
appeared in a fresh session's skill list.

## Installing from outside this repo

The same `.agents/` folder is also a **Claude Code plugin** (`wdl-skills`),
listed in a **marketplace** at the repo root, and `npx skills` finds it too.
There's still one copy of every file:

```
.claude-plugin/marketplace.json     the marketplace "wdl"; lists one plugin, source ./.agents
.agents/.claude-plugin/plugin.json  the plugin "wdl-skills"; its skills are .agents/skills/*
```

Installs come from the **public GitHub mirror**,
https://github.com/tautologistics/workout-description-language. It mirrors
`origin` (the home-LAN Gitea), so a change is installable once it has been
pushed and mirrored.

**Claude Code, as a custom marketplace:**

```
/plugin marketplace add tautologistics/workout-description-language
/plugin install wdl-skills@wdl
```

**Any agent the skills CLI supports (Claude Code, Codex, Cursor, and others):**

```bash
npx skills add tautologistics/workout-description-language --skill wdl-author
```

**An installed copy isn't inside the WDL repo**, so it can't see the spec, the
CLI or the registry by relative path. `scripts/wdl-home.sh` finds a WDL
checkout in this order:

1. `$WDL_HOME`
2. The working directory and its parents
3. A cached clone of the GitHub mirror: shallow and sparse, about 7 MB and
   around 1.5 s the first time, under `${XDG_CACHE_HOME:-~/.cache}/wdl-author/`,
   and refreshed at most once a day. `$WDL_CACHE` overrides the location, and
   `$WDL_REPO_URL` overrides the repo (for a fork, or for testing).

The cached clone is read-only to the skill. Gap reports and queue entries are
written only into a real checkout. Otherwise they go in the reply, for the
user to carry over. If even the clone fails (no git, no network), the skill
reads the spec from `raw.githubusercontent.com` when it can fetch pages, and
from its own cheatsheet when it can't. Either way, it says the draft is
unchecked.

Verified 2026-11-21: `claude plugin validate .` (the marketplace) and
`claude plugin validate .agents` (the plugin) both pass. `npx skills add
<repo path> --list` finds `wdl-author`. That run caught a real bug: an
unquoted `description:` containing `: ` is invalid YAML to the skills CLI,
though Claude Code had accepted it. The description is now a folded `>-`
block. Keep it that way.

## Adding a skill

1. Create `.agents/skills/<name>/SKILL.md`, with `name:` and a `description: >-`
   folded block.
2. Run `ln -s ../../.agents/skills/<name> .claude/skills/<name>` (for
   in-repo Claude Code).
3. Bump `version` in `.agents/.claude-plugin/plugin.json` so installed copies
   see an update.
4. Re-run `claude plugin validate .agents` and
   `npx skills add . --list`.

## wdl-author

| File | What it holds |
|---|---|
| `SKILL.md` | The workflow: pin down intent → design → write → validate → judge expressiveness → gap report → reply. |
| `references/cheatsheet.md` | "I want to express X → write Y", pointing into spec sections. Every example is machine-checked. |
| `references/known-gaps.md` | Shortfalls already observed, with today's parser behavior and status (open, declined or deferred). |
| `references/gap-report-template.md` | The template for `docs/syntax-gaps/` reports. |
| `scripts/check-movements.ts` | Reports which movements in a `.wdl` the registry resolves. `wdl check` doesn't flag unregistered names. Run it with `WDL_HOME=$(sh scripts/wdl-home.sh)`. |
| `scripts/wdl-home.sh` | Prints a WDL checkout's path: `$WDL_HOME`, then the working directory, then a cached clone of the GitHub mirror. |
| `scripts/verify-cheatsheet.sh` | Runs `wdl check` on every ```` ```wdl ```` block in `references/`. Run it after editing them. |

Gap reports land in [syntax-gaps/](syntax-gaps/README.md), an inbox for
future syntax sessions.

## Guesses made while building it, and open questions

Chris asked for this to be built without stopping to ask questions, with every
guess recorded for review. Each item gives the guess that was built, so a
different answer is a known change rather than an archaeology exercise.
Strike through and annotate each one when it's decided, rather than
deleting it. **Decided 2026-11-21: #3, #5, #7, #11.** The rest are still
guesses.

### Packaging and discovery

1. **Skill name `wdl-author`.** Alternatives: `wdl-workout`, `write-workout`.
   It's short, and leaves room for siblings (`wdl-review`, `wdl-convert`).
2. ~~**The real files live in `.agents/skills/`, and `.claude/skills/` is a
   symlink.**~~ **Verified 2026-11-21:** Claude Code follows the symlink.
3. ~~**"A discoverable set of skills, optionally loaded from a source."**~~
   **Decided 2026-11-21 (Chris):** installable both as a **custom Claude Code
   marketplace URL** and through **`npx skills`**, from the public GitHub
   mirror `tautologistics/workout-description-language`. An installed copy
   finds the spec and tools locally first, then falls back to a cached clone
   of that mirror. Built; see "## Installing from outside this repo".
4. **A plain chat window (ChatGPT web, claude.ai) gets no automatic
   discovery.** The skill degrades gracefully if it's pasted in, but nothing
   publishes it there. **Question:** does that matter, or is "agents working in
   a checkout of this repo" the real audience?

### Behavior

5. ~~**It drafts first and asks later.**~~ **Decided 2026-11-21 (Chris):
   draft first.** It makes coaching calls on anything unstated and lists them
   under *Assumptions*.
6. **Loads when the athlete is unknown:** prefer RPE, `% 1RM`,
   `heavy`/`moderate`/`light`, or an rx split over a made-up absolute number.
   **Question:** would you rather it default to your own numbers? That would
   mean an athlete profile the skill can read, which doesn't exist yet.
7. ~~**Where a finished workout goes.**~~ **Decided 2026-11-21 (Chris):**
   print it as a raw text block, or ask where to save it. As built, it always
   prints, then asks whether and where to save, suggesting a filename but
   never a location. It writes into `examples/workouts/` (which feeds the
   hosted DB) only when told to in so many words.
8. **Default equipment:** a standard gym. Default units: whatever the request
   uses, otherwise lb (the language's own unitless-load default).
9. **Movement names that aren't in the registry** are kept and flagged, with a
   suggestion to add them. The skill doesn't edit `registry/movements.json`
   itself (it's the hand-curated layer).

### Gap reports

10. **What counts as a gap:** anything *held* (unread text carrying meaning),
    *approximated*, *verbose* (repetition no coach would write) or
    *inexpressible*. A pure human cue in a `note:` or `//` comment is **not** a
    gap. A missing registry movement is **not** a syntax gap.
11. ~~**Where reports go.**~~ **Decided 2026-11-21 (Chris):** add them to
    the task queue, marked as raised from a real workout. *As built (an
    interpretation, so worth a glance):* the detailed report still goes in
    `docs/syntax-gaps/`, and a short queue entry marked **Raised from a real
    workout** goes under `## Syntax gaps raised from real workouts` in
    `docs/context/tasks/current.md`, linking to it. A gap from a hypothetical
    or a test gets a report but no queue entry. As of 2026-11-21 the queue
    holds B1 (an unread score primary passes `wdl check` silently) and G1 (a
    tonnage score with unscored steps), both from "Gross Tonnage". G2 was
    considered and not queued (Chris: a comment covers that case). If you'd rather drop
    the separate reports and put everything in the queue entry, that's a small
    change to the skill's step 6.
12. **Reports propose but don't decide.** Each one carries 1–3 candidate
    notations. The skill never edits the spec or grammar.
13. **One seed report** was written from the skill's own dry run:
    [per-round change beyond reps](syntax-gaps/2026-11-19-per-round-change-beyond-reps.md).
    *Update 2026-11-21:* "Gross Tonnage" brushed against the same shortfall,
    but Chris ruled a comment acceptable there, so it stays unqueued in the
    inbox until a real case needs it.

### Things found along the way (not decided, not fixed)

14. **`wdl fmt` loses a rest range.** `rest 2-3min` is reported as an error
    (`unreadable rest duration`), but `fmt` then writes a bare `rest`, which
    means *unbounded*. Text is lost and the meaning flips. This looks like the
    same class of bug as the closed "spelled-out rest duration" debt. Worth a
    queue item.
15. **The spec's own `- Bike easy` example (§4)** puts `easy` into the movement
    name, so it resolves to nothing in the registry. Either the example should
    change (`- Bike, note: "easy"`), or a trailing intensity word should be
    read.
16. **`wdl check` doesn't report unregistered movements.** The skill works
    around it with `scripts/check-movements.ts`. **Question:** should this
    become a `note` in `wdl check` itself? Then the helper script could go.
