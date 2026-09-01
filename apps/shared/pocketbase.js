/**
 * A hand-rolled PocketBase client — the ~8 calls the apps need, no SDK.
 *
 * **Why hand-rolled.** DEC-003 / DEC-008: the apps take no npm runtime
 * dependency and add no build step — the same rule that vendors `ohm-js` by
 * relative path rather than installing it. The official `pocketbase` JS SDK is
 * tens of KB of machinery (realtime, file fields, auto-cancellation, the admin
 * API, a batch builder) for what is, here, a handful of REST calls plus one
 * OAuth2 redirect. So this is plain `fetch` against the documented endpoints.
 *
 * **Which PocketBase.** Targeted at the live instance — **v0.40.1**
 * (`deploy/README.md`), served same-origin under `/api` (no CORS). Routes used:
 *
 *   GET    /api/collections/users/auth-methods       — the Google authURL + PKCE verifier
 *   POST   /api/collections/users/auth-with-oauth2   — exchange the `?code` for a token
 *   POST   /api/collections/users/auth-refresh       — revalidate a stored token
 *   GET    /api/collections/users/records            — handle-free lookup (best-effort; see `handleTaken`)
 *   PATCH  /api/collections/users/records/:id        — set the signed-in user's own `handle`
 *   GET    /api/collections/workouts/records         — list (filter by owner)
 *   GET    /api/collections/workouts/records/:id     — one record
 *   POST   /api/collections/workouts/records         — create
 *   PATCH  /api/collections/workouts/records/:id     — update
 *   DELETE /api/collections/workouts/records/:id     — delete
 *   GET    /api/collections/movements/records        — list / lookup by movementId (open)
 *   POST   /api/collections/movements/records        — create a global movement (admin)
 *   PATCH  /api/collections/movements/records/:id    — update a global movement (admin)
 *
 * The auth route names have changed across versions (pre-0.23 it was
 * `auth-via-oauth2`; the record CRUD path was `/api/collections/:c/records`
 * throughout 0.2x–0.40). If a PocketBase upgrade breaks sign-in, re-check
 * `GET /api/collections/users/auth-methods` and the admin UI's API preview,
 * and adjust the three constants below.
 *
 * **The OAuth2 flow is the redirect flow**, not the SDK's popup+realtime dance:
 *   1. GET auth-methods → `{ state, codeVerifier, authURL }` for Google.
 *   2. Stash `state` + `codeVerifier` (localStorage, survives the round trip),
 *      then full-page-navigate to `authURL` with our `redirect_uri` appended.
 *   3. Google bounces back to `AUTH_CALLBACK` with `?code=&state=`.
 *   4. That page calls `completeSignInFromRedirect()`: check `state`, POST the
 *      code + verifier + the *same* `redirectURL` to `auth-with-oauth2`, store
 *      `{ token, record }`.
 * The `redirect_uri` (`AUTH_CALLBACK`) must be registered in the Google Cloud
 * Console OAuth client as an authorised redirect URI — see `deploy/README.md`
 * §8. PocketBase itself does not need it configured; it only echoes it back in
 * the token exchange.
 */

import { validateHandle, randomHandle } from './handle.js';

const API = '/api';
const USERS = '/collections/users';
const USER_RECORDS = '/collections/users/records';
const RECORDS = '/collections/workouts/records';
const MOVEMENTS = '/collections/movements/records';

/** Retries before the random-handle assignment falls back to a numeric suffix. */
const HANDLE_ASSIGN_TRIES = 6;

/** Where Google returns the browser after sign-in. Must be a registered URI. */
export const AUTH_CALLBACK = `${location.origin}/apps/builder/auth-callback.html`;

const AUTH_KEY = 'wdl.pb-auth';     // { token, record } — the signed-in identity
const PENDING_KEY = 'wdl.pb-oauth'; // { state, codeVerifier, provider, returnTo }, mid-redirect only

let auth = readAuth();

function readAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
  catch { return null; }
}

function writeAuth(next) {
  auth = next;
  try {
    if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_KEY);
  } catch { /* private mode — the session just won't persist */ }
}

/** The signed-in `users` record, or `null`. Synchronous — reads the cached auth. */
export function currentUser() {
  return auth?.record ?? null;
}

/** The bare auth token, or `null`. */
export function authToken() {
  return auth?.token ?? null;
}

/**
 * The signed-in account's handle — the `@id` namespace prefix for the workouts
 * it owns (DEC-021) — or `null` when signed out or not yet assigned. `null` is
 * transient after a first sign-in: `ensureHandle()` fills it in.
 */
export function currentHandle() {
  return auth?.record?.handle || null;
}

/**
 * One `fetch` against `/api`. Adds the `Authorization` header when signed in
 * (unless `auth: false`), JSON-encodes a body, and turns a non-2xx into an
 * `Error` carrying `.status` and PocketBase's `.data` field errors.
 */
async function call(path, { method = 'GET', body, auth: useAuth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (useAuth && auth?.token) headers.Authorization = auth.token;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.fields = data?.data ?? {};
    throw err;
  }
  return data;
}

// --- auth ------------------------------------------------------------------

/**
 * Step 1–2 of the redirect flow: get Google's `authURL` + PKCE verifier, stash
 * what step 3 will need, and navigate away. `returnTo` is where the callback
 * page sends the browser once sign-in completes (defaults to the current URL,
 * hash and all).
 */
export async function beginGoogleSignIn(returnTo = location.href) {
  const methods = await call(`${USERS}/auth-methods`, { auth: false });
  const providers = methods.oauth2?.providers ?? methods.authProviders ?? [];
  const google = providers.find((p) => p.name === 'google');
  if (!google) throw new Error('Google sign-in is not enabled on the server');

  localStorage.setItem(PENDING_KEY, JSON.stringify({
    state: google.state,
    codeVerifier: google.codeVerifier,
    provider: 'google',
    returnTo,
  }));

  const url = new URL(google.authURL || google.authUrl);
  url.searchParams.set('redirect_uri', AUTH_CALLBACK);
  location.assign(url.toString());
}

/**
 * Step 3–4, run by `auth-callback.html`. Reads `?code`/`?state` off the current
 * URL, checks the state against what `beginGoogleSignIn` stashed, exchanges the
 * code for a token, and stores the identity. Returns `{ record, returnTo }`.
 * Throws (with a readable message) on a cancelled sign-in or a state mismatch.
 */
export async function completeSignInFromRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');

  const pendingRaw = localStorage.getItem(PENDING_KEY);
  localStorage.removeItem(PENDING_KEY);

  if (oauthError) throw new Error(`sign-in did not complete (${oauthError})`);
  if (!code || !pendingRaw) throw new Error('no sign-in is in progress');

  const pending = JSON.parse(pendingRaw);
  if (!returnedState || returnedState !== pending.state) {
    throw new Error('sign-in state did not match — please try again');
  }

  const result = await call(`${USERS}/auth-with-oauth2`, {
    method: 'POST',
    auth: false,
    body: {
      provider: pending.provider,
      code,
      codeVerifier: pending.codeVerifier,
      redirectURL: AUTH_CALLBACK,
    },
  });

  // Google's picture URL comes back on `meta`, not on the record (PocketBase
  // does not download it). Carry it on the stored record so the header can show
  // an avatar without another request.
  const record = {
    ...result.record,
    avatarUrl: result.meta?.avatarURL || result.meta?.avatarUrl || '',
  };
  writeAuth({ token: result.token, record });
  await ensureHandle();
  return { record: currentUser(), returnTo: pending.returnTo || '/apps/builder/' };
}

/**
 * Revalidate a stored token on startup. Refreshes the cached `{ token, record }`
 * on success; clears it on a 401/403 (the token is stale — the server is the
 * authority). Returns the current user or `null`. Never throws.
 */
export async function refreshAuth() {
  if (!auth?.token) return null;
  try {
    const result = await call(`${USERS}/auth-refresh`, { method: 'POST' });
    const record = { ...result.record, avatarUrl: auth?.record?.avatarUrl || '' };
    writeAuth({ token: result.token, record });
    await ensureHandle();
    return currentUser();
  } catch (e) {
    if (e.status === 401 || e.status === 403) writeAuth(null);
    return currentUser();
  }
}

/** Forget the signed-in identity. Local only — PocketBase tokens are stateless. */
export function signOut() {
  writeAuth(null);
}

// --- handle (DEC-021, L1) ----------------------------------------------------
//
// `users.handle` is the `@id` namespace prefix for every account's workouts.
// A handle-less account gets a random `adjective-noun` one so onboarding never
// blocks on it (`ensureHandle`, called after sign-in resolves); the user can
// change it later (`updateHandle`). The `users` collection's list/view rule is
// `id = @request.auth.id` (nobody may browse other accounts), so `handleTaken`
// below is a **best-effort** pre-check — it only ever confirms *your own*
// handle, never a foreign one — and the unique index's 400 on `PATCH` is the
// real, server-authoritative reject in both `ensureHandle` and `updateHandle`.
// The mock `/api` (`scripts/mock-api.mjs`) has no such rule restriction and
// answers `filter=handle="…"` for any row, so the pre-check is fully accurate
// there.

/**
 * Best-effort: is `h` already held by some *other* account? Never throws —
 * an inconclusive check (blocked by the list rule, or a network error) reads
 * as "not visibly taken", leaving the `PATCH` 400 as the real guard.
 */
async function handleTaken(h) {
  try {
    const q = new URLSearchParams({ filter: `handle="${h}"`, perPage: '1' });
    const data = await call(`${USER_RECORDS}?${q}`, { auth: !!authToken() });
    const hit = data.items?.[0];
    return !!hit && hit.id !== currentUser()?.id;
  } catch {
    return false;
  }
}

/** `true` iff a PocketBase field error names `handle` as not-unique. */
function isHandleUniqueError(e) {
  return e?.status === 400 && e.fields?.handle?.code === 'validation_not_unique';
}

/**
 * Assign a random `adjective-noun` handle to the signed-in user if they don't
 * already have one. Called after every sign-in/refresh resolves — onboarding
 * must never block on a handle, so this never throws; a failure just leaves
 * `currentHandle()` `null` for this session and the next refresh tries again.
 */
export async function ensureHandle() {
  const user = currentUser();
  if (!user || user.handle) return;
  try {
    for (let i = 0; i < HANDLE_ASSIGN_TRIES; i++) {
      const candidate = randomHandle();
      if (await handleTaken(candidate)) continue;
      try {
        const rec = await call(`${USER_RECORDS}/${encodeURIComponent(user.id)}`, {
          method: 'PATCH',
          body: { handle: candidate },
        });
        writeAuth({ token: auth.token, record: { ...auth.record, handle: rec.handle } });
        return;
      } catch (e) {
        if (!isHandleUniqueError(e)) throw e;
        // collided with another account between the check and the write — retry
      }
    }
    // Every plain pair was taken (very unlikely — ~14k pairs) — disambiguate
    // with a short numeric suffix rather than leave the account handle-less.
    const candidate = `${randomHandle()}-${Math.floor(Math.random() * 90 + 10)}`;
    const rec = await call(`${USER_RECORDS}/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: { handle: candidate },
    });
    writeAuth({ token: auth.token, record: { ...auth.record, handle: rec.handle } });
  } catch (e) {
    console.warn('could not assign a handle:', e.message);
  }
}

/**
 * Change the signed-in user's handle. Validates client-side first (shape,
 * reserved words), pre-checks freeness (best-effort — see the section note),
 * then `PATCH`es; a unique-index 400 from the server is the authoritative
 * "taken" answer regardless of what the pre-check said. Throws a plain `Error`
 * with a message fit to show the user; updates local state and returns the
 * new handle on success.
 */
export async function updateHandle(h) {
  const user = currentUser();
  if (!user) throw new Error('not signed in');
  const candidate = (h ?? '').trim().toLowerCase();
  const { ok, error } = validateHandle(candidate);
  if (!ok) throw new Error(error);
  if (candidate === user.handle) return candidate;
  if (await handleTaken(candidate)) throw new Error('That handle is already taken.');
  try {
    const rec = await call(`${USER_RECORDS}/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: { handle: candidate },
    });
    writeAuth({ token: auth.token, record: { ...auth.record, handle: rec.handle } });
    return rec.handle;
  } catch (e) {
    if (isHandleUniqueError(e)) throw new Error('That handle is already taken.');
    throw e;
  }
}

// --- @id namespace + wdlId (DEC-021, L3) -----------------------------------
//
// Every create/update of a workout by a signed-in user force-writes the `@id`
// directive line in `source` to `<owner-handle>:<slug>` and sends `wdlId` set
// to the identical string, so the column and the text never disagree and there
// is no un-namespaced saved workout (DEC-021 — "it always writes back,
// silently, every time"). `<slug>` is the slug of an existing `@id` in the text
// if there is one, else a slug of the `# title` line, else `untitled`; a clash
// with another of the *same owner's* workouts gets a deterministic,
// re-save-stable `-2` / `-3` … suffix. `@id`'s value is uninterpreted by the
// grammar (spec §2), so a light regex on the preamble line is all this needs —
// no `packages/core` dependency is pulled into this shared module.

/** lower-case; non-alnum runs collapse to one `-`; ends trimmed (cf. `handle.js`). */
function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The value on the zero-indent `@id` preamble line of `source`, or `''`. */
function readIdValue(source) {
  const m = String(source ?? '').match(/^@id[ \t]+(\S.*?)[ \t]*$/m);
  return m ? m[1] : '';
}

/** The zero-indent `# title` line of `source`, or `''`. */
function readTitleLine(source) {
  const m = String(source ?? '').match(/^#[ \t]+(\S.*?)[ \t]*$/m);
  return m ? m[1] : '';
}

/** The slug portion of an `@id` value — after the first `:`, else the whole. */
function slugOfIdValue(v) {
  if (!v) return '';
  const tail = v.includes(':') ? v.slice(v.indexOf(':') + 1) : v;
  return slugify(tail);
}

/** The un-suffixed slug for a workout: `@id` slug, else `# title` slug, else `untitled`. */
function baseSlug(source) {
  return slugOfIdValue(readIdValue(source)) || slugify(readTitleLine(source)) || 'untitled';
}

/**
 * Write (or rewrite) the zero-indent `@id` line of `source` to `id`. Overwrites
 * in place when an `@id` line exists; otherwise inserts it into the preamble —
 * after a leading `# title` / `@`-directive run — with a blank line before the
 * body so the at-rest text still reads on a whiteboard.
 */
function writeIdLine(source, id) {
  const lines = String(source ?? '').split('\n');
  const at = lines.findIndex((l) => /^@id(?:\s|$)/.test(l));
  if (at !== -1) {
    lines[at] = `@id ${id}`;
    return lines.join('\n');
  }
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

/** This account's handle, assigning a random one first if needed (post-L1: a no-op). */
async function requireHandle() {
  let h = currentHandle();
  if (!h) { await ensureHandle(); h = currentHandle(); }
  if (!h) throw new Error('no account handle — cannot namespace this workout');
  return h;
}

/**
 * `<handle>:<base>` unless another of this owner's workouts already holds it,
 * in which case `-2`, `-3`, … until free. Stable across re-saves: the scan
 * skips only *other* records, and `base` is re-derived from the stored `@id`,
 * so a record already carrying `-2` keeps it.
 */
async function namespacedId(handle, base, excludeId) {
  let taken = new Set();
  try {
    const mine = await listMine();
    taken = new Set(mine.filter((w) => w.id !== excludeId && w.wdlId).map((w) => w.wdlId));
  } catch { /* not signed in / offline — no siblings to clash with */ }
  let slug = base;
  for (let n = 2; taken.has(`${handle}:${slug}`); n++) slug = `${base}-${n}`;
  return `${handle}:${slug}`;
}

/**
 * Force `source`'s `@id` to `<owner-handle>:<slug>`; returns `{ source, wdlId }`
 * to send. `excludeId` is the record being updated (so it can't clash with
 * itself) — omit it for a create.
 */
async function forceNamespace(source, excludeId) {
  const handle = await requireHandle();
  const wdlId = await namespacedId(handle, baseSlug(source), excludeId);
  return { source: writeIdLine(source, wdlId), wdlId };
}

// --- workouts ------------------------------------------------------------------

/** The signed-in user's workouts, newest edit first. */
export async function listMine() {
  const uid = currentUser()?.id;
  if (!uid) throw new Error('not signed in');
  const q = new URLSearchParams({
    filter: `owner="${uid}"`,
    sort: '-updated',
    perPage: '200',
  });
  const data = await call(`${RECORDS}?${q}`);
  return data.items ?? [];
}

/**
 * One workout by id. Sends the auth header only when signed in — an anonymous
 * board reading a shared link relies on the collection's list/view rule
 * (`visibility != "private"`), and a `private` record then 404s, which the
 * caller renders as "not found" rather than a crash.
 */
export function getById(id) {
  return call(`${RECORDS}/${encodeURIComponent(id)}`, { auth: !!authToken() });
}

/**
 * Resolve *either* a 15-char PocketBase record id *or* a `<handle>:<slug>`
 * `wdlId` to one record (DEC-021). The colon is the discriminator — a `wdlId`
 * always carries one, a record id never does. A value with a `:` goes straight
 * to `filter=wdlId="…"`; a plain value is fetched by record id, then retried as
 * a `wdlId` on a 404. Not-found surfaces the same `Error` + `.status` shape as
 * `getById`, so the board's existing `catch` is unchanged.
 */
export async function getByAnyId(x) {
  const key = String(x ?? '');
  const byWdlId = async () => {
    const q = new URLSearchParams({ filter: `wdlId="${key}"`, perPage: '1' });
    const data = await call(`${RECORDS}?${q}`, { auth: !!authToken() });
    return data.items?.[0] ?? null;
  };
  if (key.includes(':')) {
    const hit = await byWdlId();
    if (hit) return hit;
    const e = new Error("The requested resource wasn't found.");
    e.status = 404;
    throw e;
  }
  try {
    return await getById(key);
  } catch (e) {
    if (e.status === 404) {
      const hit = await byWdlId();
      if (hit) return hit;
    }
    throw e;
  }
}

/**
 * Create a workout. Always `private` on create (per the collection's contract).
 * Forces `@id` / `wdlId` to `<owner-handle>:<slug>` first (DEC-021, L3).
 */
export async function create({ title = '', source, visibility = 'private' }) {
  const uid = currentUser()?.id;
  if (!uid) throw new Error('not signed in');
  const ns = await forceNamespace(source);
  return call(RECORDS, {
    method: 'POST',
    body: { owner: uid, title, source: ns.source, wdlId: ns.wdlId, visibility },
  });
}

/**
 * Patch a workout — pass only the fields that change (`source`, `title`,
 * `visibility`). When `source` is in the patch it is re-namespaced and `wdlId`
 * is set alongside it (DEC-021, L3); a patch without `source` leaves `wdlId`
 * untouched.
 */
export async function update(id, patch) {
  let body = patch;
  if (patch && typeof patch.source === 'string') {
    const ns = await forceNamespace(patch.source, id);
    body = { ...patch, source: ns.source, wdlId: ns.wdlId };
  }
  return call(`${RECORDS}/${encodeURIComponent(id)}`, { method: 'PATCH', body });
}

/** Delete a workout. */
export function remove(id) {
  return call(`${RECORDS}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** The stable share URL for a workout id — a real file path, so no rewrite. */
export function shareUrl(id) {
  return `${location.origin}/apps/display/?w=${encodeURIComponent(id)}`;
}

// --- movements (curated layer, DEC-020) --------------------------------------
// The `movements` collection: list/view are open (`scope = "global"`), writes
// are admin-only (`@request.auth.admin = true`). The M5 movement editor writes
// through these; `scripts/movements-to-db.mjs` (M3) does the bulk ingest over
// the same routes. All Phase-1 rows are `scope: "global"`.

/** Every global movement, in `movementId` order. Reads need no auth. */
export async function listMovements() {
  const q = new URLSearchParams({ filter: 'scope="global"', sort: 'movementId', perPage: '1000' });
  const data = await call(`${MOVEMENTS}?${q}`, { auth: !!authToken() });
  return data.items ?? [];
}

/** One global movement by its registry id (`movementId`), or `null` if absent. */
export async function getMovementByMovementId(movementId) {
  const q = new URLSearchParams({ filter: `movementId="${movementId}"`, perPage: '1' });
  const data = await call(`${MOVEMENTS}?${q}`, { auth: !!authToken() });
  return data.items?.[0] ?? null;
}

/**
 * Create a global movement. Always `scope: "global"` (Phase 1). The server
 * enforces admin — a signed-out or non-admin caller gets a 403 whose message
 * the caller surfaces.
 */
export function createMovement(fields) {
  return call(MOVEMENTS, { method: 'POST', body: { ...fields, scope: 'global' } });
}

/** Patch a movement by its PocketBase record id. Admin-only, server-enforced. */
export function updateMovement(id, patch) {
  return call(`${MOVEMENTS}/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
}
