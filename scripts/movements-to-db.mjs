#!/usr/bin/env node
/**
 * Ingest `registry/movements.json` into the PocketBase `movements` collection
 * over `/api` — queue task M3, DEC-020. The curated movement layer that lives in
 * that file moves into the DB; this script is how it gets there, and how a dev
 * re-seeds a local mock or a fresh box.
 *
 * **Idempotent, keyed by the registry `id`** → the `movementId` unique index
 * (M1). Every entry is looked up by `movementId`; absent → `POST`, present →
 * `PATCH` only the columns that actually differ. A second run writes nothing
 * (reported as all-`unchanged`). This is the ingest half of the round-trip
 * `dump (M4) -> load (M3) -> dump` that must yield no diff.
 *
 * **Field mapping** is the M1 schema, one column per per-movement field:
 *   - `movementId` = the registry `id`; `title` verbatim; every row `scope:
 *     "global"`, `user` left unset (Phase 1 is global movements only).
 *   - The nine array/object fields (`aliases`, `muscles`, `pattern`,
 *     `laterality`, `measures`, `implements`, `equipment`, `related`, `sameAs`)
 *     pass through shape-for-shape into their `json` columns.
 *   - The six scalars (`force`, `mechanic`, `load`, `lateralityAxis`,
 *     `defaultLaterality`, `source`) map straight to their columns.
 *   - A field the entry does not have is not written on create, and is cleared
 *     on update (json -> null, scalar -> "") so the row matches the entry and
 *     M4's dump round-trips.
 *
 * **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
 * (matches `make serve`). Writes need admin auth:
 *   - `WDL_PB_ADMIN_TOKEN` — a token, used as-is; or
 *   - `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD` — exchanged at
 *     `POST /api/collections/<c>/auth-with-password` where `<c>` is
 *     `WDL_PB_ADMIN_COLLECTION` (default `users`; the row must have `admin:
 *     true` — `deploy/README.md` §7a — or be a `_superusers` row).
 *   - Neither set → the dev-mock OAuth stub is tried (`make serve` accepts it);
 *     against a real PocketBase that fails and the script explains what to set.
 * The token rides as the `Authorization` header on every write.
 *
 * Canonical corpus is untouched: this script only talks to `/api`. It never
 * writes `registry/*.json`, never runs the registry pipeline, never touches
 * `packages/core`.
 *
 *   node scripts/movements-to-db.mjs [--api <base>] [--dry-run]
 *   make movements-load                 # same, WDL_PB_URL to point elsewhere
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const JSON_FIELDS = ['aliases', 'muscles', 'pattern', 'laterality', 'measures', 'implements', 'equipment', 'related', 'sameAs'];
const SCALAR_FIELDS = ['force', 'mechanic', 'load', 'lateralityAxis', 'defaultLaterality', 'source'];
const ALL_FIELDS = ['movementId', 'title', 'scope', ...JSON_FIELDS, ...SCALAR_FIELDS];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const BASE = (flag('--api') ?? process.env.WDL_PB_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const COLL = `${BASE}/api/collections/movements/records`;

main().catch((e) => {
  console.error(`\nmovements-load: ${e.message}`);
  process.exit(1);
});

async function main() {
  const src = JSON.parse(readFileSync(join(process.cwd(), 'registry/movements.json'), 'utf8'));
  const entries = src.movements ?? [];
  if (!entries.length) throw new Error('registry/movements.json has no movements');

  console.log(`movements-load: ${entries.length} entries -> ${BASE}${DRY_RUN ? '  (dry run — no writes)' : ''}`);

  const token = await authenticate();
  const existing = await fetchExisting(token);
  console.log(`  ${existing.size} row(s) already in the collection`);

  const tally = { created: 0, updated: 0, unchanged: 0 };
  let n = 0;
  for (const entry of entries) {
    const id = entry.id;
    if (!id) throw new Error(`an entry has no id: ${JSON.stringify(entry).slice(0, 120)}`);
    const have = existing.get(id);

    if (!have) {
      if (!DRY_RUN) await send('POST', COLL, token, createBody(entry));
      tally.created++;
    } else {
      const patch = diff(entry, have);
      if (Object.keys(patch).length === 0) {
        tally.unchanged++;
      } else {
        if (!DRY_RUN) await send('PATCH', `${COLL}/${encodeURIComponent(have.id)}`, token, patch);
        tally.updated++;
      }
    }
    if (++n % 100 === 0) console.log(`  ${n}/${entries.length}…`);
  }

  console.log(
    `\n${DRY_RUN ? 'would be: ' : 'done: '}` +
    `${tally.created} created, ${tally.updated} updated, ${tally.unchanged} unchanged`,
  );
  if (!DRY_RUN && tally.created === 0 && tally.updated === 0) {
    console.log('  (nothing changed — the collection already matches registry/movements.json)');
  }
}

// --- auth ------------------------------------------------------------------

async function authenticate() {
  if (process.env.WDL_PB_ADMIN_TOKEN) {
    return process.env.WDL_PB_ADMIN_TOKEN;
  }
  const email = process.env.WDL_PB_ADMIN_EMAIL;
  const password = process.env.WDL_PB_ADMIN_PASSWORD;
  if (email && password) {
    const coll = process.env.WDL_PB_ADMIN_COLLECTION || 'users';
    const out = await send('POST', `${BASE}/api/collections/${coll}/auth-with-password`, null, {
      identity: email,
      password,
    });
    if (!out?.token) throw new Error(`auth-with-password against '${coll}' returned no token`);
    console.log(`  authed as ${email} (collection '${coll}')`);
    return out.token;
  }
  // No explicit credentials. `make serve`'s mock accepts a stubbed OAuth
  // exchange and treats any Authorization header as admin; a real PocketBase
  // will reject this, and the catch below says what to set.
  try {
    const out = await send('POST', `${BASE}/api/collections/users/auth-with-oauth2`, null, {
      provider: 'google',
      code: 'movements-load',
      codeVerifier: 'movements-load',
      redirectURL: `${BASE}/`,
    });
    if (!out?.token) throw new Error('no token');
    console.log('  authed via the dev mock (no WDL_PB_ADMIN_* set)');
    return out.token;
  } catch {
    throw new Error(
      'writing to a real PocketBase needs admin credentials.\n' +
      '  set WDL_PB_ADMIN_TOKEN, or WDL_PB_ADMIN_EMAIL + WDL_PB_ADMIN_PASSWORD\n' +
      "  (optionally WDL_PB_ADMIN_COLLECTION, default 'users' — the row needs admin: true, deploy/README.md §7a).\n" +
      `  target: ${BASE}  (override with --api <base> or WDL_PB_URL)`,
    );
  }
}

// --- fetch existing ------------------------------------------------------

/** Every row already in the collection, as a Map keyed by `movementId`. */
async function fetchExisting(token) {
  const map = new Map();
  let page = 1;
  for (;;) {
    const url = `${COLL}?perPage=500&page=${page}&sort=movementId`;
    const env = await send('GET', url, token);
    for (const rec of env.items ?? []) map.set(rec.movementId, rec);
    if (!env.totalPages || page >= env.totalPages) break;
    page++;
  }
  return map;
}

// --- field mapping -----------------------------------------------------

/** The create payload — only the fields the entry actually carries. */
function createBody(entry) {
  const body = { movementId: entry.id, title: entry.title ?? '', scope: 'global' };
  for (const k of [...JSON_FIELDS, ...SCALAR_FIELDS]) {
    if (k in entry && entry[k] != null) body[k] = entry[k];
  }
  return body;
}

/** The empty value a missing field takes in the row. */
const emptyFor = (k) => (JSON_FIELDS.includes(k) ? null : '');

/** Columns where the entry and the row disagree — the PATCH body (may be {}). */
function diff(entry, row) {
  const patch = {};
  for (const k of ALL_FIELDS) {
    const want = k === 'movementId' ? entry.id
      : k === 'scope' ? 'global'
      : (k in entry && entry[k] != null) ? entry[k]
      : emptyFor(k);
    const got = row[k] ?? emptyFor(k);
    if (!eq(want, got)) patch[k] = want;
  }
  return patch;
}

/** Order-independent deep equality (PocketBase may reorder json object keys). */
function eq(a, b) {
  return stable(a) === stable(b);
}

function stable(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// --- transport --------------------------------------------------------

async function send(method, url, token, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = token;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.data && Object.keys(data.data).length ? ` ${JSON.stringify(data.data)}` : '';
    const err = new Error(`${method} ${url.replace(BASE, '')} — ${res.status} ${data?.message || res.statusText}${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
