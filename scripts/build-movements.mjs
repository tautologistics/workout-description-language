#!/usr/bin/env node
/**
 * Merge every movement source into registry/movements.canonical.json.
 *
 * Merge order is wdl-curated > garmin > free-exercise-db > wger > everkinetic.
 * Earlier sources win on conflicting scalar fields; set-valued fields —
 * equipment, aliases, translations — are unioned. Muscles are not unioned: each
 * source's claim is recorded and the merged view is derived from all of them,
 * so every muscle in the corpus can be traced back to who said so. Every record
 * names the sources that contributed to it, so the merge stays reversible and
 * the licence question stays answerable.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { norm, deriveMuscles, unknownMuscles } from './lib/muscles.mjs';

const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with']);
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('');
const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('-');

const records = new Map();
function add(key, title, source, f = {}) {
  if (!key || !title) return;
  let r = records.get(key);
  if (!r) {
    r = { id: slug(title) || key, title, aliases: new Set(),
          equipment: new Set(), pattern: new Set(), translations: {}, sources: [], external: {},
          // Which source contributed what: upstream ids, and the name each used.
          origin: {}, muscleClaims: {} };
    records.set(key, r);
  }
  if (!r.sources.includes(source)) r.sources.push(source);
  if (f.__upstream !== undefined || f.__name !== undefined) {
    r.origin[source] = { id: f.__upstream ?? null, name: f.__name ?? title };
    delete f.__upstream; delete f.__name;
  }
  // Each source's own muscle claim, kept separate rather than folded into a
  // shared set: the sources disagree, and the disagreement is the useful part.
  if (f.primary?.length || f.secondary?.length) {
    r.muscleClaims[source] = { primary: [...(f.primary ?? [])], secondary: [...(f.secondary ?? [])] };
  }
  delete f.primary; delete f.secondary;
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null) continue;
    if (r[k] instanceof Set) for (const x of v) r[k].add(x);
    else if (k === 'external' || k === 'translations') Object.assign(r[k], v);
    else if (r[k] === undefined) r[k] = v;
  }
}

// 1. curated core
for (const m of JSON.parse(readFileSync('registry/movements.json', 'utf8')).movements) {
  if (m.source === 'free-exercise-db') continue;
  add(fold(m.title), m.title, 'wdl-curated', {
    aliases: m.aliases ?? [], primary: norm(m.muscles?.primary), secondary: norm(m.muscles?.secondary),
    pattern: m.pattern ?? [], equipment: m.equipment ? [m.equipment] : [],
    implements: m.implements, load: m.load, measures: m.measures,
    laterality: m.laterality, defaultLaterality: m.defaultLaterality,
  });
}
// 2. Garmin — authoritative muscles plus the interop identifiers
for (const e of JSON.parse(readFileSync('registry/garmin-exercises.json', 'utf8')).exercises) {
  add(fold(e.name), e.name, 'garmin', {
    primary: norm(e.primaryMuscles), secondary: norm(e.secondaryMuscles),
    external: { garminCategory: e.category, garminExercise: e.exercise },
    __upstream: `${e.category}/${e.exercise}`, __name: e.name,
  });
}
// 3. free-exercise-db — public domain
for (const e of JSON.parse(readFileSync('docs/references/free-exercise-db.json', 'utf8'))) {
  add(fold(e.name), e.name, 'free-exercise-db', {
    primary: norm(e.primaryMuscles), secondary: norm(e.secondaryMuscles),
    equipment: e.equipment && e.equipment !== 'body only' ? [e.equipment] : [],
    force: e.force, mechanic: e.mechanic, __upstream: e.id, __name: e.name,
  });
}
// 4. wger — the only source with translations
if (existsSync('docs/references/wger.json')) {
  for (const e of JSON.parse(readFileSync('docs/references/wger.json', 'utf8')).results) {
    const tr = e.translations ?? [];
    const en = tr.find((t) => t.language === 2 && t.name)?.name;
    if (!en) continue;
    const names = {};
    for (const t of tr) if (t.name && t.language) names[`lang-${t.language}`] = t.name;
    add(fold(en), en, 'wger', {
      primary: norm((e.muscles ?? []).map((m) => m.name_en || m.name)),
      secondary: norm((e.muscles_secondary ?? []).map((m) => m.name_en || m.name)),
      equipment: (e.equipment ?? []).map((q) => q.name).filter(Boolean),
      translations: names, __upstream: e.uuid ?? e.id, __name: en,
      variationGroup: e.variation_group ?? undefined,
    });
  }
}
// 5. everkinetic
if (existsSync('docs/references/everkinetic.json')) {
  for (const e of JSON.parse(readFileSync('docs/references/everkinetic.json', 'utf8'))) {
    const t = e.title ?? e.name;
    if (!t) continue;
    add(fold(t), t, 'everkinetic', {
      primary: norm(e.primary), secondary: norm(e.secondary), equipment: e.equipment ?? [],
      __upstream: e.id, __name: t,
    });
  }
}

if (unknownMuscles.size) {
  console.error('Unknown muscle names. Add them to registry/muscles.json as synonyms of an existing');
  console.error('muscle, or as a new muscle if they are genuinely one we do not track yet:');
  for (const [k, n] of [...unknownMuscles].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(5)}  ${k}`);
  process.exit(1);
}

const out = [...records.values()].sort((a, b) => a.id.localeCompare(b.id)).map((r) => {
  const rec = { id: r.id, title: r.title };
  const aliases = [...r.aliases].filter((a) => fold(a) !== fold(r.title));
  if (aliases.length) rec.aliases = aliases.sort();
  const derived = deriveMuscles(r.muscleClaims);
  if (derived) rec.muscles = derived;
  for (const k of ['pattern', 'equipment']) if (r[k].size) rec[k] = [...r[k]].sort();
  for (const k of ['implements', 'load', 'measures', 'laterality', 'defaultLaterality', 'force', 'mechanic'])
    if (r[k] !== undefined) rec[k] = r[k];
  if (Object.keys(r.translations).length) rec.translations = r.translations;
  if (r.variationGroup !== undefined) rec.variationGroup = r.variationGroup;
  if (Object.keys(r.external).length) rec.external = r.external;
  rec.sources = r.sources;
  rec.origin = r.origin;
  // Kept always, not just on disagreement. `muscles` is derived from these, so
  // dropping them would leave the merged view unattributable — and it is the
  // per-source counts that let a caller ask for muscles two sources agree on
  // rather than everything anyone ever claimed.
  if (Object.keys(r.muscleClaims).length) rec.muscleClaims = r.muscleClaims;
  return rec;
});

writeFileSync('registry/movements.canonical.json', JSON.stringify({
  $comment: 'Canonical merged movement corpus. Every record names the sources that contributed to it, so provenance survives the merge and the licence question stays answerable. Rebuild with scripts/build-canonical.ts.',
  licenceWarning: 'Mixed provenance. wger and everkinetic are CC-BY-SA 4.0, Garmin’s catalogue carries no stated licence, free-exercise-db is public domain. See SOURCES.md before redistributing.',
  generated: new Date().toISOString().slice(0, 10), count: out.length, movements: out,
}, null, 0) + '\n');

const by = {};
for (const r of out) by[r.sources.slice().sort().join(' + ')] = (by[r.sources.slice().sort().join(' + ')] ?? 0) + 1;
console.log(`${out.length} movements`);
console.log(`  with muscle data:      ${out.filter((r) => r.muscles).length}`);
console.log(`  with a Garmin mapping: ${out.filter((r) => r.external?.garminCategory).length}`);
console.log(`  with translations:     ${out.filter((r) => r.translations).length}`);
console.log(`  in more than one source: ${out.filter((r) => r.sources.length > 1).length}`);
const disagree = out.filter((r) => {
  const c = Object.values(r.muscleClaims ?? {});
  return c.length > 1 && new Set(c.map((x) => JSON.stringify([[...x.primary].sort(), [...x.secondary].sort()]))).size > 1;
});
console.log(`  where sources disagree on muscles: ${disagree.length}`);
console.log('\nby source combination:');
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(v).padStart(5)}  ${k}`);
