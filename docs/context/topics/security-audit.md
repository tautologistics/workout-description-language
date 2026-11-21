# Security audit — hosted stack

*Written 2026-09-10 (`b76deb8`), the deferred "full security audit / hardening
sweep" bullet ([../tasks/deferred.md](../tasks/deferred.md)) pulled into the
active queue. **Static analysis only** — the migration rule strings in
`deploy/pocketbase/pb_migrations/*.js`, the hand-built client in
`apps/shared/pocketbase.js`, `scripts/serve.mjs`, and the deploy runbook. No
request was made against the live instance; nothing was deployed; no migration
was run against prod. `make test` 2064/2064 before and after (app/doc code
only).*

Load this when touching a collection rule, the client query builders, auth, or
the deploy surface — or when deciding whether a hardening item is Chris's call.

---

## Executive summary

**What is solid.**

- **`workouts`** — the create/update/delete rules are owner-scoped and
  server-enforced (`@request.auth.id != "" && owner = @request.auth.id` on
  create, `owner = @request.auth.id` on write). An unauthenticated or
  cross-user `POST`/`PATCH`/`DELETE` is rejected by the server, not by the UI.
- **`movements` / `equipment` / `patterns`** — writes are `@request.auth.admin =
  true`; an unauthenticated request has a null `admin` so `null = true` is
  false, and a signed-in non-admin is denied. Reads are deliberately open
  (`scope = "global"`), which is correct — the vocab and the movement library
  are not secret and the editor reads them before sign-in.
- **`goals`** — hardened by `1757400000_harden_goals_rules.js` after the G1
  `"" = ""` nullable-relation hole was found on the live API. Every mutating
  rule now leads with `@request.auth.id != ""`; a non-admin can only write
  `scope = "user"` rows attributed to themselves.
- **`movement_sets`** — owner-scoped like `workouts`; the `owner` relation is
  `required` so the anonymous `"" = ""` trap that bit `goals` does not apply.
- **Soft delete (DEC-029)** — `&& deleted = null` is ANDed onto the *list/view
  rules* of all four record collections, so a tombstone is hidden from every
  reader regardless of what `filter=` a caller sends. The client repeats the
  clause as defence-in-depth.
- **XSS** — both apps render server-supplied strings (`source`, `title`,
  `wdlId`, cue labels) through `textContent` or through `escapeHtml()` (builder
  highlight layer). No `innerHTML` sink takes interpolated server data. Checked
  `apps/display/board.js`, `apps/builder/builder.js`, `apps/shared/*.js`.
- **OAuth redirect** — `redirect_uri` is a fixed constant
  (`${location.origin}/apps/builder/auth-callback.html`), never a URL
  parameter. `state` is checked against the stashed value before the token
  exchange (CSRF-safe), PKCE `codeVerifier` is used. `returnTo` is only ever
  passed `location.href` by the one caller (`builder.js:3434`) — no
  open-redirect path.
- **`scripts/serve.mjs` is dev-only** and never deployed; the production static
  tree is served by PocketBase's `apis.Static`. Its path handling still
  `normalize()`s and strips leading `../` before `join(root, …)`.
- **Tokens are in `localStorage`, not cookies**, and sent as an explicit
  `Authorization` header — so there is no ambient credential and no CSRF on the
  API surface, which makes PocketBase's permissive default CORS low-impact here.

**What is not.**

- **The `users` collection has no access rules in version control at all.**
  No migration in `deploy/pocketbase/pb_migrations/*.js` sets its
  list/view/create/update/delete rules or any field-level guard on the custom
  `admin` / `org` / `handle` fields. The live rules are whatever PocketBase's
  built-in auth-collection defaults are, plus a box-only snapshot migration
  (`1788125462_updated_users.js`) that is **not in the repo and cannot be
  audited from here**. On PocketBase's defaults this is a **critical
  privilege-escalation hole**: a signed-in user can `PATCH` their own row
  `{ admin: true }` and gain write access to `movements`, `equipment`,
  `patterns` and the `global` goals tier. See **C-1**.
- **No mutating rule guards *which fields* change.** `workouts`,
  `movement_sets`, `goals` and `users` all check *who* may write a row, never
  *what* they may set on it. So the namespace keys (`wdlId`, `setId`,
  `goalId`) that the client force-writes from the owner's handle can be set to
  any value by a raw API client — including another org's namespace — and
  `owner` can be reassigned. See **H-1**, **M-1**.
- **Client `filter=` strings interpolate `?w=` / `setId` / `goalId` values
  without escaping.** A crafted value bearing a `"` breaks out of the filter
  literal (blind boolean injection across collections). **Fixed in this
  commit** for the affected sites — see **H-2**.
- **Handle shape/reserved-word validation is client-only.** The server enforces
  only uniqueness and `max: 63`. A raw `PATCH` can set a handle of `admin`,
  `api`, a pure-numeric string, or one containing a colon — the last of which
  confuses `<handle>:<slug>` parsing. See **M-2**.
- **Port 8090 is internet-reachable in plaintext** past the TLS proxy —
  already tracked; still open on a DreamHost firewall ticket. See **M-3**.

Nothing here is being actively exploited as far as anyone knows, and the user
base is a known handful. But the `users`-collection gap (**C-1**) should be
closed before the instance is leaned on further, and it is the one finding that
is plausibly *already* a live hole rather than a latent one.

---

## Findings

Ranked Critical → Informational. "Touches" names the file/rule; "DEC" names the
settled decision the finding bears on.

### C-1 — `users` collection: no version-controlled rules; admin flag is self-settable on PocketBase defaults

- **What it is.** Every other collection's rules live in a migration. The
  `users` collection's do not — no `pb_migrations/*.js` file assigns
  `users.listRule` / `viewRule` / `createRule` / `updateRule` / `deleteRule`,
  and none adds a field-level guard to the `admin`, `org` or `handle` fields
  that M2 / L1 added. The live behaviour is PocketBase's built-in auth-collection
  default plus a box-only snapshot (`1788125462_updated_users.js`,
  acknowledged in `running-it.md` and `deploy/README.md` as "not in the repo").
- **How it's exploitable.** On PocketBase's stock auth-collection defaults
  (`updateRule = "id = @request.auth.id"`, no per-field manage rule on custom
  fields), a signed-in user calls
  `PATCH /api/collections/users/records/<their-own-id>` with body
  `{ "admin": true }`. Custom bool fields have no system-level write protection,
  so the write lands. That account is now admin and can create / edit / delete
  `movements`, `equipment`, `patterns` rows and write the `global` goals tier
  (all gated only on `@request.auth.admin = true`). If the collection's
  `createRule` is also the stock open `""` *and* password auth is enabled, an
  **unauthenticated** `POST /api/collections/users/records`
  `{ email, password, admin: true, handle: "admin" }` mints an admin account in
  one call, bypassing the "Google is the only sign-in" intent entirely.
- **Which file/rule.** Absent from `deploy/pocketbase/pb_migrations/*.js`
  (grep for `users` + `Rule` returns only `goals` cross-references). The M2
  migration header (`1756700000_add_users_admin.js`) reasons only about *reads*
  of the flag ("PocketBase treats null/false admin as not-true, so non-admins
  are denied"); nobody addressed *writes of the flag by its own bearer*.
  `deploy/README.md` §7a documents granting admin by ticking a box in the admin
  UI and says nothing about locking the field.
- **DEC.** Breaks the server-enforcement premise of **DEC-020** (movements —
  admin-only writes), **DEC-025** (vocab — admin-only writes) and **DEC-028**
  (the `global` goals tier — admin-only). Each of those is correctly written on
  its *own* collection; the gap is that "admin" is a self-assignable property.
- **Recommended fix (Chris's call — needs a migration + `make deploy:db`).**
  Add a migration that sets the `users` rules explicitly and guards the
  privileged fields, e.g.

  ```js
  users.listRule   = '@request.auth.id = id';
  users.viewRule   = '@request.auth.id = id';
  users.createRule = null;               // OAuth creates records server-side; no public POST
  users.deleteRule = '@request.auth.id = id';
  // authenticated self-edit, but admin/org cannot be changed by the client,
  // and handle cannot be blanked (PocketBase v0.23+ : @request.body.*)
  users.updateRule =
    '@request.auth.id = id' +
    ' && (@request.body.admin:isset = false || @request.body.admin = admin)' +
    ' && (@request.body.org:isset = false   || @request.body.org = org)';
  ```

  Confirm the exact `@request.body` vs `@request.data` spelling for the box's
  PocketBase version first (renamed at v0.23). Also confirm on the box whether
  `createRule` is currently open and whether identity/password auth is enabled
  on the collection — if a public `POST` works today, that half is the more
  urgent one. **Also commit the box's `1788125462_updated_users.js` snapshot
  into the repo** so the real `users` schema is reviewable and reproducible.
- **Status.** **Fixed and deployed 2026-11-21** (Chris ran `make deploy:db`, and the restart was healthy). *Earlier the same day: fix landed, not yet deployed:*
  `deploy/pocketbase/pb_migrations/1757600000_lock_users_rules.js` (SEC-1).
  Both exploits were reproduced locally on stock rules and are blocked by the
  migration (verification in its header). The create rule is
  `@request.body.admin != true && @request.body.org != true` rather than
  `null`, so Google sign-up can't be broken. The prod box stayed exposed until
  that deploy. Still open from the recommendation: committing
  the box's `1788125462_updated_users.js` snapshot, and deciding whether to
  disable password auth on `users`. Earlier status: unfixed, because of the
  blast radius (auth collection, migration re-apply on prod). Filed in
  [known-debts.md](known-debts.md). Reported to Chris.

### H-1 — Namespace keys (`wdlId` / `setId` / `goalId`) are client-forced only; a raw API client can spoof another org's namespace

- **What it is.** DEC-021 / DEC-027 / DEC-028 say every save "forces" the
  namespaced key to `<owner-handle>:<slug>`. That forcing is entirely
  client-side (`forceNamespace` / `forceSetNamespace` / `forceGoalNamespace` in
  `apps/shared/pocketbase.js`). The collection rules do not constrain the value
  of `wdlId` / `setId` / `goalId` on write, and (`workouts`, `movement_sets`)
  the index on `wdlId` is non-unique.
- **How it's exploitable.** A signed-in user issues a raw
  `POST /api/collections/workouts/records`
  `{ owner: <self>, visibility: "public", source: "...", wdlId: "crossfit:fran" }`.
  The create rule (`owner = @request.auth.id`) is satisfied. The row now
  carries a CrossFit-library `wdlId` while being owned by the attacker. The
  builder's **Libraries** chip types `crossfit:` into the search box and
  `searchWorkouts` matches `wdlId ~ "crossfit:"` — so the spoofed row shows up
  *in the CrossFit library listing* alongside the real ones. Same shape for
  `movement_sets.setId` (`listPublicSets`) and — for a `scope:"user"` row —
  `goals.goalId`.
- **Impact.** Content/attribution spoofing and library poisoning, not data
  theft or auth bypass. A curator reading the Libraries list can be shown a
  workout that is not the org's. Bounded by: the row is still owned by the
  attacker (visible in the admin UI), and `getByAnyId("crossfit:fran")` returns
  whichever row sorts first, so it can also *shadow* the real one for
  `?w=crossfit:fran` deep links.
- **Which file/rule.** `1756600000_create_workouts.js` `createRule` /
  `updateRule`; `1757200000_create_movement_sets.js`; `1757300000` /
  `1757400000` for `goals`. `apps/shared/pocketbase.js` `create` / `update` /
  `createSet` / `updateSet` / `createGoal` / `updateGoal`.
- **DEC.** The *implementation* diverges from **DEC-021** ("there is no
  un-namespaced saved workout … it always writes back") — that guarantee holds
  only for saves that go through the client. The DEC model is not wrong; it
  just assumed the client is the only writer.
- **Recommended fix (Chris's call — migration + re-apply).** Add a rule clause
  binding the key to the owner's handle, e.g. on `workouts`
  `createRule`/`updateRule` append
  `&& @request.body.wdlId:startsWith = @request.auth.handle . ":"`
  (verify the operator spelling and that `@request.auth.handle` is resolvable
  in the rule context for the box's version — it may need
  `@request.auth.handle != "" &&`). If rule-level string composition is not
  available, a `pb_hooks/` `onRecordCreate`/`onRecordUpdate` that recomputes
  the key server-side from `owner`'s handle is the robust form. Until then the
  client force is the only guard.
- **Status.** **Fix landed 2026-11-21 (SEC-2), not yet deployed:** `deploy/pocketbase/pb_hooks/wdl_guards.pb.js` rejects a non-superuser create, or a key change, unless the key starts with the writer's `<handle>:` (`user`-scoped goals only; `global` stays admin-only by rule). Reproduced locally before the fix, blocked after. *Earlier: Unfixed. Filed in [known-debts.md](known-debts.md). Reported.*

### H-2 — Filter-string injection via `?w=` / `setId` / `goalId` in `apps/shared/pocketbase.js` — **fixed in this commit**

- **What it is.** `getByAnyId(x)`, `getSetByAnyId(x)`, `getGoalByAnyId(x)` and
  `getMovementByMovementId(id)` interpolated their argument straight into a
  PocketBase `filter=` literal — `wdlId="${key}"` etc. — with no escaping.
  `key` for the first two comes from the board's `?w=` URL parameter and the
  set/goal deep-link params: **attacker-controlled**. The `key.includes(':')`
  gate is trivially satisfied (`a:b" || …` contains a colon).
- **How it was exploitable.** `?w=x:y"%20||%20(subquery)%20||%20wdlId="` makes
  the server-side filter
  `wdlId="x:y" || (subquery) || wdlId="" && deleted = null`. The collection
  *rule* still ANDs in `visibility != "private"` and `deleted = null`, so this
  is **not** a read-auth bypass and cannot surface private or tombstoned rows.
  What it does allow is a blind boolean oracle: PocketBase filters can
  reference `@collection.users.…` and other collections as subqueries, so a
  crafted `?w=` whose result set changes based on
  `@collection.users.email ?= "a…"` leaks data one predicate at a time. Also a
  denial vector (malformed filter → 400 on every board load of that link).
- **Which file.** `apps/shared/pocketbase.js` — `getByAnyId`, `getSetByAnyId`,
  `getGoalByAnyId`, `getMovementByMovementId`, and (defensively) `handleTaken`
  / `getHandle` / `searchWorkouts`.
- **DEC.** Touches **DEC-021** (`getByAnyId` is the `@id`↔record-id resolver)
  and **DEC-027 / DEC-028** (the set/goal twins).
- **Fix applied.** Added `filterValue(v)` — `String(v ?? '').replace(/["\\]/g,
  '')` — beside `liveOnly`, and routed every interpolated `filter=` value
  through it. A legitimate value here is only ever a 15-char record id, a
  `[a-z0-9-]` handle/slug, or a title substring, none of which contain `"` or
  `\`, so no legitimate lookup changes; `searchWorkouts`'s pre-existing
  ad-hoc `.replace(/"/g,'')` is folded into the shared helper. `node --check`
  clean; `make test` unmoved (core suite, does not import `apps/`).
- **Status.** **Fixed in this commit.** The deeper mitigation (a real
  parameterised-filter client, or PocketBase's `filter` param binding) is a
  larger change and not warranted for a single-instance tool.

### M-1 — `owner` / `user` reassignment is not blocked on update

- **What it is.** `workouts.updateRule` (`owner = @request.auth.id`) and the
  `movement_sets` / `goals` equivalents are evaluated but do not stop the
  `PATCH` body from *changing* `owner` / `user`. A user can `PATCH` their own
  row `{ owner: "<org0crossfit001>" }` (or any other uid). For `goals`, a user
  who owns a `scope:"user"` row can attempt `PATCH { scope: "global", user:
  null }` — whether PocketBase evaluates the update rule against the pre- or
  post-change record decides if this lands a user-authored row in the ownerless
  `global` tier; **this needs a runtime check on the box** (couldn't test from
  here).
- **How it's exploitable.** Give-away / relabel of one's own content to an org
  (compounds H-1 — now the spoofed row is genuinely org-*owned*), or (goals)
  possible injection into the `global` ruleset list every reader sees.
- **Which file/rule.** `1756600000_create_workouts.js`,
  `1757200000_create_movement_sets.js`, `1757400000_harden_goals_rules.js`.
- **DEC.** **DEC-028** (goals scope tiers) — the harden migration reasoned
  about *create*, not field mutation on *update*.
- **Recommended fix (Chris's call).** Append to each update rule
  `&& (@request.body.owner:isset = false || @request.body.owner = owner)` (and
  the `user` / `scope` equivalents for `goals`). Same `@request.body` spelling
  caveat as C-1. Confirm the `goals` `scope`-flip behaviour on the box either
  way.
- **Status.** **Fix landed 2026-11-21 (SEC-3), not yet deployed:** `1757800000_guard_ownership_rules.js`. PocketBase evaluates a rule's field names against the pre-write record, so the `goals` scope flip was exploitable. It was reproduced locally before the fix and blocked after, along with owner reassignment on `workouts` and `movement_sets`. *Earlier: Unfixed. Filed in [known-debts.md](known-debts.md). Reported.*

### M-2 — Handle shape and reserved-word rules are client-only

- **What it is.** `apps/shared/handle.js` `validateHandle` enforces
  `^[a-z0-9-]+$`, length 3–63, not pure-numeric, no leading/trailing `-`, and
  a reserved set (`api`, `admin`, `_`). The server enforces **only** the unique
  index and the field `max: 63`. There is no server rule mirroring the shape or
  the reserved words.
- **How it's exploitable.** A raw
  `PATCH /api/collections/users/records/<self>` `{ handle: "admin" }` (or
  `"api"`, or `"12345"`, or `"crossfit-x:evil"`, or a 1-char handle) succeeds
  as long as it is unique. `admin` as a handle is impersonation of the platform
  (the reserved list exists precisely to stop this). A handle containing `:`
  poisons every `<handle>:<slug>` consumer — `getByAnyId` splits on the *first*
  `:`, so `handle = "a:b"` and slug `c` yields `wdlId = "a:b:c"` which resolves
  ambiguously.
- **Which file/rule.** `apps/shared/handle.js` (client), and the **absent**
  `users` rule (see C-1 — the fix belongs in the same migration).
- **DEC.** **DEC-021** — "a taken slug, an empty one, a pure-numeric one, or a
  short reserved set … is rejected client- and server-side." The
  *server-side* half was never implemented.
- **Recommended fix (Chris's call).** In the same `users` migration as C-1,
  add to `updateRule`:
  `&& @request.body.handle:isset = false` *or* a regex/`in` guard —
  PocketBase rules can do `@request.body.handle ~ '^[a-z0-9-]+$'` and
  `@request.body.handle != "admin" && … != "api" && … != "_"`. A `pb_hooks`
  `onRecordUpdate` validator is cleaner for the full rule set (min length,
  no-colon, not-all-digits). The unique index already covers "taken".
- **Status.** **Fix landed 2026-11-21 (SEC-4), not yet deployed:** a `users` create/update hook in `pb_hooks/wdl_guards.pb.js` ports `validateHandle()`. An empty handle is still allowed on create, for Google sign-up; a set handle can't be cleared; superusers are exempt. *Earlier: Unfixed. Filed in [known-debts.md](known-debts.md). Reported.*

### M-3 — Port 8090 reachable in plaintext past the TLS proxy (already tracked)

- **What it is.** The DreamHost panel proxy connects over the VPS public IP, so
  PocketBase binds `0.0.0.0:8090` and `http://<vps-ip>:8090` answers
  from the internet, bypassing HTTPS. Documented in `deploy/README.md`
  "Known issue: port 8090 exposure" and
  [what-exists.md](what-exists.md) / [../current/next-steps.md](../current/next-steps.md).
- **Still holds?** Yes. Mitigations in place (auth on every route, strong
  superuser password in a manager, `Application URL` forces HTTPS links). The
  residual is an on-path attacker reading a token *if* a client ever used the
  `:8090` origin — no client does. The superuser admin UI (`/_/`) is also
  reachable over `:8090`.
- **Recommended fix.** The open DreamHost support ticket to firewall inbound
  TCP 8090 (proxy still allowed). No root to do it locally. Not a code change.
- **Status.** Pre-existing known debt; cited here, not re-filed.

### L-1 — `movement_sets` create rule relies on field validation, not an explicit `!= ""` guard

- **What it is.** `createRule = "@request.auth.id = owner"`. An anonymous
  request has `@request.auth.id = ""`; the create is rejected only because
  `owner` is a `required`, `minSelect: 1` relation and `""` fails field
  validation. This is the exact shape that bit `goals` at G1 (where `user` was
  *nullable*, so `"" = ""` passed). It is safe **today** but one schema change
  (making `owner` optional) reopens it silently.
- **Which file/rule.** `1757200000_create_movement_sets.js` `createRule`.
- **DEC.** **DEC-027**. The migration header even notes the equivalence to the
  `workouts` guard but chose the shorter form.
- **Recommended fix (low priority).** Align with `workouts` / `goals`:
  `@request.auth.id != "" && @request.auth.id = owner`. Defence-in-depth only.
- **Status.** **Fix landed 2026-11-21 (SEC-6), not yet deployed:** `1757800000_guard_ownership_rules.js`. *Earlier: Unfixed, low. Filed in [known-debts.md](known-debts.md) as a*
  one-liner. Reported.

### L-2 — PocketBase default CORS is permissive

- **What it is.** PocketBase serves the API with a permissive default
  `Access-Control-Allow-Origin`. Because the apps are same-origin and the
  token travels as an explicit `Authorization` header (not a cookie), a
  third-party site cannot read authenticated responses or ride an ambient
  credential — so impact is low. Still, nothing restricts the API to the known
  origin.
- **Recommended fix (low priority).** If the PocketBase version exposes a CORS
  allowlist setting, set it to `https://wex.androidempathy.com`. Not a code
  change in this repo.
- **Status.** **Fix landed 2026-11-21 (SEC-7), not yet deployed:** PocketBase v0.40.1 has no CORS setting in the admin UI, but `serve --origins` exists. It's added to all three launch paths (`pocketbase.user.service`, `pocketbase.service`, `run-pocketbase.sh`). Verified locally: a foreign origin gets no `Access-Control-Allow-Origin`, and the site's own origin does. Needs `make deploy:unit`, a new target that installs the unit and restarts. *Earlier: Informational/low. Not filed as a debt.*

### I-1 — `updateMovement` / vocab writes pass the patch body straight through

- Admin-only, so any field an admin sets (`scope`, `user`, …) is within their
  privilege. Noting only that `createMovement` / `createVocabTerm` put
  `scope: 'global'` *last* in the spread so a client cannot override it — good
  — but `updateMovement(id, patch)` has no such guard. No action; admin trust
  boundary.

### I-2 — `auth-refresh` clears local auth only on 401/403

- `refreshAuth()` keeps the cached record on any other error (network, 500), so
  a stale identity can persist across a transient outage. The server is still
  the authority on every subsequent call, so this is a UX nicety, not a
  vulnerability. No action.

---

## What was checked and found OK

Recorded so the negative space is on the record.

| Area | Checked | Verdict |
|---|---|---|
| `workouts` create/update/delete rules | `1756600000_create_workouts.js` | Owner-scoped, `@request.auth.id != ""` on create. Sound. |
| `movements` write rules | `1756800000_create_movements.js` | `@request.auth.admin = true`; anon `null = true` is false. Sound (given C-1 is fixed). |
| `equipment` / `patterns` write rules | `1757100000_create_vocab.js` | Identical to `movements`. Sound. |
| `goals` rules after harden | `1757400000_harden_goals_rules.js` | `@request.auth.id != ""` leads every mutating rule; the G1 `"" = ""` hole is closed. Sound. |
| `movement_sets` rules | `1757200000_create_movement_sets.js` | Owner-scoped; `owner` required so no anon `"" = ""` trap (but see L-1). |
| Soft-delete rule tightening | `1757500000_add_soft_delete.js` | `&& deleted = null` on list/view rules of all four — tombstones hidden from every reader regardless of client `filter=`. Partial unique indexes correct. Sound. |
| Cross-user `PATCH` of another user's `workouts` / `movement_sets` / `goals` | rule strings | Rejected — write rules test `owner`/`user` = `@request.auth.id`. (Reassigning *your own* row's owner is M-1.) |
| Setting `owner` to someone else *on create* | `workouts` / `movement_sets` create rules | Rejected — `owner = @request.auth.id` is in the create rule. |
| Non-admin writing `movements` / vocab / `global` goals | rule strings | Rejected — admin-only, server-side. |
| XSS via `source` / `title` / `wdlId` / cue labels | `board.js`, `builder.js`, `body-map.js`, `token-input.js`, `movement-editor.js` | `textContent` / `escapeHtml()` throughout; no interpolated-data `innerHTML`. Clean. |
| OAuth `state` / PKCE | `apps/shared/pocketbase.js` `completeSignInFromRedirect` | `state` compared to stashed value before token exchange; PKCE verifier used. Sound. |
| OAuth open-redirect via `redirect_uri` | `beginGoogleSignIn` | `redirect_uri` is a fixed constant, not a parameter. No open redirect. |
| OAuth open-redirect via `returnTo` | `builder.js:3434`, `auth-callback.html` | Only caller passes `location.href` (same-origin). No external-redirect path. |
| `searchWorkouts` filter breakout | `apps/shared/pocketbase.js` | Term sits inside `"…"` and `"`/`\` are now stripped (H-2 fix) — cannot escape the literal. The collection rule still bounds visibility. |
| Static-asset path traversal | `scripts/serve.mjs` (dev only) | `normalize()` + leading-`../` strip before `join(root, …)`. Dev server is never deployed. |
| Prod static MIME / path handling | `deploy/README.md` §10 | `apis.Static`; `.ohm`/`.wdlg` sniff to `text/plain`, both `fetch().text()`d anyway. No `pb_hooks` route. Fine. |
| Secrets in served assets | `deploy/` tree, `scripts/deploy-web.mjs` | `.env` is git-ignored and not in the rsynced tree; `pb_public/` is `apps/` + `build/web/` + `registry/*.json` + generated `index.html`. No token, `.env` value or superuser credential in a served file. |
| Superuser credentials | `deploy/README.md` | In Chris's password manager and `pocketbase.env` (mode 600) on the box — not the repo. |
| Mock `/api` as a boundary | `scripts/mock-api.mjs` | Dev-only, `admin:true` fixture user, never runs in prod (`serve.mjs` gate). Not the security boundary — audited the real migration rules instead, as instructed. |
| CORS / CSRF on the API | — | Token is `localStorage` + explicit `Authorization` header, not a cookie — no ambient credential, no CSRF. Permissive CORS is low-impact (L-2). |

---

## For Chris — decisions needed

1. **C-1 is the one to act on.** Confirm on the box (admin UI → Collections →
   `users` → API rules, and → Options for identity/password auth) whether a
   signed-in user can `PATCH` their own `admin`, and whether an unauthenticated
   `POST` to `users/records` is accepted. Then land a `users`-rules migration
   (draft in C-1) + commit the box's `1788125462_updated_users.js` snapshot,
   and `make deploy:db`.
2. **H-1 / M-1 / M-2** are one migration's worth of `@request.body` field
   guards on `workouts` / `movement_sets` / `goals` / `users`. Worth doing
   together. Needs the `@request.body` vs `@request.data` spelling pinned to
   the box's PocketBase version, and one runtime check for the `goals`
   `scope`-flip question in M-1.
3. **M-3** — nudge the DreamHost firewall ticket.
4. **L-1 / L-2** — pick up opportunistically; neither is load-bearing.

All fixes beyond the H-2 filter-escaping already in this commit are Chris's
call — each needs a migration re-apply on the VPS, which a session does not do.
