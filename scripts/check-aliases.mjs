#!/usr/bin/env node
/**
 * Every name two records answer to, and who wins.
 *
 *   node scripts/check-aliases.mjs
 *
 * A name is *contended* when more than one record in a registry claims it — as
 * an id, as a title, or as an explicit alias. That is not by itself a defect:
 * `Squat` is claimed by an imported record called `squat` and by `air-squat`,
 * whose curator wrote `squat` into its aliases, and those are two different
 * kinds of claim. `Registry.lookup` decides between them by ranking the alias
 * above the name (see fold.ts), so most contended names have one answer.
 *
 * What this script exists for is the two things that ranking cannot do:
 *
 *   - it cannot say whether the two records are the *same movement*. Merging
 *     that call is a curation decision and belongs in registry/, not here.
 *   - it cannot decide a name two records both hold as an alias. Those come
 *     out as AMBIGUOUS, which is what `resolve()` returns for them too.
 *
 * A report, not a gate — it always exits 0. What stops a new collision landing
 * quietly is the pinned list in `packages/core/test/fold.test.ts`, *has only the
 * known alias collisions in the canonical corpus*; this is what you run to see
 * why the list says what it says, and what to paste into it when it changes.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Registry, fold } from '../packages/core/src/fold.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, 'registry', f), 'utf8')).movements;

/** How this record claims this name, in the order `lookup` consults them. */
function claims(entry, key) {
  const how = [];
  if ((entry.aliases ?? []).some((a) => fold(a) === key)) how.push('alias');
  if (fold(entry.id) === key) how.push('id');
  else if (fold(entry.title) === key) how.push('title');
  return how;
}

function report(label, records) {
  const reg = new Registry(records);
  const holders = new Map();
  for (const e of records) {
    for (const name of [e.id, e.title, ...(e.aliases ?? [])]) {
      const k = fold(name);
      if (!k) continue;
      if (!holders.has(k)) holders.set(k, new Set());
      holders.get(k).add(e);
    }
  }

  const contended = [...holders].filter(([, set]) => set.size > 1).sort(([a], [b]) => a.localeCompare(b));
  console.log(`\n${label} — ${records.length} records, ${contended.length} contended name${contended.length === 1 ? '' : 's'}`);

  let ambiguous = 0;
  for (const [key, set] of contended) {
    const r = reg.resolve(key);
    const winner = r.status === 'ok' ? `${r.entry.id} (via ${r.via})` : r.status.toUpperCase();
    if (r.status !== 'ok') ambiguous++;
    console.log(`\n  ${key}  ->  ${winner}`);
    for (const e of [...set].sort((a, b) => a.id.localeCompare(b.id))) {
      const mark = r.status === 'ok' && r.entry === e ? '*' : ' ';
      const src = (e.sources ?? []).join(',') || 'curated';
      console.log(`   ${mark} ${e.id.padEnd(24)} as ${claims(e, key).join('+').padEnd(9)} [${src}]`);
    }
  }

  const problems = reg.validate();
  if (problems.length) {
    console.log(`\n  ${label} validate():`);
    for (const p of problems) console.log(`    ${p}`);
  }
  return ambiguous;
}

let ambiguous = 0;
ambiguous += report('curated  (registry/movements.json)', read('movements.json'));
ambiguous += report('canonical (registry/movements.canonical.json)', read('movements.canonical.json'));

console.log(`\n${ambiguous} name${ambiguous === 1 ? '' : 's'} no rule can answer.`);
