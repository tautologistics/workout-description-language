/**
 * A no-deps mock of the PocketBase `/api` surface — for `make serve` only.
 *
 * **Why.** In production the apps talk to a co-located PocketBase at `/api/*`
 * (same origin, no CORS) through `apps/shared/pocketbase.js`. Under
 * `scripts/serve.mjs` there is no PocketBase, so Google sign-in, saved workouts
 * and (since task M1) DB-backed movements would all 404. This module answers
 * exactly the endpoints that client calls, from committed fixtures plus
 * `registry/movements.json`. It is a dev convenience, not a second
 * implementation of PocketBase — DEC-020, queue task M7.
 *
 * **No dependency, no build step** — this is still a one-person dev server
 * (DEC-003 / DEC-017): plain `node:fs` and `node:http` request objects.
 *
 * Endpoints covered (the whole of `apps/shared/pocketbase.js`):
 *
 *   GET    /api/collections/users/auth-methods       — Google authURL (points at the local stub below)
 *   GET    /api/_mock/oauth                          — local stub for Google's consent screen: 302s straight back with a canned ?code
 *   POST   /api/collections/users/auth-with-oauth2   — accepts any code, returns the fixture user + a fake token
 *   POST   /api/collections/users/auth-refresh       — same fixture user + a fresh fake token
 *   GET    /api/collections/users/records            — list/filter (open here, unlike the real `id = @request.auth.id` rule — see below)
 *   PATCH  /api/collections/users/records/:id        — set `handle` (and a couple of other fields); enforces `handle` uniqueness
 *   GET    /api/collections/workouts/records         — list  { page, perPage, totalItems, totalPages, items }
 *   GET    /api/collections/workouts/records/:id     — one record (404 shape on miss)
 *   POST   /api/collections/workouts/records         — create (persists to fixtures/workouts.local.json)
 *   PATCH  /api/collections/workouts/records/:id     — update (persists)
 *   DELETE /api/collections/workouts/records/:id     — delete (persists), 204
 *   GET    /api/collections/movements/records        — list, from registry/movements.json + local writes, in the PB record shape
 *   GET    /api/collections/movements/records/:id    — one movement (by synthetic id or movementId)
 *   POST   /api/collections/movements/records        — create, IF the request carries an Authorization header (else 403 — mirrors the admin-only rule)
 *   PATCH  /api/collections/movements/records/:id     — update, same Authorization gate; 403 without it
 *   DELETE /api/collections/movements/records/:id     — delete, same Authorization gate; 403 without it, 204 with
 *
 * Query params honoured on the two list routes, only as far as the client uses
 * them: `filter` (a minimal `field="value"` AND match — enough for `owner="…"`
 * and, since L3, `wdlId="<handle>:<slug>"` — the generic matcher already spans
 * the colon), `sort` (`-updated` etc.), `page`, `perPage`. Not a query engine.
 *
 * **`wdlId` (task L3, DEC-021).** `workouts` create/update run the same
 * force-`@id` + set-`wdlId` logic as `apps/shared/pocketbase.js` (`forceWdlId`
 * below): the `@id` line in `source` is rewritten to `<owner-handle>:<slug>`
 * and `wdlId` is set to match, resolving the owner's handle from the `users`
 * fixture (so a `curl` POST is namespaced just like a builder save). Seed rows
 * in `fixtures/workouts.json` carry no `wdlId` on purpose (pre-L3 state); it is
 * filled on first re-save.
 *
 * Fixture write state (`fixtures/workouts.local.json`, `fixtures/movements.local.json`,
 * `fixtures/users.local.json`) is git-ignored — delete it to reset to the
 * committed seed / `registry/movements.json`. Movement writes (task M3's
 * `make movements:load`, and the M5 editor) land in
 * `fixtures/movements.local.json` and are merged over the registry-derived list
 * on read, keyed by `movementId`.
 *
 * **`handle` (task L1, DEC-021).** `fixtures/users.json`'s mock signed-in user
 * (`users[0]`) is committed **without** a `handle`, on purpose: the first
 * sign-in exercises `apps/shared/pocketbase.js`'s random `adjective-noun`
 * assignment path exactly the way a brand-new real account would. The
 * assigned handle (and any later edit through the builder's handle editor)
 * persists to `fixtures/users.local.json`; delete that file to go back to a
 * handle-less mock user and see the assignment run again. `fixtures/users.json`
 * also carries the three `org: true` rows (`crossfit`, `hyrox`, `tabata`, fixed
 * ids matching the L1 migration) so `handle` collisions against them are
 * exercisable locally (edit your handle to `crossfit` → rejected).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const M_JSON = ['aliases', 'muscles', 'pattern', 'laterality', 'measures', 'implements', 'equipment', 'related', 'sameAs'];
const M_SCALAR = ['force', 'mechanic', 'load', 'lateralityAxis', 'defaultLaterality', 'source'];

/**
 * Build the mock handler. `root` is the repo root (`process.cwd()` in serve.mjs).
 * Returns `async (req, res, url) => boolean` — `true` when it wrote the
 * response, `false` to let the caller fall through to static handling.
 */
export function createMockApi(root) {
  const P = (...p) => join(root, ...p);

  const usersSeedPath = P('fixtures/users.json');
  const usersLocalPath = P('fixtures/users.local.json');
  let users = existsSync(usersLocalPath)
    ? (readJson(usersLocalPath).users ?? [])
    : JSON.parse(JSON.stringify(readJson(usersSeedPath).users ?? []));
  if (!users.length) {
    users = [{
      id: 'u_mock_0001', collectionId: '_pb_users_auth_', collectionName: 'users',
      email: 'dev@example.com', name: 'Dev', verified: true, admin: true,
    }];
  }
  // The mock always signs everyone in as users[0] — see the module doc.
  const fixtureUser = users[0];

  const persistUsers = () => {
    try {
      writeFileSync(usersLocalPath, JSON.stringify({
        $comment: 'Runtime write state for the local dev mock /api. Git-ignored. Delete to reset to fixtures/users.json (and re-exercise the random-handle assignment path).',
        users,
      }, null, 2) + '\n');
    } catch (e) {
      console.error(`  mock /api: could not persist users — ${e.message}`);
    }
  };

  const seedPath = P('fixtures/workouts.json');
  const localPath = P('fixtures/workouts.local.json');
  let workouts = existsSync(localPath)
    ? (readJson(localPath).workouts ?? [])
    : JSON.parse(JSON.stringify(readJson(seedPath).workouts ?? []));

  const persist = () => {
    try {
      writeFileSync(localPath, JSON.stringify({
        $comment: 'Runtime write state for the local dev mock /api. Git-ignored. Delete to reset to fixtures/workouts.json.',
        workouts,
      }, null, 2) + '\n');
    } catch (e) {
      console.error(`  mock /api: could not persist workouts — ${e.message}`);
    }
  };

  let movementBase = null; // registry/movements.json mapped to records, on first request
  const loadMovementBase = () => {
    if (!movementBase) movementBase = (readJson(P('registry/movements.json')).movements ?? []).map(toMovementRecord);
    return movementBase;
  };

  // Runtime movement writes — overlaid on the registry list, keyed by
  // `movementId`. `overlay` holds created/updated records; `deleted` holds
  // tombstoned `movementId`s. Persisted git-ignored, same as workouts.
  const mvLocalPath = P('fixtures/movements.local.json');
  const mvLocal = existsSync(mvLocalPath) ? readJson(mvLocalPath) : {};
  let mvOverlay = Array.isArray(mvLocal.movements) ? mvLocal.movements : [];
  let mvDeleted = Array.isArray(mvLocal.deleted) ? mvLocal.deleted : [];

  const persistMovements = () => {
    try {
      writeFileSync(mvLocalPath, JSON.stringify({
        $comment: 'Runtime movement write state for the local dev mock /api. Git-ignored. Delete to reset to registry/movements.json.',
        movements: mvOverlay,
        deleted: mvDeleted,
      }, null, 2) + '\n');
    } catch (e) {
      console.error(`  mock /api: could not persist movements — ${e.message}`);
    }
  };

  /** The registry list with runtime writes merged over it, keyed by movementId. */
  const currentMovements = () => {
    const byId = new Map(loadMovementBase().map((m) => [m.movementId, m]));
    for (const rec of mvOverlay) byId.set(rec.movementId, rec);
    for (const id of mvDeleted) byId.delete(id);
    return [...byId.values()];
  };

  const upsertMovement = (rec) => {
    const i = mvOverlay.findIndex((m) => m.movementId === rec.movementId);
    if (i >= 0) mvOverlay[i] = rec; else mvOverlay.push(rec);
    mvDeleted = mvDeleted.filter((id) => id !== rec.movementId);
    persistMovements();
  };

  return async function handle(req, res, url) {
    const { pathname } = url;
    const method = req.method;
    try {
      // -- auth ---------------------------------------------------------------
      if (pathname === '/api/collections/users/auth-methods' && method === 'GET') {
        return json(res, 200, authMethods(url));
      }
      if (pathname === '/api/_mock/oauth') {
        const redirectUri = url.searchParams.get('redirect_uri');
        const state = url.searchParams.get('state') ?? '';
        if (!redirectUri) return json(res, 400, err(400, 'mock oauth stub: missing redirect_uri'));
        const back = new URL(redirectUri);
        back.searchParams.set('state', state);
        back.searchParams.set('code', 'mock_auth_code');
        res.writeHead(302, { location: back.toString() });
        res.end();
        return true;
      }
      if (pathname === '/api/collections/users/auth-with-oauth2' && method === 'POST') {
        await readBody(req);
        return json(res, 200, { token: mkToken(), record: fixtureUser, meta: { avatarURL: '', rawUser: {} } });
      }
      if (pathname === '/api/collections/users/auth-refresh' && method === 'POST') {
        return json(res, 200, { token: mkToken(), record: fixtureUser });
      }

      // -- users / handle (task L1, DEC-021) ---------------------------------
      // The real `users` list/view rule is `id = @request.auth.id` (nobody
      // browses other accounts); the mock leaves list/filter open so the
      // free-handle pre-check (`handleTaken` in pocketbase.js) is fully
      // accurate locally, unlike against real PocketBase where it is only
      // best-effort. Only `PATCH` needs an Authorization header, mirroring
      // every other authed write here.
      if (pathname === '/api/collections/users/records' && method === 'GET') {
        return json(res, 200, listEnvelope(applyQuery(users, url), url));
      }
      if (pathname.startsWith('/api/collections/users/records/')) {
        const id = decodeURIComponent(pathname.slice('/api/collections/users/records/'.length));
        const idx = users.findIndex((u) => u.id === id);
        if (method === 'GET') {
          return idx < 0 ? json(res, 404, err(404, "The requested resource wasn't found.")) : json(res, 200, users[idx]);
        }
        if (method === 'PATCH') {
          if (!req.headers.authorization) return json(res, 403, err(403, 'Only the account itself may edit its record.'));
          if (idx < 0) return json(res, 404, err(404, "The requested resource wasn't found."));
          const body = await readBody(req);
          if ('handle' in body) {
            const taken = users.some((u, i) => i !== idx && u.handle === body.handle);
            if (taken) {
              return json(res, 400, err(400, 'Failed to save.', {
                handle: { code: 'validation_not_unique', message: 'Value must be unique.' },
              }));
            }
            users[idx].handle = body.handle;
          }
          for (const k of ['org', 'name']) if (k in body) users[idx][k] = body[k];
          users[idx].updated = pbNow();
          persistUsers();
          return json(res, 200, users[idx]);
        }
      }

      // -- workouts ---------------------------------------------------------
      if (pathname === '/api/collections/workouts/records') {
        if (method === 'GET') return json(res, 200, listEnvelope(applyQuery(workouts, url), url));
        if (method === 'POST') {
          const body = await readBody(req);
          const now = pbNow();
          const rec = {
            id: mkId('wk'), collectionId: 'mock_workouts', collectionName: 'workouts',
            owner: body.owner ?? fixtureUser.id,
            title: body.title ?? '',
            source: body.source ?? '',
            wdlId: body.wdlId ?? null,
            visibility: body.visibility ?? 'private',
            created: now, updated: now,
          };
          forceWdlId(rec, workouts, users);
          workouts.push(rec);
          persist();
          return json(res, 200, rec);
        }
      }
      if (pathname.startsWith('/api/collections/workouts/records/')) {
        const id = decodeURIComponent(pathname.slice('/api/collections/workouts/records/'.length));
        const idx = workouts.findIndex((w) => w.id === id);
        if (method === 'GET') {
          return idx < 0 ? json(res, 404, err(404, "The requested resource wasn't found.")) : json(res, 200, workouts[idx]);
        }
        if (method === 'PATCH') {
          if (idx < 0) return json(res, 404, err(404, "The requested resource wasn't found."));
          const body = await readBody(req);
          for (const k of ['title', 'source', 'visibility', 'owner', 'wdlId']) if (k in body) workouts[idx][k] = body[k];
          if ('source' in body) forceWdlId(workouts[idx], workouts, users);
          workouts[idx].updated = pbNow();
          persist();
          return json(res, 200, workouts[idx]);
        }
        if (method === 'DELETE') {
          if (idx >= 0) { workouts.splice(idx, 1); persist(); }
          res.writeHead(204);
          res.end();
          return true;
        }
      }

      // -- movements ------------------------------------------------------
      // Reads are open (the collection's list/view rule is `scope = "global"`).
      // Writes need admin in production; here any Authorization header stands in
      // for that (the auth short-circuit above hands every signed-in caller an
      // `admin: true` fixture user), so `make movements:load` and the M5 editor
      // round-trip locally. Writes persist to fixtures/movements.local.json.
      const mvWriteDenied = () => json(res, 403, err(403, 'Only admins can write global movements.'));
      if (pathname === '/api/collections/movements/records') {
        if (method === 'GET') return json(res, 200, listEnvelope(applyQuery(currentMovements(), url), url));
        if (method === 'POST') {
          if (!req.headers.authorization) return mvWriteDenied();
          const body = await readBody(req);
          const rec = mkMovementRecord(body);
          if (!rec.movementId) return json(res, 400, err(400, 'movementId is required.', { movementId: { code: 'validation_required', message: 'Missing required value.' } }));
          upsertMovement(rec);
          return json(res, 200, rec);
        }
        return mvWriteDenied();
      }
      if (pathname.startsWith('/api/collections/movements/records/')) {
        const id = decodeURIComponent(pathname.slice('/api/collections/movements/records/'.length));
        const rec = currentMovements().find((m) => m.id === id || m.movementId === id);
        if (method === 'GET') {
          return rec ? json(res, 200, rec) : json(res, 404, err(404, "The requested resource wasn't found."));
        }
        if (!req.headers.authorization) return mvWriteDenied();
        if (method === 'PATCH') {
          if (!rec) return json(res, 404, err(404, "The requested resource wasn't found."));
          const body = await readBody(req);
          const next = { ...rec, ...pickMovementFields(body), updated: pbNow() };
          upsertMovement(next);
          return json(res, 200, next);
        }
        if (method === 'DELETE') {
          if (rec) {
            mvOverlay = mvOverlay.filter((m) => m.movementId !== rec.movementId);
            if (!mvDeleted.includes(rec.movementId)) mvDeleted.push(rec.movementId);
            persistMovements();
          }
          res.writeHead(204);
          res.end();
          return true;
        }
        return mvWriteDenied();
      }

      return false; // some other /api path — not mocked; caller falls through
    } catch (e) {
      json(res, 500, err(500, `mock /api: ${e.message}`));
      return true;
    }
  };
}

// --- shapes -----------------------------------------------------------------

/** `auth-methods` with the Google provider pointed at the local stub. */
function authMethods(url) {
  const state = rand(40);
  const stub = new URL('/api/_mock/oauth', url.origin);
  stub.searchParams.set('state', state);
  return {
    mfa: { enabled: false, duration: 0 },
    otp: { enabled: false, duration: 0 },
    password: { enabled: false, identityFields: [] },
    oauth2: {
      enabled: true,
      providers: [{
        name: 'google',
        displayName: 'Google',
        state,
        codeVerifier: rand(43),
        codeChallenge: rand(43),
        codeChallengeMethod: 'S256',
        // beginGoogleSignIn() does `new URL(authURL)` then appends redirect_uri
        // and full-page-navigates here; the stub above 302s straight back.
        authURL: stub.toString(),
      }],
    },
  };
}

/** One `registry/movements.json` entry as a `movements` collection record. */
function toMovementRecord(e) {
  const rec = {
    id: mvId(e.id),
    collectionId: 'mock_movements',
    collectionName: 'movements',
    movementId: e.id,
    title: e.title ?? '',
  };
  for (const k of M_JSON) rec[k] = k in e ? e[k] : null;
  for (const k of M_SCALAR) rec[k] = k in e ? e[k] : '';
  rec.scope = 'global';
  rec.user = '';
  rec.created = '';
  rec.updated = '';
  return rec;
}

/** A create body -> a full `movements` record (missing fields at their empty). */
function mkMovementRecord(body) {
  const now = pbNow();
  const rec = {
    id: mvId(body.movementId ?? ''),
    collectionId: 'mock_movements',
    collectionName: 'movements',
    movementId: body.movementId ?? '',
    title: body.title ?? '',
  };
  for (const k of M_JSON) rec[k] = k in body ? body[k] : null;
  for (const k of M_SCALAR) rec[k] = k in body ? body[k] : '';
  rec.scope = body.scope ?? 'global';
  rec.user = body.user ?? '';
  rec.created = now;
  rec.updated = now;
  return rec;
}

/** The subset of an update body that maps to `movements` columns. */
function pickMovementFields(body) {
  const out = {};
  for (const k of ['movementId', 'title', 'scope', 'user', ...M_JSON, ...M_SCALAR]) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

// --- query + envelope -----------------------------------------------------

function applyQuery(items, url) {
  let out = items.slice();
  const filter = url.searchParams.get('filter');
  if (filter) {
    for (const m of filter.matchAll(/([a-zA-Z_][\w.]*)\s*=\s*["']([^"']*)["']/g)) {
      const [, field, value] = m;
      out = out.filter((r) => String(r[field] ?? '') === value);
    }
  }
  const sort = url.searchParams.get('sort');
  if (sort) {
    for (const key of sort.split(',').map((s) => s.trim()).filter(Boolean).reverse()) {
      const desc = key.startsWith('-');
      const f = key.replace(/^[-+]/, '');
      out.sort((a, b) => cmp(a[f], b[f]) * (desc ? -1 : 1));
    }
  }
  return out;
}

function listEnvelope(items, url) {
  let perPage = Number(url.searchParams.get('perPage')) || 30;
  if (perPage < 1) perPage = 30;
  perPage = Math.min(perPage, 1000);
  let page = Number(url.searchParams.get('page')) || 1;
  if (page < 1) page = 1;
  const start = (page - 1) * perPage;
  return {
    page,
    perPage,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / perPage)),
    items: items.slice(start, start + perPage),
  };
}

// --- helpers --------------------------------------------------------------

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return {}; }
}

function json(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
  return true;
}

/** PocketBase's error body shape: `{ status, code, message, data }`. */
function err(code, message, data = {}) {
  return { status: code, code, message, data };
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/** `YYYY-MM-DD HH:MM:SS.mmmZ`, the format PocketBase autodates come back as. */
function pbNow() {
  return new Date().toISOString().replace('T', ' ');
}

/** A stable synthetic record id for a movement, derived from its registry id. */
function mvId(key) {
  let h = 5381;
  for (let i = 0; i < String(key).length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return 'mv' + h.toString(36).padStart(9, '0');
}

function mkId(prefix) {
  return `${prefix}_${rand(18)}`.slice(0, 24);
}

function mkToken() {
  return `mock_${rand(40)}`;
}

function rand(n) {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function cmp(a, b) {
  a = a ?? '';
  b = b ?? '';
  return a < b ? -1 : a > b ? 1 : 0;
}

// --- @id namespace + wdlId (task L3, DEC-021) ------------------------------
// A JS port of the same force-`@id` + set-`wdlId` logic `apps/shared/
// pocketbase.js` runs client-side, so a direct `curl` against the mock (or a
// future non-browser caller) is namespaced the same way a builder save is.
// `filter=wdlId="<handle>:<slug>"` needs no parser change — the generic
// `field="value"` matcher in `applyQuery` already handles the colon.

const mSlugify = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const mReadId = (src) => (String(src ?? '').match(/^@id[ \t]+(\S.*?)[ \t]*$/m) || [, ''])[1];
const mReadTitle = (src) => (String(src ?? '').match(/^#[ \t]+(\S.*?)[ \t]*$/m) || [, ''])[1];
const mSlugOfId = (v) => (v ? mSlugify(v.includes(':') ? v.slice(v.indexOf(':') + 1) : v) : '');
const mBaseSlug = (src) => mSlugOfId(mReadId(src)) || mSlugify(mReadTitle(src)) || 'untitled';

function mWriteId(source, id) {
  const lines = String(source ?? '').split('\n');
  const at = lines.findIndex((l) => /^@id(?:\s|$)/.test(l));
  if (at !== -1) { lines[at] = `@id ${id}`; return lines.join('\n'); }
  let ins = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if ((t === '' || t.startsWith('//')) && i === ins) { ins = i + 1; continue; }
    if (t.startsWith('#') || /^@[A-Za-z][\w-]*(?:\s|$)/.test(t)) { ins = i + 1; continue; }
    break;
  }
  const chunk = [`@id ${id}`];
  if (lines[ins] !== undefined && lines[ins].trim() !== '') chunk.push('');
  lines.splice(ins, 0, ...chunk);
  return lines.join('\n');
}

/**
 * Force `rec.source`'s `@id` and `rec.wdlId` to `<owner-handle>:<slug>`, with a
 * deterministic `-2` / `-3` … suffix on a same-owner clash. Mutates `rec`. A
 * no-op if the owner has no handle yet (`ensureHandle` has not run) or the row
 * carries no `source`.
 */
function forceWdlId(rec, allWorkouts, users) {
  const handle = users.find((u) => u.id === rec.owner)?.handle;
  if (!handle || typeof rec.source !== 'string') return;
  const base = mBaseSlug(rec.source);
  const taken = new Set(
    allWorkouts.filter((w) => w.owner === rec.owner && w.id !== rec.id && w.wdlId).map((w) => w.wdlId),
  );
  let slug = base;
  for (let n = 2; taken.has(`${handle}:${slug}`); n++) slug = `${base}-${n}`;
  rec.wdlId = `${handle}:${slug}`;
  rec.source = mWriteId(rec.source, rec.wdlId);
}
