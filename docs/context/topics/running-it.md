# Running it

The routine actions have a **root `Makefile`** as their single surface — run
`make` (or `make help`) for the list. It is thin wrappers over the `node
scripts/*` commands below, which still run directly; the Makefile is
discoverability, not new build logic. Choice recorded in
[settled-decisions.md](settled-decisions.md); a Makefile (not a root
`package.json`) because the repo is install-free and a `package.json` invites a
lockfile.

```bash
make test        # npm --prefix packages/core test — ~2050 tests, 1 pending, ~10s
make build       # node scripts/build-web.mjs — emit the core as browser modules
make serve       # build, then node scripts/serve.mjs 8081  (override PORT=NNNN)
make registry    # node scripts/build-canonical.ts — rebuild registry/ from its sources
make goldens     # regenerate the golden files, then show what moved
make aliases     # node scripts/check-aliases.mjs — names two records answer to, and who wins
make corpora     # node scripts/describe-corpora.mjs — are SOURCES.json/.md still right
make curation-sheet  # node scripts/export-movement-curation.mjs curation-sheet.csv — the modifier hand-pass sheet
make deploy      # node scripts/deploy-web.mjs   (WDL_DEPLOY_SSH defaults to dreamhost.ae.wex — see "## Hosting")
make deploy-dry  # same, rsync with -n
make clean       # rm -rf build pairs.json curation-sheet.csv
make install     # prints "nothing to install" — the repo is install-free, on purpose
```

Not wrapped (situational, take arguments): `node scripts/find-duplicates.mjs >
pairs.json` (cross-source dup pairs to triage), `node
scripts/import-movement-curation.mjs <curated.csv> [--apply]` (land curated
modifier data), and the `wdl` CLI itself (below).

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

**Curated modifier data (laterality — including `lateralityAxis`, the
`arm|leg|side|hand|direction` a per-side count runs across, since queue item
13a-curation — measures, load, force, mechanic, equipment) lands via
`import-movement-curation.mjs`, from a CSV of the audit sheet, not by hand.**
`make curation-sheet` (`export-movement-curation.mjs`) writes
`curation-sheet.csv` at the repo root (git-ignored — a working artifact): 32
columns in three blocks — IDENTITY, a CURRENT block showing what
`registry/movements.json` holds today (reference only, never read back), and a
blank CURATE block to fill in. `lateralityAxis` sits in *both* the CURRENT and
CURATE blocks (added 2026-08-31), so a curator sees the current axis beside the
blank. Chris reviews the sheet in a spreadsheet and exports it back to CSV in
chunks; `import-movement-curation.mjs` reads only the CURATE cells, per-cell
rather than per-group — a blank cell means "not reviewed" and never touches the
registry, a filled one is an assertion and does. The two scripts share the
column layout by position (two columns are named "Laterality: both"), so a
sheet re-saved with a column moved/renamed/removed fails the header check
loud. Contradictory cells (both Load booleans TRUE, all three laterality modes
FALSE, a `Default laterality` naming a mode not also marked TRUE) are reported
and that one field is left untouched rather than guessed at; everything else in
the same run still applies. Defaults to a dry-run report; `--apply` writes. Run
it before and after chunks the same way — the report before applying is the
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

## Hosting / deployment

*Since 2026-08-30 (queue items 18–19).* There is a public instance at
**`https://wex.androidempathy.com`**, on the DreamHost VPS. **PocketBase**
(v0.40.1) is the backend — Google sign-in and a `workouts` collection — and it
runs as a **per-user systemd service** on that box (`systemctl --user … pocketbase`,
linger enabled so it survives a reboot), fronted by the DreamHost panel's Proxy
Server + panel Let's Encrypt. The panel proxy sends the **whole domain** to
PocketBase, so **the static builder + board are served from PocketBase's own
`pb_public/` directory** (`~/pb/pb_public/` on the VPS) — `apis.Static` serves
that tree at `/` for every path that is not `/api/…` or `/_/…`. `/` redirects
to `/apps/builder/`. Item 20 adds the frontend that calls `/api/…`.

Deploy the static apps (needs SSH to the VPS):

```bash
make deploy       # WDL_DEPLOY_SSH defaults to dreamhost.ae.wex (Chris's ~/.ssh/config alias)
make deploy-dry   # no-write rsync -n
# From another box, override the alias:
WDL_DEPLOY_SSH=androidempathy_wex@wex.androidempathy.com make deploy
# Raw form (bypasses the Makefile default):
# node scripts/deploy-web.mjs [--ssh …] [--dry-run] [--stage-only] [--skip-tests]
```

The `Makefile` sets `export WDL_DEPLOY_SSH ?= dreamhost.ae.wex`, so a bare
`make deploy` works on Chris's box; `?=` still defers to the environment when
it is set, and the value is safe in the repo — it is an SSH-config alias, no
host / user / secret in it. The raw `node scripts/deploy-web.mjs` form does
**not** get the default; pass `--ssh` or set the env var yourself.

`scripts/deploy-web.mjs` runs the core suite (bails on red), runs
`build-web.mjs`, assembles a repo-shaped tree under `build/deploy/pb_public/`
(the apps fetch by relative path, so the served tree mirrors the repo — `apps/`,
`build/web/core/`, `spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
`examples/goals/`, plus a generated `index.html`), then `rsync -az --delete` it
to `~/pb/pb_public/`. No PocketBase restart needed. Flags: `--dry-run`,
`--stage-only`, `--ssh`/`WDL_DEPLOY_SSH`, `--remote-dir`/`WDL_DEPLOY_DIR`. Full
detail — the MIME finding (`.ohm`/`.wdlg` land as `text/plain`, and are
`fetch().text()`d anyway) and the cache decision (PocketBase sends
`Last-Modified` only; accepted as-is) — is in
[`deploy/README.md`](../../../deploy/README.md) "## 10. Static apps".

- **Admin UI:** `https://wex.androidempathy.com/_/` (superuser `chris@winberry.net`,
  password in Chris's password manager — not the repo).
- **Runbook:** [`deploy/README.md`](../../../deploy/README.md) — install, the
  panel proxy setup, PocketBase upgrade, SQLite backup/restore, and the
  "port 8090 exposure" known issue (open DreamHost firewall ticket).
- **Config templates** committed under `deploy/`; secrets are gitignored.
- No new local commands. The apps' test/build/serve commands above are
  unchanged; a production static deploy is item 19's `deploy/` script.
- **Item 20 (accounts / sharing) — live since 2026-08-30.** The apps also call
  the co-located PocketBase at **`/api/…`** (same origin, no CORS) through
  `apps/shared/pocketbase.js` — a hand-rolled `fetch` client, no SDK, no new
  dependency. Nothing to install or run locally; against a dev server with no
  `/api` the sign-in and *My workouts* controls simply report the call failed.
  Google sign-in uses a second redirect URI
  (`…/apps/builder/auth-callback.html`) registered alongside PocketBase's own —
  see [`deploy/README.md`](../../../deploy/README.md) §8 and "## 10".
