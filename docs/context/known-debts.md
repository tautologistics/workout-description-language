# Known debts

Things that are wrong, known to be wrong, and left that way for now. Check here
when something looks odd before treating it as a discovery.

- Three singular/plural duplicates remain in the registry's long tail
  (`Hindu Push-up`, `Rack Pull`, `Squat with Bands`). Pinned by a test so the
  count cannot grow; none used by the corpus.
- `Quad Stretch` scored into the 178 core movements on source agreement. Visible
  when generating with a bare `?`.
- Step-level `rx` and workout-level `variants:` are two mechanisms for one idea.
  `rx` should probably desugar into a variant so `--variant women` covers both;
  it does not yet. Worse than untidy: `stepCue` labels from `targets` only, so a
  step whose load is an `rx` split shows no weight in the builder *or* on the
  board.
- Templates and workouts share the `.wdl` extension, so `wdl fmt` on a template
  is easy to do by accident.
- A capped for-time workout reports `duration: 12:00` in the builder, which
  reads as "this takes twelve minutes" where it means "you have at most twelve".
  `run` does not expose the cap separately from a computed total, so telling
  them apart needs a core change. Same class as the AMRAP `duration`/`window`
  duplication that Chris caught.

- **`@` with no space after it silently destroys the load.** `- 10 Thruster
  @95lb` reads `95lb` as a *flag*, not a target: `/@(\w[\w-]*)/g` runs over the
  whole line before the `@` split, and `\w` matches digits. The load never
  reaches `targets`, so it is invisible to muscle and volume analysis, the
  builder and the board; `wdl check` reports `ok`; and `wdl fmt` rewrites the
  line to `- 10 Thrusters, 95lb`, which is a stable fixpoint of the wrong
  reading. No corpus file writes `@` without a space, which is why 1257 tests
  never saw it. Found by the grammar exploration, pinned as three `pending`
  cases in `test/golden/vocabulary.ts`. The fix is one rule — a flag is `@` not
  followed by a space — and the grammar states it that way already.

- **A target written after a comma is filed as a note.** `- 10 Thruster, @ 95lb`
  puts `@ 95lb` in `notes`, not `targets`. The `@` split runs over the *first*
  comma segment only, so `applyQualifier` never sees a target and falls through
  to its catch-all. Same consequence as the `@95lb` entry above — the load is
  invisible to analysis, the builder and the board, `wdl check` says `ok`, and
  the wrong reading is a perfect fixpoint. Found 2026-08-15 by
  `test/grammar.test.ts`, which reads it as a target; pinned as three `pending`
  cases in `test/golden/vocabulary.ts` and listed as a grammar exclusion.

- **The browser cannot resolve `ohm-js`.** `scripts/build-web.mjs` strips types
  and rewrites `.ts` to `.js`; it does no module resolution, so the bare
  `import * as ohm from 'ohm-js'` in `src/grammar/step-semantics.ts` survives
  into `build/web/core/` and a browser refuses it — *"Failed to resolve module
  specifier"*, confirmed by loading it. **Harmless today**: `src/index.ts` does
  not export the grammar module and neither app imports it, so both still run
  clean. It becomes fatal the moment `parse.ts` imports it. Note that
  `portable.test.ts` does not catch this — it looks for `node:` imports, and
  the failure mode here is a bare specifier. The fix belongs with the swap
  (queue item 0a): copy `node_modules/ohm-js/dist/ohm.min.js` into the emit and
  rewrite the specifier, the same shape as the `.ts` → `.js` rewrite already
  there. Vendoring it into `src/` outright is the other option and is the escape
  hatch [settled-decisions.md](settled-decisions.md) already names.

- An unrecognized step modifier is pushed into `step.notes`, the same array as an
  authored `note: "…"`. Afterwards the two cannot be told apart, and notes are
  rendered — so an unknown token silently acquires the meaning "the author wrote
  a note". Unknown should be held as unknown: preserved, round-tripped, inert.
  Bound up with queue item 0.
- The builder's Indent allows a first-in-document top-level line to be indented,
  orphaning it and invalidating the file. `shift` guards only against negative
  indent, never against having no parent to attach to.

The ones with a plan attached are queued in
[ready-to-pick-up.md](ready-to-pick-up.md); the ones found by driving the
builder are in [builder-ux.md](builder-ux.md).
