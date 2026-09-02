#!/usr/bin/env node
/**
 * Ingest `registry/equipment.json` and `registry/patterns.json` into the
 * PocketBase `equipment` / `patterns` collections over `/api` — queue task V8,
 * DEC-025. The two open vocabularies the movement editor offers move into the
 * DB the way the curated movement layer did (DEC-020, M3); this script is how
 * they get there, and how a dev re-seeds a local mock or a fresh box.
 *
 * **Idempotent, keyed by the registry `id`** → the `termId` unique index (V6).
 * Every term is looked up by `termId`; absent → `POST`, present → `PATCH` only
 * the columns that actually differ (`name`, `synonyms`). A second run writes
 * nothing (reported as all-`unchanged`), per collection.
 *
 * **Field mapping** is the V6 schema, one column per registry field:
 *   - `termId` = the registry `id`; `name` verbatim; `synonyms` (json) passes
 *     through shape-for-shape (always an array in the data, empty where there is
 *     nothing to fold); every row `scope: "global"`, `user` left unset.
 *
 * This is the vocab twin of `scripts/movements-to-db.mjs` — same no-deps
 * (`node:fs` + global `fetch`) shape, same auth, same transport. It only talks
 * to `/api`: it never writes `registry/*.json`, never runs the registry
 * pipeline, never touches `packages/core`.
 *
 * **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
 * (matches `make serve`). Writes need admin auth (the collections' write rule is
 * `@request.auth.admin = true`, same as `movements`):
 *   - `WDL_PB_ADMIN_TOKEN` — a token, used as-is; or
 *   - `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD` — exchanged at
 *     `POST /api/collections/<c>/auth-with-password` where `<c>` is
 *     `WDL_PB_ADMIN_COLLECTION` (default `users`; the row must have `admin:
 *     true` — `deploy/README.md` §7a — or be a `_superusers` row).
 *   - Neither set → the dev-mock OAuth stub is tried (`make serve` accepts it);
 *     against a real PocketBase that fails and the script explains what to set.
 *
 *   node scripts/vocab-to-db.mjs [--api <base>] [--dry-run]
 *   make vocab:load                     # same, WDL_PB_URL to point elsewhere
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The two vocabularies, each `{ registry file key, collection name }`. */
const VOCABS = [
  { key: 'equipment', file: 'registry/equipment.json', collection: 'equipment' },
  { key: 'patterns', file: 'registry/patterns.json', collection: 'patterns' },
];

/** json columns and scalar columns — the V6 schema, minus DB bookkeeping. */
const JSON_FIELDS = ['synonyms'];
const SCALAR_FIELDS = ['name'];
const ALL_FIELDS = ['termId', 'scope', ...JSON_FIELDS, ...SCALAR_FIELDS];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const BASE = (flag('--api') ?? process.env.WDL_PB_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const collUrl = (name) => `${BASE}/api/collections/${name}/records`;

main().catch((e) => {
  console.error(`\nvocab:load: ${e.message}`);
  process.exit(1);
});

async function main() {
  console.log(`vocab:load: ${BASE}${DRY_RUN ? '  (dry run — no writes)' : ''}`);

  const token = await authenticate();

  const totals = { created: 0, updated: 0, unchanged: 0 };
  for (const v of VOCABS) {
    const src = JSON.parse(readFileSync(join(process.cwd(), v.file), 'utf8'));
    const entries = src[v.key] ?? [];
    if (!entries.length) throw new Error(`${v.file} has no ${v.key}`);

    const url = collUrl(v.collection);
    const existing = await fetchExisting(url, token);

    const tally = { created: 0, updated: 0, unchanged: 0 };
    for (const entry of entries) {
      const id = entry.id;
      if (!id) throw new Error(`a ${v.key} entry has no id: ${JSON.stringify(entry).slice(0, 120)}`);
      const have = existing.get(id);

      if (!have) {
        if (!DRY_RUN) await send('POST', url, token, createBody(entry));
        tally.created++;
      } else {
        const patch = diff(entry, have);
        if (Object.keys(patch).length === 0) {
          tally.unchanged++;
        } else {
          if (!DRY_RUN) await send('PATCH', `${url}/${encodeURIComponent(have.id)}`, token, patch);
          tally.updated++;
        }
      }
    }

    console.log(
      `  ${v.collection.padEnd(9)} ${entries.length} term(s): ` +
      `${tally.created} created, ${tally.updated} updated, ${tally.unchanged} unchanged` +
      ` (${existing.size} row(s) in the collection)`,
    );
    for (const k of Object.keys(totals)) totals[k] += tally[k];
  }

  console.log(
    `\n${DRY_RUN ? 'would be: ' : 'done: '}` +
    `${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`,
  );
  if (!DRY_RUN && totals.created === 0 && totals.updated === 0) {
    console.log('  (nothing changed — both collections already match registry/{equipment,patterns}.json)');
  }
}

// --- auth ------------------------------------------------------------------
// Identical to scripts/movements-to-db.mjs — the vocab collections' write rule
// is `@request.auth.admin = true`, the same rule `movements` carries.

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
      code: 'vocab-load',
      codeVerifier: 'vocab-load',
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

/** Every row already in the collection, as a Map keyed by `termId`. */
async function fetchExisting(url, token) {
  const map = new Map();
  let page = 1;
  for (;;) {
    const env = await send('GET', `${url}?perPage=500&page=${page}&sort=termId`, token);
    for (const rec of env.items ?? []) map.set(rec.termId, rec);
    if (!env.totalPages || page >= env.totalPages) break;
    page++;
  }
  return map;
}

// --- field mapping -----------------------------------------------------

/** The create payload — identity, scope, and the two data columns. */
function createBody(entry) {
  return {
    termId: entry.id,
    name: entry.name ?? '',
    scope: 'global',
    synonyms: Array.isArray(entry.synonyms) ? entry.synonyms : [],
  };
}

/** The empty value a missing field takes in the row. */
const emptyFor = (k) => (JSON_FIELDS.includes(k) ? [] : '');

/** Columns where the entry and the row disagree — the PATCH body (may be {}). */
function diff(entry, row) {
  const patch = {};
  for (const k of ALL_FIELDS) {
    const want = k === 'termId' ? entry.id
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
