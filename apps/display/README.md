# Board

The workout as written, with a marker for where you are.

```bash
node scripts/build-web.mjs      # emit the core as browser modules
node scripts/serve.mjs 8081
open http://localhost:8081/          # or go straight to /apps/display/
```

Drop a `.wdl` on it, paste one in, or pick a sample. The URL carries the
workout in its fragment, so a board is a link — paste one over the address bar
of a board already running and it switches.

## What it does and does not do

**It renders the source text, line for line.** Not the parsed structure, not a
generated layout. Rendering the cue list would be easier and would quietly
assert that what you wrote was not good enough to read. If the format only works
once a program has reformatted it, the format has failed.

Everything the runtime knows sits outside the text: a marker in the left gutter,
and a bar above with the current cue, the round, and the clock. The gutter is a
fixed width so the text never shifts when the marker moves — a line that jogs
sideways as the cursor arrives is unreadable at a glance.

**A line dims only when nothing still to come points at it.** In `21-15-9` the
pull-up is behind you three times and finished only the last. Dimming it after
the first round would say the workout is nearly over with a third of it left.

**A timed cue counts down and advances itself; everything else waits.** That
distinction is `run`'s, not this app's — the core already decides which cues end
by themselves. A timed cue that overruns keeps counting, in red, rather than
sitting at zero pretending you finished.

**An AMRAP loops rather than being expanded.** `run` emits one pass and reports
the cue range that comes round again; the board counts the passes. Expanding it
would mean inventing a number of rounds.

**A section loops, not the whole board.** A buy-in, an AMRAP and a buy-out is
one workout with one part that repeats: the run happens once, the middle comes
round until its clock stops it, and the row waits its turn. The board loops the
range `run` names, so the buy-in dims behind you while nothing inside the AMRAP
ever does.

**The section's clock ends the section where you stand.** It is the outer
deadline, so it is checked before the cue's own — the last row of a 20-minute
AMRAP does not get its three minutes because it started at 19:00. A section with
no clock ends when the athlete says so, which is what `End section` is for.
Stepping back into a section does not restart its clock; that is how a mis-tap
is undone, not a way to buy another twenty minutes.

## Where the work actually happens

Nothing here parses or compiles anything. `@wdl/core` does that, and this file
holds the two things the core deliberately does not have: a clock, and a
position in the cue list. Keeping those out means the same run script drives a
screen, a watch and a test.

The core is handed its data rather than fetching it, so the registry arrives by
`fetch` here and by `readFileSync` on Node. The board still runs without it —
validation hints go quiet and it says so in the console.

## Keys

| | |
|---|---|
| `space` | advance an athlete-paced cue, or pause a timed one |
| `→` `←` | next, back |
| `e` | end the section you are in, when one repeats |
| `r` | reset |
