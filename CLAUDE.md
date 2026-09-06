# WDL

## Loading context

This project's durable memory is maintained with the **project-context**
skill, rooted at [docs/context/INDEX.md](docs/context/INDEX.md) rather than
the skill's default `.context/` — this repo already had a well-established
`docs/context/` before adopting the skill, and repointing the many source-code
comments and spec cross-references that name that path outweighed matching
the skill's default location. Invoke the skill at the start of any task that
may read or change durable project knowledge (routing to the right file,
recording a decision, closing a queue item), and otherwise start at
[docs/context/INDEX.md](docs/context/INDEX.md) directly. It is short by
design: the high-level picture, and a table of every other file saying what it
holds and when to load it.

Then load only what the task needs, from that table. Context is split by
*question asked* rather than by topic, so answering "is this already built?"
should not drag in the debts, the lessons and the run commands as well. Two or
three files is normal; all of them is almost never right.

The reflexes worth having, since they are the ones that cost time when missed:

- **Before building anything**, check it is not already built, not settled
  against, and not deliberately declined.
- **Before changing how something is structured**, check the decision is not
  already closed.
- **When something looks wrong**, check it is not a known debt before treating
  it as a discovery.
- **When no task is named**, take the next one off the queue.

If a file turns out not to answer the question, load the next one rather than
guessing — but say which files you read, so a wrong split shows up as a wrong
split rather than as a wrong answer.

## "Launch next task" / "launch next prioritized task"

When Chris says any of **"launch next task"**, **"launch the next task"**,
**"start next task"**, **"launch next prioritized task"** or a close variant,
it is shorthand for this whole sequence — do all of it, in order, without
asking him to repeat the detail:

1. **Land the current work.** Everything committed, merged, and pushed so the
   outcome is live on `origin/main` (this remote routes `git push origin
   <branch>:main` onto `main` directly — confirm the SHA moved with `git
   ls-remote origin main`, don't assume). Regenerate whatever the change
   requires, run the suite, update the owning file(s) in `docs/context/`.
   Nothing half-done is left behind. **Landing stops at `origin/main`.** A
   session does **not** deploy to prod — not `make deploy`, not `make
   deploy:db`, not any `*:load` against the live PocketBase — even as the
   closing step of finished work. Pushing `wex.androidempathy.com` is Chris's
   call and Chris's hand; a session runs those targets only when Chris says so
   in that session, in as many words. See
   [docs/context/topics/running-it.md](docs/context/topics/running-it.md)
   "## Hosting / deployment".
2. **Pick the top-prioritized next task.** Read
   [docs/context/tasks/current.md](docs/context/tasks/current.md) first and take
   its highest-priority open item. If every numbered item is closed, fall back
   to a self-contained defect from
   [docs/context/topics/known-debts.md](docs/context/topics/known-debts.md) or
   one found by driving the builder/board
   ([docs/context/topics/builder-ux.md](docs/context/topics/builder-ux.md)).
3. **Start a new session on it.** Spawn a background-task chip
   (`mcp__ccd_session__spawn_task`) whose prompt is fully self-contained the way
   these task prompts always are — context to read, the situation, the job, how
   to land it, how to update `docs/context/`, and a closing "when done" step
   that tells that session to do this same sequence again. The chain continues
   on its own.

This supersedes nothing else; it is the standing meaning of the phrase.

## Two things that are never in doubt

- The at-rest format must read on a whiteboard. That is a hard constraint, not a
  preference.
- When something lands, update the file in `docs/context/` that owns the fact,
  and record corrections rather than editing history — the wrong turns are the
  expensive knowledge. [docs/context/INDEX.md](docs/context/INDEX.md) says
  which file owns what.
