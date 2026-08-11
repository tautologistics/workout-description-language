#!/usr/bin/env node
/**
 * Check the external datasets in registry/SOURCES.json against their upstreams.
 *
 *   node scripts/refresh-sources.ts            report what has changed
 *   node scripts/refresh-sources.ts --write    save fresh copies alongside
 *
 * Reports rather than overwrites by default. These datasets have already been
 * wrong in ways that mattered — a third-party extraction missing 238 exercises,
 * a field documented as grams that is not — so a silent update is the last
 * thing anyone wants.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(join(root, 'registry/SOURCES.json'), 'utf8'));
const write = process.argv.includes('--write');

const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/** Where a refreshed copy lands, if the source has a local mirror. */
const MIRRORS: Record<string, string> = {
  'free-exercise-db': 'docs/references/free-exercise-db.json',
  'garmin-exercises': 'docs/references/Exercises.json',
  'garmin-benchmarks': 'docs/references/bechmarks.json',
};

const rows: string[] = [];
let changed = 0;

for (const s of sources.sources) {
  if (!s.fetch) { rows.push(`  –  ${s.id.padEnd(24)} no direct fetch URL (${s.licence})`); continue; }
  let body: string | undefined;
  try {
    const res = await fetch(s.fetch, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.text();
  } catch (e) {
    const why = s.fetchNeedsSession ? ' (needs a logged-in browser session)' : '';
    rows.push(`  ✗  ${s.id.padEnd(24)} unreachable: ${(e as Error).message}${why}`);
    continue;
  }

  const mirror = MIRRORS[s.id];
  const local = mirror && existsSync(join(root, mirror))
    ? readFileSync(join(root, mirror), 'utf8') : undefined;

  if (local === undefined) {
    rows.push(`  ?  ${s.id.padEnd(24)} fetched ${body.length}b, no local copy to compare`);
  } else if (digest(local) === digest(body)) {
    rows.push(`  =  ${s.id.padEnd(24)} unchanged since ${s.retrieved}`);
  } else {
    changed++;
    const delta = body.length - local.length;
    rows.push(`  ≠  ${s.id.padEnd(24)} CHANGED (${delta > 0 ? '+' : ''}${delta} bytes) — retrieved ${s.retrieved}`);
    if (write && mirror) {
      writeFileSync(join(root, mirror), body);
      rows.push(`     wrote ${mirror}`);
    }
  }
}

console.log('\nTracked sources:');
console.log(rows.join('\n'));

const byClass: Record<string, string[]> = {};
for (const s of [...sources.sources, ...sources.candidates]) {
  (byClass[s.licenceClass] ??= []).push(s.id);
}
console.log('\nBy licence class:');
for (const [k, v] of Object.entries(byClass).sort()) {
  console.log(`  ${k.padEnd(26)} ${v.join(', ')}`);
}

if (changed && !write) console.log(`\n${changed} source(s) changed. Re-run with --write to update the local copies, then diff.`);
console.log();
