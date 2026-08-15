# Layout

Where everything lives. Read before touching a file, or when deciding where
something new belongs.

```
packages/core/src/     the whole language and analysis. Portable — no node: imports.
packages/core/src/grammar/  what the .ohm grammar *means*: one module per area of the
                       language, plus parser.ts, which compiles the grammar and puts
                       all of them on one semantics object.
packages/core/src/grammar/vendor/  ohm-js 17.5.0, checked in. Imported by path, not installed.
packages/core/node.ts  the Node host: reads the data files and hands them to src/.
packages/core/node/    the parts that genuinely need a filesystem.
packages/core/bin/     the `wdl` CLI.
apps/builder/          write a workout: palette, outline, text, live goal feedback.
apps/display/          the board: a workout as written, with a marker for where you are.
registry/              movements, muscles, workouts. Rebuilt by scripts/build-canonical.ts.
examples/              corpus (190 workouts), goals, programs, templates.
spec/                  spec-0.1.md (the format), goals-0.1.md (the rules),
                       grammar-0.1.ohm (normative, every phase-2 line kind, no actions).
docs/context/          this directory: the project's memory. Start at README.md.
docs/                  product_vision_and_roadmap.md, prior art, design notes.
```

That `src/` is portable and is handed its data is a settled decision enforced by
a test — see [settled-decisions.md](settled-decisions.md) before adding an
import to it.
