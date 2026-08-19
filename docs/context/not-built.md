# What is not built

The real holes. Not the same as [deliberately-not-done.md](deliberately-not-done.md),
which is the list of things that will *stay* unbuilt and why.

- **Results.** Nothing records what you actually did. `progress` ramps
  *prescribed* volume; whether you finished last week is unknown to it. This is
  the biggest hole and the natural next thing.

  It is also what **load** progression is waiting on. A workout is a class and an
  execution is an instantiation of it; the weight a person put on the bar belongs
  to the instantiation, which is why nothing in the analysis layer reads an
  absolute load and why `Dimension` has no `load`. "Ramp the squat 5% a week" is
  a statement about a series of executions, and there are none to make it about.
  Reasoning in [settled-decisions.md](settled-decisions.md).
- **Sharing, accounts, a platform.** Deliberately far off.
- **Whiteboard photo → WDL.** Interesting, separate project.

The piece of this that is ready to start, with what it touches, is in
[ready-to-pick-up.md](ready-to-pick-up.md).
