#!/usr/bin/env node
/**
 * Dump the PocketBase `movements` collection back out to
 * `registry/movements.json` — queue task M4, DEC-020. The egress half of the
 * round-trip whose ingest half is `scripts/movements-to-db.mjs` (M3): an admin
 * edits the curated movement layer in the DB, `make movements:dump` writes it
 * back into the repo as the reviewable committed file.
 *
 * **The git diff is the review.** The file is rewritten in its *current* key
 * order and formatting — `JSON.stringify(obj, null, 1) + "\n"`, and each
 * movement entry's keys kept in the order that entry already uses on disk — so
 * a dump of an unmutated M3 ingest reproduces the file byte-for-byte and a real
 * edit shows up as exactly the fields that changed.
 *
 * **Round-trip guarantee** (DEC-020's "still open" item, closed by M3+M4):
 *   make movements:load   # registry/movements.json -> DB
 *   make movements:dump    # DB -> registry/movements.json
 *   git diff registry/movements.json   # empty
 *
 * **Field mapping** is the reverse of M3's, one column per per-movement field:
 *   - entry `id` <- `movementId`; `title` verbatim.
 *   - The nine array/object fields (`aliases`, `muscles`, `pattern`,
 *     `laterality`, `measures`, `implements`, `equipment`, `related`, `sameAs`)
 *     come straight out of their `json` columns, shape-for-shape.
 *   - The six scalars (`force`, `mechanic`, `load`, `lateralityAxis`,
 *     `defaultLaterality`, `source`) come straight out of their columns.
 *   - A column that is empty on the row (json -> null / [] / {}, scalar -> "")
 *     is *omitted* from the entry — the inverse of M3 clearing an absent field,
 *     so the round-trip is exact. `scope` / `user` / `id` (the record id) /
 *     `created` / `updated` are DB bookkeeping and never written to the file.
 *
 * **Entry order.** Entries already in the file keep their file order; a movement
 * that is in the DB but not yet in the file is appended at the end, sorted by
 * `id`, with keys `id, title, <json fields present>, <scalar fields present>`.
 * A movement in the file but no longer in the DB is dropped (the diff shows the
 * removal). `$comment` / `version` / `$sources` are copied from disk untouched.
 *
 * **Target** — `--api <base>` or `WDL_PB_URL`, default `http://localhost:8081`
 * (matches `make serve`). Reads need **no auth**: the collection's list/view
 * rule is `scope = "global" && deleted = null`. `--api` still lets a dump be
 * taken from prod.
 *
 * **Soft-deleted rows are excluded** (DEC-029, D1–D4). The fetch filter carries
 * an explicit `&& deleted = null` on top of the list rule that already hides
 * tombstones on this unauthenticated read, so a future *authenticated* dump
 * (list rule bypassed) still cannot pull a soft-deleted movement into
 * `registry/movements.json` — and therefore into `packages/core`. A movement
 * tombstoned in the DB drops from the file exactly as a hard-deleted one would.
 *
 * **Flags**
 *   --dry-run   report the tally + `git diff --stat` of what would change; write nothing.
 *   --check     write, then exit non-zero if the file changed — for the round-trip
 *               test and a future pre-commit hook (DEC-020 leaves the cadence open;
 *               this ships no hook, just the building block).
 *
 * Canonical corpus is untouched: this script only reads `/api` and writes
 * `registry/movements.json`. It never runs the registry pipeline, never writes
 * `registry/movements.canonical.json`, never touches `packages/core`.
 *
 *   node scripts/movements-from-db.mjs [--api <base>] [--dry-run] [--check]
 *   make movements:dump                 # same, WDL_PB_URL to point elsewhere
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const JSON_FIELDS = ['aliases', 'muscles', 'pattern', 'laterality', 'measures', 'implements', 'equipment', 'related', 'sameAs'];
const SCALAR_FIELDS = ['force', 'mechanic', 'load', 'lateralityAxis', 'defaultLaterality', 'source'];
const NEW_ENTRY_ORDER = ['id', 'title', ...JSON_FIELDS, ...SCALAR_FIELDS];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const CHECK = args.includes('--check');
const BASE = (flag('--api') ?? process.env.WDL_PB_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const COLL = `${BASE}/api/collections/movements/records`;
const REGISTRY_PATH = join(process.cwd(), 'registry/movements.json');

main().catch((e) => {
  console.error(`\nmovements:dump: ${e.message}`);
  process.exit(1);
});

async function main() {
  const oldRaw = readFileSync(REGISTRY_PATH, 'utf8');
  const src = JSON.parse(oldRaw);
  const fileEntries = src.movements ?? [];

  console.log(`movements:dump: ${BASE} -> registry/movements.json${DRY_RUN ? '  (dry run — no writes)' : ''}`);

  const rows = await fetchGlobal();
  console.log(`  ${rows.length} live scope="global" row(s) read`);
  const byId = new Map(rows.map((r) => [r.movementId, r]));

  // Existing entries keep file order; a DB row with no file entry is new.
  const kept = [];
  const removed = [];
  const seenIds = new Set();
  for (const entry of fileEntries) {
    const row = byId.get(entry.id);
    if (!row) { removed.push(entry.id); continue; }
    seenIds.add(entry.id);
    kept.push(rebuildEntry(entry, row));
  }
  const added = rows
    .filter((r) => !seenIds.has(r.movementId))
    .sort((a, b) => (a.movementId < b.movementId ? -1 : a.movementId > b.movementId ? 1 : 0))
    .map(newEntry);

  const out = { ...src, movements: [...kept, ...added] };
  // Re-assert original top-level key order ($comment, version, movements, $sources).
  const nextObj = {};
  for (const k of Object.keys(src)) nextObj[k] = k === 'movements' ? out.movements : src[k];

  const nextRaw = JSON.stringify(nextObj, null, 1) + '\n';

  // Count entries whose serialisation actually moved.
  let changed = 0;
  for (let i = 0; i < fileEntries.length; i++) {
    const before = fileEntries[i];
    const after = kept.find((e) => e.id === before.id);
    if (after && JSON.stringify(before) !== JSON.stringify(after)) changed++;
  }

  const identical = nextRaw === oldRaw;
  console.log(
    `\n${identical ? 'no change' : (DRY_RUN ? 'would write' : 'wrote')}: ` +
    `${kept.length} entr${kept.length === 1 ? 'y' : 'ies'} written` +
    `, ${added.length} added, ${removed.length} removed, ${changed} changed`,
  );
  if (removed.length) console.log(`  removed: ${removed.join(', ')}`);
  if (added.length) console.log(`  added: ${added.map((e) => e.id).join(', ')}`);

  if (DRY_RUN) {
    if (!identical) console.log('\n' + gitDiffStat(nextRaw));
    return;
  }

  if (!identical) writeFileSync(REGISTRY_PATH, nextRaw);

  if (CHECK) {
    if (identical) {
      console.log('  --check: clean (registry/movements.json matches the DB)');
      return;
    }
    console.log('\n' + gitDiffStat(nextRaw));
    console.error('movements:dump: --check failed — registry/movements.json changed (see diff above)');
    process.exit(1);
  }

  if (identical) console.log('  (registry/movements.json already matches the DB)');
}

// --- fetch ---------------------------------------------------------------

/** Every `scope = "global"` row, paged, sorted by `movementId`. */
async function fetchGlobal() {
  const all = [];
  let page = 1;
  for (;;) {
    const url = `${COLL}?filter=${encodeURIComponent('scope="global" && deleted = null')}&perPage=500&page=${page}&sort=movementId`;
    const env = await send('GET', url);
    for (const rec of env.items ?? []) all.push(rec);
    if (!env.totalPages || page >= env.totalPages) break;
    page++;
  }
  return all;
}

// --- field mapping -----------------------------------------------------

/** A column value that means "the entry does not carry this field". */
function isEmpty(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

/**
 * Rebuild one entry from its DB row, walking the entry's *existing* key order so
 * the serialisation is unchanged where the data is. A key the row has emptied is
 * dropped; a field the row carries that the entry lacked is appended in the
 * canonical `JSON_FIELDS` + `SCALAR_FIELDS` order.
 */
function rebuildEntry(fileEntry, row) {
  const out = {};
  const seen = new Set();
  for (const k of Object.keys(fileEntry)) {
    seen.add(k);
    if (k === 'id') { out.id = row.movementId; continue; }
    if (k === 'title') { out.title = row.title ?? ''; continue; }
    const v = (k in row) ? row[k] : fileEntry[k];
    if (!isEmpty(v)) out[k] = v;
  }
  for (const k of [...JSON_FIELDS, ...SCALAR_FIELDS]) {
    if (seen.has(k)) continue;
    if (!isEmpty(row[k])) out[k] = row[k];
  }
  return out;
}

/** A DB row that has no file entry yet — keys in the canonical order. */
function newEntry(row) {
  const out = {};
  for (const k of NEW_ENTRY_ORDER) {
    const v = k === 'id' ? row.movementId : k === 'title' ? (row.title ?? '') : row[k];
    if (k === 'id' || k === 'title' || !isEmpty(v)) out[k] = v;
  }
  return out;
}

// --- diff preview ------------------------------------------------------

/** `git diff --stat` of the would-be write against what is on disk. */
function gitDiffStat(nextRaw) {
  const tmp = REGISTRY_PATH + '.dump-preview';
  writeFileSync(tmp, nextRaw);
  try {
    return execFileSync('git', ['diff', '--no-index', '--stat', '--', REGISTRY_PATH, tmp], { encoding: 'utf8' }).trimEnd();
  } catch (e) {
    return (e.stdout ?? '').toString().trimEnd() || '(could not produce a diff)';
  } finally {
    rmSync(tmp, { force: true });
  }
}

// --- transport --------------------------------------------------------

async function send(method, url) {
  const res = await fetch(url, { method });
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
