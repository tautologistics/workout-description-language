# WDL

## Loading context

**Start at [docs/context/README.md](docs/context/README.md).** It is short by
design: the high-level picture, and a table of every other file in that
directory saying what it holds and when to load it.

Then load only what the task needs, from that table. The directory is split by
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
  expensive knowledge. The index says which file owns what.
