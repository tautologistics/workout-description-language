# deploy/ — hosting runbook

The public WDL instance: the static apps plus **PocketBase** beside them for
Google sign-in and saved/shared workouts. Rationale, and the alternatives that
were rejected, are in
[`../docs/context/topics/settled-decisions.md`](../docs/context/topics/settled-decisions.md)
(DEC-016). This file is the operational how-to.

- **Item 18** (done 2026-08-30): PocketBase up on the VPS behind the panel proxy
  + TLS, same-origin, with the `workouts` collection and Google OAuth2.
- **Item 19** (done 2026-08-30): the static-app deploy. Because the panel proxy
  sends the **whole domain** to PocketBase, the apps ship into PocketBase's
  `pb_public/` (served at `/` for any non-`/api/`, non-`/_/` path) — not a
  separate nginx root. `scripts/deploy-web.mjs` builds the served subtree and
  rsyncs it there. See "## 10. Static apps" below.
- **Item 20** (code landed 2026-08-30, live verification pending a paired Google
  sign-in): the frontend that calls `/api/...` — `apps/shared/pocketbase.js`
  (hand-rolled `fetch` client, no SDK), the builder's **Sign in with Google** /
  **My workouts** / share controls, `apps/builder/auth-callback.html` (the OAuth
  redirect target), and the board resolving `/apps/display/?w=<id>`. All of it
  ships inside the existing `apps/` wholesale copy — no `deploy-web.mjs` change.
  **Before it works live:** register the second redirect URI in §8, then
  `node scripts/deploy-web.mjs`.

## As-built (the live instance)

| Thing            | Value                                                        |
|------------------|-------------------------------------------------------------|
| Host             | DreamHost **managed** VPS `vps28777` — Ubuntu 22.04, **no root** |
| OS account       | `<ssh-user>`, home `/home/<ssh-user>`       |
| Domain           | `https://wex.androidempathy.com`                            |
| PocketBase       | v0.40.1, `~/pb/pocketbase`, data `~/pb/pb_data`             |
| Bind             | `0.0.0.0:8090` (see "Known issue" below)                    |
| Process          | **user** systemd unit `~/.config/systemd/user/pocketbase.service`, linger enabled |
| Web / TLS        | DreamHost panel **Proxy Server** (`/` → port 8090) + panel Let's Encrypt |
| Admin UI         | `https://wex.androidempathy.com/_/` , superuser `<superuser-email>` (pw in password manager) |
| API              | `https://wex.androidempathy.com/api/...`                    |
| OAuth redirect   | `https://wex.androidempathy.com/api/oauth2-redirect`        |

**No secrets in this directory.** `deploy/.gitignore` excludes `*.env`,
`pb_data/`, the `pocketbase` binary, logs and pidfiles. The Google client
secret and the superuser password live in Chris's password manager and (as a
convenience backup, mode `600`) in `deploy/pocketbase/pocketbase.env` on the box
— never committed. `env.example` is the template.

## Files here

| File | Role |
|---|---|
| `pocketbase/pocketbase.user.service` | **the unit that runs the live instance** (per-user, no root) |
| `pocketbase/pocketbase.service` | system unit — reference only, for a host where you have root |
| `pocketbase/run-pocketbase.sh` + `crontab.fragment` | cron keepalive (fallback for a host with neither root nor user-linger) **+ the nightly SQLite backup line (task M6) — wanted on every box, systemd or not**|
| `pocketbase/pb_migrations/` | collection schema migrations (`workouts`, `users.admin`, `movements`), auto-applied on start ([README](pocketbase/pb_migrations/README.md)) |
| `pocketbase/env.example` | secret-file template |
| `nginx/wdl.conf` | a hand-managed nginx vhost — **not used on DreamHost** (panel does it); kept for a self-managed host |
| `../scripts/deploy-web.mjs` | builds + rsyncs the static builder/board into `pb_public/` (item 19) |

---

## 0. Architecture

```
  browser ──HTTPS──▶ DreamHost panel Proxy Server ──HTTP──▶ <vps-ip>:8090
  https://wex.androidempathy.com   (terminates TLS,          (PocketBase, user
                                    Let's Encrypt cert)        systemd service)
                                                              ├─ /api/  REST + OAuth
                                                              ├─ /_/    admin UI
                                                              └─ /      pb_public/ (item 19)
```

Same-origin: the browser only ever talks to `https://wex.androidempathy.com`, so
the apps call `/api/collections/...` with **no CORS**.

---

## 1. VPS capability check (run once, on a new box)

```sh
whoami; uname -a; cat /etc/os-release | head -3
sudo -n true 2>&1                         # root? (managed VPS: no)
loginctl enable-linger "$USER" 2>&1       # user units at boot? (managed VPS: yes)
systemctl --user show-environment >/dev/null 2>&1 && echo "user systemd OK"
crontab -l >/dev/null 2>&1 && echo "crontab OK"    # keepalive fallback
uname -m                                  # x86_64 -> linux_amd64
curl -sS -o /dev/null -w '%{http_code}\n' -L https://github.com/pocketbase/pocketbase/releases/latest
```

**Decision gate.** PocketBase needs a persistent process (systemd — system or
lingering-user — or `@reboot` cron), plus something in front doing TLS. On the
DreamHost managed VPS that resolves to: lingering user unit + panel Proxy
Server. If a box has none of those, stop and raise the fallback with Chris
(DreamHost DreamCompute, or a small box elsewhere) rather than hacking around it.

---

## 2. Domain / DNS

`wex.androidempathy.com` was already a hosted domain in the DreamHost panel
(it is the VPS's own hostname), so DNS was already pointed. For a fresh
subdomain: add it in the panel, point an `A` record at the VPS IP, wait for
`dig +short <domain>` to return it.

---

## 3. Install PocketBase

As the VPS user, `$PB_DIR` = `$HOME/pb`:

```sh
mkdir -p ~/pb/pb_data ~/pb/pb_migrations ~/pb/pb_backups && cd ~/pb
PB_VER=$(curl -fsSL https://api.github.com/repos/pocketbase/pocketbase/releases/latest \
  | grep -oP '"tag_name":\s*"v\K[^"]+')
curl -fsSL -o pb.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VER}/pocketbase_${PB_VER}_linux_amd64.zip"
unzip -o pb.zip pocketbase && rm pb.zip
./pocketbase --version
```

Put the collection migrations in place:

```sh
cp /path/to/repo/deploy/pocketbase/pb_migrations/*.js ~/pb/pb_migrations/
```

From then on, from a repo checkout with SSH to the box, **`make deploy:db`** does
this and restarts PocketBase to apply — `rsync` (no `--delete`, so admin-UI
snapshot migrations on the box are left alone) of
`deploy/pocketbase/pb_migrations/*.js` then `systemctl --user restart pocketbase`
+ a health check. Run it whenever a migration is added to the repo.

---

## 4. Process supervision — user systemd (the live path)

```sh
loginctl enable-linger "$USER"
mkdir -p ~/.config/systemd/user
cp /path/to/repo/deploy/pocketbase/pocketbase.user.service \
   ~/.config/systemd/user/pocketbase.service
systemctl --user daemon-reload
systemctl --user enable --now pocketbase
systemctl --user status pocketbase --no-pager
curl -sS http://127.0.0.1:8090/api/health        # {"code":200,...}
```

The unit binds `0.0.0.0:8090` — **required**, see the known issue below; a
`127.0.0.1` bind makes the panel proxy return 503.

**Reboot test** (item-18 deliverable): a managed VPS reboots from the panel
(*Servers & Usage → Manage → Reboot*). After it is back:
`curl -sS https://wex.androidempathy.com/api/health`.

Alternatives, if a box can't do the above: `pocketbase.service` (system unit,
needs root) or `run-pocketbase.sh` + `crontab.fragment` (cron keepalive).

---

## 5. Web + TLS — DreamHost panel Proxy Server

No nginx editing, no certbot (no root). In the panel:

1. **Servers & Usage → Manage** (this VPS) → scroll to **Proxy Server**.
2. Add a proxy: **URL** = `wex.androidempathy.com`, **path** = `/` (the form
   rejects a blank path even though the help text says otherwise — `/`
   prefix-matches the whole domain), **port** = `8090` → **Add Proxy**.
3. Enable the free **Let's Encrypt** certificate for the domain
   (*Websites → Secure Certificates*, or the domain's *Security* tab). The proxy
   terminates TLS with it.

Verify: `curl -sS https://wex.androidempathy.com/api/health` → `{"code":200,...}`,
and `https://wex.androidempathy.com/_/` loads the admin UI.

### Known issue: port 8090 exposure

The panel proxy connects to the daemon over the VPS **public IP**, so PocketBase
must bind `0.0.0.0` and `http://<vps-ip>:8090` is reachable from the
internet, bypassing the HTTPS proxy. Loopback and private-IP binds were both
tested and both make the proxy 503.

- **Mitigation in place:** every PocketBase route requires auth; collection
  rules are the real gate; superuser password is strong and in a password
  manager; PocketBase's built-in rate limiting is on (Chris enabled it 2026-11-21);
  the app sets **Application URL** = `https://wex.androidempathy.com`
  so all generated links/redirects are HTTPS regardless of which port a request
  came in on. All real traffic uses the `https://` origin.
- **Residual risk:** an on-path attacker could read a token *if* a client ever
  used the plaintext `:8090` endpoint — no client does.
- **Real fix (open):** DreamHost support ticket asking them to firewall external
  inbound TCP 8090 (proxy still allowed). No root to do it locally.

---

## 6. Superuser

```sh
cd ~/pb && ./pocketbase superuser create you@example.com 'a-strong-password'
```

Chris created the superuser. Its email and password are in his password manager — not
the repo, not `pocketbase.env`. Log in at `https://wex.androidempathy.com/_/`.

---

## 7. The `workouts` collection

Created by `pb_migrations/1756600000_create_workouts.js` on first serve
(applied cleanly on v0.40.1). In the admin UI → *Collections* → `workouts`:

| field        | type                | notes                                   |
|--------------|---------------------|-----------------------------------------|
| `owner`      | relation → `users`  | required, single, cascade delete        |
| `title`      | text                | optional                                |
| `source`     | text                | required — the `.wdl` body              |
| `visibility` | select (single)     | `private` / `unlisted` / `public`       |
| `wdlId`      | text                | nullable — set on save from `@id` (`<handle>:<slug>`), tasks L2/L3, DEC-021; search key for L4 |
| `created`    | autodate            | on create                               |
| `updated`    | autodate            | on create + update                      |

Indexes: plain on `owner`, on `visibility`, and on `wdlId` (`idx_workouts_wdl_id`
— not unique; search/lookup key, tasks L2–L4).

API rules:

| rule       | value                                                     |
|------------|-----------------------------------------------------------|
| List/View  | `owner = @request.auth.id \|\| visibility != "private"`  |
| Create     | `@request.auth.id != "" && owner = @request.auth.id`     |
| Update     | `owner = @request.auth.id`                               |
| Delete     | `owner = @request.auth.id`                               |

The client always sends `visibility: "private"` on create.

If a future PocketBase version rejects the migration, set the collection up by
hand to match the tables above, then snapshot it —
`./pocketbase migrate collections` — and commit the generated file (see
[`pocketbase/pb_migrations/README.md`](pocketbase/pb_migrations/README.md)).

No `profiles` collection — item 20 adds one only if it turns out to need it.

---

## 7a. The `users.admin` field

Added by `pb_migrations/1756700000_add_users_admin.js` (queue task M2) on serve:
a `bool admin` field on the built-in `users` collection, so the `movements`
collection (task M1) can gate create/update/delete on
`@request.auth.admin = true`. The field is `false` for every record until set,
so the migration on its own changes nothing.

**After the migration applies, grant yourself admin:** admin UI → *Collections →
`users`* → open your own row (your Google sign-in email) → tick **admin** → Save. The
migration can't do this — it doesn't know the user id. Do the same for any other
account that should curate global movements.

**Since `1757600000_lock_users_rules.js` (SEC-1), granting admin is
superuser-only.** The `users` rules reject any client write that sets `admin`
or `org`, including a user's write to their own row. The admin UI (a
superuser) is unaffected, and so is this step.

---

## 7b. The `movements` collection

Created by `pb_migrations/1756800000_create_movements.js` (queue task M1,
DEC-020) on serve — applied cleanly on v0.40.1. The curated movement layer
(~972 rows) that lived in `registry/movements.json` moves here; that file stays
in the repo as the reviewable dump (`make movements:dump`, M4). One column per
per-movement field, so a dump/ingest round-trip is shape-for-shape:

| field               | type                | notes                                             |
|---------------------|---------------------|---------------------------------------------------|
| `movementId`        | text                | required — the registry `id` (not `id`, which is PocketBase's own record id) |
| `title`             | text                | required                                          |
| `aliases`           | json                | string[]                                          |
| `muscles`           | json                | `{ primary, secondary, support, sources }`        |
| `pattern`           | json                | string[]                                          |
| `laterality`        | json                | `("both"\|"split"\|"per-side")[]`                 |
| `measures`          | json                | `("distance"\|"calories")[]`                      |
| `implements`        | json                | scalar number in the data; json keeps load/dump uniform |
| `equipment`         | json                | string[] (always an array in the data)            |
| `related`           | json                | string[]                                          |
| `sameAs`            | json                | string[]                                          |
| `force`             | select (single)     | `push` / `pull` / `static`                        |
| `mechanic`          | select (single)     | `compound` / `isolation`                          |
| `load`              | select (single)     | `total` / `per-implement`                         |
| `defaultLaterality` | select (single)     | `both` / `split` / `per-side`                     |
| `lateralityAxis`    | select (single)     | `arm` / `leg` / `side` / `hand` / `direction`     |
| `source`            | text                | import provenance string                          |
| `scope`             | select (single)     | required — `global` / `user`; M3 writes every row `global` |
| `user`              | relation → `users`  | single, nullable, cascade delete — unused in Phase 1, present for Phase 2 |
| `created`           | autodate            | on create                                         |
| `updated`           | autodate            | on create + update                               |

Indexes: unique on `movementId` (M3's idempotency key), plain on `scope`.

API rules:

| rule       | value                          |
|------------|--------------------------------|
| List/View  | `scope = "global"`             |
| Create     | `@request.auth.admin = true`   |
| Update     | `@request.auth.admin = true`   |
| Delete     | `@request.auth.admin = true`   |

Global movements are readable signed-out; only an admin (§7a) may create, edit
or delete one. Phase 2 will widen List/View to also expose a viewer's own
`scope = "user"` rows.

If a future PocketBase version rejects the migration, set the collection up by
hand to match the tables above, then snapshot it —
`./pocketbase migrate collections` — and commit the generated file.

---

## 7c. `users.org` / `users.handle` + the org accounts

Added by `pb_migrations/1756900000_add_users_handle_and_orgs.js` (queue task
L1, the *workout library* epic,
[DEC-021](../docs/context/topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it))
on serve — verified against a real v0.40.1 binary (`migrate up` / `down 1`
clean, a duplicate `handle` insert rejected by the index).

| field    | type          | notes                                              |
|----------|---------------|-----------------------------------------------------|
| `org`    | bool          | `false` for every record until set — flags a non-interactive account (owns a curated public set) |
| `handle` | text, unique  | the `@id` namespace prefix for the account's workouts; `[a-z0-9-]+`, user-editable |

Index: `CREATE UNIQUE INDEX idx_users_handle ON users (handle)`.

The same migration inserts three org rows — no OAuth identity, no sign-in,
`verified: true`, `org: true`, an unusable random password (an auth-collection
record needs one even though nobody authenticates as these):

| handle     | id                | notes                        |
|------------|-------------------|-------------------------------|
| `crossfit` | `org0crossfit001` | the CrossFit benchmark set (L5)|
| `hyrox`    | `org0hyrox000001` | the HYROX race + stations (L5) |
| `tabata`   | `org0tabata00001` | the Tabata protocol + variants (L5) |

**After the migration applies, glance at the admin UI**: *Collections →
`users`* — confirm the three org rows landed with `org` ticked and the right
`handle`, and that the `handle` field shows a unique-index badge. Nothing to
grant — org rows never sign in, so there's no admin flag or password to set
(contrast §7a). A real account gets its own handle automatically (a random
`adjective-noun` pair) on first sign-in via `apps/shared/pocketbase.js`
(`ensureHandle()`); the builder header lets a user change it afterward.

If a future PocketBase version rejects the migration, add the two fields and
the index by hand to match the table above, insert the three rows with the
fixed ids above, then snapshot the schema
(`./pocketbase migrate collections`) and commit the generated file.

---

## 7d. `workouts.wdlId`

Added by `pb_migrations/1757000000_add_workouts_wdlid.js` (queue task L2, the
*workout library* epic,
[DEC-021](../docs/context/topics/settled-decisions.md#dec-021-an-accounts-handle-is-the-id-namespace-forced-onto-every-workout-on-save-workoutswdlid-mirrors-it))
on serve — verified against a real v0.40.1 binary (`migrate up` / `down 1` /
`up` all clean; `wdlId` + `idx_workouts_wdl_id` land and revert together).

| field   | type          | notes                                                                 |
|---------|---------------|----------------------------------------------------------------------|
| `wdlId` | text (max 260)| nullable, no default — mirrors the `@id` (`<handle>:<slug>`); `null` for every existing row until re-saved (L3) or loaded (L6) |

Index: `CREATE INDEX idx_workouts_wdl_id ON workouts (wdlId)` — **plain, not
unique** (two owners may hold the same slug; same-owner collisions get L3's
`-2`/`-3` suffix). No API-rule change — the item-18 visibility rules are
untouched.

L2 is schema only: nothing sets `wdlId` yet. **L3** makes
`apps/shared/pocketbase.js` write it on every create/update (from the forced
`@id` line) and adds `getByAnyId`; **L4** searches on it; **L6**'s loader sets
it for the org library rows.

**After the migration applies, glance at the admin UI**: *Collections →
`workouts`* — confirm the `wdlId` text column is present and that
`idx_workouts_wdl_id` shows in the collection's index list. Nothing to
backfill or grant.

If a future PocketBase version rejects the migration, add the field and the
index by hand to match the above, then snapshot the schema
(`./pocketbase migrate collections`) and commit the generated file.

---

## 7e. Server-side write guards and CORS (security audit, 2026-11-21)

- **`pb_hooks/wdl_guards.pb.js`** (SEC-2, SEC-4): a non-superuser can only
  save a namespaced key (`wdlId`, `setId`, a `user` goal's `goalId`) under
  their own `<handle>:`, and only a handle that passes the app's
  `validateHandle()` rules. `make deploy:db` syncs `pb_hooks/` to
  `~/pb/pb_hooks` (with `--delete`), and PocketBase loads it by default.
- **`1757800000_guard_ownership_rules.js`** (SEC-3, SEC-6): rows can't be
  handed to another account, and a goal can't be flipped into the global tier
  by its owner.
- **CORS** (SEC-7): the unit passes `--origins https://wex.androidempathy.com`,
  so browsers on other sites can't call the API. A unit change needs `make
  deploy:unit`, which overwrites `~/.config/systemd/user/pocketbase.service`
  with the repo's copy, then daemon-reloads and restarts. If the box's unit has
  diverged from the repo, diff it first.

---

## 8. Google OAuth2

Cloud Console half (Chris's Google account):

1. <https://console.cloud.google.com/> → project "WDL hosted".
2. *APIs & Services → OAuth consent screen* → **External**; app name, support +
   developer email; scopes `openid` / `email` / `profile`; add Chris + training
   partners as **test users**; leave it in "Testing" mode (no Google
   verification needed for a handful of users).
3. *APIs & Services → Credentials → Create credentials → OAuth client ID → Web
   application*:
   - **Authorized JavaScript origin:** `https://wex.androidempathy.com`
   - **Authorized redirect URIs** (both):
     - `https://wex.androidempathy.com/api/oauth2-redirect` — PocketBase's own
       handler (the admin UI "Test" button, the SDK popup flow).
     - `https://wex.androidempathy.com/apps/builder/auth-callback.html` — the
       builder's redirect flow (queue item 20). `apps/shared/pocketbase.js`
       sends the browser to Google with this as `redirect_uri` and posts it
       back to `auth-with-oauth2` as `redirectURL`; the two must match a
       registered URI exactly or Google returns `redirect_uri_mismatch`.
4. Copy the client ID + secret.

PocketBase half: admin UI → *Collections → `users` → Options → OAuth2* → enable
**Google**, paste client ID + secret, Save. Back up id/secret in
`deploy/pocketbase/pocketbase.env` (mode `600`) and the password manager.

Verify:

```sh
curl -sS 'https://wex.androidempathy.com/api/collections/users/auth-methods'
# -> the response should list an oauth2 provider "google"
```

Then drive the flow with a test-user Google account — the admin UI's provider
"Test" button, or the builder's **Sign in with Google** (item 20): complete
Google, confirm the redirect lands back on the app (`.../api/oauth2-redirect`
for the Test button, `.../apps/builder/auth-callback.html` for the builder)
with a `code`, and a `users` record is created.

---

## 9. Operations

### Upgrade PocketBase

```sh
cd ~/pb
cp pocketbase "pocketbase.$(./pocketbase --version | awk '{print $NF}')"   # keep the old binary
# download the new release as in step 3, overwriting ./pocketbase
systemctl --user restart pocketbase
./pocketbase --version && curl -sS http://127.0.0.1:8090/api/health
```

Back up first (below). Read release notes for breaking changes to collection
rules or the migration API.

### Back up (SQLite)

Ad hoc, any time:

```sh
# admin UI: Settings -> Backups -> "Create backup"  (downloadable zip), or:
cd ~/pb
sqlite3 pb_data/data.db ".backup '$HOME/pb/pb_backups/data-$(date -u +%Y%m%dT%H%M%SZ).db'"
```

**Automated nightly backup — task M6.** Once the curated movement layer lives in
the DB (DEC-020), `~/pb/pb_data/data.db` is the primary copy of ~972 curated
movements plus every saved workout; `registry/movements.json` in the repo is only
as current as the last `make movements:dump`. So the box takes a dated snapshot
every night and a second copy is pulled off the box.

The mechanism is a **shell cron line**, not PocketBase's built-in scheduler: the
box already carries a per-user `crontab` for the keepalive fallback, so one more
greppable, version-controlled line beside it — with the schedule, the retention
prune and the path all visible in the repo — beats a setting buried in PB's
own DB that still needs a separate off-box cron anyway. The "box down at 03:17"
risk is equal for either scheduler and small (the keepalive means the box is
almost always up; a missed night loses at most a day of edits, and the off-box
pull only ever copies what exists). PB's scheduler is the fallback below, for a
box without `sqlite3`.

**On the VPS** — one line in the PocketBase account's `crontab -e`, from
[`pocketbase/crontab.fragment`](pocketbase/crontab.fragment) (which now carries
it next to the keepalive):

```
17 3 * * * sqlite3 "$HOME/pb/pb_data/data.db" ".backup '$HOME/pb/pb_backups/data-$(date -u +\%F).db'" >> "$HOME/pb/pb_backups/backup.log" 2>&1 && find "$HOME/pb/pb_backups" -name 'data-*.db' -mtime +30 -delete
```

- `.backup` is SQLite's online hot-copy — safe to run while PocketBase is live.
  It captures `pb_data/data.db` only: users, workouts, movements. `auxiliary.db`
  (request logs) and `storage/` (uploaded files — none yet, workouts are text)
  are **not** in it; if either becomes load-bearing, switch to the PB zip below.
- `\%F` — cron turns an unescaped `%` into a newline, so every `%` in a crontab
  command must be backslash-escaped. `\%F` reaches the shell as `%F`, giving one
  `data-YYYY-MM-DD.db` per night.
- `find … -mtime +30 -delete` keeps ~30 days on the box; the off-box copy keeps
  the long tail.
- This line is wanted **whether or not** the box uses the systemd unit — it is
  supervision-independent.

**Off the box** — pull to Chris's machine over the same `~/.ssh/config` alias
`make deploy` uses (so no new key material anywhere; the VPS never needs an
outbound credential). From a repo checkout:

```sh
make backups:pull   # rsync -av <ssh-alias>:pb/pb_backups/ db-backups/  (WDL_BACKUP_DIR to override)
```

The snapshots land in **`db-backups/`** at the repo root — repo-relative on
purpose, not a home-directory path. Its contents (and `pull.log`) are
git-ignored; `db-backups/README.md` is the only tracked file, so the directory
exists in a fresh clone. Set `WDL_BACKUP_DIR` (absolute path) in `.env` or the
environment to keep backups elsewhere.

No `--delete`: the local copy accumulates history past the VPS's 30-day prune.
A **pull** is chosen over a VPS **push cron** deliberately — a push would need an
outbound keypair minted on the managed box and Chris's laptop reachable at backup
time; a pull reuses the credential direction that already works for `make deploy`.
For a hands-off copy, add a line to Chris's *own* crontab (not the fragment,
which is the VPS's):

```
0 6 * * * cd /path/to/repo && make backups:pull >> db-backups/pull.log 2>&1
```

**Alternative mechanism — PocketBase built-in scheduled backups.** If `sqlite3`
is not on the box, or a whole-`pb_data/` zip (including `storage/`) is wanted:
admin UI → *Settings → Backups* → set **Auto backups cron** to `0 3 * * *` and
**Max keep** to `30`. This is a still-to-do-on-the-box item like §7a — it cannot
be set by a migration. Backups then land in `pb_data/backups/*.zip`; point the
off-box `rsync` at `~/pb/pb_data/backups/` instead, and restore via *Settings →
Backups → Restore*.

**Status (2026-09-02): complete.** The backup line is installed in the
PocketBase account's `crontab -e` and running — `~/pb/pb_backups/` holds
`data-2026-09-01.db` (a manual test) and `data-2026-09-02.db` (written by cron
at 03:17 UTC), `backup.log` empty. `make backups:pull` has been run and both
snapshots landed in the repo-relative `db-backups/` (git-ignored contents).

To force a snapshot by hand on the VPS (e.g. before a PocketBase upgrade):

```sh
mkdir -p ~/pb/pb_backups   # the cron line does not create it
sqlite3 "$HOME/pb/pb_data/data.db" ".backup '$HOME/pb/pb_backups/data-$(date -u +%F).db'"
ls -la ~/pb/pb_backups/            # the dated .db is there
```

(run by hand `%F` is plain — the `\%F` in the crontab line is only cron's
`%`-escaping) —

— and run the off-box `rsync` from Chris's machine once, confirming the file
lands. Same "still to do on deploy" caveat M1/M2/M3 carry.

### Restore

```sh
systemctl --user stop pocketbase
cd ~/pb
cp pb_backups/data-YYYY-MM-DD.db pb_data/data.db      # the dated snapshot you want
rm -f pb_data/data.db-wal pb_data/data.db-shm         # a stale WAL over a restored DB corrupts it
systemctl --user start pocketbase
curl -sS http://127.0.0.1:8090/api/health
```

This restores app data (users, workouts, movements) — the `.backup` snapshot's
scope. `auxiliary.db` (logs) is left as-is; `storage/` is unaffected (empty).
After a restore that rolled movements back, re-run `make movements:dump` against
prod to bring `registry/movements.json` into line, or `make movements:load` to
push the repo's copy forward — whichever direction is correct.

From a PocketBase backup zip: *Settings → Backups → Restore*, or unzip over a
stopped `pb_data/`.

---

## 10. Static apps (item 19)

The builder and board are plain static files. The DreamHost panel proxy sends
the **whole domain** to PocketBase (item 18's known constraint), so there is no
separate web root to point nginx at — the apps live in **PocketBase's own
`pb_public/`** (`~/pb/pb_public/`), which `apis.Static` serves at `/` for every
path that is not `/api/…` or `/_/…`. Same-origin with the API for free.

### What ships

`scripts/deploy-web.mjs` assembles the served subtree **repo-shaped** — the apps
fetch everything by relative path (`../../build/web/core/…`,
`../../spec/grammar-0.1.ohm`, `../../registry/*.json`,
`../../examples/goals/…`, `../shared/…`), so the tree under `pb_public/` has to
mirror the repo:

```
pb_public/
  index.html                       generated — redirects / to /apps/builder/
  apps/          builder/ display/ shared/   (verbatim copy of apps/)
  build/web/core/                   from `node scripts/build-web.mjs`
  spec/grammar-0.1.ohm              the only spec/ file the apps fetch
  registry/movements.json  movements.canonical.json  muscles.json
  examples/goals/                   *.wdlg the builder's goal picker loads
```

Nothing else is shipped — no `packages/`, `node_modules`, `docs/`, `.git`,
`test/`, and no other `spec/` / `registry/` / `examples/` files. The list of
what to copy is `COPY` at the top of `scripts/deploy-web.mjs`; if an app grows a
new relative fetch, add it there.

Item 20's additions — `apps/shared/pocketbase.js` and
`apps/builder/auth-callback.html` — need no `COPY` entry: `apps/` is copied
wholesale. The apps talk to the co-located PocketBase at `/api/...` (same
origin, no CORS); a `private`/missing workout id returns 404 and the board
renders a "not found" line rather than failing.

### Deploy

```sh
# from the repo root, with SSH access to the VPS
WDL_DEPLOY_SSH=<ssh-user>@<vps-host> node scripts/deploy-web.mjs
```

It (1) runs `npm --prefix packages/core test` and bails on a red suite,
(2) runs `node scripts/build-web.mjs`, (3) rebuilds `build/deploy/pb_public/`
from scratch, (4) `rsync -az --delete` that tree to `~/pb/pb_public/` on the
box. `--delete` means **anything in `pb_public/` the script did not write is
removed** — hence the generated `index.html` rather than a hand-placed one.

Flags: `--ssh user@host` / `WDL_DEPLOY_SSH` (required for the rsync; without it
the script stages and prints the exact `rsync` line for a hand run),
`--remote-dir` / `WDL_DEPLOY_DIR` (default `pb/pb_public`, home-relative),
`--dry-run` (rsync `-n`), `--stage-only` (stop after assembling the tree),
`--skip-tests` (layout iteration only — never a real deploy).

No PocketBase restart is needed; `apis.Static` reads the directory per request.

### `/` routing

`pb_public/index.html` is generated by the script: a `<meta refresh>` +
`location.replace('/apps/builder/')` + a plain link fallback. `/` lands on the
builder. (A `serve.mjs`-style file listing was the alternative — a redirect is
less to look at and item 19's deliverable is "land on the builder".)

### MIME types

PocketBase serves `pb_public` through Go's `http.ServeContent`, which sets the
`Content-Type` from the file extension and falls back to content sniffing.
`.js` / `.json` / `.css` / `.html` / `.svg` are all known. `.ohm` and `.wdlg`
are unknown to Go, but they are UTF-8 text so the sniffer returns
`text/plain; charset=utf-8` — **and it does not matter anyway**: both apps read
those two with `fetch(...).then(r => r.text())`, which ignores the content type.
Verified by serving the staged tree with a server that returns
`application/octet-stream` for every unknown extension: the parser and the goal
picker both loaded clean. No rename-on-deploy, no `pb_hooks` route, no MIME
config — nothing needed.

### Cache headers

`http.ServeContent` sends **`Last-Modified`** and honours `If-Modified-Since`
(and `Range`); it sets **no `Cache-Control`** and **no `ETag`** for `pb_public`
(the `max-age=1209600` line in PocketBase is scoped to the `/_/` admin UI only).
So the browser revalidates against `Last-Modified`, with a heuristic-freshness
window in between.

**Decision: accept that as-is; add nothing.** The staleness item 19 worried
about — `spec/grammar-0.1.ohm` / `registry/*.json` drifting against a freshly
built `build/web/core/` — cannot happen through a normal deploy: one `rsync`
rewrites all of them together, every mtime bumps together, and nothing here is
content-hash-pinned to an old filename. The only residual is a returning user
whose browser still holds a heuristically-fresh *pre-deploy* copy of one file;
for a handful of users it resolves on the next hard reload / heuristic expiry.
**If** that is ever observed biting, the escalation (documented, not shipped) is
a `deploy/pocketbase/pb_hooks/` middleware setting `Cache-Control: no-cache` on
`pb_public` responses — reversible, ~10 lines, and out of scope for ~5 users.

---

## Site notes — as-built 2026-08-30

- **VPS:** DreamHost managed `vps28777`, Ubuntu 22.04.5, no root, 1 GB RAM,
  16 GB free on `/home`.
- **Persistence:** `loginctl enable-linger` succeeded → user systemd unit
  `~/.config/systemd/user/pocketbase.service`, `WantedBy=default.target`.
  (`crontab -e` also works, kept as documented fallback.)
- **`WDL_DOMAIN`:** `wex.androidempathy.com` (already panel-hosted).
- **PocketBase:** v0.40.1, linux_amd64, `~/pb`. Idles ~10-15 MB RSS.
- **Proxy:** panel Proxy Server, path `/`, port `8090`. Panel Let's Encrypt.
- **Bind:** `0.0.0.0:8090` forced by the proxy connecting over the public IP —
  loopback and `<private-ip>` (private) both 503 the proxy. Port 8090 is
  therefore internet-reachable in plaintext; **DreamHost support ticket to
  firewall it is open** (see "Known issue" above).
- **Superuser:** `<superuser-email>` (password manager).
- **Migration:** `1756600000_create_workouts.js` applied clean on v0.40.1;
  `workouts` collection + rules verified in the admin UI.
- **Reboot test:** _pending_
- **Google OAuth verified:** _in progress_
