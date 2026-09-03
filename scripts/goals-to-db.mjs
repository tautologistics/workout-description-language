#!/usr/bin/env node
/**
 * Ingest the authored goal rulesets under `examples/goals/*.wdlg` into the
 * PocketBase `goals` collection over `/api` as `scope: "global"` rows — queue
 * task G3 of the goals database epic (G0-G4), [DEC-028]. The `.wdlg` files that
 * ship in the repo are the committed source of truth for the `global` tier; the
 * DB rows are a mirror. This script is how they get there, and how a dev
 * re-seeds a local mock or a fresh box.
 *
 * It is the twin of `scripts/vocab-to-db.mjs` (`make vocab:load`) for goals —
 * same no-deps (`node:fs` + global `fetch`) shape, same auth, same transport.
 *
 * **Idempotent, keyed by `goalId`** (`wdl:<file-basename>`) → the unique index
 * G1 created. Every file is looked up by its `goalId`; absent → `POST`, present
 * → `PATCH` only when `title` or `source` actually differ. A second run writes
 * nothing (reported as all-`unchanged`). `--dry-run` reports the planned
 * POSTs / PATCHes and mutates nothing.
 *
 * **Field mapping** — one `goals` row per file (G1's contract):
 *   - `goalId` = `wdl:<basename>` where `<basename>` is the file name without
 *     its `.wdlg` extension. The file names are already kebab-case slugs
 *     (`ramp-the-pull`, `rotate-muscles`, `ramp-the-squat`) and stable, and
 *     `apps/shared/goals-store.js`'s offline fallback derives the same
 *     `wdl:<slug(basename)>` — so the DB rows and the bundled fallback carry
 *     identical ids. (Slugging the *title* instead would give
 *     `wdl:put-weight-on-the-bar-week-after-week` for `ramp-the-squat.wdlg`,
 *     which matches neither the file nor the fallback.)
 *   - `title` = the inline text after the `goals:` header line, i.e.
 *     `parseGoals(source).title` — read with the same light regex
 *     `apps/shared/goals-store.js` uses (`goalTitle()`), so this stays a
 *     no-deps script the way `vocab-to-db.mjs` / `workouts-to-db.mjs` do rather
 *     than pulling in `packages/core`.
 *   - `source` = the file bytes **verbatim** (DEC-028 — the ingest must not
 *     reformat, re-comment or "canonicalise"; `rotate-muscles.wdlg` in
 *     particular is a keeper Chris flagged verbatim).
 *   - `scope` = `"global"` on every row; `user` is left unset (null).
 *
 * **No fixture is regenerated and there is no `make goals:dump`.** This follows
 * `vocab-to-db.mjs`, not `workouts-to-db.mjs`: `workouts:load` commits
 * `fixtures/workouts.json` because the mock `workouts` handler needs seed rows
 * it cannot derive (the mock user's own non-org workouts). Goals are the vocab
 * case — a small authored set the mock derives from the same
 * `examples/goals/*.wdlg` files at boot (see `scripts/mock-api.mjs`), so a
 * committed `fixtures/goals.json` would be a second copy of the file contents
 * for `make goals:load` to keep in step, i.e. exactly the drift DEC-028 avoids
 * by making the files the source. A `dump` twin is not wanted for three files
 * edited directly in the repo — the same call `vocab-to-db.mjs` made for its
 * forty terms.
 *
 * **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
 * (matches `make serve`). Against the mock (`make serve`) any `Authorization`
 * header counts as admin, so a bare run works. Against a real PocketBase the
 * `goals` write rule for a `global` row is `@request.auth.admin = true`, so a
 * `users` row with `admin: true` is enough (same as `movements:load`, unlike
 * `workouts:load` which needs a superuser):
 *   - `WDL_PB_ADMIN_TOKEN` — a token, used as-is; or
 *   - `WDL_PB_ADMIN_EMAIL` + `WDL_PB_ADMIN_PASSWORD` — exchanged at
 *     `POST /api/collections/<c>/auth-with-password` where `<c>` is
 *     `WDL_PB_ADMIN_COLLECTION` (default `users`; the row must have
 *     `admin: true` — `deploy/README.md` §7a — or be a `_superusers` row).
 *   - Neither set → the dev-mock OAuth stub is tried (`make serve` accepts it);
 *     against a real PocketBase that fails and the catch below says what to set.
 *
 * The authored `.wdlg` files, `packages/core`, the grammar and the spec are
 * untouched: this script only reads `examples/goals/` and talks to `/api`.
 *
 *   node scripts/goals-to-db.mjs [--api <base>] [--dry-run]
 *   make goals:load                     # same, WDL_PB_URL to point elsewhere
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GOALS_DIR = 'examples/goals';
const CMP_FIELDS = ['title', 'source'];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const BASE = (flag('--api') ?? process.env.WDL_PB_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const COLL = `${BASE}/api/collections/goals/records`;

async function main() {
  const rows = readRulesets();
  if (!rows.length) throw new Error(`no .wdlg files under ${GOALS_DIR}/`);
  console.log(`goals:load: ${rows.length} file(s) -> ${BASE}${DRY_RUN ? '  (dry run — no writes)' : ''}`);

  const token = await authenticate();
  const existing = await fetchExisting(token);
  console.log(`  ${existing.size} global row(s) already in the collection`);

  const tally = { created: 0, updated: 0, unchanged: 0 };
  for (const row of rows) {
    const have = existing.get(row.goalId);
    if (!have) {
      if (!DRY_RUN) await send('POST', COLL, token, createBody(row));
      tally.created++;
      log('POST  ', row.goalId);
    } else {
      const patch = diff(row, have);
      if (Object.keys(patch).length === 0) {
        tally.unchanged++;
      } else {
        if (!DRY_RUN) await send('PATCH', `${COLL}/${encodeURIComponent(have.id)}`, token, patch);
        tally.updated++;
        log('PATCH ', row.goalId, `(${Object.keys(patch).join(', ')})`);
      }
    }
  }

  console.log(
    `\n${DRY_RUN ? 'would be: ' : 'done: '}` +
    `${tally.created} created, ${tally.updated} updated, ${tally.unchanged} unchanged`,
  );
  if (!DRY_RUN && tally.created === 0 && tally.updated === 0) {
    console.log(`  (nothing changed — the global tier already matches ${GOALS_DIR}/)`);
  }
}

const log = (verb, id, extra = '') => {
  if (DRY_RUN || process.env.WDL_VERBOSE) console.log(`  ${verb} ${id}${extra ? '  ' + extra : ''}`);
};

// --- read the authored rulesets --------------------------------------------

/** lower-case; non-alnum runs collapse to one `-`; ends trimmed (cf. `goals-store.js`). */
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The inline text after a `.wdlg`'s `goals:` header — `parseGoals(source).title`. */
const goalTitle = (src) => (String(src ?? '').match(/^goals:[ \t]*(\S.*?)[ \t]*$/m) || [, ''])[1];

/** Every `examples/goals/*.wdlg`, as a desired `goals` row, in `goalId` order. */
function readRulesets() {
  const dir = join(process.cwd(), GOALS_DIR);
  const out = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (!f.isFile() || !f.name.endsWith('.wdlg')) continue;
    const source = readFileSync(join(dir, f.name), 'utf8');
    const base = f.name.replace(/\.wdlg$/, '');
    out.push({
      goalId: `wdl:${slug(base)}`,
      title: goalTitle(source) || base,
      source,
    });
  }
  out.sort((a, b) => (a.goalId < b.goalId ? -1 : a.goalId > b.goalId ? 1 : 0));
  const seen = new Set();
  for (const r of out) {
    if (seen.has(r.goalId)) throw new Error(`two files resolve to the same goalId: ${r.goalId}`);
    seen.add(r.goalId);
  }
  return out;
}

// --- auth (mirrors scripts/movements-to-db.mjs) ---------------------------
// The `goals` write rule for a `global` row is `@request.auth.admin = true` —
// the same rule `movements` carries, so a `users` admin row is enough (the
// default collection is `users`, not `_superusers`).

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
      code: 'goals-load',
      codeVerifier: 'goals-load',
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

/** Every `global` row already in the collection, as a Map keyed by `goalId`. */
async function fetchExisting(token) {
  const map = new Map();
  let page = 1;
  for (;;) {
    const url = `${COLL}?perPage=500&page=${page}&sort=goalId&filter=${encodeURIComponent('scope="global"')}`;
    const env = await send('GET', url, token);
    for (const rec of env.items ?? []) if (rec.goalId) map.set(rec.goalId, rec);
    if (!env.totalPages || page >= env.totalPages) break;
    page++;
  }
  return map;
}

// --- field mapping -----------------------------------------------------

/** The create payload — identity, scope, and the two data columns. */
function createBody(row) {
  return {
    goalId: row.goalId,
    title: row.title,
    source: row.source,
    scope: 'global',
  };
}

/** Columns where the file and the row disagree — the PATCH body (may be {}). */
function diff(row, rec) {
  const patch = {};
  for (const k of CMP_FIELDS) {
    if (String(row[k] ?? '') !== String(rec[k] ?? '')) patch[k] = row[k];
  }
  return patch;
}

// --- transport (mirrors scripts/vocab-to-db.mjs) ----------------------

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

// --- entry point ---------------------------------------------------------

main().catch((e) => {
  console.error(`\ngoals:load: ${e.message}`);
  process.exit(1);
});
