# Running it

```bash
npm --prefix packages/core test     # 2020 tests, 1 pending, ~10s
node scripts/build-canonical.ts     # rebuild registry/ from its sources
node scripts/describe-corpora.mjs   # report whether SOURCES.json/.md still count the corpora right
node scripts/check-aliases.mjs      # every name two records answer to, and who wins
node scripts/find-duplicates.mjs > pairs.json  # run-on-demand: likely cross-source dup pairs to triage
node scripts/import-movement-curation.mjs <curated.csv> [--apply]  # land curated modifier data
node scripts/build-web.mjs          # emit the core as browser modules
node scripts/serve.mjs 8081         # then open http://localhost:8081/
```

`build-canonical.ts` is the whole registry pipeline and the only way to run any
step of it — `mark-core.mjs` last, because it scores from what the earlier steps
produced. Never run a step by hand: each rewrites the file from the one before,
so a step run alone is erased by the next rebuild. See *Every pipeline step must
be in the pipeline* in [lessons-learned.md](lessons-learned.md).

**Nothing to install.** *Corrected 2026-08-15: for one day this said to run
`npm --prefix packages/core install` first, which was true while `ohm-js` was a
dependency.* It is now vendored into `packages/core/src/grammar/vendor/` and
imported by relative path, because a dependency the core is allowed is still one
the browser cannot resolve — see [settled-decisions.md](settled-decisions.md).
There is no `package-lock.json` and no `node_modules` again.

The CLI: `wdl fmt | check | timeline | export | goals | generate | program | result`.
`--variant <name>` on the first four reads the file as one division — an rx split
or a `variants:` entry, whichever way it was written (spec §10.1). The board asks
the same question through a picker in its footer, and a division chosen there
rides in the URL: `#<workout>&division=women`.

`wdl result <file.wdlr>` checks a result against the snapshot it carries;
`--goals` reads the records as one series, in date order, which is the only way
a `progress` rule about load can be asked. The board writes a `.wdlr` when a
session ends.

The server must be rooted at the repository — the apps reach `build/` and
`registry/` from there.

A change to the apps needs `build-web.mjs` before the browser sees it, and the
board and builder are verified by driving them, not only by the suite — see
*Tests do not read* in [lessons-learned.md](lessons-learned.md).

**Curated modifier data (laterality, measures, load, force, mechanic,
equipment) lands via `import-movement-curation.mjs`, from a CSV export of a
one-off audit workbook, not by hand.** Chris reviews `registry/movements.json`
in a spreadsheet (a CURRENT block for reference, a blank CURATE block to fill
in) and exports it back to CSV in chunks; the script reads only the CURATE
cells, per-cell rather than per-group — a blank cell means "not reviewed" and
never touches the registry, a filled one is an assertion and does. Contradictory
cells (both Load booleans TRUE, all three laterality modes FALSE, a
`Default laterality` naming a mode not also marked TRUE) are reported and that
one field is left untouched rather than guessed at; everything else in the same
run still applies. Defaults to a dry-run report; `--apply` writes. Run it
before and after chunks the same way — the report before applying is the
whole safety mechanism.

**A change to the registry is checked by regenerating the goldens, like every
other change.** `node packages/core/test/golden/generate.ts`, then read the
diff: the digest holds each file's muscle attribution as well as its shape,
pacing and volume, so a merge that moves which record a name points at moves
`interpretations.json` and says so. *Corrected 2026-08-23: for one day this
paragraph gave a by-hand recipe — attribute all 190 files twice, once against
each `registry/movements.canonical.json`, and diff — because attribution was in
no digest and "the goldens regenerated clean" was true and meaningless after a
merge. That gap is closed; the [lessons-learned.md](lessons-learned.md) entry
keeps the case, because the reflex it teaches outlives the recipe.*

**The parser is an Ohm grammar as of 2026-08-15, and it is slower.** Measured on
the day of the swap: parsing all 190 corpus files went from **3.1ms to 172ms**
(55×), the suite from **5.9s to 9.9s**, and `wdl check` on one file from
**0.16s to 0.22s** — the last of those being what anyone actually waits for, and
most of the difference is a one-off 107ms grammar compile rather than the parsing.
Nothing here parses in a loop, so the 55× is a number and not yet a cost; if it
becomes one, keeping a compiled grammar across processes is the known fix.

Anything that calls `parse` outside the CLI must be handed the grammar first —
`import '../node.ts'` on Node, a fetch in a browser. The regenerators in
`test/golden/` do this; `required('grammar')` throws by name if something new
forgets.
