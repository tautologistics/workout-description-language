# Recent Material Changes

## Changes

- **2026-08-30 — Accounts, saved workouts and sharing in the apps (queue item
  20 code, landed on `origin/main`; live verification + redeploy pending a
  paired Google sign-in).** Final item of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)).
  Additive on the static apps — signed out, nothing changed (`Download .wdl` /
  `Open…` a local file untouched); `packages/core`, the grammar and the spec are
  not touched, a stored workout is its `.wdl` text in a column.
  - **`apps/shared/pocketbase.js`** — a **hand-rolled ~8-call `fetch` client**,
    no SDK (DEC-003 / DEC-008: no npm runtime dep, no build step, same rule that
    vendors `ohm-js`). Google OAuth2 by the **redirect flow**, not the SDK's
    popup+realtime dance: `GET auth-methods` → navigate to Google's `authURL`
    with our `redirect_uri` → `POST auth-with-oauth2` with
    `code`/`codeVerifier`/`redirectURL` → `{ token, record }` into
    `localStorage`; `refreshAuth()` revalidates on startup and clears a stale
    token on 401/403. Records: `create` / `listMine` / `getById` / `update` /
    `remove` against the `workouts` collection. Targeted at PocketBase
    **v0.40.x** route names (checked against the live `/api`); the header
    comment says which and why hand-rolled.
  - **`apps/builder/auth-callback.html`** — the fixed URL Google returns to
    (a redirect flow needs one). Runs `completeSignInFromRedirect()` and
    bounces back to the builder, hash and all. **This URL
    (`https://wex.androidempathy.com/apps/builder/auth-callback.html`) must be
    registered as a second authorised redirect URI in the Google Cloud
    Console** — see `deploy/README.md` §8; without it Google returns
    `redirect_uri_mismatch`.
  - **Builder** — a *Sign in with Google* control and the signed-in identity in
    the header; a **My workouts** dropdown: **Save** (create if new, update if
    opened from the server — explicit, never autosave), *Save as copy*, open a
    saved workout into the editor, rename, delete, and a **visibility** select
    (`private` / `unlisted` / `public`) + **Copy link**. The buffer is stashed
    to `localStorage` across the sign-in redirect so it survives the round trip.
  - **Board** — `/apps/display/?w=<id>` fetches the record and runs it; a
    `#<source>` hash behaves **exactly as before** and wins when both are
    present. A `private`/missing id 404s and the board shows a "not found" line
    (no crash). A `?w=` load leaves the clean id in the address bar rather than
    expanding the whole source into the hash — expanding it would leak the
    source past a later `unlisted → private`.
  - **Share URL is `/apps/display/?w=<id>`**, not a pretty `/w/<id>`: measured
    against the live instance, PocketBase serves `pb_public/` with an index
    fallback (an unknown path returns the root `index.html`), so `/w/<id>`
    can't route without a `pb_hooks` handler — an infra change for no gain over
    a query param on a file that exists. No `scripts/deploy-web.mjs` change:
    both new files ride the wholesale `apps/` copy.
  - **Verified headless** — against the live `auth-methods` endpoint and a
    faithful local fake of the `workouts` collection: sign-in URL construction
    (state + PKCE + `redirect_uri`), the callback token exchange, Save
    create-vs-update (one record, not two), Save as copy, open-into-editor,
    rename, delete, visibility changes, share links resolving for `unlisted`
    and 404ing for `private` to a stranger, the signed-out builder and the
    board's `#<source>` hash both unregressed, light + dark, zero console
    errors. **Not yet done, needs Chris:** the real Google handshake
    (redirect URI + a test-user login), `node scripts/deploy-web.mjs`, and the
    live drive-through. Items 18–20 stay in
    [tasks/current.md](../tasks/current.md) until that passes.

- **2026-08-30 — The builder + board are live at
  `https://wex.androidempathy.com/`.** Queue item 19 of the deployment epic
  ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)).
  Item 19's original plan assumed an editable nginx vhost with its own `root`;
  item 18 voided that — the DreamHost managed VPS gives no root and the panel
  proxy sends the **whole domain** to PocketBase — so the static apps ship into
  **PocketBase's own `pb_public/`** (`~/pb/pb_public/` on the box), which
  `apis.Static` serves at `/` for any non-`/api/`, non-`/_/` path. New
  **`scripts/deploy-web.mjs`**: runs `npm --prefix packages/core test` (bails on
  red), runs `build-web.mjs`, assembles `build/deploy/pb_public/` **repo-shaped**
  (the apps fetch by relative path — `apps/`, `build/web/core/`,
  `spec/grammar-0.1.ohm`, `registry/{movements,movements.canonical,muscles}.json`,
  `examples/goals/`, plus a generated `index.html`), then `rsync -az --delete`
  to the box. SSH target via `--ssh` / `WDL_DEPLOY_SSH`, never baked in. `/`
  redirects to `/apps/builder/` (generated, so `--delete` can't orphan a
  hand-placed file). **MIME:** PocketBase serves `.ohm` / `.wdlg` as
  `text/plain` (Go's content sniffer) and both apps `fetch().text()` them
  anyway, so no rename / `pb_hooks` / config was needed — `.js` is
  `text/javascript`, `.json` is `application/json`. **Cache:** `pb_public` gets
  `Last-Modified` only — no `Cache-Control`, no `ETag` (the `max-age` line in
  PocketBase is `/_/`-only). Accepted as-is: one `rsync` rewrites
  grammar + registry + core together so they can't drift, and nothing is
  content-hash-pinned; the escalation (a `pb_hooks` `Cache-Control` middleware)
  is documented in `deploy/README.md` "## 10. Static apps", not shipped.
  **Deployed and verified live** — drove both apps against
  `https://wex.androidempathy.com/`: builder (129-movement registry, grammar
  parse, body map, goal picker all load), board (`#<encoded-source>` share link
  resolves, Start advances the clock through the 21-15-9 tiers), both light and
  dark themes, zero console errors; `/api/health` and `/_/` unaffected. Items
  18–20 stay in [tasks/current.md](../tasks/current.md); 19 marked done inline.
  Next: **20** — frontend Google sign-in, saved workouts, sharing. Touches:
  new `scripts/deploy-web.mjs`; `deploy/README.md` "## 10"; this file;
  [what-exists.md](../topics/what-exists.md) **Hosting** row;
  [running-it.md](../topics/running-it.md) "Hosting / deployment";
  [layout.md](../topics/layout.md).
- **2026-08-30 — PocketBase is live on the VPS; the deployment epic (items
  18–20) has its backend.** Queue item 18, the first of the epic Chris made top
  priority the same day ([DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage),
  [goals.md](../goals.md) "## Pivots"). **PocketBase v0.40.1** runs on the
  DreamHost managed VPS at **`https://wex.androidempathy.com`** as a per-user
  systemd service — no root on that box, but `loginctl enable-linger` gives
  boot-start + crash-restart, verified across a real reboot. TLS + routing are
  the **DreamHost panel's Proxy Server** (whole domain → port 8090) and panel
  Let's Encrypt, not nginx (panel-owned) — so `deploy/nginx/wdl.conf` is
  reference-only and the committed process unit is `pocketbase.user.service`.
  **Google OAuth2** is wired (Cloud Console client + PocketBase provider) and a
  real sign-in was tested end to end — it creates a `users` record. One
  collection, **`workouts`**: `owner` (relation→users, required), `title`,
  `source` (the `.wdl` body), `visibility` (`private`|`unlisted`|`public`),
  auto `created`/`updated`; write is owner-only, read is
  `owner = @request.auth.id || visibility != "private"`. Applied as a
  `deploy/pocketbase/pb_migrations/` JS migration, clean on v0.40.1. **Nothing
  in `packages/core`, the grammar or the spec changed** — a stored workout is
  its source text in a column. **Known issue, documented:** the panel proxy
  connects over the VPS public IP, so PocketBase must bind `0.0.0.0` and port
  8090 is internet-reachable in plaintext past the TLS proxy; mitigated (auth on
  every route, collection rules, HTTPS `Application URL`), real fix is an open
  DreamHost support ticket to firewall the port. `deploy/` (runbook + templates,
  no secrets) is committed. Items 18–20 stay in
  [tasks/current.md](../tasks/current.md) — they close together; 18 is marked
  done inline. Next: **19** — deploy the static builder/board into
  `pb_public/`. Touches: new `deploy/` tree; [what-exists.md](../topics/what-exists.md)
  **Hosting** row; [running-it.md](../topics/running-it.md) "Hosting /
  deployment"; [layout.md](../topics/layout.md).
- **2026-08-29 — An unread parenthetical after a movement is held, not
  swallowed into the name.** Queue item 14 (top priority, Chris) — the only
  open item that corrupted output silently. `- 12 Around The Worlds (each
  direction)` parsed clean with the parenthetical folded into the movement
  name, so the movement resolved to no registry entry (muscle/volume analysis
  went blank) and `wdl fmt` emitted `... (each direction)s`. Fix is queue item
  5's `unreadableRange` pattern one construct over: a new `unreadableParen`
  production (`"(" (~")" any)+ ")"`) in `qualifiedPart` and `stepPart` **after**
  `laterality` and `rxSplit`, routing the whole parenthetical verbatim (parens
  included) into `Step.unknown`. `validate`'s `unread()` reports it as a
  `note`, `format` writes it back after the read modifiers, and the movement
  name is left clean. Edges: match runs to the first `)` (nested `(a (b) c)`
  not caught); ~15 raw-import registry titles that carry a parenthetical
  (`Front Squat (Clean Grip)`) now peel it to a `note` and resolve against the
  base name. No corpus file writes an unread parenthetical, so
  `interpretations.json` and `registry/workouts.canonical.json` regenerate
  unchanged. Suite **2027 → 2038** (+11 vocabulary/grammar cases), 1 pending
  unchanged. Verified by driving the builder in both themes: movement resolves
  (body map lights chest), diagnostics show the `note`, Canonicalise leaves the
  parenthetical intact. `spec/spec-0.1.md` §4 and §11.1 state the rule and the
  unbalanced-paren behaviour;
  [../topics/settled-decisions.md](../topics/settled-decisions.md) records it
  beside item 5's.
- **2026-08-29 — `pluralize` no longer takes the `s` on a leading modifier.**
  A self-contained defect Chris caught in the builder's "what it reads as"
  pane: `- 12 Bent Over Barbell Row` read as `12 Bents Over Barbell Row`.
  `pluralize` (`packages/core/src/fold.ts`) treats the word before a standalone
  preposition as the head noun — right for `Lateral Burpee over Dumbbell` /
  `Atlas Stone to Shoulder`, wrong when that word is the *first* in the name
  and so a participle, not a noun. Now requires a real word before the head
  (`at > 1`, not `at > 0`); the trailing noun takes the plural instead
  (`Bent Over Barbell Rows`). Every corpus name of the `[noun] [prep] [obj]`
  shape has a word before the noun, so nothing that read correctly moved —
  goldens and `registry/workouts.canonical.json` regenerate unchanged. Suite
  **2025 → 2027** (+2 `fold.test.ts` cases), 1 pending unchanged. Also filed
  from the same session: a `builder-ux.md` "## Outline" note that the outline
  shows no row for a `//` comment (they live only in the Text tab), and queue
  item 11 (a bare-word block header should read as an inert section, not an
  "unrecognized header" error).
- **2026-08-29 — `registry/duplicate-candidates.json` retired; `find-duplicates.mjs`
  is a run-on-demand report.** A defect task off
  [../topics/known-debts.md](../topics/known-debts.md), not a queue item (all
  numbered items are closed). The 694-row file was generated once on 2026-08-12
  and never touched: `find-duplicates.mjs` is not in `build-canonical.ts`,
  nothing reads the file, no test guards it — a stale artefact rotting in the
  tree, the shape the "every pipeline step must be in the pipeline" lesson
  exists to stop. **Option A of three:** deleted the committed file; the script
  now writes its summary to stderr and the candidate JSON to stdout, so `node
  scripts/find-duplicates.mjs > pairs.json` captures a fresh list when a curator
  wants one — the same treatment `check-aliases.mjs` already gets. Option B
  (wire it into the pipeline, pin it with a drift test) was rejected: no
  downstream consumer exists, and the script never merges. Pipeline still
  succeeds, `git status` clean apart from the two intended changes; **2025
  passing, 1 pending**, before and after (the suite does not touch either).
  See [../topics/known-debts.md](../topics/known-debts.md),
  [../topics/running-it.md](../topics/running-it.md),
  [../topics/layout.md](../topics/layout.md).
- **2026-08-29 — The builder's Outline and Text are one tabbed editor pane.**
  Queue item 10 (high priority, Chris). The `<main>` grid went 4 → 3 columns —
  the Outline (structural GUI) and the raw Text `<textarea>`, previously two
  side-by-side full columns a user only ever edits one of, are now two tabs of
  a single `.editor-pane` cell. A tab strip stands in for the two `<h2>` bars;
  the inactive view is `display: none`; `render()` still repaints both, so a
  switch is show/hide only (`lines` is the single source of truth both repaint
  from). The `#dirty` "edited" badge moved onto the Text tab so it stays
  visible from the Outline tab; the `+ movement / + block / + rest` row stays
  with the Outline. Choice persisted in `localStorage['wdl.editor-tab']`,
  default Outline. `@media (max-width: 1180px)` now drops to 2 columns under a
  full-width palette; the 900px stack is unchanged. **No core or test change**
  (the suite does not touch the builder DOM; 2025 passing, 1 pending, before
  and after); verified by driving the builder. See
  [../tasks/completed.md](../tasks/completed.md),
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Layout" and
  [../topics/what-exists.md](../topics/what-exists.md) Apps row.
- **2026-08-29 — The one-line interrupt overlay can state its bound.** A
  defect task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `every 1min: 5 Burpee` (spec §5.8) parsed as an `Interrupt`, but
  a one-token regex in `parseNode` could not see the `every` grammar rule's
  bound tails, so `every 90s x 5: …`, `every 90s for 12min: …` and
  `every 1min until failure: …` were unwritable on one line. `Interrupt` gains
  `count?` / `duration?` / `untilFailure?` — the field names `Block` already
  uses for a clock, one spelling — and `parseNode` reads the head via the
  grammar's own `every` production (`tryHeader`) rather than a second bound
  regex. `format` mirrors the clock header's spelling (no `EMOM` sugar);
  `timeline` carries the bound onto `group.interrupt` and into the outline,
  not into `estimate()`. Suite **2020 → 2025 passing** (+4 vocabulary overlay
  twins, +1 timeline case), 1 pending unchanged. `interpretations.json` and
  `registry/workouts.canonical.json` unchanged — no corpus file writes a
  bounded overlay. Design decision in
  [../topics/settled-decisions.md](../topics/settled-decisions.md); builder
  `»`-caret follow-on left unwired, noted in
  [../topics/builder-ux.md](../topics/builder-ux.md).
- **2026-08-29 — `registry/workouts.canonical.json` is guarded against drift.**
  A test task off [../topics/known-debts.md](../topics/known-debts.md), not a
  queue item. `scripts/build-workouts.mjs` now exports `buildWorkoutsDoc()`,
  the pure core of its derivation (CLI byte-identical, behind a main guard);
  new `packages/core/test/workouts-canonical.test.ts` re-runs it in process
  and asserts equality against the committed file, one `it()` per corpus
  workout modulo the `generated` stamp — the guard `interpretations.json` and
  `vocabulary.json` had and this file did not. Suite **1817 → 2020 passing**
  (+202 workouts, +1 envelope), 1 pending unchanged. No registry file was
  rebuilt. See [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-29 — `Pec Deck` = `Butterfly` = `Machine chest fly`.** A curation
  task off [../topics/known-debts.md](../topics/known-debts.md), not a queue
  item. The three wger-only / wger-sharing records `find-duplicates.mjs`
  cannot compare by construction were checked against their source
  descriptions — all one seated chest-fly machine — and merged, along with
  everkinetic's `Butterfly Machine`, into one curated `pec-deck` record
  carrying `sameAs`. `cable-crossover` stays separate (standing, cable,
  `force: push`, four sources). **3112 → 3109 records; pool 128 → 129.** No
  corpus workout names any of them, so the golden snapshot did not move.
  `generate.test.ts`'s pool-size pin went 128 → 129. See
  [../topics/known-debts.md](../topics/known-debts.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-25 — The queue emptied out.** Items 5 (a distance/duration range
  is caught rather than silently swallowed into the movement name), 7 (a body
  map, front and back, in the builder and on the board), and 9 (the board
  runs a cap as a clock, stopping where the cursor stands rather than
  claiming the end) all closed, on separate branches merged the same day.
  Every numbered item raised so far — the whole 0-series, 1, 1a, 2, 3, 4, 5,
  6, 7, 8, 8a and 9 — is now closed; see
  [../tasks/completed.md](../tasks/completed.md). Also landed the same day:
  the builder's outline caret now does real per-row movement completion
  instead of an empty native datalist, an indent guard against orphaning a
  first-in-document line, distinct rail colours for back-to-back repeating
  blocks, the builder's summary showing a workout's scoring rule, and the
  body map's anatomical shapes were swapped in from a real reference source.
- **2026-08-23 — A load can be a word.** `heavy`, `moderate`, `light`,
  `unloaded` are a fifth `Load` kind, `qualitative`, so a target like `@ heavy`
  is visible to anything checking for a load instead of sitting inert in
  `raw`. Queue item 6, closed. See
  [../tasks/completed.md](../tasks/completed.md) and
  [../topics/what-exists.md](../topics/what-exists.md).
- **2026-08-23 — Results and `measure: load`.** A new `.wdlr` record type, the
  board writing one when a session ends, and a `progress` goal rule that can
  ask "did the load go up" across a series of them. The largest single piece
  of work in the queue's history; decisions and defects found while building
  it are split across
  [../topics/settled-decisions.md](../topics/settled-decisions.md) and
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-23 — The generation pool became a judgement, not a score.**
  `mark-core` no longer lets catalogue agreement alone put a movement in the
  pool `wdl generate` draws from; **178 → 129**. Queue item 4, closed.
- **2026-08-23 — Registry merge cleanup.** An explicit alias now outranks a
  record's own id (queue item 8a); `sameAs` lets a curator merge two records
  that are one movement, and a source's entry can be redirected to the right
  record without merging (the `Air Bike` split). `check-aliases.mjs` is down
  to one open collision (`assault bike` on `Bike`). See
  [../topics/known-debts.md](../topics/known-debts.md).
- **2026-08-16 — `3 RFT:` and free header ordering.** `3 RFT:` reads as
  `3 rounds for time:`, and a block's kind may now be stated in any comma
  position (`for time, 3 rounds:` no longer silently drops the count). Queue
  item 0f, closed.
- **2026-08-15 — The parser became the grammar.** `parse.ts` now matches and
  walks `spec/grammar-0.1.ohm` directly; the regex chain (83 operations) is
  gone. Nine defects closed with it. Queue items 0/0a–0e, closed; the decision
  history is in [../topics/settled-decisions.md](../topics/settled-decisions.md).

Fold an entry into the owning topic file once it stops being *recent* —
this file is for changes that would still change how someone reasons about
picking up new work today.
