# deploy/ — hosting runbook

The public WDL instance: the static apps plus **PocketBase** beside them for
Google sign-in and saved/shared workouts. Rationale, and the alternatives that
were rejected, are in
[`../docs/context/topics/settled-decisions.md`](../docs/context/topics/settled-decisions.md)
(DEC-016). This file is the operational how-to.

- **Item 18** (done 2026-08-30): PocketBase up on the VPS behind the panel proxy
  + TLS, same-origin, with the `workouts` collection and Google OAuth2.
- **Item 19** (later): the static-app deploy. Because the panel proxy sends the
  **whole domain** to PocketBase, the apps ship into PocketBase's `pb_public/`
  (served at `/` for any non-`/api/`, non-`/_/` path) — not a separate nginx
  root. A deploy script rsyncs the built tree there.
- **Item 20** (later): the frontend code that calls `/api/...`.

## As-built (the live instance)

| Thing            | Value                                                        |
|------------------|-------------------------------------------------------------|
| Host             | DreamHost **managed** VPS `vps28777` — Ubuntu 22.04, **no root** |
| OS account       | `androidempathy_wex`, home `/home/androidempathy_wex`       |
| Domain           | `https://wex.androidempathy.com`                            |
| PocketBase       | v0.40.1, `~/pb/pocketbase`, data `~/pb/pb_data`             |
| Bind             | `0.0.0.0:8090` (see "Known issue" below)                    |
| Process          | **user** systemd unit `~/.config/systemd/user/pocketbase.service`, linger enabled |
| Web / TLS        | DreamHost panel **Proxy Server** (`/` → port 8090) + panel Let's Encrypt |
| Admin UI         | `https://wex.androidempathy.com/_/` , superuser `chris@winberry.net` (pw in password manager) |
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
| `pocketbase/run-pocketbase.sh` + `crontab.fragment` | cron keepalive — fallback for a host with neither root nor user-linger |
| `pocketbase/pb_migrations/` | the `workouts` collection schema, auto-applied on start ([README](pocketbase/pb_migrations/README.md)) |
| `pocketbase/env.example` | secret-file template |
| `nginx/wdl.conf` | a hand-managed nginx vhost — **not used on DreamHost** (panel does it); kept for a self-managed host |

---

## 0. Architecture

```
  browser ──HTTPS──▶ DreamHost panel Proxy Server ──HTTP──▶ 173.236.218.180:8090
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

Put the collection migration in place:

```sh
cp /path/to/repo/deploy/pocketbase/pb_migrations/*.js ~/pb/pb_migrations/
```

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
must bind `0.0.0.0` and `http://173.236.218.180:8090` is reachable from the
internet, bypassing the HTTPS proxy. Loopback and private-IP binds were both
tested and both make the proxy 503.

- **Mitigation in place:** every PocketBase route requires auth; collection
  rules are the real gate; superuser password is strong and in a password
  manager; the app sets **Application URL** = `https://wex.androidempathy.com`
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

Chris created `chris@winberry.net`. Credentials in his password manager — not
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
| `created`    | autodate            | on create                               |
| `updated`    | autodate            | on create + update                      |

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
   - **Authorized redirect URI:** `https://wex.androidempathy.com/api/oauth2-redirect`
4. Copy the client ID + secret.

PocketBase half: admin UI → *Collections → `users` → Options → OAuth2* → enable
**Google**, paste client ID + secret, Save. Back up id/secret in
`deploy/pocketbase/pocketbase.env` (mode `600`) and the password manager.

Verify:

```sh
curl -sS 'https://wex.androidempathy.com/api/collections/users/auth-methods'
# -> the response should list an oauth2 provider "google"
```

Then drive the flow with a test-user Google account (the admin UI's provider
"Test" button, or wait for item 20's "Sign in with Google"): complete Google,
confirm the redirect lands on `.../api/oauth2-redirect` with a `code` and a
`users` record is created.

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

```sh
# admin UI: Settings -> Backups -> "Create backup"  (downloadable zip), or:
cd ~/pb
sqlite3 pb_data/data.db ".backup '$HOME/pb/pb_backups/data-$(date -u +%Y%m%dT%H%M%SZ).db'"
```

`storage/` holds uploaded files (none yet — workouts are text). Automate a daily
`sqlite3 .backup` + `find pb_backups -mtime +30 -delete` via `crontab -e`, and
**copy the backups off the box** (rsync/scp to Chris's machine).

### Restore

```sh
systemctl --user stop pocketbase
cd ~/pb
cp pb_backups/data-WANTED.db pb_data/data.db
rm -f pb_data/data.db-wal pb_data/data.db-shm
systemctl --user start pocketbase
curl -sS http://127.0.0.1:8090/api/health
```

From a PocketBase backup zip: *Settings → Backups → Restore*, or unzip over a
stopped `pb_data/`.

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
  loopback and `10.221.116.205` (private) both 503 the proxy. Port 8090 is
  therefore internet-reachable in plaintext; **DreamHost support ticket to
  firewall it is open** (see "Known issue" above).
- **Superuser:** `chris@winberry.net` (password manager).
- **Migration:** `1756600000_create_workouts.js` applied clean on v0.40.1;
  `workouts` collection + rules verified in the admin UI.
- **Reboot test:** _pending_
- **Google OAuth verified:** _in progress_
