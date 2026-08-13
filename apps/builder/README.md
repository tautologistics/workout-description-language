# Builder

Parse, modify, generate — over one document.

```bash
node scripts/build-web.mjs
node scripts/serve.mjs 8081
open http://localhost:8081/apps/builder/
```

Open a `.wdl`, drop one on it, or type. Three panes over the same text: the
outline, the text, and what the parser understood.

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
