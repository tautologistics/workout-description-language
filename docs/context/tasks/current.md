# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

### Deployment epic (items 18–20) — new top priority, Chris 2026-08-30

**Why now.** The apps only exist behind a dev server that is constantly
changing under whoever is testing. Chris wants a **stable public URL** he and a
few training partners can use to actually vet the UX and collect feedback,
plus **accounts and saved workouts** so people can build, keep and share
workouts. His words: *"that will help steer and discover things for this
work."* This reverses the standing *"Sharing, accounts, a platform"* Non-Goal —
see [goals.md](../goals.md) "## Pivots" (2026-08-30) and
[DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage). It is **not** a turn toward
competing for adoption; the two project goals (whiteboard-readable text;
check/generate against intent) are unchanged, and none of this touches
`packages/core`, the grammar or the spec — a stored workout is just its `.wdl`
source text in a database column.

**Architecture, decided with Chris 2026-08-30** (full reasoning + rejected
alternatives in [DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage)):
- **Host:** the DreamHost VPS Chris already pays for — $0 marginal cost,
  always-on, no idle-pause / cold-start (the things that ruled out Supabase
  free and the old Heroku hobby dyno).
- **Backend:** **PocketBase** — one Go binary: SQLite, built-in auth incl.
  Google OAuth2, admin UI, REST API. Chris owns the data (one SQLite file to
  back up).
- **Auth:** Google via PocketBase's OAuth2 provider. No passwords, no custom
  auth server (OpenAuth / Auth.js / Auth0 all rejected — see DEC-016).
- **Frontend:** the existing static apps, unchanged in nature. **No bundler,
  no npm runtime deps** — the PocketBase client is either vendored as an ES
  module by relative path (like `ohm-js` in `src/grammar/vendor/`, per
  [DEC-003](../topics/settled-decisions.md) / [DEC-008](../topics/settled-decisions.md))
  or, likely cleaner, a hand-rolled ~6-call `fetch` wrapper against PocketBase's
  REST API. The session picks; do not add a build step.

**Order:** 18 → 19 → 20. 19 can ship the moment the VPS has nginx + TLS even if
18's collections/OAuth are not finished — a public read-only URL is worth
having on its own. The builder-UX items (12 → 16 → 17 → 15, then 13, then 11)
resume after 20, or interleave once the deploy is far enough along to be
useful — Chris's call at the time.

**The pending item-12 chip is superseded in priority, not cancelled** — it is
still valid work, it just is not next. Whoever picks up the queue takes 18.

- ~~**18 — Stand up PocketBase on the DreamHost VPS.**~~ **DONE 2026-08-30.**
  Shipped: PocketBase v0.40.1 live at `https://wex.androidempathy.com`, running
  as a per-user systemd service (no root on the managed VPS, but
  `loginctl enable-linger` → boot-start + crash-restart, verified across a
  reboot). TLS + routing via the **DreamHost panel Proxy Server** + panel
  Let's Encrypt (nginx is panel-owned; `deploy/nginx/wdl.conf` is reference
  only). Google OAuth2 wired and a real sign-in tested end to end (creates a
  `users` record). `workouts` collection with the fields and rules below,
  applied as a `deploy/pocketbase/pb_migrations/` JS migration. `deploy/`
  (runbook + templates, no secrets) committed to `origin/main`. **Known issue
  carried forward:** the panel proxy reaches the daemon over the VPS public IP,
  forcing a `0.0.0.0` bind, so port 8090 is internet-reachable in plaintext past
  the TLS proxy — mitigated, real fix is an open DreamHost firewall ticket (see
  `deploy/README.md` "Known issue: port 8090 exposure"). Left in this file, not
  moved to `completed.md`: 18–20 close together per the epic. Original checklist
  kept below for 19/20's reference.

  *(original)* **Stand up PocketBase on the DreamHost VPS.** *Top priority
  (Chris, 2026-08-30).* Infra, almost no repo code. Steps:
  - **First, verify what the VPS actually allows.** DreamHost's managed VPS has
    historically given SSH but **not root / not systemd**, and restricts
    long-running custom daemons. Confirm over SSH: can you run a persistent
    process (systemd *or* a user-level supervisor — `pm2`, `supervisor`, or a
    `@reboot` cron + `nohup`), open/([reverse-proxy to) a localhost port, and
    install a static binary. If a persistent custom daemon is genuinely not
    possible on the managed VPS, stop and put the fallback to Chris (DreamHost
    "DreamCompute" OpenStack IaaS, or a $5 box elsewhere) rather than working
    around it.
  - **Install PocketBase** (latest stable release binary) under a dedicated
    user, data dir outside the web root.
  - **Process supervision** so it restarts on boot and on crash.
  - **nginx reverse proxy + Let's Encrypt TLS.** Prefer serving PocketBase
    **same-origin** under `https://<domain>/api/` (and `/_/` for its admin UI)
    rather than a separate `api.` subdomain — same-origin means no CORS config
    and the frontend just calls `/api/...`. If a subdomain is unavoidable, set
    PocketBase's allowed origins explicitly.
  - **Decide the domain / subdomain** with Chris (a subdomain of an existing
    domain he controls is fine). This decision also feeds item 19.
  - **Create the superuser**; keep credentials in Chris's password manager, not
    in the repo.
  - **Collections:** `workouts` — `owner` (relation → users, required),
    `title` (text), `source` (text, the `.wdl` body), `visibility`
    (select: `private` | `unlisted` | `public`, default `private`),
    `updated`/`created` (auto). List/view/update/delete rules: owner-only for
    write; read allowed when `owner = @request.auth.id || visibility != "private"`.
    A `profiles`/settings collection only if item 20 finds it needs one — do
    not build it speculatively.
  - **Google OAuth2:** register an OAuth client in Google Cloud Console
    (authorized redirect `https://<domain>/api/oauth2-redirect`), enable the
    Google provider in PocketBase with the client id/secret.
  - **Commit for reproducibility:** a `deploy/` directory in the repo holding
    the nginx vhost, the systemd unit (or supervisor config), and a
    `README.md` runbook — install, upgrade PocketBase, back up the SQLite
    file, restore. No secrets in it.
  - **Deliverable:** `https://<domain>/_/` (admin UI) loads over TLS, a test
    "Sign in with Google" from a throwaway account succeeds, the `workouts`
    collection exists with the rules above, and the process survives a reboot.

- ~~**19 — Deploy the builder + board behind the stable URL (static).**~~
  **DONE 2026-08-30.** Shipped: **`https://wex.androidempathy.com/`** now serves
  the builder (redirect from `/`) and `/apps/display/` the board, with no Node
  process — served from **PocketBase's `pb_public/`** (`~/pb/pb_public/` on the
  VPS), since the panel proxy sends the whole domain to PocketBase and there is
  no separate nginx root (item 18's constraint; item 19's original nginx-vhost
  plan below is void). Repeatable deploy is **`scripts/deploy-web.mjs`**: core
  suite → `build-web.mjs` → assemble a repo-shaped `build/deploy/pb_public/`
  (`apps/`, `build/web/core/`, `spec/grammar-0.1.ohm`,
  `registry/{movements,movements.canonical,muscles}.json`, `examples/goals/`,
  generated `index.html`) → `rsync -az --delete` to `~/pb/pb_public/`; SSH
  target via `--ssh` / `WDL_DEPLOY_SSH`. **MIME:** PocketBase serves `.ohm` /
  `.wdlg` as `text/plain` and the apps `fetch().text()` them, so nothing was
  needed. **Cache:** `pb_public` sends `Last-Modified` only; accepted as-is (a
  deploy rewrites grammar + registry + core in one `rsync`, nothing is
  hash-pinned) — escalation path (`pb_hooks` `Cache-Control`) documented in
  `deploy/README.md` "## 10", not shipped. Verified live in the browser —
  both apps, `#<source>` share link, both themes, no console errors,
  `/api/health` + `/_/` unaffected. Left in this file, not moved to
  `completed.md`: 18–20 close together. Original checklist kept below for 20's
  reference (but the nginx parts do not apply).

  *(original)* No dev server in production. The apps already
  use only relative paths (`../../build/web/core/…`, `../../spec/grammar-0.1.ohm`,
  `../../registry/*.json`, `../../examples/…`, `../shared/…`), so a static host
  just needs the served subtree laid out the way the repo is —
  `scripts/serve.mjs` is the exact behaviour to reproduce.
  - **nginx vhost** with `root` at a deployed copy of: `apps/`, `build/web/`,
    `spec/grammar-0.1.ohm` (and anything else under `spec/` the apps fetch —
    check), `registry/*.json`, `examples/` (the builder fetches
    `examples/goals/…`), plus correct MIME for `.ohm` / `.wdl` / `.wdlg` /
    `.wdlp` (see `serve.mjs`'s `TYPES`). Do **not** deploy `packages/`,
    `node_modules`, `docs/`, `.git`.
  - **`/` routing:** land on the builder (a redirect to `/apps/builder/` or an
    index page like `serve.mjs`'s listing — Chris's call).
  - **Repeatable deploy:** a script (`scripts/deploy-web.mjs` or
    `deploy/push.sh`) that runs `npm --prefix packages/core test` and
    `node scripts/build-web.mjs`, then `rsync` the subtree over SSH. Committed.
  - **Cache headers:** `serve.mjs` sends `no-store`; production wants real
    caching, but `spec/grammar-0.1.ohm` and `registry/*.json` **must not go
    stale silently** against a freshly built `build/web/core/`. Simplest safe
    answer: short/again-revalidate on the data files and HTML, long-cache the
    hashed-by-content… except nothing is content-hashed here — so likely
    `must-revalidate` / short max-age across the board, and revisit if it
    matters. State what you chose.
  - **Deliverable:** `https://<domain>/` serves the builder with no Node
    process running the apps; the board's `#<encoded-source>` share links
    still work; both themes load; no console errors; the movement registry and
    grammar load.

- **20 — Frontend: Google sign-in, saved workouts, sharing.** *Top priority
  (Chris, 2026-08-30).* App code in `apps/`, no `packages/core` change.
  - **PocketBase access layer:** a small module under `apps/shared/` — either a
    vendored PocketBase ES SDK by relative path, or a hand-rolled `fetch`
    wrapper (auth: start OAuth2 flow, handle the redirect, store/refresh the
    auth token in `localStorage`; records: create / list-mine / get-by-id /
    update / delete). Given DEC-003/DEC-008 and that only ~6 calls are needed,
    the hand-rolled wrapper is probably the right call — decide and note why.
  - **Sign in:** a "Sign in with Google" control in the builder header; show
    the signed-in identity; sign out. Board can stay read-only-anonymous for
    now (it only needs to *resolve* a shared workout, item below).
  - **My workouts:** a panel in the builder — list the signed-in user's
    workouts (title + updated), open one into the editor, **Save** (create or
    update the current buffer's `source` + `title`), rename, delete. Save is
    explicit, not autosave. Keep the existing **Download .wdl** / **Open…**
    (local file) paths working unchanged — accounts are additive, the
    signed-out experience must not regress.
  - **Sharing:** a control to set a workout's `visibility` and copy a short
    stable URL — `https://<domain>/w/<id>` (or `/apps/display/?w=<id>`; pick
    one and wire nginx if needed). The board, given `?w=<id>` / `/w/<id>`,
    fetches the record from PocketBase and runs it; given a `#<source>` hash
    (the current mechanism) it behaves exactly as today. An `unlisted` workout
    opens for anyone with the link; `private` 404s for anyone but the owner.
  - **Verify by driving both apps against the live PocketBase from item 18:**
    sign in, create and save two workouts, reload and see them listed, open
    one, edit and re-save, rename, delete; mark one `unlisted`, open its `/w/`
    URL in a private window and confirm it runs; confirm a `private` one does
    not; confirm signed-out builder still builds, downloads and opens local
    files. Both themes. Diagnostics/console clean.
  - **Land it / docs:** as the other items. When landed: move 18–20 to
    [completed.md](completed.md); add an **Apps** / new **Hosting** row to
    [../topics/what-exists.md](../topics/what-exists.md); dated entry in
    [../current/recent-changes.md](../current/recent-changes.md); update
    [../topics/running-it.md](../topics/running-it.md) with the deploy command
    and the PocketBase runbook pointer; update
    [../topics/layout.md](../topics/layout.md) for `deploy/` and any new
    `apps/shared/` module.

- **15 — Directives (`@id`, `@tags`, …) are first-class metadata: surface them,
  distinguish them, and complete them.** *High priority (Chris, 2026-08-29),
  from driving the builder + board.* `parse` already collects every `@key value`
  line into `workout.directives` (a `Record<string,string>` —
  `packages/core/src/parse.ts:401`; `ast.ts:244`), values never interpreted. But
  the builder does nothing with it: `renderReading`'s `rows` array
  (`apps/builder/builder.js:697`) shows only `title / cues / duration / cap /
  score`, so an `@id` the author adds is invisible in "what it reads as" — and
  the board's "no @id" message at the end (`apps/display/board.js:606`) is the
  first feedback that it was even read. Only `directives.id` is consumed
  anywhere (the board, for the result record's `result:` head); `@date`,
  `@tags`, `@wdl` are carried and unread.

  Four parts, all app-level (no core/grammar/spec change — directives already
  parse):

  **(a) A metadata section in "what it reads as".** Above or beside the
  `title / cues / …` rows, a small block listing the directives that are set —
  `id`, `tags` (split on comma into chips), `date`, `wdl` version, and any
  `@x-…` extension key verbatim. Only shown when at least one is present.
  Presented as structured metadata, visually apart from the cue list — it
  describes the workout, it is not part of it. Read straight off
  `workout.directives`.

  **(b) The board renders every preamble line as a body row — confirmed, fix
  it.** `draw()` (`apps/display/board.js:138`) builds one row per raw source
  line — `state.lines = source.split('\n')` — and gives special handling only
  to blank (`.blank`) and `//` (`.comment`) lines. So `@wdl 0.1`, `@id …`,
  `@date …`, `@tags …` and the `# title` all render as plain rows sitting at
  the top of what the athlete reads mid-workout; **`@id` is not stripped
  either.** This is the "the board renders the source text, line for line"
  principle (`board.js:9`) applied one step too literally — the preamble is
  *metadata about* the workout, not the workout. Fix: `draw()` skips preamble
  directive rows (a top-of-file run of `@key` lines — match `tryDirective` or
  a `/^@/` test on the pre-body lines) and lifts `@id` and `@tags` into the
  board's header chrome, where the title and division picker already live
  (`apps/display/index.html` header, `board.css`). The `#` title can stay a
  row or move to the header — Chris's call; the directives are the noise.
  Keep "source line for line" for the workout body itself — this narrows it,
  it does not reverse it.

  **(c) `@` lines are called out in the outline.** Once item 12 has the outline
  rendering every line kind, a directive row gets its own class
  (`.node.directive`) and styling, the way `.node.block` / `.node.comment`
  already differ — see item 16, which is the general version of this.

  **(d) Type-ahead for directive keys.** When an outline row's text starts with
  `@` at zero indentation and the caret is still in the key, offer the
  recognised keys — `@wdl`, `@id`, `@date`, `@tags`, `@author`, and `@x-` for
  an extension attribute (roadmap §11's `@x-gym:` form). **This list is a
  builder-held convention, not grammar-derived** — the grammar accepts any
  `@key` (`directiveKey = nameChar+`), so unlike the block-modifier affordance
  (item 13's cousin, derived from `blockModifier_*`) there is nothing to
  enumerate; hand-list them with a one-line description each, the same shape as
  the movement-suggestion dropdown. Picking one fills the key and leaves the
  caret after it for the value. `@tiebreak` is **not** in this list — it is a
  mid-line step marker (spec §9.6), not a preamble directive, and never starts
  a zero-indent line of its own.

  **Scope:** `apps/builder/builder.js` (`renderReading` metadata block;
  the `@`-key dropdown, reusing the suggestion-dropdown machinery),
  `apps/builder/builder.css` (metadata block + `.node.directive`),
  `apps/builder/index.html` if the metadata block needs a container;
  `apps/display/board.js` + `board.css` only if (b) finds a real leak.
  No `packages/core` change. Verify by driving both apps: a workout with
  `@wdl 0.1` / `@id crossfit:fran` / `@date …` / `@tags a, b` shows a metadata
  block in the builder with id and tag chips; typing `@` on a fresh top line
  opens the key list; the board shows the id (and no raw `@` lines in the cue
  list); canonical round-trip unaffected.

  **Land it / docs:** fresh branch off `origin/main` as the other items
  describe; push `git push origin <branch>:main`, confirm via
  `git ls-remote origin main`; commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When landed: move
  to [completed.md](completed.md); update the **Apps** row in
  [../topics/what-exists.md](../topics/what-exists.md); add a
  [../topics/builder-ux.md](../topics/builder-ux.md) entry; dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- **16 — The outline should show what kind of line each row is.** *High
  priority (Chris, 2026-08-29), from driving the builder.* Today
  `renderOutline` (`apps/builder/builder.js:251`) marks a row `.block` (ends in
  `:` or has children), `.comment` (starts `//` — and per item 12 those rows
  are not even emitted), or `.bad` (a parse error on that line). Nothing tells
  a **title** (`#`), a **directive** (`@`), a **rest** (`rest …`), or a plain
  **step** apart, and there is no at-a-glance indicator of the kind — a reader
  scanning the outline cannot see the shape of the file the way the raw text
  shows it.

  **The job.** Give every row a visible kind marker — a coloured left border on
  the row's `.line-wrap` (or a small type badge), one colour/glyph per kind:
  title, directive, section/container header, step, rest, comment. Keep it
  legible in both themes and quiet enough not to fight the content (the rails
  already carry nesting; this is orthogonal). Drive the kind off the parsed
  node where possible (`n.node === 'step' | 'block' | 'rest'`, the
  `movementOf` / `blockOf` maps `renderOutline` already builds) and off the raw
  text only where the parse does not distinguish (title vs directive vs
  comment, which are preamble). Extend the same treatment to `.bad` so an
  error row reads as "step, and broken" rather than only "broken".

  Depends on **item 12** landing first (comment rows have to exist before they
  can be coloured) and dovetails with **item 15(c)** (the `@` directive class).
  Do 12, then 16, then 15 — or 12 + 16 together.

  **Scope:** `apps/builder/builder.js` (`renderOutline` classing),
  `apps/builder/builder.css` (the per-kind styles). No core change. Verify by
  driving the builder against a file with a title, two directives, a comment,
  a `3 rounds:` header, three steps and a `rest 90s`: every row visibly typed,
  both themes, and a broken step still readable as a step.

  **Share the palette with item 17** — the Text-tab syntax highlighter uses the
  same one colour per line kind, so the two views read as one visual language.
  Whichever lands first defines the tokens (CSS custom properties, e.g.
  `--kind-directive`); the other consumes them.

  **Land it / docs:** as the other items. When landed: move to
  [completed.md](completed.md); strike/update the relevant
  [../topics/builder-ux.md](../topics/builder-ux.md) entries; dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- **17 — The Text tab is a bare `<textarea>`: Tab escapes it, and nothing is
  highlighted.** *High priority (Chris, 2026-08-29), from driving the builder.*
  Two parts, both about making the raw editor usable; they share a branch.

  **(a) Trap Tab.** `#text` is a plain `<textarea>` (`apps/builder/index.html`),
  so pressing Tab moves focus out of it instead of indenting. It should insert
  **two spaces** (canonical indent, spec §2) at the caret; **Shift-Tab**
  removes up to two leading spaces from the line(s); with a multi-line
  selection, Tab / Shift-Tab indent / dedent every selected line and preserve
  the selection. Enter should carry the current line's leading indentation to
  the new line, plus two more spaces when the line being left ends in `:`
  (auto-indent into a block). All of this is `lines`-preserving — it edits the
  textarea value and lets the existing `input` handler re-split `lines`
  (`builder.js:855`); watch that programmatic `setRangeText` / value edits fire
  or manually dispatch `input`, and that undo (`document.execCommand` vs direct
  value set) still works acceptably.

  **(b) Syntax highlighting.** A highlight layer behind a transparent
  `<textarea>`: a `<pre>`/`<div>` positioned exactly under `#text`, same font,
  padding, line-height and wrapping, holding the same text re-tokenised on
  every `input`, with the textarea's own text set transparent
  (`color: transparent; caret-color: var(--ink)`) so the layer shows through.
  Colour one token per line kind — directive (`@…`), title (`#…`), comment
  (`//…`), block header (ends `:`), rest (`rest …`), step (`- …`) — plus,
  if cheap, the inline pieces (`@ load`, `, modifier`, `note: "…"`). **Use the
  same palette as item 16** (shared CSS custom properties) so the outline
  markers and the text colours are one language. Keep it a *layer*, not a
  contenteditable — paste, undo, spellcheck and IME all keep working because
  the real control is still a textarea. Re-tokenise is O(text) per keystroke;
  the file is small, so a full re-render is fine (no incremental parsing).
  This is the tractable half of "type hinting in the text editor"; **completion
  in the textarea** (caret-tracking via a mirror div, line tokenisation, a
  floating popup, key handling) is a bigger, separable piece — do **not** scope
  it here; if it is wanted it gets its own item.

  **Watch for:** the highlight layer and textarea must stay pixel-aligned under
  every wrap and at every scroll offset (sync `scrollTop`/`scrollLeft` on
  `scroll`); `tab-size: 2` is already set on `#text` (`builder.css:234`) —
  keep the layer's in sync; the `#dirty` "edited" badge and the tab-switch
  logic (item 10) are untouched.

  **Scope:** `apps/builder/index.html` (wrap `#text` + the highlight layer in
  a positioned container), `apps/builder/builder.css` (the layer, the
  transparent-text trick, the kind palette if 17 lands before 16),
  `apps/builder/builder.js` (the Tab/Enter key handler, the tokenise-and-paint
  on `input`/`scroll`). No core change. Verify by driving the builder: Tab and
  Shift-Tab indent/dedent a line and a selection; Enter auto-indents after a
  `:` line; every line kind is visibly coloured; the caret and selection sit
  exactly on the glyphs under wrapping and after scrolling; both themes;
  switching to the Outline tab and back leaves the text and highlighting
  correct.

  **Land it / docs:** as the other items. When landed: move to
  [completed.md](completed.md); add/adjust a
  [../topics/builder-ux.md](../topics/builder-ux.md) entry (the Text tab now
  traps Tab and highlights); update the **Apps** row in
  [../topics/what-exists.md](../topics/what-exists.md); dated line in
  [../current/recent-changes.md](../current/recent-changes.md).

- **12 — The outline shows no row for a comment; they exist only in the Text
  tab.** *High priority (Chris, 2026-08-29).* Full write-up (cause confirmed in
  source) is the first entry under "## Outline" in
  [../topics/builder-ux.md](../topics/builder-ux.md).

  **The situation.** `renderOutline` walks `readLines(text())`
  (`apps/builder/builder.js:631`), and `readLines`
  (`packages/core/src/lines.ts`) strips every comment off its own line and
  folds it into the `comments: string[]` of the next real line — an own-line
  comment is never a node in the line tree, so the outline draws no row for it.
  `readLines` also emits a file-level trailing pseudo-node
  (`{ text: '', line: 0, comments }`, `lines.ts:170`) for comments with no
  following line. The `n.text.startsWith('//')` branch at
  `apps/builder/builder.js:256` is effectively dead for own-line comments.
  Consequences: a `//` line cannot be seen, added, edited or reordered in the
  GUI; the outline silently misrepresents a file that has them (rows present,
  comments gone); and it undercuts using `//` for an arbitrary-label visual
  grouping (item 11 covers why a `section:` only reads the fixed eight words).

  **The job.** Make comments first-class in the outline. Two approaches, pick
  with Chris:
  - **Synthesised comment rows (preferred — keeps "the outline *is* the
    file").** In the outline walk, emit a row for each entry in a line's
    `comments[]` *above* that line's row (own-line comments attach forward, per
    `lines.ts`), and a trailing block of rows for the file-level pseudo-node's
    comments. Style them with the existing `.node.comment` class
    (`apps/builder/builder.css` already has it, dim + italic). Editing a
    comment row writes back through `packages/core/src/edit.ts` — which today
    has no comment-aware splice, so this is the real work: a comment lives in
    `lines` as raw text on its own physical line (or trailing another), and
    `edit.ts`'s span model (`spans()`, `replaceLogical`, `insertAfter`,
    `remove`) needs to address it. Reordering/indenting a comment row moves the
    physical line. `+ comment` joins the `.add-row` buttons.
  - **Attached-comment affordance (smaller, weaker).** Surface each row's
    `comments[]` as an editable sub-line hanging off that row — no new node
    type, no `edit.ts` change beyond writing the comment text back onto the
    owning physical line. Leaves an own-line comment sitting *between* two
    blocks with no natural owner (it currently attaches forward to the next
    line, so it would appear on that block's row — acceptable but slightly
    surprising).

  **Watch for:** `readLines` distinguishes an own-line comment (attaches
  forward) from a trailing comment on a content line (`comments` also holds
  it — see `splitComment` / the `comments: [...pending, ...]` assembly in
  `lines.ts:134-148`); the outline should render a trailing comment *on* its
  line's row, not as a separate row. `DEC-005` ("the text is the document" —
  structural edits splice `lines` in place, never regenerate from the AST) is
  the constraint the write-back must honour. No grammar/spec change — this is
  builder + possibly `edit.ts`.

  **Verify by driving the builder:** a file with an own-line comment above a
  block, a trailing comment on a step, and a trailing comment at end of file —
  all three visible and editable in the Outline tab; adding a comment row,
  editing one, deleting one, and dragging one all write back and survive a
  switch to the Text tab; canonical round-trip (`Canonicalise`) unaffected.

  **Land it / docs:** fresh branch off `origin/main` (`git fetch origin`,
  `git checkout -b <name> origin/main`; `main` is checked out elsewhere).
  Push `git push origin <branch>:main`, confirm the SHA moved via
  `git ls-remote origin main`. Commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When it lands:
  move this item to [completed.md](completed.md); strike the builder-ux.md
  "## Outline" entry and mark it **Fixed <date>** with what shipped; update the
  **Apps** row in [../topics/what-exists.md](../topics/what-exists.md); dated
  line in [../current/recent-changes.md](../current/recent-changes.md). If
  `edit.ts` gained a comment-aware operation, note it there and in
  [../topics/what-exists.md](../topics/what-exists.md).

- **13 — Laterality in the builder's `»` panel: no data for some movements, a
  parity question, and a replace-not-append bug.** *High priority (Chris,
  2026-08-29), from driving the builder.* Three strands, same panel
  (`movementModifiers` / `applyModifier` in `apps/builder/builder.js:195` and
  `:390`). The bug (c) can ship on its own; (a) and (b) want a decision.

  **(a) A movement with no curated `laterality` gets no laterality option at
  all.** `movementModifiers` builds the laterality list from
  `entry.laterality` (`builder.js:200`); `Around The Worlds` (`around-worlds`
  in `registry/movements.json`) has no `laterality` and no `defaultLaterality`,
  so the `»` panel offers nothing, where `Dumbbell Snatch`
  (`laterality: ["split","per-side"]`) offers `(split)` and `each side`. Two
  questions: (1) this is a **curation gap** — `around-worlds` (and its
  neighbours) need `laterality` filled in, which per
  [../topics/running-it.md](../topics/running-it.md) lands via
  `import-movement-curation.mjs` from the audit CSV, not by hand; decide
  whether to queue a curation pass or hand-write the one entry. (2) Chris
  described the wanted option as **"each direction"** (circle one way, then the
  other) — WDL's laterality vocabulary is `arm | leg | side | hand`
  (`spec/grammar-0.1.ohm:294-298`, `limbWord`), with no rotational sense. Is
  "each direction" just `per-side` spelled with a different limb noun (add
  `direction` to `limbWord`), or `(both)` meaning "both directions", or out of
  scope? Language call for Chris.

  **(b) `(split)` / `(both)` are parenthesised; `each side` is bare — Chris
  wants parity.** `format.ts:94-95`: `both`/`split` render as ` (both)` /
  ` (split)`, `per-side` renders as ` each side`. Spec §4 (line 148) makes the
  `each <limb>` form inline-without-a-comma deliberately — "it reads as part of
  the prescription rather than as a modifier of it" — but says nothing about
  parens vs bare; the asymmetry is just the two grammar forms
  (`laterality = "(" lateralityWord ")"` vs `trailingQualifier -- limb`). There
  is a defensible logic (parens annotate *how the count is performed*, `each
  side` states *what the count is of*), so this is a **reopen-a-settled-spelling
  decision**, not a clear bug. Put both directions to Chris: parenthesise the
  per-side form too (`(each side)` — needs a grammar tweak, and reads less like
  a whiteboard), or drop the parens from `split`/`both` (`14 DB Curl split`
  reads oddly). Whatever is chosen touches `spec/spec-0.1.md` §4,
  `spec/grammar-0.1.ohm`, `packages/core/src/format.ts`, `grammar` semantics,
  `test/golden/vocabulary.ts`, and regenerates goldens +
  `registry/workouts.canonical.json` (corpus files use `(split)` and
  `each arm` — this one *will* move the corpus, so measure it).

  **(c) Picking a laterality mode appends instead of replacing, and doubles on
  re-pick.** `applyModifier` with `position: 'title'` (`builder.js:390-413`)
  splices the chosen text in right after the movement title without checking
  for a laterality word already on the line. So picking `split` when `each
  side` is present yields `Around The Worlds (split) each side` (two
  contradictory modes), and picking `split` twice yields `(split) (split)`.
  Laterality modes are mutually exclusive: before inserting, detect and remove
  any existing laterality token — the parenthesised forms
  (`(both)` / `(split)` / `(per-side)` / `(total)`, matching
  `lateralityWord`) and the inline forms (`each|per arm|leg|side|hand`,
  matching `trailingQualifier`) — then insert the new one (or, if the same mode
  is picked again, treat it as a toggle-off / no-op). Check the measured-output
  picks (`, count cal` / `, count distance`) for the same double-append and fix
  them too if present. The `»` panel is meant to be an editor, so replace is
  the right default. Builder-only; no core change; verify by driving it against
  a split movement — apply `each side`, then `(split)`, confirm one replaces
  the other; apply the same twice, confirm no doubling; diagnostics pane clean
  after each.

  **Land it / docs:** fresh branch off `origin/main` as above; push
  `git push origin <branch>:main` and confirm. Commit body ends
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. If (c) ships alone,
  keep (a)/(b) open as their own numbered item rather than closing 13. When
  landed: move to [completed.md](completed.md); update
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Outline" (the `»`
  panel replace behaviour) and, if (b) changed a spelling,
  [../topics/settled-decisions.md](../topics/settled-decisions.md) +
  [../topics/what-exists.md](../topics/what-exists.md) Format row; dated line in
  [../current/recent-changes.md](../current/recent-changes.md). If (a) queued a
  curation pass, add it here as a new item.

- **11 — A bare-word block header is an inert section, not an "unrecognized
  header" error.** *High priority (Chris, 2026-08-29).* Spec §2 says a section
  *"group[s] blocks: `warmup:`, `strength:`, `conditioning:`, `accessory:`,
  `cool-down:`, **or any custom label**"* — but the grammar only reads the
  fixed eight in `sectionWord` (`spec/grammar-0.1.ohm:474-477`:
  `warm-up`/`warmup`, `strength`, `skill`, `conditioning`, `accessory`,
  `cool-down`/`cooldown`). Any other bare label — `Barbell movements:`,
  `Dumbbell movements:` — falls through `headerName`
  (`spec/grammar-0.1.ohm:483`) to `headerKind_unknown`
  (`packages/core/src/grammar/block-semantics.ts:182`), which makes a
  `type: 'sequence'` with `block.name` set, and then `parseHeader`
  (`packages/core/src/parse.ts:119-123`) pushes
  `unrecognized block header "Barbell movements"` — an **error** in `wdl check`
  and a red line in the builder's diagnostics pane. It still runs its children
  in order and round-trips (`format.ts:256` writes the name back as the head,
  `timeline.ts:497` default → `sequence`), so execution is already identical
  to a section; only the diagnostic is wrong.

  **The ask:** a header that is *entirely* a bare label — letters, spaces and
  hyphens, **no digits, no comma modifiers, no `@`, and not a recognised
  kind** — parses as `type: 'section'` (the inert labelled container that
  `conditioning:` already produces), so a custom grouping inside e.g.
  `3 rounds for time:` is a clean visual layer with no complaint. The rounds
  still cycle every descendant step regardless of the section layer.

  **Decisions the session must make (put them to Chris):**
  - **Diagnostic or silent?** The eight known section words are silent. A
    brand-new bare word could still be a *typo* rather than a deliberate label.
    Recommendation: read it as a section **and** emit a `note` (the
    claims-nothing severity, per [DEC-010](../topics/settled-decisions.md) /
    spec §11.1) — *"read `Barbell movements` as a section label"* — so
    held-and-inert is never fully silent. Alternative: fully silent, exactly
    like the fixed eight. Chris's call.
  - **Canonical case.** `blockKind_section` lowercases the known words
    (`block-semantics.ts:175`). Lowercasing `Barbell Movements` → `barbell
    movements` may surprise. Recommendation: preserve a custom label's case
    verbatim; keep lowercasing only the fixed vocabulary. Chris's call.
  - **Where the boundary is drawn.** A digit anywhere keeps it an error, so
    `3 rounds of madness:` (spec §11.1's example of a kind that must not be
    misread) stays an error. But `rounds of madness:` (no digit) would become
    a section — acceptable, or does a leading recognised kind-word need its own
    exclusion? Recommendation: no extra exclusion — "unknown is a place"
    (spec §11.1) and a labelled sequence that runs in order is a safe reading
    of any bare phrase. Chris's call.
  - **Grammar or `parse.ts`.** Cleanest is a new grammar production (a
    `customSection` case after `sectionWord` fails, structured like it) so the
    grammar still *owns what exists* ([DEC-006](../topics/settled-decisions.md),
    [DEC-007](../topics/settled-decisions.md)); the alternative is leaving
    `headerName` alone and having `parseHeader` reclassify. Prefer the grammar
    production unless it fights the `blockModifier` / `headerKind` split
    (the comment at `grammar-0.1.ohm:370-376` explains why `headerName` is kept
    out of the kinds proper).

  **Must not break:** the error path at `parse.ts:119` also deliberately
  catches a *real* repeat carrying an unreadable head stated after a comma
  (`cap 12min, 3 rounds:` is three rounds **and** an error — spec §11.1). The
  reclassification must fire only when the header is a bare label with **no
  kind anywhere on it**, so `block.name && block.type !== 'section'` becomes
  `… && !isBareLabel`.

  **Scope:**
  - `spec/grammar-0.1.ohm` — the `customSection` production (or equivalent),
    ordered after `sectionWord`.
  - `packages/core/src/grammar/block-semantics.ts` — a handler setting
    `type: 'section'` + `name` (case per the decision above).
  - `packages/core/src/parse.ts` — the `parseHeader` report condition
    (`:119`), so a bare-label section is not reported as an unrecognised
    header; add the `note` here if that decision goes that way (an error is
    not part of the AST — same reason `headerKind_unknown` does not raise one).
  - `packages/core/src/format.ts` — check `case 'section'` (`:256`) and the
    `unread` computation (`:287`) still round-trip a custom label; adjust if
    case handling changed.
  - `spec/spec-0.1.md` — §2 (the "any custom label" line is now true), §5.1
    (sequence vs section), and a cross-reference from §11.1 (a bare-word head
    is a section; a head with a *kind* it cannot read is still an error).
  - Tests: `packages/core/test/grammar.test.ts` — the pinned case at `:388-392`
    (`'some shape nobody taught the parser'`) changes from `sequence` to
    `section`; the separately-counted **block headers** total
    (`:269`, currently 250) shifts. `test/golden/vocabulary.ts` — new forms
    under a `section` / `label` group, pinning canonical text and the tree.
    `test/semantics.test.ts`, `test/validate.test.ts` as needed.
  - **Corpus:** no example file uses a custom-label header, so
    `interpretations.json` and `registry/workouts.canonical.json` should
    regenerate to nothing but their date stamp — **confirm** with
    `node packages/core/test/golden/generate.ts` and
    `node scripts/build-canonical.ts`, don't assume.
  - No app code expected. Drive the builder once anyway: type
    `Barbell movements:` with steps under it inside a `3 rounds for time:` and
    confirm the diagnostics pane is clean (or shows only the `note`), the
    outline nests it, and "what it reads as" cycles the steps three times.
  - Check [deferred.md](deferred.md) and
    [../topics/settled-decisions.md](../topics/settled-decisions.md) first —
    this reading is not currently declined anywhere, but confirm.

  **Land it / docs:** fresh branch off `origin/main`
  (`git fetch origin`, `git checkout -b <name> origin/main`; `main` is checked
  out elsewhere so you cannot `git checkout main`); push with
  `git push origin <branch>:main` and confirm the SHA moved via
  `git ls-remote origin main`. Commit message body ends with
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When it lands:
  move this item to [completed.md](completed.md) in that file's style; restore
  "## Open" to "None" with the "every numbered item is closed" line extended to
  include 11; record the decisions made in
  [../topics/settled-decisions.md](../topics/settled-decisions.md) (and a
  `DEC-0xx` line in [../decisions.md](../decisions.md) if it rises to that);
  update the **Format** row (or add a row) in
  [../topics/what-exists.md](../topics/what-exists.md); add a dated entry to
  [../current/recent-changes.md](../current/recent-changes.md);
  `grep -rn "custom label\|sectionWord\|unrecognized block header" docs/` and
  fix any now-stale mention.

- Every earlier numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a, 9, 10 and 14 — is closed; see [completed.md](completed.md).

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
