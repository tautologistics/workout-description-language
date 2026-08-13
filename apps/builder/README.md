# Builder

Parse, modify, generate — over one document.

```bash
node scripts/build-web.mjs
node scripts/serve.mjs 8081
open http://localhost:8081/          # or go straight to /apps/builder/
```

Open a `.wdl`, drop one on it, or type. Four panes over the same text: the
movements you can draw from, the outline, the text, and what it reads as —
including whether it satisfies the goals you picked.

## What is deliberately not here

**A field per property.** Reps here, load there, a dropdown for laterality. It
would always lag the grammar, and the grammar is the interesting part —
`21-15-9`, `each arm`, `@ 85% 1RM`, `reversed`, `+2 each round` would each need
a widget, and the day the spec grows another the builder silently cannot express
it.

So the outline gives you **shape**: order, nesting, duplication, deletion, with
buttons, because those are genuinely fiddly to do by hand in a text file.
Everything a line *says* stays a line you type, with the movement registry as
autocomplete and the parser reporting what it made of it. The GUI covers what
text is bad at and gets out of the way of what it is good at.

## The palette

The core set — 178 movements — rather than all three thousand. The long tail is
machine variants and rehab work nobody writes into a workout, and a palette you
have to fight is not a palette. Search reaches the whole registry, and matches
on pattern, equipment and muscle as well as name, so `kettlebell` and `squat`
and `lats` all find things.

Click adds where you were last working. Dragging says where explicitly, and the
line lands beside what you dropped it on rather than inside it. Rows in the
outline drag too: the drop indicator sits on the edge the thing will land
against, so what you are aiming at is the gap rather than the row.

**Sets** are whatever is showing, saved under a name. Filter to `kettlebell`,
save it as "Kettlebell day", and it is there next time.

That is deliberately not a new file format. A set is a working preference, not
something a workout depends on — inventing an artifact for it would mean
inventing a grammar, a parser and a place for it to live before knowing whether
anyone wants one. It lives in `localStorage` until it earns more.

## Against your goals

The third pane also asks whether the workout does what you wanted, continuously
rather than when you remember to. Pick a goals file and every edit is checked:

```
no repeat: Push-Up is followed by Burpee; both work chest
no repeat: Burpee is followed by Air Squat; both work quads
cover: core: 1 movements, at least 2 required
```

The rules are the ones from [`spec/goals-0.1.md`](../../spec/goals-0.1.md),
checked by the same `check()` the CLI runs. The builder holds no opinion of its
own about what a good workout is; it only asks the question more often.

Unresolved movements and open-ended workouts are reported alongside, because a
movement with no muscle data is invisible to every rule and an AMRAP makes every
amount a floor. Without the muscle data loaded it says so rather than showing an
empty list that looks like approval.

## The round trip

The text is the document. Structural operations splice the lines in place rather
than regenerating from the AST, so comments, blank lines and your own spacing
survive being dragged around. Canonicalising is a button, not a side effect of
clicking something else — reformatting as you edit moves the caret and rewrites
lines you did not touch, which is how a builder earns a reputation for fighting
you.

The rules about what a thing owns live in [`@wdl/core`'s `edit.ts`](../../packages/core/src/edit.ts),
not here, because they are subtle enough to be worth testing against the whole
corpus:

- A block owns everything indented under it.
- It owns the comments written above it. Moving a block without its comment
  leaves the comment describing whatever landed there instead — worse than
  losing it, because it now says something false.
- It owns the blank line below it. Otherwise moving something down and back is
  not an identity: the spacing creeps a line each time.
- A wrapped inline `{ … }` block is one logical line however many physical lines
  it spans. Writing an edit back to only the first silently drops the rest.
- Dropping a thing into its own subtree is not a move. The naive splice for it
  deletes the block.
- "After a block" means after everything in it, because a block owns its
  contents. Dropping *into* one is dropping after the last thing already there.

Checked over all 190 corpus workouts: touching every line changes nothing about
what any of them means, and moving the first block down and back restores the
file byte for byte.

## What it reads as

The third pane is the honest half. A builder that only shows what you typed is a
text editor; the value is in showing what it *means* — the cue list once rep
schemes are expanded, how long it will take or that it cannot be known, and
every diagnostic the validator has.

Without the movement registry it says so rather than looking clean because half
the checks never ran.
