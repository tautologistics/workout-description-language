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
 *   GET    /api/collections/equipment/records        — list, from registry/equipment.json + local writes, in the PB record shape (task V7, DEC-025)
 *   GET    /api/collections/equipment/records/:id    — one term (by synthetic id or termId)
 *   POST   /api/collections/equipment/records        — create, same Authorization gate as movements (else 403)
 *   PATCH  /api/collections/equipment/records/:id    — update, same Authorization gate; 403 without it
 *   DELETE /api/collections/equipment/records/:id    — delete, same Authorization gate; 403 without it, 204 with
 *   GET    /api/collections/patterns/records         — list, from registry/patterns.json + local writes (same shape as equipment)
 *   GET    /api/collections/patterns/records/:id     — one term (by synthetic id or termId)
 *   POST   /api/collections/patterns/records         — create, same Authorization gate
 *   PATCH  /api/collections/patterns/records/:id     — update, same Authorization gate
 *   DELETE /api/collections/patterns/records/:id     — delete, same Authorization gate; 204 with
 *   GET    /api/collections/movement_sets/records     — list, from fixtures/movement-sets.json + local writes; read-gated (owner or non-private) (task S3, DEC-027)
 *   GET    /api/collections/movement_sets/records/:id — one set (by synthetic id or setId); 404 if the read gate fails
 *   POST   /api/collections/movement_sets/records     — create, needs an Authorization header (else 403); 400 validation_not_unique on a duplicate setId
 *   PATCH  /api/collections/movement_sets/records/:id — update, owner-only (403 otherwise); 400 validation_not_unique if it changes setId onto an existing one
 *   DELETE /api/collections/movement_sets/records/:id — delete, owner-only; 403 without an Authorization header, 204 with
 *   GET    /api/collections/goals/records            — list, `global` seed derived from examples/goals/*.wdlg + local writes; read-gated (scope="global" or user==caller) (task G3, DEC-028)
 *   GET    /api/collections/goals/records/:id        — one ruleset (by synthetic id or goalId); 404 if the read gate fails
 *   POST   /api/collections/goals/records            — create, needs an Authorization header (else 403); `user` rows owner-only, `global` rows admin-only; 400 validation_not_unique on a duplicate goalId
 *   PATCH  /api/collections/goals/records/:id        — update, owner/admin-only (403 otherwise); 400 validation_not_unique if a rename moves goalId onto an existing one
 *   DELETE /api/collections/goals/records/:id        — delete, owner/admin-only; 403 without an Authorization header, 204 with
 *
 * Query params honoured on the list routes, only as far as the client uses
 * them: `filter` (a pattern-matcher for the exact strings the client emits —
 * `field="value"` / `field!="value"` / `field~"value"` comparisons joined by
 * `&&`, plus the one parenthesised `(A || B) && (C || D)` shape `searchWorkouts`
 * sends, L4, and the `visibility!="private"` shape `listPublicSets` sends, S3;
 * see `matchesFilter` below), `sort` (`-updated` etc.), `page`, `perPage`. Not a
 * query engine.
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
 * `fixtures/users.local.json`, `fixtures/equipment.local.json`,
 * `fixtures/patterns.local.json`, `fixtures/movement-sets.local.json`,
 * `fixtures/goals.local.json`) is
 * git-ignored — delete it to reset to the committed seed / `registry/*.json`. Movement writes (task M3's
 * `make movements:load`, and the M5 editor) land in
 * `fixtures/movements.local.json` and are merged over the registry-derived list
 * on read, keyed by `movementId`. Equipment and pattern vocabulary (task V7)
 * works the same way: `registry/{equipment,patterns}.json` is the seed, runtime
 * writes overlay from `fixtures/{equipment,patterns}.local.json`, keyed by
 * `termId`. No `fixtures/{equipment,patterns}.json` is committed — the seed is
 * always the registry file, mirroring movements.
 *
 * **Movement sets (task S3, DEC-027).** `fixtures/movement-sets.json` IS
 * committed (there is no registry source to derive from) and holds a small seed:
 * a couple of `user`-scoped sets owned by `u_mock_chris_0001` and one
 * `org-library` set owned by `crossfit` at `visibility: "public"`. Runtime
 * writes overlay from `fixtures/movement-sets.local.json` (`records` + `deleted`
 * tombstones, keyed by the record `id`), merged over the seed on read. Reads are
 * gated by the collection's list/view rule (`owner = @request.auth.id ||
 * visibility != "private"`); writes need an `Authorization` header and are
 * owner-only, standing in for the `@request.auth.id = owner` rule. The unique
 * `setId` index is enforced — a create or a rename onto an existing `setId` is a
 * 400 `validation_not_unique`, the way the `users` handler rejects a duplicate
 * `handle`. **Handle wrinkle:** `u_mock_chris_0001` has no handle at rest (see
 * below), so a committed chris-owned seed row cannot bake a correct
 * `<handle>:<slug>` `setId`. The seed carries a `chris:` placeholder prefix and
 * `withOwnerHandle` rewrites the prefix to the owner's *current* handle on read
 * (the `forceWdlId` philosophy — keep the namespaced key in step with the
 * handle — applied on read, since a set's key is required + unique and cannot be
 * absent from the seed the way a pre-L3 workout's `wdlId` is). This keeps the
 * L1/DEC-021 random-handle assignment path fully exercised rather than pinning
 * chris to a fixed handle.
 *
 * **Goals (task G3, DEC-028).** The `goals` collection follows the **vocab
 * scope model** (DEC-025), not the `workouts` / `movement_sets` pattern: a
 * `scope` column (`global | user`) and a nullable `user` relation. The `global`
 * rows are **derived from `examples/goals/*.wdlg` at boot** — the committed
 * files are the source of truth (DEC-028), exactly as `equipment` / `patterns`
 * derive from `registry/*.json`, so there is **no committed `fixtures/goals.json`**.
 * Runtime writes overlay from git-ignored `fixtures/goals.local.json` (`records`
 * + `deleted` tombstones, keyed by the record `id` so a `user` row's `goalId`
 * can re-slug on rename). Reads are gated by the collection's list/view rule
 * (`scope = "global" || user = @request.auth.id`); writes need an `Authorization`
 * header — a `user` row is owner-only and a `global` row admin-only (every faked
 * sign-in is `admin: true`, so `make goals:load` round-trips locally). The
 * unique `goalId` index is enforced — a create or a rename onto an existing
 * `goalId` is a 400 `validation_not_unique`.
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
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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

  // -- vocabularies: equipment + patterns (task V7, DEC-025) --------------
  // Two independent vocabularies of one shape — the mock mirror of the
  // migration's `vocabCollection(name)` helper. Each is seeded from
  // `registry/<name>.json` (never a committed `fixtures/<name>.json` — the
  // registry file is the seed, exactly as movements has no fixture seed) and
  // overlaid with runtime writes from git-ignored `fixtures/<name>.local.json`,
  // keyed by `termId`. Reads are open; writes need an Authorization header,
  // standing in for the collection's `@request.auth.admin = true` rule the same
  // way the movements handler does.
  const makeVocab = (name, prefix) => {
    let seed = null;
    const loadSeed = () => {
      if (!seed) seed = (readJson(P(`registry/${name}.json`))[name] ?? []).map((e) => toVocabRecord(e, name, prefix));
      return seed;
    };
    const localPath = P(`fixtures/${name}.local.json`);
    const local = existsSync(localPath) ? readJson(localPath) : {};
    let overlay = Array.isArray(local.records) ? local.records : [];
    let deleted = Array.isArray(local.deleted) ? local.deleted : [];
    const persist = () => {
      try {
        writeFileSync(localPath, JSON.stringify({
          $comment: `Runtime write state for the local dev mock /api (${name} vocabulary). Git-ignored. Delete to reset to registry/${name}.json.`,
          records: overlay,
          deleted,
        }, null, 2) + '\n');
      } catch (e) {
        console.error(`  mock /api: could not persist ${name} — ${e.message}`);
      }
    };
    return {
      name,
      prefix,
      /** The registry seed with runtime writes merged over it, keyed by termId. */
      current() {
        const byId = new Map(loadSeed().map((r) => [r.termId, r]));
        for (const rec of overlay) byId.set(rec.termId, rec);
        for (const id of deleted) byId.delete(id);
        return [...byId.values()];
      },
      upsert(rec) {
        const i = overlay.findIndex((r) => r.termId === rec.termId);
        if (i >= 0) overlay[i] = rec; else overlay.push(rec);
        deleted = deleted.filter((id) => id !== rec.termId);
        persist();
      },
      remove(rec) {
        overlay = overlay.filter((r) => r.termId !== rec.termId);
        if (!deleted.includes(rec.termId)) deleted.push(rec.termId);
        persist();
      },
    };
  };
  const vocabs = [makeVocab('equipment', 'eq'), makeVocab('patterns', 'pt')];

  // -- movement sets (task S3, DEC-027) ----------------------------------
  // Same collection pattern as `workouts` (not the vocab pattern): owner-scoped,
  // `visibility` list/view rule, a namespaced natural key (`setId` =
  // `<owner-handle>:<slug(name)>`, unique). Committed seed at
  // `fixtures/movement-sets.json`, runtime writes overlaid from git-ignored
  // `fixtures/movement-sets.local.json` (`records` + `deleted` tombstones, keyed
  // by record `id`). A parallel handler in the workouts mould, not a `makeVocab`
  // instance — sets have an owner, a read gate, a uniqueness rejection and the
  // handle-prefix rewrite, none of which the vocab factory carries.
  const setsSeedPath = P('fixtures/movement-sets.json');
  const setsLocalPath = P('fixtures/movement-sets.local.json');
  const setsLocal = existsSync(setsLocalPath) ? readJson(setsLocalPath) : {};
  let setsOverlay = Array.isArray(setsLocal.records) ? setsLocal.records : [];
  let setsDeleted = Array.isArray(setsLocal.deleted) ? setsLocal.deleted : [];
  let setsSeed = null;
  const loadSetsSeed = () => {
    if (!setsSeed) setsSeed = (readJson(setsSeedPath).movement_sets ?? []).map(toSetRecord);
    return setsSeed;
  };

  const persistSets = () => {
    try {
      writeFileSync(setsLocalPath, JSON.stringify({
        $comment: 'Runtime write state for the local dev mock /api (movement_sets). Git-ignored. Delete to reset to fixtures/movement-sets.json.',
        records: setsOverlay,
        deleted: setsDeleted,
      }, null, 2) + '\n');
    } catch (e) {
      console.error(`  mock /api: could not persist movement sets — ${e.message}`);
    }
  };

  // Keep a row's `setId` handle-prefix in step with the owner's current handle —
  // the `forceWdlId` philosophy applied on read. A chris-owned seed row carries
  // a `chris:` placeholder because `u_mock_chris_0001` has no handle at rest
  // (users.json, L1) and the real handle is assigned randomly on first sign-in.
  const withOwnerHandle = (rec) => {
    if (!rec.setId || !rec.setId.includes(':')) return rec;
    const handle = users.find((u) => u.id === rec.owner)?.handle;
    if (!handle) return rec;
    const fixed = `${handle}:${rec.setId.slice(rec.setId.indexOf(':') + 1)}`;
    return fixed === rec.setId ? rec : { ...rec, setId: fixed };
  };

  /** The seed with runtime writes merged over it, keyed by record id. */
  const currentSets = () => {
    const byId = new Map(loadSetsSeed().map((s) => [s.id, s]));
    for (const rec of setsOverlay) byId.set(rec.id, rec);
    for (const id of setsDeleted) byId.delete(id);
    return [...byId.values()].map(withOwnerHandle);
  };

  const upsertSet = (rec) => {
    const i = setsOverlay.findIndex((s) => s.id === rec.id);
    if (i >= 0) setsOverlay[i] = rec; else setsOverlay.push(rec);
    setsDeleted = setsDeleted.filter((id) => id !== rec.id);
    persistSets();
  };

  /** `true` iff some other set already holds `setId` (the unique-index check). */
  const setIdTaken = (setId, exceptId) =>
    currentSets().some((s) => s.id !== exceptId && s.setId === setId);

  // -- goals (task G3, DEC-028) -----------------------------------------
  // The saved goal rulesets of the builder's Analysis-tab Goals block, promoted
  // out of `localStorage['wdl.goals']`. This follows the **vocab scope model**
  // (DEC-025), not the `workouts` / `movement_sets` pattern: a real `scope`
  // column (`global | user`) and a nullable `user` relation. The `global` rows
  // are **derived from `examples/goals/*.wdlg` at boot** — the committed files
  // are the source of truth (DEC-028), exactly as the vocab collections derive
  // from `registry/{equipment,patterns}.json`, so there is no committed
  // `fixtures/goals.json`. Runtime writes overlay from git-ignored
  // `fixtures/goals.local.json` (`records` + `deleted` tombstones, keyed by the
  // record `id` so a `user` row's `goalId` can re-slug on rename), merged over
  // the derived seed on read. Reads honour `scope = "global" || user =
  // @request.auth.id`; writes need an Authorization header — a `user` row is
  // owner-only, and a `global` row needs admin (the faked sign-in hands every
  // caller `admin: true`). The unique `goalId` index is enforced as a 400
  // `validation_not_unique`, the way the sets / users handlers reject a
  // duplicate key.
  const goalsLocalPath = P('fixtures/goals.local.json');
  const goalsLocal = existsSync(goalsLocalPath) ? readJson(goalsLocalPath) : {};
  let goalsOverlay = Array.isArray(goalsLocal.records) ? goalsLocal.records : [];
  let goalsDeleted = Array.isArray(goalsLocal.deleted) ? goalsLocal.deleted : [];
  let goalsSeed = null;
  const loadGoalsSeed = () => {
    if (!goalsSeed) {
      const dir = P('examples/goals');
      goalsSeed = existsSync(dir)
        ? readdirSync(dir)
            .filter((n) => n.endsWith('.wdlg'))
            .sort()
            .map((name) => toGoalRecord(name, readFileSync(join(dir, name), 'utf8')))
        : [];
    }
    return goalsSeed;
  };

  const persistGoals = () => {
    try {
      writeFileSync(goalsLocalPath, JSON.stringify({
        $comment: 'Runtime write state for the local dev mock /api (goals). Git-ignored. Delete to reset to the examples/goals/*.wdlg-derived global seed.',
        records: goalsOverlay,
        deleted: goalsDeleted,
      }, null, 2) + '\n');
    } catch (e) {
      console.error(`  mock /api: could not persist goals — ${e.message}`);
    }
  };

  /** The derived `global` seed with runtime writes merged over it, keyed by record id. */
  const currentGoals = () => {
    const byId = new Map(loadGoalsSeed().map((g) => [g.id, g]));
    for (const rec of goalsOverlay) byId.set(rec.id, rec);
    for (const id of goalsDeleted) byId.delete(id);
    return [...byId.values()];
  };

  const upsertGoal = (rec) => {
    const i = goalsOverlay.findIndex((g) => g.id === rec.id);
    if (i >= 0) goalsOverlay[i] = rec; else goalsOverlay.push(rec);
    goalsDeleted = goalsDeleted.filter((id) => id !== rec.id);
    persistGoals();
  };

  /** `true` iff some other row already holds `goalId` (the unique-index check). */
  const goalIdTaken = (goalId, exceptId) =>
    currentGoals().some((g) => g.id !== exceptId && g.goalId === goalId);

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

      // -- vocabularies: equipment + patterns (task V7, DEC-025) ---------
      // Reads open (list/view rule `scope = "global"`); writes need an
      // Authorization header, standing in for `@request.auth.admin = true` —
      // the same gate the movements routes above use.
      for (const v of vocabs) {
        const base = `/api/collections/${v.name}/records`;
        const vWriteDenied = () => json(res, 403, err(403, `Only admins can write the global ${v.name} vocabulary.`));
        if (pathname === base) {
          if (method === 'GET') return json(res, 200, listEnvelope(applyQuery(v.current(), url), url));
          if (method === 'POST') {
            if (!req.headers.authorization) return vWriteDenied();
            const body = await readBody(req);
            const rec = mkVocabRecord(body, v.name, v.prefix);
            if (!rec.termId) return json(res, 400, err(400, 'termId is required.', { termId: { code: 'validation_required', message: 'Missing required value.' } }));
            v.upsert(rec);
            return json(res, 200, rec);
          }
          return vWriteDenied();
        }
        if (pathname.startsWith(base + '/')) {
          const id = decodeURIComponent(pathname.slice((base + '/').length));
          const rec = v.current().find((r) => r.id === id || r.termId === id);
          if (method === 'GET') {
            return rec ? json(res, 200, rec) : json(res, 404, err(404, "The requested resource wasn't found."));
          }
          if (!req.headers.authorization) return vWriteDenied();
          if (method === 'PATCH') {
            if (!rec) return json(res, 404, err(404, "The requested resource wasn't found."));
            const body = await readBody(req);
            const next = { ...rec, ...pickVocabFields(body), updated: pbNow() };
            v.upsert(next);
            return json(res, 200, next);
          }
          if (method === 'DELETE') {
            if (rec) v.remove(rec);
            res.writeHead(204);
            res.end();
            return true;
          }
          return vWriteDenied();
        }
      }

      // -- movement sets (task S3, DEC-027) -----------------------------
      // The `workouts` twin: owner-scoped, `visibility` list rule. Reads honour
      // `owner = @request.auth.id || visibility != "private"`; writes need an
      // Authorization header and are owner-only (the mock signs everyone in as
      // the one fixture user, so "wrong owner" means the org-library rows).
      // Overlay -> fixtures/movement-sets.local.json.
      {
        const caller = req.headers.authorization ? fixtureUser.id : null;
        const canReadSet = (r) => r.visibility !== 'private' || r.owner === caller;
        const setWriteDenied = () => json(res, 403, err(403, 'Only the set owner may write it.'));
        const base = '/api/collections/movement_sets/records';
        if (pathname === base) {
          if (method === 'GET') {
            const rows = applyQuery(currentSets(), url).filter(canReadSet);
            return json(res, 200, listEnvelope(rows, url));
          }
          if (method === 'POST') {
            if (!caller) return setWriteDenied();
            const body = await readBody(req);
            const rec = mkSetRecord(body);
            if (!rec.setId) return json(res, 400, err(400, 'Failed to create record.', { setId: { code: 'validation_required', message: 'Missing required value.' } }));
            if (setIdTaken(rec.setId)) return json(res, 400, err(400, 'Failed to create record.', { setId: { code: 'validation_not_unique', message: 'Value must be unique.' } }));
            upsertSet(rec);
            return json(res, 200, rec);
          }
          return setWriteDenied();
        }
        if (pathname.startsWith(base + '/')) {
          const key = decodeURIComponent(pathname.slice((base + '/').length));
          const rec = currentSets().find((s) => s.id === key || s.setId === key);
          if (method === 'GET') {
            return rec && canReadSet(rec) ? json(res, 200, rec) : json(res, 404, err(404, "The requested resource wasn't found."));
          }
          if (!caller) return setWriteDenied();
          if (method === 'PATCH') {
            if (!rec) return json(res, 404, err(404, "The requested resource wasn't found."));
            if (rec.owner !== caller) return setWriteDenied();
            const body = await readBody(req);
            const patch = pickSetFields(body);
            if ('setId' in patch && patch.setId !== rec.setId && setIdTaken(patch.setId, rec.id)) {
              return json(res, 400, err(400, 'Failed to update record.', { setId: { code: 'validation_not_unique', message: 'Value must be unique.' } }));
            }
            const next = { ...rec, ...patch, updated: pbNow() };
            upsertSet(next);
            return json(res, 200, next);
          }
          if (method === 'DELETE') {
            if (rec) {
              if (rec.owner !== caller) return setWriteDenied();
              setsOverlay = setsOverlay.filter((s) => s.id !== rec.id);
              if (!setsDeleted.includes(rec.id)) setsDeleted.push(rec.id);
              persistSets();
            }
            res.writeHead(204);
            res.end();
            return true;
          }
          return setWriteDenied();
        }
      }

      // -- goals (task G3, DEC-028) ------------------------------------
      // The vocab scope model: a `scope` column + nullable `user` relation.
      // Reads honour `scope = "global" || user = @request.auth.id`; writes need
      // an Authorization header — `user` rows owner-only, `global` rows
      // admin-only (every faked sign-in is `admin: true`). Overlay ->
      // fixtures/goals.local.json. The `global` seed is derived from
      // examples/goals/*.wdlg at boot — no committed fixture.
      {
        const caller = req.headers.authorization ? fixtureUser.id : null;
        const isAdmin = caller ? !!fixtureUser.admin : false;
        const canReadGoal = (g) => g.scope === 'global' || (g.user && g.user === caller);
        const mayWriteGoal = (g) => g.scope === 'user' ? g.user === caller : isAdmin;
        const goalWriteDenied = () => json(res, 403, err(403, 'Only the ruleset owner (or an admin, for a global ruleset) may write it.'));
        const base = '/api/collections/goals/records';
        if (pathname === base) {
          if (method === 'GET') {
            const rows = applyQuery(currentGoals(), url).filter(canReadGoal);
            return json(res, 200, listEnvelope(rows, url));
          }
          if (method === 'POST') {
            if (!caller) return goalWriteDenied();
            const body = await readBody(req);
            const rec = mkGoalRecord(body);
            if (!rec.goalId) return json(res, 400, err(400, 'Failed to create record.', { goalId: { code: 'validation_required', message: 'Missing required value.' } }));
            if (!mayWriteGoal(rec)) return goalWriteDenied();
            if (goalIdTaken(rec.goalId)) return json(res, 400, err(400, 'Failed to create record.', { goalId: { code: 'validation_not_unique', message: 'Value must be unique.' } }));
            upsertGoal(rec);
            return json(res, 200, rec);
          }
          return goalWriteDenied();
        }
        if (pathname.startsWith(base + '/')) {
          const key = decodeURIComponent(pathname.slice((base + '/').length));
          const rec = currentGoals().find((g) => g.id === key || g.goalId === key);
          if (method === 'GET') {
            return rec && canReadGoal(rec) ? json(res, 200, rec) : json(res, 404, err(404, "The requested resource wasn't found."));
          }
          if (!caller) return goalWriteDenied();
          if (method === 'PATCH') {
            if (!rec) return json(res, 404, err(404, "The requested resource wasn't found."));
            if (!mayWriteGoal(rec)) return goalWriteDenied();
            const body = await readBody(req);
            const patch = pickGoalFields(body);
            if ('goalId' in patch && patch.goalId !== rec.goalId && goalIdTaken(patch.goalId, rec.id)) {
              return json(res, 400, err(400, 'Failed to update record.', { goalId: { code: 'validation_not_unique', message: 'Value must be unique.' } }));
            }
            const next = { ...rec, ...patch, updated: pbNow() };
            upsertGoal(next);
            return json(res, 200, next);
          }
          if (method === 'DELETE') {
            if (rec) {
              if (!mayWriteGoal(rec)) return goalWriteDenied();
              goalsOverlay = goalsOverlay.filter((g) => g.id !== rec.id);
              if (!goalsDeleted.includes(rec.id)) goalsDeleted.push(rec.id);
              persistGoals();
            }
            res.writeHead(204);
            res.end();
            return true;
          }
          return goalWriteDenied();
        }
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

// --- vocabulary shapes (equipment + patterns, task V7, DEC-025) ----------
// The migration's `equipment` / `patterns` columns: termId (the registry id —
// not `id`, which is PocketBase's own), name, synonyms (json, always an array),
// scope, user, created, updated. One `registry/{equipment,patterns}.json` entry
// is `{ id, name, synonyms }`; `id` maps to the `termId` column exactly as a
// movement's `id` maps to `movementId`.

/** One `registry/<name>.json` entry as a `<name>` collection record. */
function toVocabRecord(e, collectionName, prefix) {
  return {
    id: vocabId(prefix, e.id),
    collectionId: `mock_${collectionName}`,
    collectionName,
    termId: e.id,
    name: e.name ?? '',
    synonyms: Array.isArray(e.synonyms) ? e.synonyms : [],
    scope: 'global',
    user: '',
    created: '',
    updated: '',
  };
}

/** A create body -> a full vocabulary record (missing fields at their empty). */
function mkVocabRecord(body, collectionName, prefix) {
  const now = pbNow();
  return {
    id: vocabId(prefix, body.termId ?? ''),
    collectionId: `mock_${collectionName}`,
    collectionName,
    termId: body.termId ?? '',
    name: body.name ?? '',
    synonyms: Array.isArray(body.synonyms) ? body.synonyms : [],
    scope: body.scope ?? 'global',
    user: body.user ?? '',
    created: now,
    updated: now,
  };
}

/** The subset of an update body that maps to a vocabulary column. */
function pickVocabFields(body) {
  const out = {};
  for (const k of ['termId', 'name', 'synonyms', 'scope', 'user']) if (k in body) out[k] = body[k];
  return out;
}

/** A stable synthetic record id for a vocabulary term, `<prefix>` + hash of its termId. */
function vocabId(prefix, key) {
  let h = 5381;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return prefix + h.toString(36).padStart(9, '0');
}

// --- movement-set shapes (task S3, DEC-027) ------------------------------
// The migration's `movement_sets` columns: owner (relation -> users), name,
// setId (the namespaced natural key, unique), movements (json, an ordered array
// of registry movement ids), visibility (select private|unlisted|public),
// description, created, updated. No `scope` column — scope is derived from the
// owner + visibility, exactly as for `workouts` (DEC-027).

/** One `fixtures/movement-sets.json` seed entry as a `movement_sets` record. */
function toSetRecord(e) {
  return {
    id: e.id || ('ms' + hash36(e.setId || e.name)),
    collectionId: 'mock_movement_sets',
    collectionName: 'movement_sets',
    owner: e.owner ?? '',
    name: e.name ?? '',
    setId: e.setId ?? '',
    movements: Array.isArray(e.movements) ? e.movements : [],
    visibility: e.visibility ?? 'private',
    description: e.description ?? '',
    created: e.created ?? '',
    updated: e.updated ?? '',
  };
}

/** A create body -> a full `movement_sets` record (missing fields at their empty). */
function mkSetRecord(body) {
  const now = pbNow();
  return {
    id: mkId('ms'),
    collectionId: 'mock_movement_sets',
    collectionName: 'movement_sets',
    owner: body.owner ?? '',
    name: body.name ?? '',
    setId: body.setId ?? '',
    movements: Array.isArray(body.movements) ? body.movements : [],
    visibility: body.visibility ?? 'private',
    description: body.description ?? '',
    created: now,
    updated: now,
  };
}

/** The subset of an update body that maps to a `movement_sets` column. */
function pickSetFields(body) {
  const out = {};
  for (const k of ['owner', 'name', 'setId', 'movements', 'visibility', 'description']) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

// --- goal-ruleset shapes (task G3, DEC-028) ----------------------------
// The migration's `goals` columns: title, goalId (the namespaced natural key,
// unique across both scope tiers), source (the raw .wdlg), scope (select
// global|user), user (relation -> users, nullable — null for a `global` row),
// created, updated. The `global` seed is derived from examples/goals/*.wdlg:
// `goalId` = `wdl:<file-basename>` (the file names are stable kebab-case slugs,
// and `apps/shared/goals-store.js`'s offline fallback derives the same id).

const gSlug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const gTitle = (src) => (String(src ?? '').match(/^goals:[ \t]*(\S.*?)[ \t]*$/m) || [, ''])[1];

/** One `examples/goals/<name>.wdlg` file as a `global` `goals` record. */
function toGoalRecord(name, source) {
  const base = name.replace(/\.wdlg$/, '');
  const goalId = `wdl:${gSlug(base)}`;
  return {
    id: 'gl' + hash36(goalId),
    collectionId: 'mock_goals',
    collectionName: 'goals',
    title: gTitle(source) || base,
    goalId,
    source,
    scope: 'global',
    user: '',
    created: '',
    updated: '',
  };
}

/** A create body -> a full `goals` record (missing fields at their empty). */
function mkGoalRecord(body) {
  const now = pbNow();
  return {
    id: mkId('gl'),
    collectionId: 'mock_goals',
    collectionName: 'goals',
    title: body.title ?? '',
    goalId: body.goalId ?? '',
    source: body.source ?? '',
    scope: body.scope ?? 'user',
    user: body.user ?? '',
    created: now,
    updated: now,
  };
}

/** The subset of an update body that maps to a `goals` column. */
function pickGoalFields(body) {
  const out = {};
  for (const k of ['title', 'goalId', 'source', 'scope', 'user']) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

/** djb2 -> base36, the shared stable-hash used for synthetic seed ids. */
function hash36(key) {
  let h = 5381;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(9, '0');
}

// --- query + envelope -----------------------------------------------------

function applyQuery(items, url) {
  let out = items.slice();
  const filter = url.searchParams.get('filter');
  if (filter) out = out.filter((r) => matchesFilter(r, filter));
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

// --- filter matcher -------------------------------------------------------
// NOT a general expression engine — a pattern-matcher for exactly the filter
// strings `apps/shared/pocketbase.js` emits:
//   • one or more `field="value"` / `field!="value"` / `field~"value"`
//     comparisons joined by `&&` (`owner="…"`, `wdlId="…"`, `handle="…"`,
//     `id="…"`, `scope="global"`, `visibility!="private"`, …) — `=` is exact,
//     `!=` is exact-negated (task S3, `listPublicSets`), `~` is a
//     case-insensitive substring (task L4);
//   • the single parenthesised search shape from `searchWorkouts` (L4):
//       (visibility="public" || owner="<uid>") && (title~"<q>" || wdlId~"<q>")
//     and its signed-out form with no `owner` clause.
// An atom it doesn't recognise is treated as "no constraint" rather than an
// error, so an unforeseen filter degrades to a wider result set, never a crash.

/** Split `s` on a top-level `sep` (`&&` / `||`) — outside parens and quotes. */
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, quote = null, buf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { buf += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === '(') { depth++; buf += c; continue; }
    if (c === ')') { depth--; buf += c; continue; }
    if (depth === 0 && s.startsWith(sep, i)) { parts.push(buf); buf = ''; i += sep.length - 1; continue; }
    buf += c;
  }
  parts.push(buf);
  return parts;
}

/** One `field="v"` (exact), `field!="v"` (exact-negated) or `field~"v"` (substring) atom. */
function matchesAtom(rec, atom) {
  const m = atom.trim().match(/^([a-zA-Z_][\w.]*)\s*(!=|=|~)\s*["']([^"']*)["']$/);
  if (!m) return true; // unrecognised — don't let it exclude anything
  const [, field, op, value] = m;
  const have = String(rec[field] ?? '');
  if (op === '~') return have.toLowerCase().includes(value.toLowerCase());
  if (op === '!=') return have !== value;
  return have === value;
}

/** Every `&&` conjunct holds; a conjunct is an atom or a parenthesised `||` group. */
function matchesFilter(rec, filter) {
  return splitTop(filter, '&&').every((conj) => {
    const inner = conj.trim().replace(/^\(([\s\S]*)\)$/, '$1');
    return splitTop(inner, '||').some((d) => matchesAtom(rec, d));
  });
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
