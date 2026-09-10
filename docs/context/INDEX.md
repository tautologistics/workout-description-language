# Project Context Index

This is WDL's durable memory: what exists, what was learned the hard way, and
what is still open — so a session can start without re-deriving any of it.
Read this index first, then load only what the task needs from the table
below. Two or three files is normal; all of them is almost never right.

Two things are never in doubt, stated in full in [goals.md](goals.md) and in
[../../CLAUDE.md](../../CLAUDE.md): the at-rest format must read on a
whiteboard, and corrections get recorded rather than editing history — the
wrong turns are the expensive knowledge.

The reflexes worth having, since they are the ones that cost time when missed:

- **Before building anything**, check it is not already built
  ([current.md](current.md) / [topics/what-exists.md](topics/what-exists.md)),
  not settled against ([decisions.md](decisions.md)), and not deliberately
  declined ([goals.md](goals.md) Non-Goals /
  [topics/deliberately-not-done.md](topics/deliberately-not-done.md)).
- **Before changing how something is structured**, check the decision is not
  already closed — [decisions.md](decisions.md).
- **When something looks wrong**, check it is not a known debt before treating
  it as a discovery — [current/blockers.md](current/blockers.md) /
  [topics/known-debts.md](topics/known-debts.md).
- **When no task is named**, take the next one off the queue —
  [tasks.md](tasks.md).

## Goals

Current project objectives, success criteria, and what is deliberately not a
goal.

-> [goals.md](goals.md)

## Current State

What currently works, active work, blockers, recent material changes, and
immediate next steps.

-> [current.md](current.md)

Load only the linked `current/` subfiles that are relevant to the task.

## Decisions

The structurally significant decisions, indexed with the full reasoning
behind every settled decision — including narrower ones not indexed —
one level down.

-> [decisions.md](decisions.md)

## Tasks

The queue: open, deferred, and completed work, each self-contained enough for
its own session.

-> [tasks.md](tasks.md)

Load only the linked `tasks/` disposition files that are relevant to the task.

## Subject Context

Independently-routable domains of durable knowledge — read only the one the
task touches.

| File | What it holds | Load it when |
|---|---|---|
| [topics/layout.md](topics/layout.md) | Where everything lives, one line per directory. | Before touching a file, or when looking for where something belongs. |
| [topics/what-exists.md](topics/what-exists.md) | The capabilities that are built, by area. | Asking "does this already work?" before building it again. |
| [topics/builder-ux.md](topics/builder-ux.md) | Defects and gaps caught by driving the builder, by pane. Unordered; dispatchable individually. | Working on the builder UI, or looking for a small self-contained piece. |
| [topics/settled-decisions.md](topics/settled-decisions.md) | Every design decision that is closed, and what each one buys — full detail behind [decisions.md](decisions.md). | About to change how something is structured — check it is not settled first. |
| [topics/lessons-learned.md](topics/lessons-learned.md) | What cost real time, and the correction each one bought. | Before a change to parsing, analysis, the registry pipeline, or anything with a clock. |
| [topics/known-debts.md](topics/known-debts.md) | Things that are wrong and known to be wrong. | Hitting something odd — it may already be written down. |
| [topics/name-normalization.md](topics/name-normalization.md) | How a movement name is folded and matched on the read side and the write side, across `packages/core` and the apps — and where the builder's palette search diverges from core. | Touching movement lookup, alias matching/storage, `fold()` / `TOKEN_EXPANSIONS`, or the builder palette search. |
| [topics/deliberately-not-done.md](topics/deliberately-not-done.md) | Things not built *on purpose*, with the reason — the detail behind [goals.md](goals.md)'s Non-Goals. | Tempted by an obvious-looking feature. Check here before proposing it. |
| [topics/running-it.md](topics/running-it.md) | Test, build, serve, and the CLI verbs. | Running anything. |
| [topics/security-audit.md](topics/security-audit.md) | The 2026-09-10 hardening sweep: findings by severity on the PocketBase collection rules, the client `filter=` builders, auth and the deploy surface, plus what was checked and found OK. | Touching a collection rule, the client query builders, auth, or the deploy surface — or weighing a hardening item. |

## Keeping it current

**When something lands, update the file that owns the fact** — a shipped
capability belongs in [topics/what-exists.md](topics/what-exists.md) and comes
*out* of [tasks/deferred.md](tasks/deferred.md) or
[tasks/current.md](tasks/current.md) and into
[tasks/completed.md](tasks/completed.md); a road that cost time belongs in
[topics/lessons-learned.md](topics/lessons-learned.md); something known-wrong
and left that way belongs in [topics/known-debts.md](topics/known-debts.md).
This index and the routing hubs (`current.md`, `decisions.md`, `tasks.md`)
change only when a file is added or the high-level picture moves.

**Record corrections rather than quietly editing history.** The wrong turns
are the expensive knowledge, and a reader who does not know a road was tried
will try it again.

This project uses the `project-context` skill's routing convention, adapted
to live at `docs/context/` rather than the skill's default `.context/` — see
[../../CLAUDE.md](../../CLAUDE.md) for why.
