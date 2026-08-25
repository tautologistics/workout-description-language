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

## Two things that are never in doubt

- The at-rest format must read on a whiteboard. That is a hard constraint, not a
  preference.
- When something lands, update the file in `docs/context/` that owns the fact,
  and record corrections rather than editing history — the wrong turns are the
  expensive knowledge. [docs/context/INDEX.md](docs/context/INDEX.md) says
  which file owns what.
