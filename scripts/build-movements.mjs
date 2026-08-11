#!/usr/bin/env node
/**
 * Merge every movement source into registry/movements.canonical.json.
 *
 * Merge order is wdl-curated > garmin > free-exercise-db > wger > everkinetic.
 * Earlier sources win on conflicting scalar fields; set-valued fields — muscles,
 * equipment, aliases, translations — are unioned. Every record names the
 * sources that contributed to it, so the merge stays reversible and the licence
 * question stays answerable.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with']);
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('');
const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('-');

/** One vocabulary, so five sources can be compared at all. */
const MUSCLE = {
  abdominals: 'abs', abs: 'abs', quadriceps: 'quads', quads: 'quads', hamstrings: 'hamstrings',
  glutes: 'glutes', 'lower back': 'erectors', erectors: 'erectors', 'middle back': 'mid-back',
  lats: 'lats', biceps: 'biceps', triceps: 'triceps', chest: 'chest', shoulders: 'shoulders',
  traps: 'traps', calves: 'calves', forearms: 'forearms', forearm: 'forearms', obliques: 'obliques',
  hips: 'hip-flexors', 'hip-flexors': 'hip-flexors', abductors: 'abductors', adductors: 'adductors',
  neck: 'neck', 'rear-delts': 'rear-delts', grip: 'forearms', core: 'abs', 'upper-back': 'mid-back',
  soleus: 'calves', gastrocnemius: 'calves', 'anterior deltoid': 'shoulders', 'brachialis': 'biceps',
  'pectoralis major': 'chest', 'latissimus dorsi': 'lats', 'biceps femoris': 'hamstrings',
  'gluteus maximus': 'glutes', 'rectus abdominis': 'abs', 'trapezius': 'traps',
  'quadriceps femoris': 'quads', 'triceps brachii': 'triceps', 'biceps brachii': 'biceps',
  'serratus anterior': 'chest', 'obliquus externus abdominis': 'obliques', 'soleus muscle': 'calves',
};
const norm = (xs) => (xs ?? []).map((x) => {
  const k = String(x ?? '').trim().toLowerCase().replace(/_/g, ' ');
  return MUSCLE[k] ?? k.replace(/ /g, '-');
}).filter(Boolean);

const records = new Map();
function add(key, title, source, f = {}) {
  if (!key || !title) return;
  let r = records.get(key);
  if (!r) {
    r = { id: slug(title) || key, title, aliases: new Set(), primary: new Set(), secondary: new Set(),
          equipment: new Set(), pattern: new Set(), translations: {}, sources: [], external: {} };
    records.set(key, r);
  }
  if (!r.sources.includes(source)) r.sources.push(source);
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
  });
}
// 3. free-exercise-db — public domain
for (const e of JSON.parse(readFileSync('docs/references/free-exercise-db.json', 'utf8'))) {
  add(fold(e.name), e.name, 'free-exercise-db', {
    primary: norm(e.primaryMuscles), secondary: norm(e.secondaryMuscles),
    equipment: e.equipment && e.equipment !== 'body only' ? [e.equipment] : [],
    force: e.force, mechanic: e.mechanic,
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
      translations: names,
    });
  }
}
// 5. everkinetic
if (existsSync('/tmp/everkinetic.json')) {
  for (const e of JSON.parse(readFileSync('/tmp/everkinetic.json', 'utf8'))) {
    const t = e.title ?? e.name;
    if (!t) continue;
    add(fold(t), t, 'everkinetic', {
      primary: norm(e.primary), secondary: norm(e.secondary), equipment: e.equipment ?? [],
    });
  }
}

const out = [...records.values()].sort((a, b) => a.id.localeCompare(b.id)).map((r) => {
  const rec = { id: r.id, title: r.title };
  const aliases = [...r.aliases].filter((a) => fold(a) !== fold(r.title));
  if (aliases.length) rec.aliases = aliases.sort();
  if (r.primary.size || r.secondary.size) {
    rec.muscles = {};
    if (r.primary.size) rec.muscles.primary = [...r.primary].sort();
    const sec = [...r.secondary].filter((m) => !r.primary.has(m));
    if (sec.length) rec.muscles.secondary = sec.sort();
  }
  for (const k of ['pattern', 'equipment']) if (r[k].size) rec[k] = [...r[k]].sort();
  for (const k of ['implements', 'load', 'measures', 'laterality', 'defaultLaterality', 'force', 'mechanic'])
    if (r[k] !== undefined) rec[k] = r[k];
  if (Object.keys(r.translations).length) rec.translations = r.translations;
  if (Object.keys(r.external).length) rec.external = r.external;
  rec.sources = r.sources;
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
console.log('\nby source combination:');
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(v).padStart(5)}  ${k}`);
