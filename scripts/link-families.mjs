#!/usr/bin/env node
/**
 * Attach wger's variation groups to the canonical corpus as movement families.
 *
 *   node scripts/link-families.mjs [--apply]
 *
 * A family is a *sibling* relation — every squat variant, every bench press
 * variant — which is a different and better-founded thing than the `variantOf`
 * links derived from name subsets. Those can only relate names that contain one
 * another, so they miss that an Arnold press and a push press are both shoulder
 * presses. wger's editors grouped these by hand; that is evidence no amount of
 * string comparison produces.
 *
 * It also cuts the other way, which is the more useful half: two records in the
 * same family are *deliberately distinct*. Family membership is therefore a veto
 * on merging them, not encouragement.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const apply = process.argv.includes('--apply');
const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with', 'for', 'on', 'in']);
const SYN = { tricep: 'triceps', bicep: 'biceps', ab: 'abs', quad: 'quads', glute: 'glutes',
  db: 'dumbbell', bb: 'barbell', kb: 'kettlebell', deg: 'degree', degrees: 'degree', sz: 'ez' };
const dep = (w) => /(ss|sis|us)$/.test(w) ? w : /ies$/.test(w) ? `${w.slice(0, -3)}y`
  : /(ch|sh|x|z|s)es$/.test(w) ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w;
const toks = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t))
  .map((t) => { const x = SYN[t] ?? t; return SYN[dep(x)] ?? dep(x); });
const fold = (s) => toks(s).join('');

const doc = JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8'));
const byFold = new Map();
for (const r of doc.movements) {
  if (!byFold.has(fold(r.title))) byFold.set(fold(r.title), r);
  for (const a of r.aliases ?? []) if (!byFold.has(fold(a))) byFold.set(fold(a), r);
}

const wger = JSON.parse(readFileSync('docs/references/wger.json', 'utf8')).results;
const groups = new Map();
for (const e of wger) {
  const g = e.variation_group;
  const en = (e.translations ?? []).find((t) => t.language === 2 && t.name)?.name;
  if (g == null || !en) continue;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(en);
}

let linked = 0, unresolved = 0;
const families = [];
for (const [uuid, names] of groups) {
  const members = [];
  for (const n of names) {
    const r = byFold.get(fold(n));
    if (r) { if (!members.includes(r)) members.push(r); } else unresolved++;
  }
  if (members.length < 2) continue;
  // Name the family after its most basic member — the fewest words wins, which
  // is nearly always the unqualified movement.
  const base = members.slice().sort((a, b) => toks(a.title).length - toks(b.title).length
    || a.title.length - b.title.length)[0];
  const id = base.id;
  families.push({ id, base: base.title, source: 'wger', sourceId: uuid, members: members.map((m) => m.id) });
  for (const m of members) { m.family = id; linked++; }
}

console.log(`${families.length} families covering ${linked} movements`);
console.log(`  wger members that did not resolve: ${unresolved}`);
console.log(`  families by size: ${families.map((f) => f.members.length).sort((a, b) => b - a).slice(0, 8).join(', ')}…`);

if (!apply) { console.log('\nReport only. Re-run with --apply to write.'); process.exit(0); }

doc.families = families;
writeFileSync('registry/movements.canonical.json', JSON.stringify(doc, null, 0) + '\n');
console.log('\nWrote family links into registry/movements.canonical.json');
