# Design decisions that are settled

Closed questions, and what each answer buys. Read this before changing how
something is structured: reopening one of these needs a reason better than "it
would be tidier".

- **Intent lives outside the workout.** Goals are a separate artifact. The same
  workout is good against one intent and bad against another, which is unsayable
  if the intent is inside the file.
- **Two-phase parse.** `readLines` turns indentation into a tree and knows
  nothing about workouts; phase 2 is an ordinary line grammar over it. This has
  paid for itself three times: workouts, goals and programs are each a grammar
  over the same reader.
- **`src/` is portable and is handed its data.** Enforced by a test. It decays
  the moment one module adds one convenient import, and the Node suite would keep
  passing while the browser broke.
- **The text is the document.** Structural edits splice lines in place rather
  than regenerating from the AST, so comments and spacing survive. Canonicalising
  is a button, never a side effect.
- **The board renders source text, line for line.** Not the parsed structure. If
  the format only works once a program has reformatted it, the format has failed.
- **Movement identity survives spelling.** `fold()` depluralizes, so `Pull-Up`
  and `Pull-Ups` resolve to one record. Pluralization is how a name *reads*.

What was *tried* and turned out wrong is in
[lessons-learned.md](lessons-learned.md); what is not built on purpose is in
[deliberately-not-done.md](deliberately-not-done.md).
